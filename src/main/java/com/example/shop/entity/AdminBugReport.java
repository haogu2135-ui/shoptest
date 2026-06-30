package com.example.shop.entity;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;
import java.time.LocalDateTime;

@Data
public class AdminBugReport {
    private Long id;
    private Long version;
    @NotBlank
    @Size(max = 160)
    private String title;
    @NotBlank
    @Size(max = 4000)
    private String description;
    @Size(max = 40)
    private String module;
    @Size(max = 20)
    private String severity;
    @Size(max = 20)
    private String priority;
    @Size(max = 40)
    private String status;
    @Size(max = 500)
    private String pageUrl;
    @Size(max = 120)
    private String environment;
    @Size(max = 4000)
    private String reproductionSteps;
    @Size(max = 4000)
    private String expectedResult;
    @Size(max = 4000)
    private String actualResult;
    @Size(max = 2000)
    private String attachmentUrls;
    private Long reporterId;
    @Size(max = 120)
    private String reporterName;
    @Size(max = 120)
    private String assignedTo;
    @Size(max = 2000)
    private String scanNote;
    @Size(max = 2000)
    private String fixSummary;
    @Size(max = 2000)
    private String regressionNote;
    private LocalDateTime lastScannedAt;
    private LocalDateTime fixedAt;
    @Size(max = 120)
    private String fixedBy;
    private LocalDateTime regressionAt;
    @Size(max = 120)
    private String regressionBy;
    private LocalDateTime closedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
