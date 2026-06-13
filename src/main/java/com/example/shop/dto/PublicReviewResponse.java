package com.example.shop.dto;

import com.example.shop.entity.Review;
import com.example.shop.util.ReviewImageUrlCodec;

import java.time.LocalDateTime;
import java.util.List;

public class PublicReviewResponse {
    private Long id;
    private Long productId;
    private int rating;
    private String comment;
    private List<String> imageUrls;
    private String username;
    private String adminReply;
    private LocalDateTime repliedAt;
    private LocalDateTime createdAt;
    private boolean editableByCurrentUser;

    public static PublicReviewResponse from(Review review, Long currentUserId) {
        PublicReviewResponse response = new PublicReviewResponse();
        if (review == null) {
            return response;
        }
        response.setId(review.getId());
        response.setProductId(review.getProductId());
        response.setRating(review.getRating());
        response.setComment(review.getComment());
        response.setImageUrls(ReviewImageUrlCodec.parse(review.getImageUrls()));
        response.setUsername(maskUsername(review.getUsername()));
        response.setAdminReply(review.getAdminReply());
        response.setRepliedAt(review.getRepliedAt());
        response.setCreatedAt(review.getCreatedAt());
        response.setEditableByCurrentUser(currentUserId != null && currentUserId.equals(review.getUserId()));
        return response;
    }

    private static String maskUsername(String username) {
        String value = username == null ? "" : username.trim();
        if (value.isEmpty()) {
            return "Pet parent";
        }
        if (value.length() <= 2) {
            return value.charAt(0) + "***";
        }
        return value.charAt(0) + "***" + value.charAt(value.length() - 1);
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getProductId() {
        return productId;
    }

    public void setProductId(Long productId) {
        this.productId = productId;
    }

    public int getRating() {
        return rating;
    }

    public void setRating(int rating) {
        this.rating = rating;
    }

    public String getComment() {
        return comment;
    }

    public void setComment(String comment) {
        this.comment = comment;
    }

    public List<String> getImageUrls() {
        return imageUrls;
    }

    public void setImageUrls(List<String> imageUrls) {
        this.imageUrls = imageUrls;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getAdminReply() {
        return adminReply;
    }

    public void setAdminReply(String adminReply) {
        this.adminReply = adminReply;
    }

    public LocalDateTime getRepliedAt() {
        return repliedAt;
    }

    public void setRepliedAt(LocalDateTime repliedAt) {
        this.repliedAt = repliedAt;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public boolean isEditableByCurrentUser() {
        return editableByCurrentUser;
    }

    public void setEditableByCurrentUser(boolean editableByCurrentUser) {
        this.editableByCurrentUser = editableByCurrentUser;
    }
}
