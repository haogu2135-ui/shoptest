package com.example.shop.controller;

import com.example.shop.dto.SupportAdminSessionResponse;
import com.example.shop.dto.SupportMessageAdminResponse;
import com.example.shop.dto.SupportAdminSummaryResponse;
import com.example.shop.dto.SupportAdminSessionPageResponse;
import com.example.shop.dto.SupportMessageCustomerResponse;
import com.example.shop.dto.SupportSessionCustomerResponse;
import com.example.shop.dto.SupportWebSocketTicketResponse;
import com.example.shop.dto.GuestOrderAccessRequest;
import com.example.shop.dto.GuestSupportMessagesRequest;
import com.example.shop.entity.Order;
import com.example.shop.entity.SupportMessage;
import com.example.shop.entity.SupportSession;
import com.example.shop.security.SecurityUtils;
import com.example.shop.security.UserDetailsImpl;
import com.example.shop.service.AdminRoleService;
import com.example.shop.service.SupportService;
import com.example.shop.service.OrderService;
import com.example.shop.service.IpBlacklistService;
import com.example.shop.service.PetBirthdayCouponService;
import com.example.shop.service.SecurityAuditLogService;
import com.example.shop.service.SupportWebSocketTicketService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import javax.servlet.http.HttpServletRequest;
import javax.validation.Valid;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequiredArgsConstructor
public class SupportController {
    private static final String ADMIN_SUPPORT_PATH = "/admin/support";

    private final SupportService supportService;
    private final AdminRoleService adminRoleService;
    private final PetBirthdayCouponService petBirthdayCouponService;
    private final OrderService orderService;
    private final IpBlacklistService ipBlacklistService;
    private final SecurityAuditLogService auditLogService;
    private final SupportWebSocketTicketService supportWebSocketTicketService;

    @GetMapping({"/support", "/support/"})
    public Map<String, Object> supportInfo(Authentication authentication) {
        Map<String, String> endpoints = new java.util.LinkedHashMap<>();
        endpoints.put("session", "/support/session");
        endpoints.put("messages", "/support/messages");
        endpoints.put("webSocket", "/ws/support");
        endpoints.put("webSocketTicket", "/support/websocket-ticket");
        endpoints.put("guestSession", "/support/guest/session");
        boolean authenticated = authentication != null && authentication.isAuthenticated()
                && !(authentication.getPrincipal() instanceof String
                && "anonymousUser".equals(authentication.getPrincipal()));
        return Map.of(
                "status", "available",
                "authenticated", authenticated,
                "endpoints", endpoints);
    }

    @GetMapping("/support/session")
    public ResponseEntity<SupportSessionCustomerResponse> getMySession() {
        SupportSession session = supportService.findOpenSession(currentUserId());
        if (session == null) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.ok(SupportSessionCustomerResponse.from(session));
    }

    @PostMapping("/support/session")
    public SupportSessionCustomerResponse createMySession() {
        return SupportSessionCustomerResponse.from(supportService.getOrCreateOpenSession(currentUserId()));
    }

    @GetMapping("/support/sessions")
    public List<SupportSessionCustomerResponse> getMySessions(@RequestParam(required = false) Integer limit) {
        return toCustomerSessions(supportService.getUserSessions(currentUserId(), limit));
    }

