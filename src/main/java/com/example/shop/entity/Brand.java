package com.example.shop.entity;

import lombok.Data;

import javax.persistence.*;
import javax.validation.constraints.Min;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;
import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "brands")
public class Brand implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 100)
    @NotBlank
    @Size(max = 100)
    private String name;

    @Column(columnDefinition = "TEXT")
    @Size(max = 2000)
    private String description;

    @Column(name = "logo_url", columnDefinition = "TEXT")
    @Size(max = 2000)
    private String logoUrl;

    @Column(name = "website_url", columnDefinition = "TEXT")
    @Size(max = 2000)
    private String websiteUrl;

    @Column(nullable = false, length = 20)
    @NotBlank
    @Size(max = 20)
    private String status = "ACTIVE";

    @Column(name = "sort_order")
    @Min(0)
    private Integer sortOrder = 0;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null || status.isEmpty()) {
            status = "ACTIVE";
        }
        if (sortOrder == null) {
            sortOrder = 0;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
