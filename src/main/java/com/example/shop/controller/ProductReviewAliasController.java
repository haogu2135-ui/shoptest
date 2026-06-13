package com.example.shop.controller;

import com.example.shop.dto.ProductReviewsResponse;
import com.example.shop.security.UserDetailsImpl;
import com.example.shop.service.ReviewService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequiredArgsConstructor
public class ProductReviewAliasController {
    private final ReviewService reviewService;

    @GetMapping("/products/{productId}/reviews")
    public ResponseEntity<ProductReviewsResponse> getProductReviews(@PathVariable Long productId,
                                                                    @RequestParam(required = false) Integer page,
                                                                    @RequestParam(required = false) Integer size,
                                                                    Authentication authentication) {
        Long currentUserId = null;
        if (authentication != null && authentication.getPrincipal() instanceof UserDetailsImpl) {
            currentUserId = ((UserDetailsImpl) authentication.getPrincipal()).getId();
        }
        int safePage = safePublicReviewPage(page);
        int safeSize = safePublicReviewSize(size);
        return ResponseEntity.ok(new ProductReviewsResponse(
                reviewService.getPublicReviewsByProductId(productId, currentUserId, safePage, safeSize),
                reviewService.getAverageRating(productId),
                reviewService.countPublicReviewsByProductId(productId, currentUserId),
                safePage,
                safeSize
        ));
    }

    private int safePublicReviewPage(Integer page) {
        if (page != null && page < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "page must be greater than or equal to 0");
        }
        return page == null ? 0 : page;
    }

    private int safePublicReviewSize(Integer size) {
        if (size != null && size < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "size must be greater than or equal to 1");
        }
        if (size != null && size > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "size must be less than or equal to 100");
        }
        return size == null ? 20 : size;
    }
}
