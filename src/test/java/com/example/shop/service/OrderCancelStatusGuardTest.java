package com.example.shop.service;

import com.example.shop.entity.Order;
import com.example.shop.repository.OrderItemRepository;
import com.example.shop.repository.OrderRepository;
import com.example.shop.repository.PaymentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OrderCancelStatusGuardTest {
    private OrderRepository orderRepository;
    private OrderItemRepository orderItemRepository;
    private PaymentRepository paymentRepository;
    private OrderService orderService;

    @BeforeEach
    void setUp() {
        orderRepository = mock(OrderRepository.class);
        orderItemRepository = mock(OrderItemRepository.class);
        paymentRepository = mock(PaymentRepository.class);
        orderService = new OrderService();
        ReflectionTestUtils.setField(orderService, "orderRepository", orderRepository);
        ReflectionTestUtils.setField(orderService, "orderItemRepository", orderItemRepository);
        ReflectionTestUtils.setField(orderService, "paymentRepository", paymentRepository);
    }

    @Test
    void cancelOrderReturnsFalseForMissingOrder() {
        when(orderRepository.findById(42L)).thenReturn(null);

        assertFalse(orderService.cancelOrder(42L));

        verify(orderRepository, never()).updateStatusIfCurrent(42L, "PENDING_PAYMENT", "CANCELLED");
        verify(orderItemRepository, never()).findByOrderId(42L);
        verify(paymentRepository, never()).markPendingCancelledByOrderId(42L);
    }

    @Test
    void cancelOrderRejectsFulfilledOrNonPendingPaymentStatuses() {
        for (String status : List.of(
                "PENDING_SHIPMENT",
                "SHIPPED",
                "DELIVERED",
                "COMPLETED",
                "RETURN_REQUESTED",
                "RETURN_APPROVED",
                "RETURN_SHIPPED",
                "RETURNED",
                "REFUNDED",
                "CANCELLED")) {
            Order order = orderWithStatus(status);
            when(orderRepository.findById(42L)).thenReturn(order);

            assertThrows(IllegalStateException.class, () -> orderService.cancelOrder(42L),
                    "Expected direct cancellation to reject status " + status);

            verify(orderRepository, never()).updateStatusIfCurrent(42L, status, "CANCELLED");
            verify(orderItemRepository, never()).findByOrderId(42L);
            verify(paymentRepository, never()).markPendingCancelledByOrderId(42L);
        }
    }

    private Order orderWithStatus(String status) {
        Order order = new Order();
        order.setId(42L);
        order.setStatus(status);
        return order;
    }
}
