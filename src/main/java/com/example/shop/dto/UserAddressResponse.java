package com.example.shop.dto;

import com.example.shop.entity.UserAddress;

import java.time.LocalDateTime;

public class UserAddressResponse {
    private Long id;
    private String recipientName;
    private String phone;
    private String address;
    private Boolean isDefault;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static UserAddressResponse from(UserAddress address) {
        if (address == null) {
            return null;
        }
        UserAddressResponse response = new UserAddressResponse();
        response.setId(address.getId());
        response.setRecipientName(address.getRecipientName());
        response.setPhone(address.getPhone());
        response.setAddress(address.getAddress());
        response.setIsDefault(Boolean.TRUE.equals(address.getIsDefault()));
        response.setCreatedAt(address.getCreatedAt());
        response.setUpdatedAt(address.getUpdatedAt());
        return response;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getRecipientName() {
        return recipientName;
    }

    public void setRecipientName(String recipientName) {
        this.recipientName = recipientName;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public Boolean getIsDefault() {
        return isDefault;
    }

    public void setIsDefault(Boolean isDefault) {
        this.isDefault = isDefault;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
