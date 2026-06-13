package com.example.shop.service;

import com.example.shop.dto.IpBlacklistBatchReleaseResponse;
import com.example.shop.dto.IpBlacklistStatusResponse;
import com.example.shop.entity.IpBlacklistEntry;
import com.example.shop.util.SensitiveDataMasker;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import javax.servlet.http.HttpServletRequest;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class IpBlacklistService {
    public static final String STATUS_MONITORING = "MONITORING";
    public static final String STATUS_BLOCKED = "BLOCKED";
    public static final String STATUS_RELEASED = "RELEASED";
    public static final String SOURCE_LOGIN = "LOGIN";
    public static final String SOURCE_PAYMENT = "PAYMENT";
    public static final String SOURCE_MANUAL = "MANUAL";
    private static final long LEGACY_LOGIN_ENTRY_ID_BASE = 8_000_000_000_000_000L;
    private static final long LEGACY_LOGIN_ENTRY_ID_RANGE = 900_000_000_000_000L;
    private static final long LEGACY_LOGIN_ENTRY_ID_MAX = LEGACY_LOGIN_ENTRY_ID_BASE + LEGACY_LOGIN_ENTRY_ID_RANGE - 1;
    private static final String DEFAULT_PROTECTED_PATH_PREFIXES = String.join(",",
            "/auth/login",
            "/auth/email-login",
            "/auth/email-code",
            "/auth/forgot-password",
            "/auth/register",
            "/auth/refresh",
            "/users/create-admin",
            "/admin",
            "/payment",
            "/payments",
            "/orders/checkout/guest",
            "/orders/track",
            "/orders/guest",
            "/support/guest",
            "/ws/support");

    private final JdbcTemplate jdbcTemplate;
    private final RuntimeConfigService runtimeConfig;
    private final SystemAlertService systemAlertService;
    private final ClientIpResolver clientIpResolver;
    private final TokenBlacklistService tokenBlacklistService;

    public void recordLoginFailure(HttpServletRequest request, String reason) {
        recordFailure(SOURCE_LOGIN, resolveClientIp(request), reason);
    }

    public void recordPaymentFailure(HttpServletRequest request, String reason) {
        recordFailure(SOURCE_PAYMENT, resolveClientIp(request), reason);
    }

    public void recordFailure(String source, String ipAddress, String reason) {
        String normalizedIp = clientIpResolver.normalizeIpAddress(ipAddress);
        if (!enabled() || isBlank(normalizedIp) || isTrusted(normalizedIp)) {
            return;
        }
        String normalizedSource = normalizeSource(source);
        int threshold = thresholdFor(normalizedSource);
        int windowMinutes = windowMinutes();
        int blockMinutes = blockMinutes();
        LocalDateTime now = LocalDateTime.now();
        Optional<IpBlacklistEntry> existing = findActiveByIpAndSource(normalizedIp, normalizedSource);
        if (existing.isEmpty()) {
            LocalDateTime blockedUntil = threshold <= 1 ? now.plusMinutes(blockMinutes) : null;
            jdbcTemplate.update(
                    "INSERT INTO ip_blacklist_entries (ip_address, status, source, reason, failure_count, first_seen_at, last_seen_at, blocked_at, blocked_until, created_at, updated_at) "
                            + "VALUES (?, ?, ?, ?, 1, NOW(), NOW(), ?, ?, NOW(), NOW())",
                    normalizedIp,
                    threshold <= 1 ? STATUS_BLOCKED : STATUS_MONITORING,
                    normalizedSource,
                    sanitize(reason),
                    threshold <= 1 ? now : null,
                    blockedUntil);
            if (threshold <= 1) {
                recordBlockedAlert(normalizedIp, normalizedSource, 1, blockMinutes, reason);
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
            recordBlockedAlert(normalizedIp, normalizedSource, nextCount, blockMinutes, reason);
        }
    }

    public Optional<IpBlacklistEntry> findBlockingEntry(String ipAddress) {
        String normalizedIp = clientIpResolver.normalizeIpAddress(ipAddress);
        if (!enabled() || isBlank(normalizedIp) || isTrusted(normalizedIp)) {
            return Optional.empty();
        }
        releaseExpired();
        List<IpBlacklistEntry> rows = jdbcTemplate.query(
                "SELECT * FROM ip_blacklist_entries WHERE ip_address = ? AND status = ? "
                        + "AND (blocked_until IS NULL OR blocked_until > NOW()) ORDER BY blocked_at DESC, id DESC LIMIT 1",
                (rs, rowNum) -> mapEntry(rs),
                normalizedIp,
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
        int safeLimit = Math.max(1, Math.min(limit <= 0 ? 200 : limit, 1000));
        String normalizedStatus = normalizeStatusFilter(status);
        String normalizedSource = blankToNull(normalizeSourceFilter(source));
        String normalizedIp = blankToNull(ipAddress);
        List<IpBlacklistEntry> rows = jdbcTemplate.query(
                "SELECT * FROM ip_blacklist_entries "
                        + "WHERE (? IS NULL OR status = ?) "
                        + "AND (? IS NULL OR source = ?) "
                        + "AND (? IS NULL OR ip_address LIKE CONCAT('%', ?, '%')) "
                        + "ORDER BY updated_at DESC, id DESC LIMIT ?",
                (rs, rowNum) -> mapEntry(rs),
                normalizedStatus, normalizedStatus,
                normalizedSource, normalizedSource,
                normalizedIp, normalizedIp,
                safeLimit);
        if (rows == null) {
            rows = List.of();
        }
        return mergeLegacyLoginFailures(rows, normalizedStatus, normalizedSource, normalizedIp, safeLimit);
    }

    public IpBlacklistStatusResponse status() {
        List<TokenBlacklistService.LoginIpFailureSnapshot> legacySnapshots = findLegacyLoginFailuresSafely();
        List<IpBlacklistEntry> missingLegacyRows = missingLegacyLoginFailureEntries(legacySnapshots);
        IpBlacklistStatusResponse response = new IpBlacklistStatusResponse();
        response.setEnabled(enabled());
        response.setLoginFailureThreshold(loginFailureThreshold());
        response.setPaymentFailureThreshold(paymentFailureThreshold());
        response.setWindowMinutes(windowMinutes());
        response.setBlockMinutes(blockMinutes());
        response.setBlockedCount(countByStatus(STATUS_BLOCKED) + countStatus(missingLegacyRows, STATUS_BLOCKED));
        response.setMonitoringCount(countByStatus(STATUS_MONITORING) + countStatus(missingLegacyRows, STATUS_MONITORING));
        response.setReleasedCount(countByStatus(STATUS_RELEASED));
        response.setTotalCount(countAll() + missingLegacyRows.size());
        response.setLegacyLoginFailureCount(legacySnapshots.size());
        return response;
    }

    public IpBlacklistEntry block(String ipAddress, String source, int minutes, String reason, String actor) {
        String normalizedIp = requireIp(ipAddress);
        if (isTrusted(normalizedIp)) {
            throw new IllegalArgumentException("Trusted IP address cannot be blocked");
        }
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
        Optional<IpBlacklistEntry> existing = findById(id);
        if (existing.isEmpty() && isLegacyLoginEntryId(id)) {
            Optional<String> ipAddress = legacyIdToIpAddress(id);
            if (ipAddress.isEmpty()) {
                return Optional.empty();
            }
            tokenBlacklistService.clearLoginFailures(ipAddress.get());
            IpBlacklistEntry released = legacyLoginEntry(ipAddress.get(), null);
            released.setStatus(STATUS_RELEASED);
            released.setReason("Legacy login failures cleared");
            released.setReleasedAt(LocalDateTime.now());
            released.setReleasedBy(sanitize(actor));
            return Optional.of(released);
        }
        jdbcTemplate.update(
                "UPDATE ip_blacklist_entries SET status = ?, released_at = NOW(), released_by = ?, updated_at = NOW() WHERE id = ?",
                STATUS_RELEASED, sanitize(actor), id);
        existing.ifPresent(entry -> {
            if (SOURCE_LOGIN.equals(entry.getSource())) {
                tokenBlacklistService.clearLoginFailures(entry.getIpAddress());
            }
        });
        return findById(id);
    }

    public IpBlacklistBatchReleaseResponse releaseBatch(List<Long> ids, String actor) {
        int requestedCount = ids == null ? 0 : ids.size();
        List<Long> safeIds = normalizeIds(ids);
        int released = updateReleaseBatch(safeIds, actor);
        IpBlacklistBatchReleaseResponse response = new IpBlacklistBatchReleaseResponse();
        response.setRequestedCount(requestedCount);
        response.setReleasedCount(released);
        response.setIgnoredCount(Math.max(0, requestedCount - safeIds.size()));
        response.setMaxBatchSize(batchReleaseMaxSize());
        response.setIds(safeIds);
        return response;
    }

    public String resolveClientIp(HttpServletRequest request) {
        return clientIpResolver.resolve(request);
    }

    private int updateReleaseBatch(List<Long> ids, String actor) {
        if (ids.isEmpty()) {
            return 0;
        }
        int legacyReleased = releaseLegacyLoginFailures(ids);
        List<Long> databaseIds = ids.stream()
                .filter(id -> !isLegacyLoginEntryId(id))
                .collect(Collectors.toList());
        if (databaseIds.isEmpty()) {
            return legacyReleased;
        }
        String placeholders = String.join(",", Collections.nCopies(databaseIds.size(), "?"));
        clearLegacyLoginFailures(databaseIds, placeholders);
        List<Object> args = new ArrayList<>();
        args.add(STATUS_RELEASED);
        args.add(sanitize(actor));
        args.addAll(databaseIds);
        args.add(STATUS_RELEASED);
        int databaseReleased = jdbcTemplate.update(
                "UPDATE ip_blacklist_entries SET status = ?, released_at = NOW(), released_by = ?, updated_at = NOW() "
                        + "WHERE id IN (" + placeholders + ") AND status <> ?",
                args.toArray());
        return databaseReleased + legacyReleased;
    }

    private int releaseLegacyLoginFailures(List<Long> ids) {
        Set<String> releasedIps = ids.stream()
                .filter(this::isLegacyLoginEntryId)
                .map(this::legacyIdToIpAddress)
                .flatMap(Optional::stream)
                .collect(Collectors.toSet());
        releasedIps.forEach(tokenBlacklistService::clearLoginFailures);
        return releasedIps.size();
    }

    private void clearLegacyLoginFailures(List<Long> ids, String placeholders) {
        jdbcTemplate.queryForList(
                "SELECT ip_address FROM ip_blacklist_entries WHERE source = ? AND id IN (" + placeholders + ")",
                String.class,
                buildLoginClearArgs(ids).toArray())
                .forEach(tokenBlacklistService::clearLoginFailures);
    }

    private List<Object> buildLoginClearArgs(List<Long> ids) {
        List<Object> args = new ArrayList<>();
        args.add(SOURCE_LOGIN);
        args.addAll(ids);
        return args;
    }

    private void syncLoginFailuresFromLegacyRateLimiter() {
        List<TokenBlacklistService.LoginIpFailureSnapshot> snapshots = findLegacyLoginFailuresSafely();
        if (snapshots.isEmpty()) {
            return;
        }
        Set<String> seen = new HashSet<>();
        for (TokenBlacklistService.LoginIpFailureSnapshot snapshot : snapshots) {
            String normalizedIp = clientIpResolver.normalizeIpAddress(snapshot.getIpAddress());
            if (isBlank(normalizedIp) || !seen.add(normalizedIp) || isTrusted(normalizedIp)) {
                continue;
            }
            try {
                upsertLoginFailureSnapshot(normalizedIp, snapshot);
            } catch (RuntimeException ex) {
                log.debug("Legacy login failure sync skipped for {}", normalizedIp, ex);
                // Keep the admin list available even if an old table still needs schema hardening.
            }
        }
    }

    private List<IpBlacklistEntry> mergeLegacyLoginFailures(List<IpBlacklistEntry> rows,
                                                            String status,
                                                            String source,
                                                            String ipAddress,
                                                            int limit) {
        if (limit <= 0 || (source != null && !SOURCE_LOGIN.equals(source))) {
            return rows;
        }
        List<TokenBlacklistService.LoginIpFailureSnapshot> snapshots = findLegacyLoginFailuresSafely();
        if (snapshots.isEmpty()) {
            return rows;
        }
        List<IpBlacklistEntry> merged = new ArrayList<>(rows);
        for (IpBlacklistEntry entry : missingLegacyLoginFailureEntries(snapshots)) {
            if (merged.size() >= limit) {
                break;
            }
            if (!matchesFilter(entry, status, ipAddress)) {
                continue;
            }
            merged.add(entry);
        }
        return merged;
    }

    private List<IpBlacklistEntry> missingLegacyLoginFailureEntries(List<TokenBlacklistService.LoginIpFailureSnapshot> snapshots) {
        if (snapshots.isEmpty()) {
            return List.of();
        }
        Set<String> existingLoginIps = activeLoginIps();
        List<IpBlacklistEntry> entries = new ArrayList<>();
        Set<String> added = new HashSet<>();
        for (TokenBlacklistService.LoginIpFailureSnapshot snapshot : snapshots) {
            String normalizedIp = clientIpResolver.normalizeIpAddress(snapshot.getIpAddress());
            if (isBlank(normalizedIp) || isTrusted(normalizedIp) || existingLoginIps.contains(normalizedIp) || !added.add(normalizedIp)) {
                continue;
            }
            entries.add(legacyLoginEntry(normalizedIp, snapshot));
        }
        return entries;
    }

    private Set<String> activeLoginIps() {
        try {
            return jdbcTemplate.queryForList(
                    "SELECT ip_address FROM ip_blacklist_entries WHERE source = ? AND status IN (?, ?)",
                    String.class,
                    SOURCE_LOGIN,
                    STATUS_MONITORING,
                    STATUS_BLOCKED)
                    .stream()
                    .filter(ip -> !isBlank(ip))
                    .collect(Collectors.toSet());
        } catch (RuntimeException ex) {
            log.debug("Active login IP lookup failed while merging legacy login failures", ex);
            return Set.of();
        }
    }

    private long countStatus(List<IpBlacklistEntry> entries, String status) {
        return entries.stream().filter(entry -> status.equals(entry.getStatus())).count();
    }

    private boolean matchesFilter(IpBlacklistEntry entry, String status, String ipAddress) {
        if (status != null && !status.equals(entry.getStatus())) {
            return false;
        }
        return ipAddress == null || Optional.ofNullable(entry.getIpAddress()).orElse("").contains(ipAddress);
    }

    private IpBlacklistEntry legacyLoginEntry(String ipAddress, TokenBlacklistService.LoginIpFailureSnapshot snapshot) {
        boolean locked = snapshot != null && snapshot.isLocked();
        LocalDateTime now = LocalDateTime.now();
        IpBlacklistEntry entry = new IpBlacklistEntry();
        entry.setId(legacyLoginEntryId(ipAddress));
        entry.setIpAddress(ipAddress);
        entry.setStatus(locked ? STATUS_BLOCKED : STATUS_MONITORING);
        entry.setSource(SOURCE_LOGIN);
        entry.setReason(locked ? "Legacy login rate limit reached" : "Legacy login failures under monitoring");
        entry.setFailureCount(snapshot == null ? 0 : snapshot.getFailureCount());
        entry.setFirstSeenAt(now);
        entry.setLastSeenAt(now);
        entry.setBlockedAt(locked ? now : null);
        entry.setBlockedUntil(locked && snapshot.getTtlSeconds() > 0 ? now.plusSeconds(snapshot.getTtlSeconds()) : null);
        entry.setCreatedBy("legacy-rate-limit");
        entry.setCreatedAt(now);
        entry.setUpdatedAt(now);
        entry.setLegacyOnly(true);
        return entry;
    }

    private Long legacyLoginEntryId(String ipAddress) {
        long hash = 0xcbf29ce484222325L;
        String normalized = Optional.ofNullable(ipAddress).orElse("");
        for (int index = 0; index < normalized.length(); index++) {
            hash ^= normalized.charAt(index);
            hash *= 0x100000001b3L;
        }
        long safeHash = hash & Long.MAX_VALUE;
        return LEGACY_LOGIN_ENTRY_ID_BASE + (safeHash % LEGACY_LOGIN_ENTRY_ID_RANGE);
    }

    private boolean isLegacyLoginEntryId(Long id) {
        return id != null && id >= LEGACY_LOGIN_ENTRY_ID_BASE && id <= LEGACY_LOGIN_ENTRY_ID_MAX;
    }

    private Optional<String> legacyIdToIpAddress(Long id) {
        return findLegacyLoginFailuresSafely().stream()
                .map(TokenBlacklistService.LoginIpFailureSnapshot::getIpAddress)
                .map(clientIpResolver::normalizeIpAddress)
                .filter(ip -> !isBlank(ip))
                .filter(ip -> legacyLoginEntryId(ip).equals(id))
                .findFirst();
    }

    private List<TokenBlacklistService.LoginIpFailureSnapshot> findLegacyLoginFailuresSafely() {
        try {
            List<TokenBlacklistService.LoginIpFailureSnapshot> snapshots = tokenBlacklistService.findLoginIpFailures();
            return snapshots == null ? List.of() : snapshots;
        } catch (RuntimeException ex) {
            log.debug("Legacy login failure lookup skipped", ex);
            return List.of();
        }
    }

    private void upsertLoginFailureSnapshot(String ipAddress, TokenBlacklistService.LoginIpFailureSnapshot snapshot) {
        LocalDateTime blockedUntil = snapshot.getTtlSeconds() > 0
                ? LocalDateTime.now().plusSeconds(snapshot.getTtlSeconds())
                : null;
        Optional<IpBlacklistEntry> existing = findActiveByIpAndSource(ipAddress, SOURCE_LOGIN);
        String status = snapshot.isLocked() ? STATUS_BLOCKED : STATUS_MONITORING;
        String reason = snapshot.isLocked() ? "Legacy login rate limit reached" : "Legacy login failures under monitoring";
        if (existing.isPresent()) {
            jdbcTemplate.update(
                    "UPDATE ip_blacklist_entries SET status = ?, reason = ?, failure_count = GREATEST(failure_count, ?), "
                            + "last_seen_at = NOW(), blocked_at = CASE WHEN ? THEN COALESCE(blocked_at, NOW()) ELSE blocked_at END, "
                            + "blocked_until = CASE WHEN ? THEN ? ELSE blocked_until END, updated_at = NOW() WHERE id = ?",
                    status,
                    reason,
                    snapshot.getFailureCount(),
                    snapshot.isLocked(),
                    snapshot.isLocked(),
                    blockedUntil,
                    existing.get().getId());
            return;
        }
        jdbcTemplate.update(
                "INSERT INTO ip_blacklist_entries (ip_address, status, source, reason, failure_count, first_seen_at, last_seen_at, blocked_at, blocked_until, created_by, created_at, updated_at) "
                        + "VALUES (?, ?, ?, ?, ?, NOW(), NOW(), ?, ?, 'legacy-rate-limit', NOW(), NOW())",
                ipAddress,
                status,
                SOURCE_LOGIN,
                reason,
                snapshot.getFailureCount(),
                snapshot.isLocked() ? LocalDateTime.now() : null,
                snapshot.isLocked() ? blockedUntil : null);
    }

    private List<Long> normalizeIds(List<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return List.of();
        }
        List<Long> normalizedIds = ids.stream()
                .filter(id -> id != null && id > 0)
                .distinct()
                .collect(Collectors.toList());
        if (normalizedIds.size() > batchReleaseMaxSize()) {
            throw new IllegalArgumentException("Too many IP blacklist records selected");
        }
        return normalizedIds;
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
        try {
            jdbcTemplate.update(
                    "UPDATE ip_blacklist_entries SET status = ?, released_at = COALESCE(released_at, NOW()), released_by = COALESCE(released_by, 'system'), updated_at = NOW() "
                            + "WHERE status = ? AND blocked_until IS NOT NULL AND blocked_until <= NOW()",
                    STATUS_RELEASED,
                    STATUS_BLOCKED);
        } catch (RuntimeException ex) {
            log.debug("Expired IP blacklist release skipped", ex);
            // Older deployments may need the startup schema hardening to add these columns first.
        }
    }

    private IpBlacklistEntry mapEntry(ResultSet rs) throws SQLException {
        IpBlacklistEntry entry = new IpBlacklistEntry();
        entry.setId(rs.getLong("id"));
        entry.setIpAddress(stringColumn(rs, "ip_address"));
        entry.setStatus(Optional.ofNullable(stringColumn(rs, "status")).orElse(STATUS_MONITORING));
        entry.setSource(Optional.ofNullable(stringColumn(rs, "source")).orElse(SOURCE_MANUAL));
        entry.setReason(stringColumn(rs, "reason"));
        entry.setFailureCount(intColumn(rs, "failure_count"));
        entry.setFirstSeenAt(toLocalDateTime(rs, "first_seen_at"));
        entry.setLastSeenAt(toLocalDateTime(rs, "last_seen_at"));
        entry.setBlockedAt(toLocalDateTime(rs, "blocked_at"));
        entry.setBlockedUntil(toLocalDateTime(rs, "blocked_until"));
        entry.setReleasedAt(toLocalDateTime(rs, "released_at"));
        entry.setReleasedBy(stringColumn(rs, "released_by"));
        entry.setCreatedBy(stringColumn(rs, "created_by"));
        entry.setCreatedAt(toLocalDateTime(rs, "created_at"));
        entry.setUpdatedAt(toLocalDateTime(rs, "updated_at"));
        return entry;
    }

    private LocalDateTime toLocalDateTime(ResultSet rs, String column) throws SQLException {
        Timestamp timestamp = timestampColumn(rs, column);
        return timestamp == null ? null : timestamp.toLocalDateTime();
    }

    private String stringColumn(ResultSet rs, String column) throws SQLException {
        if (!hasColumn(rs, column)) {
            return null;
        }
        return rs.getString(column);
    }

    private int intColumn(ResultSet rs, String column) throws SQLException {
        if (!hasColumn(rs, column)) {
            return 0;
        }
        return rs.getInt(column);
    }

    private Timestamp timestampColumn(ResultSet rs, String column) throws SQLException {
        if (!hasColumn(rs, column)) {
            return null;
        }
        return rs.getTimestamp(column);
    }

    private boolean hasColumn(ResultSet rs, String column) throws SQLException {
        int columnCount = rs.getMetaData().getColumnCount();
        for (int i = 1; i <= columnCount; i++) {
            if (column.equalsIgnoreCase(rs.getMetaData().getColumnLabel(i))) {
                return true;
            }
        }
        return false;
    }

    private long countByStatus(String status) {
        Long count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM ip_blacklist_entries WHERE status = ?", Long.class, status);
        return count == null ? 0 : count;
    }

    private long countAll() {
        Long count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM ip_blacklist_entries", Long.class);
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

    private int batchReleaseMaxSize() {
        return Math.max(1, Math.min(runtimeConfig.getInt("security.ip-blacklist.admin.batch-release-max-size", 100), 1000));
    }

    private Set<String> pathPrefixes() {
        String configured = runtimeConfig.getString("security.ip-blacklist.path-prefixes", DEFAULT_PROTECTED_PATH_PREFIXES);
        return Arrays.stream(configured.split(",")).map(String::trim).filter(value -> !value.isEmpty()).collect(Collectors.toSet());
    }

    private boolean isTrusted(String ipAddress) {
        String configured = runtimeConfig.getString("security.ip-blacklist.trusted-ips", "127.0.0.1,::1,0:0:0:0:0:0:0:1");
        return clientIpResolver.matchesAny(ipAddress, configured);
    }

    private String requireIp(String ipAddress) {
        String normalizedIp = clientIpResolver.normalizeIpAddress(ipAddress);
        if (isBlank(normalizedIp)) {
            throw new IllegalArgumentException("Invalid IP address");
        }
        return normalizedIp;
    }

    private String normalizeSource(String source) {
        String normalized = source == null ? "" : source.trim().toUpperCase(Locale.ROOT);
        if (SOURCE_LOGIN.equals(normalized) || SOURCE_PAYMENT.equals(normalized) || SOURCE_MANUAL.equals(normalized)) {
            return normalized;
        }
        return SOURCE_MANUAL;
    }

    private String normalizeSourceFilter(String source) {
        String normalized = source == null ? "" : source.trim().toUpperCase(Locale.ROOT);
        if (normalized.isEmpty() || "ALL".equals(normalized)) {
            return null;
        }
        if (SOURCE_LOGIN.equals(normalized) || SOURCE_PAYMENT.equals(normalized) || SOURCE_MANUAL.equals(normalized)) {
            return normalized;
        }
        return null;
    }

    private String normalizeStatusFilter(String status) {
        String normalized = status == null ? "" : status.trim().toUpperCase(Locale.ROOT);
        if (normalized.isEmpty() || "ALL".equals(normalized)) {
            return null;
        }
        if (STATUS_MONITORING.equals(normalized) || STATUS_BLOCKED.equals(normalized) || STATUS_RELEASED.equals(normalized)) {
            return normalized;
        }
        return null;
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() || "ALL".equalsIgnoreCase(value) ? null : value.trim();
    }

    private String sanitize(String value) {
        if (value == null) {
            return null;
        }
        String normalized = SensitiveDataMasker.mask(value)
                .replaceAll("[\\r\\n\\t]+", " ")
                .replaceAll("\\s+", " ")
                .trim();
        return normalized.length() > 500 ? normalized.substring(0, 500) : normalized;
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
