package com.example.shop.dto;

public class SecurityAuditPurgeResponse {
    private int retentionDays;
    private int deletedCount;
    private String purgedBefore;

    public int getRetentionDays() {
        return retentionDays;
    }

    public void setRetentionDays(int retentionDays) {
        this.retentionDays = retentionDays;
    }

    public int getDeletedCount() {
        return deletedCount;
    }

    public void setDeletedCount(int deletedCount) {
        this.deletedCount = deletedCount;
    }

    public String getPurgedBefore() {
        return purgedBefore;
    }

    public void setPurgedBefore(String purgedBefore) {
        this.purgedBefore = purgedBefore;
    }
}
