package com.example.shop.service;

import lombok.extern.slf4j.Slf4j;

import com.example.shop.entity.OrderItem;
import com.example.shop.repository.OrderItemRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@Slf4j
public class OrderItemService {
    private static final int MAX_ORDER_ID_BATCH_SIZE = 5000;
    private static final int MAX_STATUS_BATCH_SIZE = 20;
    private static final int MAX_TOP_PRODUCT_LIMIT = 50;

    @Autowired
    private OrderItemRepository orderItemRepository;

    public List<OrderItem> getOrderItemsByOrderId(Long orderId) {
        return orderItemRepository.findByOrderId(orderId);
    }

    public Map<Long, List<OrderItem>> getOrderItemsByOrderIds(List<Long> orderIds) {
        if (orderIds == null || orderIds.isEmpty()) {
            return Map.of();
        }
        List<Long> normalizedIds = new ArrayList<>(Math.min(orderIds.size(), MAX_ORDER_ID_BATCH_SIZE));
        Set<Long> seenIds = new HashSet<>(Math.min(orderIds.size(), MAX_ORDER_ID_BATCH_SIZE));
        for (Long id : orderIds) {
            if (id == null || id <= 0 || !seenIds.add(id)) {
                continue;
            }
            normalizedIds.add(id);
            if (normalizedIds.size() == MAX_ORDER_ID_BATCH_SIZE) {
                break;
            }
        }
        if (normalizedIds.isEmpty()) {
            return Map.of();
        }
        List<OrderItem> items = orderItemRepository.findByOrderIds(normalizedIds);
        if (items == null || items.isEmpty()) {
            return Map.of();
        }
        Map<Long, List<OrderItem>> grouped = new HashMap<>(items.size());
        for (OrderItem item : items) {
            grouped.computeIfAbsent(item.getOrderId(), ignored -> new ArrayList<>()).add(item);
        }
        return grouped;
    }

    public List<Map<String, Object>> getTopProductsByPaidStatuses(List<String> statuses, int limit) {
        if (statuses == null || statuses.isEmpty() || limit <= 0) {
            return List.of();
        }
        List<String> normalizedStatuses = new ArrayList<>(Math.min(statuses.size(), MAX_STATUS_BATCH_SIZE));
        Set<String> seenStatuses = new HashSet<>(Math.min(statuses.size(), MAX_STATUS_BATCH_SIZE));
        for (String status : statuses) {
            if (status == null || status.isBlank() || !seenStatuses.add(status)) {
                continue;
            }
            normalizedStatuses.add(status);
            if (normalizedStatuses.size() == MAX_STATUS_BATCH_SIZE) {
                break;
            }
        }
        if (normalizedStatuses.isEmpty()) {
            return List.of();
        }
        int safeLimit = Math.min(limit, MAX_TOP_PRODUCT_LIMIT);
        return orderItemRepository.findTopProductsByOrderStatuses(normalizedStatuses, safeLimit);
    }

    @Transactional(rollbackFor = Exception.class)
    public OrderItem addOrderItem(OrderItem orderItem) {
        orderItem.setCreatedAt(LocalDateTime.now());
        orderItemRepository.insert(orderItem);
        return orderItem;
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteByOrderId(Long orderId) {
        orderItemRepository.deleteByOrderId(orderId);
    }
}
