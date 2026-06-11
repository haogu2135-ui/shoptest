package com.example.shop.entity;

import javax.persistence.*;
import lombok.Data;
import com.fasterxml.jackson.annotation.JsonGetter;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonSetter;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.annotation.JsonProperty.Access;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import javax.validation.constraints.DecimalMin;
import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;

@Data
@Entity
@Table(name = "products",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_products_category_name",
                columnNames = {"category_id", "name"}))
public class Product {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    @NotBlank
    @Size(max = 200)
    private String name;

    @Column(columnDefinition = "TEXT")
    @Size(max = 1000)
    private String description;

    @Column(nullable = false)
    @NotNull
    @DecimalMin("0.00")
    private BigDecimal price;

    @Column(columnDefinition = "TEXT")
    @Size(max = 2000)
    private String imageUrl;

    @Min(0)
    private Integer stock;

    @Column(name = "category_id", nullable = false)
    @NotNull
    private Long categoryId;

    @Column(name = "is_featured")
    private Boolean isFeatured = false;

    @Size(max = 120)
    private String brand;

    @Column(name = "original_price")
    @DecimalMin("0.00")
    private BigDecimal originalPrice;

    @Min(0)
    @Max(100)
    private Integer discount;

    @JsonIgnore
    public Integer getDiscount() {
        return discount;
    }

    @JsonSetter("discount")
    public void setDiscount(Integer discount) {
        this.discount = discount;
    }

    @JsonGetter("discount")
    public Integer getDisplayedDiscount() {
        Integer effectiveDiscount = getEffectiveDiscountPercent();
        return effectiveDiscount != null && effectiveDiscount > 0 ? effectiveDiscount : discount;
    }

    @Column(name = "limited_time_price")
    @DecimalMin("0.00")
    private BigDecimal limitedTimePrice;

    @Column(name = "limited_time_start_at")
    private LocalDateTime limitedTimeStartAt;

    @Column(name = "limited_time_end_at")
    private LocalDateTime limitedTimeEndAt;

    @Size(max = 80)
    private String tag;

    @Column(nullable = false)
    @NotBlank
    @Size(max = 20)
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
    private static final Set<String> SPECIFICATION_METADATA_PREFIXES = Set.of("options.", "i18n.", "bundle.");

    @Transient
    private Double positiveRate;

    @Transient
    private Double averageRating;

    @Transient
    private Long reviewCount;

    public String getImageUrl() {
        String primary = emptyToNull(imageUrl);
        if (primary != null) {
            return primary;
        }
        List<String> imageList = getStoredImagesList();
        return imageList.isEmpty() ? null : imageList.get(0);
    }

    @JsonProperty("images")
    public List<String> getImagesList() {
        return withPrimaryImage(getStoredImagesList());
    }

