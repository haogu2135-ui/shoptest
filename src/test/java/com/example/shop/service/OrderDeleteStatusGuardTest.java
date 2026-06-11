package com.example.shop.service;

import com.example.shop.entity.Order;
import com.example.shop.repository.OrderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OrderDeleteStatusGuardTest {
    private OrderRepository orderRepository;
    private OrderService orderService;

    @BeforeEach
    void setUp() {
        orderRepository = mock(OrderRepository.class);
        orderService = new OrderService();
        ReflectionTestUtils.setField(orderService, "orderRepository", orderRepository);
    }

    @Test
    void deleteOrderRejectsMissingIdBeforeRepositoryDelete() {
        assertThrows(IllegalArgumentException.class, () -> orderService.deleteOrder(null));
        verify(orderRepository, never()).deleteById(null);
    }

    @Test
    void deleteOrderReturnsFalseWhenOrderDoesNotExist() {
        when(orderRepository.findById(42L)).thenReturn(null);

        assertFalse(orderService.deleteOrder(42L));

        verify(orderRepository, never()).deleteById(42L);
    }

    @Test
    void deleteOrderAllowsCancelledOrdersOnly() {
        Order order = orderWithStatus("CANCELLED");
        when(orderRepository.findById(42L)).thenReturn(order);
        when(orderRepository.deleteById(42L)).thenReturn(1);

        assertTrue(orderService.deleteOrder(42L));

        verify(orderRepository).deleteById(42L);
    }

    @Test
    void deleteOrderRejectsPendingPaymentOrdersBecauseCancellationMustReleaseResources() {
        Order order = orderWithStatus("PENDING_PAYMENT");
        when(orderRepository.findById(42L)).thenReturn(order);

        assertThrows(IllegalStateException.class, () -> orderService.deleteOrder(42L));

        verify(orderRepository, never()).deleteById(42L);
    }

    @Test
    void deleteOrderRejectsPaidOrFulfillmentOrders() {
        Order order = orderWithStatus("PENDING_SHIPMENT");
        when(orderRepository.findById(42L)).thenReturn(order);

        assertThrows(IllegalStateException.class, () -> orderService.deleteOrder(42L));

        verify(orderRepository, never()).deleteById(42L);
    }

    private Order orderWithStatus(String status) {
        Order order = new Order();
        order.setId(42L);
        order.setStatus(status);
        return order;
    }
}
