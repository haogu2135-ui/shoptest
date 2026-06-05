package com.example.shop.util;

import org.springframework.util.StringUtils;

import java.net.URI;
import java.util.Locale;
import java.util.regex.Pattern;

public final class ImageUrlValidator {
    private static final Pattern IPV4_HOST_PATTERN = Pattern.compile("^\\d{1,3}(?:\\.\\d{1,3}){3}$");

    private ImageUrlValidator() {
    }

    public static String normalizePersistentImageUrl(String value, String field) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        String url = value.trim();
        String normalized = url.toLowerCase(Locale.ROOT);
        if (url.length() > 2000) {
            throw new IllegalArgumentException(field + " is too long");
        }
        if (hasControlCharacter(url)
                || url.contains("\\")
                || normalized.contains("%00")
                || normalized.contains("%5c")) {
            throw new IllegalArgumentException(field + " contains unsafe URL characters");
        }
        if (normalized.startsWith("data:") || normalized.startsWith("blob:")) {
            throw new IllegalArgumentException(field + " must use http, https, or an uploaded image path");
        }
        if (url.startsWith("//")) {
            throw new IllegalArgumentException(field + " must include http or https");
        }
        if (url.startsWith("/uploads/")) {
            return url;
        }
        if (normalized.startsWith("uploads/")) {
            return "/" + url;
        }
        if (url.startsWith("/")) {
            throw new IllegalArgumentException(field + " must point to an uploaded image path under /uploads/");
        }
        try {
            URI uri = URI.create(url);
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
            if (!scheme.equals("http") && !scheme.equals("https")) {
                throw new IllegalArgumentException(field + " must use http, https, or an uploaded image path");
            }
            if (uri.getUserInfo() != null) {
                throw new IllegalArgumentException(field + " must not include credentials");
            }
            int port = uri.getPort();
            if (port != -1 && port != 80 && port != 443) {
                throw new IllegalArgumentException(field + " must use a standard web port");
            }
            if (hasUnsafeHost(uri.getHost())) {
                throw new IllegalArgumentException(field + " must not point to localhost or a private network");
            }
            return uri.toString();
        } catch (IllegalArgumentException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new IllegalArgumentException(field + " must be a valid image URL");
        }
    }

    private static boolean hasControlCharacter(String value) {
        for (int index = 0; index < value.length(); index += 1) {
            char character = value.charAt(index);
            if (character <= 31 || character == 127) {
                return true;
            }
        }
        return false;
    }

    private static boolean hasUnsafeHost(String host) {
        if (!StringUtils.hasText(host)) {
            return true;
        }
        String normalized = host.toLowerCase(Locale.ROOT);
        if (normalized.startsWith("[") && normalized.endsWith("]")) {
            normalized = normalized.substring(1, normalized.length() - 1);
        }
        if (normalized.equals("localhost")
                || normalized.endsWith(".localhost")
                || normalized.endsWith(".local")
                || normalized.endsWith(".internal")
                || normalized.endsWith(".lan")) {
            return true;
        }
        if (normalized.matches("^\\d+$")) {
            return true;
        }
        if (isAmbiguousNumericHost(normalized)) {
            return true;
        }
        if (isPrivateIpv4Host(normalized)) {
            return true;
        }
        String mappedIpv4 = ipv4FromMappedIpv6Host(normalized);
        if (mappedIpv4 != null && isPrivateIpv4Host(mappedIpv4)) {
            return true;
        }
        if (!normalized.contains(":")) {
            return false;
        }
        return normalized.equals("::1")
                || normalized.equals("0:0:0:0:0:0:0:1")
                || normalized.startsWith("fe80:")
                || normalized.startsWith("fc")
                || normalized.startsWith("fd")
                || normalized.startsWith("ff");
    }

    private static boolean isPrivateIpv4Host(String hostname) {
        if (!IPV4_HOST_PATTERN.matcher(hostname).matches()) {
            return false;
        }
        String[] rawParts = hostname.split("\\.");
        int[] parts = new int[rawParts.length];
        for (int index = 0; index < rawParts.length; index += 1) {
            if (rawParts[index].length() > 1 && rawParts[index].startsWith("0")) {
                return true;
            }
            try {
                parts[index] = Integer.parseInt(rawParts[index]);
            } catch (NumberFormatException ex) {
                return true;
            }
            if (parts[index] < 0 || parts[index] > 255) {
                return true;
            }
        }
        int first = parts[0];
        int second = parts[1];
        return first == 0
                || first == 10
                || first == 127
                || first >= 224
                || (first == 169 && second == 254)
                || (first == 172 && second >= 16 && second <= 31)
                || (first == 192 && second == 168);
    }

    private static boolean isAmbiguousNumericHost(String hostname) {
        if (!hostname.contains(".")) {
            return false;
        }
        String[] rawParts = hostname.split("\\.", -1);
        for (String part : rawParts) {
            if (part.isEmpty() || !part.matches("^\\d+$")) {
                return false;
            }
        }
        if (rawParts.length != 4) {
            return true;
        }
        for (String part : rawParts) {
            if (part.length() > 1 && part.startsWith("0")) {
                return true;
            }
            try {
                if (Integer.parseInt(part) > 255) {
                    return true;
                }
            } catch (NumberFormatException ex) {
                return true;
            }
        }
        return false;
    }

    private static String ipv4FromMappedIpv6Host(String hostname) {
        if (!hostname.startsWith("::ffff:")) {
            return null;
        }
        String tail = hostname.substring("::ffff:".length());
        if (IPV4_HOST_PATTERN.matcher(tail).matches()) {
            return tail;
        }
        String[] parts = tail.split(":");
        if (parts.length != 2) {
            return null;
        }
        try {
            int high = Integer.parseInt(parts[0], 16);
            int low = Integer.parseInt(parts[1], 16);
            if (high < 0 || high > 0xffff || low < 0 || low > 0xffff) {
                return null;
            }
            return ((high >> 8) & 0xff) + "." + (high & 0xff) + "."
                    + ((low >> 8) & 0xff) + "." + (low & 0xff);
        } catch (NumberFormatException ex) {
            return null;
        }
    }
}
