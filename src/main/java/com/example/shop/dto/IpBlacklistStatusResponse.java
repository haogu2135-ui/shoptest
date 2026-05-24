package com.example.shop.dto;

public class IpBlacklistStatusResponse {
    private boolean enabled;
    private int loginFailureThreshold;
    private int paymentFailureThreshold;
    private int windowMinutes;
    private int blockMinutes;
    private long blockedCount;
    private long monitoringCount;

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public int getLoginFailureThreshold() {
        return loginFailureThreshold;
    }

    public void setLoginFailureThreshold(int loginFailureThreshold) {
        this.loginFailureThreshold = loginFailureThreshold;
    }

    public int getPaymentFailureThreshold() {
        return paymentFailureThreshold;
    }

    public void setPaymentFailureThreshold(int paymentFailureThreshold) {
        this.paymentFailureThreshold = paymentFailureThreshold;
    }

    public int getWindowMinutes() {
        return windowMinutes;
    }

    public void setWindowMinutes(int windowMinutes) {
        this.windowMinutes = windowMinutes;
    }

    public int getBlockMinutes() {
        return blockMinutes;
    }

    public void setBlockMinutes(int blockMinutes) {
        this.blockMinutes = blockMinutes;
    }

    public long getBlockedCount() {
        return blockedCount;
    }

    public void setBlockedCount(long blockedCount) {
        this.blockedCount = blockedCount;
    }

    public long getMonitoringCount() {
        return monitoringCount;
    }

    public void setMonitoringCount(long monitoringCount) {
        this.monitoringCount = monitoringCount;
    }
}
