package com.example.shop.dto;

public class IpBlacklistRequest {
    private String ipAddress;
    private String reason;
    private Integer blockMinutes;

    public String getIpAddress() {
        return ipAddress;
    }

    public void setIpAddress(String ipAddress) {
        this.ipAddress = ipAddress;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public Integer getBlockMinutes() {
        return blockMinutes;
    }

    public void setBlockMinutes(Integer blockMinutes) {
        this.blockMinutes = blockMinutes;
    }
}
