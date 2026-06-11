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
        return parseAddress(address) == null ? "" : address;
    }

    public boolean matchesAny(String ipAddress, String configuredAddresses) {
        byte[] remote = parseAddress(ipAddress);
        if (remote == null) {
            return false;
        }
        return Arrays.stream((configuredAddresses == null ? "" : configuredAddresses).split(","))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .anyMatch(entry -> matchesTrustedEntry(remote, entry));
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
        String[] parts = cidr.split("/", 2);
        if (parts.length != 2) {
            return false;
        }
        byte[] network = parseAddress(parts[0]);
        if (network == null || network.length != remote.length) {
            return false;
        }
        int prefixLength;
        try {
            prefixLength = Integer.parseInt(parts[1].trim());
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

    private String firstForwardedAddress(String headerValue) {
        if (headerValue == null || headerValue.isBlank()) {
            return null;
        }
        return cleanAddress(headerValue.split(",", 2)[0]);
    }

    private boolean isValidIp(String value) {
        return parseAddress(value) != null;
    }

    private byte[] parseAddress(String value) {
        String address = cleanAddress(value);
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
        if (!address.matches("[0-9A-Fa-f:.]+")) {
            return null;
        }
        try {
            return InetAddress.getByName(address).getAddress();
        } catch (UnknownHostException ignored) {
            return null;
        }
    }

    private boolean isStrictIpv4(String value) {
        String[] parts = value.split("\\.", -1);
        if (parts.length != 4) {
            return false;
        }
        for (String part : parts) {
            if (part.isBlank() || part.length() > 3 || !part.matches("\\d+")) {
                return false;
            }
            int octet;
            try {
                octet = Integer.parseInt(part);
            } catch (NumberFormatException ignored) {
                return false;
            }
            if (octet < 0 || octet > 255) {
                return false;
            }
        }
        return true;
    }

    private String cleanAddress(String value) {
        if (value == null) {
            return null;
        }
        String address = value.replaceAll("\\p{Cntrl}", "").trim();
        if (address.startsWith("\"") && address.endsWith("\"") && address.length() > 1) {
            address = address.substring(1, address.length() - 1).trim();
        }
        if (address.startsWith("[") && address.contains("]")) {
            return address.substring(1, address.indexOf(']')).trim();
        }
        int colonCount = 0;
        for (int i = 0; i < address.length(); i++) {
            if (address.charAt(i) == ':') {
                colonCount++;
            }
        }
        if (address.contains(".") && colonCount == 1) {
            return address.substring(0, address.indexOf(':')).trim();
        }
        return address;
    }
}
