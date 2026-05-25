package com.example.shop.service;

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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ReviewServiceTest {
    private ReviewRepository reviewRepository;
    private ReviewServiceImpl service;
    private RuntimeConfigService runtimeConfig;

    @BeforeEach
    void setUp() {
        reviewRepository = mock(ReviewRepository.class);
        ProductRepository productRepository = mock(ProductRepository.class);
        UserRepository userRepository = mock(UserRepository.class);
        OrderRepository orderRepository = mock(OrderRepository.class);
        OrderItemRepository orderItemRepository = mock(OrderItemRepository.class);
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
        Review saved = service.addReview(7L, 3L, 11L, 5, "  Great\tfit\nfor\u0000my dog.  ");

        assertEquals("Great fit for my dog.", saved.getComment());
        verify(reviewRepository).save(any(Review.class));
    }

    @Test
    void rejectsOverlongReviewCommentBeforeSaving() {
        assertThrows(IllegalArgumentException.class, () -> service.addReview(7L, 3L, 11L, 5, "x".repeat(81)));
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
}
