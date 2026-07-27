package com.example.shop.repository;

import com.example.shop.entity.PetGalleryPhotoLike;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.test.context.TestPropertySource;

import static org.junit.jupiter.api.Assertions.assertEquals;

@DataJpaTest(showSql = false)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import(PetGalleryPhotoLikeRepositoryTest.TestApplication.class)
@TestPropertySource(properties = {
        "app.runtime-mode=test",
        "spring.flyway.enabled=false",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect",
        "spring.datasource.url=jdbc:h2:mem:petgallerylike;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.sql.init.mode=never"
})
class PetGalleryPhotoLikeRepositoryTest {
    @Autowired
    private PetGalleryPhotoLikeRepository repository;

    @Test
    void insertIfAbsentReturnsOneForNewLikeAndZeroForDuplicateViewer() {
        assertEquals(1, repository.insertIfAbsentByPhotoIdAndViewerKey(
                21L, 7L, "203.0.113.10", "user:7"));
        assertEquals(0, repository.insertIfAbsentByPhotoIdAndViewerKey(
                21L, 7L, "203.0.113.10", "user:7"));
        assertEquals(1L, repository.count());
    }

    @SpringBootApplication
    @EntityScan(basePackageClasses = PetGalleryPhotoLike.class)
    @EnableJpaRepositories(basePackageClasses = PetGalleryPhotoLikeRepository.class)
    static class TestApplication {
    }
}
