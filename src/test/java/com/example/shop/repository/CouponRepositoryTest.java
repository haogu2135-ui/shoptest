package com.example.shop.repository;

import com.example.shop.entity.Coupon;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.test.context.TestPropertySource;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

@DataJpaTest(showSql = false)
@Import(CouponRepositoryTest.TestApplication.class)
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
class CouponRepositoryTest {
    @Autowired
    private CouponRepository couponRepository;

    @Test
    void claimableQueryReturnsAvailablePublicCouponsInIdOrder() {
        LocalDateTime now = LocalDateTime.of(2026, 5, 24, 12, 0);
        couponRepository.save(coupon("Public low inventory", "PUBLIC", "ACTIVE", now.minusDays(1), now.plusDays(3), 10, 8));
        couponRepository.save(coupon("Assigned low inventory", "ASSIGNED", "ACTIVE", now.minusDays(1), now.plusDays(2), 5, 4));
        couponRepository.save(coupon("Inactive coupon", "PUBLIC", "INACTIVE", now.minusDays(1), now.plusDays(2), 10, 2));
        couponRepository.save(coupon("Expired coupon", "PUBLIC", "ACTIVE", now.minusDays(10), now.minusDays(1), 10, 2));
        couponRepository.save(coupon("Sold out coupon", "PUBLIC", "ACTIVE", now.minusDays(1), now.plusDays(2), 10, 10));
        couponRepository.save(coupon("Future coupon", "PUBLIC", "ACTIVE", now.plusDays(1), now.plusDays(4), 10, 1));
        couponRepository.save(coupon("Unlimited public coupon", "PUBLIC", "ACTIVE", now.minusDays(1), null, null, 0));

        List<Coupon> claimable = couponRepository.findClaimableByScopeAndStatus(
                "PUBLIC",
                "ACTIVE",
                now,
                PageRequest.of(0, 10));

        assertEquals(List.of("Unlimited public coupon", "Public low inventory"),
                claimable.stream().map(Coupon::getName).collect(java.util.stream.Collectors.toList()));
    }

    @Test
    void summarizeAdminMetricsCombinesCouponSignalsAndFilters() {
        LocalDateTime now = LocalDateTime.of(2026, 5, 24, 12, 0);
        couponRepository.save(coupon("Current public", "PUBLIC", "ACTIVE", now.minusDays(1), now.plusDays(3), 10, 8));
        couponRepository.save(coupon("Scheduled public", "PUBLIC", "ACTIVE", now.plusHours(1), now.plusDays(2), 100, 1));
        couponRepository.save(coupon("Expired public", "PUBLIC", "ACTIVE", now.minusDays(3), now.minusHours(1), 50, 1));
        couponRepository.save(coupon("Current assigned", "ASSIGNED", "ACTIVE", now.minusDays(1), now.plusDays(4), 20, 18));
        couponRepository.save(coupon("Inactive public", "PUBLIC", "INACTIVE", null, null, 10, 1));
        couponRepository.flush();

        Object[] metrics = couponRepository.summarizeAdminMetrics(
                null, null, null, null, now, now.plusDays(7), 5).get(0);

        assertEquals(5L, ((Number) metrics[0]).longValue());
        assertEquals(4L, ((Number) metrics[1]).longValue());
        assertEquals(1L, ((Number) metrics[2]).longValue());
        assertEquals(3L, ((Number) metrics[3]).longValue());
        assertEquals(3L, ((Number) metrics[4]).longValue());
        assertEquals(2L, ((Number) metrics[5]).longValue());

        Object[] publicMetrics = couponRepository.summarizeAdminMetrics(
                null, null, null, "PUBLIC", now, now.plusDays(7), 5).get(0);
        assertEquals(4L, ((Number) publicMetrics[0]).longValue());
        assertEquals(1L, ((Number) publicMetrics[2]).longValue());
        assertEquals(2L, ((Number) publicMetrics[4]).longValue());
    }

    private Coupon coupon(String name,
                          String scope,
                          String status,
                          LocalDateTime startAt,
                          LocalDateTime endAt,
                          Integer totalQuantity,
                          Integer claimedQuantity) {
        Coupon coupon = new Coupon();
        coupon.setName(name);
        coupon.setCouponType("FULL_REDUCTION");
        coupon.setScope(scope);
        coupon.setStatus(status);
        coupon.setThresholdAmount(BigDecimal.ZERO);
        coupon.setReductionAmount(new BigDecimal("10.00"));
        coupon.setTotalQuantity(totalQuantity);
        coupon.setClaimedQuantity(claimedQuantity);
        coupon.setStartAt(startAt);
        coupon.setEndAt(endAt);
        coupon.setCreatedAt(LocalDateTime.now());
        coupon.setUpdatedAt(LocalDateTime.now());
        return coupon;
    }

    @SpringBootApplication
    @EntityScan(basePackageClasses = Coupon.class)
    @EnableJpaRepositories(basePackageClasses = CouponRepository.class)
    static class TestApplication {
    }
}
