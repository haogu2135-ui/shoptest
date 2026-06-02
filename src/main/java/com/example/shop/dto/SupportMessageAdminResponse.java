package com.example.shop.dto;

import com.example.shop.entity.SupportMessage;

import java.time.LocalDateTime;

public class SupportMessageAdminResponse {
    private Long id;
    private Long sessionId;
    private String senderRole;
    private String senderName;
    private String content;
    private Boolean isReadByUser;
    private Boolean isReadByAdmin;
    private LocalDateTime createdAt;

    public static SupportMessageAdminResponse from(SupportMessage message) {
        if (message == null) {
            return null;
        }
        SupportMessageAdminResponse response = new SupportMessageAdminResponse();
        response.setId(message.getId());
        response.setSessionId(message.getSessionId());
        response.setSenderRole(message.getSenderRole());
        response.setSenderName(message.getSenderName());
        response.setContent(message.getContent());
        response.setIsReadByUser(Boolean.TRUE.equals(message.getIsReadByUser()));
        response.setIsReadByAdmin(Boolean.TRUE.equals(message.getIsReadByAdmin()));
        response.setCreatedAt(message.getCreatedAt());
        return response;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getSessionId() {
        return sessionId;
    }

    public void setSessionId(Long sessionId) {
        this.sessionId = sessionId;
    }

    public String getSenderRole() {
        return senderRole;
    }

    public void setSenderRole(String senderRole) {
        this.senderRole = senderRole;
    }

    public String getSenderName() {
        return senderName;
    }

    public void setSenderName(String senderName) {
        this.senderName = senderName;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public Boolean getIsReadByUser() {
        return isReadByUser;
    }

    public void setIsReadByUser(Boolean isReadByUser) {
        this.isReadByUser = isReadByUser;
    }

    public Boolean getIsReadByAdmin() {
        return isReadByAdmin;
    }

    public void setIsReadByAdmin(Boolean isReadByAdmin) {
        this.isReadByAdmin = isReadByAdmin;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
