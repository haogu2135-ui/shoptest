package com.example.shop.dto;

import lombok.Data;

@Data
public class AdminBugReportRequest {
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
    private String assignedTo;
    private String scanNote;
    private String fixSummary;
    private String regressionNote;
}
