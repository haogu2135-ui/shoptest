package com.example.shop.config;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;

class ReferenceDataCachingContractTest {

    @Test
    void applicationEnablesSpringCachingForReferenceData() throws IOException {
        String source = readSource("src/main/java/com/example/shop/ShopApplication.java");

        assertTrue(source.contains("@EnableCaching"), "Spring cache abstraction should be enabled");
    }

    @Test
    void categoryAndBrandReferenceDataUseSpringCache() throws IOException {
        String categoryService = readSource("src/main/java/com/example/shop/service/impl/CategoryServiceImpl.java");
        String brandService = readSource("src/main/java/com/example/shop/service/BrandService.java");
        String productService = readSource("src/main/java/com/example/shop/service/impl/ProductServiceImpl.java");
        String categoryEntity = readSource("src/main/java/com/example/shop/entity/Category.java");
        String brandEntity = readSource("src/main/java/com/example/shop/entity/Brand.java");

        assertTrue(categoryService.contains("@Cacheable(cacheNames = \"categoryReferenceData\""),
                "category reference reads should be cacheable");
        assertTrue(categoryService.contains("@CacheEvict(cacheNames = \"categoryReferenceData\", allEntries = true)"),
                "category writes should evict category reference cache");
        assertTrue(brandService.contains("@Cacheable(cacheNames = \"brandReferenceData\""),
                "brand reference reads should be cacheable");
        assertTrue(brandService.contains("@CacheEvict(cacheNames = \"brandReferenceData\", allEntries = true)"),
                "brand writes should evict brand reference cache");
        assertTrue(productService.contains("evictCategoryReferenceCache()"),
                "product writes should evict category reference cache because category responses include product counts");
        assertTrue(categoryEntity.contains("class Category implements Serializable"),
                "category reference cache values must be serializable for Redis-backed cache deployments");
        assertTrue(brandEntity.contains("class Brand implements Serializable"),
                "brand reference cache values must be serializable for Redis-backed cache deployments");
    }

    private String readSource(String path) throws IOException {
        return Files.readString(Path.of(path), StandardCharsets.UTF_8);
    }
}
