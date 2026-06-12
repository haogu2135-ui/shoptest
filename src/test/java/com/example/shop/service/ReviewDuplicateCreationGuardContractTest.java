package com.example.shop.service;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class ReviewDuplicateCreationGuardContractTest {

    @Test
    void reviewCreationRejectsDuplicateProductUserOrderReviews() throws Exception {
        String service = read("src/main/java/com/example/shop/service/impl/ReviewServiceImpl.java");
        String repository = read("src/main/java/com/example/shop/repository/ReviewRepository.java");
        String schema = read("src/main/resources/schema.sql");
        String baselineMigration = read("src/main/resources/db/migration/V1__init.sql");
        String uniqueMigration = read("src/main/resources/db/migration/V6__review_unique_product_user_order.sql");

        String addReview = section(service, "public Review addReview(", "private boolean isDuplicateReviewConstraintViolation");
        int existsCheck = addReview.indexOf("reviewRepository.existsByProduct_IdAndUser_IdAndOrderId(productId, userId, orderId)");
        int save = addReview.indexOf("reviewRepository.save(review)");

        assertTrue(existsCheck >= 0, "Review creation must check product/user/order duplicates before saving");
        assertTrue(save > existsCheck, "Duplicate check must run before reviewRepository.save(review)");
        assertTrue(addReview.contains("throw new IllegalStateException(\"This product has already been reviewed for this order\")"),
                "Duplicate review attempts must fail with a controlled business error");
        assertTrue(addReview.contains("catch (DataIntegrityViolationException ex)"),
                "Concurrent duplicate review races must be translated from database unique-key failures");
        assertTrue(addReview.contains("isDuplicateReviewConstraintViolation(ex)"),
                "Duplicate unique-key failures must be detected explicitly");

        assertTrue(repository.contains("existsByProduct_IdAndUser_IdAndOrderId(Long productId, Long userId, Long orderId)"),
                "ReviewRepository must expose the exact product/user/order duplicate lookup");
        assertTrue(schema.contains("UNIQUE INDEX uk_reviews_product_user_order (product_id, user_id, order_id)"),
                "Fresh schema must enforce one review per product/user/order");
        assertTrue(baselineMigration.contains("UNIQUE INDEX uk_reviews_product_user_order (product_id, user_id, order_id)"),
                "Baseline migration must enforce one review per product/user/order");
        assertTrue(uniqueMigration.contains("ALTER TABLE reviews ADD UNIQUE INDEX uk_reviews_product_user_order (product_id, user_id, order_id)"),
                "Existing databases must receive the review duplicate unique index");
    }

    private static String read(String path) throws Exception {
        return Files.readString(Path.of(path), StandardCharsets.UTF_8);
    }

    private static String section(String source, String startMarker, String endMarker) {
        int start = source.indexOf(startMarker);
        int end = source.indexOf(endMarker, Math.max(start, 0));
        assertTrue(start >= 0, "Missing source marker: " + startMarker);
        assertTrue(end > start, "Missing source marker: " + endMarker);
        return source.substring(start, end);
    }
}
