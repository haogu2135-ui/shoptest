package com.example.shop.service;

import com.example.shop.config.RequestCorrelationFilter;
import com.example.shop.dto.ClientErrorReportRequest;
import com.example.shop.dto.SystemAlertSummaryResponse;
import com.example.shop.dto.SystemAlertBatchActionResponse;
import com.example.shop.dto.SystemAlertPurgeResponse;
import com.example.shop.dto.TrafficControlStatusResponse;
import com.example.shop.entity.SystemAlert;
import com.example.shop.util.SensitiveDataMasker;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import javax.servlet.http.HttpServletRequest;
import javax.sql.DataSource;
import java.io.File;
import java.net.URI;
import java.net.URISyntaxException;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class SystemAlertService {
    public static final String STATUS_OPEN = "OPEN";
    public static final String STATUS_ACKNOWLEDGED = "ACKNOWLEDGED";
    public static final String STATUS_RESOLVED = "RESOLVED";
    private static final int DEFAULT_SEARCH_MAX_ROWS = 1000;
    private static final int DEFAULT_BATCH_MAX_SIZE = 200;
    private static final int DEFAULT_RETENTION_MAX_DAYS = 3650;

    private final JdbcTemplate jdbcTemplate;
    private final RuntimeConfigService runtimeConfig;
    private final ObjectProvider<DataSource> dataSources;
    private final ObjectProvider<CircuitBreakerService> circuitBreakerServices;
    private final ObjectProvider<RateLimitService> rateLimitServices;
    private final ObjectProvider<LogManagementService> logManagementServices;
    private final ObjectProvider<ConfigCenterService> configCenterServices;

    public void recordException(Exception exception, HttpStatus status, HttpServletRequest request) {
        if (!runtimeConfig.getBoolean("alerts.exception.enabled", true) || exception == null) {
            return;
        }
        AlertDraft draft = classifyException(exception, status, request);
        if (draft == null) {
            return;
        }
        record(draft.severity, "EXCEPTION", draft.category, draft.title, draft.message, draft.fingerprint, draft.metadata);
    }

    public void recordSecurityEvent(String severity, String category, String title, String message, String fingerprint, String metadata) {
        if (!runtimeConfig.getBoolean("alerts.security.enabled", true)) {
            return;
        }
        record(severity, "SECURITY", category, title, message, fingerprint, metadata);
    }

    public void recordClientError(ClientErrorReportRequest report, HttpServletRequest request) {
        if (!runtimeConfig.getBoolean("alerts.client-error.enabled", true) || report == null) {
            return;
        }
        String context = sanitize(report.getContext(), 120);
        String name = sanitize(report.getName(), 80);
        String message = sanitize(firstNonBlank(report.getMessage(), report.getName(), "Client runtime error"), 500);
        String path = safeClientPath(firstNonBlank(report.getPath(), request == null ? null : request.getHeader("Referer"), "/"));
        String title = "Client error: " + firstNonBlank(context, name, "unknown");
        String fingerprint = "client-error:" + firstNonBlank(context, name, "unknown")
                + " message=" + limit(message, 160)
                + " path=" + path;

        record("WARNING", "CLIENT", "FRONTEND", title, message, fingerprint, clientErrorMetadata(report, request, path, name));
    }

    @Scheduled(fixedDelayString = "${alerts.self-check.interval-ms:60000}", initialDelayString = "${alerts.self-check.initial-delay-ms:30000}")
    public void scheduledSelfCheck() {
        if (!runtimeConfig.getBoolean("alerts.self-check.enabled", true)) {
            return;
        }
        runSelfCheck();
    }

    public void runSelfCheck() {
        checkDatabase();
        checkJvmMemory();
        checkDisk();
        checkLogSize();
        checkConfigCenter();
        checkCircuitBreakers();
        checkRateLimitRejections();
    }

    public List<SystemAlert> search(String status, String severity, String category, int limit) {
        int safeLimit = Math.max(1, Math.min(limit <= 0 ? 200 : limit, searchMaxRows()));
        String statusFilter = normalizeStatusFilter(status);
        String severityFilter = normalizeSeverityFilter(severity);
        String categoryFilter = normalizeCategoryFilter(category);
        return jdbcTemplate.query(
                "SELECT * FROM system_alerts "
                        + "WHERE (? IS NULL OR status = ?) "
                        + "AND (? IS NULL OR severity = ?) "
                        + "AND (? IS NULL OR category = ?) "
                        + "ORDER BY last_seen_at DESC, id DESC LIMIT ?",
                (rs, rowNum) -> mapAlert(rs),
                statusFilter, statusFilter,
                severityFilter, severityFilter,
                categoryFilter, categoryFilter,
                safeLimit);
    }

    public SystemAlertSummaryResponse summary() {
        SystemAlertSummaryResponse response = new SystemAlertSummaryResponse();
        response.setOpenCount(countByStatus(STATUS_OPEN));
        response.setAcknowledgedCount(countByStatus(STATUS_ACKNOWLEDGED));
        response.setResolvedCount(countByStatus(STATUS_RESOLVED));
        response.setMaxSearchRows(searchMaxRows());
        response.setMaxBatchActionSize(batchActionMaxSize());
        response.setMaxRetentionDays(retentionMaxDays());
        Map<String, Long> bySeverity = jdbcTemplate.queryForList(
                        "SELECT severity, COUNT(*) AS total FROM system_alerts WHERE status = ? GROUP BY severity",
                        STATUS_OPEN)
                .stream()
                .collect(Collectors.toMap(
                        row -> String.valueOf(row.get("severity")),
                        row -> ((Number) row.get("total")).longValue(),
                        (left, right) -> left,
                        LinkedHashMap::new));
        response.setOpenBySeverity(bySeverity);
        response.setCheckedAt(Instant.now().toString());
        return response;
    }

    public Optional<SystemAlert> acknowledge(Long id, String actor) {
        updateStatus(id, STATUS_ACKNOWLEDGED, actor);
        return findById(id);
    }

    public Optional<SystemAlert> resolve(Long id, String actor) {
        updateStatus(id, STATUS_RESOLVED, actor);
        return findById(id);
    }

    public SystemAlertBatchActionResponse acknowledgeBatch(List<Long> ids, String actor) {
        int requestedCount = ids == null ? 0 : ids.size();
        List<Long> safeIds = normalizeIds(ids);
        int updated = updateStatusBatch(safeIds, STATUS_ACKNOWLEDGED, actor);
        return batchResponse("ACKNOWLEDGE", requestedCount, safeIds, updated);
    }

    public SystemAlertBatchActionResponse resolveBatch(List<Long> ids, String actor) {
        int requestedCount = ids == null ? 0 : ids.size();
        List<Long> safeIds = normalizeIds(ids);
        int updated = updateStatusBatch(safeIds, STATUS_RESOLVED, actor);
        return batchResponse("RESOLVE", requestedCount, safeIds, updated);
    }

    public SystemAlertPurgeResponse purgeResolved(int retentionDays) {
        int safeDays = Math.max(1, Math.min(retentionDays <= 0 ? 30 : retentionDays, retentionMaxDays()));
        LocalDateTime purgedBefore = LocalDateTime.now().minusDays(safeDays);
        int deleted = jdbcTemplate.update(
                "DELETE FROM system_alerts WHERE status = ? AND resolved_at IS NOT NULL AND resolved_at < ?",
                STATUS_RESOLVED,
                purgedBefore);
        SystemAlertPurgeResponse response = new SystemAlertPurgeResponse();
        response.setRetentionDays(safeDays);
        response.setDeletedCount(deleted);
        response.setPurgedBefore(purgedBefore.toString());
        return response;
    }

    private void record(String severity, String source, String category, String title, String message, String fingerprint, String metadata) {
        String normalizedFingerprint = normalizeFingerprint(fingerprint);
        if (normalizedFingerprint == null || normalizedFingerprint.isEmpty()) {
            return;
        }
        String safeSource = sanitize(source, 50);
        String safeTitle = sanitize(title, 200);
        String safeMessage = sanitize(message, 1000);
        String safeMetadata = sanitize(metadata, 2000);
        try {
            Integer updated = jdbcTemplate.update(
                    "UPDATE system_alerts SET severity = ?, source = ?, category = ?, title = ?, message = ?, metadata = ?, "
                            + "occurrence_count = occurrence_count + 1, last_seen_at = NOW() "
                            + "WHERE fingerprint = ? AND status IN (?, ?)",
                    normalizeSeverity(severity), safeSource, normalizeCategory(category), safeTitle,
                    safeMessage, safeMetadata, normalizedFingerprint, STATUS_OPEN, STATUS_ACKNOWLEDGED);
            if (updated != null && updated > 0) {
                return;
            }
            jdbcTemplate.update(
                    "INSERT INTO system_alerts (severity, status, source, category, title, message, fingerprint, metadata, occurrence_count, first_seen_at, last_seen_at) "
                            + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())",
                    normalizeSeverity(severity), STATUS_OPEN, safeSource, normalizeCategory(category),
                    safeTitle, safeMessage, normalizedFingerprint, safeMetadata);
        } catch (RuntimeException e) {
            log.warn("System alert write failed. fingerprint={}", normalizedFingerprint, e);
        }
    }

    private AlertDraft classifyException(Exception exception, HttpStatus status, HttpServletRequest request) {
        Throwable root = rootCause(exception);
        String rootName = root.getClass().getSimpleName();
        String path = request == null ? "" : request.getRequestURI();
        String method = request == null ? "" : request.getMethod();
        String message = sanitize(root.getMessage());
        String category = exceptionCategory(root, exception);
        boolean serverError = status != null && status.is5xxServerError();
        boolean uploadTooLarge = exception instanceof MaxUploadSizeExceededException;
        boolean commonInfrastructure = !"APPLICATION".equals(category);
        if (!serverError && !uploadTooLarge && !commonInfrastructure) {
            return null;
        }
        String severity = serverError || "DATABASE".equals(category) || "REDIS".equals(category) ? "ERROR" : "WARNING";
        String title = uploadTooLarge ? "Upload size exceeded" : rootName + " detected";
        String safePath = safePath(path);
        String fingerprint = "exception:" + category + ":" + rootName + ":" + safePath;
        String metadata = "httpStatus=" + (status == null ? "" : status.value())
                + ", method=" + method
                + ", path=" + safePath;
        return new AlertDraft(severity, category, title, message, fingerprint, metadata);
    }

    private String clientErrorMetadata(ClientErrorReportRequest report, HttpServletRequest request, String path, String name) {
        List<String> parts = new ArrayList<>();
        addMetadata(parts, "path", path, 240);
        addMetadata(parts, "name", name, 80);
        addMetadata(parts, "source", report.getSource(), 40);
        addMetadata(parts, "appVersion", report.getAppVersion(), 80);
        addMetadata(parts, "occurredAt", report.getOccurredAt(), 40);
        addMetadata(parts, "requestId", requestId(request), 80);
        addMetadata(parts, "userAgent", report.getUserAgent(), 240);
        addMetadata(parts, "componentStack", report.getComponentStack(), 700);
        addMetadata(parts, "stack", report.getStack(), 900);
        return limit(String.join(", ", parts), 2000);
    }

    private void addMetadata(List<String> parts, String key, String value, int maxLength) {
        String safe = sanitize(value, maxLength);
        if (safe != null && !safe.isBlank()) {
            parts.add(key + "=" + safe);
        }
    }

    private String requestId(HttpServletRequest request) {
        if (request == null) {
            return "";
        }
        Object attribute = request.getAttribute(RequestCorrelationFilter.REQUEST_ID_ATTRIBUTE);
        if (attribute != null) {
            return String.valueOf(attribute);
        }
        return request.getHeader(RequestCorrelationFilter.REQUEST_ID_HEADER);
    }

    private String exceptionCategory(Throwable root, Exception exception) {
        String className = root.getClass().getName().toLowerCase(Locale.ROOT);
        if (exception instanceof DataAccessException || className.contains("sql") || className.contains("jdbc")) {
            return "DATABASE";
        }
        if (exception instanceof RedisConnectionFailureException || className.contains("redis")) {
            return "REDIS";
        }
        if (className.contains("timeout") || className.contains("socket")) {
            return "NETWORK";
        }
        if (className.contains("ioexception") || className.contains("filesystem")) {
            return "IO";
        }
        if (root instanceof NullPointerException) {
            return "NULL_POINTER";
        }
        if (exception instanceof MaxUploadSizeExceededException) {
            return "UPLOAD";
        }
        return "APPLICATION";
    }

    private void checkDatabase() {
        DataSource dataSource = dataSources.getIfAvailable();
        if (dataSource == null) {
            record("CRITICAL", "SELF_CHECK", "DATABASE", "Database datasource unavailable",
                    "DataSource bean is unavailable", "self-check:database:datasource", "");
            return;
        }
        try (Connection connection = dataSource.getConnection()) {
            if (!connection.isValid(2)) {
                record("CRITICAL", "SELF_CHECK", "DATABASE", "Database validation failed",
                        "Database connection validation returned false", "self-check:database:invalid", "");
            }
        } catch (Exception e) {
            record("CRITICAL", "SELF_CHECK", "DATABASE", "Database connection failed",
                    sanitize(e.getClass().getSimpleName() + ": " + e.getMessage()), "self-check:database:connection", "");
        }
    }

    private void checkJvmMemory() {
        Runtime runtime = Runtime.getRuntime();
        long max = runtime.maxMemory();
        long used = runtime.totalMemory() - runtime.freeMemory();
        double usedPercent = max <= 0 ? 0 : (used * 100.0) / max;
        double threshold = runtimeConfig.getInt("alerts.self-check.memory-used-percent", 90);
        if (usedPercent >= threshold) {
            record("WARNING", "SELF_CHECK", "JVM", "JVM memory usage is high",
                    "Used memory is " + round(usedPercent) + "%", "self-check:jvm:memory", "threshold=" + threshold + ", usedBytes=" + used + ", maxBytes=" + max);
        }
    }

    private void checkDisk() {
        File root = new File(".").getAbsoluteFile();
        long total = root.getTotalSpace();
        long free = root.getFreeSpace();
        double usedPercent = total <= 0 ? 0 : ((total - free) * 100.0) / total;
        double threshold = runtimeConfig.getInt("alerts.self-check.disk-used-percent", 90);
        if (usedPercent >= threshold) {
            record("WARNING", "SELF_CHECK", "DISK", "Disk usage is high",
                    "Disk usage is " + round(usedPercent) + "% at " + root.getPath(), "self-check:disk:" + root.getPath(), "threshold=" + threshold + ", freeBytes=" + free + ", totalBytes=" + total);
        }
    }

    private void checkLogSize() {
        LogManagementService service = logManagementServices.getIfAvailable();
        if (service == null) {
            return;
        }
        try {
            long totalBytes = service.status(null).getTotalLogBytes();
            long threshold = runtimeConfig.getLong("alerts.self-check.log-max-bytes", 1024L * 1024L * 1024L);
            if (totalBytes >= threshold) {
                record("WARNING", "SELF_CHECK", "LOGGING", "Log files are large",
                        "Total log size is " + totalBytes + " bytes", "self-check:logging:size", "threshold=" + threshold);
            }
        } catch (RuntimeException e) {
            record("WARNING", "SELF_CHECK", "LOGGING", "Log self-check failed",
                    sanitize(e.getMessage()), "self-check:logging:error", "");
        }
    }

    private void checkConfigCenter() {
        ConfigCenterService service = configCenterServices.getIfAvailable();
        if (service == null || !runtimeConfig.getBoolean("alerts.self-check.config-center-enabled", true)) {
            return;
        }
        try {
            var health = service.health(null, null, null);
            if (!health.isAvailable()) {
                record("WARNING", "SELF_CHECK", "CONFIG_CENTER", "Config center is unavailable",
                        String.join("; ", health.getErrors()),
                        "self-check:config-center:" + health.getNacosServerAddr(),
                        "serverStatus=" + health.getServerStatus() + ", dataId=" + health.getDataId() + ", group=" + health.getGroup());
            }
        } catch (RuntimeException e) {
            record("WARNING", "SELF_CHECK", "CONFIG_CENTER", "Config center self-check failed",
                    sanitize(e.getMessage()), "self-check:config-center:error", "");
        }
    }

    private void checkCircuitBreakers() {
        CircuitBreakerService service = circuitBreakerServices.getIfAvailable();
        if (service == null) {
            return;
        }
        for (TrafficControlStatusResponse.CircuitStatus circuit : service.status()) {
            if ("OPEN".equals(circuit.getState())) {
                record("ERROR", "SELF_CHECK", "CIRCUIT_BREAKER", "Circuit breaker is open",
                        circuit.getName() + " is open until " + circuit.getOpenedUntil(),
                        "self-check:circuit:" + circuit.getName(),
                        "failureCount=" + circuit.getFailureCount() + ", lastFailure=" + sanitize(circuit.getLastFailureMessage()));
            }
        }
    }

    private void checkRateLimitRejections() {
        RateLimitService service = rateLimitServices.getIfAvailable();
        if (service == null) {
            return;
        }
        long rejected = service.status().getRejectedRequests();
        long threshold = runtimeConfig.getLong("alerts.self-check.rate-limit-rejections", 100);
        if (rejected >= threshold) {
            record("WARNING", "SELF_CHECK", "RATE_LIMIT", "Rate limit rejections are high",
                    "Rejected requests reached " + rejected, "self-check:rate-limit:rejections", "threshold=" + threshold);
        }
    }

    private void updateStatus(Long id, String status, String actor) {
        if (id == null) {
            return;
        }
        String safeActor = sanitize(actor, 100);
        if (STATUS_ACKNOWLEDGED.equals(status)) {
            jdbcTemplate.update("UPDATE system_alerts SET status = ?, acknowledged_at = NOW(), acknowledged_by = ? WHERE id = ? AND status <> ?",
                    status, safeActor, id, STATUS_RESOLVED);
        } else if (STATUS_RESOLVED.equals(status)) {
            jdbcTemplate.update("UPDATE system_alerts SET status = ?, resolved_at = NOW(), resolved_by = ? WHERE id = ? AND status <> ?",
                    status, safeActor, id, STATUS_RESOLVED);
        }
    }

    private int updateStatusBatch(List<Long> ids, String status, String actor) {
        if (ids.isEmpty()) {
            return 0;
        }
        String placeholders = String.join(",", Collections.nCopies(ids.size(), "?"));
        List<Object> args = new ArrayList<>();
        args.add(status);
        args.add(sanitize(actor, 100));
        args.addAll(ids);
        if (STATUS_ACKNOWLEDGED.equals(status)) {
            return jdbcTemplate.update(
                    "UPDATE system_alerts SET status = ?, acknowledged_at = NOW(), acknowledged_by = ? "
                            + "WHERE id IN (" + placeholders + ") AND status <> ?",
                    append(args, STATUS_RESOLVED).toArray());
        }
        if (STATUS_RESOLVED.equals(status)) {
            return jdbcTemplate.update(
                    "UPDATE system_alerts SET status = ?, resolved_at = NOW(), resolved_by = ? "
                            + "WHERE id IN (" + placeholders + ") AND status <> ?",
                    append(args, STATUS_RESOLVED).toArray());
        }
        return 0;
    }

    private List<Object> append(List<Object> values, Object value) {
        List<Object> copy = new ArrayList<>(values);
        copy.add(value);
        return copy;
    }

    private List<Long> normalizeIds(List<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return List.of();
        }
        List<Long> normalizedIds = ids.stream()
                .filter(id -> id != null && id > 0)
                .distinct()
                .collect(Collectors.toList());
        if (normalizedIds.size() > batchActionMaxSize()) {
            throw new IllegalArgumentException("Too many system alerts selected");
        }
        return normalizedIds;
    }

    private SystemAlertBatchActionResponse batchResponse(String action, int requestedCount, List<Long> ids, int updatedCount) {
        SystemAlertBatchActionResponse response = new SystemAlertBatchActionResponse();
        response.setAction(action);
        response.setRequestedCount(requestedCount);
        response.setUpdatedCount(updatedCount);
        response.setIgnoredCount(Math.max(0, requestedCount - ids.size()));
        response.setMaxBatchSize(batchActionMaxSize());
        response.setIds(ids);
        return response;
    }

    private Optional<SystemAlert> findById(Long id) {
        List<SystemAlert> rows = jdbcTemplate.query("SELECT * FROM system_alerts WHERE id = ?", (rs, rowNum) -> mapAlert(rs), id);
        return rows.stream().findFirst();
    }

    private long countByStatus(String status) {
        Long count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM system_alerts WHERE status = ?", Long.class, status);
        return count == null ? 0 : count;
    }

    private SystemAlert mapAlert(ResultSet rs) throws SQLException {
        SystemAlert alert = new SystemAlert();
        alert.setId(rs.getLong("id"));
        alert.setSeverity(rs.getString("severity"));
        alert.setStatus(rs.getString("status"));
        alert.setSource(rs.getString("source"));
        alert.setCategory(rs.getString("category"));
        alert.setTitle(sanitize(rs.getString("title"), 200));
        alert.setMessage(sanitize(rs.getString("message"), 1000));
        alert.setFingerprint(sanitize(rs.getString("fingerprint"), 180));
        alert.setMetadata(sanitize(rs.getString("metadata"), 2000));
        alert.setOccurrenceCount(rs.getInt("occurrence_count"));
        alert.setFirstSeenAt(toLocalDateTime(rs, "first_seen_at"));
        alert.setLastSeenAt(toLocalDateTime(rs, "last_seen_at"));
        alert.setAcknowledgedAt(toLocalDateTime(rs, "acknowledged_at"));
        alert.setAcknowledgedBy(rs.getString("acknowledged_by"));
        alert.setResolvedAt(toLocalDateTime(rs, "resolved_at"));
        alert.setResolvedBy(rs.getString("resolved_by"));
        return alert;
    }

    private LocalDateTime toLocalDateTime(ResultSet rs, String column) throws SQLException {
        return rs.getTimestamp(column) == null ? null : rs.getTimestamp(column).toLocalDateTime();
    }

    private Throwable rootCause(Throwable throwable) {
        Throwable current = throwable;
        while (current.getCause() != null && current.getCause() != current) {
            current = current.getCause();
        }
        return current;
    }

    private String normalizeSeverity(String value) {
        String normalized = value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
        if ("CRITICAL".equals(normalized) || "ERROR".equals(normalized) || "WARNING".equals(normalized) || "INFO".equals(normalized)) {
            return normalized;
        }
        return "WARNING";
    }

    private String normalizeSeverityFilter(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return "ALL".equals(value.trim().toUpperCase(Locale.ROOT)) ? null : normalizeSeverity(value);
    }

    private String normalizeStatus(String value) {
        String normalized = value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
        if (STATUS_OPEN.equals(normalized) || STATUS_ACKNOWLEDGED.equals(normalized) || STATUS_RESOLVED.equals(normalized)) {
            return normalized;
        }
        return normalized;
    }

    private String normalizeStatusFilter(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String normalized = value.trim().toUpperCase(Locale.ROOT);
        return "ALL".equals(normalized) ? null : blankToNull(normalizeStatus(value));
    }

    private String normalizeCategory(String value) {
        String normalized = value == null ? "APPLICATION" : value.trim().toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9_]", "_");
        return limit(normalized.isEmpty() ? "APPLICATION" : normalized, 50);
    }

    private String normalizeCategoryFilter(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return "ALL".equals(value.trim().toUpperCase(Locale.ROOT)) ? null : normalizeCategory(value);
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private String safePath(String path) {
        if (path == null || path.isBlank()) {
            return "/";
        }
        String safe = path.replaceAll("/{2,}", "/");
        safe = safe.replaceAll("/\\d+", "/{id}");
        safe = safe.replaceAll("(?i)/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", "/{id}");
        safe = safe.replaceAll("(?i)/[0-9a-f]{16,}", "/{id}");
        safe = safe.replaceAll("(?i)/so\\d{10,}[0-9a-z]*", "/{orderNo}");
        safe = safe.replaceAll("/[A-Za-z0-9._~+\\-=]{64,}", "/{token}");
        return limit(safe, 240);
    }

    private String safeClientPath(String value) {
        String normalized = normalizeText(value);
        if (normalized == null || normalized.isBlank()) {
            return "/";
        }
        String path = normalized;
        if (path.startsWith("http://") || path.startsWith("https://")) {
            try {
                path = new URI(path).getPath();
            } catch (URISyntaxException ignored) {
                path = "/";
            }
        }
        if (path == null || path.isBlank()) {
            path = "/";
        }
        int queryStart = path.indexOf('?');
        if (queryStart >= 0) {
            path = path.substring(0, queryStart);
        }
        int hashStart = path.indexOf('#');
        if (hashStart >= 0) {
            path = path.substring(0, hashStart);
        }
        if (!path.startsWith("/")) {
            path = "/" + path;
        }
        return safePath(path);
    }

    private String sanitize(String value) {
        return sanitize(value, 240);
    }

    private String sanitize(String value, int maxLength) {
        String normalized = normalizeText(value);
        if (normalized == null || normalized.isEmpty()) {
            return "";
        }
        return limit(SensitiveDataMasker.mask(normalized), maxLength);
    }

    private String normalizeFingerprint(String value) {
        String normalized = sanitize(value, 180);
        if (normalized == null || normalized.isBlank()) {
            return null;
        }
        normalized = normalized.toLowerCase(Locale.ROOT);
        normalized = normalized.replaceAll("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", "{id}");
        normalized = normalized.replaceAll("\\b[0-9a-f]{16,}\\b", "{id}");
        normalized = normalized.replaceAll("\\bso\\d{10,}[0-9a-z]*\\b", "{orderno}");
        normalized = normalized.replaceAll("\\b\\d{6,}\\b", "{id}");
        normalized = normalized.replaceAll("\\b[a-z0-9._~+\\-=]{64,}\\b", "{token}");
        return limit(normalized, 180);
    }

    private String normalizeText(String value) {
        return value == null ? null : value.replaceAll("[\\r\\n\\t]+", " ").replaceAll("\\s+", " ").trim();
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return "";
        }
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return "";
    }

    private String limit(String value, int maxLength) {
        if (value == null) {
            return null;
        }
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
    }

    private double round(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private int searchMaxRows() {
        return boundedInt("alerts.admin.search-max-rows", DEFAULT_SEARCH_MAX_ROWS, 1, 5000);
    }

    private int batchActionMaxSize() {
        return boundedInt("alerts.admin.batch-action-max-size", DEFAULT_BATCH_MAX_SIZE, 1, 1000);
    }

    private int retentionMaxDays() {
        return boundedInt("alerts.admin.retention-max-days", DEFAULT_RETENTION_MAX_DAYS, 1, 3650);
    }

    private int boundedInt(String key, int defaultValue, int min, int max) {
        int configured = runtimeConfig.getInt(key, defaultValue);
        return Math.max(min, Math.min(configured, max));
    }

    private static class AlertDraft {
        private final String severity;
        private final String category;
        private final String title;
        private final String message;
        private final String fingerprint;
        private final String metadata;

        private AlertDraft(String severity, String category, String title, String message, String fingerprint, String metadata) {
            this.severity = severity;
            this.category = category;
            this.title = title;
            this.message = message;
            this.fingerprint = fingerprint;
            this.metadata = metadata;
        }
    }
}
