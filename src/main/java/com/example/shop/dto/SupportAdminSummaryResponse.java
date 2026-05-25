package com.example.shop.dto;

public class SupportAdminSummaryResponse {
    private long totalSessions;
    private long openSessions;
    private long closedSessions;
    private long unreadSessions;
    private long unreadMessages;
    private long unassignedOpenSessions;
    private long myOpenSessions;
    private long staleOpenSessions;
    private int staleMinutes;
    private int responseScore;
    private String checkedAt;

    public long getTotalSessions() {
        return totalSessions;
    }

    public void setTotalSessions(long totalSessions) {
        this.totalSessions = totalSessions;
    }

    public long getOpenSessions() {
        return openSessions;
    }

    public void setOpenSessions(long openSessions) {
        this.openSessions = openSessions;
    }

    public long getClosedSessions() {
        return closedSessions;
    }

    public void setClosedSessions(long closedSessions) {
        this.closedSessions = closedSessions;
    }

    public long getUnreadSessions() {
        return unreadSessions;
    }

    public void setUnreadSessions(long unreadSessions) {
        this.unreadSessions = unreadSessions;
    }

    public long getUnreadMessages() {
        return unreadMessages;
    }

    public void setUnreadMessages(long unreadMessages) {
        this.unreadMessages = unreadMessages;
    }

    public long getUnassignedOpenSessions() {
        return unassignedOpenSessions;
    }

    public void setUnassignedOpenSessions(long unassignedOpenSessions) {
        this.unassignedOpenSessions = unassignedOpenSessions;
    }

    public long getMyOpenSessions() {
        return myOpenSessions;
    }

    public void setMyOpenSessions(long myOpenSessions) {
        this.myOpenSessions = myOpenSessions;
    }

    public long getStaleOpenSessions() {
        return staleOpenSessions;
    }

    public void setStaleOpenSessions(long staleOpenSessions) {
        this.staleOpenSessions = staleOpenSessions;
    }

    public int getStaleMinutes() {
        return staleMinutes;
    }

    public void setStaleMinutes(int staleMinutes) {
        this.staleMinutes = staleMinutes;
    }

    public int getResponseScore() {
        return responseScore;
    }

    public void setResponseScore(int responseScore) {
        this.responseScore = responseScore;
    }

    public String getCheckedAt() {
        return checkedAt;
    }

    public void setCheckedAt(String checkedAt) {
        this.checkedAt = checkedAt;
    }
}
