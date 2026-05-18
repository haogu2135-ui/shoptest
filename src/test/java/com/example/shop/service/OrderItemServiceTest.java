package com.example.shop.service;

import com.example.shop.repository.OrderItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OrderItemServiceTest {
    private OrderItemRepository orderItemRepository;
    private OrderItemService service;

    @BeforeEach
    void setUp() {
        orderItemRepository = mock(OrderItemRepository.class);
        service = new OrderItemService();
        ReflectionTestUtils.setField(service, "orderItemRepository", orderItemRepository);
    }

    @Test
    void topProductsNormalizesStatusesAndCapsLimit() {
        when(orderItemRepository.findTopProductsByOrderStatuses(List.of("PAID", "SHIPPED"), 50))
                .thenReturn(List.of());

        service.getTopProductsByPaidStatuses(List.of("PAID", "", "SHIPPED", "PAID", " "), 500);

        verify(orderItemRepository).findTopProductsByOrderStatuses(List.of("PAID", "SHIPPED"), 50);
    }

    @Test
    void topProductsSkipsRepositoryWhenInputIsEmpty() {
        assertTrue(service.getTopProductsByPaidStatuses(List.of("", " "), 8).isEmpty());
        assertTrue(service.getTopProductsByPaidStatuses(List.of("PAID"), 0).isEmpty());

        verify(orderItemRepository, never()).findTopProductsByOrderStatuses(org.mockito.ArgumentMatchers.anyList(), org.mockito.ArgumentMatchers.anyInt());
    }
}
