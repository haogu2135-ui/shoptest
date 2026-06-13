package com.example.shop.service;

import com.example.shop.websocket.SupportWebSocketHandler;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CommerceLegacyIssueContractTest {

    @Test
    void returnFlowDoesNotExposeLegacyItemLevelReturnRequestFields() throws Exception {
        assertFalse(Files.exists(Path.of("src/main/java/com/example/shop/service/OrderReturnService.java")));

        String orderController = Files.readString(Path.of("src/main/java/com/example/shop/controller/OrderController.java"));
        String orderService = Files.readString(Path.of("src/main/java/com/example/shop/service/OrderService.java"));

        assertFalse(orderController.contains("orderItemIds"));
        assertFalse(orderController.contains("ReturnItem"));
        assertFalse(orderController.contains("ReturnProduct"));
        assertFalse(orderService.contains("orderItemIds"));
        assertFalse(orderService.contains("ReturnItem"));
        assertFalse(orderService.contains("ReturnProduct"));
        assertTrue(orderService.contains("public boolean requestReturn(Long id, Long userId, String reason)"));
        assertTrue(orderService.contains("public boolean completeReturn(Long id)"));
    }

    @Test
    void checkoutUsesCurrentActiveProductContractInsteadOfLegacyApprovedComparison() throws Exception {
        assertFalse(Files.exists(Path.of("src/main/java/com/example/shop/service/CheckoutService.java")));

        String orderService = Files.readString(Path.of("src/main/java/com/example/shop/service/OrderService.java"));

        assertTrue(orderService.contains("\"ACTIVE\".equalsIgnoreCase(product.getStatus())"));
        assertFalse(orderService.contains("product.getStatus() == \"APPROVED\""));
        assertFalse(orderService.contains("\"APPROVED\".equalsIgnoreCase(product.getStatus())"));
    }

    @Test
    void legacyAuxiliaryIssueTargetsAreAbsentOrAlreadyCurrentSourceCovered() throws Exception {
        assertFalse(Files.exists(Path.of("src/main/java/com/example/shop/service/ExpressService.java")));
        assertFalse(Files.exists(Path.of("src/main/java/com/example/shop/dto/OrderQueryPage.java")));
        assertFalse(Files.exists(Path.of("src/test/java/com/example/shop/service/AdminPricingAuditTest.java")));

        String productService = Files.readString(Path.of("src/main/java/com/example/shop/service/impl/ProductServiceImpl.java"));
        assertTrue(productService.contains("discount must be between 0 and 100"));

        assertTrue(TextWebSocketHandler.class.isAssignableFrom(SupportWebSocketHandler.class));
    }

    @Test
    void productUpdateMergeLogicLivesInProductService() throws Exception {
        String productController = Files.readString(Path.of("src/main/java/com/example/shop/controller/ProductController.java"));
        String adminController = Files.readString(Path.of("src/main/java/com/example/shop/controller/AdminController.java"));
        String productService = Files.readString(Path.of("src/main/java/com/example/shop/service/ProductService.java"));
        String productServiceImpl = Files.readString(Path.of("src/main/java/com/example/shop/service/impl/ProductServiceImpl.java"));

        assertFalse(productController.contains("private void mergeProduct(Product existingProduct, Product product)"));
        assertFalse(adminController.contains("private void mergeProduct(Product existingProduct, Product product)"));
        assertTrue(productController.contains("productService.save(productService.mergeProduct(existingProduct, product))"));
        assertTrue(adminController.contains("productService.save(productService.mergeProduct(existingProduct, product))"));
        assertTrue(productService.contains("Product mergeProduct(Product existingProduct, Product product);"));
        assertTrue(productServiceImpl.contains("public Product mergeProduct(Product existingProduct, Product product)"));
        assertTrue(productServiceImpl.contains("existingProduct.setStatus(normalizeImportedStatus(product.getStatus()))"));
    }

    @Test
    void recommendationEndpointsUseCurrentProductServiceInsteadOfLegacyDeadService() throws Exception {
        assertFalse(Files.exists(Path.of("src/main/java/com/example/shop/service/RecommendationService.java")));

        String productController = Files.readString(Path.of("src/main/java/com/example/shop/controller/ProductController.java"));
        String productService = Files.readString(Path.of("src/main/java/com/example/shop/service/impl/ProductServiceImpl.java"));

        assertTrue(productController.contains("@GetMapping(\"/personalized-recommendations\")"));
        assertTrue(productController.contains("productService.findPersonalizedRecommendations"));
        assertTrue(productController.contains("@GetMapping(\"/{id}/recommendations\")"));
        assertTrue(productController.contains("productService.findRelatedProducts"));
        assertFalse(productController.contains("RecommendationService"));
        assertTrue(productService.contains("public List<Product> findPersonalizedRecommendations(Long userId)"));
        assertTrue(productService.contains("public List<Product> findRelatedProducts(Long productId, Long categoryId)"));
    }

    @Test
    void reviewImagesAndPetGalleryDoNotUseStaleMyBatisMapperXmlPaths() throws Exception {
        assertFalse(Files.exists(Path.of("src/main/resources/mapper/ReviewImageMapper.xml")));
        assertFalse(Files.exists(Path.of("src/main/resources/mapper/PetGalleryMapper.xml")));
        assertFalse(Files.exists(Path.of("src/main/java/com/example/shop/repository/ReviewImageMapper.java")));
        assertFalse(Files.exists(Path.of("src/main/java/com/example/shop/repository/PetGalleryMapper.java")));

        String reviewImageService = Files.readString(Path.of("src/main/java/com/example/shop/service/ReviewImageService.java"));
        String petGalleryPhotoRepository = Files.readString(Path.of("src/main/java/com/example/shop/repository/PetGalleryPhotoRepository.java"));
        String petGalleryPhotoLikeRepository = Files.readString(Path.of("src/main/java/com/example/shop/repository/PetGalleryPhotoLikeRepository.java"));

        assertTrue(reviewImageService.contains("private final ImageStorageService imageStorageService;"));
        assertTrue(petGalleryPhotoRepository.contains("extends JpaRepository<PetGalleryPhoto, Long>"));
        assertTrue(petGalleryPhotoLikeRepository.contains("extends JpaRepository<PetGalleryPhotoLike, Long>"));
    }

    @Test
    void legacyPerformanceAuditTargetsAreAbsentOrCoveredByCurrentBoundedPaths() throws Exception {
        assertFalse(Files.exists(Path.of("src/main/java/com/example/shop/service/impl/OrderServiceImpl.java")));
        assertFalse(Files.exists(Path.of("src/main/java/com/example/shop/service/impl/PayServiceImpl.java")));
        assertFalse(Files.exists(Path.of("src/main/java/com/example/shop/service/impl/UserCouponServiceImpl.java")));
        assertFalse(Files.exists(Path.of("src/main/java/com/example/shop/service/impl/CouponServiceImpl.java")));
        assertFalse(Files.exists(Path.of("src/main/java/com/example/shop/service/impl/InventoryServiceImpl.java")));
        assertFalse(Files.exists(Path.of("src/main/java/com/example/shop/service/impl/RecommendServiceImpl.java")));
        assertFalse(Files.exists(Path.of("src/main/java/com/example/shop/service/impl/ShopRuleEngine.java")));

        String orderService = Files.readString(Path.of("src/main/java/com/example/shop/service/OrderService.java"));
        assertTrue(orderService.contains("orderItemRepository.insertBatch(orderItems)"));
        assertTrue(orderService.contains("cartItemMapper.findByIdsForUpdate(cartItemIds)"));
        assertTrue(orderService.contains("productRepository.findAllByIdForUpdate(productIds)"));
        assertFalse(orderService.contains("redisTemplate"));
        assertFalse(orderService.contains("getOrdersByUserIdWithItems"));
        assertFalse(orderService.contains("checkItemStatus"));

        String couponService = Files.readString(Path.of("src/main/java/com/example/shop/service/CouponService.java"));
        String couponEntity = Files.readString(Path.of("src/main/java/com/example/shop/entity/Coupon.java"));
        assertTrue(couponService.contains("findByUserIdLimited(userId, limit)"));
        assertTrue(couponService.contains("findUnusedByUserIdLimited(userId, limit)"));
        assertTrue(couponService.contains("incrementUsedCount(userCoupon.getCouponId())"));
        assertFalse(couponService.contains("redisTemplate"));
        assertFalse(couponService.contains("getAvailableCoupons"));
        assertFalse(couponService.contains("isCouponCodeExists"));
        assertFalse(couponEntity.contains("private String code;"));

        String productService = Files.readString(Path.of("src/main/java/com/example/shop/service/impl/ProductServiceImpl.java"));
        assertTrue(productService.contains("private final ConcurrentMap<String, ProductSearchCacheEntry> productSearchCache"));
        assertTrue(productService.contains("runtimeConfig.getLong(\"product.search-cache-ttl-ms\", 30000)"));
        assertTrue(productService.contains("runtimeConfig.getInt(\"product.search-cache-max-entries\", 80)"));
        assertTrue(productService.contains("boundedRecommendationCandidates(personalizedCandidateTerms(pets), candidateWindow)"));
        assertTrue(productService.contains("findActiveByCategoryId(categoryId, PageRequest.of(0, 14))"));
        assertFalse(productService.contains("trendingProductCache"));
        assertFalse(productService.contains("newProductCache"));
        assertFalse(productService.contains("hotSearchCache"));
        assertFalse(productService.contains("ruleResultCache"));
        assertFalse(productService.contains("getHybridRecommendations"));
    }
}
