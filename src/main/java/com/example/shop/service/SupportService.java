package com.example.shop.service;

import com.example.shop.entity.SupportMessage;
import com.example.shop.entity.SupportSession;
import com.example.shop.repository.SupportMessageMapper;
import com.example.shop.repository.SupportSessionMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class SupportService {
    private final SupportSessionMapper supportSessionMapper;
    private final SupportMessageMapper supportMessageMapper;

    @Value("${support.message.max-chars:${support.websocket.max-message-chars:1000}}")
    private int maxMessageChars;

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
        String normalized = content == null ? "" : content.trim();
        int maxChars = maxMessageChars > 0 ? maxMessageChars : 1000;
        if (normalized.length() > maxChars) {
            throw new IllegalArgumentException("Message is too long");
        }
        return normalized;
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
}
