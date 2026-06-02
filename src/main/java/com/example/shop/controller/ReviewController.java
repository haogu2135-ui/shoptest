package com.example.shop.controller;

import com.example.shop.dto.ReviewableOrderResponse;
import com.example.shop.dto.PublicReviewResponse;
import com.example.shop.service.ReviewService;
import com.example.shop.security.SecurityUtils;
import com.example.shop.security.UserDetailsImpl;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.List;

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
            "reviews", reviewService.getPublicReviewsByProductId(productId, currentUserId),
            "averageRating", reviewService.getAverageRating(productId)
        ));
    }

    @GetMapping("/product/{productId}/reviewable-orders")
    public ResponseEntity<?> getReviewableOrders(@PathVariable Long productId, Authentication authentication) {
        UserDetailsImpl userDetails = SecurityUtils.requireUser(authentication);
        List<ReviewableOrderResponse> orders = reviewService.getReviewableOrders(productId, userDetails.getId());
        return ResponseEntity.ok(orders);
    }

    @PostMapping("/product/{productId}")
    public ResponseEntity<?> addReview(
            @PathVariable Long productId,
            @RequestBody(required = false) Map<String, Object> request,
            Authentication authentication) {
        UserDetailsImpl userDetails = SecurityUtils.requireUser(authentication);
        if (request == null) {
            throw new IllegalArgumentException("Review payload is required");
        }
        Long orderId = parseLong(request.get("orderId"), "orderId");
        Integer rating = parseRating(request.get("rating"));
        return ResponseEntity.ok(PublicReviewResponse.from(reviewService.addReview(
            productId,
            userDetails.getId(),
            orderId,
            rating,
            request.get("comment") == null ? "" : String.valueOf(request.get("comment"))
        ), userDetails.getId()));
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
