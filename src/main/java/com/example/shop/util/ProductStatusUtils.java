package com.example.shop.util;

import com.example.shop.entity.Product;

import java.util.Locale;
import java.util.Set;

public final class ProductStatusUtils {
    public static final Set<String> PRODUCT_STATUSES = Set.of("ACTIVE", "INACTIVE", "PENDING_REVIEW", "REJECTED");

    private ProductStatusUtils() {
    }

    public static boolean isPublicProduct(Product product) {
        if (product == null) {
            return false;
        }
        String status = product.getStatus();
        return status == null || "ACTIVE".equalsIgnoreCase(status);
    }

    public static String normalizeProductStatus(String status) {
        if (status == null) {
            return null;
        }
        String normalizedInput = status.trim();
        if (normalizedInput.isEmpty()) {
            return null;
        }
        String normalized = normalizedInput.toUpperCase(Locale.ROOT);
        return PRODUCT_STATUSES.contains(normalized) ? normalized : null;
    }
}
