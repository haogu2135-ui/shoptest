package com.example.shop.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Locale;
import java.util.Set;

@Configuration
public class AdminBootstrapTokenPolicy {
    public static final int MIN_BOOTSTRAP_TOKEN_LENGTH = 32;

    private static final Set<String> PLACEHOLDER_TOKENS = Set.of(
            "admin-bootstrap-token",
            "bootstrap-token",
            "changeme",
            "change-me",
            "default-bootstrap-token",
            "replace-me",
            "secret",
            "temporary-bootstrap-token",
            "temporary-token",
            "test-bootstrap-token",
            "your-admin-bootstrap-token",
            "your-bootstrap-token"
    );

    private final String configuredToken;

    public AdminBootstrapTokenPolicy(@Value("${admin.bootstrap-token:}") String configuredToken) {
        this.configuredToken = configuredToken;
    }

    @Bean
    public ApplicationRunner validateAdminBootstrapTokenAtStartup() {
        return args -> {
            if (isConfiguredButWeak(configuredToken)) {
                throw new IllegalStateException(
                        "admin.bootstrap-token must be blank or at least 32 non-placeholder characters");
            }
        };
    }

    public static String normalize(String token) {
        return token == null ? "" : token.trim();
    }

    public static boolean isConfiguredButWeak(String token) {
        String normalized = normalize(token);
        return !normalized.isEmpty() && !isStrongConfiguredToken(normalized);
    }

    public static boolean isStrongConfiguredToken(String token) {
        String normalized = normalize(token);
        if (normalized.length() < MIN_BOOTSTRAP_TOKEN_LENGTH) {
            return false;
        }
        String lower = normalized.toLowerCase(Locale.ROOT);
        if (PLACEHOLDER_TOKENS.contains(lower)
                || lower.startsWith("replace-")
                || lower.contains("replace-with")
                || lower.contains("your-")
                || lower.contains("changeme")
                || lower.contains("password")) {
            return false;
        }
        return normalized.chars().distinct().count() >= 8;
    }
}
