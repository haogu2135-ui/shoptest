package com.example.shop.config;

import com.example.shop.service.RuntimeConfigService;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Component
public class CorsOriginProperties {
    private static final String LOCAL_DEVELOPMENT_ORIGINS =
            "http://localhost:*,http://127.0.0.1:*,"
                    + "http://10.*:*,http://172.*:*,http://192.168.*:*";

    private final RuntimeConfigService runtimeConfig;

    public CorsOriginProperties(RuntimeConfigService runtimeConfig) {
        this.runtimeConfig = runtimeConfig;
    }

    public List<String> getCorsAllowedOriginPatterns() {
        return parseOriginPatterns(runtimeConfig.getString("app.cors.allowed-origin-patterns", LOCAL_DEVELOPMENT_ORIGINS), LOCAL_DEVELOPMENT_ORIGINS);
    }

    public String[] getCorsAllowedOriginPatternArray() {
        return getCorsAllowedOriginPatterns().toArray(new String[0]);
    }

    public String[] getWebSocketAllowedOriginPatternArray() {
        String fallback = String.join(",", getCorsAllowedOriginPatterns());
        return parseOriginPatterns(runtimeConfig.getString("app.websocket.allowed-origin-patterns", ""), fallback).toArray(new String[0]);
    }

    private List<String> parseOriginPatterns(String rawPatterns, String fallbackPatterns) {
        String source = hasText(rawPatterns) ? rawPatterns : fallbackPatterns;
        List<String> patterns = Arrays.stream(source.split(","))
                .map(String::trim)
                .filter(this::hasText)
                .distinct()
                .collect(Collectors.toList());

        if (patterns.isEmpty()) {
            return Arrays.asList(LOCAL_DEVELOPMENT_ORIGINS.split(","));
        }
        return patterns;
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }
}
