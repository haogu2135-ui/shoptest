package com.example.shop.util;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.List;

public final class ReviewImageUrlCodec {
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final TypeReference<List<String>> STRING_LIST = new TypeReference<>() {};

    private ReviewImageUrlCodec() {
    }

    public static List<String> parse(String value) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.isEmpty()) {
            return List.of();
        }
        try {
            List<String> items = OBJECT_MAPPER.readValue(normalized, STRING_LIST);
            if (items == null) {
                return List.of();
            }
            List<String> normalizedItems = new ArrayList<>(items.size());
            for (String item : items) {
                String normalizedItem = item == null ? "" : item.trim();
                if (!normalizedItem.isEmpty()) {
                    normalizedItems.add(normalizedItem);
                }
            }
            return normalizedItems.isEmpty() ? List.of() : normalizedItems;
        } catch (JsonProcessingException ignored) {
            return List.of();
        }
    }

    public static String toJson(List<String> items) {
        if (items == null || items.isEmpty()) {
            return null;
        }
        try {
            return OBJECT_MAPPER.writeValueAsString(items);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Review images are invalid");
        }
    }
}
