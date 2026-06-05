package com.example.shop.dto;

import com.example.shop.entity.SupportSession;

import java.time.LocalDateTime;

public class SupportAdminSessionResponse {
    private Long id;
    private Long userId;
    private Long assignedAdminId;
    private String status;
    private String lastMessage;
    private LocalDateTime lastMessageAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String username;
    private String assignedAdminName;
    private Integer unreadByUser;
    private Integer unreadByAdmin;

    public static SupportAdminSessionResponse from(SupportSession session) {
        if (session == null) {
            return null;
        }
        SupportAdminSessionResponse response = new SupportAdminSessionResponse();
        response.setId(session.getId());
        response.setUserId(session.getUserId());
        response.setAssignedAdminId(session.getAssignedAdminId());
        response.setStatus(session.getStatus());
        response.setLastMessage(session.getLastMessage());
        response.setLastMessageAt(session.getLastMessageAt());
        response.setCreatedAt(session.getCreatedAt());
        response.setUpdatedAt(session.getUpdatedAt());
        response.setUsername(session.getUsername());
        response.setAssignedAdminName(session.getAssignedAdminName());
        response.setUnreadByUser(session.getUnreadByUser());
        response.setUnreadByAdmin(session.getUnreadByAdmin());
        return response;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public Long getAssignedAdminId() {
        return assignedAdminId;
    }

    public void setAssignedAdminId(Long assignedAdminId) {
        this.assignedAdminId = assignedAdminId;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getLastMessage() {
        return lastMessage;
    }

    public void setLastMessage(String lastMessage) {
        this.lastMessage = lastMessage;
    }

    public LocalDateTime getLastMessageAt() {
        return lastMessageAt;
    }

    public void setLastMessageAt(LocalDateTime lastMessageAt) {
        this.lastMessageAt = lastMessageAt;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getAssignedAdminName() {
        return assignedAdminName;
    }

    public void setAssignedAdminName(String assignedAdminName) {
        this.assignedAdminName = assignedAdminName;
    }

    public Integer getUnreadByUser() {
        return unreadByUser;
    }

    public void setUnreadByUser(Integer unreadByUser) {
        this.unreadByUser = unreadByUser;
    }

    public Integer getUnreadByAdmin() {
        return unreadByAdmin;
    }

    public void setUnreadByAdmin(Integer unreadByAdmin) {
        this.unreadByAdmin = unreadByAdmin;
    }
}
