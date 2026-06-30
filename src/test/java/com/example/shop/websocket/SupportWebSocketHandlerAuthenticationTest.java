package com.example.shop.websocket;

import com.example.shop.entity.User;
import com.example.shop.repository.UserMapper;
import com.example.shop.service.AdminRoleService;
import com.example.shop.service.RuntimeConfigService;
import com.example.shop.service.SecurityAuditLogService;
import com.example.shop.service.SupportService;
import com.example.shop.service.SupportWebSocketTicketService;
import com.example.shop.service.TokenBlacklistService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketExtension;
import org.springframework.web.socket.WebSocketMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.Principal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SupportWebSocketHandlerAuthenticationTest {
    private final TokenBlacklistService tokenBlacklistService = mock(TokenBlacklistService.class);
    private final UserMapper userMapper = mock(UserMapper.class);
    private final AdminRoleService adminRoleService = mock(AdminRoleService.class);
    private final RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
    private final SupportWebSocketTicketService ticketService = mock(SupportWebSocketTicketService.class);
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final SupportWebSocketHandler handler = new SupportWebSocketHandler(
            tokenBlacklistService,
            userMapper,
            adminRoleService,
            mock(SupportService.class),
            mock(SecurityAuditLogService.class),
            objectMapper,
            runtimeConfig,
            ticketService
    );

    @BeforeEach
    void setUp() {
        when(runtimeConfig.getInt(anyString(), anyInt())).thenAnswer(invocation -> invocation.getArgument(1));
    }

    @Test
    void closesConnectionWithoutTicketSubProtocol() throws Exception {
        TestWebSocketSession session = new TestWebSocketSession();

        handler.afterConnectionEstablished(session);

        assertFalse(session.isOpen());
        assertEquals(CloseStatus.NOT_ACCEPTABLE.getCode(), session.closeStatus().getCode());
        assertEquals("Unauthorized", session.closeStatus().getReason());
        assertTrue(session.sentMessages().isEmpty());
    }

    @Test
    void acceptsConnectionOnlyWhenSubProtocolTicketValidates() throws Exception {
        TestWebSocketSession session = new TestWebSocketSession();
        session.getHandshakeHeaders().add("Sec-WebSocket-Protocol", "support.v1, ticket.ws-ticket-1");
        User user = activeCustomer();
        when(ticketService.consume("ws-ticket-1")).thenReturn(new SupportWebSocketTicketService.Ticket(
                "ws-ticket-1",
                12L,
                "jti-1",
                System.currentTimeMillis() + 60_000L));
        when(tokenBlacklistService.isAccessTokenBlacklisted("jti-1")).thenReturn(false);
        when(userMapper.findById(12L)).thenReturn(user);

        handler.afterConnectionEstablished(session);

        assertTrue(session.isOpen());
        assertEquals(12L, session.getAttributes().get("userId"));
        assertEquals("USER", session.getAttributes().get("role"));
        Map<String, Object> connected = objectMapper.readValue(session.sentMessages().get(0), new TypeReference<>() {});
        assertEquals("CONNECTED", connected.get("type"));
        assertEquals("USER", connected.get("role"));
    }

    @Test
    void rejectsLegacyJwtAuthSubProtocolWithoutConsumingATicket() throws Exception {
        TestWebSocketSession session = new TestWebSocketSession();
        session.getHandshakeHeaders().add("Sec-WebSocket-Protocol", "support.v1, auth.jwt-token");

        handler.afterConnectionEstablished(session);

        assertFalse(session.isOpen());
        verify(ticketService, never()).consume(anyString());
    }

    @Test
    void sourceDoesNotAcceptJwtInWebSocketSubProtocol() throws Exception {
        String source = Files.readString(Path.of("src/main/java/com/example/shop/websocket/SupportWebSocketHandler.java"));

        assertTrue(source.contains("TICKET_PROTOCOL_PREFIX"));
        assertFalse(source.contains("AUTH_PROTOCOL_PREFIX"));
        assertFalse(source.contains("auth."));
        assertFalse(source.contains("Base64.getUrlDecoder"));
        assertFalse(source.contains("extractUsername(token)"));
    }

    @Test
    void webSocketMessageWritesStayBehindSupportServiceRateLimit() throws Exception {
        String handlerSource = Files.readString(Path.of("src/main/java/com/example/shop/websocket/SupportWebSocketHandler.java"));
        String supportServiceSource = Files.readString(Path.of("src/main/java/com/example/shop/service/SupportService.java"));
        String applicationProperties = Files.readString(Path.of("src/main/resources/application.properties"));

        assertTrue(handlerSource.contains("supportService.sendUserMessage(userId, session == null ? null : session.getId(), content);"));
        assertTrue(handlerSource.contains("requireAdminActionPermission(userId, role, AdminRoleService.SUPPORT_ASSIGN_PERMISSION);"));
        assertTrue(handlerSource.contains("supportService.sendAdminMessage(userId, session.getId(), content, role, assignIfUnassigned);"));
        assertFalse(handlerSource.contains("supportMessageMapper"));
        assertFalse(handlerSource.contains(".insert(message)"));
        assertTrue(supportServiceSource.contains("consumeMessageRate(senderId, senderRole);"));
        assertTrue(supportServiceSource.indexOf("consumeMessageRate(senderId, senderRole);")
                < supportServiceSource.indexOf("supportMessageMapper.insert(message);"));
        assertTrue(applicationProperties.contains("support.message.rate-limit-enabled=${SUPPORT_MESSAGE_RATE_LIMIT_ENABLED:true}"));
    }

    @Test
    void webSocketContentNormalizationDelegatesHtmlNeutralizationToSupportService() throws Exception {
        String handlerSource = Files.readString(Path.of("src/main/java/com/example/shop/websocket/SupportWebSocketHandler.java"));
        String supportServiceSource = Files.readString(Path.of("src/main/java/com/example/shop/service/SupportService.java"));
        String handlerNormalizeContent = sourceBlock(
                handlerSource,
                "private String normalizeContent(String content)",
                "private void sendError");

        assertTrue(handlerNormalizeContent.contains("content == null ? \"\" : content.trim()"));
        assertTrue(handlerNormalizeContent.contains("support.websocket.max-message-chars"));
        assertFalse(handlerNormalizeContent.contains("Jsoup"));
        assertFalse(handlerNormalizeContent.contains("Safelist"));
        assertFalse(handlerNormalizeContent.contains("clean("));
        assertFalse(handlerSource.contains("org.jsoup"));
        assertTrue(handlerSource.contains(
                "supportService.sendUserMessage(userId, session == null ? null : session.getId(), content);"));
        assertTrue(handlerSource.contains(
                "supportService.sendAdminMessage(userId, session.getId(), content, role, assignIfUnassigned);"));

        assertTrue(supportServiceSource.contains("String normalizedContent = normalizeContent(content);"));
        assertTrue(supportServiceSource.contains("neutralizeHtmlAngles(decodeHtmlEntities(normalized))"));
        assertTrue(supportServiceSource.contains("supportMessageMapper.insert(message);"));
        assertTrue(supportServiceSource.indexOf("String normalizedContent = normalizeContent(content);")
                < supportServiceSource.indexOf("supportMessageMapper.insert(message);"));
    }

    private User activeCustomer() {
        User user = new User();
        user.setId(12L);
        user.setUsername("mia");
        user.setEmail("mia@example.com");
        user.setPassword("encoded-password");
        user.setRole("USER");
        user.setStatus("ACTIVE");
        return user;
    }

    private String sourceBlock(String source, String startMarker, String endMarker) {
        int start = source.indexOf(startMarker);
        int end = source.indexOf(endMarker, start);
        assertTrue(start >= 0, "start marker missing: " + startMarker);
        assertTrue(end > start, "end marker missing: " + endMarker);
        return source.substring(start, end);
    }

    private static final class TestWebSocketSession implements WebSocketSession {
        private final HttpHeaders handshakeHeaders = new HttpHeaders();
        private final Map<String, Object> attributes = new ConcurrentHashMap<>();
        private final List<String> sentMessages = new ArrayList<>();
        private boolean open = true;
        private CloseStatus closeStatus;
        private int textMessageSizeLimit;
        private int binaryMessageSizeLimit;

        @Override
        public String getId() {
            return "test-support-session";
        }

        @Override
        public URI getUri() {
            return URI.create("ws://localhost/ws/support");
        }

        @Override
        public HttpHeaders getHandshakeHeaders() {
            return handshakeHeaders;
        }

        @Override
        public Map<String, Object> getAttributes() {
            return attributes;
        }

        @Override
        public Principal getPrincipal() {
            return null;
        }

        @Override
        public InetSocketAddress getLocalAddress() {
            return null;
        }

        @Override
        public InetSocketAddress getRemoteAddress() {
            return null;
        }

        @Override
        public String getAcceptedProtocol() {
            return "support.v1";
        }

        @Override
        public void setTextMessageSizeLimit(int messageSizeLimit) {
            this.textMessageSizeLimit = messageSizeLimit;
        }

        @Override
        public int getTextMessageSizeLimit() {
            return textMessageSizeLimit;
        }

        @Override
        public void setBinaryMessageSizeLimit(int messageSizeLimit) {
            this.binaryMessageSizeLimit = messageSizeLimit;
        }

        @Override
        public int getBinaryMessageSizeLimit() {
            return binaryMessageSizeLimit;
        }

        @Override
        public List<WebSocketExtension> getExtensions() {
            return List.of();
        }

        @Override
        public void sendMessage(WebSocketMessage<?> message) {
            sentMessages.add(String.valueOf(message.getPayload()));
        }

        @Override
        public boolean isOpen() {
            return open;
        }

        @Override
        public void close() throws IOException {
            close(CloseStatus.NORMAL);
        }

        @Override
        public void close(CloseStatus status) {
            this.open = false;
            this.closeStatus = status;
        }

        private CloseStatus closeStatus() {
            return closeStatus;
        }

        private List<String> sentMessages() {
            return sentMessages;
        }
    }
}
