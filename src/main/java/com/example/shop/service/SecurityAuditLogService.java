package com.example.shop.service;

import com.example.shop.dto.SecurityAuditSummaryResponse;
import com.example.shop.dto.SecurityAuditPurgeResponse;
import com.example.shop.entity.SecurityAuditLog;
import com.example.shop.repository.SecurityAuditLogMapper;
import com.example.shop.security.UserDetailsImpl;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

import javax.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class SecurityAuditLogService {
    private final SecurityAuditLogMapper auditLogMapper;
    private final JdbcTemplate jdbcTemplate;

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
        auditLog.setResourceId(resourceId == null ? null : limit(normalizeLogText(String.valueOf(resourceId)), 100));
        auditLog.setIpAddress(limit(normalizeLogText(resolveClientIp(request)), 45));
        auditLog.setUserAgent(limit(normalizeLogText(request == null ? null : request.getHeader("User-Agent")), 500));
        auditLog.setMessage(limit(normalizeLogText(message), 1000));
        auditLog.setMetadata(limit(normalizeLogText(metadata), 2000));
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
        int safeLimit = Math.max(1, Math.min(limit <= 0 ? 200 : limit, 5000));
        return auditLogMapper.search(blankToNull(action), blankToNull(result), blankToNull(actorUsername), blankToNull(resourceType), startAt, endAt, safeLimit);
    }

    public SecurityAuditSummaryResponse summary(LocalDateTime startAt, LocalDateTime endAt, int topLimit) {
        int safeLimit = Math.max(1, Math.min(topLimit <= 0 ? 10 : topLimit, 50));
        LocalDateTime safeEnd = endAt == null ? LocalDateTime.now() : endAt;
        LocalDateTime safeStart = startAt == null ? safeEnd.minusDays(1) : startAt;
        if (safeEnd.isBefore(safeStart)) {
            LocalDateTime temp = safeStart;
            safeStart = safeEnd;
            safeEnd = temp;
        }

        SecurityAuditSummaryResponse response = new SecurityAuditSummaryResponse();
        response.setStartAt(safeStart.toString());
        response.setEndAt(safeEnd.toString());
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

    private String resolveClientIp(HttpServletRequest request) {
        if (request == null) {
            return null;
        }
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }
        return request.getRemoteAddr();
    }

    private String limit(String value, int maxLength) {
        if (value == null) {
            return null;
        }
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
    }

    private String blankToNull(String value) {
        String normalized = normalizeLogText(value);
        return normalized == null || normalized.isEmpty() ? null : limit(normalized, 100);
    }

    private String normalizeLogText(String value) {
        if (value == null) {
            return null;
        }
        return value.replaceAll("\\p{Cntrl}", " ")
                .replaceAll("\\s+", " ")
                .trim();
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
