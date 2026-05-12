package com.example.shop.entity;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class SecurityAuditLog {
    private Long id;
    private String action;
    private String result;
    private Long actorUserId;
    private String actorUsername;
    private String actorRole;
    private String resourceType;
    private String resourceId;
    private String ipAddress;
    private String userAgent;
    private String message;
    private String metadata;
    private LocalDateTime createdAt;
}
