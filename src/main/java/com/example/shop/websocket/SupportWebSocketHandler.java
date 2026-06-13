package com.example.shop.websocket;

import com.example.shop.dto.SupportAdminSessionResponse;
import com.example.shop.dto.SupportMessageAdminResponse;
import com.example.shop.dto.SupportMessageCustomerResponse;
import com.example.shop.dto.SupportSessionCustomerResponse;
import com.example.shop.entity.SupportMessage;
import com.example.shop.entity.SupportSession;
import com.example.shop.entity.User;
import com.example.shop.repository.UserMapper;
import com.example.shop.security.UserDetailsImpl;
import com.example.shop.service.AdminRoleService;
import com.example.shop.service.RuntimeConfigService;
import com.example.shop.service.SecurityAuditLogService;
import com.example.shop.service.SupportService;
import com.example.shop.service.SupportWebSocketTicketService;
import com.example.shop.service.TokenBlacklistService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.socket.SubProtocolCapable;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Component
@RequiredArgsConstructor
@Slf4j
public class SupportWebSocketHandler extends TextWebSocketHandler implements SubProtocolCapable {
    private static final String SUPPORT_SUB_PROTOCOL = "support.v1";
    private static final String TICKET_PROTOCOL_PREFIX = "ticket.";
    private static final String SEC_WEBSOCKET_PROTOCOL_HEADER = "Sec-WebSocket-Protocol";
    private static final String LAST_ACTIVITY_AT_ATTRIBUTE = "lastActivityAt";
    private static final CloseStatus CONNECTION_LIMIT_EXCEEDED = new CloseStatus(1013, "Connection limit exceeded");
    private static final CloseStatus IDLE_TIMEOUT = new CloseStatus(1001, "Idle timeout");
    private static final CloseStatus TOKEN_REVOKED = CloseStatus.POLICY_VIOLATION.withReason("Token revoked");

    private final TokenBlacklistService tokenBlacklistService;
    private final UserMapper userMapper;
    private final AdminRoleService adminRoleService;
    private final SupportService supportService;
    private final SecurityAuditLogService auditLogService;
    private final ObjectMapper objectMapper;
    private final RuntimeConfigService runtimeConfig;
    private final SupportWebSocketTicketService supportWebSocketTicketService;

    private final Map<Long, Set<WebSocketSession>> userSessions = new ConcurrentHashMap<>();
    private final Set<WebSocketSession> adminSessions = ConcurrentHashMap.newKeySet();
    private final Object sessionRegistryLock = new Object();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        User user = authenticate(session);
        if (user == null) {
            session.close(CloseStatus.NOT_ACCEPTABLE.withReason("Unauthorized"));
            return;
        }
        session.getAttributes().put("userId", user.getId());
        String socketRole = supportAdminRole(user);
        session.getAttributes().put("role", socketRole);
        session.getAttributes().put("username", user.getUsername());
        markSessionActivity(session);
        configureSessionLimits(session);

        boolean adminSocket = isAdminRole(socketRole);
        synchronized (sessionRegistryLock) {
            pruneClosedSessions();
            if (activeConnectionCount() >= maxGlobalConnections()
                    || activeConnectionCountForUser(user.getId()) >= maxConnectionsPerUser()) {
                session.close(CONNECTION_LIMIT_EXCEEDED);
                return;
            }
            if (adminSocket) {
                adminSessions.add(session);
            } else {
                userSessions.computeIfAbsent(user.getId(), key -> ConcurrentHashMap.newKeySet()).add(session);
            }
        }