    @GetMapping("/support/sessions/{sessionId}/messages")
    public ResponseEntity<?> getMyMessages(@PathVariable Long sessionId,
                                           @RequestParam(required = false) Integer limit,
                                           @RequestParam(required = false) Long afterId) {
        if (!canAccessSession(sessionId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Forbidden");
        }
        return ResponseEntity.ok(toCustomerMessages(supportService.getMessages(sessionId, limit, afterId)));
    }

    @PutMapping("/support/sessions/{sessionId}/read")
    public ResponseEntity<?> markMyMessagesRead(@PathVariable Long sessionId) {
        if (!canAccessSession(sessionId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Forbidden");
        }
        supportService.markRead(sessionId, "USER");
        return ResponseEntity.ok(Map.of("message", "OK"));
    }

    @PostMapping("/support/messages")
    public ResponseEntity<?> sendMyMessage(@RequestBody(required = false) Map<String, Object> body) {
        try {
            Long sessionId = toLong(body == null ? null : body.get("sessionId"));
            String content = body == null || body.get("content") == null ? "" : String.valueOf(body.get("content"));
            SupportMessage sent = supportService.sendUserMessage(currentUserId(), sessionId, content);
            return ResponseEntity.ok(Map.of(
                    "message", SupportMessageCustomerResponse.from(sent),
                    "session", SupportSessionCustomerResponse.from(supportService.getSession(sent.getSessionId()))
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
        return ResponseEntity.ok(SupportSessionCustomerResponse.from(supportService.closeSession(sessionId)));
    }

    @GetMapping("/support/unread-count")
    public Map<String, Integer> getMyUnreadCount() {
        return Map.of("count", supportService.countUnreadByUser(currentUserId()));
    }

    @PostMapping("/support/websocket-ticket")
    public SupportWebSocketTicketResponse createWebSocketTicket(Authentication authentication,
                                                               HttpServletRequest request) {
        UserDetailsImpl user = SecurityUtils.requireUser(authentication);
        SupportWebSocketTicketService.Ticket ticket = supportWebSocketTicketService.issue(user, request.getHeader("Authorization"));
        return SupportWebSocketTicketResponse.of(ticket.getValue(), ticket.expiresInMillis(System.currentTimeMillis()));
    }

    @PostMapping("/support/guest/session/lookup")
    public ResponseEntity<SupportSessionCustomerResponse> getGuestSession(@Valid @RequestBody(required = false) GuestOrderAccessRequest body,
                                                                          HttpServletRequest request) {
        GuestOrderAccessRequest access = requireGuestAccessRequest(body);
        Order order = requireGuestOrder(access.getOrderNo(), access.getGuestEmail(), request);
        SupportSession session = supportService.findOpenSession(order.getUserId(), guestSupportContextKey(order));
        if (session == null) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.ok(SupportSessionCustomerResponse.from(session));
    }

    @PostMapping("/support/guest/session")
    public SupportSessionCustomerResponse createGuestSession(@RequestBody(required = false) Map<String, Object> body,
                                                             HttpServletRequest request) {
        String orderNo = body == null ? null : String.valueOf(body.get("orderNo"));
        String email = guestEmailFromBody(body);
        Order order = requireGuestOrder(orderNo, email, request);
        return SupportSessionCustomerResponse.from(supportService.getOrCreateOpenSession(order.getUserId(), guestSupportContextKey(order)));
    }

    @PostMapping("/support/guest/sessions/{sessionId}/messages")
    public ResponseEntity<?> getGuestMessages(@PathVariable Long sessionId,
                                              @Valid @RequestBody(required = false) GuestSupportMessagesRequest body,
                                              HttpServletRequest request) {
        GuestSupportMessagesRequest access = requireGuestMessagesRequest(body);
        Order order = requireGuestOrder(access.getOrderNo(), access.getGuestEmail(), request);
        assertGuestSessionAccess(sessionId, order, request);
        return ResponseEntity.ok(toCustomerMessages(supportService.getMessages(sessionId, access.getLimit(), access.getAfterId())));
    }

    @PostMapping("/support/guest/messages")
    public ResponseEntity<?> sendGuestMessage(@RequestBody(required = false) Map<String, Object> body,
                                              HttpServletRequest request) {
        String orderNo = body == null ? null : String.valueOf(body.get("orderNo"));
        String email = guestEmailFromBody(body);
        Order order = requireGuestOrder(orderNo, email, request);
        Long sessionId = toLong(body == null ? null : body.get("sessionId"));
        if (sessionId != null) {
            assertGuestSessionAccess(sessionId, order, request);
        }
        String content = body == null || body.get("content") == null ? "" : String.valueOf(body.get("content"));
        SupportMessage sent = supportService.sendUserMessage(order.getUserId(), sessionId, content, guestSupportContextKey(order));
        return ResponseEntity.ok(Map.of(
                "message", SupportMessageCustomerResponse.from(sent),
                "session", SupportSessionCustomerResponse.from(supportService.getSession(sent.getSessionId()))
        ));
    }

    @PutMapping("/support/guest/sessions/{sessionId}/read")
    public ResponseEntity<?> markGuestMessagesRead(@PathVariable Long sessionId,
                                                   @RequestBody(required = false) Map<String, Object> body,
                                                   HttpServletRequest request) {
        String orderNo = body == null ? null : String.valueOf(body.get("orderNo"));
        String email = guestEmailFromBody(body);
        Order order = requireGuestOrder(orderNo, email, request);
        assertGuestSessionAccess(sessionId, order, request);
        supportService.markRead(sessionId, "USER");
        return ResponseEntity.ok(Map.of("message", "OK"));
    }

    @GetMapping("/admin/support/sessions")
    @PreAuthorize("hasRole('ADMIN')")
    public SupportAdminSessionPageResponse getSupportSessions(@RequestParam(required = false) String status,
                                                              @RequestParam(required = false) Boolean needsReply,
                                                              @RequestParam(required = false) Long assignedAdminId,
                                                              @RequestParam(required = false) String search,
                                                              @RequestParam(required = false, defaultValue = "1") Integer page,
                                                              @RequestParam(required = false, defaultValue = "20") Integer size,
                                                              Authentication authentication,
                                                              HttpServletRequest request) {
        requireSupportReadPermission(authentication, "SUPPORT_SESSION_LIST", null, request);
        String metadata = supportSessionListReadMetadata(status, needsReply, assignedAdminId, search, page, size);
        try {
            SupportAdminSessionPageResponse response = supportService.getAdminSessionPage(
                    status, needsReply, assignedAdminId, search, page, size);
            recordSupportReadAudit("SUPPORT_SESSION_LIST", "SUCCESS", null, authentication, request,
                    "Support sessions read", metadata);
            return response;
        } catch (RuntimeException ex) {
            recordSupportReadAudit("SUPPORT_SESSION_LIST", "FAILURE", null, authentication, request,
                    ex.getMessage(), metadata);
            throw ex;
        }
    }

    @GetMapping("/admin/support/summary")
    @PreAuthorize("hasRole('ADMIN')")
    public SupportAdminSummaryResponse getSupportSummary(Authentication authentication,
                                                         HttpServletRequest request) {
        requireSupportReadPermission(authentication, "SUPPORT_SUMMARY_READ", null, request);
        try {
            SupportAdminSummaryResponse response = supportService.adminSummary(currentUserId());
            recordSupportReadAudit("SUPPORT_SUMMARY_READ", "SUCCESS", null, authentication, request,
                    "Support summary read", "scope=summary");
            return response;
        } catch (RuntimeException ex) {
            recordSupportReadAudit("SUPPORT_SUMMARY_READ", "FAILURE", null, authentication, request,
                    ex.getMessage(), "scope=summary");
            throw ex;
        }
    }

    @GetMapping("/admin/support/sessions/{sessionId}/messages")
    @PreAuthorize("hasRole('ADMIN')")
    public List<SupportMessageAdminResponse> getSupportMessages(@PathVariable Long sessionId,
                                                                @RequestParam(required = false) Integer limit,
                                                                @RequestParam(required = false) Long afterId,
                                                                Authentication authentication,
                                                                HttpServletRequest request) {
        requireSupportReadPermission(authentication, "SUPPORT_MESSAGE_READ", sessionId, request);
        String metadata = supportMessageReadMetadata(limit, afterId);
        try {
            List<SupportMessageAdminResponse> response = toAdminMessages(supportService.getMessages(sessionId, limit, afterId));
            recordSupportReadAudit("SUPPORT_MESSAGE_READ", "SUCCESS", sessionId, authentication, request,
                    "Support messages read", metadata);
            return response;
        } catch (RuntimeException ex) {
            recordSupportReadAudit("SUPPORT_MESSAGE_READ", "FAILURE", sessionId, authentication, request,
                    ex.getMessage(), metadata);
            throw ex;
        }
    }

    @PutMapping("/admin/support/sessions/{sessionId}/read")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, String> markSupportMessagesRead(@PathVariable Long sessionId,
                                                       Authentication authentication,
                                                       HttpServletRequest request) {
        requireSupportActionPermission(authentication, AdminRoleService.SUPPORT_READ_STATE_PERMISSION,
                "SUPPORT_SESSION_READ_STATE", sessionId, request);
        supportService.markRead(sessionId, "ADMIN");
        return Map.of("message", "OK");
    }

    @PostMapping("/admin/support/sessions/{sessionId}/messages")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> sendSupportMessage(@PathVariable Long sessionId,
                                                @RequestBody(required = false) Map<String, Object> body,
                                                Authentication authentication,
                                                HttpServletRequest request) {
        requireSupportActionPermission(authentication, AdminRoleService.SUPPORT_REPLY_PERMISSION,
                "SUPPORT_MESSAGE_SEND", sessionId, request);
        try {
            String content = body == null || body.get("content") == null ? "" : String.valueOf(body.get("content"));
            SupportSession session = supportService.getSession(sessionId);
            if (session == null) {
                throw new IllegalArgumentException("Support session not found");
            }
            boolean assignIfUnassigned = false;
            if (session.getAssignedAdminId() == null) {
                requireSupportActionPermission(authentication, AdminRoleService.SUPPORT_ASSIGN_PERMISSION,
                        "SUPPORT_SESSION_ASSIGN", sessionId, request);
                assignIfUnassigned = true;
            }
            SupportMessage sent = supportService.sendAdminMessage(currentUserId(), sessionId, content,
                    currentAdminSupportRole(authentication), assignIfUnassigned);
            auditLogService.record("SUPPORT_MESSAGE_SEND", "SUCCESS", authentication, "SUPPORT_SESSION", sessionId, request,
                    "Support message sent", supportMessageAuditMetadata(sent));
            return ResponseEntity.ok(Map.of(
                    "message", SupportMessageAdminResponse.from(sent),
                    "session", SupportAdminSessionResponse.from(supportService.getSession(sent.getSessionId()))
            ));
        } catch (IllegalArgumentException | IllegalStateException ex) {
            auditLogService.record("SUPPORT_MESSAGE_SEND", "FAILURE", authentication, "SUPPORT_SESSION", sessionId, request,
                    ex.getMessage(), null);
            throw ex;
        }
    }

    @PutMapping("/admin/support/sessions/{sessionId}/close")
    @PreAuthorize("hasRole('ADMIN')")
    public SupportAdminSessionResponse closeSupportSession(@PathVariable Long sessionId,
                                                           Authentication authentication,
                                                           HttpServletRequest request) {
        requireSupportActionPermission(authentication, AdminRoleService.SUPPORT_CLOSE_PERMISSION,
                "SUPPORT_SESSION_CLOSE", sessionId, request);
        try {
            SupportSession session = supportService.closeSession(sessionId);
            auditLogService.record("SUPPORT_SESSION_CLOSE", "SUCCESS", authentication, "SUPPORT_SESSION", sessionId, request,
                    "Support session closed", supportSessionAuditMetadata(session));
            return SupportAdminSessionResponse.from(session);
        } catch (RuntimeException ex) {
            auditLogService.record("SUPPORT_SESSION_CLOSE", "FAILURE", authentication, "SUPPORT_SESSION", sessionId, request,
                    ex.getMessage(), null);
            throw ex;
        }
    }

    @PutMapping("/admin/support/sessions/{sessionId}/assign")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> assignSupportSession(@PathVariable Long sessionId,
                                                  Authentication authentication,
                                                  HttpServletRequest request) {
        requireSupportActionPermission(authentication, AdminRoleService.SUPPORT_ASSIGN_PERMISSION,
                "SUPPORT_SESSION_ASSIGN", sessionId, request);
        try {
            SupportSession session = supportService.assignSession(sessionId, currentUserId());
            auditLogService.record("SUPPORT_SESSION_ASSIGN", "SUCCESS", authentication, "SUPPORT_SESSION", sessionId, request,
                    "Support session assigned", supportSessionAuditMetadata(session));
            return ResponseEntity.ok(SupportAdminSessionResponse.from(session));
        } catch (IllegalArgumentException | IllegalStateException ex) {
            auditLogService.record("SUPPORT_SESSION_ASSIGN", "FAILURE", authentication, "SUPPORT_SESSION", sessionId, request,
                    ex.getMessage(), null);
            throw ex;
        }
    }

    @PutMapping("/admin/support/sessions/{sessionId}/reopen")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> reopenSupportSession(@PathVariable Long sessionId,
                                                  Authentication authentication,
                                                  HttpServletRequest request) {
        requireSupportActionPermission(authentication, AdminRoleService.SUPPORT_REOPEN_PERMISSION,
                "SUPPORT_SESSION_REOPEN", sessionId, request);
        try {
            SupportSession session = supportService.reopenSession(sessionId, currentUserId());
            auditLogService.record("SUPPORT_SESSION_REOPEN", "SUCCESS", authentication, "SUPPORT_SESSION", sessionId, request,
                    "Support session reopened", supportSessionAuditMetadata(session));
            return ResponseEntity.ok(SupportAdminSessionResponse.from(session));
        } catch (IllegalArgumentException | IllegalStateException ex) {
            auditLogService.record("SUPPORT_SESSION_REOPEN", "FAILURE", authentication, "SUPPORT_SESSION", sessionId, request,
                    ex.getMessage(), null);
            throw ex;
        }
    }

    @GetMapping("/admin/support/unread-count")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Integer> getSupportUnreadCount(Authentication authentication,
                                                      HttpServletRequest request) {
        requireSupportReadPermission(authentication, "SUPPORT_UNREAD_COUNT_READ", null, request);
        try {
            Map<String, Integer> response = Map.of("count", supportService.countUnreadByAdmin());
            recordSupportReadAudit("SUPPORT_UNREAD_COUNT_READ", "SUCCESS", null, authentication, request,
                    "Support unread count read", "scope=unread-count");
            return response;
        } catch (RuntimeException ex) {
            recordSupportReadAudit("SUPPORT_UNREAD_COUNT_READ", "FAILURE", null, authentication, request,
                    ex.getMessage(), "scope=unread-count");
            throw ex;
        }
    }

    @PostMapping("/admin/support/sessions/{sessionId}/birthday-coupons/reissue")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> reissueBirthdayCoupon(@PathVariable Long sessionId,
                                                   Authentication authentication,
                                                   HttpServletRequest request) {
        requireSupportActionPermission(authentication, AdminRoleService.COUPONS_BIRTHDAY_REISSUE_PERMISSION,
                "SUPPORT_BIRTHDAY_COUPON_REISSUE", sessionId, request);
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
                + ",status=" + session.getStatus()
                + ",contextKey=" + (session.getContextKey() == null ? "" : session.getContextKey());
    }

    private String supportMessageAuditMetadata(SupportMessage message) {
        if (message == null) {
            return null;
        }
        String content = message.getContent() == null ? "" : message.getContent().trim();
        return "senderRole=" + message.getSenderRole()
                + ",contentLength=" + content.length();
    }

    private void recordSupportReadAudit(String auditAction,
                                        String result,
                                        Long sessionId,
                                        Authentication authentication,
                                        HttpServletRequest request,
                                        String message,
                                        String metadata) {
        auditLogService.record(auditAction, result, authentication, "SUPPORT_SESSION", sessionId, request, message, metadata);
    }

    private String supportSessionListReadMetadata(String status,
                                                  Boolean needsReply,
                                                  Long assignedAdminId,
                                                  String search,
                                                  Integer page,
                                                  Integer size) {
        return "statusPresent=" + hasText(status)
                + ",needsReply=" + (needsReply == null ? "" : needsReply)
                + ",assignedAdminIdPresent=" + (assignedAdminId != null)
                + ",searchPresent=" + hasText(search)
                + ",page=" + page
                + ",size=" + size;
    }

    private String supportMessageReadMetadata(Integer limit, Long afterId) {
        return "limit=" + (limit == null ? "" : limit)
                + ",afterIdPresent=" + (afterId != null);
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private void requireSupportActionPermission(Authentication authentication,
                                                String permission,
                                                String auditAction,
                                                Long sessionId,
                                                HttpServletRequest request) {
        UserDetailsImpl user = SecurityUtils.requireUser(authentication);
        if (adminRoleService.hasPermission(user.getId(), permission)) {
            return;
        }
        auditLogService.record(auditAction, "FAILURE", authentication, "SUPPORT_SESSION", sessionId, request,
                "Missing admin action permission", "permission=" + permission);
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Missing admin action permission");
    }

    private void requireSupportReadPermission(Authentication authentication,
                                              String auditAction,
                                              Long sessionId,
                                              HttpServletRequest request) {
        UserDetailsImpl user = SecurityUtils.requireUser(authentication);
        if (adminRoleService.canAccess(user.getId(), ADMIN_SUPPORT_PATH)) {
            return;
        }
        auditLogService.record(auditAction, "FAILURE", authentication, "SUPPORT_SESSION", sessionId, request,
                "Missing admin support page permission", "permission=support");
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Missing admin support permission");
    }

    private List<SupportSessionCustomerResponse> toCustomerSessions(List<SupportSession> sessions) {
        return sessions.stream()
                .map(SupportSessionCustomerResponse::from)
                .collect(Collectors.toList());
    }

    private List<SupportMessageCustomerResponse> toCustomerMessages(List<SupportMessage> messages) {
        return messages.stream()
                .map(SupportMessageCustomerResponse::from)
                .collect(Collectors.toList());
    }

    private List<SupportMessageAdminResponse> toAdminMessages(List<SupportMessage> messages) {
        return messages.stream()
                .map(SupportMessageAdminResponse::from)
                .collect(Collectors.toList());
    }

    private boolean canAccessSession(Long sessionId) {
        UserDetailsImpl user = currentUser();
        SupportSession session = supportService.getSession(sessionId);
        // Authenticated support endpoints expose only default account sessions; guest-order sessions stay credential scoped.
        return session != null
                && user.getId().equals(session.getUserId())
                && supportService.isDefaultUserSession(session);
    }

    private GuestOrderAccessRequest requireGuestAccessRequest(GuestOrderAccessRequest body) {
        if (body == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Guest support access payload is required");
        }
        return body;
    }

    private GuestSupportMessagesRequest requireGuestMessagesRequest(GuestSupportMessagesRequest body) {
        if (body == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Guest support messages payload is required");
        }
        return body;
    }

    private Order requireGuestOrder(String orderNo, String email, HttpServletRequest request) {
        try {
            Order order = orderService.getTrackableOrderForInternalUse(orderNo, email);
            if (order == null || order.getUserId() == null || !isGuestSupportOrder(order)) {
                ipBlacklistService.recordLoginFailure(request, "guest-support order rejected");
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Support is not available for this order");
            }
            return order;
        } catch (IllegalArgumentException e) {
            ipBlacklistService.recordLoginFailure(request, "guest-support credentials failed");
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Support is not available for this order");
        }
    }

    private String guestEmailFromBody(Map<String, Object> body) {
        if (body == null) {
            return null;
        }
        Object value = body.get("guestEmail");
        if (value == null) {
            value = body.get("email");
        }
        return value == null ? null : String.valueOf(value);
    }

    private boolean isGuestSupportOrder(Order order) {
        if (order == null || order.getUserId() == null) {
            return false;
        }
        return orderService.isGuestOrder(order);
    }

    private void assertGuestSessionAccess(Long sessionId, Order order, HttpServletRequest request) {
        SupportSession session = supportService.getSession(sessionId);
        String expectedContextKey = guestSupportContextKey(order);
        if (session == null
                || order == null
                || order.getUserId() == null
                || !order.getUserId().equals(session.getUserId())
                || expectedContextKey == null
                || !expectedContextKey.equals(session.getContextKey())) {
            ipBlacklistService.recordLoginFailure(request, "guest-support session credentials failed");
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Forbidden");
        }
    }

    private String guestSupportContextKey(Order order) {
        if (order == null || order.getOrderNo() == null || order.getOrderNo().trim().isEmpty()) {
            return null;
        }
        return "guest-order:" + order.getOrderNo().trim().toLowerCase(java.util.Locale.ROOT);
    }

    private Long currentUserId() {
        return currentUser().getId();
    }

    private String currentAdminSupportRole(Authentication authentication) {
        UserDetailsImpl user = SecurityUtils.requireUser(authentication);
        return SecurityUtils.isSuperAdmin(user) ? "SUPER_ADMIN" : "ADMIN";
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
