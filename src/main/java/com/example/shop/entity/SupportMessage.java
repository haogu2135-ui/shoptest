package com.example.shop.entity;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;
import java.io.Serializable;
import java.time.LocalDateTime;

@Data
public class SupportMessage implements Serializable {
    private static final long serialVersionUID = 1L;

    private Long id;
    @NotNull
    private Long sessionId;
    private Long senderId;
    @NotBlank
    @Size(max = 20)
    private String senderRole;
    @NotBlank
    @Size(max = 4000)
    private String content;
    private Boolean isReadByUser;
    private Boolean isReadByAdmin;
    private LocalDateTime createdAt;

    @Size(max = 120)
    private String senderName;
}
