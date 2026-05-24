package com.example.shop.entity;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class IpBlacklistEntry {
    private Long id;
    private String ipAddress;
    private String status;
    private String source;
    private String reason;
    private int failureCount;
    private LocalDateTime firstSeenAt;
    private LocalDateTime lastSeenAt;
    private LocalDateTime blockedAt;
    private LocalDateTime blockedUntil;
    private LocalDateTime releasedAt;
    private String releasedBy;
    private String createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
