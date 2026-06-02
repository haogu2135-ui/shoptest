package com.example.shop.entity;

import lombok.Data;

import javax.persistence.*;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;
import java.time.LocalDateTime;

@Data
@Entity
@Table(
    name = "pet_gallery_photo_likes",
    indexes = {
        @Index(name = "idx_pet_gallery_like_photo", columnList = "photo_id"),
        @Index(name = "idx_pet_gallery_like_user", columnList = "user_id"),
        @Index(name = "idx_pet_gallery_like_ip", columnList = "ip_address"),
        @Index(name = "idx_pet_gallery_like_viewer", columnList = "viewer_key")
    },
    uniqueConstraints = {
        @UniqueConstraint(name = "uk_gallery_like_photo_user", columnNames = {"photo_id", "user_id"}),
        @UniqueConstraint(name = "uk_gallery_like_photo_viewer", columnNames = {"photo_id", "viewer_key"})
    }
)
public class PetGalleryPhotoLike {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "photo_id", nullable = false)
    @NotNull
    private Long photoId;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "ip_address", nullable = false, length = 45)
    @NotBlank
    @Size(max = 45)
    private String ipAddress;

    @Column(name = "viewer_key", nullable = false, length = 120)
    @NotBlank
    @Size(max = 120)
    private String viewerKey;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
