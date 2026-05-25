package com.example.shop.service;

import com.example.shop.dto.SecurityAuditSummaryResponse;
import com.example.shop.dto.SecurityAuditPurgeResponse;
import com.example.shop.entity.SecurityAuditLog;
import com.example.shop.repository.SecurityAuditLogMapper;
import com.example.shop.security.UserDetailsImpl;
import com.example.shop.util.SensitiveDataMasker;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

import javax.servlet.http.HttpServletRequest;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class SecurityAuditLogService {
    private static final int DEFAULT_RANGE_HOURS = 24;
    private static final int DEFAULT_MAX_RANGE_HOURS = 168;
    private static final int DEFAULT_SEARCH_MAX_ROWS = 1000;
    private static final int DEFAULT_EXPORT_MAX_ROWS = 5000;

    private final SecurityAuditLogMapper auditLogMapper;
    private final JdbcTemplate jdbcTemplate;
    private final ClientIpResolver clientIpResolver;
    private final RuntimeConfigService runtimeConfig;

    public void record(String action,
                       String result,
                       Long actorUserId,
                       String actorUsername,
                       String actorRole,
                       String resourceType,
                       Object resourceId,
                       HttpServletRequest request,
                       String message,
                       String metadata) {
        SecurityAuditLog auditLog = new SecurityAuditLog();
        auditLog.setAction(limit(normalizeLogText(action), 50));
        auditLog.setResult(limit(normalizeLogText(result), 20));
        auditLog.setActorUserId(actorUserId);
        auditLog.setActorUsername(limit(normalizeLogText(actorUsername), 100));
        auditLog.setActorRole(limit(normalizeLogText(actorRole), 30));
        auditLog.setResourceType(limit(normalizeLogText(resourceType), 50));
        auditLog.setResourceId(resourceId == null ? null : sanitizeLogText(String.valueOf(resourceId), 100));
        auditLog.setIpAddress(limit(normalizeLogText(clientIpResolver.resolve(request)), 45));
        auditLog.setUserAgent(limit(normalizeLogText(request == null ? null : request.getHeader("User-Agent")), 500));
        auditLog.setMessage(sanitizeLogText(message, 1000));
        auditLog.setMetadata(sanitizeLogText(metadata, 2000));
        auditLog.setCreatedAt(LocalDateTime.now());
        try {
            auditLogMapper.insert(auditLog);
        } catch (RuntimeException e) {
            log.warn("Security audit log write failed. action={}, result={}, actor={}, resourceType={}, resourceId={}",
                    action, result, actorUsername, resourceType, resourceId, e);
        }
    }

    public void record(String action,
                       String result,
                       Authentication authentication,
                       String resourceType,
                       Object resourceId,
                       HttpServletRequest request,
                       String message,
                       String metadata) {
        Actor actor = actorFrom(authentication);
        record(action, result, actor.userId, actor.username, actor.role, resourceType, resourceId, request, message, metadata);
    }

    public List<SecurityAuditLog> search(String action,
                                         String result,
                                         String actorUsername,
                                         String resourceType,
                                         LocalDateTime startAt,
                                         LocalDateTime endAt,
                                         int limit) {
        int safeLimit = Math.max(1, Math.min(limit <= 0 ? 200 : limit, maxSearchRows()));
        TimeRange range = normalizeRange(startAt, endAt);
        List<SecurityAuditLog> rows = auditLogMapper.search(
                exactFilter(action, 50),
                exactFilter(result, 20),
                likeFilter(actorUsername, 100),
                exactFilter(resourceType, 50),
                range.startAt,
                range.endAt,
                safeLimit);
        rows.forEach(this::maskForResponse);
        return rows;
    }

    public List<SecurityAuditLog> export(String action,
                                         String result,
                                         String actorUsername,
                                         String resourceType,
                                         LocalDateTime startAt,
                                         LocalDateTime endAt) {
        TimeRange range = normalizeRange(startAt, endAt);
        List<SecurityAuditLog> rows = auditLogMapper.search(
                exactFilter(action, 50),
                exactFilter(result, 20),
                likeFilter(actorUsername, 100),
                exactFilter(resourceType, 50),
                range.startAt,
                range.endAt,
                maxExportRows());
        rows.forEach(this::maskForResponse);
        return rows;
    }

    public SecurityAuditSummaryResponse summary(LocalDateTime startAt, LocalDateTime endAt, int topLimit) {
        int safeLimit = Math.max(1, Math.min(topLimit <= 0 ? 10 : topLimit, 50));
        TimeRange range = normalizeRange(startAt, endAt);
        LocalDateTime safeStart = range.startAt;
        LocalDateTime safeEnd = range.endAt;

        SecurityAuditSummaryResponse response = new SecurityAuditSummaryResponse();
        response.setStartAt(safeStart.toString());
        response.setEndAt(safeEnd.toString());
        response.setDefaultRangeHours(defaultRangeHours());
        response.setMaxRangeHours(maxRangeHours());
        response.setMaxSearchRows(maxSearchRows());
        response.setMaxExportRows(maxExportRows());
        response.setTotalCount(count(null, safeStart, safeEnd));
        response.setSuccessCount(count("SUCCESS", safeStart, safeEnd));
        response.setFailureCount(count("FAILURE", safeStart, safeEnd));
        response.setByResult(groupCount("result", safeStart, safeEnd, safeLimit));
        response.setTopActions(groupCount("action", safeStart, safeEnd, safeLimit));
        response.setTopActors(groupCount("actor_username", safeStart, safeEnd, safeLimit));
        response.setTopIpAddresses(groupCount("ip_address", safeStart, safeEnd, safeLimit));
        response.setCheckedAt(Instant.now().toString());
        return response;
    }

    public SecurityAuditPurgeResponse purge(int retentionDays) {
        int safeDays = Math.max(7, Math.min(retentionDays <= 0 ? 180 : retentionDays, 3650));
        LocalDateTime purgedBefore = LocalDateTime.now().minusDays(safeDays);
        int deleted = jdbcTemplate.update(
                "DELETE FROM security_audit_logs WHERE created_at < ?",
                purgedBefore);
        SecurityAuditPurgeResponse response = new SecurityAuditPurgeResponse();
        response.setRetentionDays(safeDays);
        response.setDeletedCount(deleted);
        response.setPurgedBefore(purgedBefore.toString());
        return response;
    }

    private long count(String result, LocalDateTime startAt, LocalDateTime endAt) {
        String sql = "SELECT COUNT(*) FROM security_audit_logs WHERE created_at >= ? AND created_at <= ?"
                + (result == null ? "" : " AND result = ?");
        Long count = result == null
                ? jdbcTemplate.queryForObject(sql, Long.class, startAt, endAt)
                : jdbcTemplate.queryForObject(sql, Long.class, startAt, endAt, result);
        return count == null ? 0 : count;
    }

    private List<SecurityAuditSummaryResponse.GroupCount> groupCount(String column, LocalDateTime startAt, LocalDateTime endAt, int limit) {
        if (!List.of("result", "action", "actor_username", "ip_address").contains(column)) {
            return List.of();
        }
        String sql = "SELECT COALESCE(NULLIF(" + column + ", ''), 'UNKNOWN') AS name, COUNT(*) AS total "
                + "FROM security_audit_logs WHERE created_at >= ? AND created_at <= ? "
                + "GROUP BY COALESCE(NULLIF(" + column + ", ''), 'UNKNOWN') "
                + "ORDER BY total DESC, name ASC LIMIT ?";
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, startAt, endAt, limit);
        return rows.stream()
                .map(row -> new SecurityAuditSummaryResponse.GroupCount(
                        String.valueOf(row.get("name")),
                        ((Number) row.get("total")).longValue()))
                .collect(Collectors.toList());
    }

    private Actor actorFrom(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof UserDetailsImpl) {
            UserDetailsImpl user = (UserDetailsImpl) authentication.getPrincipal();
            String role = user.getAuthorities().stream()
                    .findFirst()
                    .map(Object::toString)
                    .orElse(null);
            return new Actor(user.getId(), user.getUsername(), role);
        }
        return new Actor(null, null, null);
    }

    private String limit(String value, int maxLength) {
        if (value == null) {
            return null;
        }
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
    }

    private String exactFilter(String value, int maxLength) {
        String normalized = normalizeLogText(value);
        if (normalized == null || normalized.isEmpty()) {
            return null;
        }
        return limit(normalized.toUpperCase(), maxLength);
    }

    private String likeFilter(String value, int maxLength) {
        String normalized = normalizeLogText(value);
        if (normalized == null || normalized.isEmpty()) {
            return null;
        }
        return escapeLike(limit(normalized, maxLength));
    }

    private String escapeLike(String value) {
        return value.replace("!", "!!")
                .replace("%", "!%")
                .replace("_", "!_");
    }

    private String normalizeLogText(String value) {
        if (value == null) {
            return null;
        }
        return value.replaceAll("\\p{Cntrl}", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private String sanitizeLogText(String value, int maxLength) {
        String normalized = normalizeLogText(value);
        if (normalized == null || normalized.isEmpty()) {
            return normalized;
        }
        return limit(SensitiveDataMasker.mask(normalized), maxLength);
    }

    private TimeRange normalizeRange(LocalDateTime startAt, LocalDateTime endAt) {
        LocalDateTime safeEnd = endAt == null ? LocalDateTime.now() : endAt;
        LocalDateTime safeStart = startAt == null ? safeEnd.minusHours(defaultRangeHours()) : startAt;
        if (safeEnd.isBefore(safeStart)) {
            LocalDateTime temp = safeStart;
            safeStart = safeEnd;
            safeEnd = temp;
        }
        Duration duration = Duration.between(safeStart, safeEnd);
        if (duration.compareTo(Duration.ofHours(maxRangeHours())) > 0) {
            safeStart = safeEnd.minusHours(maxRangeHours());
        }
        return new TimeRange(safeStart, safeEnd);
    }

    private int defaultRangeHours() {
        return boundedInt("admin.audit-logs.default-range-hours", DEFAULT_RANGE_HOURS, 1, maxRangeHours());
    }

    private int maxRangeHours() {
        return boundedInt("admin.audit-logs.max-range-hours", DEFAULT_MAX_RANGE_HOURS, 1, 24 * 365);
    }

    private int maxSearchRows() {
        return boundedInt("admin.audit-logs.search-max-rows", DEFAULT_SEARCH_MAX_ROWS, 1, 5000);
    }

    private int maxExportRows() {
        return boundedInt("admin.audit-logs.export-max-rows", DEFAULT_EXPORT_MAX_ROWS, 1, 50000);
    }

    private int boundedInt(String key, int defaultValue, int min, int max) {
        int configured = runtimeConfig.getInt(key, defaultValue);
        return Math.max(min, Math.min(configured, max));
    }

    private void maskForResponse(SecurityAuditLog log) {
        if (log == null) {
            return;
        }
        log.setResourceId(sanitizeLogText(log.getResourceId(), 100));
        log.setUserAgent(sanitizeLogText(log.getUserAgent(), 500));
        log.setMessage(sanitizeLogText(log.getMessage(), 1000));
        log.setMetadata(sanitizeLogText(log.getMetadata(), 2000));
    }

    private static class TimeRange {
        private final LocalDateTime startAt;
        private final LocalDateTime endAt;

        private TimeRange(LocalDateTime startAt, LocalDateTime endAt) {
            this.startAt = startAt;
            this.endAt = endAt;
        }
    }

    private static class Actor {
        private final Long userId;
        private final String username;
        private final String role;

        private Actor(Long userId, String username, String role) {
            this.userId = userId;
            this.username = username;
            this.role = role;
        }
    }
}
