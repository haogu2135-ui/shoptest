package com.example.shop.entity;

import javax.persistence.*;
import lombok.Data;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.annotation.JsonProperty.Access;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

@Data
@Entity
@Table(name = "products")
public class Product {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(length = 1000)
    private String description;

    @Column(nullable = false)
    private BigDecimal price;

    @Column(columnDefinition = "TEXT")
    private String imageUrl;

    private Integer stock;

    @Column(name = "category_id", nullable = false)
    private Long categoryId;

    @Column(name = "is_featured")
    private Boolean isFeatured = false;

    private String brand;

    @Column(name = "original_price")
    private BigDecimal originalPrice;

    private Integer discount;

    @Column(name = "limited_time_price")
    private BigDecimal limitedTimePrice;

    @Column(name = "limited_time_start_at")
    private LocalDateTime limitedTimeStartAt;

    @Column(name = "limited_time_end_at")
    private LocalDateTime limitedTimeEndAt;

    private String tag;

    @Column(nullable = false)
    private String status = "ACTIVE";

    @Column(columnDefinition = "TEXT")
    @JsonIgnore
    private String images;

    @Column(columnDefinition = "TEXT")
    @JsonIgnore
    private String specifications;

    @Column(name = "detail_content", columnDefinition = "TEXT")
    @JsonIgnore
    private String detailContent;

    @Column(columnDefinition = "TEXT")
    @JsonIgnore
    private String variants;

    private static final ObjectMapper mapper = new ObjectMapper();

    @Transient
    private Double positiveRate;

    @Transient
    private Double averageRating;

    @Transient
    private Long reviewCount;

    @JsonProperty("images")
    public List<String> getImagesList() {
        if (images == null || images.isEmpty()) return Collections.emptyList();
        try {
            List<String> parsed = mapper.readValue(images, new TypeReference<List<String>>() {});
            List<String> normalized = normalizeImageList(parsed);
            return normalized == null ? Collections.emptyList() : normalized;
        } catch (Exception e) {
            List<String> fallback = parseLenientImageList(images);
            return fallback == null ? Collections.emptyList() : fallback;
        }
    }

    @JsonProperty("images")
    public void setImagesList(Object value) {
        try {
            if (value == null) {
                this.images = null;
            } else if (value instanceof String) {
                String raw = ((String) value).trim();
                List<String> parsed = raw.isEmpty() ? null : parseImageInput(raw);
                this.images = parsed == null || parsed.isEmpty() ? null : mapper.writeValueAsString(parsed);
            } else {
                List<String> list = mapper.convertValue(value, new TypeReference<List<String>>() {});
                list = normalizeImageList(list);
                this.images = list == null || list.isEmpty() ? null : mapper.writeValueAsString(list);
            }
        } catch (Exception e) {
            this.images = null;
        }
    }

    @JsonProperty("specifications")
    public Map<String, String> getSpecificationsMap() {
        if (specifications == null || specifications.isEmpty()) return Collections.emptyMap();
        try {
            Map<String, String> parsed = mapper.readValue(specifications, new TypeReference<Map<String, String>>() {});
            return parsed == null ? Collections.emptyMap() : parsed;
        } catch (Exception e) {
            return Collections.emptyMap();
        }
    }

    private static List<String> parseImageInput(String raw) throws Exception {
        try {
            List<String> parsed = mapper.readValue(raw, new TypeReference<List<String>>() {});
            return normalizeImageList(parsed);
        } catch (Exception ex) {
            List<String> fallback = parseLenientImageList(raw);
            if (fallback != null) {
                return fallback;
            }
            throw ex;
        }
    }

    private static List<String> normalizeImageList(List<String> values) {
        if (values == null || values.isEmpty()) {
            return null;
        }
        List<String> normalized = new ArrayList<>();
        for (String value : values) {
            if (value == null) {
                continue;
            }
            String item = value.trim();
            if (!item.isEmpty() && !normalized.contains(item)) {
                normalized.add(item);
            }
        }
        return normalized.isEmpty() ? null : normalized;
    }

    private static List<String> parseLenientImageList(String raw) {
        if (raw == null || raw.trim().isEmpty()) {
            return null;
        }
        String text = raw.trim();
        List<String> values = new ArrayList<>();
        if (looksLikeImageUrl(text)) {
            values.add(text);
        } else {
            String[] parts = text.split("[\\n,;]");
            for (String part : parts) {
                String value = part == null ? "" : part.trim();
                if (looksLikeImageUrl(value)) {
                    values.add(value);
                }
            }
        }
        return normalizeImageList(values);
    }

