package com.example.shop.util;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;

public final class GatewayUrlValidator {
    private GatewayUrlValidator() {
    }

    public static String requireOutboundHttpUrl(String value, boolean allowLocal, String label) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.isEmpty()) {
            throw new IllegalStateException(label + " is not configured");
        }
        URI uri;
        try {
            uri = new URI(normalized);
        } catch (URISyntaxException e) {
            throw new IllegalStateException(label + " is invalid");
        }
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        if (!"https".equals(scheme) && !"http".equals(scheme)) {
            throw new IllegalStateException(label + " must use http or https");
        }
        if (uri.getUserInfo() != null) {
            throw new IllegalStateException(label + " must not include credentials");
        }
        String host = uri.getHost();
        if (host == null || host.trim().isEmpty()) {
            throw new IllegalStateException(label + " host is required");
        }
        if (!allowLocal && isLocalOrPrivateHost(host)) {
            throw new IllegalStateException(label + " host is not allowed");
        }
        return uri.toString();
    }

    private static boolean isLocalOrPrivateHost(String host) {
        String normalized = host.trim().toLowerCase(Locale.ROOT);
        if ("localhost".equals(normalized) || "0.0.0.0".equals(normalized) || "::1".equals(normalized)) {
            return true;
        }
        if (normalized.endsWith(".localhost") || normalized.endsWith(".local")) {
            return true;
        }
        String ipv4 = normalized;
        if (ipv4.startsWith("[")) {
            ipv4 = ipv4.substring(1, ipv4.length() - 1);
        }
        String[] parts = ipv4.split("\\.");
        if (parts.length == 4) {
            try {
                int first = Integer.parseInt(parts[0]);
                int second = Integer.parseInt(parts[1]);
                return first == 10
                        || first == 127
                        || (first == 172 && second >= 16 && second <= 31)
                        || (first == 192 && second == 168)
                        || (first == 169 && second == 254);
            } catch (NumberFormatException ignored) {
                return false;
            }
        }
        return normalized.contains(":")
                && (normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80"));
    }
}
