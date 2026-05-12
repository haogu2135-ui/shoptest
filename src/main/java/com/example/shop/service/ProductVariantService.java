package com.example.shop.service;

import com.example.shop.entity.Product;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.LinkedHashMap;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class ProductVariantService {
    private static final ObjectMapper mapper = new ObjectMapper();
    private static final BigDecimal SUBSCRIBE_AND_SAVE_RATE = new BigDecimal("0.80");
    private static final String PURCHASE_MODE_BUNDLE = "bundle";

    public Optional<Map<String, Object>> findSelectedVariant(Product product, String selectedSpecs) {
        List<Map<String, Object>> variants = product.getVariantsList();
        Map<String, String> selected = parseSelectedSpecs(selectedSpecs);
        if (variants == null || variants.isEmpty() || selected.isEmpty()) {
            return Optional.empty();
        }
        String selectedSku = selected.get("_variantSku");
        if (selectedSku != null && !selectedSku.isEmpty()) {
            Optional<Map<String, Object>> bySku = variants.stream()
                    .filter(variant -> selectedSku.equals(String.valueOf(variant.getOrDefault("sku", ""))))
                    .findFirst();
            if (bySku.isPresent()) return bySku;
        }
        return variants.stream()
                .filter(variant -> selectedOptionsMatch(variant, selected))
                .findFirst();
    }

    public BigDecimal resolvePrice(Product product, String selectedSpecs) {
        BigDecimal bundlePrice = resolveBundlePrice(product, selectedSpecs);
        if (bundlePrice != null) {
            return bundlePrice;
        }
        BigDecimal price = findSelectedVariant(product, selectedSpecs)
                .map(variant -> decimalValue(variant.get("price")))
                .filter(resolvedPrice -> resolvedPrice.compareTo(BigDecimal.ZERO) > 0)
                .orElse(product.getEffectivePrice());
        return applyPurchaseModeDiscount(price, selectedSpecs);
    }

    public Integer resolveStock(Product product, String selectedSpecs) {
        return findSelectedVariant(product, selectedSpecs)
                .map(variant -> integerValue(variant.get("stock")))
                .orElse(product.getStock());
    }

    public void validateSelection(Product product, String selectedSpecs) {
        Map<String, String> selected = parseSelectedSpecs(selectedSpecs);
        for (String optionName : requiredOptionNames(product)) {
            if (selected.get(optionName) == null || selected.get(optionName).trim().isEmpty()) {
                throw new IllegalArgumentException("Please select " + optionName);
            }
        }

        List<Map<String, Object>> variants = product.getVariantsList();
        if (variants != null && !variants.isEmpty() && !findSelectedVariant(variants, selectedSpecs).isPresent()) {
            throw new IllegalArgumentException("Selected product variant is unavailable");
        }

        if (PURCHASE_MODE_BUNDLE.equals(selected.get("_purchaseMode")) && resolveBundlePrice(product, selectedSpecs) == null) {
            throw new IllegalArgumentException("Selected bundle is unavailable");
        }
    }

    public boolean decreaseVariantStock(Product product, String selectedSpecs, Integer quantity) {
        if (quantity == null || quantity <= 0) {
            throw new IllegalArgumentException("Invalid quantity");
        }
        List<Map<String, Object>> variants = product.getVariantsList();
        Optional<Map<String, Object>> selected = findSelectedVariant(variants, selectedSpecs);
        if (!selected.isPresent()) {
            return false;
        }
        Map<String, Object> variant = selected.get();
        Integer stock = integerValue(variant.get("stock"));
        if (stock == null || stock < quantity) {
            throw new IllegalArgumentException("Insufficient stock for product: " + product.getName());
        }
        variant.put("stock", stock - quantity);
        writeVariants(product, variants);
        return true;
    }

    public boolean increaseVariantStock(Product product, String selectedSpecs, Integer quantity) {
        if (quantity == null || quantity <= 0) {
            throw new IllegalArgumentException("Invalid quantity");
        }
        List<Map<String, Object>> variants = product.getVariantsList();
        Optional<Map<String, Object>> selected = findSelectedVariant(variants, selectedSpecs);
        if (!selected.isPresent()) {
            return false;
        }
        Map<String, Object> variant = selected.get();
        Integer stock = integerValue(variant.get("stock"));
        variant.put("stock", (stock == null ? 0 : stock) + quantity);
        writeVariants(product, variants);
        return true;
    }

    public String normalizeSpecs(String selectedSpecs) {
        if (selectedSpecs == null || selectedSpecs.trim().isEmpty()) {
            return null;
        }
        Map<String, String> selected = parseSelectedSpecs(selectedSpecs);
        if (selected.isEmpty()) {
            return selectedSpecs.trim();
        }
        try {
            return mapper.writeValueAsString(selected);
        } catch (Exception e) {
            return selectedSpecs.trim();
        }
    }

    public boolean isSubscribeAndSave(String selectedSpecs) {
        return "subscribe".equals(parseSelectedSpecs(selectedSpecs).get("_purchaseMode"));
    }

    private BigDecimal resolveBundlePrice(Product product, String selectedSpecs) {
        if (!PURCHASE_MODE_BUNDLE.equals(parseSelectedSpecs(selectedSpecs).get("_purchaseMode"))) {
            return null;
        }
        Map<String, String> specs = product.getSpecificationsMap();
        if (specs == null || !"true".equalsIgnoreCase(specs.getOrDefault("bundle.enabled", "false"))) {
            return null;
        }
        BigDecimal bundlePrice = decimalValue(specs.get("bundle.price"));
        return bundlePrice.compareTo(BigDecimal.ZERO) > 0 ? bundlePrice : null;
    }

    private BigDecimal applyPurchaseModeDiscount(BigDecimal price, String selectedSpecs) {
        if (price == null || !isSubscribeAndSave(selectedSpecs)) {
            return price;
        }
        return price.multiply(SUBSCRIBE_AND_SAVE_RATE).setScale(2, RoundingMode.HALF_UP);
    }

    private boolean selectedOptionsMatch(Map<String, Object> variant, Map<String, String> selected) {
        Object rawOptions = variant.get("options");
        if (!(rawOptions instanceof Map)) {
            return false;
        }
        Map<?, ?> options = (Map<?, ?>) rawOptions;
        if (options.isEmpty()) {
            return false;
        }
        for (Map.Entry<?, ?> entry : options.entrySet()) {
            String key = String.valueOf(entry.getKey());
            String value = String.valueOf(entry.getValue());
            if (!value.equals(selected.get(key))) {
                return false;
            }
        }
        return true;
    }

    private List<String> requiredOptionNames(Product product) {
        Map<String, String> specs = product.getSpecificationsMap();
        if (specs == null || specs.isEmpty()) {
            return new ArrayList<>();
        }
        return specs.entrySet().stream()
                .filter(entry -> entry.getKey() != null && entry.getKey().startsWith("options."))
                .filter(entry -> entry.getValue() != null && !entry.getValue().trim().isEmpty())
                .map(entry -> entry.getKey().replaceFirst("^options\\.", ""))
                .filter(name -> !name.trim().isEmpty())
                .collect(Collectors.toList());
    }

    private Optional<Map<String, Object>> findSelectedVariant(List<Map<String, Object>> variants, String selectedSpecs) {
        Map<String, String> selected = parseSelectedSpecs(selectedSpecs);
        if (variants == null || variants.isEmpty() || selected.isEmpty()) {
            return Optional.empty();
        }
        String selectedSku = selected.get("_variantSku");
        if (selectedSku != null && !selectedSku.isEmpty()) {
            Optional<Map<String, Object>> bySku = variants.stream()
                    .filter(variant -> selectedSku.equals(String.valueOf(variant.getOrDefault("sku", ""))))
                    .findFirst();
            if (bySku.isPresent()) return bySku;
        }
        return variants.stream()
                .filter(variant -> selectedOptionsMatch(variant, selected))
                .findFirst();
    }

    private Map<String, String> parseSelectedSpecs(String selectedSpecs) {
        if (selectedSpecs == null || selectedSpecs.trim().isEmpty()) {
            return Map.of();
        }
        try {
            Map<String, Object> raw = mapper.readValue(selectedSpecs, new TypeReference<LinkedHashMap<String, Object>>() {});
            Map<String, String> result = new LinkedHashMap<>();
            raw.forEach((key, value) -> {
                if (value != null) result.put(key, String.valueOf(value));
            });
            return result;
        } catch (Exception e) {
            return Map.of();
        }
    }

    private void writeVariants(Product product, List<Map<String, Object>> variants) {
        try {
            product.setVariants(variants == null || variants.isEmpty() ? null : mapper.writeValueAsString(variants));
        } catch (Exception e) {
            throw new IllegalStateException("Failed to update product variants");
        }
    }

    private BigDecimal decimalValue(Object value) {
        if (value instanceof Number) {
            return BigDecimal.valueOf(((Number) value).doubleValue());
        }
        if (value == null || String.valueOf(value).trim().isEmpty()) {
            return BigDecimal.ZERO;
        }
        return new BigDecimal(String.valueOf(value));
    }

    private Integer integerValue(Object value) {
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        if (value == null || String.valueOf(value).trim().isEmpty()) {
            return null;
        }
        return Integer.parseInt(String.valueOf(value));
    }
}
