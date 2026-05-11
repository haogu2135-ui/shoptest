package com.example.shop.entity;

import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

@Data
public class SupportMessage implements Serializable {
    private static final long serialVersionUID = 1L;

    private Long id;
    private Long sessionId;
    private Long senderId;
    private String senderRole;
    private String content;
    private Boolean isReadByUser;
    private Boolean isReadByAdmin;
    private LocalDateTime createdAt;

    private String senderName;
}
