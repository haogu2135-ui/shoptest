package com.example.shop.service;

import com.example.shop.config.PaymentChannelConfig;
import com.example.shop.dto.PaymentChannelResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import javax.servlet.http.HttpServletRequest;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class PaymentChannelRecommendationService {
    private static final List<String> COUNTRY_JSON_FIELDS = List.of(
            "countryCode",
            "country_code",
            "countryCodeIso2",
            "country_code_iso2",
            "country"
    );

    private final PaymentChannelConfig paymentChannelConfig;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public List<PaymentChannelResponse> buildChannelResponses(List<PaymentChannelConfig.Channel> channels, HttpServletRequest request) {
        String clientCountry = resolveClientCountry(request);
        String preferredMarket = marketForCountry(clientCountry);
        List<PaymentChannelConfig.Channel> sortedChannels = channels.stream()
                .sorted(channelComparator(preferredMarket))
                .collect(Collectors.toList());
        String recommendedCode = resolveRecommendedCode(sortedChannels, preferredMarket);
        return sortedChannels.stream()
                .map(channel -> PaymentChannelResponse.from(
                        channel,
                        channel.getCode().equals(recommendedCode),
                        clientCountry))
                .collect(Collectors.toList());
    }

    private String resolveRecommendedCode(List<PaymentChannelConfig.Channel> channels, String preferredMarket) {
        if (preferredMarket == null) {
            return null;
        }
        return channels.stream()
                .filter(channel -> preferredMarket.equals(normalizeMarket(channel.getMarket())))
                .map(PaymentChannelConfig.Channel::getCode)
                .findFirst()
                .orElse(null);
    }

    private Comparator<PaymentChannelConfig.Channel> channelComparator(String preferredMarket) {
        return Comparator
                .comparingInt((PaymentChannelConfig.Channel channel) -> recommendationRank(channel, preferredMarket))
                .thenComparingInt(PaymentChannelConfig.Channel::getSortOrder)
                .thenComparing(PaymentChannelConfig.Channel::getCode);
    }

    private int recommendationRank(PaymentChannelConfig.Channel channel, String preferredMarket) {
        if (preferredMarket == null) {
            return 0;
        }
        String market = normalizeMarket(channel.getMarket());
        if (preferredMarket.equals(market)) {
            return 0;
        }
        if ("GLOBAL".equals(market)) {
            return 1;
        }
        return 2;
    }

    private String resolveClientCountry(HttpServletRequest request) {
        PaymentChannelConfig.Geo geoConfig = paymentChannelConfig.getGeo();
        if (geoConfig == null || !geoConfig.isEnabled()) {
            return null;
        }
        String countryFromHeader = resolveCountryFromHeaders(request, geoConfig.getCountryHeaderNames());
        if (countryFromHeader != null) {
            return countryFromHeader;
        }
        String clientIp = resolveClientIp(request);
        if (isLocalIp(clientIp)) {
            String localCountry = normalizeCountryCode(geoConfig.getLocalIpCountry());
            if (localCountry != null) {
                return localCountry;
            }
        }
        String lookedUpCountry = lookupCountryByIp(clientIp, geoConfig);
        if (lookedUpCountry != null) {
            return lookedUpCountry;
        }
        return normalizeCountryCode(geoConfig.getFallbackCountry());
    }

    private String resolveCountryFromHeaders(HttpServletRequest request, List<String> headerNames) {
        if (request == null || headerNames == null) {
            return null;
        }
        for (String headerName : headerNames) {
            if (headerName == null || headerName.trim().isEmpty()) {
                continue;
            }
            String value = request.getHeader(headerName.trim());
            String country = normalizeCountryCode(value);
            if (country != null) {
                return country;
            }
        }
        return null;
    }

    private String lookupCountryByIp(String clientIp, PaymentChannelConfig.Geo geoConfig) {
        String lookupUrl = trimToNull(geoConfig.getLookupUrl());
        if (lookupUrl == null || isBlank(clientIp) || isLocalIp(clientIp)) {
            return null;
        }
        String resolvedUrl = lookupUrl.replace("{ip}", URLEncoder.encode(clientIp, StandardCharsets.UTF_8));
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Math.max(200, geoConfig.getLookupTimeoutMs()));
        requestFactory.setReadTimeout(Math.max(200, geoConfig.getLookupTimeoutMs()));
        RestTemplate restTemplate = new RestTemplate(requestFactory);
        try {
            String responseBody = restTemplate.getForObject(resolvedUrl, String.class);
            return parseCountryCode(responseBody);
        } catch (RestClientException e) {
            log.debug("Payment geo lookup failed for ip {} via {}", clientIp, resolvedUrl, e);
            return null;
        }
    }

    private String parseCountryCode(String responseBody) {
        String raw = trimToNull(responseBody);
        if (raw == null) {
            return null;
        }
        String normalizedDirect = normalizeCountryCode(raw);
        if (normalizedDirect != null) {
            return normalizedDirect;
        }
        try {
            JsonNode root = objectMapper.readTree(raw);
            for (String field : COUNTRY_JSON_FIELDS) {
                JsonNode node = root.get(field);
                if (node == null || node.isNull()) {
                    continue;
                }
                String country = normalizeCountryCode(node.asText());
                if (country != null) {
                    return country;
                }
            }
        } catch (Exception e) {
            log.debug("Payment geo response is not JSON country data: {}", raw);
        }
        return null;
    }

    private String resolveClientIp(HttpServletRequest request) {
        if (request == null) {
            return null;
        }
        String forwarded = request.getHeader("X-Forwarded-For");
        if (!isBlank(forwarded)) {
            return forwarded.split(",")[0].trim();
        }
        String realIp = request.getHeader("X-Real-IP");
        if (!isBlank(realIp)) {
            return realIp.trim();
        }
        return trimToNull(request.getRemoteAddr());
    }

    private boolean isLocalIp(String ip) {
        String normalized = trimToNull(ip);
        if (normalized == null) {
            return true;
        }
        String lower = normalized.toLowerCase(Locale.ROOT);
        return "127.0.0.1".equals(lower)
                || "::1".equals(lower)
                || "0:0:0:0:0:0:0:1".equals(lower)
                || lower.startsWith("10.")
                || lower.startsWith("192.168.")
                || lower.startsWith("169.254.")
                || lower.startsWith("fc")
                || lower.startsWith("fd")
                || isPrivate172(lower);
    }

    private boolean isPrivate172(String ip) {
        if (!ip.startsWith("172.")) {
            return false;
        }
        String[] segments = ip.split("\\.");
        if (segments.length < 2) {
            return false;
        }
        try {
            int second = Integer.parseInt(segments[1]);
            return second >= 16 && second <= 31;
        } catch (NumberFormatException e) {
            return false;
        }
    }

    private String marketForCountry(String country) {
        String normalized = normalizeCountryCode(country);
        if ("CN".equals(normalized)) {
            return "CN";
        }
        if ("MX".equals(normalized)) {
            return "MX";
        }
        return null;
    }

    private String normalizeCountryCode(String value) {
        String normalized = trimToNull(value);
        if (normalized == null) {
            return null;
        }
        String upper = normalized.toUpperCase(Locale.ROOT);
        if ("CN".equals(upper) || "CHN".equals(upper) || "CHINA".equals(upper)) {
            return "CN";
        }
        if ("MX".equals(upper) || "MEX".equals(upper) || "MEXICO".equals(upper)) {
            return "MX";
        }
        return upper.matches("[A-Z]{2}") ? upper : null;
    }

    private String normalizeMarket(String market) {
        String normalized = trimToNull(market);
        return normalized == null ? "GLOBAL" : normalized.toUpperCase(Locale.ROOT);
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private boolean isBlank(String value) {
        return trimToNull(value) == null;
    }
}
