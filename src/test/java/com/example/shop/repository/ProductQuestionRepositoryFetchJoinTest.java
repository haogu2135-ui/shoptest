package com.example.shop.repository;

import com.example.shop.entity.Product;
import com.example.shop.entity.ProductQuestion;
import com.example.shop.entity.User;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.test.context.TestPropertySource;

import javax.persistence.EntityManager;
import javax.persistence.PersistenceUnitUtil;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DataJpaTest(showSql = false)
@Import(ProductQuestionRepositoryFetchJoinTest.TestApplication.class)
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
class ProductQuestionRepositoryFetchJoinTest {
    @Autowired
    private ProductQuestionRepository productQuestionRepository;

    @Autowired
    private EntityManager entityManager;

    @Test
    void findAnsweredByProductIdFetchesProductAndUserAssociations() {
        Product product = persistProduct();
        User user = persistUser();
        ProductQuestion question = new ProductQuestion();
        question.setProduct(product);
        question.setUser(user);
        question.setQuestion("Is this washable?");
        question.setAnswer("Yes, use cold water.");
        question.setAnsweredAt(LocalDateTime.now());
        entityManager.persist(question);
        entityManager.flush();
        entityManager.clear();

        List<ProductQuestion> questions = productQuestionRepository.findAnsweredByProductId(
                product.getId(),
                PageRequest.of(0, 10));

        PersistenceUnitUtil persistenceUnitUtil = entityManager.getEntityManagerFactory().getPersistenceUnitUtil();
        assertEquals(1, questions.size());
        assertTrue(persistenceUnitUtil.isLoaded(questions.get(0).getProduct()));
        assertTrue(persistenceUnitUtil.isLoaded(questions.get(0).getUser()));
    }

    @Test
    void findAnsweredByProductIdDoesNotExposeInactiveProducts() {
        Product product = persistProduct();
        product.setStatus("INACTIVE");
        User user = persistUser();
        ProductQuestion question = new ProductQuestion();
        question.setProduct(product);
        question.setUser(user);
        question.setQuestion("Is this washable?");
        question.setAnswer("Yes, use cold water.");
        entityManager.persist(question);
        entityManager.flush();
        entityManager.clear();

        List<ProductQuestion> questions = productQuestionRepository.findAnsweredByProductId(
                product.getId(),
                PageRequest.of(0, 10));

        assertTrue(questions.isEmpty());
    }

    @Test
    void summarizeAdminQuestionMetricsUsesOneFilteredAggregate() {
        Product product = persistProduct();
        User user = persistUser();
        ProductQuestion staleUnanswered = persistQuestion(product, user, null);
        persistQuestion(product, user, "Yes, use cold water.");
        persistQuestion(product, user, " ");
        entityManager.flush();
        entityManager.createQuery("update ProductQuestion q set q.createdAt = :createdAt where q.id = :id")
                .setParameter("createdAt", LocalDateTime.now().minusDays(2))
                .setParameter("id", staleUnanswered.getId())
                .executeUpdate();
        entityManager.clear();

        Object[] metrics = productQuestionRepository.summarizeAdminQuestionMetrics(
                null, null, LocalDateTime.now().minusHours(1)).get(0);

        assertEquals(3L, ((Number) metrics[0]).longValue());
        assertEquals(2L, ((Number) metrics[1]).longValue());
        assertEquals(1L, ((Number) metrics[2]).longValue());
        assertEquals(1L, ((Number) metrics[3]).longValue());
    }

    private Product persistProduct() {
        Product product = new Product();
        product.setName("Training Harness");
        product.setPrice(new BigDecimal("29.99"));
        product.setStock(20);
        product.setCategoryId(1L);
        product.setStatus("ACTIVE");
        entityManager.persist(product);
        return product;
    }

    private User persistUser() {
        User user = new User();
        user.setUsername("questioner");
        user.setPassword("encoded-password");
        user.setEmail("questioner@example.com");
        user.setRole("USER");
        user.setStatus("ACTIVE");
        entityManager.persist(user);
        return user;
    }

    private ProductQuestion persistQuestion(Product product, User user, String answer) {
        ProductQuestion question = new ProductQuestion();
        question.setProduct(product);
        question.setUser(user);
        question.setQuestion("Is this washable?");
        question.setAnswer(answer);
        entityManager.persist(question);
        return question;
    }

    @SpringBootApplication
    @EntityScan(basePackageClasses = {ProductQuestion.class, Product.class, User.class})
    @EnableJpaRepositories(basePackageClasses = ProductQuestionRepository.class)
    static class TestApplication {
    }
}
