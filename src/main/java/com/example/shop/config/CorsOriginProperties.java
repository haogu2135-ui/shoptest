package com.example.shop.config;

import com.example.shop.service.RuntimeConfigService;
import com.example.shop.util.GatewayUrlValidator;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;

@Component
public class CorsOriginProperties {
    private static final String LOCAL_DEVELOPMENT_ORIGINS =
            "http://localhost:*,http://127.0.0.1:*";
    private static final String PRODUCTION_ORIGINS = "https://petsanything.com";

    private final RuntimeConfigService runtimeConfig;

    public CorsOriginProperties(RuntimeConfigService runtimeConfig) {
        this.runtimeConfig = runtimeConfig;
    }

    public List<String> getCorsAllowedOriginPatterns() {
        boolean productionMode = isProductionMode();
        String fallback = defaultOriginFallback(productionMode);
        return parseOriginPatterns(
                runtimeConfig.getString("app.cors.allowed-origin-patterns", fallback), fallback, productionMode);
    }

    public String[] getCorsAllowedOriginPatternArray() {
        return getCorsAllowedOriginPatterns().toArray(new String[0]);
    }

    public String[] getWebSocketAllowedOriginPatternArray() {
        String fallback = String.join(",", getCorsAllowedOriginPatterns());
        return parseOriginPatterns(
                runtimeConfig.getString("app.websocket.allowed-origin-patterns", ""),
                fallback,
                isProductionMode()).toArray(new String[0]);
    }

    private List<String> parseOriginPatterns(String rawPatterns, String fallbackPatterns, boolean productionMode) {
        String source = hasText(rawPatterns) ? rawPatterns : fallbackPatterns;
        LinkedHashSet<String> uniquePatterns = new LinkedHashSet<>();
        int start = 0;
        for (int index = 0; index <= source.length(); index++) {
            if (index != source.length() && source.charAt(index) != ',') {
                continue;
            }
            String pattern = source.substring(start, index).trim();
            if (!pattern.isEmpty() && !"*".equals(pattern)
                    && (!productionMode || isSafeProductionOrigin(pattern))) {
                uniquePatterns.add(pattern);
            }
            start = index + 1;
        }
        List<String> patterns = new ArrayList<>(uniquePatterns);

        if (patterns.isEmpty()) {
            return List.of(fallbackPatterns.split(","));
        }
        return patterns;
    }

    private String defaultOriginFallback(boolean productionMode) {
        return productionMode ? PRODUCTION_ORIGINS : LOCAL_DEVELOPMENT_ORIGINS;
    }

    private boolean isProductionMode() {
        String mode = runtimeConfig.getString("app.runtime-mode", "production");
        String normalized = mode == null ? "" : mode.trim().toLowerCase(Locale.ROOT);
        return "production".equals(normalized) || "prod".equals(normalized);
    }

    private boolean isSafeProductionOrigin(String value) {
        String trimmed = value == null ? "" : value.trim();
        if (trimmed.isEmpty()) {
            return false;
        }
        String normalized = trimmed.toLowerCase(Locale.ROOT);
        if ("*".equals(normalized) || normalized.contains("*")) {
            return false;
        }
        try {
            URI uri = new URI(trimmed);
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
