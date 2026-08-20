package com.example.shop.repository;

import com.example.shop.entity.Product;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.test.context.TestPropertySource;

import java.math.BigDecimal;
import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.assertEquals;

@DataJpaTest(showSql = false)
@Import(ProductInventorySummaryRepositoryTest.TestApplication.class)
@TestPropertySource(properties = {
        "app.runtime-mode=test",
        "spring.flyway.enabled=false",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect",
        "spring.datasource.url=jdbc:h2:mem:productinventory;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.sql.init.mode=never"
})
class ProductInventorySummaryRepositoryTest {
    @Autowired
    private ProductRepository productRepository;

    @Test
    void aggregatesEveryProductIntoOneInventoryBucket() {
        Arrays.asList(null, 0, 1, 5, 6, 9, 10, 25)
                .forEach(this::saveProduct);

        ProductRepository.ProductInventorySummary summary = productRepository.getInventorySummary();

        assertEquals(8L, summary.getTotalProducts());
        assertEquals(2L, summary.getOutOfStock());
        assertEquals(2L, summary.getCritical());
        assertEquals(2L, summary.getLow());
        assertEquals(2L, summary.getHealthy());
        assertEquals(56L, summary.getTotalUnits());
    }

    private void saveProduct(Integer stock) {
        Product product = new Product();
        product.setName("Inventory product " + productRepository.count());
        product.setPrice(new BigDecimal("10.00"));
        product.setStock(stock);
        product.setCategoryId(1L);
        product.setStatus("ACTIVE");
        productRepository.save(product);
    }

    @SpringBootApplication
    @EntityScan(basePackageClasses = Product.class)
    @EnableJpaRepositories(basePackageClasses = ProductRepository.class)
    static class TestApplication {
    }
}
