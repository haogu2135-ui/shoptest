package com.example.shop.controller;

import com.example.shop.dto.ProductReviewsResponse;
import com.example.shop.dto.ReviewCreateRequest;
import com.example.shop.dto.ReviewableOrderResponse;
import com.example.shop.dto.ReviewImageUploadResponse;
import com.example.shop.dto.PublicReviewResponse;
import com.example.shop.service.ReviewImageService;
import com.example.shop.service.ReviewService;
import com.example.shop.security.SecurityUtils;
import com.example.shop.security.UserDetailsImpl;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import javax.validation.constraints.Positive;
import java.util.List;

@RestController
@RequestMapping("/reviews")
@RequiredArgsConstructor
@Validated
public class ReviewController {

    private final ReviewService reviewService;
    private final ReviewImageService reviewImageService;

    @GetMapping("/product/{productId}")
    public ResponseEntity<ProductReviewsResponse> getProductReviews(@Positive @PathVariable Long productId,
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

    @GetMapping("/product/{productId}/reviewable-orders")
    public ResponseEntity<List<ReviewableOrderResponse>> getReviewableOrders(@Positive @PathVariable Long productId, Authentication authentication) {
        UserDetailsImpl userDetails = SecurityUtils.requireUser(authentication);
        List<ReviewableOrderResponse> orders = reviewService.getReviewableOrders(productId, userDetails.getId());
        return ResponseEntity.ok(orders);
    }

    @PostMapping("/product/{productId}")
    public ResponseEntity<PublicReviewResponse> addReview(
            @Positive @PathVariable Long productId,
            @Valid @RequestBody(required = false) ReviewCreateRequest request,
            Authentication authentication) {
        UserDetailsImpl userDetails = SecurityUtils.requireUser(authentication);
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Review payload is required");
        }
        return ResponseEntity.ok(PublicReviewResponse.from(reviewService.addReview(
            productId,
            userDetails.getId(),
            request.getOrderId(),
            request.getRating(),
            request.getComment(),
            request.getImageUrls()
        ), userDetails.getId()));
    }

    @PostMapping(value = "/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ReviewImageUploadResponse> uploadReviewImage(
            @RequestParam(value = "file", required = false) MultipartFile file,
            Authentication authentication) {
        SecurityUtils.requireUser(authentication);
        reviewImageService.validateUploadRequest(file);
        return ResponseEntity.ok(new ReviewImageUploadResponse(reviewImageService.upload(file)));
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
