package com.example.shop.service;

import com.example.shop.dto.IpBlacklistStatusResponse;
import com.example.shop.entity.IpBlacklistEntry;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import javax.servlet.http.HttpServletRequest;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class IpBlacklistService {
    public static final String STATUS_MONITORING = "MONITORING";
    public static final String STATUS_BLOCKED = "BLOCKED";
    public static final String STATUS_RELEASED = "RELEASED";
    public static final String SOURCE_LOGIN = "LOGIN";
    public static final String SOURCE_PAYMENT = "PAYMENT";
    public static final String SOURCE_MANUAL = "MANUAL";

    private final JdbcTemplate jdbcTemplate;
    private final RuntimeConfigService runtimeConfig;
    private final SystemAlertService systemAlertService;

    public void recordLoginFailure(HttpServletRequest request, String reason) {
        recordFailure(SOURCE_LOGIN, resolveClientIp(request), reason);
    }

    public void recordPaymentFailure(HttpServletRequest request, String reason) {
        recordFailure(SOURCE_PAYMENT, resolveClientIp(request), reason);
    }

    public void recordFailure(String source, String ipAddress, String reason) {
        if (!enabled() || isBlank(ipAddress) || isTrusted(ipAddress)) {
            return;
        }
        String normalizedSource = normalizeSource(source);
        int threshold = thresholdFor(normalizedSource);
        int windowMinutes = windowMinutes();
        int blockMinutes = blockMinutes();
        LocalDateTime now = LocalDateTime.now();
        Optional<IpBlacklistEntry> existing = findActiveByIpAndSource(ipAddress, normalizedSource);
        if (existing.isEmpty()) {
            jdbcTemplate.update(
                    "INSERT INTO ip_blacklist_entries (ip_address, status, source, reason, failure_count, first_seen_at, last_seen_at, created_at, updated_at) "
                            + "VALUES (?, ?, ?, ?, 1, NOW(), NOW(), NOW(), NOW())",
                    ipAddress, threshold <= 1 ? STATUS_BLOCKED : STATUS_MONITORING, normalizedSource, sanitize(reason));
            if (threshold <= 1) {
                block(ipAddress, normalizedSource, blockMinutes, reason, null);
            }
            return;
        }

        IpBlacklistEntry entry = existing.get();
        boolean expiredWindow = entry.getLastSeenAt() != null && entry.getLastSeenAt().isBefore(now.minusMinutes(windowMinutes));
        int nextCount = expiredWindow ? 1 : entry.getFailureCount() + 1;
        boolean shouldBlock = nextCount >= threshold;
        jdbcTemplate.update(
                "UPDATE ip_blacklist_entries SET status = ?, reason = ?, failure_count = ?, "
                        + "first_seen_at = CASE WHEN ? THEN NOW() ELSE first_seen_at END, "
                        + "last_seen_at = NOW(), blocked_at = CASE WHEN ? THEN NOW() ELSE blocked_at END, "
                        + "blocked_until = CASE WHEN ? THEN DATE_ADD(NOW(), INTERVAL ? MINUTE) ELSE blocked_until END "
                        + "WHERE id = ?",
                shouldBlock ? STATUS_BLOCKED : STATUS_MONITORING,
                sanitize(reason),
                nextCount,
                expiredWindow,
                shouldBlock,
                shouldBlock,
                blockMinutes,
                entry.getId());
        if (shouldBlock && !STATUS_BLOCKED.equals(entry.getStatus())) {
            recordBlockedAlert(ipAddress, normalizedSource, nextCount, blockMinutes, reason);
        }
    }

    public Optional<IpBlacklistEntry> findBlockingEntry(String ipAddress) {
        if (!enabled() || isBlank(ipAddress) || isTrusted(ipAddress)) {
            return Optional.empty();
        }
        releaseExpired();
        List<IpBlacklistEntry> rows = jdbcTemplate.query(
                "SELECT * FROM ip_blacklist_entries WHERE ip_address = ? AND status = ? "
                        + "AND (blocked_until IS NULL OR blocked_until > NOW()) ORDER BY blocked_at DESC, id DESC LIMIT 1",
                (rs, rowNum) -> mapEntry(rs),
                ipAddress,
                STATUS_BLOCKED);
        return rows.stream().findFirst();
    }

    public boolean shouldCheckPath(HttpServletRequest request) {
        if (request == null) {
            return false;
        }
        String method = request.getMethod() == null ? "" : request.getMethod().toUpperCase(Locale.ROOT);
        if ("OPTIONS".equals(method)) {
            return false;
        }
        String path = request.getRequestURI() == null ? "" : request.getRequestURI();
        if (runtimeConfig.getBoolean("security.ip-blacklist.block-all-paths", false)) {
            return true;
        }
        return pathPrefixes().stream().anyMatch(path::startsWith);
    }

    public List<IpBlacklistEntry> search(String status, String source, String ipAddress, int limit) {
        releaseExpired();
        int safeLimit = Math.max(1, Math.min(limit <= 0 ? 200 : limit, 1000));
        return jdbcTemplate.query(
                "SELECT * FROM ip_blacklist_entries "
                        + "WHERE (? IS NULL OR status = ?) "
                        + "AND (? IS NULL OR source = ?) "
                        + "AND (? IS NULL OR ip_address LIKE CONCAT('%', ?, '%')) "
                        + "ORDER BY updated_at DESC, id DESC LIMIT ?",
                (rs, rowNum) -> mapEntry(rs),
                blankToNull(normalizeStatus(status)), blankToNull(normalizeStatus(status)),
                blankToNull(normalizeSource(source)), blankToNull(normalizeSource(source)),
                blankToNull(ipAddress), blankToNull(ipAddress),
                safeLimit);
    }

    public IpBlacklistStatusResponse status() {
        releaseExpired();
        IpBlacklistStatusResponse response = new IpBlacklistStatusResponse();
        response.setEnabled(enabled());
        response.setLoginFailureThreshold(loginFailureThreshold());
        response.setPaymentFailureThreshold(paymentFailureThreshold());
        response.setWindowMinutes(windowMinutes());
        response.setBlockMinutes(blockMinutes());
        response.setBlockedCount(countByStatus(STATUS_BLOCKED));
        response.setMonitoringCount(countByStatus(STATUS_MONITORING));
        return response;
    }

    public IpBlacklistEntry block(String ipAddress, String source, int minutes, String reason, String actor) {
        String normalizedIp = requireIp(ipAddress);
        String normalizedSource = normalizeSource(source);
        int safeMinutes = minutes > 0 ? minutes : blockMinutes();
        Optional<IpBlacklistEntry> existing = findActiveByIpAndSource(normalizedIp, normalizedSource);
        if (existing.isPresent()) {
            jdbcTemplate.update(
                    "UPDATE ip_blacklist_entries SET status = ?, reason = ?, blocked_at = NOW(), blocked_until = DATE_ADD(NOW(), INTERVAL ? MINUTE), "
                            + "created_by = COALESCE(created_by, ?), updated_at = NOW() WHERE id = ?",
                    STATUS_BLOCKED, sanitize(reason), safeMinutes, sanitize(actor), existing.get().getId());
            if (!STATUS_BLOCKED.equals(existing.get().getStatus())) {
                recordBlockedAlert(normalizedIp, normalizedSource, existing.get().getFailureCount(), safeMinutes, reason);
            }
            return findById(existing.get().getId()).orElse(existing.get());
        }
        jdbcTemplate.update(
                "INSERT INTO ip_blacklist_entries (ip_address, status, source, reason, failure_count, first_seen_at, last_seen_at, blocked_at, blocked_until, created_by, created_at, updated_at) "
                        + "VALUES (?, ?, ?, ?, 0, NOW(), NOW(), NOW(), DATE_ADD(NOW(), INTERVAL ? MINUTE), ?, NOW(), NOW())",
                normalizedIp, STATUS_BLOCKED, normalizedSource, sanitize(reason), safeMinutes, sanitize(actor));
        recordBlockedAlert(normalizedIp, normalizedSource, 0, safeMinutes, reason);
        return findActiveByIpAndSource(normalizedIp, normalizedSource).orElseThrow();
    }

    private void recordBlockedAlert(String ipAddress, String source, int failureCount, int blockMinutes, String reason) {
        systemAlertService.recordSecurityEvent(
                "WARNING",
                "IP_BLACKLIST",
                "IP address blocked",
                "IP " + ipAddress + " was blocked by " + source + " protection",
                "security:ip-blacklist:" + source + ":" + ipAddress,
                "source=" + source + ", failureCount=" + failureCount + ", blockMinutes=" + blockMinutes + ", reason=" + sanitize(reason));
    }

    public Optional<IpBlacklistEntry> release(Long id, String actor) {
        if (id == null) {
            return Optional.empty();
        }
        jdbcTemplate.update(
                "UPDATE ip_blacklist_entries SET status = ?, released_at = NOW(), released_by = ?, updated_at = NOW() WHERE id = ?",
                STATUS_RELEASED, sanitize(actor), id);
        return findById(id);
    }

    public String resolveClientIp(HttpServletRequest request) {
        if (request == null) {
            return "";
        }
        String forwarded = request.getHeader("X-Forwarded-For");
        if (!isBlank(forwarded)) {
            return forwarded.split(",")[0].trim();
        }
        String realIp = request.getHeader("X-Real-IP");
        if (!isBlank(realIp)) {
            return realIp.trim();
        }
        return request.getRemoteAddr() == null ? "" : request.getRemoteAddr();
    }

    private Optional<IpBlacklistEntry> findActiveByIpAndSource(String ipAddress, String source) {
        List<IpBlacklistEntry> rows = jdbcTemplate.query(
                "SELECT * FROM ip_blacklist_entries WHERE ip_address = ? AND source = ? AND status IN (?, ?) ORDER BY id DESC LIMIT 1",
                (rs, rowNum) -> mapEntry(rs),
                ipAddress,
                source,
                STATUS_MONITORING,
                STATUS_BLOCKED);
        return rows.stream().findFirst();
    }

    private Optional<IpBlacklistEntry> findById(Long id) {
        List<IpBlacklistEntry> rows = jdbcTemplate.query("SELECT * FROM ip_blacklist_entries WHERE id = ?", (rs, rowNum) -> mapEntry(rs), id);
        return rows.stream().findFirst();
    }

    private void releaseExpired() {
        jdbcTemplate.update(
                "UPDATE ip_blacklist_entries SET status = ?, released_at = COALESCE(released_at, NOW()), released_by = COALESCE(released_by, 'system'), updated_at = NOW() "
                        + "WHERE status = ? AND blocked_until IS NOT NULL AND blocked_until <= NOW()",
                STATUS_RELEASED,
                STATUS_BLOCKED);
    }

    private IpBlacklistEntry mapEntry(ResultSet rs) throws SQLException {
        IpBlacklistEntry entry = new IpBlacklistEntry();
        entry.setId(rs.getLong("id"));
        entry.setIpAddress(rs.getString("ip_address"));
        entry.setStatus(rs.getString("status"));
        entry.setSource(rs.getString("source"));
        entry.setReason(rs.getString("reason"));
        entry.setFailureCount(rs.getInt("failure_count"));
        entry.setFirstSeenAt(toLocalDateTime(rs, "first_seen_at"));
        entry.setLastSeenAt(toLocalDateTime(rs, "last_seen_at"));
        entry.setBlockedAt(toLocalDateTime(rs, "blocked_at"));
        entry.setBlockedUntil(toLocalDateTime(rs, "blocked_until"));
        entry.setReleasedAt(toLocalDateTime(rs, "released_at"));
        entry.setReleasedBy(rs.getString("released_by"));
        entry.setCreatedBy(rs.getString("created_by"));
        entry.setCreatedAt(toLocalDateTime(rs, "created_at"));
        entry.setUpdatedAt(toLocalDateTime(rs, "updated_at"));
        return entry;
    }

    private LocalDateTime toLocalDateTime(ResultSet rs, String column) throws SQLException {
        return rs.getTimestamp(column) == null ? null : rs.getTimestamp(column).toLocalDateTime();
    }

    private long countByStatus(String status) {
        Long count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM ip_blacklist_entries WHERE status = ?", Long.class, status);
        return count == null ? 0 : count;
    }

    private boolean enabled() {
        return runtimeConfig.getBoolean("security.ip-blacklist.enabled", true);
    }

    private int loginFailureThreshold() {
        return Math.max(1, runtimeConfig.getInt("security.ip-blacklist.login-failure-threshold", 5));
    }

    private int paymentFailureThreshold() {
        return Math.max(1, runtimeConfig.getInt("security.ip-blacklist.payment-failure-threshold", 5));
    }

    private int thresholdFor(String source) {
        return SOURCE_PAYMENT.equals(source) ? paymentFailureThreshold() : loginFailureThreshold();
    }

    private int windowMinutes() {
        return Math.max(1, runtimeConfig.getInt("security.ip-blacklist.window-minutes", 15));
    }

    private int blockMinutes() {
        return Math.max(1, runtimeConfig.getInt("security.ip-blacklist.block-minutes", 60));
    }

    private Set<String> pathPrefixes() {
        String configured = runtimeConfig.getString("security.ip-blacklist.path-prefixes",
                "/auth/login,/auth/email-login,/auth/email-code,/payments,/orders/checkout/guest");
        return Arrays.stream(configured.split(",")).map(String::trim).filter(value -> !value.isEmpty()).collect(Collectors.toSet());
    }

    private boolean isTrusted(String ipAddress) {
        String configured = runtimeConfig.getString("security.ip-blacklist.trusted-ips", "127.0.0.1,::1,0:0:0:0:0:0:0:1");
        return Arrays.stream(configured.split(",")).map(String::trim).anyMatch(ipAddress::equals);
    }

    private String requireIp(String ipAddress) {
        if (isBlank(ipAddress) || ipAddress.length() > 45) {
            throw new IllegalArgumentException("Invalid IP address");
        }
        return ipAddress.trim();
    }

    private String normalizeSource(String source) {
        String normalized = source == null ? "" : source.trim().toUpperCase(Locale.ROOT);
        if (SOURCE_LOGIN.equals(normalized) || SOURCE_PAYMENT.equals(normalized) || SOURCE_MANUAL.equals(normalized)) {
            return normalized;
        }
        return SOURCE_MANUAL;
    }

    private String normalizeStatus(String status) {
        String normalized = status == null ? "" : status.trim().toUpperCase(Locale.ROOT);
        if (STATUS_MONITORING.equals(normalized) || STATUS_BLOCKED.equals(normalized) || STATUS_RELEASED.equals(normalized)) {
            return normalized;
        }
        return normalized;
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() || "ALL".equalsIgnoreCase(value) ? null : value.trim();
    }

    private String sanitize(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.replaceAll("[\\r\\n\\t]+", " ").replaceAll("\\s+", " ").trim();
        return normalized.length() > 500 ? normalized.substring(0, 500) : normalized;
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
