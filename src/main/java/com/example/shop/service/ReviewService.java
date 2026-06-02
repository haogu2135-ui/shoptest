package com.example.shop.service;

import com.example.shop.dto.AdminReviewResponse;
import com.example.shop.dto.PublicReviewResponse;
import com.example.shop.dto.ReviewableOrderResponse;
import com.example.shop.entity.Review;
import java.util.Map;
import java.util.List;

public interface ReviewService {
    List<PublicReviewResponse> getPublicReviewsByProductId(Long productId, Long currentUserId);
    double getAverageRating(Long productId);
    Review addReview(Long productId, Long userId, Long orderId, int rating, String comment);
    Review replyReview(Long id, String reply);
    Review updateReviewStatus(Long id, String status);
    List<Review> getAllReviews();
    List<Review> searchAdminReviews(String status, String search, int page, int size);
    List<AdminReviewResponse> searchAdminReviewResponses(String status, String search, int page, int size);
    long countAdminReviews(String status, String search);
    Map<String, Number> summarizeAdminReviews(String status, String search);
    void deleteReview(Long id);
    AdminReviewResponse replyReviewForAdmin(Long id, String reply);
    AdminReviewResponse updateReviewStatusForAdmin(Long id, String status);
    List<ReviewableOrderResponse> getReviewableOrders(Long productId, Long userId);
} 
