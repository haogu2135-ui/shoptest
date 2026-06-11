package com.example.shop.service;

import lombok.extern.slf4j.Slf4j;
import com.example.shop.entity.OrderItem;
import com.example.shop.repository.OrderItemRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@Slf4j
public class OrderItemService {

    @Autowired
    private OrderItemRepository orderItemRepository;

    public List<OrderItem> getAllOrderItems() {
        return orderItemRepository.findAll();
    }

    public List<OrderItem> getOrderItemsByOrderId(Long orderId) {
        return orderItemRepository.findByOrderId(orderId);
    }

    public Map<Long, List<OrderItem>> getOrderItemsByOrderIds(List<Long> orderIds) {
        if (orderIds == null || orderIds.isEmpty()) {
            return Map.of();
        }
        List<Long> normalizedIds = orderIds.stream()
                .filter(id -> id != null && id > 0)
                .distinct()
                .limit(5000)
                .collect(Collectors.toList());
        if (normalizedIds.isEmpty()) {
            return Map.of();
        }
        return orderItemRepository.findByOrderIds(normalizedIds).stream()
                .collect(Collectors.groupingBy(OrderItem::getOrderId));
    }

    public List<Map<String, Object>> getTopProductsByPaidStatuses(List<String> statuses, int limit) {
        if (statuses == null || statuses.isEmpty() || limit <= 0) {
            return List.of();
        }
        List<String> normalizedStatuses = statuses.stream()
                .filter(status -> status != null && !status.isBlank())
                .distinct()
                .limit(20)
                .collect(Collectors.toList());
        if (normalizedStatuses.isEmpty()) {
            return List.of();
        }
        int safeLimit = Math.min(limit, 50);
        return orderItemRepository.findTopProductsByOrderStatuses(normalizedStatuses, safeLimit);
    }

    @Transactional
    public OrderItem addOrderItem(OrderItem orderItem) {
        orderItem.setCreatedAt(LocalDateTime.now());
        orderItemRepository.insert(orderItem);
        return orderItem;
    }

    @Transactional
    public void deleteByOrderId(Long orderId) {
        orderItemRepository.deleteByOrderId(orderId);
    }
}
