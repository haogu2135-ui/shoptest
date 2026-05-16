package com.example.shop.controller;

import com.example.shop.entity.Review;
import com.example.shop.service.ReviewService;
import com.example.shop.security.UserDetailsImpl;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.List;
import com.example.shop.entity.Order;

@RestController
@RequestMapping("/reviews")
@RequiredArgsConstructor
public class ReviewController {

    private final ReviewService reviewService;

    @GetMapping("/product/{productId}")
    public ResponseEntity<Map<String, Object>> getProductReviews(@PathVariable Long productId, Authentication authentication) {
        Long currentUserId = null;
        if (authentication != null && authentication.getPrincipal() instanceof UserDetailsImpl) {
            currentUserId = ((UserDetailsImpl) authentication.getPrincipal()).getId();
        }
        return ResponseEntity.ok(Map.of(
            "reviews", reviewService.getReviewsByProductId(productId, currentUserId),
            "averageRating", reviewService.getAverageRating(productId)
        ));
    }

    @GetMapping("/product/{productId}/reviewable-orders")
    public ResponseEntity<?> getReviewableOrders(@PathVariable Long productId, Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof UserDetailsImpl)) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();
        List<Order> orders = reviewService.getReviewableOrders(productId, userDetails.getId());
        return ResponseEntity.ok(orders);
    }

    @PostMapping("/product/{productId}")
    public ResponseEntity<?> addReview(
            @PathVariable Long productId,
            @RequestBody Map<String, Object> request,
            Authentication authentication) {
        try {
            if (authentication == null || !(authentication.getPrincipal() instanceof UserDetailsImpl)) {
                return ResponseEntity.status(401).build();
            }
            UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();
            Long orderId = parseLong(request.get("orderId"), "orderId");
            Integer rating = parseRating(request.get("rating"));
            Review review = reviewService.addReview(
                productId,
                userDetails.getId(),
                orderId,
                rating,
                request.get("comment") == null ? "" : String.valueOf(request.get("comment"))
            );
            return ResponseEntity.ok(review);
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Review failed"));
        }
    }

    private Long parseLong(Object value, String field) {
        if (value == null || String.valueOf(value).trim().isEmpty()) {
            throw new IllegalArgumentException(field + " is required");
        }
        try {
            return Long.parseLong(String.valueOf(value).trim());
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException(field + " is invalid");
        }
    }

    private Integer parseRating(Object value) {
        if (value == null || String.valueOf(value).trim().isEmpty()) {
            throw new IllegalArgumentException("rating is required");
        }
        try {
            int rating = Integer.parseInt(String.valueOf(value).trim());
            if (rating < 1 || rating > 5) {
                throw new IllegalArgumentException("rating must be between 1 and 5");
            }
            return rating;
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("rating is invalid");
        }
    }
} 