        if (adminSocket) {
            sendJson(session, Map.of(
                    "type", "CONNECTED",
                    "userId", user.getId(),
                    "role", socketRole
            ));
        } else {
            sendJson(session, Map.of(
                    "type", "CONNECTED",
                    "role", socketRole
            ));
        }
    }

    private void configureSessionLimits(WebSocketSession session) {
        session.setTextMessageSizeLimit(maxTextMessageBytes());
        session.setBinaryMessageSizeLimit(maxBinaryMessageBytes());
    }

    @Override
    protected void handleTextMessage(WebSocketSession socket, TextMessage textMessage) throws Exception {
        if (closeIfTokenRevoked(socket)) {
            return;
        }
        markSessionActivity(socket);
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
        Long userId = requireAuthenticatedSocketUserId(socket);
        String role = socketRole(socket);

        if ("PING".equalsIgnoreCase(type)) {
            sendJson(socket, Map.of("type", "PONG"));
            return;
        }
        if ("PONG".equalsIgnoreCase(type)) {
            return;
        }
        if ("READ".equalsIgnoreCase(type)) {
            Long sessionId = toLong(payload.get("sessionId"));
            requireAdminActionPermission(userId, role, AdminRoleService.SUPPORT_READ_STATE_PERMISSION);
            assertCanAccessSession(sessionId, userId, role);
            supportService.markRead(sessionId, role);
            broadcastSession(supportService.getSession(sessionId));
            return;
        }
        if ("CLOSE".equalsIgnoreCase(type)) {
            Long sessionId = toLong(payload.get("sessionId"));
            try {
                requireAdminActionPermission(userId, role, AdminRoleService.SUPPORT_CLOSE_PERMISSION);
                assertCanAccessSession(sessionId, userId, role);
                SupportSession closed = supportService.closeSession(sessionId);
                auditAdminSocketAction(socket, "SUPPORT_SESSION_CLOSE", "SUCCESS", sessionId,
                        "Support session closed", supportSessionAuditMetadata(closed));
                broadcast("SESSION_CLOSED", null, closed, closed.getUserId());
            } catch (IllegalArgumentException | IllegalStateException e) {
                auditAdminSocketAction(socket, "SUPPORT_SESSION_CLOSE", "FAILURE", sessionId, e.getMessage(), null);
                throw e;
            }
            return;
        }

        Long sessionId = toLong(payload.get("sessionId"));
        String rawContent = payload.get("content") == null ? "" : String.valueOf(payload.get("content"));
        String content;
        SupportSession session;
        if (isAdminRole(role)) {
            try {
                requireAdminActionPermission(userId, role, AdminRoleService.SUPPORT_REPLY_PERMISSION);
                content = normalizeContent(rawContent);
                session = supportService.getSession(sessionId);
                if (session == null) {
                    throw new IllegalArgumentException("Support session not found");
                }
                SupportMessage message = supportService.sendAdminMessage(userId, session.getId(), content, role);
                SupportSession updatedSession = supportService.getSession(message.getSessionId());
                auditAdminSocketAction(socket, "SUPPORT_MESSAGE_SEND", "SUCCESS", session.getId(),
                        "Support message sent", supportMessageAuditMetadata(message));
                broadcast("MESSAGE", message, updatedSession, updatedSession.getUserId());
            } catch (IllegalArgumentException | IllegalStateException e) {
                auditAdminSocketAction(socket, "SUPPORT_MESSAGE_SEND", "FAILURE", sessionId, e.getMessage(), null);
                throw e;
            }
            return;
        } else {
            content = normalizeContent(rawContent);
            session = sessionId == null ? null : supportService.getSession(sessionId);
            if (session == null || !"OPEN".equals(session.getStatus())) {
                session = supportService.getOrCreateOpenSession(userId);
            } else {
                assertCanAccessSession(session.getId(), userId, role);
            }
        }

        SupportMessage message = supportService.sendUserMessage(userId, session == null ? null : session.getId(), content);
        SupportSession updatedSession = supportService.getSession(message.getSessionId());
        broadcast("MESSAGE", message, updatedSession, updatedSession.getUserId());
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

    @Override
    public List<String> getSubProtocols() {
        return List.of(SUPPORT_SUB_PROTOCOL);
    }

    @Scheduled(
            fixedDelayString = "${support.websocket.idle-scan-ms:60000}",
            initialDelayString = "${support.websocket.idle-scan-initial-delay-ms:60000}"
    )
    public void closeIdleSessions() {
        long now = System.currentTimeMillis();
        long maxIdleMs = maxIdleMs();
        synchronized (sessionRegistryLock) {
            adminSessions.removeIf(socket -> shouldRemoveIdleSocket(socket, now, maxIdleMs));
            userSessions.forEach((userId, sockets) -> {
                sockets.removeIf(socket -> shouldRemoveIdleSocket(socket, now, maxIdleMs));
                if (sockets.isEmpty()) {
                    userSessions.remove(userId, sockets);
                }
            });
        }
    }

    private void auditAdminSocketAction(WebSocketSession socket,
                                        String action,
                                        String result,
                                        Long sessionId,
                                        String message,
                                        String metadata) {
        if (socket == null) {
            return;
        }
        String role = String.valueOf(socket.getAttributes().get("role"));
        if (!isAdminRole(role)) {
            return;
        }
        Long actorUserId = toLong(socket.getAttributes().get("userId"));
        String actorUsername = String.valueOf(socket.getAttributes().getOrDefault("username", ""));
        auditLogService.record(action, result, actorUserId, actorUsername, role, "SUPPORT_SESSION", sessionId, null, message, metadata);
    }

    private String supportMessageAuditMetadata(SupportMessage message) {
        if (message == null) {
            return null;
        }
        return "messageId=" + message.getId()
                + ",sessionId=" + message.getSessionId()
                + ",senderRole=" + message.getSenderRole();
    }

    private String supportSessionAuditMetadata(SupportSession session) {
        if (session == null) {
            return null;
        }
        return "sessionId=" + session.getId()
                + ",status=" + session.getStatus()
                + ",userId=" + session.getUserId()
                + ",assignedAdminId=" + session.getAssignedAdminId();
    }

    private User authenticate(WebSocketSession session) {
        if (session == null) {
            return null;
        }
        try {
            SupportWebSocketTicketService.Ticket ticket = resolveTicket(session);
            if (ticket == null || ticket.getUserId() == null) {
                return null;
            }
            String tokenJti = ticket.getTokenJti();
            if (isTokenBlacklisted(tokenJti)) {
                return null;
            }
            User user = userMapper.findById(ticket.getUserId());
            if (user == null || "BANNED".equalsIgnoreCase(user.getStatus())) {
                return null;
            }
            if (tokenJti != null && !tokenJti.isBlank()) {
                session.getAttributes().put("tokenJti", tokenJti);
            }
            return user;
        } catch (Exception e) {
            return null;
        }
    }

    private SupportWebSocketTicketService.Ticket resolveTicket(WebSocketSession session) {
        String ticket = ticketFromSubProtocols(session.getHandshakeHeaders());
        if (ticket != null && !ticket.isBlank()) {
            return supportWebSocketTicketService.consume(ticket);
        }
        return null;
    }

    private String ticketFromSubProtocols(HttpHeaders headers) {
        if (headers == null) {
            return null;
        }
        List<String> protocols = headers.get(SEC_WEBSOCKET_PROTOCOL_HEADER);
        if (protocols == null || protocols.isEmpty()) {
            return null;
        }
        for (String header : protocols) {
            if (header == null || header.isBlank()) {
                continue;
            }
            for (String protocol : header.split(",")) {
                String normalized = protocol.trim();
                if (normalized.startsWith(TICKET_PROTOCOL_PREFIX)) {
                    return normalized.substring(TICKET_PROTOCOL_PREFIX.length()).trim();
                }
            }
        }
        return null;
    }

    private void requireAdminActionPermission(Long userId, String role, String permission) {
        if (!isAdminRole(role)) {
            return;
        }
        if (userId != null && adminRoleService.hasPermission(userId, permission)) {
            return;
        }
        throw new IllegalStateException("Forbidden");
    }

    private void assertCanAccessSession(Long sessionId, Long userId, String role) {
        if (sessionId == null) {
            throw new IllegalArgumentException("Support session is required");
        }
        SupportSession session = supportService.getSession(sessionId);
        if (session == null) {
            throw new IllegalArgumentException("Support session not found");
        }
        if (!isAdminRole(role)) {
            if (userId == null || !userId.equals(session.getUserId()) || !supportService.isDefaultUserSession(session)) {
                throw new IllegalStateException("Forbidden");
            }
        }
    }

    private void broadcastSession(SupportSession session) {
        if (session == null) {
            return;
        }
        broadcast("SESSION_UPDATED", null, session, session.getUserId());
    }

    private void broadcast(String type, SupportMessage message, SupportSession session, Long userId) {
        List<WebSocketSession> sockets = snapshotUserSessions(userId);
        if (!sockets.isEmpty()) {
            Map<String, Object> customerPayload = customerPayload(type, message, session);
            for (WebSocketSession socket : sockets) {
                sendJsonQuietly(socket, customerPayload);
            }
        }
        Map<String, Object> adminPayload = adminPayload(type, message, session);
        for (WebSocketSession adminSocket : snapshotAdminSessions()) {
            sendJsonQuietly(adminSocket, adminPayload);
        }
    }

    private List<WebSocketSession> snapshotUserSessions(Long userId) {
        if (userId == null) {
            return List.of();
        }
        synchronized (sessionRegistryLock) {
            Set<WebSocketSession> sockets = userSessions.get(userId);
            return sockets == null || sockets.isEmpty() ? List.of() : List.copyOf(sockets);
        }
    }

    private List<WebSocketSession> snapshotAdminSessions() {
        synchronized (sessionRegistryLock) {
            return adminSessions.isEmpty() ? List.of() : List.copyOf(adminSessions);
        }
    }

    private Map<String, Object> customerPayload(String type, SupportMessage message, SupportSession session) {
        if (message == null) {
            return Map.of("type", type, "session", SupportSessionCustomerResponse.from(session));
        }
        return Map.of(
                "type", type,
                "message", SupportMessageCustomerResponse.from(message),
                "session", SupportSessionCustomerResponse.from(session)
        );
    }

    private Map<String, Object> adminPayload(String type, SupportMessage message, SupportSession session) {
        if (message == null) {
            return Map.of("type", type, "session", SupportAdminSessionResponse.from(session));
        }
        return Map.of(
                "type", type,
                "message", SupportMessageAdminResponse.from(message),
                "session", SupportAdminSessionResponse.from(session)
        );
    }

    private String normalizeContent(String content) {
        String normalized = content == null ? "" : content.trim();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException("Message content is required");
        }
        if (normalized.length() > runtimeConfig.getInt("support.websocket.max-message-chars", 1000)) {
            throw new IllegalArgumentException("Message is too long");
        }
        return normalized;
    }

    private void sendError(WebSocketSession socket, String message) throws IOException {
        sendJson(socket, Map.of("type", "ERROR", "message", message));
    }

    private void sendJsonQuietly(WebSocketSession socket, Object payload) {
        if (closeIfTokenRevoked(socket)) {
            return;
        }
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
        if (session == null) {
            return;
        }
        synchronized (sessionRegistryLock) {
            Object userIdValue = session.getAttributes().get("userId");
            Object roleValue = session.getAttributes().get("role");
            if (roleValue != null && isAdminRole(String.valueOf(roleValue))) {
                adminSessions.remove(session);
            }
            if (userIdValue instanceof Long) {
                Set<WebSocketSession> sockets = userSessions.get((Long) userIdValue);
                if (sockets != null) {
                    sockets.remove(session);
                    if (sockets.isEmpty()) {
                        userSessions.remove((Long) userIdValue, sockets);
                    }
                }
            }
        }
    }

    private void pruneClosedSessions() {
        adminSessions.removeIf(socket -> socket == null || !socket.isOpen());
        userSessions.forEach((userId, sockets) -> {
            sockets.removeIf(socket -> socket == null || !socket.isOpen());
            if (sockets.isEmpty()) {
                userSessions.remove(userId, sockets);
            }
        });
    }

    private int activeConnectionCount() {
        int total = activeConnectionCount(adminSessions);
        for (Set<WebSocketSession> sockets : userSessions.values()) {
            total += activeConnectionCount(sockets);
        }
        return total;
    }

    private int activeConnectionCount(Set<WebSocketSession> sockets) {
        if (sockets == null || sockets.isEmpty()) {
            return 0;
        }
        int count = 0;
        for (WebSocketSession socket : sockets) {
            if (socket != null && socket.isOpen()) {
                count++;
            }
        }
        return count;
    }

    private void markSessionActivity(WebSocketSession socket) {
        if (socket != null) {
            socket.getAttributes().put(LAST_ACTIVITY_AT_ATTRIBUTE, System.currentTimeMillis());
        }
    }

    private boolean shouldRemoveIdleSocket(WebSocketSession socket, long now, long maxIdleMs) {
        if (socket == null || !socket.isOpen()) {
            return true;
        }
        if (isSessionTokenRevoked(socket)) {
            closeSocketQuietly(socket, TOKEN_REVOKED);
            return true;
        }
        Long lastActivityAt = toLong(socket.getAttributes().get(LAST_ACTIVITY_AT_ATTRIBUTE));
        if (lastActivityAt == null) {
            markSessionActivity(socket);
            return false;
        }
        if (now - lastActivityAt <= maxIdleMs) {
            return false;
        }
        closeSocketQuietly(socket, IDLE_TIMEOUT);
        return true;
    }

    private Long requireAuthenticatedSocketUserId(WebSocketSession socket) {
        Long userId = socket == null ? null : toLong(socket.getAttributes().get("userId"));
        if (userId == null) {
            throw new IllegalStateException("Unauthorized");
        }
        return userId;
    }

    private String socketRole(WebSocketSession socket) {
        if (socket == null) {
            return "USER";
        }
        Object roleValue = socket.getAttributes().get("role");
        String role = roleValue == null ? "" : String.valueOf(roleValue).trim();
        return role.isBlank() ? "USER" : role.toUpperCase();
    }

    private boolean closeIfTokenRevoked(WebSocketSession socket) {
        if (!isSessionTokenRevoked(socket)) {
            return false;
        }
        removeSession(socket);
        closeSocketQuietly(socket, TOKEN_REVOKED);
        return true;
    }

    private boolean isSessionTokenRevoked(WebSocketSession socket) {
        if (socket == null) {
            return false;
        }
        Object tokenJti = socket.getAttributes().get("tokenJti");
        return tokenJti != null && isTokenBlacklisted(String.valueOf(tokenJti));
    }

    private boolean isTokenBlacklisted(String tokenJti) {
        return tokenJti != null
                && !tokenJti.isBlank()
                && tokenBlacklistService.isAccessTokenBlacklisted(tokenJti);
    }

    private void closeSocketQuietly(WebSocketSession socket, CloseStatus status) {
        try {
            if (socket != null && socket.isOpen()) {
                socket.close(status);
            }
        } catch (IOException ex) {
            log.debug("Support WebSocket close failed", ex);
            // The session has already been removed from local registries or the idle scan.
        }
    }

    private int activeConnectionCountForUser(Long userId) {
        if (userId == null) {
            return 0;
        }
        int count = activeConnectionCount(userSessions.get(userId));
        for (WebSocketSession adminSocket : adminSessions) {
            if (adminSocket != null
                    && adminSocket.isOpen()
                    && Objects.equals(userId, adminSocket.getAttributes().get("userId"))) {
                count++;
            }
        }
        return count;
    }

    private int maxGlobalConnections() {
        return Math.max(1, runtimeConfig.getInt("support.websocket.max-connections", 500));
    }

    private int maxConnectionsPerUser() {
        return Math.max(1, runtimeConfig.getInt("support.websocket.max-connections-per-user", 5));
    }

    private int maxTextMessageBytes() {
        return Math.max(1024, runtimeConfig.getInt("support.websocket.max-text-message-bytes", 16384));
    }

    private int maxBinaryMessageBytes() {
        return Math.max(1024, runtimeConfig.getInt("support.websocket.max-binary-message-bytes", 8192));
    }

    private long maxIdleMs() {
        return Math.max(30000, runtimeConfig.getInt("support.websocket.max-idle-ms", 300000));
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

    private boolean isAdminRole(String role) {
        return "ADMIN".equalsIgnoreCase(role) || "SUPER_ADMIN".equalsIgnoreCase(role);
    }

    private String supportAdminRole(User user) {
        String role = user.getRole() == null ? "USER" : user.getRole().trim().toUpperCase();
        if (!isAdminRole(role)) {
            return "USER";
        }
        return adminRoleService.canAccess(user.getId(), "/admin/support") ? role : "USER";
    }
}
