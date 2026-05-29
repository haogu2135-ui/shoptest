package com.example.shop.service;

import com.example.shop.dto.SupportAdminSummaryResponse;
import com.example.shop.entity.SupportMessage;
import com.example.shop.entity.SupportSession;
import com.example.shop.repository.SupportMessageMapper;
import com.example.shop.repository.SupportSessionMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Service
@RequiredArgsConstructor
public class SupportService {
    private final SupportSessionMapper supportSessionMapper;
    private final SupportMessageMapper supportMessageMapper;
    private final RuntimeConfigService runtimeConfig;
    private final ConcurrentMap<String, RateBucket> messageRateBuckets = new ConcurrentHashMap<>();

    @Transactional
    public SupportSession getOrCreateOpenSession(Long userId) {
        SupportSession session = supportSessionMapper.findOpenByUserId(userId);
        if (session != null) {
            return session;
        }
        session = new SupportSession();
        session.setUserId(userId);
        session.setStatus("OPEN");
        session.setLastMessage("");
        session.setLastMessageAt(LocalDateTime.now());
        session.setCreatedAt(LocalDateTime.now());
        session.setUpdatedAt(LocalDateTime.now());
        supportSessionMapper.insert(session);
        return supportSessionMapper.findById(session.getId());
    }

    public SupportSession getLatestSession(Long userId) {
        SupportSession latest = supportSessionMapper.findLatestByUserId(userId);
        return latest != null ? latest : getOrCreateOpenSession(userId);
    }

    public SupportSession getSession(Long sessionId) {
        return supportSessionMapper.findById(sessionId);
    }

    public List<SupportSession> getUserSessions(Long userId) {
        return supportSessionMapper.findByUserId(userId);
    }

    public List<SupportSession> getAllSessions(String status) {
        return supportSessionMapper.findAll(status);
    }

    public SupportAdminSummaryResponse adminSummary(Long adminId) {
        int staleMinutes = Math.max(5, Math.min(runtimeConfig.getInt("support.admin.stale-minutes", 30), 24 * 60));
        Map<String, Object> row = supportSessionMapper.adminSummary(adminId, LocalDateTime.now().minusMinutes(staleMinutes));
        SupportAdminSummaryResponse response = new SupportAdminSummaryResponse();
        response.setTotalSessions(numberValue(row, "totalSessions"));
        response.setOpenSessions(numberValue(row, "openSessions"));
        response.setClosedSessions(numberValue(row, "closedSessions"));
        response.setUnreadSessions(numberValue(row, "unreadSessions"));
        response.setUnreadMessages(numberValue(row, "unreadMessages"));
        response.setUnassignedOpenSessions(numberValue(row, "unassignedOpenSessions"));
        response.setMyOpenSessions(numberValue(row, "myOpenSessions"));
        response.setStaleOpenSessions(numberValue(row, "staleOpenSessions"));
        response.setStaleMinutes(staleMinutes);
        response.setResponseScore(calculateResponseScore(response));
        response.setCheckedAt(Instant.now().toString());
        return response;
    }

    public List<SupportMessage> getMessages(Long sessionId) {
        return supportMessageMapper.findBySessionId(sessionId);
    }

    @Transactional
    public SupportMessage sendUserMessage(Long userId, Long sessionId, String content) {
        SupportSession session = null;
        if (sessionId != null) {
            session = supportSessionMapper.findById(sessionId);
            if (session == null) {
                throw new IllegalArgumentException("Support session not found");
            }
            if (!userId.equals(session.getUserId())) {
                throw new IllegalStateException("Forbidden");
            }
        }
        if (session == null || !"OPEN".equals(session.getStatus())) {
            session = getOrCreateOpenSession(userId);
        }
        return sendMessage(session.getId(), userId, "USER", content);
    }

    @Transactional
    public SupportMessage sendAdminMessage(Long adminId, Long sessionId, String content) {
        SupportSession session = supportSessionMapper.findById(sessionId);
        if (session == null) {
            throw new IllegalArgumentException("Support session not found");
        }
        if (session.getAssignedAdminId() == null) {
            supportSessionMapper.assignAdmin(sessionId, adminId);
        }
        return sendMessage(session.getId(), adminId, "ADMIN", content);
    }

    @Transactional
    public SupportMessage sendMessage(Long sessionId, Long senderId, String senderRole, String content) {
        String normalizedContent = normalizeContent(content);
        if (normalizedContent.isEmpty()) {
            throw new IllegalArgumentException("Message content is required");
        }
        SupportSession session = supportSessionMapper.findById(sessionId);
        if (session == null) {
            throw new IllegalArgumentException("Support session not found");
        }
        if (!"OPEN".equals(session.getStatus())) {
            throw new IllegalStateException("Support session is closed");
        }
        if ("ADMIN".equals(senderRole) && session.getAssignedAdminId() == null) {
            supportSessionMapper.assignAdmin(sessionId, senderId);
        }
        consumeMessageRate(senderId, senderRole);
        SupportMessage message = new SupportMessage();
        message.setSessionId(sessionId);
        message.setSenderId(senderId);
        message.setSenderRole(senderRole);
        message.setContent(normalizedContent);
        message.setIsReadByUser("USER".equals(senderRole));
        message.setIsReadByAdmin("ADMIN".equals(senderRole));
        message.setCreatedAt(LocalDateTime.now());
        supportMessageMapper.insert(message);
        supportSessionMapper.updateLastMessage(sessionId, message.getContent());
        return supportMessageMapper.findBySessionId(sessionId).stream()
                .filter(item -> message.getId().equals(item.getId()))
                .findFirst()
                .orElse(message);
    }

