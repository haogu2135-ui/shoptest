package com.example.shop.dto;

import com.example.shop.entity.Product;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public class ProductPublicResponse {
    private Long id;
    private String name;
    private String description;
    private BigDecimal price;
    private Integer stock;
    private Long categoryId;
    private String imageUrl;
    private Boolean isFeatured;
    private List<String> images;
    private String brand;
    private BigDecimal originalPrice;
    private Integer discount;
    private BigDecimal limitedTimePrice;
    private LocalDateTime limitedTimeStartAt;
    private LocalDateTime limitedTimeEndAt;
    private Boolean activeLimitedTimeDiscount;
    private BigDecimal effectivePrice;
    private Integer effectiveDiscountPercent;
    private Boolean freeShipping;
    private BigDecimal freeShippingThreshold;
    private String tag;
    private String status;
    private BigDecimal averageRating;
    private BigDecimal positiveRate;
    private Long reviewCount;
    private Map<String, String> specifications;
    private Map<String, String> specificationItems;
    private Map<String, Map<String, String>> i18n;
    private List<Map<String, Object>> detailContent;
    private List<Map<String, Object>> variants;
    private List<Map<String, Object>> optionGroups;
    private Map<String, Map<String, String>> localizedContent;
    private Map<String, Object> bundle;
    private String warranty;
    private String shipping;

    public static ProductPublicResponse from(Product product) {
        if (product == null) {
            return null;
        }
        ProductPublicResponse response = new ProductPublicResponse();
        response.setId(product.getId());
        response.setName(product.getName());
        response.setDescription(product.getDescription());
        response.setPrice(product.getPrice());
        response.setStock(product.getStock());
        response.setCategoryId(product.getCategoryId());
        response.setImageUrl(product.getImageUrl());
        response.setIsFeatured(product.getIsFeatured());
        response.setImages(product.getImagesList());
        response.setBrand(product.getBrand());
        response.setOriginalPrice(product.getOriginalPrice());
        response.setDiscount(product.getDisplayedDiscount());
        response.setLimitedTimePrice(product.getLimitedTimePrice());
        response.setLimitedTimeStartAt(product.getLimitedTimeStartAt());
        response.setLimitedTimeEndAt(product.getLimitedTimeEndAt());
        response.setActiveLimitedTimeDiscount(product.isActiveLimitedTimeDiscount());
        response.setEffectivePrice(product.getEffectivePrice());
        response.setEffectiveDiscountPercent(product.getEffectiveDiscountPercent());
        response.setFreeShipping(product.getFreeShipping());
        response.setFreeShippingThreshold(product.getFreeShippingThreshold());
        response.setTag(product.getTag());
        response.setStatus(product.getStatus());
        response.setAverageRating(product.getAverageRating());
        response.setPositiveRate(product.getPositiveRate());
        response.setReviewCount(product.getReviewCount());
        response.setSpecifications(product.getPublicSpecificationsMap());
        response.setSpecificationItems(product.getSpecificationItems());
        response.setI18n(product.getI18nMap());
        response.setDetailContent(product.getDetailContentList());
        response.setVariants(product.getVariantsList());
        response.setOptionGroups(product.getOptionGroupsList());
        response.setLocalizedContent(product.getLocalizedContentMap());
        response.setBundle(product.getBundleMap());
        response.setWarranty(product.getWarranty());
        response.setShipping(product.getShipping());
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

    public BigDecimal getPrice() {
        return price;
    }

    public void setPrice(BigDecimal price) {
        this.price = price;
    }

    public Integer getStock() {
        return stock;
    }

    public void setStock(Integer stock) {
        this.stock = stock;
    }

    public Long getCategoryId() {
        return categoryId;
    }

    public void setCategoryId(Long categoryId) {
        this.categoryId = categoryId;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }

    public Boolean getIsFeatured() {
        return isFeatured;
    }

    public void setIsFeatured(Boolean isFeatured) {
        this.isFeatured = isFeatured;
    }

    public List<String> getImages() {
        return images;
    }

    public void setImages(List<String> images) {
        this.images = images;
    }

    public String getBrand() {
        return brand;
    }

    public void setBrand(String brand) {
        this.brand = brand;
    }

    public BigDecimal getOriginalPrice() {
        return originalPrice;
    }

    public void setOriginalPrice(BigDecimal originalPrice) {
        this.originalPrice = originalPrice;
    }

    public Integer getDiscount() {
        return discount;
    }

    public void setDiscount(Integer discount) {
        this.discount = discount;
    }

    public BigDecimal getLimitedTimePrice() {
        return limitedTimePrice;
    }

    public void setLimitedTimePrice(BigDecimal limitedTimePrice) {
        this.limitedTimePrice = limitedTimePrice;
    }

    public LocalDateTime getLimitedTimeStartAt() {
        return limitedTimeStartAt;
    }

    public void setLimitedTimeStartAt(LocalDateTime limitedTimeStartAt) {
        this.limitedTimeStartAt = limitedTimeStartAt;
    }

    public LocalDateTime getLimitedTimeEndAt() {
        return limitedTimeEndAt;
    }

    public void setLimitedTimeEndAt(LocalDateTime limitedTimeEndAt) {
        this.limitedTimeEndAt = limitedTimeEndAt;
    }

    public Boolean getActiveLimitedTimeDiscount() {
        return activeLimitedTimeDiscount;
    }

    public void setActiveLimitedTimeDiscount(Boolean activeLimitedTimeDiscount) {
        this.activeLimitedTimeDiscount = activeLimitedTimeDiscount;
    }

    public BigDecimal getEffectivePrice() {
        return effectivePrice;
    }

    public void setEffectivePrice(BigDecimal effectivePrice) {
        this.effectivePrice = effectivePrice;
    }

    public Integer getEffectiveDiscountPercent() {
        return effectiveDiscountPercent;
    }

    public void setEffectiveDiscountPercent(Integer effectiveDiscountPercent) {
        this.effectiveDiscountPercent = effectiveDiscountPercent;
    }

    public Boolean getFreeShipping() {
        return freeShipping;
    }

    public void setFreeShipping(Boolean freeShipping) {
        this.freeShipping = freeShipping;
    }

    public BigDecimal getFreeShippingThreshold() {
        return freeShippingThreshold;
    }

    public void setFreeShippingThreshold(BigDecimal freeShippingThreshold) {
        this.freeShippingThreshold = freeShippingThreshold;
    }

    public String getTag() {
        return tag;
    }

    public void setTag(String tag) {
        this.tag = tag;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public BigDecimal getAverageRating() {
        return averageRating;
    }

    public void setAverageRating(BigDecimal averageRating) {
        this.averageRating = averageRating;
    }

    public BigDecimal getPositiveRate() {
        return positiveRate;
    }

    public void setPositiveRate(BigDecimal positiveRate) {
        this.positiveRate = positiveRate;
    }

    public Long getReviewCount() {
        return reviewCount;
    }

    public void setReviewCount(Long reviewCount) {
        this.reviewCount = reviewCount;
    }

    public Map<String, String> getSpecifications() {
        return specifications;
    }

    public void setSpecifications(Map<String, String> specifications) {
        this.specifications = specifications;
    }

    public Map<String, String> getSpecificationItems() {
        return specificationItems;
    }

    public void setSpecificationItems(Map<String, String> specificationItems) {
        this.specificationItems = specificationItems;
    }

    public Map<String, Map<String, String>> getI18n() {
        return i18n;
    }

    public void setI18n(Map<String, Map<String, String>> i18n) {
        this.i18n = i18n;
    }

    public List<Map<String, Object>> getDetailContent() {
        return detailContent;
    }

    public void setDetailContent(List<Map<String, Object>> detailContent) {
        this.detailContent = detailContent;
    }

    public List<Map<String, Object>> getVariants() {
        return variants;
    }

    public void setVariants(List<Map<String, Object>> variants) {
        this.variants = variants;
    }

    public List<Map<String, Object>> getOptionGroups() {
        return optionGroups;
    }

    public void setOptionGroups(List<Map<String, Object>> optionGroups) {
        this.optionGroups = optionGroups;
    }

    public Map<String, Map<String, String>> getLocalizedContent() {
        return localizedContent;
    }

    public void setLocalizedContent(Map<String, Map<String, String>> localizedContent) {
        this.localizedContent = localizedContent;
    }

    public Map<String, Object> getBundle() {
        return bundle;
    }

    public void setBundle(Map<String, Object> bundle) {
        this.bundle = bundle;
    }

    public String getWarranty() {
        return warranty;
    }

    public void setWarranty(String warranty) {
        this.warranty = warranty;
    }

    public String getShipping() {
        return shipping;
    }

    public void setShipping(String shipping) {
        this.shipping = shipping;
    }
}
