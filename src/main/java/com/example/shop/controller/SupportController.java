package com.example.shop.controller;

import com.example.shop.dto.SupportAdminSummaryResponse;
import com.example.shop.entity.SupportMessage;
import com.example.shop.entity.SupportSession;
import com.example.shop.security.UserDetailsImpl;
import com.example.shop.service.SupportService;
import com.example.shop.service.PetBirthdayCouponService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class SupportController {
    private final SupportService supportService;
    private final PetBirthdayCouponService petBirthdayCouponService;

    @GetMapping("/support/session")
    public SupportSession getMySession() {
        return supportService.getOrCreateOpenSession(currentUserId());
    }

    @GetMapping("/support/sessions")
    public List<SupportSession> getMySessions() {
        return supportService.getUserSessions(currentUserId());
    }

    @GetMapping("/support/sessions/{sessionId}/messages")
    public ResponseEntity<?> getMyMessages(@PathVariable Long sessionId) {
        if (!canAccessSession(sessionId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Forbidden");
        }
        supportService.markRead(sessionId, currentRole());
        return ResponseEntity.ok(supportService.getMessages(sessionId));
    }

    @PutMapping("/support/sessions/{sessionId}/read")
    public ResponseEntity<?> markMyMessagesRead(@PathVariable Long sessionId) {
        if (!canAccessSession(sessionId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Forbidden");
        }
        supportService.markRead(sessionId, currentRole());
        return ResponseEntity.ok(Map.of("message", "OK"));
    }

    @PostMapping("/support/messages")
    public ResponseEntity<?> sendMyMessage(@RequestBody Map<String, Object> body) {
        try {
            Long sessionId = toLong(body.get("sessionId"));
            String content = body.get("content") == null ? "" : String.valueOf(body.get("content"));
            SupportMessage sent = supportService.sendUserMessage(currentUserId(), sessionId, content);
            return ResponseEntity.ok(Map.of(
                    "message", sent,
                    "session", supportService.getSession(sent.getSessionId())
            ));
        } catch (IllegalArgumentException | IllegalStateException ex) {
            throw ex;
        }
    }

    @PutMapping("/support/sessions/{sessionId}/close")
    public ResponseEntity<?> closeMySession(@PathVariable Long sessionId) {
        if (!canAccessSession(sessionId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Forbidden");
        }
        return ResponseEntity.ok(supportService.closeSession(sessionId));
    }

    @GetMapping("/support/unread-count")
    public Map<String, Integer> getMyUnreadCount() {
        return Map.of("count", supportService.countUnreadByUser(currentUserId()));
    }

    @GetMapping("/admin/support/sessions")
    public List<SupportSession> getSupportSessions(@RequestParam(required = false) String status) {
        return supportService.getAllSessions(status);
    }

    @GetMapping("/admin/support/summary")
    public SupportAdminSummaryResponse getSupportSummary() {
        return supportService.adminSummary(currentUserId());
    }

    @GetMapping("/admin/support/sessions/{sessionId}/messages")
    public List<SupportMessage> getSupportMessages(@PathVariable Long sessionId) {
        supportService.markRead(sessionId, "ADMIN");
        return supportService.getMessages(sessionId);
    }

    @PutMapping("/admin/support/sessions/{sessionId}/read")
    public Map<String, String> markSupportMessagesRead(@PathVariable Long sessionId) {
        supportService.markRead(sessionId, "ADMIN");
        return Map.of("message", "OK");
    }

    @PostMapping("/admin/support/sessions/{sessionId}/messages")
    public ResponseEntity<?> sendSupportMessage(@PathVariable Long sessionId, @RequestBody Map<String, Object> body) {
        try {
            String content = body.get("content") == null ? "" : String.valueOf(body.get("content"));
            SupportMessage sent = supportService.sendAdminMessage(currentUserId(), sessionId, content);
            return ResponseEntity.ok(Map.of(
                    "message", sent,
                    "session", supportService.getSession(sent.getSessionId())
            ));
        } catch (IllegalArgumentException | IllegalStateException ex) {
            throw ex;
        }
    }

    @PutMapping("/admin/support/sessions/{sessionId}/close")
    public SupportSession closeSupportSession(@PathVariable Long sessionId) {
        return supportService.closeSession(sessionId);
    }

    @PutMapping("/admin/support/sessions/{sessionId}/assign")
    public ResponseEntity<?> assignSupportSession(@PathVariable Long sessionId) {
        try {
            return ResponseEntity.ok(supportService.assignSession(sessionId, currentUserId()));
        } catch (IllegalArgumentException | IllegalStateException ex) {
            throw ex;
        }
    }

    @PutMapping("/admin/support/sessions/{sessionId}/reopen")
    public ResponseEntity<?> reopenSupportSession(@PathVariable Long sessionId) {
        try {
            return ResponseEntity.ok(supportService.reopenSession(sessionId, currentUserId()));
        } catch (IllegalArgumentException | IllegalStateException ex) {
            throw ex;
        }
    }

    @GetMapping("/admin/support/unread-count")
    public Map<String, Integer> getSupportUnreadCount() {
        return Map.of("count", supportService.countUnreadByAdmin());
    }

    @PostMapping("/admin/support/sessions/{sessionId}/birthday-coupons/reissue")
    public ResponseEntity<?> reissueBirthdayCoupon(@PathVariable Long sessionId) {
        SupportSession session = supportService.getSession(sessionId);
        if (session == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Support session not found");
        }
        try {
            int granted = petBirthdayCouponService.reissueBirthdayCoupons(session.getUserId(), java.time.LocalDate.now());
            return ResponseEntity.ok(Map.of("granted", granted));
        } catch (IllegalArgumentException | IllegalStateException ex) {
            throw ex;
        }
    }

    private boolean canAccessSession(Long sessionId) {
        if ("ADMIN".equals(currentRole())) {
            return true;
        }
        SupportSession session = supportService.getSession(sessionId);
        return session != null && currentUserId().equals(session.getUserId());
    }

    private Long currentUserId() {
        return currentUser().getId();
    }

    private String currentRole() {
        return currentUser().getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority())) ? "ADMIN" : "USER";
    }

    private UserDetailsImpl currentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return (UserDetailsImpl) authentication.getPrincipal();
    }

    private Long toLong(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number) {
            return ((Number) value).longValue();
        }
        String text = String.valueOf(value).trim();
        if (text.isBlank()) {
            return null;
        }
        try {
            return Long.valueOf(text);
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
