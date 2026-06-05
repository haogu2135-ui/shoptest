package com.example.shop.dto;

import lombok.Data;

@Data
public class AdminBugReportStatusRequest {
    private String status;
    private String note;
    private String assignedTo;
    private String scanNote;
    private String fixSummary;
    private String regressionNote;
}
