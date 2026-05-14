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
            Review review = reviewService.addReview(
                productId,
                userDetails.getId(),
                Long.parseLong(request.get("orderId").toString()),
                Integer.parseInt(request.get("rating").toString()),
                (String) request.get("comment")
            );
            return ResponseEntity.ok(review);
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Review failed"));
        }
    }
} 
