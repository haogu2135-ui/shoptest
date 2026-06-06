package com.example.shop.service;

import com.example.shop.repository.OrderRepository;
import com.example.shop.entity.Order;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

class OrderStatsServiceTest {
    private OrderRepository orderRepository;
    private RuntimeConfigService runtimeConfig;
    private OrderService service;

    @BeforeEach
    void setUp() {
        orderRepository = mock(OrderRepository.class);
        runtimeConfig = mock(RuntimeConfigService.class);
        service = new OrderService();
        ReflectionTestUtils.setField(service, "orderRepository", orderRepository);
        ReflectionTestUtils.setField(service, "runtimeConfig", runtimeConfig);
    }

    @Test
    void countUsesDedicatedCountQuery() {
        when(orderRepository.countAll()).thenReturn(9L);

        assertEquals(9L, service.count());

        verify(orderRepository).countAll();
        verifyNoMoreInteractions(orderRepository);
    }

    @Test
    void totalRevenueUsesDatabaseAggregate() {
        when(orderRepository.sumTotalAmount()).thenReturn(new BigDecimal("128.50"));

        assertEquals(new BigDecimal("128.50"), service.getTotalRevenue());

        verify(orderRepository).sumTotalAmount();
        verifyNoMoreInteractions(orderRepository);
    }

    @Test
    void statusBreakdownUsesGroupedAggregate() {
        when(orderRepository.countByStatusGroup()).thenReturn(List.of(
                Map.of("status", "PENDING_SHIPMENT", "count", 3L),
                Map.of("status", "COMPLETED", "count", 7)
        ));

        assertEquals(Map.of("PENDING_SHIPMENT", 3L, "COMPLETED", 7L), service.getStatusBreakdown());

        verify(orderRepository).countByStatusGroup();
        verifyNoMoreInteractions(orderRepository);
    }

    @Test
    void legacyOrderListUsesConfiguredPageLimit() {
        Order order = new Order();
        order.setStatus("PENDING_SHIPMENT");
        when(runtimeConfig.getInt("admin.orders.legacy-list-max-rows", 100)).thenReturn(75);
        when(runtimeConfig.getLong("order.return-window-days", 7)).thenReturn(7L);
        when(orderRepository.searchAdminOrders(null, null, null, 0, 75)).thenReturn(List.of(order));

        assertEquals(1, service.getAllOrders().size());

        verify(orderRepository).searchAdminOrders(null, null, null, 0, 75);
        verifyNoMoreInteractions(orderRepository);
    }

    @Test
    void adminOrderSearchEscapesLikeWildcards() {
        String escapedSearch = "100!%!_!!promo!\\code";
        when(orderRepository.searchAdminOrders(null, escapedSearch, null, 0, 20)).thenReturn(List.of());
        when(orderRepository.countAdminOrders(null, escapedSearch, null)).thenReturn(0);
        when(orderRepository.countAdminOrderSummary(escapedSearch)).thenReturn(Map.of());

        assertEquals(List.of(), service.searchAdminOrders(null, " 100%_!promo\\code ", null, 1, 20));
        assertEquals(0, service.countAdminOrders(null, "100%_!promo\\code", null));
        assertEquals(0L, service.countAdminOrderSummary("100%_!promo\\code").get("NEEDS_ACTION"));

        verify(orderRepository).searchAdminOrders(null, escapedSearch, null, 0, 20);
        verify(orderRepository).countAdminOrders(null, escapedSearch, null);
        verify(orderRepository).countAdminOrderSummary(escapedSearch);
        verifyNoMoreInteractions(orderRepository);
    }
}
