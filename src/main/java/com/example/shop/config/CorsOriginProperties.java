package com.example.shop.config;

import com.example.shop.service.RuntimeConfigService;
import com.example.shop.util.GatewayUrlValidator;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

@Component
public class CorsOriginProperties {
    private static final String LOCAL_DEVELOPMENT_ORIGINS =
            "http://localhost:*,http://127.0.0.1:*";
    private static final String PRODUCTION_ORIGINS = "https://pet.686888666.xyz";

    private final RuntimeConfigService runtimeConfig;

    public CorsOriginProperties(RuntimeConfigService runtimeConfig) {
        this.runtimeConfig = runtimeConfig;
    }

    public List<String> getCorsAllowedOriginPatterns() {
        return parseOriginPatterns(runtimeConfig.getString("app.cors.allowed-origin-patterns", defaultOriginFallback()), defaultOriginFallback());
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
                .filter(pattern -> !"*".equals(pattern))
                .filter(pattern -> !isProductionMode() || isSafeProductionOrigin(pattern))
                .distinct()
                .collect(Collectors.toList());

        if (patterns.isEmpty()) {
            return Arrays.asList(defaultOriginFallback().split(","));
        }
        return patterns;
    }

    private String defaultOriginFallback() {
        return isProductionMode() ? PRODUCTION_ORIGINS : LOCAL_DEVELOPMENT_ORIGINS;
    }

    private boolean isProductionMode() {
        String mode = runtimeConfig.getString("app.runtime-mode", "production");
        String normalized = mode == null ? "" : mode.trim().toLowerCase(Locale.ROOT);
        return "production".equals(normalized) || "prod".equals(normalized);
    }

    private boolean isSafeProductionOrigin(String value) {
        if (!hasText(value)) {
            return false;
        }
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        if ("*".equals(normalized) || normalized.contains("*")) {
            return false;
        }
        try {
            URI uri = new URI(value.trim());
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
            String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
            return "https".equals(scheme)
                    && uri.getUserInfo() == null
                    && !host.isBlank()
                    && !GatewayUrlValidator.isLocalOrPrivateHost(host);
        } catch (Exception e) {
            return false;
        }
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }
}
