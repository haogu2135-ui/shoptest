package com.example.shop.config;

import com.example.shop.service.PetGalleryService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.UUID;

@Configuration
@RequiredArgsConstructor
public class PetGallerySeedConfig {
    private static final Logger log = LoggerFactory.getLogger(PetGallerySeedConfig.class);
    private static final String SEED_OWNER_USERNAME = "pet_gallery_seed";
    private static final String SEED_OWNER_EMAIL = "pet-gallery-seed@local.invalid";

    private final PetGalleryService petGalleryService;
    private final JdbcTemplate jdbcTemplate;
    private final PasswordEncoder passwordEncoder;

    @Bean
    public ApplicationRunner seedPetGalleryPhotos() {
        return args -> {
            try {
                ensurePetGalleryColumns();
                ensurePetGalleryLikeColumns();
                backfillPetGalleryMetadata();
                backfillPetGalleryLikeViewerKeys();
                cleanupDuplicatePetGalleryLikes();
                reconcilePetGalleryLikeCounts();
                ensurePetGalleryLikeIndexes();
                Long seedOwnerId = ensureSeedOwner();
                relaxPetGalleryOwnerColumn();
                petGalleryService.ensureSeedPhotos(seedOwnerId);
            } catch (Exception e) {
                log.warn("Pet gallery seed photos could not be inserted. The storefront fallback photos will still render.", e);
            }
        };
    }

    private void ensurePetGalleryColumns() {
        if (!columnExists("pet_gallery_photos", "source")) {
            jdbcTemplate.execute("ALTER TABLE pet_gallery_photos ADD COLUMN source VARCHAR(20) NOT NULL DEFAULT 'USER_UPLOAD'");
        }
        if (!columnExists("pet_gallery_photos", "like_count")) {
            jdbcTemplate.execute("ALTER TABLE pet_gallery_photos ADD COLUMN like_count INT NOT NULL DEFAULT 0");
        }
    }

    private void ensurePetGalleryLikeColumns() {
        if (!columnExists("pet_gallery_photo_likes", "viewer_key")) {
            jdbcTemplate.execute("ALTER TABLE pet_gallery_photo_likes ADD COLUMN viewer_key VARCHAR(120) NULL");
        }
    }

    private void backfillPetGalleryMetadata() {
        jdbcTemplate.update("UPDATE pet_gallery_photos SET source = 'USER_UPLOAD' WHERE source IS NULL OR TRIM(source) = ''");
        jdbcTemplate.update("UPDATE pet_gallery_photos SET like_count = 0 WHERE like_count IS NULL");
    }

    private void backfillPetGalleryLikeViewerKeys() {
        jdbcTemplate.update("UPDATE pet_gallery_photo_likes SET viewer_key = "
                + "CASE WHEN user_id IS NOT NULL THEN CONCAT('user:', user_id) "
                + "ELSE CONCAT('ip:', LOWER(COALESCE(NULLIF(TRIM(ip_address), ''), 'unknown'))) END "
                + "WHERE viewer_key IS NULL OR TRIM(viewer_key) = ''");
    }

    private void cleanupDuplicatePetGalleryLikes() {
        jdbcTemplate.execute("DELETE l1 FROM pet_gallery_photo_likes l1 "
                + "JOIN pet_gallery_photo_likes l2 "
                + "ON l1.photo_id = l2.photo_id "
                + "AND l1.viewer_key = l2.viewer_key "
                + "AND l1.id > l2.id");
    }

    private void reconcilePetGalleryLikeCounts() {
        jdbcTemplate.update("UPDATE pet_gallery_photos p "
                + "JOIN (SELECT photo_id, COUNT(*) AS actual_likes FROM pet_gallery_photo_likes GROUP BY photo_id) likes "
                + "ON p.id = likes.photo_id "
                + "SET p.like_count = likes.actual_likes");
    }

    private void ensurePetGalleryLikeIndexes() {
        try {
            jdbcTemplate.execute("ALTER TABLE pet_gallery_photo_likes MODIFY COLUMN viewer_key VARCHAR(120) NOT NULL");
        } catch (Exception e) {
            log.debug("Pet gallery like viewer_key column already not null or not ready for alteration.", e);
        }
        if (!indexExists("pet_gallery_photo_likes", "idx_pet_gallery_like_viewer")) {
            jdbcTemplate.execute("ALTER TABLE pet_gallery_photo_likes ADD INDEX idx_pet_gallery_like_viewer (viewer_key)");
        }
        if (!indexExists("pet_gallery_photo_likes", "uk_gallery_like_photo_viewer")) {
            jdbcTemplate.execute("ALTER TABLE pet_gallery_photo_likes ADD UNIQUE KEY uk_gallery_like_photo_viewer (photo_id, viewer_key)");
        }
    }

    private Long ensureSeedOwner() {
        List<Long> existingIds = jdbcTemplate.query(
            "SELECT id FROM users WHERE username = ? LIMIT 1",
            (rs, rowNum) -> rs.getLong("id"),
            SEED_OWNER_USERNAME
        );
        if (!existingIds.isEmpty()) {
            return existingIds.get(0);
        }

        String password = passwordEncoder.encode(UUID.randomUUID().toString());
        if (columnExists("users", "status")) {
            jdbcTemplate.update(
                "INSERT INTO users (username, password, email, role, status, created_at, updated_at) " +
                    "SELECT ?, ?, ?, 'USER', 'ACTIVE', NOW(), NOW() " +
                    "WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = ?)",
                SEED_OWNER_USERNAME,
                password,
                SEED_OWNER_EMAIL,
                SEED_OWNER_USERNAME
            );
        } else {
            jdbcTemplate.update(
                "INSERT INTO users (username, password, email, role, created_at, updated_at) " +
                    "SELECT ?, ?, ?, 'USER', NOW(), NOW() " +
                    "WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = ?)",
                SEED_OWNER_USERNAME,
                password,
                SEED_OWNER_EMAIL,
                SEED_OWNER_USERNAME
            );
        }

        return jdbcTemplate.queryForObject(
            "SELECT id FROM users WHERE username = ? LIMIT 1",
            Long.class,
            SEED_OWNER_USERNAME
        );
    }

    private void relaxPetGalleryOwnerColumn() {
        try {
            jdbcTemplate.execute("ALTER TABLE pet_gallery_photos MODIFY COLUMN user_id BIGINT NULL");
        } catch (Exception e) {
            log.debug("Pet gallery owner column already nullable or not ready for alteration.", e);
        }
    }

    private boolean columnExists(String tableName, String columnName) {
        Integer count = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
            Integer.class,
            tableName,
            columnName
        );
        return count != null && count > 0;
    }

    private boolean indexExists(String tableName, String indexName) {
        Integer count = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?",
            Integer.class,
            tableName,
            indexName
        );
        return count != null && count > 0;
    }
}
