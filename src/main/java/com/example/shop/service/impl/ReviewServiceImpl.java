package com.example.shop.service.impl;

import com.example.shop.entity.Product;
import com.example.shop.entity.Order;
import com.example.shop.entity.OrderItem;
import com.example.shop.entity.Review;
import com.example.shop.entity.User;
import com.example.shop.repository.OrderItemRepository;
import com.example.shop.repository.OrderRepository;
import com.example.shop.repository.ProductRepository;
import com.example.shop.repository.ReviewRepository;
import com.example.shop.repository.UserRepository;
import com.example.shop.service.ReviewService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class ReviewServiceImpl implements ReviewService {

    @Autowired
    private ReviewRepository reviewRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private OrderItemRepository orderItemRepository;

    @Override
    public List<Review> getReviewsByProductId(Long productId) {
        return reviewRepository.findByProduct_IdAndStatusOrderByCreatedAtDesc(productId, "APPROVED");
    }

    @Override
    public double getAverageRating(Long productId) {
        return reviewRepository.findAverageRatingByProductId(productId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Review> getAllReviews() {
        return reviewRepository.findAll();
    }

    @Override
    @Transactional
    public void deleteReview(Long id) {
        reviewRepository.deleteById(id);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Order> getReviewableOrders(Long productId, Long userId) {
        LocalDateTime deadline = LocalDateTime.now().minusDays(30);
        return orderRepository.findByUserId(userId).stream()
                .filter(order -> "COMPLETED".equals(order.getStatus()))
                .filter(order -> order.getCreatedAt() != null && !order.getCreatedAt().isBefore(deadline))
                .filter(order -> orderItemRepository.findByOrderIdAndProductId(order.getId(), productId) != null)
                .filter(order -> !reviewRepository.existsByProduct_IdAndUser_IdAndOrderId(productId, userId, order.getId()))
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public Review addReview(Long productId, Long userId, Long orderId, int rating, String comment) {
        Optional<Product> productOpt = productRepository.findById(productId);
        Optional<User> userOpt = userRepository.findById(userId);

        if (productOpt.isEmpty() || userOpt.isEmpty()) {
            throw new IllegalArgumentException("Product or User not found");
        }
        if (rating < 1 || rating > 5) {
            throw new IllegalArgumentException("Rating must be between 1 and 5");
        }
        if (comment == null || comment.trim().isEmpty()) {
            throw new IllegalArgumentException("Comment is required");
        }

        Order order = orderRepository.findById(orderId);
        if (order == null || !userId.equals(order.getUserId())) {
            throw new IllegalArgumentException("Order not found");
        }
        if (!"COMPLETED".equals(order.getStatus())) {
            throw new IllegalStateException("Only completed orders can be reviewed");
        }
        if (order.getCreatedAt() == null || order.getCreatedAt().isBefore(LocalDateTime.now().minusDays(30))) {
            throw new IllegalStateException("Review period has expired");
        }
        OrderItem item = orderItemRepository.findByOrderIdAndProductId(orderId, productId);
        if (item == null) {
            throw new IllegalArgumentException("This product was not purchased in the selected order");
        }
        if (reviewRepository.existsByProduct_IdAndUser_IdAndOrderId(productId, userId, orderId)) {
            throw new IllegalStateException("This product has already been reviewed for this order");
        }

        Review review = new Review();
        review.setProduct(productOpt.get());
        review.setUser(userOpt.get());
        review.setOrderId(orderId);
        review.setRating(rating);
        review.setComment(comment.trim());
        review.setStatus("PENDING");

        return reviewRepository.save(review);
    }

    @Override
    @Transactional
    public Review replyReview(Long id, String reply) {
        Review review = reviewRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Review not found"));
        if (reply == null || reply.trim().isEmpty()) {
            throw new IllegalArgumentException("Reply is required");
        }
        review.setAdminReply(reply.trim());
        review.setRepliedAt(LocalDateTime.now());
        return reviewRepository.save(review);
    }

    @Override
    @Transactional
    public Review updateReviewStatus(Long id, String status) {
        Review review = reviewRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Review not found"));
        String normalized = status == null ? "" : status.trim().toUpperCase();
        if (!"PENDING".equals(normalized) && !"APPROVED".equals(normalized) && !"HIDDEN".equals(normalized)) {
            throw new IllegalArgumentException("Unsupported review status");
        }
        review.setStatus(normalized);
        return reviewRepository.save(review);
    }
} 
