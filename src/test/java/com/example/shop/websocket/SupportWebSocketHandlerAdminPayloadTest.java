package com.example.shop.websocket;

import com.example.shop.entity.SupportMessage;
import com.example.shop.entity.SupportSession;
import com.example.shop.repository.UserMapper;
import com.example.shop.service.AdminRoleService;
import com.example.shop.service.RuntimeConfigService;
import com.example.shop.service.SecurityAuditLogService;
import com.example.shop.service.SupportService;
import com.example.shop.service.SupportWebSocketTicketService;
import com.example.shop.service.TokenBlacklistService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.mock;

class SupportWebSocketHandlerAdminPayloadTest {
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final SupportWebSocketHandler handler = new SupportWebSocketHandler(
            mock(TokenBlacklistService.class),
            mock(UserMapper.class),
            mock(AdminRoleService.class),
            mock(SupportService.class),
            mock(SecurityAuditLogService.class),
            objectMapper,
            mock(RuntimeConfigService.class),
            mock(SupportWebSocketTicketService.class)
    );

    @Test
    void adminSessionBroadcastDoesNotExposeInternalContextKey() throws Exception {
        Map<?, ?> payload = invokeAdminPayload("SESSION_UPDATED", null, supportSession());

        assertNoContextKey((Map<?, ?>) payload.get("session"));
    }

    @Test
    void adminMessageBroadcastDoesNotExposeInternalContextKey() throws Exception {
        Map<?, ?> payload = invokeAdminPayload("MESSAGE", supportMessage(), supportSession());

        assertNoContextKey((Map<?, ?>) payload.get("session"));
        assertNotNull(payload.get("message"));
    }

    @SuppressWarnings("unchecked")
    private Map<?, ?> invokeAdminPayload(String type, SupportMessage message, SupportSession session) throws Exception {
        Method method = SupportWebSocketHandler.class.getDeclaredMethod(
                "adminPayload",
                String.class,
                SupportMessage.class,
                SupportSession.class
        );
        method.setAccessible(true);
        Object payload = method.invoke(handler, type, message, session);
        return objectMapper.convertValue(payload, Map.class);
    }

    private void assertNoContextKey(Map<?, ?> serializedSession) {
        assertNotNull(serializedSession);
        assertFalse(serializedSession.containsKey("contextKey"));
    }

    private SupportSession supportSession() {
        SupportSession session = new SupportSession();
        session.setId(55L);
        session.setUserId(42L);
        session.setAssignedAdminId(7L);
        session.setContextKey("guest-order:so202606030001");
        session.setStatus("OPEN");
        session.setUsername("Guest Buyer");
        session.setUnreadByAdmin(2);
        return session;
    }

    private SupportMessage supportMessage() {
        SupportMessage message = new SupportMessage();
        message.setId(91L);
        message.setSessionId(55L);
        message.setSenderRole("USER");
        message.setSenderName("Guest Buyer");
        message.setContent("hello");
        return message;
    }
}
