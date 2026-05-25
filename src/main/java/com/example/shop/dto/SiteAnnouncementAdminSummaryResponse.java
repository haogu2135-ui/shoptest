package com.example.shop.dto;

import java.time.LocalDateTime;

public class SiteAnnouncementAdminSummaryResponse {
    private long totalAnnouncements;
    private long activeAnnouncements;
    private long scheduledAnnouncements;
    private long expiredAnnouncements;
    private long inactiveAnnouncements;
    private long linkedAnnouncements;
    private int maxActiveRows;
    private int titleMaxChars;
    private int contentMaxChars;
    private int linkUrlMaxChars;
    private LocalDateTime checkedAt;

    public long getTotalAnnouncements() {
        return totalAnnouncements;
    }

    public void setTotalAnnouncements(long totalAnnouncements) {
        this.totalAnnouncements = totalAnnouncements;
    }

    public long getActiveAnnouncements() {
        return activeAnnouncements;
    }

    public void setActiveAnnouncements(long activeAnnouncements) {
        this.activeAnnouncements = activeAnnouncements;
    }

    public long getScheduledAnnouncements() {
        return scheduledAnnouncements;
    }

    public void setScheduledAnnouncements(long scheduledAnnouncements) {
        this.scheduledAnnouncements = scheduledAnnouncements;
    }

    public long getExpiredAnnouncements() {
        return expiredAnnouncements;
    }

    public void setExpiredAnnouncements(long expiredAnnouncements) {
        this.expiredAnnouncements = expiredAnnouncements;
    }

    public long getInactiveAnnouncements() {
        return inactiveAnnouncements;
    }

    public void setInactiveAnnouncements(long inactiveAnnouncements) {
        this.inactiveAnnouncements = inactiveAnnouncements;
    }

    public long getLinkedAnnouncements() {
        return linkedAnnouncements;
    }

    public void setLinkedAnnouncements(long linkedAnnouncements) {
        this.linkedAnnouncements = linkedAnnouncements;
    }

    public int getMaxActiveRows() {
        return maxActiveRows;
    }

    public void setMaxActiveRows(int maxActiveRows) {
        this.maxActiveRows = maxActiveRows;
    }

    public int getTitleMaxChars() {
        return titleMaxChars;
    }

    public void setTitleMaxChars(int titleMaxChars) {
        this.titleMaxChars = titleMaxChars;
    }

    public int getContentMaxChars() {
        return contentMaxChars;
    }

    public void setContentMaxChars(int contentMaxChars) {
        this.contentMaxChars = contentMaxChars;
    }

    public int getLinkUrlMaxChars() {
        return linkUrlMaxChars;
    }

    public void setLinkUrlMaxChars(int linkUrlMaxChars) {
        this.linkUrlMaxChars = linkUrlMaxChars;
    }

    public LocalDateTime getCheckedAt() {
        return checkedAt;
    }

    public void setCheckedAt(LocalDateTime checkedAt) {
        this.checkedAt = checkedAt;
    }
}
