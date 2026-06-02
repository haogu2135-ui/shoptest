package com.example.shop.entity;

import lombok.Data;

import javax.validation.constraints.Min;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;
import java.time.LocalDateTime;

@Data
public class IpBlacklistEntry {
    private Long id;
    @NotBlank
    @Size(max = 64)
    private String ipAddress;
    @NotBlank
    @Size(max = 20)
    private String status;
    @Size(max = 80)
    private String source;
    @Size(max = 500)
    private String reason;
    @Min(0)
    private int failureCount;
    private LocalDateTime firstSeenAt;
    private LocalDateTime lastSeenAt;
    private LocalDateTime blockedAt;
    private LocalDateTime blockedUntil;
    private LocalDateTime releasedAt;
    @Size(max = 120)
    private String releasedBy;
    @Size(max = 120)
    private String createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private boolean legacyOnly;
}
