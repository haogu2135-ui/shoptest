package com.example.shop.controller;

import com.example.shop.dto.NotificationResponse;
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
import java.util.stream.Collectors;

@RestController
@RequestMapping("/notifications")
@RequiredArgsConstructor
public class NotificationController {
    private final NotificationService notificationService;

    @GetMapping
    public List<NotificationResponse> getNotifications(@RequestParam Long userId,
                                                       @RequestParam(required = false) Integer page,
                                                       @RequestParam(required = false) Integer size,
                                                       Authentication authentication) {
        SecurityUtils.assertSelf(authentication, userId);
        return toResponses(notificationService.getNotifications(userId, page, size));
    }

    @GetMapping("/me")
    public List<NotificationResponse> getMyNotifications(@RequestParam(required = false) Integer page,
                                                         @RequestParam(required = false) Integer size,
                                                         Authentication authentication) {
        return toResponses(notificationService.getNotifications(SecurityUtils.requireUser(authentication).getId(), page, size));
    }

    @GetMapping("/unread-count")
    public Map<String, Integer> getUnreadCount(@RequestParam Long userId, Authentication authentication) {
        SecurityUtils.assertSelf(authentication, userId);
        return Map.of("count", notificationService.getUnreadCount(userId));
    }

    @GetMapping("/me/unread-count")
    public Map<String, Integer> getMyUnreadCount(Authentication authentication) {
        return Map.of("count", notificationService.getUnreadCount(SecurityUtils.requireUser(authentication).getId()));
    }

    @PutMapping("/{id}/read")
    public ResponseEntity<Map<String, String>> markAsRead(@PathVariable Long id, Authentication authentication) {
        Notification notification = notificationService.getNotification(id);
        if (notification == null) {
            return ResponseEntity.notFound().build();
        }
        SecurityUtils.assertSelf(authentication, notification.getUserId());
        notificationService.markAsRead(id);
        return ResponseEntity.ok(Map.of("message", "Read"));
    }

    @PutMapping("/read-all")
    public Map<String, String> markAllAsRead(@RequestParam Long userId, Authentication authentication) {
        SecurityUtils.assertSelf(authentication, userId);
        notificationService.markAllAsRead(userId);
        return Map.of("message", "All read");
    }

    @PutMapping("/me/read-all")
    public Map<String, String> markAllMineAsRead(Authentication authentication) {
        notificationService.markAllAsRead(SecurityUtils.requireUser(authentication).getId());
        return Map.of("message", "All read");
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> deleteNotification(@PathVariable Long id, Authentication authentication) {
        Notification notification = notificationService.getNotification(id);
        if (notification == null) {
            return ResponseEntity.notFound().build();
        }
        SecurityUtils.assertSelf(authentication, notification.getUserId());
        notificationService.deleteNotification(id);
        return ResponseEntity.ok(Map.of("message", "Deleted"));
    }

    private List<NotificationResponse> toResponses(List<Notification> notifications) {
        return notifications.stream()
                .map(NotificationResponse::from)
                .collect(Collectors.toList());
    }
}
