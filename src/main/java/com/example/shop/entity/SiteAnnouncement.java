package com.example.shop.entity;

import lombok.Data;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.PrePersist;
import javax.persistence.PreUpdate;
import javax.persistence.Table;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "site_announcements")
public class SiteAnnouncement {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(name = "link_url", length = 500)
    private String linkUrl;

    @Column(nullable = false, length = 20)
    private String status = "ACTIVE";

    @Column(name = "sort_order")
    private Integer sortOrder = 0;

    @Column(name = "starts_at")
    private LocalDateTime startsAt;

    @Column(name = "ends_at")
    private LocalDateTime endsAt;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        normalizeDefaults();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
        normalizeDefaults();
    }

    private void normalizeDefaults() {
        if (status == null || status.trim().isEmpty()) {
            status = "ACTIVE";
        }
        status = status.trim().toUpperCase();
        if (sortOrder == null) {
            sortOrder = 0;
        }
    }
}
