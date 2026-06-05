package com.example.shop.service;

import com.example.shop.dto.AdminBugReportPageResponse;
import com.example.shop.dto.AdminBugReportRequest;
import com.example.shop.dto.AdminBugReportStatusRequest;
import com.example.shop.dto.AdminBugReportSummaryResponse;
import com.example.shop.entity.AdminBugReport;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.PreparedStatement;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class AdminBugReportService {
    public static final String STATUS_OPEN = "OPEN";
    public static final String STATUS_FIXING = "FIXING";
    public static final String STATUS_FIXED_PENDING_REGRESSION = "FIXED_PENDING_REGRESSION";
    public static final String STATUS_REGRESSION_PASSED = "REGRESSION_PASSED";
    public static final String STATUS_REGRESSION_FAILED = "REGRESSION_FAILED";
    public static final String STATUS_CLOSED = "CLOSED";
    public static final String STATUS_NON_ISSUE = "NON_ISSUE";
    public static final int SCAN_INTERVAL_MINUTES = 10;

    private static final int DEFAULT_PAGE_SIZE = 20;
    private static final int MAX_PAGE_SIZE = 100;
    private static final Set<String> STATUSES = Set.of(
            STATUS_OPEN,
            STATUS_FIXING,
            STATUS_FIXED_PENDING_REGRESSION,
            STATUS_REGRESSION_PASSED,
            STATUS_REGRESSION_FAILED,
            STATUS_CLOSED,
            STATUS_NON_ISSUE);
    private static final Set<String> SEVERITIES = Set.of("LOW", "MEDIUM", "HIGH", "CRITICAL");
    private static final Set<String> PRIORITIES = Set.of("P0", "P1", "P2", "P3");
    private static final Set<String> MODULES = Set.of(
            "GENERAL",
            "FRONTEND",
            "BACKEND",
            "ANDROID_APP",
            "ADMIN",
            "PAYMENT",
            "ORDER",
            "PRODUCT",
            "SUPPORT",
            "INFRASTRUCTURE");
    private static final Map<String, Set<String>> STATUS_TRANSITIONS = Map.of(
            STATUS_OPEN, Set.of(STATUS_OPEN, STATUS_FIXING, STATUS_NON_ISSUE),
            STATUS_FIXING, Set.of(STATUS_FIXING, STATUS_FIXED_PENDING_REGRESSION, STATUS_NON_ISSUE),
            STATUS_FIXED_PENDING_REGRESSION, Set.of(STATUS_FIXED_PENDING_REGRESSION, STATUS_REGRESSION_PASSED, STATUS_REGRESSION_FAILED, STATUS_NON_ISSUE),
            STATUS_REGRESSION_PASSED, Set.of(STATUS_REGRESSION_PASSED, STATUS_CLOSED, STATUS_REGRESSION_FAILED),
            STATUS_REGRESSION_FAILED, Set.of(STATUS_REGRESSION_FAILED, STATUS_FIXING, STATUS_NON_ISSUE),
            STATUS_CLOSED, Set.of(STATUS_CLOSED, STATUS_OPEN),
            STATUS_NON_ISSUE, Set.of(STATUS_NON_ISSUE, STATUS_OPEN));

    private final JdbcTemplate jdbcTemplate;

    @Transactional(readOnly = true)
    public AdminBugReportPageResponse search(int page,
                                             int size,
                                             String status,
                                             String severity,
                                             String module,
                                             String keyword,
                                             boolean scanQueueOnly) {
        int safeSize = clamp(size <= 0 ? DEFAULT_PAGE_SIZE : size, 1, MAX_PAGE_SIZE);
        int safePage = Math.max(1, page);
        Filter filter = buildFilter(status, severity, module, keyword, scanQueueOnly);
        long total = count(filter);
        int totalPages = total <= 0 ? 0 : (int) Math.ceil((double) total / safeSize);
        if (totalPages > 0 && safePage > totalPages) {
            safePage = totalPages;
        }
        int offset = Math.max(0, (safePage - 1) * safeSize);
        List<Object> args = new ArrayList<>(filter.args);
        args.add(safeSize);
        args.add(offset);
        List<AdminBugReport> items = jdbcTemplate.query(
                "SELECT * FROM admin_bug_reports "
                        + filter.where
                        + " ORDER BY CASE WHEN status IN ('OPEN','REGRESSION_FAILED') THEN 0 "
                        + "WHEN status = 'FIXING' THEN 1 "
                        + "WHEN status = 'FIXED_PENDING_REGRESSION' THEN 2 ELSE 3 END, "
                        + "updated_at DESC, id DESC LIMIT ? OFFSET ?",
                mapper(),
                args.toArray());
        return AdminBugReportPageResponse.of(items, total, safePage, safeSize);
    }

    @Transactional(readOnly = true)
    public AdminBugReportSummaryResponse summary() {
        LocalDateTime now = LocalDateTime.now();
        AdminBugReportSummaryResponse response = new AdminBugReportSummaryResponse();
        response.setTotalBugs(countByStatus(null));
        response.setOpenCount(countByStatus(STATUS_OPEN));
        response.setFixingCount(countByStatus(STATUS_FIXING));
        response.setFixedPendingRegressionCount(countByStatus(STATUS_FIXED_PENDING_REGRESSION));
        response.setRegressionPassedCount(countByStatus(STATUS_REGRESSION_PASSED));
        response.setRegressionFailedCount(countByStatus(STATUS_REGRESSION_FAILED));
        response.setClosedCount(countByStatus(STATUS_CLOSED));
        response.setDueForScanCount(countDueForScan());
        response.setScanIntervalMinutes(SCAN_INTERVAL_MINUTES);
        response.setNextScanAt(now.plusMinutes(SCAN_INTERVAL_MINUTES));
        response.setCheckedAt(now);
        response.setByStatus(groupCount("status"));
        response.setBySeverity(groupCount("severity"));
        return response;
    }

    @Transactional(readOnly = true)
    public AdminBugReport findById(Long id) {
        List<AdminBugReport> bugs = jdbcTemplate.query(
                "SELECT * FROM admin_bug_reports WHERE id = ?",
                mapper(),
                id);
        if (bugs.isEmpty()) {
            throw new IllegalArgumentException("Bug report not found");
        }
        return bugs.get(0);
    }

    @Transactional
    public AdminBugReport create(AdminBugReportRequest request, Long reporterId, String reporterName) {
        if (request == null) {
            throw new IllegalArgumentException("Bug payload is required");
        }
        NormalizedBug normalized = normalizeCreate(request);
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement(
                    "INSERT INTO admin_bug_reports "
                            + "(title, description, module, severity, priority, status, page_url, environment, "
                            + "reproduction_steps, expected_result, actual_result, attachment_urls, reporter_id, "
                            + "reporter_name, assigned_to, scan_note, fix_summary, regression_note, created_at, updated_at) "
                            + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())",
                    Statement.RETURN_GENERATED_KEYS);
            ps.setString(1, normalized.title);
            ps.setString(2, normalized.description);
            ps.setString(3, normalized.module);
            ps.setString(4, normalized.severity);
            ps.setString(5, normalized.priority);
            ps.setString(6, normalized.status);
            ps.setString(7, normalized.pageUrl);
            ps.setString(8, normalized.environment);
            ps.setString(9, normalized.reproductionSteps);
            ps.setString(10, normalized.expectedResult);
            ps.setString(11, normalized.actualResult);
            ps.setString(12, normalized.attachmentUrls);
            if (reporterId == null) {
                ps.setNull(13, java.sql.Types.BIGINT);
            } else {
                ps.setLong(13, reporterId);
            }
            ps.setString(14, sanitize(reporterName, 120));
            ps.setString(15, normalized.assignedTo);
            ps.setString(16, normalized.scanNote);
            ps.setString(17, normalized.fixSummary);
            ps.setString(18, normalized.regressionNote);
            return ps;
        }, keyHolder);
        Number id = keyHolder.getKey();
        return findById(id == null ? 0L : id.longValue());
    }

    @Transactional
    public AdminBugReport update(Long id, AdminBugReportRequest request, String actor) {
        if (request == null) {
            throw new IllegalArgumentException("Bug payload is required");
        }
        AdminBugReport existing = findById(id);
        NormalizedBug normalized = normalizeUpdate(request, existing);
        boolean stampFixed = shouldStampFixed(existing.getStatus(), normalized.status);
        boolean stampRegression = shouldStampRegression(existing.getStatus(), normalized.status);
        boolean stampClosed = shouldStampClosed(existing.getStatus(), normalized.status);
        boolean clearClosed = shouldClearClosed(existing.getStatus(), normalized.status);
        jdbcTemplate.update(
                "UPDATE admin_bug_reports SET "
                        + "title = ?, description = ?, module = ?, severity = ?, priority = ?, status = ?, "
                        + "page_url = ?, environment = ?, reproduction_steps = ?, expected_result = ?, actual_result = ?, "
                        + "attachment_urls = ?, assigned_to = ?, scan_note = ?, fix_summary = ?, regression_note = ?, "
                        + "last_scanned_at = CASE WHEN ? THEN NOW() ELSE last_scanned_at END, "
                        + "fixed_at = CASE WHEN ? THEN NOW() ELSE fixed_at END, "
                        + "fixed_by = CASE WHEN ? THEN ? ELSE fixed_by END, "
                        + "regression_at = CASE WHEN ? THEN NOW() ELSE regression_at END, "
                        + "regression_by = CASE WHEN ? THEN ? ELSE regression_by END, "
                        + "closed_at = CASE WHEN ? THEN NOW() WHEN ? THEN NULL ELSE closed_at END, "
                        + "updated_at = NOW() WHERE id = ?",
                normalized.title,
                normalized.description,
                normalized.module,
                normalized.severity,
                normalized.priority,
                normalized.status,
                normalized.pageUrl,
                normalized.environment,
                normalized.reproductionSteps,
                normalized.expectedResult,
                normalized.actualResult,
                normalized.attachmentUrls,
                normalized.assignedTo,
                normalized.scanNote,
                normalized.fixSummary,
                normalized.regressionNote,
                Boolean.valueOf(shouldStampScan(existing.getStatus(), normalized.status, existing.getScanNote(), normalized.scanNote)),
                Boolean.valueOf(stampFixed),
                Boolean.valueOf(stampFixed),
                actor,
                Boolean.valueOf(stampRegression),
                Boolean.valueOf(stampRegression),
                actor,
                Boolean.valueOf(stampClosed),
                Boolean.valueOf(clearClosed),
                id);
        return findById(id);
    }

    @Transactional
    public AdminBugReport updateStatus(Long id, AdminBugReportStatusRequest request, String actor) {
        if (request == null) {
            throw new IllegalArgumentException("Status payload is required");
        }
        AdminBugReport existing = findById(id);
        String status = normalizeStatus(request.getStatus(), existing.getStatus());
        validateStatusTransition(existing.getStatus(), status);
        String assignedTo = optionalText(request.getAssignedTo(), 120, existing.getAssignedTo());
        String scanNote = mergeNote(existing.getScanNote(), request.getScanNote(), request.getNote(), 2000);
        String fixSummary = mergeNote(existing.getFixSummary(), request.getFixSummary(), null, 2000);
        String regressionNote = mergeNote(existing.getRegressionNote(), request.getRegressionNote(), null, 2000);
        boolean stampScan = shouldStampScan(existing.getStatus(), status, existing.getScanNote(), scanNote);
        boolean stampFixed = shouldStampFixed(existing.getStatus(), status);
        boolean stampRegression = shouldStampRegression(existing.getStatus(), status);
        boolean stampClosed = shouldStampClosed(existing.getStatus(), status);
        boolean clearClosed = shouldClearClosed(existing.getStatus(), status);
        int updated = jdbcTemplate.update(
                "UPDATE admin_bug_reports SET status = ?, assigned_to = ?, scan_note = ?, fix_summary = ?, regression_note = ?, "
                        + "last_scanned_at = CASE WHEN ? THEN NOW() ELSE last_scanned_at END, "
                        + "fixed_at = CASE WHEN ? THEN NOW() ELSE fixed_at END, "
                        + "fixed_by = CASE WHEN ? THEN ? ELSE fixed_by END, "
                        + "regression_at = CASE WHEN ? THEN NOW() ELSE regression_at END, "
                        + "regression_by = CASE WHEN ? THEN ? ELSE regression_by END, "
                        + "closed_at = CASE WHEN ? THEN NOW() WHEN ? THEN NULL ELSE closed_at END, updated_at = NOW() "
                        + "WHERE id = ? AND status = ?",
                status,
                assignedTo,
                scanNote,
                fixSummary,
                regressionNote,
                Boolean.valueOf(stampScan),
                Boolean.valueOf(stampFixed),
                Boolean.valueOf(stampFixed),
                actor,
                Boolean.valueOf(stampRegression),
                Boolean.valueOf(stampRegression),
                actor,
                Boolean.valueOf(stampClosed),
                Boolean.valueOf(clearClosed),
                id,
                existing.getStatus());
        if (updated == 0) {
            throw new IllegalArgumentException("Bug status changed, reload and try again");
        }
        return findById(id);
    }

    @Transactional
    public AdminBugReport markScanned(Long id, AdminBugReportStatusRequest request, String actor) {
        AdminBugReport existing = findById(id);
        String scanNote = mergeNote(existing.getScanNote(), request == null ? null : request.getScanNote(),
                request == null ? null : request.getNote(), 2000);
        String fixSummary = mergeNote(existing.getFixSummary(), request == null ? null : request.getFixSummary(), null, 2000);
        String regressionNote = mergeNote(existing.getRegressionNote(), request == null ? null : request.getRegressionNote(), null, 2000);
        String assignedTo = optionalText(request == null ? null : request.getAssignedTo(), 120, existing.getAssignedTo());
        String requestedStatus = normalizeStatus(request == null ? null : request.getStatus(), STATUS_FIXING);
        if (!STATUS_FIXING.equals(requestedStatus)) {
            throw new IllegalArgumentException("Scan status must be FIXING");
        }
        if (!isScannableStatus(existing.getStatus())) {
            throw new IllegalArgumentException("Bug status is not available for scan");
        }
        String status = shouldMoveToFixingOnScan(existing.getStatus(), requestedStatus)
                ? STATUS_FIXING
                : existing.getStatus();
        int updated = jdbcTemplate.update(
                "UPDATE admin_bug_reports SET status = ?, assigned_to = ?, scan_note = ?, fix_summary = ?, "
                        + "regression_note = ?, last_scanned_at = NOW(), updated_at = NOW() WHERE id = ? AND status = ?",
                status,
                assignedTo == null || assignedTo.isBlank() ? actor : assignedTo,
                scanNote,
                fixSummary,
                regressionNote,
                id,
                existing.getStatus());
        if (updated == 0) {
            throw new IllegalArgumentException("Bug status changed, reload and try again");
        }
        return findById(id);
    }

    private Filter buildFilter(String status, String severity, String module, String keyword, boolean scanQueueOnly) {
        StringBuilder where = new StringBuilder("WHERE 1=1");
        List<Object> args = new ArrayList<>();
        String safeStatus = normalizeStatusFilter(status);
        if (safeStatus != null) {
            where.append(" AND status = ?");
            args.add(safeStatus);
        }
        String safeSeverity = normalizeSeverityFilter(severity);
        if (safeSeverity != null) {
            where.append(" AND severity = ?");
            args.add(safeSeverity);
        }
        String safeModule = normalizeModuleFilter(module);
        if (safeModule != null) {
            where.append(" AND module = ?");
            args.add(safeModule);
        }
        String keywordPattern = keywordPattern(keyword);
        if (keywordPattern != null) {
            where.append(" AND (LOWER(title) LIKE ? OR LOWER(description) LIKE ? OR LOWER(COALESCE(page_url, '')) LIKE ? OR LOWER(COALESCE(scan_note, '')) LIKE ? OR LOWER(COALESCE(fix_summary, '')) LIKE ?)");
            args.add(keywordPattern);
            args.add(keywordPattern);
            args.add(keywordPattern);
            args.add(keywordPattern);
            args.add(keywordPattern);
        }
        if (scanQueueOnly) {
            where.append(" AND status IN ('OPEN','FIXING','REGRESSION_FAILED') AND (last_scanned_at IS NULL OR last_scanned_at <= ?)");
            args.add(LocalDateTime.now().minusMinutes(SCAN_INTERVAL_MINUTES));
        }
        return new Filter(where.toString(), args);
    }

    private long count(Filter filter) {
        Long count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM admin_bug_reports " + filter.where,
                Long.class,
                filter.args.toArray());
        return count == null ? 0L : count;
    }

    private long countByStatus(String status) {
        Long count = status == null
                ? jdbcTemplate.queryForObject("SELECT COUNT(*) FROM admin_bug_reports", Long.class)
                : jdbcTemplate.queryForObject("SELECT COUNT(*) FROM admin_bug_reports WHERE status = ?", Long.class, status);
        return count == null ? 0L : count;
    }

    private long countDueForScan() {
        Long count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM admin_bug_reports "
                        + "WHERE status IN ('OPEN','FIXING','REGRESSION_FAILED') "
                        + "AND (last_scanned_at IS NULL OR last_scanned_at <= ?)",
                Long.class,
                LocalDateTime.now().minusMinutes(SCAN_INTERVAL_MINUTES));
        return count == null ? 0L : count;
    }

    private Map<String, Long> groupCount(String column) {
        Map<String, Long> result = new LinkedHashMap<>();
        jdbcTemplate.queryForList(
                        "SELECT " + column + " AS k, COUNT(*) AS total FROM admin_bug_reports GROUP BY " + column + " ORDER BY total DESC")
                .forEach(row -> result.put(String.valueOf(row.get("k")), ((Number) row.get("total")).longValue()));
        return result;
    }

    private NormalizedBug normalizeCreate(AdminBugReportRequest request) {
        NormalizedBug normalized = normalizeFields(request);
        normalized.status = STATUS_OPEN;
        normalized.scanNote = null;
        normalized.fixSummary = null;
        normalized.regressionNote = null;
        return normalized;
    }

    private NormalizedBug normalizeUpdate(AdminBugReportRequest request, AdminBugReport existing) {
        NormalizedBug normalized = normalizeFields(request);
        normalized.status = existing.getStatus();
        normalized.scanNote = existing.getScanNote();
        normalized.fixSummary = existing.getFixSummary();
        normalized.regressionNote = existing.getRegressionNote();
        return normalized;
    }

    private NormalizedBug normalizeFields(AdminBugReportRequest request) {
        String title = requiredText(request.getTitle(), 160, "Title is required");
        String description = requiredMultilineText(request.getDescription(), 4000, "Description is required");
        NormalizedBug normalized = new NormalizedBug();
        normalized.title = title;
        normalized.description = description;
        normalized.module = normalizeModule(request.getModule(), "GENERAL");
        normalized.severity = normalizeSeverity(request.getSeverity(), "MEDIUM");
        normalized.priority = normalizePriority(request.getPriority(), "P2");
        normalized.pageUrl = optionalText(request.getPageUrl(), 500, null);
        normalized.environment = optionalText(request.getEnvironment(), 120, null);
        normalized.reproductionSteps = optionalMultilineText(request.getReproductionSteps(), 4000, null);
        normalized.expectedResult = optionalMultilineText(request.getExpectedResult(), 4000, null);
        normalized.actualResult = optionalMultilineText(request.getActualResult(), 4000, null);
        normalized.attachmentUrls = optionalMultilineText(request.getAttachmentUrls(), 2000, null);
        normalized.assignedTo = optionalText(request.getAssignedTo(), 120, "CODEX");
        normalized.scanNote = optionalMultilineText(request.getScanNote(), 2000, null);
        normalized.fixSummary = optionalMultilineText(request.getFixSummary(), 2000, null);
        normalized.regressionNote = optionalMultilineText(request.getRegressionNote(), 2000, null);
        return normalized;
    }

    private String requiredText(String value, int max, String message) {
        String normalized = sanitize(value, max);
        if (normalized == null || normalized.isBlank()) {
            throw new IllegalArgumentException(message);
        }
        return normalized;
    }

    private String requiredMultilineText(String value, int max, String message) {
        String normalized = sanitizeMultiline(value, max);
        if (normalized == null || normalized.isBlank()) {
            throw new IllegalArgumentException(message);
        }
        return normalized;
    }

    private String optionalText(String value, int max, String fallback) {
        String normalized = sanitize(value, max);
        return normalized == null || normalized.isBlank() ? fallback : normalized;
    }

    private String optionalMultilineText(String value, int max, String fallback) {
        String normalized = sanitizeMultiline(value, max);
        return normalized == null || normalized.isBlank() ? fallback : normalized;
    }

    private String sanitize(String value, int max) {
        if (value == null) {
            return null;
        }
        String normalized = value.replaceAll("[\\r\\n\\t]+", " ").replaceAll("\\s+", " ").trim();
        if (normalized.isEmpty()) {
            return null;
        }
        return normalized.length() > max ? normalized.substring(0, max) : normalized;
    }

    private String sanitizeMultiline(String value, int max) {
        if (value == null) {
            return null;
        }
        String normalized = value
                .replace("\r\n", "\n")
                .replace('\r', '\n')
                .replace('\t', ' ');
        String[] lines = normalized.split("\n", -1);
        StringBuilder result = new StringBuilder();
        for (String line : lines) {
            if (result.length() > 0) {
                result.append('\n');
            }
            result.append(line.replaceAll(" {2,}", " ").trim());
        }
        normalized = result.toString().replaceAll("\\n{3,}", "\n\n").trim();
        if (normalized.isEmpty()) {
            return null;
        }
        return normalized.length() > max ? normalized.substring(0, max) : normalized;
    }

    private String normalizeStatus(String status, String fallback) {
        String normalized = normalizeToken(status);
        if (normalized.isEmpty()) {
            normalized = normalizeToken(fallback);
        }
        if (!STATUSES.contains(normalized)) {
            throw new IllegalArgumentException("Unsupported bug status");
        }
        return normalized;
    }

    private String normalizeStatusFilter(String status) {
        String normalized = normalizeToken(status);
        if (normalized.isEmpty() || "ALL".equals(normalized)) {
            return null;
        }
        return STATUSES.contains(normalized) ? normalized : null;
    }

    private String normalizeSeverity(String severity, String fallback) {
        String normalized = normalizeToken(severity);
        if (normalized.isEmpty()) {
            normalized = normalizeToken(fallback);
        }
        return SEVERITIES.contains(normalized) ? normalized : "MEDIUM";
    }

    private String normalizeSeverityFilter(String severity) {
        String normalized = normalizeToken(severity);
        if (normalized.isEmpty() || "ALL".equals(normalized)) {
            return null;
        }
        return SEVERITIES.contains(normalized) ? normalized : null;
    }

    private String normalizePriority(String priority, String fallback) {
        String normalized = normalizeToken(priority);
        if (normalized.isEmpty()) {
            normalized = normalizeToken(fallback);
        }
        return PRIORITIES.contains(normalized) ? normalized : "P2";
    }

    private String normalizeModule(String module, String fallback) {
        String normalized = normalizeToken(module);
        if (normalized.isEmpty()) {
            normalized = normalizeToken(fallback);
        }
        return MODULES.contains(normalized) ? normalized : "GENERAL";
    }

    private String normalizeModuleFilter(String module) {
        String normalized = normalizeToken(module);
        if (normalized.isEmpty() || "ALL".equals(normalized)) {
            return null;
        }
        return MODULES.contains(normalized) ? normalized : null;
    }

    private String normalizeToken(String value) {
        return value == null ? "" : value.trim().replace('-', '_').toUpperCase(Locale.ROOT);
    }

    private String keywordPattern(String keyword) {
        String normalized = sanitize(keyword, 120);
        if (normalized == null || normalized.isBlank()) {
            return null;
        }
        return "%" + normalized.toLowerCase(Locale.ROOT) + "%";
    }

    private String mergeNote(String current, String primary, String fallback, int max) {
        String note = optionalMultilineText(primary, max, null);
        if (note == null) {
            note = optionalMultilineText(fallback, max, null);
        }
        if (note == null) {
            return current;
        }
        return note;
    }

    private void validateStatusTransition(String previousStatus, String nextStatus) {
        Set<String> allowed = STATUS_TRANSITIONS.get(previousStatus);
        if (allowed == null || !allowed.contains(nextStatus)) {
            throw new IllegalArgumentException("Unsupported bug status transition");
        }
    }

    private boolean shouldStampScan(String previousStatus, String nextStatus, String previousScanNote, String nextScanNote) {
        return (!STATUS_FIXING.equals(previousStatus) && STATUS_FIXING.equals(nextStatus))
                || hasNewScanNote(previousScanNote, nextScanNote);
    }

    private boolean hasNewScanNote(String previousScanNote, String nextScanNote) {
        String previous = previousScanNote == null ? "" : previousScanNote.trim();
        String next = nextScanNote == null ? "" : nextScanNote.trim();
        return !next.isEmpty() && !next.equals(previous);
    }

    private boolean isRegressionStatus(String status) {
        return STATUS_REGRESSION_PASSED.equals(status)
                || STATUS_REGRESSION_FAILED.equals(status)
                || STATUS_CLOSED.equals(status);
    }

    private boolean isClosedStatus(String status) {
        return STATUS_CLOSED.equals(status) || STATUS_NON_ISSUE.equals(status);
    }

    private boolean isScannableStatus(String status) {
        return STATUS_OPEN.equals(status) || STATUS_FIXING.equals(status) || STATUS_REGRESSION_FAILED.equals(status);
    }

    private boolean shouldStampFixed(String previousStatus, String nextStatus) {
        return STATUS_FIXED_PENDING_REGRESSION.equals(nextStatus)
                && !STATUS_FIXED_PENDING_REGRESSION.equals(previousStatus);
    }

    private boolean shouldStampRegression(String previousStatus, String nextStatus) {
        return isRegressionStatus(nextStatus) && !nextStatus.equals(previousStatus);
    }

    private boolean shouldStampClosed(String previousStatus, String nextStatus) {
        return isClosedStatus(nextStatus) && !isClosedStatus(previousStatus);
    }

    private boolean shouldClearClosed(String previousStatus, String nextStatus) {
        return isClosedStatus(previousStatus) && !isClosedStatus(nextStatus);
    }

    private boolean shouldMoveToFixingOnScan(String previousStatus, String requestedStatus) {
        return STATUS_FIXING.equals(requestedStatus)
                && (STATUS_OPEN.equals(previousStatus) || STATUS_REGRESSION_FAILED.equals(previousStatus));
    }

    private int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(value, max));
    }

    private RowMapper<AdminBugReport> mapper() {
        return (rs, rowNum) -> {
            AdminBugReport bug = new AdminBugReport();
            bug.setId(rs.getLong("id"));
            bug.setTitle(rs.getString("title"));
            bug.setDescription(rs.getString("description"));
            bug.setModule(rs.getString("module"));
            bug.setSeverity(rs.getString("severity"));
            bug.setPriority(rs.getString("priority"));
            bug.setStatus(rs.getString("status"));
            bug.setPageUrl(rs.getString("page_url"));
            bug.setEnvironment(rs.getString("environment"));
            bug.setReproductionSteps(rs.getString("reproduction_steps"));
            bug.setExpectedResult(rs.getString("expected_result"));
            bug.setActualResult(rs.getString("actual_result"));
            bug.setAttachmentUrls(rs.getString("attachment_urls"));
            long reporterId = rs.getLong("reporter_id");
            bug.setReporterId(rs.wasNull() ? null : reporterId);
            bug.setReporterName(rs.getString("reporter_name"));
            bug.setAssignedTo(rs.getString("assigned_to"));
            bug.setScanNote(rs.getString("scan_note"));
            bug.setFixSummary(rs.getString("fix_summary"));
            bug.setRegressionNote(rs.getString("regression_note"));
            bug.setLastScannedAt(toLocalDateTime(rs.getTimestamp("last_scanned_at")));
            bug.setFixedAt(toLocalDateTime(rs.getTimestamp("fixed_at")));
            bug.setFixedBy(rs.getString("fixed_by"));
            bug.setRegressionAt(toLocalDateTime(rs.getTimestamp("regression_at")));
            bug.setRegressionBy(rs.getString("regression_by"));
            bug.setClosedAt(toLocalDateTime(rs.getTimestamp("closed_at")));
            bug.setCreatedAt(toLocalDateTime(rs.getTimestamp("created_at")));
            bug.setUpdatedAt(toLocalDateTime(rs.getTimestamp("updated_at")));
            return bug;
        };
    }

    private LocalDateTime toLocalDateTime(Timestamp timestamp) {
        return timestamp == null ? null : timestamp.toLocalDateTime();
    }

    private static final class Filter {
        private final String where;
        private final List<Object> args;

        private Filter(String where, List<Object> args) {
            this.where = where;
            this.args = args;
        }
    }

    private static final class NormalizedBug {
        private String title;
        private String description;
        private String module;
        private String severity;
        private String priority;
        private String status;
        private String pageUrl;
        private String environment;
        private String reproductionSteps;
        private String expectedResult;
        private String actualResult;
        private String attachmentUrls;
        private String assignedTo;
        private String scanNote;
        private String fixSummary;
        private String regressionNote;
    }
}
