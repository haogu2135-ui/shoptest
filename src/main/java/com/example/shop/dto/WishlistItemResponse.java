package com.example.shop.dto;

import com.example.shop.entity.Wishlist;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public class WishlistItemResponse {
    private Long id;
    private Long productId;
    private String productName;
    private String imageUrl;
    private BigDecimal productPrice;
    private Integer stock;
    private String productStatus;
    private Boolean requiresSelection;
    private LocalDateTime createdAt;

    public static WishlistItemResponse from(Wishlist item) {
        if (item == null) {
            return null;
        }
        WishlistItemResponse response = new WishlistItemResponse();
        response.setId(item.getId());
        response.setProductId(item.getProductId());
        response.setProductName(item.getProductName());
        response.setImageUrl(item.getImageUrl());
        response.setProductPrice(item.getProductPrice());
        response.setStock(item.getStock());
        response.setProductStatus(item.getProductStatus());
        response.setRequiresSelection(Boolean.TRUE.equals(item.getRequiresSelection()));
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

    public BigDecimal getProductPrice() {
        return productPrice;
    }

    public void setProductPrice(BigDecimal productPrice) {
        this.productPrice = productPrice;
    }

    public Integer getStock() {
        return stock;
    }

    public void setStock(Integer stock) {
        this.stock = stock;
    }

    public String getProductStatus() {
        return productStatus;
    }

    public void setProductStatus(String productStatus) {
        this.productStatus = productStatus;
    }

    public Boolean getRequiresSelection() {
        return requiresSelection;
    }

    public void setRequiresSelection(Boolean requiresSelection) {
        this.requiresSelection = requiresSelection;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
