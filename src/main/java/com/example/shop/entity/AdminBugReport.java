package com.example.shop.entity;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class AdminBugReport {
    private Long id;
    private String title;
    private String description;
    private String module;
    private String severity;
    private String priority;
    private String status;
    private String pageUrl;
    private String environment;
    private String reproductionSteps;
    private String expectedResult;
    private String actualResult;
    private String attachmentUrls;
    private Long reporterId;
    private String reporterName;
    private String assignedTo;
    private String scanNote;
    private String fixSummary;
    private String regressionNote;
    private LocalDateTime lastScannedAt;
    private LocalDateTime fixedAt;
    private String fixedBy;
    private LocalDateTime regressionAt;
    private String regressionBy;
    private LocalDateTime closedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
