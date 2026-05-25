package com.example.shop.dto;

public class UserAdminSummaryResponse {
    private long totalUsers;
    private long activeUsers;
    private long bannedUsers;
    private long adminUsers;
    private long customerUsers;
    private long missingEmailUsers;
    private long missingPhoneUsers;
    private long readyUsers;
    private int adminRatioPercent;
    private int healthScore;
    private String checkedAt;

    public long getTotalUsers() {
        return totalUsers;
    }

    public void setTotalUsers(long totalUsers) {
        this.totalUsers = totalUsers;
    }

    public long getActiveUsers() {
        return activeUsers;
    }

    public void setActiveUsers(long activeUsers) {
        this.activeUsers = activeUsers;
    }

    public long getBannedUsers() {
        return bannedUsers;
    }

    public void setBannedUsers(long bannedUsers) {
        this.bannedUsers = bannedUsers;
    }

    public long getAdminUsers() {
        return adminUsers;
    }

    public void setAdminUsers(long adminUsers) {
        this.adminUsers = adminUsers;
    }

    public long getCustomerUsers() {
        return customerUsers;
    }

    public void setCustomerUsers(long customerUsers) {
        this.customerUsers = customerUsers;
    }

    public long getMissingEmailUsers() {
        return missingEmailUsers;
    }

    public void setMissingEmailUsers(long missingEmailUsers) {
        this.missingEmailUsers = missingEmailUsers;
    }

    public long getMissingPhoneUsers() {
        return missingPhoneUsers;
    }

    public void setMissingPhoneUsers(long missingPhoneUsers) {
        this.missingPhoneUsers = missingPhoneUsers;
    }

    public long getReadyUsers() {
        return readyUsers;
    }

    public void setReadyUsers(long readyUsers) {
        this.readyUsers = readyUsers;
    }

    public int getAdminRatioPercent() {
        return adminRatioPercent;
    }

    public void setAdminRatioPercent(int adminRatioPercent) {
        this.adminRatioPercent = adminRatioPercent;
    }

    public int getHealthScore() {
        return healthScore;
    }

    public void setHealthScore(int healthScore) {
        this.healthScore = healthScore;
    }

    public String getCheckedAt() {
        return checkedAt;
    }

    public void setCheckedAt(String checkedAt) {
        this.checkedAt = checkedAt;
    }
}
