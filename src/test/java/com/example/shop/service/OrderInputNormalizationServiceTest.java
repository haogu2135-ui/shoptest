package com.example.shop.service;

import com.example.shop.entity.Order;
import com.example.shop.repository.OrderItemRepository;
import com.example.shop.repository.OrderRepository;
import com.example.shop.repository.PaymentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OrderInputNormalizationServiceTest {
    private OrderRepository orderRepository;
    private OrderService service;
    private RuntimeConfigService runtimeConfig;

    @BeforeEach
    void setUp() {
        orderRepository = mock(OrderRepository.class);
        runtimeConfig = mock(RuntimeConfigService.class);
        service = new OrderService();
        ReflectionTestUtils.setField(service, "orderRepository", orderRepository);
        ReflectionTestUtils.setField(service, "orderItemRepository", mock(OrderItemRepository.class));
        ReflectionTestUtils.setField(service, "paymentRepository", mock(PaymentRepository.class));
        ReflectionTestUtils.setField(service, "runtimeConfig", runtimeConfig);
        when(runtimeConfig.getLong("order.return-window-days", 7)).thenReturn(7L);
        when(runtimeConfig.getInt("order.return-reason-max-chars", 500)).thenReturn(80);
        when(runtimeConfig.getInt("order.tracking-number-max-chars", 120)).thenReturn(32);
    }

    @Test
    void normalizesReturnReasonBeforeSaving() {
        Order order = order(9L, 3L, "COMPLETED");
        order.setCompletedAt(LocalDateTime.now());
        when(orderRepository.findById(9L)).thenReturn(order);

        service.requestReturn(9L, 3L, "  Too\tlarge\nfor\u0000my dog.  ");

        verify(orderRepository).requestReturnIfCurrent(9L, "COMPLETED", "Too large for my dog.");
    }

    @Test
    void rejectsOverlongReturnReasonBeforeSaving() {
        Order order = order(9L, 3L, "COMPLETED");
        order.setCompletedAt(LocalDateTime.now());
        when(orderRepository.findById(9L)).thenReturn(order);

        assertThrows(IllegalArgumentException.class, () -> service.requestReturn(9L, 3L, "x".repeat(81)));
    }

    @Test
    void normalizesReturnTrackingNumberBeforeSaving() {
        Order order = order(9L, 3L, "RETURN_APPROVED");
        when(orderRepository.findById(9L)).thenReturn(order);

        service.submitReturnShipment(9L, 3L, "  RX\t123\n456  ");

        verify(orderRepository).updateReturnTrackingIfCurrent(9L, "RETURN_APPROVED", "RETURN_SHIPPED", "RX 123 456");
    }

    @Test
    void rejectsOverlongTrackingNumberBeforeSaving() {
        Order order = order(9L, 3L, "RETURN_APPROVED");
        when(orderRepository.findById(9L)).thenReturn(order);

        assertThrows(IllegalArgumentException.class, () -> service.submitReturnShipment(9L, 3L, "T".repeat(33)));
    }

    private Order order(Long id, Long userId, String status) {
        Order order = new Order();
        order.setId(id);
        order.setUserId(userId);
        order.setStatus(status);
        order.setCreatedAt(LocalDateTime.now());
        order.setUpdatedAt(LocalDateTime.now());
        return order;
    }
}
