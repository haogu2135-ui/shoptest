package com.example.shop.dto;

import com.example.shop.entity.Brand;

public class BrandPublicResponse {
    private Long id;
    private String name;
    private String description;
    private String logoUrl;
    private String websiteUrl;

    public static BrandPublicResponse from(Brand brand) {
        if (brand == null) {
            return null;
        }
        BrandPublicResponse response = new BrandPublicResponse();
        response.setId(brand.getId());
        response.setName(brand.getName());
        response.setDescription(brand.getDescription());
        response.setLogoUrl(brand.getLogoUrl());
        response.setWebsiteUrl(brand.getWebsiteUrl());
        return response;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getLogoUrl() {
        return logoUrl;
    }

    public void setLogoUrl(String logoUrl) {
        this.logoUrl = logoUrl;
    }

    public String getWebsiteUrl() {
        return websiteUrl;
    }

    public void setWebsiteUrl(String websiteUrl) {
        this.websiteUrl = websiteUrl;
    }
}
