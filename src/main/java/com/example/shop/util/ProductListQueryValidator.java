package com.example.shop.util;

import com.example.shop.dto.ProductListQuery;

import java.math.BigDecimal;
import java.util.List;

/**
 * Validates product list filters after request parameters have been assembled
 * into a query object. Controller methods build this DTO manually to support
 * legacy parameter aliases, so bean-validation annotations alone are not
 * enough to protect the HTTP entry points.
 */
public final class ProductListQueryValidator {
    public static final int MAX_KEYWORD_LENGTH = 120;
    public static final int MAX_FILTER_VALUE_COUNT = 32;
    public static final int MAX_FILTER_VALUE_LENGTH = 64;
    public static final int MAX_COLLECTION_LENGTH = 80;
    public static final int MAX_STATUS_LENGTH = 40;
    public static final int MAX_SORT_LENGTH = 80;

    private ProductListQueryValidator() {
    }

    public static void validate(ProductListQuery query) {
        if (query == null) {
            return;
        }
        requireMaxLength(query.getKeyword(), MAX_KEYWORD_LENGTH, "keyword");
        requirePositive(query.getCategoryId(), "categoryId");
        requireNonNegative(query.getMinPrice(), "minPrice");
        requireNonNegative(query.getMaxPrice(), "maxPrice");
        validateFilterValues(query.getPetSizes(), "petSize");
        validateFilterValues(query.getMaterials(), "material");
        validateFilterValues(query.getColors(), "color");
        requireMaxLength(query.getCollection(), MAX_COLLECTION_LENGTH, "collection");
        requireMaxLength(query.getStatus(), MAX_STATUS_LENGTH, "status");
        requireMaxLength(query.getSort(), MAX_SORT_LENGTH, "sort");
    }

    private static void validateFilterValues(List<String> values, String field) {
        if (values == null) {
            return;
        }
        if (values.size() > MAX_FILTER_VALUE_COUNT) {
            throw new IllegalArgumentException(field + " must contain at most " + MAX_FILTER_VALUE_COUNT + " values");
        }
        for (String value : values) {
            requireMaxLength(value, MAX_FILTER_VALUE_LENGTH, field);
        }
    }

    private static void requirePositive(Long value, String field) {
        if (value != null && value < 1) {
            throw new IllegalArgumentException(field + " must be greater than 0");
        }
    }

    private static void requireNonNegative(BigDecimal value, String field) {
        if (value != null && value.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException(field + " must be greater than or equal to 0");
        }
    }

    private static void requireMaxLength(String value, int maxLength, String field) {
        if (value != null && value.length() > maxLength) {
            throw new IllegalArgumentException(field + " must be " + maxLength + " characters or fewer");
        }
    }
}
