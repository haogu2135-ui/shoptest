package com.example.shop.websocket;

import com.example.shop.entity.User;
import com.example.shop.repository.UserMapper;
import com.example.shop.security.JwtService;
import com.example.shop.security.UserDetailsImpl;
import com.example.shop.service.AdminRoleService;
import com.example.shop.service.RuntimeConfigService;
import com.example.shop.service.SecurityAuditLogService;
import com.example.shop.service.SupportService;
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
import java.nio.charset.StandardCharsets;
import java.security.Principal;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class SupportWebSocketHandlerAuthenticationTest {
    private final JwtService jwtService = mock(JwtService.class);
    private final TokenBlacklistService tokenBlacklistService = mock(TokenBlacklistService.class);
    private final UserMapper userMapper = mock(UserMapper.class);
    private final AdminRoleService adminRoleService = mock(AdminRoleService.class);
    private final RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final SupportWebSocketHandler handler = new SupportWebSocketHandler(
            jwtService,
            tokenBlacklistService,
            userMapper,
            adminRoleService,
            mock(SupportService.class),
            mock(SecurityAuditLogService.class),
            objectMapper,
            runtimeConfig
    );

    @BeforeEach
    void setUp() {
        when(runtimeConfig.getInt(anyString(), anyInt())).thenAnswer(invocation -> invocation.getArgument(1));
    }

    @Test
    void closesConnectionWithoutAuthenticatedSubProtocol() throws Exception {
        TestWebSocketSession session = new TestWebSocketSession();

        handler.afterConnectionEstablished(session);

        assertFalse(session.isOpen());
        assertEquals(CloseStatus.NOT_ACCEPTABLE.getCode(), session.closeStatus().getCode());
        assertEquals("Unauthorized", session.closeStatus().getReason());
        assertTrue(session.sentMessages().isEmpty());
    }

    @Test
    void acceptsConnectionOnlyWhenSubProtocolTokenValidates() throws Exception {
        TestWebSocketSession session = new TestWebSocketSession();
        session.getHandshakeHeaders().add("Sec-WebSocket-Protocol", "support.v1, auth." + protocolToken("Bearer jwt-token"));
        User user = activeCustomer();
        when(jwtService.extractJti("jwt-token")).thenReturn("jti-1");
        when(tokenBlacklistService.isAccessTokenBlacklisted("jti-1")).thenReturn(false);
        when(jwtService.extractUsername("jwt-token")).thenReturn("mia");
        when(userMapper.findByUsernameOrPhoneOrEmail("mia")).thenReturn(user);
        when(jwtService.isTokenValid(eq("jwt-token"), any(UserDetailsImpl.class))).thenReturn(true);

        handler.afterConnectionEstablished(session);

        assertTrue(session.isOpen());
        assertEquals(12L, session.getAttributes().get("userId"));
        assertEquals("USER", session.getAttributes().get("role"));
        Map<String, Object> connected = objectMapper.readValue(session.sentMessages().get(0), new TypeReference<>() {});
        assertEquals("CONNECTED", connected.get("type"));
        assertEquals("USER", connected.get("role"));
    }

    private String protocolToken(String token) {
        return Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(token.getBytes(StandardCharsets.UTF_8));
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
