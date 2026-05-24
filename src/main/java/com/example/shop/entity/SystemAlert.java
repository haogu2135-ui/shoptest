package com.example.shop.entity;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class SystemAlert {
    private Long id;
    private String severity;
    private String status;
    private String source;
    private String category;
    private String title;
    private String message;
    private String fingerprint;
    private String metadata;
    private int occurrenceCount;
    private LocalDateTime firstSeenAt;
    private LocalDateTime lastSeenAt;
    private LocalDateTime acknowledgedAt;
    private String acknowledgedBy;
    private LocalDateTime resolvedAt;
    private String resolvedBy;
}
