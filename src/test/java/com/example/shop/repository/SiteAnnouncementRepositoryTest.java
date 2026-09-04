package com.example.shop.repository;

import com.example.shop.entity.SiteAnnouncement;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.test.context.TestPropertySource;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

@DataJpaTest(showSql = false)
@Import(SiteAnnouncementRepositoryTest.TestApplication.class)
@TestPropertySource(properties = {
        "app.runtime-mode=test",
        "spring.flyway.enabled=false",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect",
        "spring.datasource.url=jdbc:h2:mem:shoprepo;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.sql.init.mode=never"
})
class SiteAnnouncementRepositoryTest {
    @Autowired
    private SiteAnnouncementRepository repository;

    @Test
    void activeQueryReturnsCurrentAnnouncementsInSortOrder() {
        LocalDateTime now = LocalDateTime.of(2026, 5, 24, 12, 0);
        repository.save(announcement("Active linked", "ACTIVE", now.minusHours(2), now.plusHours(2), "/coupons", 2));
        repository.save(announcement("Active long running", "active", null, null, "", 1));
        repository.save(announcement("Scheduled", "ACTIVE", now.plusHours(1), now.plusDays(2), "/products?discount=true", 3));
        repository.save(announcement("Expired", "ACTIVE", now.minusDays(3), now.minusHours(1), null, 4));
        repository.save(announcement("Inactive", "inactive", null, null, "https://example.com", 5));

        List<SiteAnnouncement> active = repository.findActive(now, PageRequest.of(0, 10));

        assertEquals(List.of("Active long running", "Active linked"),
                active.stream().map(SiteAnnouncement::getTitle).collect(java.util.stream.Collectors.toList()));
    }

    @Test
    void keysetQueryReturnsOnlyActiveRowsAfterCursorInIdOrder() {
        SiteAnnouncement first = repository.saveAndFlush(announcement(
                "First", "ACTIVE", null, null, null, 1));
        SiteAnnouncement second = repository.saveAndFlush(announcement(
                "Second", "ACTIVE", null, null, null, 2));
        repository.saveAndFlush(announcement("Inactive", "INACTIVE", null, null, null, 3));

        List<SiteAnnouncement> rows = repository
                .findByStatusIgnoreCaseAndIdGreaterThanOrderByIdAsc(
                        "active", first.getId(), PageRequest.of(0, 10));

        assertEquals(List.of(second.getId()),
                rows.stream().map(SiteAnnouncement::getId).collect(java.util.stream.Collectors.toList()));
    }

    @Test
    void summarizeAdminMetricsCombinesStatusAndTimeSignals() {
        LocalDateTime now = LocalDateTime.of(2026, 5, 24, 12, 0);
        repository.save(announcement("Current linked", "ACTIVE", now.minusHours(2), now.plusHours(2), "/coupons", 1));
        repository.save(announcement("Current", "ACTIVE", null, null, null, 2));
        repository.save(announcement("Scheduled", "ACTIVE", now.plusHours(1), now.plusDays(2), "/products", 3));
        repository.save(announcement("Expired", "ACTIVE", now.minusDays(3), now.minusHours(1), null, 4));
        repository.save(announcement("Inactive linked", "INACTIVE", null, null, "/help", 5));
        repository.flush();

        Object[] metrics = repository.summarizeAdminMetrics(null, null, now).get(0);

        assertEquals(5L, ((Number) metrics[0]).longValue());
        assertEquals(2L, ((Number) metrics[1]).longValue());
        assertEquals(1L, ((Number) metrics[2]).longValue());
        assertEquals(1L, ((Number) metrics[3]).longValue());
        assertEquals(1L, ((Number) metrics[4]).longValue());
        assertEquals(3L, ((Number) metrics[5]).longValue());

        Object[] activeMetrics = repository.summarizeAdminMetrics("ACTIVE", null, now).get(0);
        assertEquals(4L, ((Number) activeMetrics[0]).longValue());
        assertEquals(0L, ((Number) activeMetrics[4]).longValue());
    }

    private SiteAnnouncement announcement(String title,
                                          String status,
                                          LocalDateTime startsAt,
                                          LocalDateTime endsAt,
                                          String linkUrl,
                                          int sortOrder) {
        SiteAnnouncement announcement = new SiteAnnouncement();
        announcement.setTitle(title);
        announcement.setContent(title + " content");
        announcement.setStatus(status);
        announcement.setStartsAt(startsAt);
        announcement.setEndsAt(endsAt);
        announcement.setLinkUrl(linkUrl);
        announcement.setSortOrder(sortOrder);
        return announcement;
    }

    @SpringBootApplication
    @EntityScan(basePackageClasses = SiteAnnouncement.class)
    @EnableJpaRepositories(basePackageClasses = SiteAnnouncementRepository.class)
    static class TestApplication {
    }
}
