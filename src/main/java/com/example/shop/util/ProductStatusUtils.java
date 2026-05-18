package com.example.shop.util;

import com.example.shop.entity.Product;

import java.util.Set;

public final class ProductStatusUtils {
    public static final Set<String> PRODUCT_STATUSES = Set.of("ACTIVE", "INACTIVE", "PENDING_REVIEW", "REJECTED");

    private ProductStatusUtils() {
    }

    public static boolean isPublicProduct(Product product) {
        return product != null && (product.getStatus() == null || "ACTIVE".equalsIgnoreCase(product.getStatus()));
    }

    public static String normalizeProductStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        String normalized = status.trim().toUpperCase();
        return PRODUCT_STATUSES.contains(normalized) ? normalized : null;
    }
}
