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
import com.example.shop.service.RuntimeConfigService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
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
    @Autowired
    private RuntimeConfigService runtimeConfig;

    @Override
    public List<Review> getReviewsByProductId(Long productId, Long currentUserId) {
        if (!isPublicProduct(productId)) {
            return List.of();
        }
        if (currentUserId != null) {
            return reviewRepository.findByProductIdIncludingUserPending(productId, currentUserId);
        }
        return reviewRepository.findByProduct_IdAndStatusOrderByCreatedAtDesc(productId, "APPROVED");
    }

    @Override
    public double getAverageRating(Long productId) {
        if (!isPublicProduct(productId)) {
            return 0;
        }
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
        if (!isPublicProduct(productId)) {
            return List.of();
        }
        LocalDateTime deadline = LocalDateTime.now().minusDays(30);
        List<Order> recentCompletedOrders = orderRepository.findByUserId(userId).stream()
                .filter(order -> "COMPLETED".equals(order.getStatus()))
                .filter(order -> order.getCreatedAt() != null && !order.getCreatedAt().isBefore(deadline))
                .collect(Collectors.toList());
        if (recentCompletedOrders.isEmpty()) {
            return List.of();
        }

        List<Long> orderIds = recentCompletedOrders.stream()
                .map(Order::getId)
                .filter(id -> id != null && id > 0)
                .distinct()
                .collect(Collectors.toList());
        if (orderIds.isEmpty()) {
            return List.of();
        }

        Set<Long> ordersWithProduct = orderItemRepository.findByOrderIds(orderIds).stream()
                .filter(item -> productId.equals(item.getProductId()))
                .map(OrderItem::getOrderId)
                .collect(Collectors.toSet());
        if (ordersWithProduct.isEmpty()) {
            return List.of();
        }

        Set<Long> reviewedOrderIds = reviewRepository.findByProduct_IdAndUser_IdAndOrderIdIn(productId, userId, orderIds).stream()
                .map(Review::getOrderId)
                .collect(Collectors.toCollection(HashSet::new));

        return recentCompletedOrders.stream()
                .filter(order -> ordersWithProduct.contains(order.getId()))
                .filter(order -> !reviewedOrderIds.contains(order.getId()))
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
        Product product = productOpt.get();
        if (product.getStatus() != null && !"ACTIVE".equalsIgnoreCase(product.getStatus())) {
            throw new IllegalStateException("Product is not available");
        }
        if (rating < 1 || rating > 5) {
            throw new IllegalArgumentException("Rating must be between 1 and 5");
        }
        String normalizedComment = normalizeReviewText(comment, normalizedMaxCommentChars(), "Comment");
        if (normalizedComment.isEmpty()) {
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
        review.setProduct(product);
        review.setUser(userOpt.get());
        review.setOrderId(orderId);
        review.setRating(rating);
        review.setComment(normalizedComment);
        review.setStatus("PENDING");

        return reviewRepository.save(review);
    }

    private boolean isPublicProduct(Long productId) {
        if (productId == null) {
            return false;
        }
        return productRepository.findById(productId)
                .map(product -> product.getStatus() == null || "ACTIVE".equalsIgnoreCase(product.getStatus()))
                .orElse(false);
    }

    @Override
    @Transactional
    public Review replyReview(Long id, String reply) {
        Review review = reviewRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Review not found"));
        String normalizedReply = normalizeReviewText(reply, normalizedMaxReplyChars(), "Reply");
        if (normalizedReply.isEmpty()) {
            throw new IllegalArgumentException("Reply is required");
        }
        review.setAdminReply(normalizedReply);
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

    private String normalizeReviewText(String value, int maxChars, String label) {
        String normalized = String.valueOf(value == null ? "" : value)
                .replaceAll("[\\p{Cntrl}&&[^\r\n\t]]", " ")
                .trim()
                .replaceAll("\\s+", " ");
        if (normalized.length() > maxChars) {
            throw new IllegalArgumentException(label + " is too long");
        }
        return normalized;
    }

    private int normalizedMaxCommentChars() {
        return Math.max(20, runtimeConfig.getInt("review.max-comment-chars", 1000));
    }

    private int normalizedMaxReplyChars() {
        return Math.max(20, runtimeConfig.getInt("review.max-reply-chars", 1000));
    }
} 
