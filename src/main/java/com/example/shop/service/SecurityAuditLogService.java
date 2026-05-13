package com.example.shop.service;

import com.example.shop.entity.SecurityAuditLog;
import com.example.shop.repository.SecurityAuditLogMapper;
import com.example.shop.security.UserDetailsImpl;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

import javax.servlet.http.HttpServletRequest;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class SecurityAuditLogService {
    private final SecurityAuditLogMapper auditLogMapper;

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
        auditLog.setAction(limit(action, 50));
        auditLog.setResult(limit(result, 20));
        auditLog.setActorUserId(actorUserId);
        auditLog.setActorUsername(limit(actorUsername, 100));
        auditLog.setActorRole(limit(actorRole, 30));
        auditLog.setResourceType(limit(resourceType, 50));
        auditLog.setResourceId(resourceId == null ? null : limit(String.valueOf(resourceId), 100));
        auditLog.setIpAddress(limit(resolveClientIp(request), 45));
        auditLog.setUserAgent(limit(request == null ? null : request.getHeader("User-Agent"), 500));
        auditLog.setMessage(limit(message, 1000));
        auditLog.setMetadata(limit(metadata, 2000));
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
        return value == null || value.trim().isEmpty() ? null : value.trim();
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
