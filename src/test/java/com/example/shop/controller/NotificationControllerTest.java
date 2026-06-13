package com.example.shop.controller;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class NotificationControllerTest {
    private static final Path SOURCE = Path.of("src/main/java/com/example/shop/controller/NotificationController.java");

    @Test
    void notificationControllerKeepsSelfScopedAndMeEndpointContracts() throws Exception {
        String source = Files.readString(SOURCE, StandardCharsets.UTF_8);

        assertTrue(source.contains("@RequestMapping(\"/notifications\")"));
        assertTrue(source.contains("SecurityUtils.assertSelf(authentication, userId);"));
        assertTrue(source.contains("SecurityUtils.requireUser(authentication).getId()"));
        assertTrue(source.contains("@GetMapping(\"/me\")"));
        assertTrue(source.contains("@GetMapping(\"/me/unread-count\")"));
        assertTrue(source.contains("@PutMapping(\"/me/read-all\")"));
        assertTrue(source.contains("notificationService.markAsRead(id);"));
        assertTrue(source.contains("notificationService.markAllAsRead(userId);"));
        assertTrue(source.contains("notificationService.deleteNotification(id);"));
        assertTrue(source.contains("NotificationResponse::from"));
    }
}
