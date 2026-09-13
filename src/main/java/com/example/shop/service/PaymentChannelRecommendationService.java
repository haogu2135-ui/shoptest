package com.example.shop.service;

import com.example.shop.config.HttpClientConfig;
import com.example.shop.config.PaymentChannelConfig;
import com.example.shop.dto.PaymentChannelResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import javax.servlet.http.HttpServletRequest;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Service
@RequiredArgsConstructor
@Slf4j
public class PaymentChannelRecommendationService {
    private static final int MIN_GEO_LOOKUP_TIMEOUT_MS = 200;
    private static final List<String> COUNTRY_JSON_FIELDS = List.of(
            "countryCode",
            "country_code",
            "countryCodeIso2",
            "country_code_iso2",
            "country"
    );

    private final PaymentChannelConfig paymentChannelConfig;
    private final CircuitBreakerService circuitBreakerService;
    private final ClientIpResolver clientIpResolver;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final ConcurrentMap<Integer, RestTemplate> geoLookupRestTemplates = new ConcurrentHashMap<>();

    public List<PaymentChannelResponse> buildChannelResponses(List<PaymentChannelConfig.Channel> channels, HttpServletRequest request) {
        String clientCountry = resolveClientCountry(request);
        String preferredMarket = marketForCountry(clientCountry);
        List<PaymentChannelConfig.Channel> sortedChannels = new ArrayList<>(channels);
        Map<PaymentChannelConfig.Channel, String> normalizedMarkets = normalizedMarkets(sortedChannels, preferredMarket);
        Collections.sort(sortedChannels, channelComparator(preferredMarket, normalizedMarkets));
        String recommendedCode = resolveRecommendedCode(sortedChannels, preferredMarket, normalizedMarkets);
        List<PaymentChannelResponse> responses = new ArrayList<>(sortedChannels.size());
        for (PaymentChannelConfig.Channel channel : sortedChannels) {
            String channelCode = channel.getCode();
            responses.add(PaymentChannelResponse.from(
                    channel,
                    channelCode.equals(recommendedCode),
                    clientCountry));
        }
        return responses;
    }

    private String resolveRecommendedCode(List<PaymentChannelConfig.Channel> channels, String preferredMarket,
                                          Map<PaymentChannelConfig.Channel, String> normalizedMarkets) {
        if (preferredMarket == null) {
            return null;
        }
        for (PaymentChannelConfig.Channel channel : channels) {
            if (preferredMarket.equals(normalizedMarkets.get(channel))) {
                return channel.getCode();
            }
        }
        return null;
    }

    private Comparator<PaymentChannelConfig.Channel> channelComparator(String preferredMarket,
                                                                        Map<PaymentChannelConfig.Channel, String> normalizedMarkets) {
        return Comparator
                .comparingInt((PaymentChannelConfig.Channel channel) -> recommendationRank(channel, preferredMarket, normalizedMarkets))
                .thenComparingInt(PaymentChannelConfig.Channel::getSortOrder)
                .thenComparing(PaymentChannelConfig.Channel::getCode);
    }

    private int recommendationRank(PaymentChannelConfig.Channel channel, String preferredMarket,
                                    Map<PaymentChannelConfig.Channel, String> normalizedMarkets) {
        if (preferredMarket == null) {
            return 0;
        }
        String market = normalizedMarkets.get(channel);
        if (preferredMarket.equals(market)) {
            return 0;
        }
        if ("GLOBAL".equals(market)) {
            return 1;
        }
        return 2;
    }

    private Map<PaymentChannelConfig.Channel, String> normalizedMarkets(List<PaymentChannelConfig.Channel> channels,
                                                                          String preferredMarket) {
        if (preferredMarket == null) return Map.of();
        Map<PaymentChannelConfig.Channel, String> markets = new IdentityHashMap<>();
        for (PaymentChannelConfig.Channel channel : channels) {
            markets.put(channel, normalizeMarket(channel.getMarket()));
        }
        return markets;
    }

    private String resolveClientCountry(HttpServletRequest request) {
        PaymentChannelConfig.Geo geoConfig = paymentChannelConfig.getGeo();
        if (geoConfig == null || !geoConfig.isEnabled()) {
            return null;
        }
        String countryFromHeader = clientIpResolver.shouldTrustForwardedHeaders(request)
                ? resolveCountryFromHeaders(request, geoConfig.getCountryHeaderNames())
                : null;
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
            String normalizedHeaderName = headerName == null ? null : headerName.trim();
            if (normalizedHeaderName == null || normalizedHeaderName.isEmpty()) {
                continue;
            }
            String value = request.getHeader(normalizedHeaderName);
            String country = normalizeCountryCode(value);
            if (country != null) {
                return country;
            }
        }
        return null;
    }

    private String lookupCountryByIp(String clientIp, PaymentChannelConfig.Geo geoConfig) {
        String lookupUrl = trimToNull(geoConfig.getLookupUrl());
        if (lookupUrl == null || clientIp == null || isLocalIp(clientIp)) {
            return null;
        }
        String resolvedUrl = lookupUrl.replace("{ip}", URLEncoder.encode(clientIp, StandardCharsets.UTF_8));
        RestTemplate restTemplate = geoLookupRestTemplate(geoConfig);
        try {
            String responseBody = circuitBreakerService.execute("payment-geo-lookup", () -> restTemplate.getForObject(resolvedUrl, String.class));
            return parseCountryCode(responseBody);
        } catch (RestClientException e) {
            log.debug("Payment geo lookup failed for ip {} via {}", clientIp, resolvedUrl, e);
            return null;
        }
    }

    private RestTemplate geoLookupRestTemplate(PaymentChannelConfig.Geo geoConfig) {
        int timeoutMs = Math.max(MIN_GEO_LOOKUP_TIMEOUT_MS, geoConfig.getLookupTimeoutMs());
        return geoLookupRestTemplates.computeIfAbsent(timeoutMs,
                value -> HttpClientConfig.restTemplateWithTimeouts(value, value));
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
        return trimToNull(clientIpResolver.resolve(request));
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
        int firstDot = ip.indexOf('.');
        if (firstDot < 0 || firstDot == ip.length() - 1) {
            return false;
        }
        int secondDot = ip.indexOf('.', firstDot + 1);
        String secondSegment = secondDot < 0
                ? ip.substring(firstDot + 1)
                : ip.substring(firstDot + 1, secondDot);
        try {
            int second = Integer.parseInt(secondSegment);
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
        if (upper.length() != 2 || upper.charAt(0) < 'A' || upper.charAt(0) > 'Z'
                || upper.charAt(1) < 'A' || upper.charAt(1) > 'Z') {
            return null;
        }
        return upper;
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

}
