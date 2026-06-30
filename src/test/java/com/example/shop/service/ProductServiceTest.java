package com.example.shop.service;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertFalse;
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

    @Test
    void staleProductAdminClonePathIsAbsentAndCreateClearsClientSuppliedId() throws Exception {
        String adminController = Files.readString(
                Path.of("src/main/java/com/example/shop/controller/AdminController.java"), StandardCharsets.UTF_8);
        String productServiceImpl = Files.readString(
                Path.of("src/main/java/com/example/shop/service/impl/ProductServiceImpl.java"),
                StandardCharsets.UTF_8);
        String saveMethod = block(productServiceImpl,
                "@Transactional(rollbackFor = Exception.class)\n    public Product save(Product product)",
                "\n    @Override");

        assertTrue(Files.notExists(Path.of("src/main/java/com/example/shop/service/ProductAdminService.java")));
        assertFalse(adminController.contains("cloneProduct("));
        assertFalse(adminController.contains("BeanUtils.copyProperties"));
        assertFalse(productServiceImpl.contains("cloneProduct("));
        assertTrue(adminController.contains("@PostMapping(\"/products\")"));
        assertTrue(adminController.contains("product.setId(null);\n            Product savedProduct = productService.save(product);"));
        assertTrue(saveMethod.contains("validateDirectProduct(product);"));
        assertTrue(saveMethod.contains("Product saved = productRepository.save(product);"));
    }

    @Test
    void staleAdminProductControllerCloneHeaderAndStateDeletePathsAreAbsent() throws Exception {
        String adminController = Files.readString(
                Path.of("src/main/java/com/example/shop/controller/AdminController.java"), StandardCharsets.UTF_8);
        String deleteMethod = block(adminController,
                "@DeleteMapping(\"/products/{id}\")",
                "\n    @GetMapping(\"/brands\")");

        assertTrue(Files.notExists(Path.of("src/main/java/com/example/shop/controller/AdminProductController.java")));
        assertTrue(Files.notExists(Path.of("src/main/java/com/example/shop/service/ProductStateService.java")));
        assertFalse(adminController.contains("addStandardProductHeaders"));
        assertFalse(adminController.contains("X-Product-Data"));
        assertFalse(adminController.contains("productStateService.deleteProduct"));
        assertFalse(adminController.contains("DeleteProductResult"));
        assertTrue(deleteMethod.contains("Product product = productService.findById(id).orElse(null);"));
        assertTrue(deleteMethod.contains("return ResponseEntity.notFound().build();"));
        assertTrue(deleteMethod.contains("productService.deleteById(id);"));
        assertTrue(deleteMethod.contains("auditLogService.record(\"PRODUCT_DELETE\", \"SUCCESS\""));
    }

    private String block(String source, String startToken, String endToken) {
        int start = source.indexOf(startToken);
        assertTrue(start >= 0, () -> "Missing source block: " + startToken);
        int end = source.indexOf(endToken, start + startToken.length());
        assertTrue(end > start, () -> "Missing source block terminator: " + endToken);
        return source.substring(start, end);
    }
}
