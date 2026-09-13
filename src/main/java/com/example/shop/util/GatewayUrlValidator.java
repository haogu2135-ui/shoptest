package com.example.shop.util;

import java.net.InetAddress;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class GatewayUrlValidator {
    private static final Logger log = LoggerFactory.getLogger(GatewayUrlValidator.class);
    private static final Set<String> LOCAL_HOST_NAMES = Set.of("localhost", "0.0.0.0", "::1");
    private static final Pattern IPV4_LITERAL_PATTERN = Pattern.compile("\\d+\\.\\d+\\.\\d+\\.\\d+");

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
        String normalizedHost = host == null ? "" : host.trim();
        if (normalizedHost.isEmpty()) {
            throw new IllegalStateException(label + " host is required");
        }
        boolean localOrPrivateHost = isLocalOrPrivateHost(normalizedHost);
        if ("http".equals(scheme) && (!allowLocal || !localOrPrivateHost)) {
            throw new IllegalStateException(label + " must use https unless explicitly using a local development gateway");
        }
        if (!allowLocal && localOrPrivateHost) {
            throw new IllegalStateException(label + " host is not allowed");
        }
        return uri.toString();
    }

    public static boolean isLocalOrPrivateHost(String host) {
        String trimmedHost = host == null ? "" : host.trim();
        if (trimmedHost.isEmpty()) {
            return true;
        }
        String normalized = trimmedHost.toLowerCase(Locale.ROOT);
        if (normalized.startsWith("[") && normalized.endsWith("]")) {
            normalized = normalized.substring(1, normalized.length() - 1);
        }
        if (LOCAL_HOST_NAMES.contains(normalized)) {
            return true;
        }
        if (normalized.endsWith(".localhost") || normalized.endsWith(".local")) {
            return true;
        }
        if (isIpLiteral(normalized)) {
            try {
                InetAddress address = InetAddress.getByName(normalized);
                if (address.isAnyLocalAddress()
                        || address.isLoopbackAddress()
                        || address.isLinkLocalAddress()
                        || address.isSiteLocalAddress()) {
                    return true;
                }
            } catch (Exception ex) {
                log.debug("Unable to resolve IP literal while checking local gateway host: {}; reason={}",
                        normalized, ex.getMessage());
            }
        }
        String[] parts = normalized.split("\\.");
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

    private static boolean isIpLiteral(String host) {
        return host.contains(":") || IPV4_LITERAL_PATTERN.matcher(host).matches();
    }
}
