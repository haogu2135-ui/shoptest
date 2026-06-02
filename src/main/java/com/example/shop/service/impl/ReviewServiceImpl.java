package com.example.shop.service.impl;

import com.example.shop.dto.AdminReviewResponse;
import com.example.shop.dto.PublicReviewResponse;
import com.example.shop.dto.ReviewableOrderResponse;
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
import org.springframework.data.domain.PageRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class ReviewServiceImpl implements ReviewService {
    private static final Pattern HTML_COMMENT_PATTERN = Pattern.compile("(?is)<!--.*?-->");
    private static final Pattern HTML_BLOCK_PATTERN = Pattern.compile("(?is)<(script|style|iframe|object|embed|svg|math)\\b[^>]*>.*?</\\1\\s*>");
    private static final Pattern HTML_TAG_PATTERN = Pattern.compile("(?is)<[^>]+>");

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
    @Transactional(readOnly = true)
    public List<PublicReviewResponse> getPublicReviewsByProductId(Long productId, Long currentUserId) {
        if (!isPublicProduct(productId)) {
            return List.of();
        }
        int limit = normalizedPublicMaxRows();
        List<Review> reviews;
        if (currentUserId != null) {
            reviews = reviewRepository.findPublicByProductIdIncludingUserPending(productId, currentUserId, PageRequest.of(0, limit));
        } else {
            reviews = reviewRepository.findApprovedPublicByProductId(productId, PageRequest.of(0, limit));
        }
        return reviews.stream()
                .map(review -> PublicReviewResponse.from(review, currentUserId))
                .collect(Collectors.toList());
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
    @Transactional(readOnly = true)
    public List<Review> searchAdminReviews(String status, String search, int page, int size) {
        int safeSize = Math.max(1, Math.min(size <= 0 ? 20 : size, 1000));
        int safePage = Math.max(1, page);
        return reviewRepository.searchAdminReviews(
                normalizeAdminStatus(status),
                blankToNull(search),
                parseSearchId(search),
                PageRequest.of(safePage - 1, safeSize));
    }

    @Override
    @Transactional(readOnly = true)
    public List<AdminReviewResponse> searchAdminReviewResponses(String status, String search, int page, int size) {
        return searchAdminReviews(status, search, page, size).stream()
                .map(AdminReviewResponse::from)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public long countAdminReviews(String status, String search) {
        return reviewRepository.countAdminReviews(normalizeAdminStatus(status), blankToNull(search), parseSearchId(search));
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Number> summarizeAdminReviews(String status, String search) {
        String normalizedStatus = normalizeAdminStatus(status);
        String normalizedSearch = blankToNull(search);
        Long searchId = parseSearchId(search);
        Map<String, Number> summary = new LinkedHashMap<>();
        for (String candidateStatus : List.of("PENDING", "APPROVED", "HIDDEN")) {
            summary.put(candidateStatus,
                    normalizedStatus == null || candidateStatus.equals(normalizedStatus)
                            ? countAdminReviews(candidateStatus, search)
                            : 0);
        }
        summary.put("LOW_RATING", reviewRepository.countAdminLowRatingReviews(normalizedStatus, normalizedSearch, searchId, 3));
        summary.put("NEEDS_REPLY", reviewRepository.countAdminNeedsReplyReviews(normalizedStatus, normalizedSearch, searchId));
        summary.put("AVERAGE_RATING", reviewRepository.averageAdminReviewRating(normalizedStatus, normalizedSearch, searchId));
        return summary;
    }

    @Override
    @Transactional
    public void deleteReview(Long id) {
        reviewRepository.deleteById(id);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ReviewableOrderResponse> getReviewableOrders(Long productId, Long userId) {
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
                .limit(normalizedReviewableOrderMaxRows())
                .map(ReviewableOrderResponse::from)
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
    public AdminReviewResponse replyReviewForAdmin(Long id, String reply) {
        return AdminReviewResponse.from(replyReview(id, reply));
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

    @Override
    @Transactional
    public AdminReviewResponse updateReviewStatusForAdmin(Long id, String status) {
        return AdminReviewResponse.from(updateReviewStatus(id, status));
    }

    private String normalizeReviewText(String value, int maxChars, String label) {
        String normalized = stripHtml(String.valueOf(value == null ? "" : value))
                .replaceAll("[\\p{Cntrl}&&[^\r\n\t]]", " ")
                .trim()
                .replaceAll("\\s+", " ");
        if (normalized.length() > maxChars) {
            throw new IllegalArgumentException(label + " is too long");
        }
        return normalized;
    }

    private String stripHtml(String value) {
        String stripped = HTML_COMMENT_PATTERN.matcher(value == null ? "" : value).replaceAll(" ");
        String previous;
        do {
            previous = stripped;
            stripped = HTML_BLOCK_PATTERN.matcher(stripped).replaceAll(" ");
        } while (!previous.equals(stripped));
        stripped = HTML_TAG_PATTERN.matcher(stripped).replaceAll(" ");
        return decodeCommonHtmlEntities(stripped);
    }

    private String decodeCommonHtmlEntities(String value) {
        return value
                .replace("&nbsp;", " ")
                .replace("&amp;", "&")
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&quot;", "\"")
                .replace("&#39;", "'")
                .replace("&apos;", "'");
    }

    private String normalizeAdminStatus(String status) {
        String normalized = status == null ? "" : status.trim().toUpperCase(Locale.ROOT);
        if ("PENDING".equals(normalized) || "APPROVED".equals(normalized) || "HIDDEN".equals(normalized)) {
            return normalized;
        }
        return null;
    }

    private String blankToNull(String value) {
        String normalized = value == null ? "" : value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private Long parseSearchId(String search) {
        String normalized = search == null ? "" : search.trim();
        if (!normalized.matches("\\d{1,18}")) {
            return null;
        }
        try {
            return Long.parseLong(normalized);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private int normalizedMaxCommentChars() {
        return Math.max(20, runtimeConfig.getInt("review.max-comment-chars", 1000));
    }

    private int normalizedMaxReplyChars() {
        return Math.max(20, runtimeConfig.getInt("review.max-reply-chars", 1000));
    }

    private int normalizedPublicMaxRows() {
        return Math.max(1, Math.min(runtimeConfig.getInt("review.public-max-rows", 20), 100));
    }

    private int normalizedReviewableOrderMaxRows() {
        return Math.max(1, Math.min(runtimeConfig.getInt("review.reviewable-order-max-rows", 50), 100));
    }
} 
