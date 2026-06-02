package com.example.shop.dto;

import com.example.shop.entity.Order;

import java.time.LocalDateTime;

public class ReviewableOrderResponse {
    private Long id;
    private String orderNo;
    private LocalDateTime createdAt;
    private LocalDateTime completedAt;

    public static ReviewableOrderResponse from(Order order) {
        ReviewableOrderResponse response = new ReviewableOrderResponse();
        if (order == null) {
            return response;
        }
        response.setId(order.getId());
        response.setOrderNo(order.getOrderNo());
        response.setCreatedAt(order.getCreatedAt());
        response.setCompletedAt(order.getCompletedAt());
        return response;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getOrderNo() {
        return orderNo;
    }

    public void setOrderNo(String orderNo) {
        this.orderNo = orderNo;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(LocalDateTime completedAt) {
        this.completedAt = completedAt;
    }
}
