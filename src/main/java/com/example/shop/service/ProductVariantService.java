package com.example.shop.service;

import lombok.extern.slf4j.Slf4j;

import com.example.shop.entity.Product;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@Service
@Slf4j
public class ProductVariantService {
    private static final ObjectMapper mapper = new ObjectMapper();
    private static final String PURCHASE_MODE_BUNDLE = "bundle";
    private static final int MAX_OPTION_GROUPS = 6;
    private static final int MAX_OPTION_VALUES_PER_GROUP = 40;
    private static final int MAX_OPTION_COMBINATIONS = 500;
    private static final int MAX_VARIANTS_PER_PRODUCT = 500;
    private static final Set<String> ALLOWED_METADATA_KEYS = Set.of(
            "_variantSku",
            "_purchaseMode",
            "_bundleTitle",
            "_bundleItems"
    );

    public Optional<Map<String, Object>> findSelectedVariant(Product product, String selectedSpecs) {
        List<Map<String, Object>> variants = product.getVariantsList();
        Map<String, String> selected = parseSelectedSpecs(selectedSpecs);
        return findSelectedVariant(variants, selected);
    }

    public BigDecimal resolvePrice(Product product, String selectedSpecs) {
        Map<String, String> selected = parseSelectedSpecs(selectedSpecs);
        BigDecimal bundlePrice = resolveBundlePrice(product, selected);
        if (bundlePrice != null) {
            return bundlePrice;
        }
        Optional<Map<String, Object>> variant = findSelectedVariant(product.getVariantsList(), selected);
        if (variant.isPresent()) {
            BigDecimal price = decimalValue(variant.get().get("price"));
            if (price.compareTo(BigDecimal.ZERO) > 0) {
                return price;
            }
        }
        return product.getEffectivePrice();
    }

    public Integer resolveStock(Product product, String selectedSpecs) {
        Optional<Map<String, Object>> variant = findSelectedVariant(product.getVariantsList(), parseSelectedSpecs(selectedSpecs));
        if (!variant.isPresent()) return product.getStock();
        Integer stock = integerValue(variant.get().get("stock"));
        return stock == null ? product.getStock() : stock;
    }

    public void validateSelection(Product product, String selectedSpecs) {
        validateVariantCatalog(product);
        Map<String, String> selected = parseSelectedSpecs(selectedSpecs);
        List<String> requiredOptions = requiredOptionNames(product);
        rejectUnknownSelectedKeys(selected, requiredOptions);
        String purchaseMode = selected.get("_purchaseMode");
        if (purchaseMode != null && !purchaseMode.trim().isEmpty() && !PURCHASE_MODE_BUNDLE.equals(purchaseMode)) {
            throw new IllegalArgumentException("Selected purchase mode is unavailable");
        }
        for (String optionName : requiredOptions) {
            if (selected.get(optionName) == null || selected.get(optionName).trim().isEmpty()) {
                throw new IllegalArgumentException("Please select " + optionName);
            }
        }

        List<Map<String, Object>> variants = product.getVariantsList();
        if (variants != null && !variants.isEmpty() && !findSelectedVariant(variants, selected).isPresent()) {
            throw new IllegalArgumentException("Selected product variant is unavailable");
        }

        if (PURCHASE_MODE_BUNDLE.equals(selected.get("_purchaseMode")) && resolveBundlePrice(product, selected) == null) {
            throw new IllegalArgumentException("Selected bundle is unavailable");
        }
    }

