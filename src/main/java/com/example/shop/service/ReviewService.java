package com.example.shop.service;

import com.example.shop.entity.Review;
import com.example.shop.entity.Order;
import java.util.List;

public interface ReviewService {
    List<Review> getReviewsByProductId(Long productId);
    double getAverageRating(Long productId);
    Review addReview(Long productId, Long userId, Long orderId, int rating, String comment);
    Review replyReview(Long id, String reply);
    Review updateReviewStatus(Long id, String status);
    List<Review> getAllReviews();
    void deleteReview(Long id);
    List<Order> getReviewableOrders(Long productId, Long userId);
} 
