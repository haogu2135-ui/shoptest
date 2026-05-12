package com.example.shop.controller;

import com.example.shop.entity.Notification;
import com.example.shop.security.SecurityUtils;
import com.example.shop.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/notifications")
@RequiredArgsConstructor
public class NotificationController {
    private final NotificationService notificationService;

    @GetMapping
    public List<Notification> getNotifications(@RequestParam Long userId, Authentication authentication) {
        SecurityUtils.assertSelfOrAdmin(authentication, userId);
        return notificationService.getNotifications(userId);
    }

    @GetMapping("/unread-count")
    public Map<String, Integer> getUnreadCount(@RequestParam Long userId, Authentication authentication) {
        SecurityUtils.assertSelfOrAdmin(authentication, userId);
        return Map.of("count", notificationService.getUnreadCount(userId));
    }

    @PutMapping("/{id}/read")
    public ResponseEntity<Map<String, String>> markAsRead(@PathVariable Long id, Authentication authentication) {
        Notification notification = notificationService.getNotification(id);
        if (notification == null) {
            return ResponseEntity.notFound().build();
        }
        SecurityUtils.assertSelfOrAdmin(authentication, notification.getUserId());
        notificationService.markAsRead(id);
        return ResponseEntity.ok(Map.of("message", "Read"));
    }

    @PutMapping("/read-all")
    public Map<String, String> markAllAsRead(@RequestParam Long userId, Authentication authentication) {
        SecurityUtils.assertSelfOrAdmin(authentication, userId);
        notificationService.markAllAsRead(userId);
        return Map.of("message", "All read");
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> deleteNotification(@PathVariable Long id, Authentication authentication) {
        Notification notification = notificationService.getNotification(id);
        if (notification == null) {
            return ResponseEntity.notFound().build();
        }
        SecurityUtils.assertSelfOrAdmin(authentication, notification.getUserId());
        notificationService.deleteNotification(id);
        return ResponseEntity.ok(Map.of("message", "Deleted"));
    }
}