    public boolean decreaseVariantStock(Product product, String selectedSpecs, Integer quantity) {
        if (quantity == null || quantity <= 0) {
            throw new IllegalArgumentException("Invalid quantity");
        }
        List<Map<String, Object>> variants = product.getVariantsList();
        Optional<Map<String, Object>> selected = findSelectedVariant(variants, parseSelectedSpecs(selectedSpecs));
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
        Optional<Map<String, Object>> selected = findSelectedVariant(variants, parseSelectedSpecs(selectedSpecs));
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
            return null;
        }
        try {
            return mapper.writeValueAsString(selected);
        } catch (Exception e) {
            return null;
        }
    }

    private void validateVariantCatalog(Product product) {
        List<String> requiredOptions = requiredOptionNames(product);
        if (requiredOptions.size() > MAX_OPTION_GROUPS) {
            throw new IllegalArgumentException("Too many product option groups");
        }

        long combinationCount = 1;
        Map<String, String> specs = product.getSpecificationsMap();
        if (specs != null) {
            for (String optionName : requiredOptions) {
                List<String> values = optionValues(specs.get("options." + optionName));
                if (values.size() > MAX_OPTION_VALUES_PER_GROUP) {
                    throw new IllegalArgumentException("Too many values for option: " + optionName);
                }
                combinationCount *= Math.max(1, values.size());
                if (combinationCount > MAX_OPTION_COMBINATIONS) {
                    throw new IllegalArgumentException("Too many product option combinations");
                }
            }
        }

        List<Map<String, Object>> variants = product.getVariantsList();
        if (variants == null || variants.isEmpty()) {
            return;
        }
        if (variants.size() > MAX_VARIANTS_PER_PRODUCT) {
            throw new IllegalArgumentException("Too many product variants");
        }

        Set<String> seenSkus = new HashSet<>();
        Set<String> seenCombinations = new HashSet<>();
        Set<String> requiredOptionSet = new HashSet<>(requiredOptions);
        for (Map<String, Object> variant : variants) {
            String sku = String.valueOf(variant.getOrDefault("sku", "")).trim();
            if (!sku.isEmpty() && !seenSkus.add(sku)) {
                throw new IllegalArgumentException("Duplicate product variant SKU");
            }
            Map<String, String> options = parseVariantOptions(variant);
            if (options.isEmpty()) {
                throw new IllegalArgumentException("Product variant options are required");
            }
            for (String optionName : requiredOptions) {
                if (options.get(optionName) == null || options.get(optionName).trim().isEmpty()) {
                    throw new IllegalArgumentException("Product variant is missing option: " + optionName);
                }
            }
            for (String optionName : options.keySet()) {
                if (!requiredOptionSet.contains(optionName)) {
                    throw new IllegalArgumentException("Product variant has unknown option: " + optionName);
                }
            }
            StringBuilder combinationBuilder = new StringBuilder();
            for (String optionName : requiredOptions) {
                if (combinationBuilder.length() > 0) {
                    combinationBuilder.append('|');
                }
                combinationBuilder.append(optionName).append('=').append(options.get(optionName));
            }
            String combinationKey = combinationBuilder.toString();
            if (!seenCombinations.add(combinationKey)) {
                throw new IllegalArgumentException("Duplicate product variant option combination");
            }
        }
    }

    private void rejectUnknownSelectedKeys(Map<String, String> selected, List<String> requiredOptions) {
        Set<String> requiredOptionSet = new HashSet<>(requiredOptions);
        for (String key : selected.keySet()) {
            if (requiredOptionSet.contains(key)) {
                continue;
            }
            if (ALLOWED_METADATA_KEYS.contains(key)) {
                continue;
            }
            throw new IllegalArgumentException("Selected option is unavailable: " + key);
        }
    }

    private List<String> optionValues(String rawValue) {
        if (rawValue == null || rawValue.trim().isEmpty()) {
            return new ArrayList<>();
        }
        Set<String> values = new HashSet<>();
        int tokenStart = 0;
        for (int index = 0; index <= rawValue.length(); index++) {
            if (index != rawValue.length() && !isOptionDelimiter(rawValue.charAt(index))) {
                continue;
            }
            String value = rawValue.substring(tokenStart, index).trim();
            if (!value.isEmpty()) values.add(value);
            tokenStart = index + 1;
        }
        return new ArrayList<>(values);
    }

    private BigDecimal resolveBundlePrice(Product product, Map<String, String> selected) {
        if (!PURCHASE_MODE_BUNDLE.equals(selected.get("_purchaseMode"))) {
            return null;
        }
        Map<String, String> specs = product.getSpecificationsMap();
        if (specs == null || !"true".equalsIgnoreCase(specs.getOrDefault("bundle.enabled", "false"))) {
            return null;
        }
        BigDecimal bundlePrice = decimalValue(specs.get("bundle.price"));
        return bundlePrice.compareTo(BigDecimal.ZERO) > 0 ? bundlePrice : null;
    }

    private boolean selectedOptionsMatch(Map<String, Object> variant, Map<String, String> selected) {
        Map<String, String> options = parseVariantOptions(variant);
        if (options.isEmpty()) {
            return false;
        }
        for (Map.Entry<String, String> entry : options.entrySet()) {
            String key = entry.getKey();
            String value = entry.getValue();
            if (!value.equals(selected.get(key))) {
                return false;
            }
        }
        return true;
    }

    private List<String> requiredOptionNames(Product product) {
        Map<String, String> specs = product.getSpecificationsMap();
        if (specs != null && !specs.isEmpty()) {
            List<String> configuredOptions = new ArrayList<>();
            for (Map.Entry<String, String> entry : specs.entrySet()) {
                String key = entry.getKey();
                String value = entry.getValue();
                if (key == null || !key.startsWith("options.") || value == null || value.trim().isEmpty()) {
                    continue;
                }
                String name = key.substring("options.".length());
                if (!name.trim().isEmpty()) configuredOptions.add(name);
            }
            if (!configuredOptions.isEmpty()) {
                return configuredOptions;
            }
        }

        List<Map<String, Object>> variants = product.getVariantsList();
        if (variants == null || variants.isEmpty()) {
            return new ArrayList<>();
        }
        List<String> names = new ArrayList<>();
        Set<String> seenNames = new HashSet<>();
        for (Map<String, Object> variant : variants) {
            for (String name : parseVariantOptions(variant).keySet()) {
                if (name != null && !name.trim().isEmpty() && seenNames.add(name)) names.add(name);
            }
        }
        return names;
    }

    private Optional<Map<String, Object>> findSelectedVariant(List<Map<String, Object>> variants, Map<String, String> selected) {
        if (variants == null || variants.isEmpty() || selected.isEmpty()) {
            return Optional.empty();
        }
        String selectedSku = selected.get("_variantSku");
        for (Map<String, Object> variant : variants) {
            if (selectedSku != null && !selectedSku.isEmpty()
                    && !selectedSku.equals(String.valueOf(variant.getOrDefault("sku", "")).trim())) {
                continue;
            }
            if (selectedOptionsMatch(variant, selected)) return Optional.of(variant);
        }
        return Optional.empty();
    }

    private Map<String, String> parseSelectedSpecs(String selectedSpecs) {
        if (selectedSpecs == null || selectedSpecs.trim().isEmpty()) {
            return Map.of();
        }
        try {
            Map<String, Object> raw = mapper.readValue(selectedSpecs, new TypeReference<LinkedHashMap<String, Object>>() {});
            Map<String, String> result = new LinkedHashMap<>();
            for (Map.Entry<String, Object> entry : raw.entrySet()) {
                String key = entry.getKey();
                Object value = entry.getValue();
                if (value != null) result.put(key, String.valueOf(value));
            }
            return result;
        } catch (Exception e) {
            return Map.of();
        }
    }

    private Map<String, String> parseVariantOptions(Map<String, Object> variant) {
        if (variant == null || variant.isEmpty()) {
            return Map.of();
        }
        Object rawOptions = variant.get("options");
        if (rawOptions instanceof Map) {
            Map<?, ?> options = (Map<?, ?>) rawOptions;
            Map<String, String> result = new LinkedHashMap<>();
            for (Map.Entry<?, ?> entry : options.entrySet()) {
                Object key = entry.getKey();
                Object value = entry.getValue();
                String normalizedKey = key == null ? "" : String.valueOf(key).trim();
                String normalizedValue = value == null ? "" : String.valueOf(value).trim();
                if (!normalizedKey.isEmpty() && !normalizedValue.isEmpty()) {
                    result.put(normalizedKey, normalizedValue);
                }
            }
            return result;
        }

        Object optionText = variant.get("optionText");
        if (optionText == null || String.valueOf(optionText).trim().isEmpty()) {
            return Map.of();
        }
        Map<String, String> result = new LinkedHashMap<>();
        String text = String.valueOf(optionText);
        int tokenStart = 0;
        for (int index = 0; index <= text.length(); index++) {
            if (index != text.length() && !isOptionDelimiter(text.charAt(index))) continue;
            addOptionToken(result, text.substring(tokenStart, index));
            tokenStart = index + 1;
        }
        return result;
    }

    private boolean isOptionDelimiter(char value) {
        return value == ',' || value == '\uFF0C' || value == '\u3001' || value == ';' || value == '\uFF1B' || value == '\n';
    }

    private void addOptionToken(Map<String, String> options, String token) {
        int separator = token.indexOf('=');
        if (separator < 0) return;
        String key = token.substring(0, separator).trim();
        String value = token.substring(separator + 1).trim();
        if (!key.isEmpty() && !value.isEmpty()) options.put(key, value);
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
            if (value instanceof BigDecimal) {
                return (BigDecimal) value;
            }
            if (value instanceof Byte || value instanceof Short
                    || value instanceof Integer || value instanceof Long) {
                return BigDecimal.valueOf(((Number) value).longValue());
            }
            // Preserve the catalog number's decimal representation instead of
            // exposing binary floating-point artifacts through doubleValue().
            return new BigDecimal(value.toString());
        }
        if (value == null) {
            return BigDecimal.ZERO;
        }
        String text = String.valueOf(value).trim();
        if (text.isEmpty()) return BigDecimal.ZERO;
        try {
            return new BigDecimal(text);
        } catch (NumberFormatException e) {
            return BigDecimal.ZERO;
        }
    }

    private Integer integerValue(Object value) {
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        if (text.isEmpty()) return null;
        try {
            return Integer.parseInt(text);
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
