package com.example.shop.dto;

import com.example.shop.entity.SupportSession;

import java.time.LocalDateTime;

public class SupportSessionCustomerResponse {
    private Long id;
    private String status;
    private String lastMessage;
    private LocalDateTime lastMessageAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String assignedAdminName;
    private Integer unreadByUser;

    public static SupportSessionCustomerResponse from(SupportSession session) {
        if (session == null) {
            return null;
        }
        SupportSessionCustomerResponse response = new SupportSessionCustomerResponse();
        response.setId(session.getId());
        response.setStatus(session.getStatus());
        response.setLastMessage(session.getLastMessage());
        response.setLastMessageAt(session.getLastMessageAt());
        response.setCreatedAt(session.getCreatedAt());
        response.setUpdatedAt(session.getUpdatedAt());
        response.setAssignedAdminName(session.getAssignedAdminName());
        response.setUnreadByUser(session.getUnreadByUser());
        return response;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
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
}
