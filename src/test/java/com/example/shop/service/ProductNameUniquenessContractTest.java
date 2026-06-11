package com.example.shop.service;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class ProductNameUniquenessContractTest {
    private static final Path PRODUCT_ENTITY = Path.of("src/main/java/com/example/shop/entity/Product.java");
    private static final Path PRODUCT_REPOSITORY = Path.of("src/main/java/com/example/shop/repository/ProductRepository.java");
    private static final Path PRODUCT_SERVICE = Path.of("src/main/java/com/example/shop/service/impl/ProductServiceImpl.java");
    private static final Path SCHEMA = Path.of("src/main/resources/schema.sql");
    private static final Path PRODUCT_NAME_UNIQUE_MIGRATION =
            Path.of("src/main/resources/db/migration/R__product_category_name_unique.sql");

    @Test
    void productCategoryNameUniquenessIsProtectedAtEntityServiceAndDatabaseBoundaries() throws IOException {
        String productEntity = Files.readString(PRODUCT_ENTITY);
        String productRepository = Files.readString(PRODUCT_REPOSITORY);
        String productService = Files.readString(PRODUCT_SERVICE);
        String schema = Files.readString(SCHEMA);
        String migration = Files.readString(PRODUCT_NAME_UNIQUE_MIGRATION);

        assertTrue(productEntity.contains("uk_products_category_name"),
                "Product entity should declare the catalog uniqueness contract");
        assertTrue(productRepository.contains("existsByCategoryIdAndNameIgnoreCase("),
                "repository should support create-time duplicate checks");
        assertTrue(productRepository.contains("existsByCategoryIdAndNameIgnoreCaseAndIdNot("),
                "repository should support update-time duplicate checks that exclude the current row");
        assertTrue(productService.contains("validateDirectProductNameUniqueness(product);"),
                "direct admin saves should check product name uniqueness before persistence");
        assertTrue(productService.contains("isProductCategoryNameConstraintViolation(e)"),
                "concurrent database unique-key violations should be translated for admin callers");
        assertTrue(schema.contains("UNIQUE KEY uk_products_category_name (category_id, name)"),
                "schema.sql should create the product category/name unique key for fresh databases");
        assertTrue(migration.contains("ALTER TABLE products ADD UNIQUE KEY uk_products_category_name (category_id, name)"),
                "Flyway should enforce the product category/name unique key on migrated databases");
    }
}
