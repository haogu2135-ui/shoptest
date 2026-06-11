package com.example.shop.util;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.stream.Collectors;

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
            return items.stream()
                    .map(item -> item == null ? "" : item.trim())
                    .filter(item -> !item.isEmpty())
                    .collect(Collectors.toList());
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
