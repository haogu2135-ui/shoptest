package com.example.shop.websocket;

import com.example.shop.entity.SupportMessage;
import com.example.shop.entity.SupportSession;
import com.example.shop.entity.User;
import com.example.shop.repository.UserMapper;
import com.example.shop.security.JwtService;
import com.example.shop.security.UserDetailsImpl;
import com.example.shop.service.SupportService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;
import java.net.URI;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Component
@RequiredArgsConstructor
public class SupportWebSocketHandler extends TextWebSocketHandler {
    private final JwtService jwtService;
    private final UserMapper userMapper;
    private final SupportService supportService;
    private final ObjectMapper objectMapper;

    private final Map<Long, Set<WebSocketSession>> userSessions = new ConcurrentHashMap<>();
    private final Set<WebSocketSession> adminSessions = ConcurrentHashMap.newKeySet();

    @Value("${support.websocket.max-message-chars:1200}")
    private int maxMessageChars;

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        User user = authenticate(session.getUri());
        if (user == null) {
            session.close(CloseStatus.NOT_ACCEPTABLE.withReason("Unauthorized"));
            return;
        }
        session.getAttributes().put("userId", user.getId());
        session.getAttributes().put("role", user.getRole());
        session.getAttributes().put("username", user.getUsername());

        if ("ADMIN".equalsIgnoreCase(user.getRole())) {
            adminSessions.add(session);
        } else {
            userSessions.computeIfAbsent(user.getId(), key -> ConcurrentHashMap.newKeySet()).add(session);
        }
        sendJson(session, Map.of(
                "type", "CONNECTED",
                "userId", user.getId(),
                "role", user.getRole()
        ));
    }

    @Override
    protected void handleTextMessage(WebSocketSession socket, TextMessage textMessage) throws Exception {
        try {
            handleSupportMessage(socket, textMessage);
        } catch (IllegalArgumentException | IllegalStateException e) {
            sendError(socket, e.getMessage());
        } catch (Exception e) {
            sendError(socket, "Unable to process support message");
        }
    }

    private void handleSupportMessage(WebSocketSession socket, TextMessage textMessage) throws Exception {
        Map<String, Object> payload = objectMapper.readValue(textMessage.getPayload(), new TypeReference<Map<String, Object>>() {});
        String type = String.valueOf(payload.getOrDefault("type", "SEND"));
        Long userId = (Long) socket.getAttributes().get("userId");
        String role = String.valueOf(socket.getAttributes().get("role")).toUpperCase();

        if ("PING".equalsIgnoreCase(type)) {
            sendJson(socket, Map.of("type", "PONG"));
            return;
        }
        if ("READ".equalsIgnoreCase(type)) {
            Long sessionId = toLong(payload.get("sessionId"));
            assertCanAccessSession(sessionId, userId, role);
            supportService.markRead(sessionId, role);
            broadcastSession(supportService.getSession(sessionId));
            return;
        }
        if ("CLOSE".equalsIgnoreCase(type)) {
            Long sessionId = toLong(payload.get("sessionId"));
            assertCanAccessSession(sessionId, userId, role);
            SupportSession closed = supportService.closeSession(sessionId);
            broadcast(Map.of("type", "SESSION_CLOSED", "session", closed), closed.getUserId());
            return;
        }

        String content = payload.get("content") == null ? "" : String.valueOf(payload.get("content"));
        content = normalizeContent(content);
        Long sessionId = toLong(payload.get("sessionId"));
        SupportSession session;
        if ("ADMIN".equals(role)) {
            session = supportService.getSession(sessionId);
            if (session == null) {
                throw new IllegalArgumentException("Support session not found");
            }
        } else {
            session = sessionId == null ? null : supportService.getSession(sessionId);
            if (session == null || !"OPEN".equals(session.getStatus())) {
                session = supportService.getOrCreateOpenSession(userId);
            } else {
                assertCanAccessSession(session.getId(), userId, role);
            }
        }

        SupportMessage message = "ADMIN".equals(role)
                ? supportService.sendAdminMessage(userId, session.getId(), content)
                : supportService.sendUserMessage(userId, session == null ? null : session.getId(), content);
        SupportSession updatedSession = supportService.getSession(message.getSessionId());
        broadcast(Map.of("type", "MESSAGE", "message", message, "session", updatedSession), updatedSession.getUserId());
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        removeSession(session);
        if (session.isOpen()) {
            session.close(CloseStatus.SERVER_ERROR);
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        removeSession(session);
    }

    private User authenticate(URI uri) {
        if (uri == null) {
            return null;
        }
        try {
            String token = UriComponentsBuilder.fromUri(uri).build().getQueryParams().getFirst("token");
            if (token == null || token.isBlank()) {
                return null;
            }
            if (token.startsWith("Bearer ")) {
                token = token.substring(7);
            }
            String username = jwtService.extractUsername(token);
            User user = userMapper.findByUsernameOrPhone(username);
            if (user == null || !jwtService.isTokenValid(token, UserDetailsImpl.build(user))) {
                return null;
            }
            return user;
        } catch (Exception e) {
            return null;
        }
    }

    private void assertCanAccessSession(Long sessionId, Long userId, String role) {
        if (sessionId == null) {
            throw new IllegalArgumentException("Support session is required");
        }
        SupportSession session = supportService.getSession(sessionId);
        if (session == null) {
            throw new IllegalArgumentException("Support session not found");
        }
        if (!"ADMIN".equals(role) && !userId.equals(session.getUserId())) {
            throw new IllegalStateException("Forbidden");
        }
    }

    private void broadcastSession(SupportSession session) {
        broadcast(Map.of("type", "SESSION_UPDATED", "session", session), session.getUserId());
    }

    private void broadcast(Map<String, Object> payload, Long userId) {
        Set<WebSocketSession> sockets = userSessions.get(userId);
        if (sockets != null) {
            for (WebSocketSession socket : sockets) {
                sendJsonQuietly(socket, payload);
            }
        }
        for (WebSocketSession adminSocket : adminSessions) {
            sendJsonQuietly(adminSocket, payload);
        }
    }

    private String normalizeContent(String content) {
        String normalized = content == null ? "" : content.trim();
        if (normalized.length() > maxMessageChars) {
            throw new IllegalArgumentException("Message is too long");
        }
        return normalized;
    }

    private void sendError(WebSocketSession socket, String message) throws IOException {
        sendJson(socket, Map.of("type", "ERROR", "message", message));
    }

    private void sendJsonQuietly(WebSocketSession socket, Object payload) {
        try {
            sendJson(socket, payload);
        } catch (IOException e) {
            removeSession(socket);
        }
    }

    private void sendJson(WebSocketSession socket, Object payload) throws IOException {
        if (socket != null && socket.isOpen()) {
            synchronized (socket) {
                socket.sendMessage(new TextMessage(objectMapper.writeValueAsString(payload)));
            }
        }
    }

    private void removeSession(WebSocketSession session) {
        Object userIdValue = session.getAttributes().get("userId");
        Object roleValue = session.getAttributes().get("role");
        if (roleValue != null && "ADMIN".equalsIgnoreCase(String.valueOf(roleValue))) {
            adminSessions.remove(session);
        }
        if (userIdValue instanceof Long) {
            Set<WebSocketSession> sockets = userSessions.get((Long) userIdValue);
            if (sockets != null) {
                sockets.remove(session);
                if (sockets.isEmpty()) {
                    userSessions.remove((Long) userIdValue);
                }
            }
        }
    }

    private Long toLong(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number) {
            return ((Number) value).longValue();
        }
        String text = String.valueOf(value);
        return text.isBlank() ? null : Long.valueOf(text);
    }
}
