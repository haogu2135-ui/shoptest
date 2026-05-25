package com.example.shop.util;

import java.util.regex.Pattern;

public final class SensitiveDataMasker {
    private static final String SENSITIVE_KEY_WORDS =
            "password|passwd|pwd|secret|token|credential|api[_-]?key|access[_-]?key|private[_-]?key|auth[_-]?header|authorization|signature|webhook[_-]?secret|callback[_-]?secret";
    private static final Pattern KEY_VALUE_PATTERN = Pattern.compile(
            "(?i)(\\b(?:" + SENSITIVE_KEY_WORDS + ")\\b\\s*[=:]\\s*)((?:Bearer|Basic)\\s+)?([^,\\s;&}]+)");
    private static final Pattern JSON_VALUE_PATTERN = Pattern.compile(
            "(?i)([\"']?(?:" + SENSITIVE_KEY_WORDS + ")[\"']?\\s*:\\s*[\"']?)((?:Bearer|Basic)\\s+)?([^\"',;\\s}]+)([\"']?)");
    private static final Pattern QUERY_VALUE_PATTERN = Pattern.compile(
            "(?i)([?&;](?:" + SENSITIVE_KEY_WORDS + ")=)((?:Bearer|Basic)\\s+)?([^&;\\s]+)");
    private static final Pattern AUTH_HEADER_PATTERN = Pattern.compile(
            "(?i)\\b(Bearer|Basic)\\s+[A-Za-z0-9._~+/=-]{8,}");
    private static final Pattern JWT_PATTERN = Pattern.compile(
            "\\beyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\b");
    private static final Pattern STRIPE_KEY_PATTERN = Pattern.compile(
            "\\b(?:sk|pk|rk|whsec)_(?:test|live)_[A-Za-z0-9]{8,}\\b");

    private SensitiveDataMasker() {
    }

    public static String mask(String value) {
        if (value == null || value.isEmpty()) {
            return value;
        }
        String masked = KEY_VALUE_PATTERN.matcher(value).replaceAll("$1$2******");
        masked = JSON_VALUE_PATTERN.matcher(masked).replaceAll("$1$2******$4");
        masked = QUERY_VALUE_PATTERN.matcher(masked).replaceAll("$1$2******");
        masked = AUTH_HEADER_PATTERN.matcher(masked).replaceAll("$1 ******");
        masked = JWT_PATTERN.matcher(masked).replaceAll("jwt.******");
        masked = STRIPE_KEY_PATTERN.matcher(masked).replaceAll("stripe_key_******");
        return masked;
    }
}
