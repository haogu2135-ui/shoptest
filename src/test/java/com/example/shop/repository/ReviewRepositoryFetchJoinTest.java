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
import javax.persistence.PersistenceUnitUtil;
import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DataJpaTest(showSql = false)
@Import(ReviewRepositoryFetchJoinTest.TestApplication.class)
@TestPropertySource(properties = {
        "app.runtime-mode=test",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect",
        "spring.sql.init.mode=never"
})
class ReviewRepositoryFetchJoinTest {
    @Autowired
    private ReviewRepository reviewRepository;

    @Autowired
    private EntityManager entityManager;

    @Test
    void findByProductIdFetchesProductAndUserAssociations() {
        Product product = persistProduct();
        User user = persistUser();
        Review review = new Review();
        review.setProduct(product);
        review.setUser(user);
        review.setRating(5);
        review.setComment("Solid carrier");
        review.setStatus("APPROVED");
        entityManager.persist(review);
        entityManager.flush();
        entityManager.clear();

        List<Review> reviews = reviewRepository.findByProduct_Id(product.getId());

        PersistenceUnitUtil persistenceUnitUtil = entityManager.getEntityManagerFactory().getPersistenceUnitUtil();
        assertEquals(1, reviews.size());
        assertTrue(persistenceUnitUtil.isLoaded(reviews.get(0).getProduct()));
        assertTrue(persistenceUnitUtil.isLoaded(reviews.get(0).getUser()));
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
