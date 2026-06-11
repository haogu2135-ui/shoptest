package com.example.shop.dto;

public class ReviewImageUploadResponse {
    private String imageUrl;

    public ReviewImageUploadResponse() {
    }

    public ReviewImageUploadResponse(String imageUrl) {
        this.imageUrl = imageUrl;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }
}
