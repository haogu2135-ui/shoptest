package com.example.shop.controller;

import com.example.shop.dto.SupportAdminSummaryResponse;
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
import org.junit.jupiter.api.function.Executable;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
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
    void legacyDuplicateAdminSupportTestDoesNotReturnWithRawStatusNumbersOrTodo() throws Exception {
        Path staleTest = Path.of("src/test/java/com/example/shop/controller/SupportControllerAdminDuplicateTest.java");
        String currentTest = Files.readString(Path.of("src/test/java/com/example/shop/controller/SupportControllerAdminResponseTest.java"));
        String supportController = Files.readString(Path.of("src/main/java/com/example/shop/controller/SupportController.java"));

        assertFalse(Files.exists(staleTest));
        assertFalse(Files.exists(Path.of("src/main/java/com/example/shop/controller/ChatController.java")));
        assertFalse(currentTest.contains("TODO"));
        assertFalse(currentTest.contains("SupportControllerAdminDuplicateTest"));
        assertFalse(supportController.contains("sendAdminReply("));
        assertTrue(supportController.contains("public ResponseEntity<?> sendSupportMessage(@PathVariable Long sessionId,\n"
                + "                                                @RequestBody(required = false) Map<String, Object> body,"));
    }

    @Test
    void adminSessionPageDoesNotExposeInternalContextKey() {
        Authentication authentication = adminAuthentication();
        grantSupportPageAccess();
        SupportSession session = adminSession();
        when(supportService.getAdminSessionPage(null, null, null, null, 1, 20))
                .thenReturn(SupportAdminSessionPageResponse.of(List.of(session), 1, 1, 20));

        SupportAdminSessionPageResponse response = controller.getSupportSessions(
                null,
                null,
                null,
                null,
                1,
                20,
                authentication,
                new MockHttpServletRequest("GET", "/admin/support/sessions")
        );

        Map<?, ?> serialized = objectMapper.convertValue(response, Map.class);
        List<?> items = (List<?>) serialized.get("items");
        assertEquals(1, items.size());
        assertNoContextKey((Map<?, ?>) items.get(0));
        assertEquals(session.getUserId(), ((Map<?, ?>) items.get(0)).get("userId"));
        assertEquals(session.getUnreadByAdmin(), ((Map<?, ?>) items.get(0)).get("unreadByAdmin"));
    }

    @Test
    void adminReadEndpointsRequireSupportPagePermission() {
        Authentication authentication = adminAuthentication();

        assertForbidden(() -> controller.getSupportSessions(
                null,
                null,
                null,
                null,
                1,
                20,
                authentication,
                new MockHttpServletRequest("GET", "/admin/support/sessions")
        ));
        assertForbidden(() -> controller.getSupportSummary(
                authentication,
                new MockHttpServletRequest("GET", "/admin/support/summary")
        ));
        assertForbidden(() -> controller.getSupportMessages(
                55L,
                20,
                null,
                authentication,
                new MockHttpServletRequest("GET", "/admin/support/sessions/55/messages")
        ));
        assertForbidden(() -> controller.getSupportUnreadCount(
                authentication,
                new MockHttpServletRequest("GET", "/admin/support/unread-count")
        ));
        verifyNoInteractions(supportService);
    }

    @Test
    void adminReadEndpointsWriteSuccessAuditLogs() {
        Authentication authentication = adminAuthentication();
        grantSupportPageAccess();
        SupportSession session = adminSession();
        SupportMessage message = supportMessage();
        when(supportService.getAdminSessionPage("OPEN", true, 7L, "private-order-token", 2, 10))
                .thenReturn(SupportAdminSessionPageResponse.of(List.of(session), 1, 2, 10));
        when(supportService.adminSummary(7L)).thenReturn(new SupportAdminSummaryResponse());
        when(supportService.getMessages(55L, 30, 90L)).thenReturn(List.of(message));
        when(supportService.countUnreadByAdmin()).thenReturn(4);
        MockHttpServletRequest listRequest = new MockHttpServletRequest("GET", "/admin/support/sessions");
        MockHttpServletRequest summaryRequest = new MockHttpServletRequest("GET", "/admin/support/summary");
        MockHttpServletRequest messagesRequest = new MockHttpServletRequest("GET", "/admin/support/sessions/55/messages");
        MockHttpServletRequest unreadRequest = new MockHttpServletRequest("GET", "/admin/support/unread-count");

        controller.getSupportSessions("OPEN", true, 7L, "private-order-token", 2, 10, authentication, listRequest);
        controller.getSupportSummary(authentication, summaryRequest);
        controller.getSupportMessages(55L, 30, 90L, authentication, messagesRequest);
        controller.getSupportUnreadCount(authentication, unreadRequest);

        ArgumentCaptor<String> listMetadata = ArgumentCaptor.forClass(String.class);
        verify(auditLogService).record(
                eq("SUPPORT_SESSION_LIST"),
                eq("SUCCESS"),
                eq(authentication),
                eq("SUPPORT_SESSION"),
                isNull(),
                eq(listRequest),
                eq("Support sessions read"),
                listMetadata.capture());
        assertTrue(listMetadata.getValue().contains("statusPresent=true"));
        assertTrue(listMetadata.getValue().contains("needsReply=true"));
        assertTrue(listMetadata.getValue().contains("assignedAdminIdPresent=true"));
        assertTrue(listMetadata.getValue().contains("searchPresent=true"));
        assertTrue(listMetadata.getValue().contains("page=2"));
        assertTrue(listMetadata.getValue().contains("size=10"));
        assertFalse(listMetadata.getValue().contains("private-order-token"));

        verify(auditLogService).record(
                eq("SUPPORT_SUMMARY_READ"),
                eq("SUCCESS"),
                eq(authentication),
                eq("SUPPORT_SESSION"),
                isNull(),
                eq(summaryRequest),
                eq("Support summary read"),
                eq("scope=summary"));

        ArgumentCaptor<String> messageMetadata = ArgumentCaptor.forClass(String.class);
        verify(auditLogService).record(
                eq("SUPPORT_MESSAGE_READ"),
                eq("SUCCESS"),
                eq(authentication),
                eq("SUPPORT_SESSION"),
                eq(55L),
                eq(messagesRequest),
                eq("Support messages read"),
                messageMetadata.capture());
        assertTrue(messageMetadata.getValue().contains("limit=30"));
        assertTrue(messageMetadata.getValue().contains("afterIdPresent=true"));
        assertFalse(messageMetadata.getValue().contains("hello"));

        verify(auditLogService).record(
                eq("SUPPORT_UNREAD_COUNT_READ"),
                eq("SUCCESS"),
                eq(authentication),
                eq("SUPPORT_SESSION"),
                isNull(),
                eq(unreadRequest),
                eq("Support unread count read"),
                eq("scope=unread-count"));
    }

    @Test
    void adminReadEndpointWritesFailureAuditWhenServiceThrows() {
        Authentication authentication = adminAuthentication();
        grantSupportPageAccess();
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/admin/support/sessions/55/messages");
        when(supportService.getMessages(55L, 20, null)).thenThrow(new IllegalStateException("message store offline"));

        IllegalStateException error = assertThrows(IllegalStateException.class, () -> controller.getSupportMessages(
                55L,
                20,
                null,
                authentication,
                request
        ));

        assertEquals("message store offline", error.getMessage());
        ArgumentCaptor<String> metadata = ArgumentCaptor.forClass(String.class);
        verify(auditLogService).record(
                eq("SUPPORT_MESSAGE_READ"),
                eq("FAILURE"),
                eq(authentication),
                eq("SUPPORT_SESSION"),
                eq(55L),
                eq(request),
                eq("message store offline"),
                metadata.capture());
        assertTrue(metadata.getValue().contains("limit=20"));
        assertTrue(metadata.getValue().contains("afterIdPresent=false"));
    }

    @Test
    void adminSupportEndpointsHaveRolePreAuthorizeGuards() throws Exception {
        String source = java.nio.file.Files.readString(
                java.nio.file.Paths.get("src/main/java/com/example/shop/controller/SupportController.java"));
        java.util.regex.Matcher matcher = java.util.regex.Pattern
                .compile("@(?:Get|Post|Put|Delete)Mapping\\(\"/admin/support[^\"]*\"\\)")
                .matcher(source);
        int guardedMappings = 0;
        while (matcher.find()) {
            int methodIndex = source.indexOf("public ", matcher.start());
            assertTrue(methodIndex > matcher.start(), "Missing method declaration after " + matcher.group());
            String annotationBlock = source.substring(matcher.start(), methodIndex);
            assertTrue(annotationBlock.contains("@PreAuthorize(\"hasRole('ADMIN')\")"),
                    "Missing admin role guard for " + matcher.group());
            guardedMappings++;
        }
        assertEquals(10, guardedMappings);
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
        when(supportService.sendAdminMessage(7L, 55L, "hello", "ADMIN", false)).thenReturn(message);
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
    void adminMessageRequiresAssignPermissionWhenSessionIsUnassigned() {
        Authentication authentication = adminAuthentication();
        grantSupportPermission(AdminRoleService.SUPPORT_REPLY_PERMISSION);
        SupportSession session = adminSession();
        session.setAssignedAdminId(null);
        when(supportService.getSession(55L)).thenReturn(session);

        assertForbidden(() -> controller.sendSupportMessage(
                55L,
                Map.of("content", "hello"),
                authentication,
                new MockHttpServletRequest("POST", "/admin/support/sessions/55/messages")
        ));

        verify(supportService, never()).sendAdminMessage(7L, 55L, "hello", "ADMIN", true);
        verify(supportService, never()).sendAdminMessage(7L, 55L, "hello", "ADMIN", false);
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

    private void grantSupportPageAccess() {
        when(adminRoleService.canAccess(7L, "/admin/support")).thenReturn(true);
    }

    private void assertForbidden(Executable executable) {
        ResponseStatusException error = assertThrows(ResponseStatusException.class, executable);
        assertEquals(HttpStatus.FORBIDDEN, error.getStatus());
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
