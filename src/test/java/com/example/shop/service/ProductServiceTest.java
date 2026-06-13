package com.example.shop.service;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class ProductServiceTest {
    private static final Path SOURCE = Path.of("src/main/java/com/example/shop/service/ProductService.java");

    @Test
    void productServiceInterfaceKeepsPublicAdminAndImportContractsVisible() throws Exception {
        String source = Files.readString(SOURCE, StandardCharsets.UTF_8);

        assertTrue(source.contains("public interface ProductService"));
        assertTrue(source.contains("List<Product> findPublicProducts(ProductListQuery query);"));
        assertTrue(source.contains("Page<Product> findPublicProductPage(ProductListQuery query);"));
        assertTrue(source.contains("List<Product> findAdminProducts(ProductListQuery query);"));
        assertTrue(source.contains("Page<Product> findAdminProductPage(ProductListQuery query);"));
        assertTrue(source.contains("Optional<Product> findPublicById(Long id);"));
        assertTrue(source.contains("List<Product> findPublicByIds(List<Long> ids);"));
        assertTrue(source.contains("Product mergeProduct(Product existingProduct, Product product);"));
        assertTrue(source.contains("int updateStatusByIds(List<Long> ids, String status);"));
        assertTrue(source.contains("ProductImportResult previewImportCsv(MultipartFile file);"));
        assertTrue(source.contains("ProductImportResult importCsv(MultipartFile file);"));
    }

    @Test
    void productServiceInterfaceKeepsCommercialDiscoveryAndDashboardContractsVisible() throws Exception {
        String source = Files.readString(SOURCE, StandardCharsets.UTF_8);

        assertTrue(source.contains("List<Product> findPublicFeaturedProducts(int limit);"));
        assertTrue(source.contains("List<Product> findFinderCandidates(List<String> keywords, int limit);"));
        assertTrue(source.contains("List<Product> findRelatedProducts(Long productId, Long categoryId);"));
        assertTrue(source.contains("List<Product> findPersonalizedRecommendations(Long userId);"));
        assertTrue(source.contains("void clearPersonalizedRecommendationCache(Long userId);"));
        assertTrue(source.contains("List<Product> findDiscountProducts();"));
        assertTrue(source.contains("List<Product> findAddOnCandidates(BigDecimal targetAmount, List<Long> excludedProductIds, int limit);"));
        assertTrue(source.contains("Map<String, Long> countDashboardProductSummary();"));
        assertTrue(source.contains("List<Product> findLowStockProducts(int limit);"));
    }
}
