package com.example.shop.service;

import com.example.shop.entity.Notification;
import com.example.shop.entity.User;
import com.example.shop.repository.NotificationMapper;
import com.example.shop.repository.UserMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import lombok.RequiredArgsConstructor;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class NotificationService {
    private final NotificationMapper notificationMapper;
    private final UserMapper userMapper;

    public List<Notification> getNotifications(Long userId) {
        return notificationMapper.findByUserId(userId);
    }

    public Notification getNotification(Long id) {
        return notificationMapper.findById(id);
    }

    public int getUnreadCount(Long userId) {
        return notificationMapper.countUnread(userId);
    }

    @Transactional
    public void createNotification(Long userId, String type, String title, String message) {
        Notification n = new Notification();
        n.setUserId(userId);
        n.setType(normalizeType(type));
        n.setTitle(title);
        n.setMessage(message);
        n.setContentFormat("TEXT");
        n.setIsRead(false);
        n.setCreatedAt(LocalDateTime.now());
        notificationMapper.insert(n);
    }

    @Transactional
    public int broadcastToCustomers(String type, String title, String message, String contentFormat) {
        if (title == null || title.trim().isEmpty()) {
            throw new IllegalArgumentException("Title is required");
        }
        if (message == null || message.trim().isEmpty()) {
            throw new IllegalArgumentException("Message is required");
        }
        String normalizedFormat = normalizeFormat(contentFormat);
        LocalDateTime now = LocalDateTime.now();
        List<Notification> notifications = userMapper.findAll().stream()
                .filter(user -> "USER".equals(user.getRole()))
                .filter(user -> user.getStatus() == null || "ACTIVE".equals(user.getStatus()))
                .map(user -> {
                    Notification n = new Notification();
                    n.setUserId(user.getId());
                    n.setType(normalizeType(type));
                    n.setTitle(title.trim());
                    n.setMessage(message.trim());
                    n.setContentFormat(normalizedFormat);
                    n.setIsRead(false);
                    n.setCreatedAt(now);
                    return n;
                })
                .collect(Collectors.toList());
        if (notifications.isEmpty()) {
            return 0;
        }
        return notificationMapper.insertBatch(notifications);
    }

    @Transactional
    public void markAsRead(Long id) {
        notificationMapper.markAsRead(id);
    }

    @Transactional
    public void markAllAsRead(Long userId) {
        notificationMapper.markAllAsRead(userId);
    }

    @Transactional
    public void deleteNotification(Long id) {
        notificationMapper.deleteById(id);
    }

    private String normalizeType(String type) {
        String normalized = type == null || type.trim().isEmpty()
                ? "SYSTEM"
                : type.trim().toUpperCase(Locale.ROOT);
        return "PROMOTION".equals(normalized) || "ORDER".equals(normalized) || "DELIVERY".equals(normalized)
                ? normalized
                : "SYSTEM";
    }

    private String normalizeFormat(String contentFormat) {
        String normalized = contentFormat == null || contentFormat.trim().isEmpty()
                ? "TEXT"
                : contentFormat.trim().toUpperCase(Locale.ROOT);
        return "HTML".equals(normalized) ? "HTML" : "TEXT";
    }
}
