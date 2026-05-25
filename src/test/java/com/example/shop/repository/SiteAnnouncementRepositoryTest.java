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
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect",
        "spring.sql.init.mode=never"
})
class SiteAnnouncementRepositoryTest {
    @Autowired
    private SiteAnnouncementRepository repository;

    @Test
    void aggregateQueriesCountAnnouncementOperationalSignals() {
        LocalDateTime now = LocalDateTime.of(2026, 5, 24, 12, 0);
        repository.save(announcement("Active linked", "ACTIVE", now.minusHours(2), now.plusHours(2), "/coupons", 2));
        repository.save(announcement("Active long running", "active", null, null, "", 1));
        repository.save(announcement("Scheduled", "ACTIVE", now.plusHours(1), now.plusDays(2), "/products?discount=true", 3));
        repository.save(announcement("Expired", "ACTIVE", now.minusDays(3), now.minusHours(1), null, 4));
        repository.save(announcement("Inactive", "inactive", null, null, "https://example.com", 5));

        assertEquals(2L, repository.countCurrentlyActive(now));
        assertEquals(1L, repository.countScheduled(now));
        assertEquals(1L, repository.countExpired(now));
        assertEquals(1L, repository.countByStatusIgnoreCase("INACTIVE"));
        assertEquals(3L, repository.countLinked());

        List<SiteAnnouncement> active = repository.findActive(now, PageRequest.of(0, 10));

        assertEquals(List.of("Active long running", "Active linked"),
                active.stream().map(SiteAnnouncement::getTitle).collect(java.util.stream.Collectors.toList()));
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
