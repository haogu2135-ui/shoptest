package com.example.shop.entity;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;
import java.time.LocalDateTime;

@Data
public class SecurityAuditLog {
    private Long id;
    @NotBlank
    @Size(max = 50)
    private String action;
    @NotBlank
    @Size(max = 20)
    private String result;
    private Long actorUserId;
    @Size(max = 120)
    private String actorUsername;
    @Size(max = 40)
    private String actorRole;
    @Size(max = 80)
    private String resourceType;
    @Size(max = 120)
    private String resourceId;
    @Size(max = 64)
    private String ipAddress;
    @Size(max = 500)
    private String userAgent;
    @Size(max = 1000)
    private String message;
    @Size(max = 2000)
    private String metadata;
    private LocalDateTime createdAt;
}
