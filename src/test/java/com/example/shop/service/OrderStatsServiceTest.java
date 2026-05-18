package com.example.shop.service;

import com.example.shop.repository.OrderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OrderStatsServiceTest {
    private OrderRepository orderRepository;
    private OrderService service;

    @BeforeEach
    void setUp() {
        orderRepository = mock(OrderRepository.class);
        service = new OrderService();
        ReflectionTestUtils.setField(service, "orderRepository", orderRepository);
    }

    @Test
    void countUsesDedicatedCountQuery() {
        when(orderRepository.countAll()).thenReturn(9L);

        assertEquals(9L, service.count());

        verify(orderRepository).countAll();
        verify(orderRepository, never()).findAll();
    }

    @Test
    void totalRevenueUsesDatabaseAggregate() {
        when(orderRepository.sumTotalAmount()).thenReturn(new BigDecimal("128.50"));

        assertEquals(new BigDecimal("128.50"), service.getTotalRevenue());

        verify(orderRepository).sumTotalAmount();
        verify(orderRepository, never()).findAll();
    }

    @Test
    void statusBreakdownUsesGroupedAggregate() {
        when(orderRepository.countByStatusGroup()).thenReturn(List.of(
                Map.of("status", "PENDING_SHIPMENT", "count", 3L),
                Map.of("status", "COMPLETED", "count", 7)
        ));

        assertEquals(Map.of("PENDING_SHIPMENT", 3L, "COMPLETED", 7L), service.getStatusBreakdown());

        verify(orderRepository).countByStatusGroup();
        verify(orderRepository, never()).findAll();
    }
}
