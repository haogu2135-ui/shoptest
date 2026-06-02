package com.example.shop.controller;

import com.example.shop.security.UserDetailsImpl;
import com.example.shop.service.ReviewService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequiredArgsConstructor
public class ProductReviewAliasController {
    private final ReviewService reviewService;

    @GetMapping("/products/{productId}/reviews")
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
}
