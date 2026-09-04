package com.example.shop.repository;

import com.example.shop.entity.PetGalleryPhoto;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.test.context.TestPropertySource;

import javax.persistence.EntityManager;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

@DataJpaTest(showSql = false)
@Import(PetGalleryPhotoRepositoryTest.TestApplication.class)
@TestPropertySource(properties = {
        "app.runtime-mode=test",
        "spring.flyway.enabled=false",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect",
        "spring.datasource.url=jdbc:h2:mem:petgalleryphoto;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.sql.init.mode=never"
})
class PetGalleryPhotoRepositoryTest {
    @Autowired
    private PetGalleryPhotoRepository repository;

    @Autowired
    private EntityManager entityManager;

    @Test
    void summarizeAdminMetricsCombinesFilteredPhotoSignals() {
        LocalDateTime now = LocalDateTime.of(2026, 5, 24, 12, 0);
        persist(photo("Current upload", "USER_UPLOAD", now.minusDays(1), 6L * 1024 * 1024));
        persist(photo("Recent upload", "USER_UPLOAD", now.minusDays(6), 1L * 1024 * 1024));
        persist(photo("Old upload", "USER_UPLOAD", now.minusDays(8), 7L * 1024 * 1024));
        persist(photo("Recent seed", "SEED", now.minusDays(2), 0L));
        persist(photo("Old seed", "SEED", now.minusDays(9), 0L));
        entityManager.flush();

        Object[] metrics = repository.summarizeAdminMetrics(
                null, null, null, "USER_UPLOAD", "SEED", now.minusDays(7), 5L * 1024 * 1024).get(0);

        assertEquals(5L, ((Number) metrics[0]).longValue());
        assertEquals(3L, ((Number) metrics[1]).longValue());
        assertEquals(2L, ((Number) metrics[2]).longValue());
        assertEquals(3L, ((Number) metrics[3]).longValue());
        assertEquals(2L, ((Number) metrics[4]).longValue());

        Object[] uploadMetrics = repository.summarizeAdminMetrics(
                null, "USER_UPLOAD", null, "USER_UPLOAD", "SEED", now.minusDays(7), 5L * 1024 * 1024).get(0);
        assertEquals(3L, ((Number) uploadMetrics[0]).longValue());
        assertEquals(3L, ((Number) uploadMetrics[1]).longValue());
        assertEquals(0L, ((Number) uploadMetrics[2]).longValue());
        assertEquals(2L, ((Number) uploadMetrics[3]).longValue());
        assertEquals(2L, ((Number) uploadMetrics[4]).longValue());
    }

    @Test
    void findImageUrlsByImageUrlInLoadsExistingSeedUrlsTogether() {
        persist(photo("First", "SEED", LocalDateTime.now(), 0L));
        persist(photo("Second", "SEED", LocalDateTime.now(), 0L));
        entityManager.flush();

        assertEquals(List.of("https://example.com/First"),
                repository.findImageUrlsByImageUrlIn(List.of(
                        "https://example.com/First",
                        "https://example.com/Missing")));
    }

    private void persist(PetGalleryPhoto photo) {
        entityManager.persist(photo);
    }

    private PetGalleryPhoto photo(String username, String source, LocalDateTime createdAt, long fileSize) {
        PetGalleryPhoto photo = new PetGalleryPhoto();
        photo.setUsername(username);
        photo.setImageUrl("https://example.com/" + username.replace(' ', '-'));
        photo.setContentType("image/jpeg");
        photo.setFileSize(fileSize);
        photo.setIpAddress("203.0.113.10");
        photo.setStatus("ACTIVE");
        photo.setSource(source);
        photo.setLikeCount(0);
        photo.setCreatedAt(createdAt);
        return photo;
    }

    @SpringBootApplication
    @EntityScan(basePackageClasses = PetGalleryPhoto.class)
    @EnableJpaRepositories(basePackageClasses = PetGalleryPhotoRepository.class)
    static class TestApplication {
    }
}
