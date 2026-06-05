package com.example.shop.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.Map;

@Data
public class AdminBugReportSummaryResponse {
    private long totalBugs;
    private long openCount;
    private long fixingCount;
    private long fixedPendingRegressionCount;
    private long regressionPassedCount;
    private long regressionFailedCount;
    private long closedCount;
    private long dueForScanCount;
    private int scanIntervalMinutes;
    private LocalDateTime nextScanAt;
    private LocalDateTime checkedAt;
    private Map<String, Long> byStatus;
    private Map<String, Long> bySeverity;
}
