package com.example.shop.dto;

import com.example.shop.entity.SiteAnnouncement;

public class SiteAnnouncementPublicResponse {
    private Long id;
    private String title;
    private String content;
    private String linkUrl;

    public static SiteAnnouncementPublicResponse from(SiteAnnouncement announcement, String safeLinkUrl) {
        if (announcement == null) {
            return null;
        }
        SiteAnnouncementPublicResponse response = new SiteAnnouncementPublicResponse();
        response.setId(announcement.getId());
        response.setTitle(announcement.getTitle());
        response.setContent(announcement.getContent());
        response.setLinkUrl(safeLinkUrl);
        return response;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getLinkUrl() {
        return linkUrl;
    }

    public void setLinkUrl(String linkUrl) {
        this.linkUrl = linkUrl;
    }
}
