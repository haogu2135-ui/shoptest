package com.example.shop.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Component
public class CorsOriginProperties {
    private static final String LOCALHOST_ORIGINS = "http://localhost:*,http://127.0.0.1:*";

    @Value("${app.cors.allowed-origin-patterns:" + LOCALHOST_ORIGINS + "}")
    private String corsAllowedOriginPatterns;

    @Value("${app.websocket.allowed-origin-patterns:}")
    private String webSocketAllowedOriginPatterns;

    public List<String> getCorsAllowedOriginPatterns() {
        return parseOriginPatterns(corsAllowedOriginPatterns, LOCALHOST_ORIGINS);
    }

    public String[] getCorsAllowedOriginPatternArray() {
        return getCorsAllowedOriginPatterns().toArray(new String[0]);
    }

    public String[] getWebSocketAllowedOriginPatternArray() {
        String fallback = String.join(",", getCorsAllowedOriginPatterns());
        return parseOriginPatterns(webSocketAllowedOriginPatterns, fallback).toArray(new String[0]);
    }

    private List<String> parseOriginPatterns(String rawPatterns, String fallbackPatterns) {
        String source = hasText(rawPatterns) ? rawPatterns : fallbackPatterns;
        List<String> patterns = Arrays.stream(source.split(","))
                .map(String::trim)
                .filter(this::hasText)
                .distinct()
                .collect(Collectors.toList());

        if (patterns.isEmpty()) {
            return Arrays.asList(LOCALHOST_ORIGINS.split(","));
        }
        return patterns;
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }
}
