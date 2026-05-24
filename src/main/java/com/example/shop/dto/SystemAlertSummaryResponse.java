package com.example.shop.dto;

import java.util.Map;

public class SystemAlertSummaryResponse {
    private long openCount;
    private long acknowledgedCount;
    private long resolvedCount;
    private Map<String, Long> openBySeverity;
    private String checkedAt;

    public long getOpenCount() {
        return openCount;
    }

    public void setOpenCount(long openCount) {
        this.openCount = openCount;
    }

    public long getAcknowledgedCount() {
        return acknowledgedCount;
    }

    public void setAcknowledgedCount(long acknowledgedCount) {
        this.acknowledgedCount = acknowledgedCount;
    }

    public long getResolvedCount() {
        return resolvedCount;
    }

    public void setResolvedCount(long resolvedCount) {
        this.resolvedCount = resolvedCount;
    }

    public Map<String, Long> getOpenBySeverity() {
        return openBySeverity;
    }

    public void setOpenBySeverity(Map<String, Long> openBySeverity) {
        this.openBySeverity = openBySeverity;
    }

    public String getCheckedAt() {
        return checkedAt;
    }

    public void setCheckedAt(String checkedAt) {
        this.checkedAt = checkedAt;
    }
}
