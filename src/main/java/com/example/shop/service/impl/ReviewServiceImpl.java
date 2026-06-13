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
import com.example.shop.util.ReviewImageUrlCodec;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class ReviewServiceImpl implements ReviewService {
    private static final BigDecimal ZERO_REVIEW_STAT = BigDecimal.ZERO.setScale(1);
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
    @Transactional(rollbackFor = Exception.class, readOnly = true)
    public List<PublicReviewResponse> getPublicReviewsByProductId(Long productId, Long currentUserId) {
        return getPublicReviewsByProductId(productId, currentUserId, 0, normalizedPublicMaxRows());
    }

    @Override
    @Transactional(rollbackFor = Exception.class, readOnly = true)
    public List<PublicReviewResponse> getPublicReviewsByProductId(Long productId, Long currentUserId, int page, int size) {
        if (!isPublicProduct(productId)) {
            return List.of();
        }
        int safePage = Math.max(0, page);
        int limit = normalizedPublicPageSize(size);
        List<Review> reviews;
        if (currentUserId != null) {
            reviews = reviewRepository.findPublicByProductIdIncludingUserPending(productId, currentUserId, PageRequest.of(safePage, limit));
        } else {
            reviews = reviewRepository.findApprovedPublicByProductId(productId, PageRequest.of(safePage, limit));
        }
        return reviews.stream()
                .map(review -> PublicReviewResponse.from(review, currentUserId))
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(rollbackFor = Exception.class, readOnly = true)
    public long countPublicReviewsByProductId(Long productId, Long currentUserId) {
        if (!isPublicProduct(productId)) {
            return 0;
        }
        if (currentUserId != null) {
            return reviewRepository.countPublicByProductIdIncludingUserPending(productId, currentUserId);
        }
        return reviewRepository.countByProduct_IdAndStatus(productId, "APPROVED");
    }

    @Override
    @Transactional(rollbackFor = Exception.class, readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public BigDecimal getAverageRating(Long productId) {
        if (!isPublicProduct(productId)) {
            return ZERO_REVIEW_STAT;
        }
        return reviewStatDecimal(reviewRepository.findAverageRatingByProductId(productId));
    }

    @Override
    @Transactional(rollbackFor = Exception.class, readOnly = true)
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
    @Transactional(rollbackFor = Exception.class, readOnly = true)
    public List<AdminReviewResponse> searchAdminReviewResponses(String status, String search, int page, int size) {
        return searchAdminReviews(status, search, page, size).stream()
                .map(AdminReviewResponse::from)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(rollbackFor = Exception.class, readOnly = true)
    public long countAdminReviews(String status, String search) {
        return reviewRepository.countAdminReviews(normalizeAdminStatus(status), blankToNull(search), parseSearchId(search));
    }

    @Override
    @Transactional(rollbackFor = Exception.class, readOnly = true)
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
    @Transactional(rollbackFor = Exception.class)
    public void deleteReview(Long id) {
        reviewRepository.deleteById(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class, readOnly = true)
    public List<ReviewableOrderResponse> getReviewableOrders(Long productId, Long userId) {
        if (!isPublicProduct(productId)) {
            return List.of();
        }
        LocalDateTime deadline = LocalDateTime.now().minusDays(30);
        int limit = normalizedReviewableOrderMaxRows();
        return orderRepository.findReviewableOrdersByUserAndProduct(userId, productId, deadline, limit).stream()
                .limit(limit)
                .map(ReviewableOrderResponse::from)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Review addReview(Long productId, Long userId, Long orderId, int rating, String comment, List<String> imageUrls) {
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
        List<String> normalizedImageUrls = normalizeReviewImageUrls(imageUrls);

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
        review.setImageUrls(ReviewImageUrlCodec.toJson(normalizedImageUrls));
        review.setStatus("PENDING");

        try {
            return reviewRepository.save(review);
        } catch (DataIntegrityViolationException ex) {
            if (isDuplicateReviewConstraintViolation(ex)) {
                throw new IllegalStateException("This product has already been reviewed for this order", ex);
            }
            throw ex;
        }
    }

    private boolean isDuplicateReviewConstraintViolation(DataIntegrityViolationException ex) {
        String message = String.valueOf(ex.getMostSpecificCause() == null ? ex.getMessage() : ex.getMostSpecificCause().getMessage())
                .toLowerCase(Locale.ROOT);
        return message.contains("uk_reviews_product_user_order")
                || (message.contains("duplicate") && message.contains("review"));
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
    @Transactional(rollbackFor = Exception.class)
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
    @Transactional(rollbackFor = Exception.class)
    public AdminReviewResponse replyReviewForAdmin(Long id, String reply) {
        return AdminReviewResponse.from(replyReview(id, reply));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
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
    @Transactional(rollbackFor = Exception.class)
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

    private static BigDecimal reviewStatDecimal(Number value) {
        if (value == null) {
            return ZERO_REVIEW_STAT;
        }
        return BigDecimal.valueOf(value.doubleValue()).setScale(1, RoundingMode.HALF_UP);
    }

    private List<String> normalizeReviewImageUrls(List<String> imageUrls) {
        if (imageUrls == null || imageUrls.isEmpty()) {
            return List.of();
        }
        int maxImages = normalizedMaxImages();
        if (maxImages <= 0) {
            return List.of();
        }
        LinkedHashSet<String> unique = new LinkedHashSet<>();
        for (String candidate : imageUrls) {
            String normalized = normalizeReviewImageUrl(candidate);
            if (normalized.isEmpty()) {
                continue;
            }
            unique.add(normalized);
            if (unique.size() > maxImages) {
                throw new IllegalArgumentException("Review supports up to " + maxImages + " images");
            }
        }
        return List.copyOf(unique);
    }

    private String normalizeReviewImageUrl(String value) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.isEmpty()) {
            return "";
        }
        if (normalized.length() > 2048) {
            throw new IllegalArgumentException("Review image URL is too long");
        }
        String publicPath = normalizedReviewImagePublicPath();
        String prefix = publicPath + "/";
        if (!normalized.startsWith(prefix)) {
            throw new IllegalArgumentException("Review images must be uploaded before submitting");
        }
        String filename = normalized.substring(prefix.length());
        if (filename.isEmpty() || filename.contains("/") || filename.contains("\\") || filename.contains("..")) {
            throw new IllegalArgumentException("Review image URL is invalid");
        }
        if (!filename.matches("[0-9a-fA-F-]{36}\\.(jpg|png)")) {
            throw new IllegalArgumentException("Review image URL is invalid");
        }
        return prefix + filename;
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

    private int normalizedPublicPageSize(int size) {
        int defaultSize = normalizedPublicMaxRows();
        int normalizedSize = size <= 0 ? defaultSize : size;
        return Math.max(1, Math.min(normalizedSize, 100));
    }

    private int normalizedReviewableOrderMaxRows() {
        return Math.max(1, Math.min(runtimeConfig.getInt("review.reviewable-order-max-rows", 50), 100));
    }

    private int normalizedMaxImages() {
        return Math.max(0, Math.min(runtimeConfig.getInt("review.max-images", 4), 8));
    }

    private String normalizedReviewImagePublicPath() {
        String configured = runtimeConfig.getString("review.image.public-path", "/uploads/reviews");
        String normalized = configured == null ? "/uploads/reviews" : configured.trim();
        if (normalized.isEmpty()) {
            normalized = "/uploads/reviews";
        }
        if (!normalized.startsWith("/")) {
            normalized = "/" + normalized;
        }
        return normalized.replaceAll("/$", "");
    }
}
