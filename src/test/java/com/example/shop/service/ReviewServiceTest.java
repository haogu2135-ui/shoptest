package com.example.shop.service;

import com.example.shop.dto.ReviewableOrderResponse;
import com.example.shop.entity.Order;
import com.example.shop.entity.OrderItem;
import com.example.shop.entity.Product;
import com.example.shop.entity.Review;
import com.example.shop.entity.User;
import com.example.shop.repository.OrderItemRepository;
import com.example.shop.repository.OrderRepository;
import com.example.shop.repository.ProductRepository;
import com.example.shop.repository.ReviewRepository;
import com.example.shop.repository.UserRepository;
import com.example.shop.service.impl.ReviewServiceImpl;
import com.example.shop.util.ReviewImageUrlCodec;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ReviewServiceTest {
    private ReviewRepository reviewRepository;
    private ProductRepository productRepository;
    private OrderRepository orderRepository;
    private OrderItemRepository orderItemRepository;
    private ReviewServiceImpl service;
    private RuntimeConfigService runtimeConfig;

    @BeforeEach
    void setUp() {
        reviewRepository = mock(ReviewRepository.class);
        productRepository = mock(ProductRepository.class);
        UserRepository userRepository = mock(UserRepository.class);
        orderRepository = mock(OrderRepository.class);
        orderItemRepository = mock(OrderItemRepository.class);
        runtimeConfig = mock(RuntimeConfigService.class);
        service = new ReviewServiceImpl();
        ReflectionTestUtils.setField(service, "reviewRepository", reviewRepository);
        ReflectionTestUtils.setField(service, "productRepository", productRepository);
        ReflectionTestUtils.setField(service, "userRepository", userRepository);
        ReflectionTestUtils.setField(service, "orderRepository", orderRepository);
        ReflectionTestUtils.setField(service, "orderItemRepository", orderItemRepository);
        ReflectionTestUtils.setField(service, "runtimeConfig", runtimeConfig);
        when(runtimeConfig.getInt("review.max-comment-chars", 1000)).thenReturn(80);
        when(runtimeConfig.getInt("review.max-reply-chars", 1000)).thenReturn(80);
        when(runtimeConfig.getInt("review.max-images", 4)).thenReturn(4);
        when(runtimeConfig.getString("review.image.public-path", "/uploads/reviews")).thenReturn("/uploads/reviews");

        Product product = new Product();
        product.setId(7L);
        product.setStatus("ACTIVE");
        User user = new User();
        user.setId(3L);
        Order order = new Order();
        order.setId(11L);
        order.setUserId(3L);
        order.setStatus("COMPLETED");
        order.setCreatedAt(LocalDateTime.now());

        when(productRepository.findById(7L)).thenReturn(Optional.of(product));
        when(userRepository.findById(3L)).thenReturn(Optional.of(user));
        when(orderRepository.findById(11L)).thenReturn(order);
        when(orderItemRepository.findByOrderIdAndProductId(11L, 7L)).thenReturn(new OrderItem());
        when(reviewRepository.save(any(Review.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void normalizesReviewCommentBeforeSaving() {
        Review saved = service.addReview(7L, 3L, 11L, 5, "  Great\tfit\nfor\u0000my dog.  ", List.of());

        assertEquals("Great fit for my dog.", saved.getComment());
        verify(reviewRepository).save(any(Review.class));
    }

    @Test
    void rejectsOverlongReviewCommentBeforeSaving() {
        assertThrows(IllegalArgumentException.class, () -> service.addReview(7L, 3L, 11L, 5, "x".repeat(81), List.of()));
    }

    @Test
    void storesUploadedReviewImageUrls() {
        Review saved = service.addReview(
                7L,
                3L,
                11L,
                5,
                "Great fit",
                List.of("/uploads/reviews/123e4567-e89b-12d3-a456-426614174000.jpg"));

        assertEquals(List.of("/uploads/reviews/123e4567-e89b-12d3-a456-426614174000.jpg"),
                ReviewImageUrlCodec.parse(saved.getImageUrls()));
    }

    @Test
    void averageRatingUsesRepeatableReadReadonlyTransaction() throws NoSuchMethodException {
        Transactional transactional = ReviewServiceImpl.class
                .getMethod("getAverageRating", Long.class)
                .getAnnotation(Transactional.class);

        assertNotNull(transactional);
        assertEquals(true, transactional.readOnly());
        assertEquals(Isolation.REPEATABLE_READ, transactional.isolation());
    }

    @Test
    void duplicateReviewInsertRaceReturnsAlreadyReviewedError() {
        when(reviewRepository.save(any(Review.class)))
                .thenThrow(new DataIntegrityViolationException("Duplicate entry for key 'uk_reviews_product_user_order'"));

        IllegalStateException error = assertThrows(IllegalStateException.class, () -> service.addReview(
                7L,
                3L,
                11L,
                5,
                "Great fit",
                List.of()));

        assertEquals("This product has already been reviewed for this order", error.getMessage());
    }

    @Test
    void rejectsReviewImageUrlsThatWereNotUploaded() {
        assertThrows(IllegalArgumentException.class, () -> service.addReview(
                7L,
                3L,
                11L,
                5,
                "Great fit",
                List.of("/uploads/pet-gallery/123e4567-e89b-12d3-a456-426614174000.jpg")));
    }

    @Test
    void normalizesAdminReplyBeforeSaving() {
        Review review = new Review();
        review.setId(21L);
        when(reviewRepository.findById(21L)).thenReturn(Optional.of(review));

        Review saved = service.replyReview(21L, "  Thanks\nfor\tyour feedback\u0000. ");

        assertEquals("Thanks for your feedback .", saved.getAdminReply());
    }

    @Test
    void rejectsOverlongAdminReplyBeforeSaving() {
        Review review = new Review();
        review.setId(21L);
        when(reviewRepository.findById(21L)).thenReturn(Optional.of(review));

        assertThrows(IllegalArgumentException.class, () -> service.replyReview(21L, "x".repeat(81)));
    }

    @Test
    void queriesReviewableOrdersWithBoundedRepositoryPath() {
        Order eligibleOrder = completedOrder(101L);
        when(runtimeConfig.getInt("review.reviewable-order-max-rows", 50)).thenReturn(50);
        when(orderRepository.findReviewableOrdersByUserAndProduct(any(), any(), any(), any(Integer.class)))
                .thenReturn(List.of(eligibleOrder));

        List<ReviewableOrderResponse> result = service.getReviewableOrders(7L, 3L);

        assertEquals(1, result.size());
        assertEquals(eligibleOrder.getId(), result.get(0).getId());
        verify(orderRepository).findReviewableOrdersByUserAndProduct(any(), any(), any(), any(Integer.class));
        verify(orderRepository, never()).findByUserId(any());
        verify(orderItemRepository, never()).findByOrderIds(any());
        verify(reviewRepository, never()).findByProduct_IdAndUser_IdAndOrderIdIn(any(), any(), any());
        verify(orderItemRepository, never()).findByOrderIdAndProductId(any(), any());
        verify(reviewRepository, never()).existsByProduct_IdAndUser_IdAndOrderId(any(), any(), any());
    }

    private Order completedOrder(Long id) {
        Order order = new Order();
        order.setId(id);
        order.setUserId(3L);
        order.setStatus("COMPLETED");
        order.setCreatedAt(LocalDateTime.now());
        return order;
    }
}