    private static boolean looksLikeImageUrl(String value) {
        if (value == null) {
            return false;
        }
        String normalized = value.trim().toLowerCase();
        return (normalized.startsWith("http://") || normalized.startsWith("https://") || normalized.startsWith("/"))
                && (normalized.contains(".jpg")
                || normalized.contains(".jpeg")
                || normalized.contains(".png")
                || normalized.contains(".webp")
                || normalized.contains(".gif")
                || normalized.contains(".avif"));
    }

    @JsonProperty("specifications")
    public void setSpecificationsMap(Object value) {
        try {
            if (value == null) {
                this.specifications = null;
            } else if (value instanceof String) {
                String raw = ((String) value).trim();
                this.specifications = raw.isEmpty() ? null : mapper.writeValueAsString(mapper.readValue(raw, new TypeReference<Map<String, String>>() {}));
            } else {
                Map<String, String> map = mapper.convertValue(value, new TypeReference<Map<String, String>>() {});
                this.specifications = map == null || map.isEmpty() ? null : mapper.writeValueAsString(map);
            }
        } catch (Exception e) {
            this.specifications = null;
        }
    }

    @JsonProperty("detailContent")
    public List<Map<String, Object>> getDetailContentList() {
        if (detailContent == null || detailContent.isEmpty()) return Collections.emptyList();
        try {
            List<Map<String, Object>> parsed = mapper.readValue(detailContent, new TypeReference<List<Map<String, Object>>>() {});
            return parsed == null ? Collections.emptyList() : parsed;
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    @JsonProperty("detailContent")
    public void setDetailContentList(Object value) {
        try {
            if (value == null) {
                this.detailContent = null;
            } else if (value instanceof String) {
                String raw = ((String) value).trim();
                this.detailContent = raw.isEmpty() ? null : mapper.writeValueAsString(mapper.readValue(raw, new TypeReference<List<Map<String, Object>>>() {}));
            } else {
                List<Map<String, Object>> list = mapper.convertValue(value, new TypeReference<List<Map<String, Object>>>() {});
                this.detailContent = list == null || list.isEmpty() ? null : mapper.writeValueAsString(list);
            }
        } catch (Exception e) {
            this.detailContent = null;
        }
    }

    @JsonProperty("variants")
    public List<Map<String, Object>> getVariantsList() {
        if (variants == null || variants.isEmpty()) return Collections.emptyList();
        try {
            List<Map<String, Object>> parsed = mapper.readValue(variants, new TypeReference<List<Map<String, Object>>>() {});
            return parsed == null ? Collections.emptyList() : parsed;
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    @JsonProperty("variants")
    public void setVariantsList(Object value) {
        try {
            if (value == null) {
                this.variants = null;
            } else if (value instanceof String) {
                String raw = ((String) value).trim();
                this.variants = raw.isEmpty() ? null : mapper.writeValueAsString(mapper.readValue(raw, new TypeReference<List<Map<String, Object>>>() {}));
            } else {
                List<Map<String, Object>> list = mapper.convertValue(value, new TypeReference<List<Map<String, Object>>>() {});
                this.variants = list == null || list.isEmpty() ? null : mapper.writeValueAsString(list);
            }
        } catch (Exception e) {
            this.variants = null;
        }
    }

    private String warranty;

    private String shipping;

    @Column(name = "free_shipping")
    private Boolean freeShipping = false;

    @Column(name = "free_shipping_threshold")
    private BigDecimal freeShippingThreshold;

    @JsonProperty(value = "activeLimitedTimeDiscount", access = Access.READ_ONLY)
    public boolean isActiveLimitedTimeDiscount() {
        LocalDateTime now = LocalDateTime.now();
        return limitedTimePrice != null
                && limitedTimeEndAt != null
                && (limitedTimeStartAt == null || !now.isBefore(limitedTimeStartAt))
                && now.isBefore(limitedTimeEndAt);
    }

    @JsonProperty(value = "effectivePrice", access = Access.READ_ONLY)
    public BigDecimal getEffectivePrice() {
        return isActiveLimitedTimeDiscount() ? limitedTimePrice : price;
    }

    @JsonProperty(value = "effectiveDiscountPercent", access = Access.READ_ONLY)
    public Integer getEffectiveDiscountPercent() {
        BigDecimal basePrice = originalPrice != null && originalPrice.compareTo(BigDecimal.ZERO) > 0 ? originalPrice : price;
        BigDecimal activePrice = getEffectivePrice();
        if (basePrice == null || activePrice == null || basePrice.compareTo(BigDecimal.ZERO) <= 0 || activePrice.compareTo(basePrice) >= 0) {
            return 0;
        }
        return basePrice.subtract(activePrice)
                .multiply(BigDecimal.valueOf(100))
                .divide(basePrice, 0, RoundingMode.HALF_UP)
                .intValue();
    }

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
} 
