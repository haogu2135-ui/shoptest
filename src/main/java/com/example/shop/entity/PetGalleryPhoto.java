package com.example.shop.entity;

import lombok.Data;

import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "pet_gallery_photos")
public class PetGalleryPhoto {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id")
    private Long userId;

    @Column(nullable = false, length = 80)
    private String username;

    @Column(name = "image_url", nullable = false, length = 500)
    private String imageUrl;

    @Column(name = "original_filename", length = 255)
    private String originalFilename;

    @Column(name = "content_type", nullable = false, length = 100)
    private String contentType;

    @Column(name = "file_size", nullable = false)
    private Long fileSize;

    @Column(name = "ip_address", nullable = false, length = 45)
    private String ipAddress;

    @Column(nullable = false, length = 20)
    private String status = "ACTIVE";

    @Column(nullable = false, length = 20)
    private String source = "USER_UPLOAD";

    @Column(name = "like_count", nullable = false)
    private Integer likeCount = 0;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Transient
    private Boolean likedByMe = false;

    @Transient
    private Boolean canDelete = false;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (status == null || status.trim().isEmpty()) {
            status = "ACTIVE";
        }
        if (source == null || source.trim().isEmpty()) {
            source = "USER_UPLOAD";
        }
        if (likeCount == null) {
            likeCount = 0;
        }
    }
}
