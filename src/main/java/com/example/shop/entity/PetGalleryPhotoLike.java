package com.example.shop.entity;

import lombok.Data;

import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(
    name = "pet_gallery_photo_likes",
    indexes = {
        @Index(name = "idx_pet_gallery_like_photo", columnList = "photo_id"),
        @Index(name = "idx_pet_gallery_like_user", columnList = "user_id"),
        @Index(name = "idx_pet_gallery_like_ip", columnList = "ip_address")
    }
)
public class PetGalleryPhotoLike {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "photo_id", nullable = false)
    private Long photoId;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "ip_address", nullable = false, length = 45)
    private String ipAddress;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
