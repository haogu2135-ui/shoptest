package com.example.shop.service;

import lombok.extern.slf4j.Slf4j;

import org.springframework.stereotype.Service;

import javax.servlet.http.HttpServletRequest;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.Arrays;

@Service
@Slf4j
public class ClientIpResolver {
    static final String TRUSTED_PROXIES_KEY = "security.client-ip.trusted-proxies";
    private static final String DEFAULT_TRUSTED_PROXIES = "127.0.0.1,::1,0:0:0:0:0:0:0:1";

    private final RuntimeConfigService runtimeConfig;

    public ClientIpResolver(RuntimeConfigService runtimeConfig) {
        this.runtimeConfig = runtimeConfig;
    }

    public String resolve(HttpServletRequest request) {
        if (request == null) {
            return "";
        }
        String remoteAddress = normalizeIpAddress(request.getRemoteAddr());
        if (isTrustedProxy(remoteAddress)) {
            String forwarded = firstForwardedAddress(request.getHeader("X-Forwarded-For"));
            if (isValidIp(forwarded)) {
                return forwarded;
            }
            String realIp = cleanAddress(request.getHeader("X-Real-IP"));
            if (isValidIp(realIp)) {
                return realIp;
            }
        }
        return remoteAddress == null ? "" : remoteAddress;
    }

    public boolean shouldTrustForwardedHeaders(HttpServletRequest request) {
        if (request == null) {
            return false;
        }
        return isTrustedProxy(normalizeIpAddress(request.getRemoteAddr()));
    }

    public String normalizeIpAddress(String value) {
        String address = cleanAddress(value);
        return parseCleanAddress(address) == null ? "" : address;
    }

    public boolean matchesAny(String ipAddress, String configuredAddresses) {
        byte[] remote = parseAddress(ipAddress);
        if (remote == null) {
            return false;
        }
        String configured = configuredAddresses == null ? "" : configuredAddresses;
        int entryStart = 0;
        for (int index = 0; index <= configured.length(); index++) {
            if (index != configured.length() && configured.charAt(index) != ',') continue;
            String entry = configured.substring(entryStart, index).trim();
            if (!entry.isEmpty() && matchesTrustedEntry(remote, entry)) return true;
            entryStart = index + 1;
        }
        return false;
    }

    boolean isTrustedProxy(String remoteAddress) {
        String configured = runtimeConfig.getString(TRUSTED_PROXIES_KEY, DEFAULT_TRUSTED_PROXIES);
        return matchesAny(remoteAddress, configured);
    }

    private boolean matchesTrustedEntry(byte[] remote, String entry) {
        if (entry.contains("/")) {
            return matchesCidr(remote, entry);
        }
        byte[] exact = parseAddress(entry);
        return exact != null && Arrays.equals(remote, exact);
    }

    private boolean matchesCidr(byte[] remote, String cidr) {
        int separator = cidr.indexOf('/');
        if (separator < 0) {
            return false;
        }
        byte[] network = parseAddress(cidr.substring(0, separator));
        if (network == null || network.length != remote.length) {
            return false;
        }
        int prefixLength;
        try {
            prefixLength = parsePrefixLength(cidr.substring(separator + 1));
        } catch (NumberFormatException ignored) {
            return false;
        }
        int maxBits = network.length * 8;
        if (prefixLength < 0 || prefixLength > maxBits) {
            return false;
        }
        for (int bit = 0; bit < prefixLength; bit++) {
            int index = bit / 8;
            int mask = 0x80 >> (bit % 8);
            if ((remote[index] & mask) != (network[index] & mask)) {
                return false;
            }
        }
        return true;
    }

    private int parsePrefixLength(String value) {
        String normalized = value.trim();
        if (normalized.isEmpty()) throw new NumberFormatException("empty prefix");
        int sign = 1;
        int index = 0;
        char first = normalized.charAt(0);
        if (first == '+' || first == '-') {
            sign = first == '-' ? -1 : 1;
            index = 1;
        }
        if (index == normalized.length()) throw new NumberFormatException("empty prefix");
        int result = 0;
        for (; index < normalized.length(); index++) {
            char digit = normalized.charAt(index);
            if (digit < '0' || digit > '9' || result > (Integer.MAX_VALUE - (digit - '0')) / 10) {
                throw new NumberFormatException("invalid prefix");
            }
            result = result * 10 + digit - '0';
        }
        return sign * result;
    }

    private String firstForwardedAddress(String headerValue) {
        if (headerValue == null || headerValue.isBlank()) {
            return null;
        }
        int separator = headerValue.indexOf(',');
        return cleanAddress(separator < 0 ? headerValue : headerValue.substring(0, separator));
    }

    private boolean isValidIp(String value) {
        return parseAddress(value) != null;
    }

    private byte[] parseAddress(String value) {
        String address = cleanAddress(value);
        return parseCleanAddress(address);
    }

    private byte[] parseCleanAddress(String address) {
        if (address == null || address.isBlank() || address.length() > 45) {
            return null;
        }
        if (address.contains(".")) {
            if (!isStrictIpv4(address)) {
                return null;
            }
        } else if (!address.contains(":")) {
            return null;
        }
        for (int index = 0; index < address.length(); index++) {
            char value = address.charAt(index);
            if (!((value >= '0' && value <= '9') || (value >= 'A' && value <= 'F')
                    || (value >= 'a' && value <= 'f') || value == ':' || value == '.')) {
                return null;
            }
        }
        try {
            return InetAddress.getByName(address).getAddress();
        } catch (UnknownHostException ignored) {
            return null;
        }
    }

    private boolean isStrictIpv4(String value) {
        int segmentStart = 0;
        int segmentCount = 0;
        for (int index = 0; index <= value.length(); index++) {
            if (index != value.length() && value.charAt(index) != '.') continue;
            if (index == segmentStart || index - segmentStart > 3) return false;
            for (int digitIndex = segmentStart; digitIndex < index; digitIndex++) {
                char digit = value.charAt(digitIndex);
                if (digit < '0' || digit > '9') return false;
            }
            int octet = 0;
            for (int digitIndex = segmentStart; digitIndex < index; digitIndex++) {
                octet = octet * 10 + value.charAt(digitIndex) - '0';
            }
            if (octet < 0 || octet > 255) {
                return false;
            }
            segmentCount++;
            segmentStart = index + 1;
        }
        return segmentCount == 4;
    }

    private String cleanAddress(String value) {
        if (value == null) {
            return null;
        }
        String address = stripControlCharacters(value).trim();
        if (address.startsWith("\"") && address.endsWith("\"") && address.length() > 1) {
            address = address.substring(1, address.length() - 1).trim();
        }
        if (address.startsWith("[") && address.contains("]")) {
            int closingBracket = address.indexOf(']');
            return address.substring(1, closingBracket).trim();
        }
        int colonCount = 0;
        for (int i = 0; i < address.length(); i++) {
            if (address.charAt(i) == ':') {
                colonCount++;
            }
        }
        if (address.contains(".") && colonCount == 1) {
            int separator = address.indexOf(':');
            return address.substring(0, separator).trim();
        }
        return address;
    }

    private String stripControlCharacters(String value) {
        StringBuilder cleaned = null;
        for (int index = 0; index < value.length(); index++) {
            char character = value.charAt(index);
            if (!Character.isISOControl(character)) {
                if (cleaned != null) cleaned.append(character);
                continue;
            }
            if (cleaned == null) {
                cleaned = new StringBuilder(value.length());
                cleaned.append(value, 0, index);
            }
        }
        return cleaned == null ? value : cleaned.toString();
    }
}
