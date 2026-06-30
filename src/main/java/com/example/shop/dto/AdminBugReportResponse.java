package com.example.shop.dto;

import com.example.shop.entity.AdminBugReport;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class AdminBugReportResponse {
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
    private String reporterName;
    private String assignedTo;
    private String scanNote;
    private String fixSummary;
    private String regressionNote;
    private LocalDateTime lastScannedAt;
    private LocalDateTime fixedAt;
    private LocalDateTime regressionAt;
    private LocalDateTime closedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static AdminBugReportResponse from(AdminBugReport bug) {
        AdminBugReportResponse response = new AdminBugReportResponse();
        if (bug == null) {
            return response;
        }
        response.setId(bug.getId());
        response.setTitle(bug.getTitle());
        response.setDescription(bug.getDescription());
        response.setModule(bug.getModule());
        response.setSeverity(bug.getSeverity());
        response.setPriority(bug.getPriority());
        response.setStatus(bug.getStatus());
        response.setPageUrl(bug.getPageUrl());
        response.setEnvironment(bug.getEnvironment());
        response.setReproductionSteps(bug.getReproductionSteps());
        response.setExpectedResult(bug.getExpectedResult());
        response.setActualResult(bug.getActualResult());
        response.setAttachmentUrls(bug.getAttachmentUrls());
        response.setReporterName(bug.getReporterName());
        response.setAssignedTo(bug.getAssignedTo());
        response.setScanNote(bug.getScanNote());
        response.setFixSummary(bug.getFixSummary());
        response.setRegressionNote(bug.getRegressionNote());
        response.setLastScannedAt(bug.getLastScannedAt());
        response.setFixedAt(bug.getFixedAt());
        response.setRegressionAt(bug.getRegressionAt());
        response.setClosedAt(bug.getClosedAt());
        response.setCreatedAt(bug.getCreatedAt());
        response.setUpdatedAt(bug.getUpdatedAt());
        return response;
    }
}
