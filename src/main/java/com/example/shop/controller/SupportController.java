package com.example.shop.controller;

import com.example.shop.dto.SupportAdminSummaryResponse;
import com.example.shop.entity.Order;
import com.example.shop.entity.SupportMessage;
import com.example.shop.entity.SupportSession;
import com.example.shop.entity.User;
import com.example.shop.repository.UserRepository;
import com.example.shop.security.SecurityUtils;
import com.example.shop.security.UserDetailsImpl;
import com.example.shop.service.SupportService;
import com.example.shop.service.OrderService;
import com.example.shop.service.PetBirthdayCouponService;
import com.example.shop.service.SecurityAuditLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import javax.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class SupportController {
    private final SupportService supportService;
    private final PetBirthdayCouponService petBirthdayCouponService;
    private final OrderService orderService;
    private final UserRepository userRepository;
    private final SecurityAuditLogService auditLogService;

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
    public ResponseEntity<?> sendMyMessage(@RequestBody(required = false) Map<String, Object> body) {
        try {
            Long sessionId = toLong(body == null ? null : body.get("sessionId"));
            String content = body == null || body.get("content") == null ? "" : String.valueOf(body.get("content"));
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

    @GetMapping("/support/guest/session")
    public SupportSession getGuestSession(@RequestParam String orderNo, @RequestParam String email) {
        Order order = requireGuestOrder(orderNo, email);
        return supportService.getOrCreateOpenSession(order.getUserId());
    }

    @GetMapping("/support/guest/sessions/{sessionId}/messages")
    public ResponseEntity<?> getGuestMessages(@PathVariable Long sessionId,
                                              @RequestParam String orderNo,
                                              @RequestParam String email) {
        Order order = requireGuestOrder(orderNo, email);
        assertGuestSessionAccess(sessionId, order);
        supportService.markRead(sessionId, "USER");
        return ResponseEntity.ok(supportService.getMessages(sessionId));
    }

    @PostMapping("/support/guest/messages")
    public ResponseEntity<?> sendGuestMessage(@RequestBody(required = false) Map<String, Object> body) {
        String orderNo = body == null ? null : String.valueOf(body.get("orderNo"));
        String email = body == null ? null : String.valueOf(body.get("email"));
        Order order = requireGuestOrder(orderNo, email);
        Long sessionId = toLong(body == null ? null : body.get("sessionId"));
        if (sessionId != null) {
            assertGuestSessionAccess(sessionId, order);
        }
        String content = body == null || body.get("content") == null ? "" : String.valueOf(body.get("content"));
        SupportMessage sent = supportService.sendUserMessage(order.getUserId(), sessionId, content);
        return ResponseEntity.ok(Map.of(
                "message", sent,
                "session", supportService.getSession(sent.getSessionId())
        ));
    }

    @PutMapping("/support/guest/sessions/{sessionId}/read")
    public ResponseEntity<?> markGuestMessagesRead(@PathVariable Long sessionId,
                                                   @RequestBody(required = false) Map<String, Object> body) {
        String orderNo = body == null ? null : String.valueOf(body.get("orderNo"));
        String email = body == null ? null : String.valueOf(body.get("email"));
        Order order = requireGuestOrder(orderNo, email);
        assertGuestSessionAccess(sessionId, order);
        supportService.markRead(sessionId, "USER");
        return ResponseEntity.ok(Map.of("message", "OK"));
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
    public ResponseEntity<?> sendSupportMessage(@PathVariable Long sessionId,
                                                @RequestBody(required = false) Map<String, Object> body,
                                                Authentication authentication,
                                                HttpServletRequest request) {
        try {
            String content = body == null || body.get("content") == null ? "" : String.valueOf(body.get("content"));
            SupportMessage sent = supportService.sendAdminMessage(currentUserId(), sessionId, content);
            auditLogService.record("SUPPORT_MESSAGE_SEND", "SUCCESS", authentication, "SUPPORT_SESSION", sessionId, request,
                    "Support message sent", supportMessageAuditMetadata(sent));
            return ResponseEntity.ok(Map.of(
                    "message", sent,
                    "session", supportService.getSession(sent.getSessionId())
            ));
        } catch (IllegalArgumentException | IllegalStateException ex) {
            auditLogService.record("SUPPORT_MESSAGE_SEND", "FAILURE", authentication, "SUPPORT_SESSION", sessionId, request,
                    ex.getMessage(), null);
            throw ex;
        }
    }

    @PutMapping("/admin/support/sessions/{sessionId}/close")
    public SupportSession closeSupportSession(@PathVariable Long sessionId,
                                              Authentication authentication,
                                              HttpServletRequest request) {
        try {
            SupportSession session = supportService.closeSession(sessionId);
            auditLogService.record("SUPPORT_SESSION_CLOSE", "SUCCESS", authentication, "SUPPORT_SESSION", sessionId, request,
                    "Support session closed", supportSessionAuditMetadata(session));
            return session;
        } catch (RuntimeException ex) {
            auditLogService.record("SUPPORT_SESSION_CLOSE", "FAILURE", authentication, "SUPPORT_SESSION", sessionId, request,
                    ex.getMessage(), null);
            throw ex;
        }
    }

    @PutMapping("/admin/support/sessions/{sessionId}/assign")
    public ResponseEntity<?> assignSupportSession(@PathVariable Long sessionId,
                                                  Authentication authentication,
                                                  HttpServletRequest request) {
        try {
            SupportSession session = supportService.assignSession(sessionId, currentUserId());
            auditLogService.record("SUPPORT_SESSION_ASSIGN", "SUCCESS", authentication, "SUPPORT_SESSION", sessionId, request,
                    "Support session assigned", supportSessionAuditMetadata(session));
            return ResponseEntity.ok(session);
        } catch (IllegalArgumentException | IllegalStateException ex) {
            auditLogService.record("SUPPORT_SESSION_ASSIGN", "FAILURE", authentication, "SUPPORT_SESSION", sessionId, request,
                    ex.getMessage(), null);
            throw ex;
        }
    }

    @PutMapping("/admin/support/sessions/{sessionId}/reopen")
    public ResponseEntity<?> reopenSupportSession(@PathVariable Long sessionId,
                                                  Authentication authentication,
                                                  HttpServletRequest request) {
        try {
            SupportSession session = supportService.reopenSession(sessionId, currentUserId());
            auditLogService.record("SUPPORT_SESSION_REOPEN", "SUCCESS", authentication, "SUPPORT_SESSION", sessionId, request,
                    "Support session reopened", supportSessionAuditMetadata(session));
            return ResponseEntity.ok(session);
        } catch (IllegalArgumentException | IllegalStateException ex) {
            auditLogService.record("SUPPORT_SESSION_REOPEN", "FAILURE", authentication, "SUPPORT_SESSION", sessionId, request,
                    ex.getMessage(), null);
            throw ex;
        }
    }

    @GetMapping("/admin/support/unread-count")
    public Map<String, Integer> getSupportUnreadCount() {
        return Map.of("count", supportService.countUnreadByAdmin());
    }

    @PostMapping("/admin/support/sessions/{sessionId}/birthday-coupons/reissue")
    public ResponseEntity<?> reissueBirthdayCoupon(@PathVariable Long sessionId,
                                                   Authentication authentication,
                                                   HttpServletRequest request) {
        SupportSession session = supportService.getSession(sessionId);
        if (session == null) {
            auditLogService.record("SUPPORT_BIRTHDAY_COUPON_REISSUE", "FAILURE", authentication, "SUPPORT_SESSION", sessionId, request,
                    "Support session not found", null);
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Support session not found");
        }
        try {
            int granted = petBirthdayCouponService.reissueBirthdayCoupons(session.getUserId(), java.time.LocalDate.now());
            auditLogService.record("SUPPORT_BIRTHDAY_COUPON_REISSUE", "SUCCESS", authentication, "SUPPORT_SESSION", sessionId, request,
                    "Support birthday coupon reissued", supportSessionAuditMetadata(session) + ",granted=" + granted);
            return ResponseEntity.ok(Map.of("granted", granted));
        } catch (IllegalArgumentException | IllegalStateException ex) {
            auditLogService.record("SUPPORT_BIRTHDAY_COUPON_REISSUE", "FAILURE", authentication, "SUPPORT_SESSION", sessionId, request,
                    ex.getMessage(), supportSessionAuditMetadata(session));
            throw ex;
        }
    }

    private String supportSessionAuditMetadata(SupportSession session) {
        if (session == null) {
            return null;
        }
        return "userId=" + session.getUserId()
                + ",assignedAdminId=" + session.getAssignedAdminId()
                + ",status=" + session.getStatus();
    }

    private String supportMessageAuditMetadata(SupportMessage message) {
        if (message == null) {
            return null;
        }
        String content = message.getContent() == null ? "" : message.getContent().trim();
        return "senderRole=" + message.getSenderRole()
                + ",contentLength=" + content.length();
    }

    private boolean canAccessSession(Long sessionId) {
        UserDetailsImpl user = currentUser();
        if ("ADMIN".equals(currentRole(user))) {
            return true;
        }
        SupportSession session = supportService.getSession(sessionId);
        return session != null && user.getId().equals(session.getUserId());
    }

    private Order requireGuestOrder(String orderNo, String email) {
        try {
            Order order = orderService.trackOrder(orderNo, email).getOrder();
            if (order == null || order.getUserId() == null || !isGuestSupportOrder(order)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Support is not available for this order");
            }
            return order;
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Support is not available for this order");
        }
    }

    private boolean isGuestSupportOrder(Order order) {
        if (order == null || order.getUserId() == null) {
            return false;
        }
        String shippingAddress = order.getShippingAddress();
        if (shippingAddress != null && shippingAddress.startsWith("[Guest] ")) {
            return true;
        }
        return userRepository.findById(order.getUserId())
                .map(User::getStatus)
                .map(status -> "GUEST".equalsIgnoreCase(status))
                .orElse(false);
    }

    private void assertGuestSessionAccess(Long sessionId, Order order) {
        SupportSession session = supportService.getSession(sessionId);
        if (session == null || order == null || order.getUserId() == null || !order.getUserId().equals(session.getUserId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Forbidden");
        }
    }

    private Long currentUserId() {
        return currentUser().getId();
    }

    private String currentRole() {
        return currentRole(currentUser());
    }

    private String currentRole(UserDetailsImpl user) {
        return user.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority())) ? "ADMIN" : "USER";
    }

    private UserDetailsImpl currentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return SecurityUtils.requireUser(authentication);
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
