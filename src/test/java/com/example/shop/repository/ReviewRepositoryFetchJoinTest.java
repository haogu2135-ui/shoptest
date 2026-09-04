package com.example.shop.repository;

import com.example.shop.entity.Product;
import com.example.shop.entity.Review;
import com.example.shop.entity.User;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.test.context.TestPropertySource;

import javax.persistence.EntityManager;
import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

@DataJpaTest(showSql = false)
@Import(ReviewRepositoryFetchJoinTest.TestApplication.class)
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
class ReviewRepositoryFetchJoinTest {
    @Autowired
    private ReviewRepository reviewRepository;

    @Autowired
    private EntityManager entityManager;

    @Test
    void aggregateAdminReviewMetricsCombinesStatusAndOperationalSignals() {
        Product product = persistProduct();
        User user = persistUser();
        persistReview(product, user, "PENDING", 2, null);
        persistReview(product, user, "APPROVED", 5, "Thanks");
        persistReview(product, user, "HIDDEN", 1, "");
        entityManager.flush();

        List<Object[]> metricRows = reviewRepository.summarizeAdminReviewMetrics(null, null, null);
        Object[] metrics = metricRows.get(0);

        assertEquals(1L, ((Number) metrics[0]).longValue());
        assertEquals(1L, ((Number) metrics[1]).longValue());
        assertEquals(1L, ((Number) metrics[2]).longValue());
        assertEquals(2L, ((Number) metrics[3]).longValue());
        assertEquals(2L, ((Number) metrics[4]).longValue());
        assertEquals(8D / 3D, ((Number) metrics[5]).doubleValue(), 0.0001D);

        Object[] approvedMetrics = reviewRepository
                .summarizeAdminReviewMetrics("APPROVED", null, null).get(0);
        assertEquals(0L, ((Number) approvedMetrics[0]).longValue());
        assertEquals(1L, ((Number) approvedMetrics[1]).longValue());
        assertEquals(0L, ((Number) approvedMetrics[2]).longValue());
        assertEquals(0L, ((Number) approvedMetrics[3]).longValue());
        assertEquals(0L, ((Number) approvedMetrics[4]).longValue());
        assertEquals(5D, ((Number) approvedMetrics[5]).doubleValue(), 0.0001D);
    }

    private void persistReview(Product product, User user, String status, int rating, String adminReply) {
        Review review = new Review();
        review.setProduct(product);
        review.setUser(user);
        review.setRating(rating);
        review.setComment(status + " review");
        review.setStatus(status);
        review.setAdminReply(adminReply);
        entityManager.persist(review);
    }

    private Product persistProduct() {
        Product product = new Product();
        product.setName("Trail Carrier");
        product.setPrice(new BigDecimal("39.99"));
        product.setStock(20);
        product.setCategoryId(1L);
        product.setStatus("ACTIVE");
        entityManager.persist(product);
        return product;
    }

    private User persistUser() {
        User user = new User();
        user.setUsername("reviewer");
        user.setPassword("encoded-password");
        user.setEmail("reviewer@example.com");
        user.setRole("USER");
        user.setStatus("ACTIVE");
        entityManager.persist(user);
        return user;
    }

    @SpringBootApplication
    @EntityScan(basePackageClasses = {Review.class, Product.class, User.class})
    @EnableJpaRepositories(basePackageClasses = ReviewRepository.class)
    static class TestApplication {
    }
}
