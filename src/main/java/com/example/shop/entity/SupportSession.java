package com.example.shop.entity;

import lombok.Data;

import javax.validation.constraints.Min;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;
import java.io.Serializable;
import java.time.LocalDateTime;

@Data
public class SupportSession implements Serializable {
    private static final long serialVersionUID = 1L;

    private Long id;
    private Long userId;
    private Long assignedAdminId;
    @Size(max = 160)
    private String contextKey;
    @NotBlank
    @Size(max = 20)
    private String status;
    @Size(max = 1000)
    private String lastMessage;
    private LocalDateTime lastMessageAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @Size(max = 120)
    private String username;
    @Size(max = 120)
    private String assignedAdminName;
    @Min(0)
    private Integer unreadByUser;
    @Min(0)
    private Integer unreadByAdmin;
}
