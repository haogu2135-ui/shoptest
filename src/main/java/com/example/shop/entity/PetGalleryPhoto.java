package com.example.shop.entity;

import lombok.Data;

import javax.persistence.*;
import javax.validation.constraints.Min;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;
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
    @NotBlank
    @Size(max = 80)
    private String username;

    @Column(name = "image_url", nullable = false, length = 500)
    @NotBlank
    @Size(max = 500)
    private String imageUrl;

    @Column(name = "original_filename", length = 255)
    @Size(max = 255)
    private String originalFilename;

    @Column(name = "content_type", nullable = false, length = 100)
    @NotBlank
    @Size(max = 100)
    private String contentType;

    @Column(name = "file_size", nullable = false)
    @NotNull
    @Min(0)
    private Long fileSize;

    @Column(name = "ip_address", nullable = false, length = 45)
    @NotBlank
    @Size(max = 45)
    private String ipAddress;

    @Column(nullable = false, length = 20)
    @NotBlank
    @Size(max = 20)
    private String status = "ACTIVE";

    @Column(nullable = false, length = 20)
    @NotBlank
    @Size(max = 20)
    private String source = "USER_UPLOAD";

    @Column(name = "like_count", nullable = false)
    @Min(0)
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
