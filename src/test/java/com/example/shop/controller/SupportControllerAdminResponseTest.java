package com.example.shop.controller;

import com.example.shop.dto.SupportAdminSessionPageResponse;
import com.example.shop.dto.SupportAdminSessionResponse;
import com.example.shop.dto.SupportWebSocketTicketResponse;
import com.example.shop.entity.SupportMessage;
import com.example.shop.entity.SupportSession;
import com.example.shop.security.UserDetailsImpl;
import com.example.shop.service.AdminRoleService;
import com.example.shop.service.IpBlacklistService;
import com.example.shop.service.OrderService;
import com.example.shop.service.PetBirthdayCouponService;
import com.example.shop.service.SecurityAuditLogService;
import com.example.shop.service.SupportService;
import com.example.shop.service.SupportWebSocketTicketService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class SupportControllerAdminResponseTest {
    private final SupportService supportService = mock(SupportService.class);
    private final AdminRoleService adminRoleService = mock(AdminRoleService.class);
    private final SecurityAuditLogService auditLogService = mock(SecurityAuditLogService.class);
    private final SupportWebSocketTicketService ticketService = mock(SupportWebSocketTicketService.class);
    private final SupportController controller = new SupportController(
            supportService,
            adminRoleService,
            mock(PetBirthdayCouponService.class),
            mock(OrderService.class),
            mock(IpBlacklistService.class),
            auditLogService,
            ticketService
    );
    private final ObjectMapper objectMapper = new ObjectMapper();

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void adminSessionPageDoesNotExposeInternalContextKey() {
        SupportSession session = adminSession();
        when(supportService.getAdminSessionPage(null, null, null, null, 1, 20))
                .thenReturn(SupportAdminSessionPageResponse.of(List.of(session), 1, 1, 20));

        SupportAdminSessionPageResponse response = controller.getSupportSessions(null, null, null, null, 1, 20);

        Map<?, ?> serialized = objectMapper.convertValue(response, Map.class);
        List<?> items = (List<?>) serialized.get("items");
        assertEquals(1, items.size());
        assertNoContextKey((Map<?, ?>) items.get(0));
        assertEquals(session.getUserId(), ((Map<?, ?>) items.get(0)).get("userId"));
        assertEquals(session.getUnreadByAdmin(), ((Map<?, ?>) items.get(0)).get("unreadByAdmin"));
    }

    @Test
    void authenticatedUserCanIssueOpaqueWebSocketTicket() {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/support/websocket-ticket");
        request.addHeader("Authorization", "Bearer jwt-token");
        when(ticketService.issue(any(UserDetailsImpl.class), eq("Bearer jwt-token")))
                .thenReturn(new SupportWebSocketTicketService.Ticket(
                        "ws-ticket-1",
                        7L,
                        "jti-1",
                        System.currentTimeMillis() + 60_000L));

        SupportWebSocketTicketResponse response = controller.createWebSocketTicket(adminAuthentication(), request);

        assertEquals("ws-ticket-1", response.getTicket());
        assertTrue(response.getExpiresInMillis() > 0);
    }

    @Test
    void adminMessageResponseDoesNotExposeInternalContextKey() {
        Authentication authentication = adminAuthentication();
        grantSupportPermission(AdminRoleService.SUPPORT_REPLY_PERMISSION);
        SupportMessage message = supportMessage();
        SupportSession session = adminSession();
        when(supportService.sendAdminMessage(7L, 55L, "hello", "ADMIN")).thenReturn(message);
        when(supportService.getSession(55L)).thenReturn(session);

        ResponseEntity<?> response = controller.sendSupportMessage(
                55L,
                Map.of("content", "hello"),
                authentication,
                new MockHttpServletRequest("POST", "/admin/support/sessions/55/messages")
        );

        assertEquals(200, response.getStatusCodeValue());
        Map<?, ?> body = objectMapper.convertValue(response.getBody(), Map.class);
        assertNoContextKey((Map<?, ?>) body.get("session"));
        assertTrue(((Map<?, ?>) body.get("message")).containsKey("senderName"));
    }

    @Test
    void adminSessionActionResponsesDoNotExposeInternalContextKey() {
        Authentication authentication = adminAuthentication();
        SupportSession session = adminSession();
        grantSupportPermission(AdminRoleService.SUPPORT_CLOSE_PERMISSION);
        grantSupportPermission(AdminRoleService.SUPPORT_ASSIGN_PERMISSION);
        grantSupportPermission(AdminRoleService.SUPPORT_REOPEN_PERMISSION);
        when(supportService.closeSession(55L)).thenReturn(session);
        when(supportService.assignSession(55L, 7L)).thenReturn(session);
        when(supportService.reopenSession(55L, 7L)).thenReturn(session);

        SupportAdminSessionResponse closeResponse = controller.closeSupportSession(
                55L,
                authentication,
                new MockHttpServletRequest("PUT", "/admin/support/sessions/55/close")
        );
        ResponseEntity<?> assignResponse = controller.assignSupportSession(
                55L,
                authentication,
                new MockHttpServletRequest("PUT", "/admin/support/sessions/55/assign")
        );
        ResponseEntity<?> reopenResponse = controller.reopenSupportSession(
                55L,
                authentication,
                new MockHttpServletRequest("PUT", "/admin/support/sessions/55/reopen")
        );

        assertNoContextKey(objectMapper.convertValue(closeResponse, Map.class));
        assertNoContextKey(objectMapper.convertValue(assignResponse.getBody(), Map.class));
        assertNoContextKey(objectMapper.convertValue(reopenResponse.getBody(), Map.class));
    }

    private void assertNoContextKey(Map<?, ?> serialized) {
        assertNotNull(serialized);
        assertFalse(serialized.containsKey("contextKey"));
    }

    private void grantSupportPermission(String permission) {
        when(adminRoleService.hasPermission(7L, permission)).thenReturn(true);
    }

    private Authentication adminAuthentication() {
        UserDetailsImpl user = new UserDetailsImpl(
                7L,
                "support-admin",
                "support-admin@example.com",
                "ACTIVE",
                "secret",
                List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))
        );
        Authentication authentication = new UsernamePasswordAuthenticationToken(
                user,
                null,
                user.getAuthorities()
        );
        SecurityContextHolder.getContext().setAuthentication(authentication);
        return authentication;
    }

    private SupportSession adminSession() {
        SupportSession session = new SupportSession();
        session.setId(55L);
        session.setUserId(42L);
        session.setAssignedAdminId(7L);
        session.setContextKey("guest-order:so202606030001");
        session.setStatus("OPEN");
        session.setLastMessage("Need help with the order");
        session.setUsername("Guest Buyer");
        session.setAssignedAdminName("support-admin");
        session.setUnreadByUser(0);
        session.setUnreadByAdmin(2);
        return session;
    }

    private SupportMessage supportMessage() {
        SupportMessage message = new SupportMessage();
        message.setId(90L);
        message.setSessionId(55L);
        message.setSenderRole("ADMIN");
        message.setSenderName("support-admin");
        message.setContent("hello");
        message.setIsReadByUser(false);
        message.setIsReadByAdmin(true);
        return message;
    }
}
