package com.example.shop.entity;

import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

@Data
public class SupportSession implements Serializable {
    private static final long serialVersionUID = 1L;

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
}
