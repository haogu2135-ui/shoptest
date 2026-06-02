package com.example.shop.dto;

import com.example.shop.entity.CartItem;

import java.math.BigDecimal;

public class CartItemResponse {
    private Long id;
    private Long productId;
    private Integer quantity;
    private BigDecimal price;
    private String selectedSpecs;
    private String productName;
    private String imageUrl;
    private Integer stock;
    private String productStatus;

    public static CartItemResponse from(CartItem item) {
        if (item == null) {
            return null;
        }
        CartItemResponse response = new CartItemResponse();
        response.setId(item.getId());
        response.setProductId(item.getProductId());
        response.setQuantity(item.getQuantity());
        response.setPrice(item.getPrice());
        response.setSelectedSpecs(item.getSelectedSpecs());
        response.setProductName(item.getProductName());
        response.setImageUrl(item.getImageUrl());
        response.setStock(item.getStock());
        response.setProductStatus(item.getProductStatus());
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

    public String getSelectedSpecs() {
        return selectedSpecs;
    }

    public void setSelectedSpecs(String selectedSpecs) {
        this.selectedSpecs = selectedSpecs;
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
}
