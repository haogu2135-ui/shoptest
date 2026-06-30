package com.example.shop.config;

import org.springframework.beans.BeansException;
import org.springframework.beans.factory.config.BeanFactoryPostProcessor;
import org.springframework.beans.factory.config.ConfigurableListableBeanFactory;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

@Component
public class ProductionSecretStartupValidator implements BeanFactoryPostProcessor {
    private final Environment environment;

    public ProductionSecretStartupValidator(Environment environment) {
        this.environment = environment;
    }

    @Override
    public void postProcessBeanFactory(ConfigurableListableBeanFactory beanFactory) throws BeansException {
        if (!isProductionMode(property("app.runtime-mode", "production"))) {
            return;
        }

        List<String> issues = new ArrayList<>();
        String jwtSecret = property("app.jwtSecret", "");
        requireStrongSecret(issues, "app.jwtSecret", jwtSecret, List.of("your-secret-key", "your-secret-key-here"));
        requireStrongRuntimePassword(issues, "spring.datasource.password", property("spring.datasource.password", ""),
                List.of("shop_password", "root", "password"));
        requireStrongRuntimePassword(issues, "spring.redis.password", property("spring.redis.password", ""),
                List.of("shop_redis_password", "redis", "password"));
        requireStrongSecret(issues, "payment.callback-secret", property("payment.callback-secret", ""),
                List.of("dev-payment-secret"));

        String mailCodePepper = property("app.mail.code-pepper", "");
        requireStrongSecret(issues, "app.mail.code-pepper", mailCodePepper, List.of("mail-code-pepper"));
        if (hasText(mailCodePepper) && mailCodePepper.trim().equals(jwtSecret.trim())) {
            issues.add("app.mail.code-pepper must not reuse app.jwtSecret");
        }

        if (!issues.isEmpty()) {
            throw new IllegalStateException("Production secrets are not configured: " + String.join("; ", issues));
        }
    }

    private String property(String key, String defaultValue) {
        return environment == null ? defaultValue : environment.getProperty(key, defaultValue);
    }

    private boolean isProductionMode(String mode) {
        String normalized = mode == null ? "production" : mode.trim().toLowerCase(Locale.ROOT);
        return "production".equals(normalized) || "prod".equals(normalized);
    }

    private void requireStrongSecret(List<String> issues, String propertyName, String value, List<String> extraPlaceholders) {
        if (!isStrongSecret(value, extraPlaceholders)) {
            issues.add(propertyName + " must be set to a non-placeholder value with at least 32 characters");
        }
    }

    private boolean isStrongSecret(String value, List<String> extraPlaceholders) {
        if (!hasText(value)) {
            return false;
        }
        String normalized = value.trim();
        if (normalized.length() < 32) {
            return false;
        }
        String lower = normalized.toLowerCase(Locale.ROOT);
        List<String> placeholders = new ArrayList<>(List.of(
                "secret",
                "password",
                "changeme",
                "change-me",
                "test-secret",
                "jwt-secret",
                "default-secret"
        ));
        placeholders.addAll(extraPlaceholders.stream()
                .map(item -> item == null ? "" : item.toLowerCase(Locale.ROOT))
                .collect(Collectors.toList()));
        return placeholders.stream().noneMatch(lower::equals)
                && !lower.startsWith("replace-")
                && !lower.contains("replace-with")
                && !lower.contains("your-");
    }

    private void requireStrongRuntimePassword(List<String> issues,
                                              String propertyName,
                                              String value,
                                              List<String> extraPlaceholders) {
        if (!isStrongRuntimePassword(value, extraPlaceholders)) {
            issues.add(propertyName + " must be set to a non-default production password");
        }
    }

    private boolean isStrongRuntimePassword(String value, List<String> extraPlaceholders) {
        if (!hasText(value)) {
            return false;
        }
        String normalized = value.trim();
        if (normalized.length() < 12) {
            return false;
        }
        String lower = normalized.toLowerCase(Locale.ROOT);
        List<String> placeholders = new ArrayList<>(List.of(
                "password",
                "changeme",
                "change-me",
                "replace-me",
                "secret"
        ));
        placeholders.addAll(extraPlaceholders.stream()
                .map(item -> item == null ? "" : item.toLowerCase(Locale.ROOT))
                .collect(Collectors.toList()));
        return placeholders.stream().noneMatch(lower::equals)
                && !lower.startsWith("replace-")
                && !lower.contains("replace-with")
                && !lower.contains("your-");
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }
}
