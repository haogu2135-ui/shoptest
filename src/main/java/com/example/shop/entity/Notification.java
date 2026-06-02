package com.example.shop.entity;

import javax.persistence.*;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;
import lombok.Data;
import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "notifications")
public class Notification implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id")
    @NotNull
    private Long userId;

    @Column(name = "type")
    @NotBlank
    @Size(max = 40)
    private String type;

    @Column(name = "title")
    @NotBlank
    @Size(max = 160)
    private String title;

    @Column(name = "message")
    @Size(max = 4000)
    private String message;

    @Column(name = "content_format")
    @NotBlank
    @Size(max = 20)
    private String contentFormat = "TEXT";

    @Column(name = "is_read")
    private Boolean isRead;

    @Column(name = "created_at")
    private LocalDateTime createdAt;
}
