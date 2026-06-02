package com.example.shop.dto;

import com.example.shop.entity.Product;
import com.example.shop.entity.Review;
import com.example.shop.entity.User;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class AdminReviewResponse {
    private Long id;
    private Long productId;
    private String productName;
    private String productImageUrl;
    private Long userId;
    private String username;
    private int rating;
    private String comment;
    private String status;
    private Long orderId;
    private String adminReply;
    private LocalDateTime repliedAt;
    private LocalDateTime createdAt;

    public static AdminReviewResponse from(Review review) {
        AdminReviewResponse response = new AdminReviewResponse();
        if (review == null) {
            return response;
        }
        Product product = review.getProduct();
        User user = review.getUser();
        response.setId(review.getId());
        response.setProductId(product == null ? review.getProductId() : product.getId());
        response.setProductName(product == null ? null : product.getName());
        response.setProductImageUrl(product == null ? null : product.getImageUrl());
        response.setUserId(user == null ? review.getUserId() : user.getId());
        response.setUsername(user == null ? review.getUsername() : user.getUsername());
        response.setRating(review.getRating());
        response.setComment(review.getComment());
        response.setStatus(review.getStatus());
        response.setOrderId(review.getOrderId());
        response.setAdminReply(review.getAdminReply());
        response.setRepliedAt(review.getRepliedAt());
        response.setCreatedAt(review.getCreatedAt());
        return response;
    }
}
