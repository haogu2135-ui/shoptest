package com.shop.service;

import com.shop.dto.ReviewDTO;
import com.shop.entity.Review;
import com.shop.repository.ReviewRepository;
import com.shop.repository.UserRepository;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class ReviewService {
    private final ReviewRepository reviewRepository;
    private final UserRepository userRepository;

    public ReviewService(ReviewRepository reviewRepository, UserRepository userRepository) {
        this.reviewRepository = reviewRepository;
        this.userRepository = userRepository;
    }

    public List<ReviewDTO> getReviewsByProductId(Long productId) {
        return reviewRepository.findByProductIdOrderByCreatedAtDesc(productId)
                .stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    @Transactional
    public ReviewDTO addReview(Long userId, Long productId, Integer rating, String comment) {
        if (reviewRepository.existsByUserIdAndProductId(userId, productId)) {
            throw new RuntimeException("您已经评价过该商品");
        }

        Review review = new Review();
        review.setUserId(userId);
        review.setProductId(productId);
        review.setRating(rating);
        review.setComment(comment);

        return convertToDTO(reviewRepository.save(review));
    }

    public Double getAverageRating(Long productId) {
        return reviewRepository.getAverageRatingByProductId(productId);
    }

    private ReviewDTO convertToDTO(Review review) {
        ReviewDTO dto = new ReviewDTO();
        BeanUtils.copyProperties(review, dto);
        dto.setUsername(userRepository.findById(review.getUserId())
                .map(user -> user.getUsername())
                .orElse("未知用户"));
        return dto;
    }
} 