    private String normalizeContent(String content) {
        String normalized = String.valueOf(content == null ? "" : content)
                .replaceAll("[\\p{Cntrl}&&[^\r\n\t]]", " ")
                .trim()
                .replaceAll("\\s+", " ");
        int maxChars = runtimeConfig.getInt("support.message.max-chars",
                runtimeConfig.getInt("support.websocket.max-message-chars", 1000));
        maxChars = maxChars > 0 ? maxChars : 1000;
        if (normalized.length() > maxChars) {
            throw new IllegalArgumentException("Message is too long");
        }
        return normalized;
    }

    private void consumeMessageRate(Long senderId, String senderRole) {
        if (!runtimeConfig.getBoolean("support.message.rate-limit-enabled", true)) {
            return;
        }
        String normalizedRole = senderRole == null ? "USER" : senderRole.trim().toUpperCase();
        int defaultLimit = "ADMIN".equals(normalizedRole) ? 60 : 20;
        int maxPerMinute = runtimeConfig.getInt("support.message.max-per-minute", defaultLimit);
        if (maxPerMinute <= 0) {
            return;
        }
        long now = Instant.now().getEpochSecond();
        long windowStart = now - Math.floorMod(now, 60);
        String key = normalizedRole + ":" + senderId;
        RateBucket bucket = messageRateBuckets.compute(key, (ignored, current) -> {
            if (current == null || current.windowStart != windowStart) {
                return new RateBucket(windowStart, 1);
            }
            current.count++;
            return current;
        });
        if (bucket.count > maxPerMinute) {
            throw new IllegalStateException("Too many support messages. Please try again later.");
        }
        if (messageRateBuckets.size() > runtimeConfig.getInt("support.message.max-rate-buckets", 5000)) {
            messageRateBuckets.entrySet().removeIf(entry -> entry.getValue().windowStart < windowStart);
        }
    }

    @Transactional
    public SupportSession closeSession(Long sessionId) {
        SupportSession session = supportSessionMapper.findById(sessionId);
        if (session == null) {
            throw new IllegalArgumentException("Support session not found");
        }
        if (!"CLOSED".equals(session.getStatus())) {
            supportSessionMapper.close(sessionId);
        }
        return supportSessionMapper.findById(sessionId);
    }

    @Transactional
    public SupportSession assignSession(Long sessionId, Long adminId) {
        SupportSession session = supportSessionMapper.findById(sessionId);
        if (session == null) {
            throw new IllegalArgumentException("Support session not found");
        }
        supportSessionMapper.assignAdmin(sessionId, adminId);
        return supportSessionMapper.findById(sessionId);
    }

    @Transactional
    public SupportSession reopenSession(Long sessionId, Long adminId) {
        SupportSession session = supportSessionMapper.findById(sessionId);
        if (session == null) {
            throw new IllegalArgumentException("Support session not found");
        }
        if ("OPEN".equals(session.getStatus())) {
            return assignSession(sessionId, adminId);
        }
        supportSessionMapper.reopen(sessionId, adminId);
        return supportSessionMapper.findById(sessionId);
    }

    @Transactional
    public void markRead(Long sessionId, String role) {
        if ("ADMIN".equals(role)) {
            supportMessageMapper.markReadByAdmin(sessionId);
        } else {
            supportMessageMapper.markReadByUser(sessionId);
        }
    }

    public int countUnreadByAdmin() {
        return supportMessageMapper.countUnreadByAdmin();
    }

    public int countUnreadByUser(Long userId) {
        return supportMessageMapper.countUnreadByUser(userId);
    }

    private int calculateResponseScore(SupportAdminSummaryResponse summary) {
        long rawScore = 100
                - summary.getUnreadSessions() * 10
                - summary.getUnassignedOpenSessions() * 8
                - summary.getStaleOpenSessions() * 18;
        return (int) Math.max(0, Math.min(100, rawScore));
    }

    private long numberValue(Map<String, Object> row, String key) {
        if (row == null || row.isEmpty()) {
            return 0;
        }
        Object value = row.get(key);
        if (value == null) {
            String snake = camelToSnake(key);
            value = row.get(snake);
            if (value == null) {
                value = row.get(snake.toUpperCase());
            }
        }
        if (value == null) {
            value = row.get(key.toLowerCase());
        }
        if (value == null) {
            value = row.get(key.toUpperCase());
        }
        return value instanceof Number ? ((Number) value).longValue() : 0;
    }

    private String camelToSnake(String value) {
        return value.replaceAll("([a-z])([A-Z])", "$1_$2").toLowerCase();
    }

    private static class RateBucket {
        private final long windowStart;
        private int count;

        private RateBucket(long windowStart, int count) {
            this.windowStart = windowStart;
            this.count = count;
        }
    }
}
