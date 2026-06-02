package com.example.shop.dto;

import com.example.shop.entity.OrderItem;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public class OrderItemCustomerResponse {
    private Long id;
    private Long productId;
    private Integer quantity;
    private BigDecimal price;
    private String productName;
    private String imageUrl;
    private String selectedSpecs;
    private LocalDateTime createdAt;

    public static OrderItemCustomerResponse from(OrderItem item) {
        if (item == null) {
            return null;
        }
        OrderItemCustomerResponse response = new OrderItemCustomerResponse();
        response.setId(item.getId());
        response.setProductId(item.getProductId());
        response.setQuantity(item.getQuantity());
        response.setPrice(item.getPrice());
        response.setProductName(item.getProductName());
        response.setImageUrl(item.getImageUrl());
        response.setSelectedSpecs(item.getSelectedSpecs());
        response.setCreatedAt(item.getCreatedAt());
        return response;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getProductId() {
        return productId;
    }

    public void setProductId(Long productId) {
        this.productId = productId;
    }

    public Integer getQuantity() {
        return quantity;
    }

    public void setQuantity(Integer quantity) {
        this.quantity = quantity;
    }

    public BigDecimal getPrice() {
        return price;
    }

    public void setPrice(BigDecimal price) {
        this.price = price;
    }

    public String getProductName() {
        return productName;
    }

    public void setProductName(String productName) {
        this.productName = productName;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }

    public String getSelectedSpecs() {
        return selectedSpecs;
    }

    public void setSelectedSpecs(String selectedSpecs) {
        this.selectedSpecs = selectedSpecs;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
