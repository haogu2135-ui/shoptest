package com.example.shop.dto;

import com.example.shop.entity.Category;

import java.util.Map;

public class CategoryPublicResponse {
    private Long id;
    private String name;
    private String description;
    private Long parentId;
    private Integer level;
    private String imageUrl;
    private Long productCount;
    private Map<String, Map<String, String>> localizedContent;

    public static CategoryPublicResponse from(Category category) {
        if (category == null) {
            return null;
        }
        CategoryPublicResponse response = new CategoryPublicResponse();
        response.setId(category.getId());
        response.setName(category.getName());
        response.setDescription(category.getDescription());
        response.setParentId(category.getParentId());
        response.setLevel(category.getLevel());
        response.setImageUrl(category.getImageUrl());
        response.setProductCount(category.getProductCount());
        response.setLocalizedContent(category.getLocalizedContentMap());
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

    public Long getParentId() {
        return parentId;
    }

    public void setParentId(Long parentId) {
        this.parentId = parentId;
    }

    public Integer getLevel() {
        return level;
    }

    public void setLevel(Integer level) {
        this.level = level;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }

    public Long getProductCount() {
        return productCount;
    }

    public void setProductCount(Long productCount) {
        this.productCount = productCount;
    }

    public Map<String, Map<String, String>> getLocalizedContent() {
        return localizedContent;
    }

    public void setLocalizedContent(Map<String, Map<String, String>> localizedContent) {
        this.localizedContent = localizedContent;
    }
}
