package com.example.shop.entity;

import lombok.Data;

import javax.validation.constraints.Min;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;
import java.time.LocalDateTime;

@Data
public class SystemAlert {
    private Long id;
    @NotBlank
    @Size(max = 20)
    private String severity;
    @NotBlank
    @Size(max = 20)
    private String status;
    @Size(max = 80)
    private String source;
    @Size(max = 80)
    private String category;
    @NotBlank
    @Size(max = 160)
    private String title;
    @Size(max = 4000)
    private String message;
    @Size(max = 160)
    private String fingerprint;
    @Size(max = 4000)
    private String metadata;
    @Min(0)
    private int occurrenceCount;
    private LocalDateTime firstSeenAt;
    private LocalDateTime lastSeenAt;
    private LocalDateTime acknowledgedAt;
    @Size(max = 120)
    private String acknowledgedBy;
    private LocalDateTime resolvedAt;
    @Size(max = 120)
    private String resolvedBy;
}
