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
                backfillPetGalleryMetadata();
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

    private void backfillPetGalleryMetadata() {
        jdbcTemplate.update("UPDATE pet_gallery_photos SET source = 'USER_UPLOAD' WHERE source IS NULL OR TRIM(source) = ''");
        jdbcTemplate.update("UPDATE pet_gallery_photos SET like_count = 0 WHERE like_count IS NULL");
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
}