    private List<String> getStoredImagesList() {
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

    private List<String> withPrimaryImage(List<String> storedImages) {
        List<String> normalized = new ArrayList<>();
        String primary = emptyToNull(imageUrl);
        if (primary != null) {
            normalized.add(primary);
        }
        if (storedImages != null) {
            for (String storedImage : storedImages) {
                String value = emptyToNull(storedImage);
                if (value != null && !normalized.contains(value)) {
                    normalized.add(value);
                }
            }
        }
        return normalized.isEmpty() ? Collections.emptyList() : normalized;
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

    @JsonIgnore
    public Map<String, String> getSpecificationsMap() {
        if (specifications == null || specifications.isEmpty()) return Collections.emptyMap();
        try {
            Map<String, String> parsed = mapper.readValue(specifications, new TypeReference<Map<String, String>>() {});
            return parsed == null ? Collections.emptyMap() : parsed;
        } catch (Exception e) {
            return Collections.emptyMap();
        }
    }

    @JsonGetter("specifications")
    public Map<String, String> getPublicSpecificationsMap() {
        Map<String, String> raw = getSpecificationsMap();
        if (raw.isEmpty()) {
            return Collections.emptyMap();
        }
        Map<String, String> visible = new LinkedHashMap<>();
        raw.forEach((key, value) -> {
            if (!isSpecificationMetadataKey(key)) {
                visible.put(key, value);
            }
        });
        return visible;
    }

    @JsonProperty(value = "specificationItems", access = Access.READ_ONLY)
    public Map<String, String> getSpecificationItems() {
        return getPublicSpecificationsMap();
    }

    @JsonProperty(value = "i18n", access = Access.READ_ONLY)
    public Map<String, Map<String, String>> getI18nMap() {
        Map<String, Map<String, String>> localized = new LinkedHashMap<>();
        Map<String, String> specs = getSpecificationsMap();
        specs.forEach((key, value) -> {
            if (key == null || !key.startsWith("i18n.")) {
                return;
            }
            String[] parts = key.split("\\.", 3);
            if (parts.length != 3 || parts[1].isBlank() || parts[2].isBlank()) {
                return;
            }
            String text = value == null ? "" : value.trim();
            if (text.isEmpty()) {
                return;
            }
            localized.computeIfAbsent(parts[1], ignored -> new LinkedHashMap<>()).put(parts[2], text);
        });
        return localized;
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

    @JsonSetter("specifications")
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

    @JsonGetter("optionGroups")
    public List<Map<String, Object>> getOptionGroupsList() {
        Map<String, String> raw = getSpecificationsMap();
        if (raw.isEmpty()) {
            return Collections.emptyList();
        }
        List<Map<String, Object>> groups = new ArrayList<>();
        raw.forEach((key, value) -> {
            if (key != null && key.startsWith("options.")) {
                String name = key.substring("options.".length()).trim();
                List<String> values = splitOptionValues(value);
                if (!name.isEmpty() && !values.isEmpty()) {
                    Map<String, Object> group = new LinkedHashMap<>();
                    group.put("name", name);
                    group.put("values", values);
                    group.put("options", values);
                    groups.add(group);
                }
            }
        });
        return groups;
    }

    @JsonGetter("localizedContent")
    public Map<String, Map<String, String>> getLocalizedContentMap() {
        Map<String, String> raw = getSpecificationsMap();
        if (raw.isEmpty()) {
            return Collections.emptyMap();
        }
        Map<String, Map<String, String>> localized = new LinkedHashMap<>();
        raw.forEach((key, value) -> {
            if (key == null || !key.startsWith("i18n.")) {
                return;
            }
            String[] parts = key.split("\\.", 3);
            if (parts.length != 3 || parts[1].trim().isEmpty() || parts[2].trim().isEmpty()) {
                return;
            }
            String text = value == null ? "" : value.trim();
            if (text.isEmpty()) {
                return;
            }
            localized.computeIfAbsent(parts[1].trim(), ignored -> new LinkedHashMap<>())
                    .put(parts[2].trim(), text);
        });
        return localized;
    }

    @JsonGetter("bundle")
    public Map<String, Object> getBundleMap() {
        Map<String, String> raw = getSpecificationsMap();
        if (!"true".equalsIgnoreCase(raw.getOrDefault("bundle.enabled", "false"))) {
            return null;
        }
        Map<String, Object> bundle = new LinkedHashMap<>();
        bundle.put("enabled", true);
        bundle.put("title", emptyToNull(raw.get("bundle.title")));
        bundle.put("price", decimalOrNull(raw.get("bundle.price")));
        bundle.put("items", parseBundleItems(raw.get("bundle.items")));
        return bundle;
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
            return normalizeVariantList(parsed);
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

    public String getWarranty() {
        if (warranty == null) {
            return null;
        }
        String normalized = warranty.trim();
        if (normalized.toLowerCase().contains("demo warranty")) {
            return "30 day replacement for manufacturing defects";
        }
        return normalized.isEmpty() ? null : normalized;
    }

    public void setWarranty(String warranty) {
        this.warranty = warranty;
    }

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

    public LocalDateTime getCreatedAt() {
        if (createdAt != null) {
            return createdAt;
        }
        if (updatedAt != null) {
            return updatedAt;
        }
        return id == null ? null : LocalDateTime.of(2026, 1, 1, 0, 0).plusSeconds(Math.max(0L, id));
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public LocalDateTime getUpdatedAt() {
        return updatedAt == null ? getCreatedAt() : updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    private List<Map<String, Object>> normalizeVariantList(List<Map<String, Object>> values) {
        if (values == null || values.isEmpty()) {
            return Collections.emptyList();
        }
        String fallbackImageUrl = primaryImageUrl();
        List<Map<String, Object>> normalized = new ArrayList<>();
        for (Map<String, Object> value : values) {
            if (value == null || value.isEmpty()) {
                continue;
            }
            Map<String, Object> variant = new LinkedHashMap<>(value);
            Object imageValue = variant.get("imageUrl");
            if ((imageValue == null || String.valueOf(imageValue).trim().isEmpty()) && fallbackImageUrl != null) {
                variant.put("imageUrl", fallbackImageUrl);
            }
            normalized.add(variant);
        }
        return normalized;
    }

    private String primaryImageUrl() {
        return getImageUrl();
    }

    private boolean isSpecificationMetadataKey(String key) {
        if (key == null) {
            return false;
        }
        return SPECIFICATION_METADATA_PREFIXES.stream().anyMatch(key::startsWith);
    }

    private List<String> splitOptionValues(String value) {
        if (value == null || value.trim().isEmpty()) {
            return Collections.emptyList();
        }
        List<String> values = new ArrayList<>();
        for (String part : value.split("[,，、;；\\n]")) {
            String normalized = part == null ? "" : part.trim();
            if (!normalized.isEmpty() && !values.contains(normalized)) {
                values.add(normalized);
            }
        }
        return values;
    }

    private BigDecimal decimalOrNull(String value) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        try {
            return new BigDecimal(value.trim()).setScale(2, RoundingMode.HALF_UP);
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    private List<Map<String, Object>> parseBundleItems(String value) {
        if (value == null || value.trim().isEmpty()) {
            return Collections.emptyList();
        }
        try {
            List<Map<String, Object>> parsed = mapper.readValue(value, new TypeReference<List<Map<String, Object>>>() {});
            return normalizeBundleItems(parsed);
        } catch (Exception ignored) {
            List<Map<String, Object>> items = new ArrayList<>();
            for (String part : value.split("[+,，、\\n]")) {
                String name = part == null ? "" : part.trim();
                if (!name.isEmpty()) {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("name", name);
                    item.put("quantity", 1);
                    items.add(item);
                }
            }
            return items;
        }
    }

    private List<Map<String, Object>> normalizeBundleItems(List<Map<String, Object>> values) {
        if (values == null || values.isEmpty()) {
            return Collections.emptyList();
        }
        List<Map<String, Object>> items = new ArrayList<>();
        for (Map<String, Object> value : values) {
            if (value == null) {
                continue;
            }
            String name = emptyToNull(String.valueOf(value.get("name")));
            if (name == null) {
                continue;
            }
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("name", name);
            item.put("quantity", normalizeBundleQuantity(value.get("quantity")));
            Object productId = value.get("productId");
            if (productId != null) {
                item.put("productId", productId);
            }
            items.add(item);
        }
        return items;
    }

    private int normalizeBundleQuantity(Object value) {
        if (value instanceof Number) {
            return Math.max(1, Math.min(((Number) value).intValue(), 99));
        }
        try {
            return Math.max(1, Math.min(Integer.parseInt(String.valueOf(value)), 99));
        } catch (RuntimeException ignored) {
            return 1;
        }
    }

    private String emptyToNull(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() || "null".equalsIgnoreCase(normalized) ? null : normalized;
    }
} 
