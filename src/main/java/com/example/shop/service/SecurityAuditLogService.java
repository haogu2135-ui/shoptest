package com.example.shop.service;

import com.example.shop.entity.SecurityAuditLog;
import com.example.shop.repository.SecurityAuditLogMapper;
import com.example.shop.security.UserDetailsImpl;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

import javax.servlet.http.HttpServletRequest;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
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
        SecurityAuditLog log = new SecurityAuditLog();
        log.setAction(limit(action, 50));
        log.setResult(limit(result, 20));
        log.setActorUserId(actorUserId);
        log.setActorUsername(limit(actorUsername, 100));
        log.setActorRole(limit(actorRole, 30));
        log.setResourceType(limit(resourceType, 50));
        log.setResourceId(resourceId == null ? null : limit(String.valueOf(resourceId), 100));
        log.setIpAddress(limit(resolveClientIp(request), 45));
        log.setUserAgent(limit(request == null ? null : request.getHeader("User-Agent"), 500));
        log.setMessage(limit(message, 1000));
        log.setMetadata(limit(metadata, 2000));
        log.setCreatedAt(LocalDateTime.now());
        auditLogMapper.insert(log);
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
