package com.example.shop.controller;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ReviewControllerProductIdValidationContractTest {

    @Test
    void reviewProductPathVariablesRequirePositiveIds() throws Exception {
        String source = Files.readString(
                Path.of("src/main/java/com/example/shop/controller/ReviewController.java"),
                StandardCharsets.UTF_8);

        assertTrue(source.contains("import org.springframework.validation.annotation.Validated;"),
                "ReviewController should enable Spring method validation");
        assertTrue(source.contains("import javax.validation.constraints.Positive;"),
                "ReviewController should import the positive id constraint");
        assertTrue(source.contains("@Validated\npublic class ReviewController"),
                "ReviewController should be annotated with @Validated");
        assertEquals(3, count(source, "@Positive @PathVariable Long productId"),
                "All review productId path variables should require positive values");

        String getProductReviews = sliceBetween(
                source,
                "getProductReviews(",
                "\n    @GetMapping(\"/product/{productId}/reviewable-orders\")");
        assertTrue(getProductReviews.contains("@Positive @PathVariable Long productId"),
                "GET /reviews/product/{productId} should validate productId");

        String reviewableOrders = sliceBetween(
                source,
                "getReviewableOrders(",
                "\n    @PostMapping(\"/product/{productId}\")");
        assertTrue(reviewableOrders.contains("@Positive @PathVariable Long productId"),
                "GET /reviews/product/{productId}/reviewable-orders should validate productId");

        String addReview = sliceBetween(
                source,
                "addReview(",
                "\n    @PostMapping(value = \"/images\"");
        assertTrue(addReview.contains("@Positive @PathVariable Long productId"),
                "POST /reviews/product/{productId} should validate productId");
    }

    private static int count(String source, String needle) {
        int count = 0;
        int index = source.indexOf(needle);
        while (index >= 0) {
            count++;
            index = source.indexOf(needle, index + needle.length());
        }
        return count;
    }

    private static String sliceBetween(String source, String startMarker, String endMarker) {
        int start = source.indexOf(startMarker);
        assertTrue(start >= 0, "Missing start marker: " + startMarker);
        int end = source.indexOf(endMarker, start + startMarker.length());
        assertTrue(end > start, "Missing end marker after " + startMarker + ": " + endMarker);
        return source.substring(start, end);
    }
}
