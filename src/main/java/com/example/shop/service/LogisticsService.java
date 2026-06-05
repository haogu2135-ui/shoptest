package com.example.shop.service;

import com.example.shop.entity.Order;
import com.example.shop.dto.LogisticsTrackResponse;
import com.example.shop.repository.OrderRepository;
import com.example.shop.security.SecurityUtils;
import com.example.shop.security.UserDetailsImpl;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Pattern;

@Service
public class LogisticsService {
    private static final Pattern TRACKING_NUMBER_PATTERN = Pattern.compile("[A-Za-z0-9][A-Za-z0-9_-]*");

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    private OrderRepository orderRepository;
    @Autowired
    private OrderService orderService;
    @Autowired
    private RuntimeConfigService runtimeConfig;
    @Autowired
    private CircuitBreakerService circuitBreakerService;
    @Autowired
    private AdminRoleService adminRoleService;

    public LogisticsTrackResponse track(String trackingNumber, String carrier) {
        return track(trackingNumber, carrier, null);
    }

    public LogisticsTrackResponse track(String trackingNumber, String carrier, Long orderId) {
        return trackInternal(trackingNumber, carrier, orderId, null);
    }

    public LogisticsTrackResponse track(String trackingNumber, String carrier, Long orderId,
                                        String guestEmail, String orderNo, Authentication authentication) {
        Order order = resolveVisibleOrder(orderId, guestEmail, orderNo, authentication);
        return trackInternal(trackingNumber, carrier, orderId, order);
    }

    private LogisticsTrackResponse trackInternal(String trackingNumber, String carrier, Long orderId, Order visibleOrder) {
        String normalizedTrackingNumber = normalizeTrackingNumber(trackingNumber, runtimeConfig.getInt("logistics.tracking-number-max-chars", 120));
        String normalizedCarrier = normalizeOptionalText(carrier, runtimeConfig.getInt("logistics.carrier-max-chars", 40));
        if (normalizedCarrier == null) {
            normalizedCarrier = "STANDARD";
        }
        Order order = visibleOrder != null ? visibleOrder : orderId == null ? null : orderRepository.findById(orderId);

        if (shouldUseKuaidi100(order)) {
            return trackWithKuaidi100(normalizedTrackingNumber, normalizedCarrier, order);
        }

        if (!isBlank(runtimeConfig.getString("logistics.api-url", ""))) {
            return trackWithProvider(normalizedTrackingNumber, normalizedCarrier);
        }
        boolean mockEnabled = runtimeConfig.getBoolean("logistics.mock-enabled", false);
        if (mockEnabled) {
            if (isProductionMode()) {
                throw new IllegalStateException("Production logistics tracking provider is not configured");
            }
            return mockTrack(normalizedTrackingNumber, normalizedCarrier);
        }
        if (isProductionMode()) {
            throw new IllegalStateException("Production logistics tracking provider is not configured");
        }
        return unavailableTrack(normalizedTrackingNumber, normalizedCarrier);
    }

    private Order resolveVisibleOrder(Long orderId, String guestEmail, String orderNo, Authentication authentication) {
        if (orderId == null) {
            requireOperationalTrackingPermission(authentication);
            return null;
        }
        if (orderId <= 0) {
            throw new IllegalArgumentException("Order id is invalid");
        }
        Order order = orderRepository.findById(orderId);
        if (order == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found");
        }
        if (guestOrderAccessMatches(order, guestEmail, orderNo)) {
            return order;
        }
        if (authentication != null && authentication.getPrincipal() instanceof UserDetailsImpl) {
            UserDetailsImpl user = (UserDetailsImpl) authentication.getPrincipal();
            if (Objects.equals(user.getId(), order.getUserId())) {
                return order;
            }
            if (SecurityUtils.isAdmin(user)) {
                requireOperationalTrackingPermission(authentication);
                return order;
            }
        }
        throw new ResponseStatusException(org.springframework.http.HttpStatus.FORBIDDEN, "Tracking access denied");
    }

    private void requireOperationalTrackingPermission(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof UserDetailsImpl)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Tracking access requires an order context");
        }
        UserDetailsImpl user = (UserDetailsImpl) authentication.getPrincipal();
        if (!SecurityUtils.isAdmin(user)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Tracking access requires an order context");
        }
        if (adminRoleService != null
                && adminRoleService.canAccess(user.getId(), "/admin/orders")
                && adminRoleService.hasPermission(user.getId(), AdminRoleService.ORDER_FULFILLMENT_PERMISSION)) {
            return;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Missing admin action permission");
    }

    private boolean guestOrderAccessMatches(Order order, String email, String orderNo) {
        return orderService != null && orderService.guestOrderAccessMatches(order, email, orderNo);
    }

    private boolean isProductionMode() {
        String mode = runtimeConfig.getString("app.runtime-mode", "production");
        if (mode == null) {
            mode = "production";
        }
        mode = mode.trim().toLowerCase(Locale.ROOT);
        return "production".equals(mode) || "prod".equals(mode);
    }

    private boolean shouldUseKuaidi100(Order order) {
        return runtimeConfig.getBoolean("kuaidi100.enabled", true) && order != null && isChinaAddress(order.getShippingAddress());
    }

    private boolean isChinaAddress(String address) {
        if (address == null) return false;
        String normalized = address.toLowerCase(Locale.ROOT);
        return normalized.contains("中国")
                || normalized.contains("china")
                || normalized.contains("cn ");
    }

    private LogisticsTrackResponse trackWithKuaidi100(String trackingNumber, String carrier, Order order) {
        String customer = runtimeConfig.getString("kuaidi100.customer", "");
        String key = runtimeConfig.getString("kuaidi100.key", "");
        if (isBlank(customer) || isBlank(key)) {
            throw new IllegalStateException("Kuaidi100 Global customer/key is not configured");
        }
        String companyCode = resolveKuaidi100CompanyCode(carrier);
        if (isBlank(companyCode) || "STANDARD".equalsIgnoreCase(companyCode) || "AUTO".equalsIgnoreCase(companyCode)) {
            companyCode = runtimeConfig.getString("kuaidi100.default-com", "auto");
        }
        if (isBlank(companyCode) || "AUTO".equalsIgnoreCase(companyCode)) {
            throw new IllegalArgumentException("Kuaidi100 carrier company code is required for China-address shipments");
        }

        Map<String, Object> param = new HashMap<>();
        param.put("com", companyCode);
        param.put("num", trackingNumber);
        param.put("resultv2", "4");
        param.put("show", "0");
        param.put("order", "desc");
        String lang = runtimeConfig.getString("kuaidi100.lang", "zh_CN");
        if (!isBlank(lang)) {
            param.put("lang", lang);
        }
        String phone = extractPhone(order.getShippingAddress());
        if (!isBlank(phone)) {
            param.put("phone", phone);
        }
        String to = extractChinaDestination(order.getShippingAddress());
        if (!isBlank(to)) {
            param.put("to", to);
        }

        try {
            String paramJson = objectMapper.writeValueAsString(param);
            MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
            body.add("customer", customer);
            body.add("sign", md5Upper(paramJson + key + customer));
            body.add("param", paramJson);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
            ResponseEntity<Map<String, Object>> response = circuitBreakerService.execute("logistics-kuaidi100", () -> restTemplate.exchange(
                    runtimeConfig.getString("kuaidi100.query-url", "https://poll.kuaidi100.com/poll/query.do"),
                    HttpMethod.POST,
                    new HttpEntity<>(body, headers),
                    new ParameterizedTypeReference<Map<String, Object>>() {
                    }
            ));
            return parseKuaidi100Response(trackingNumber, companyCode, response.getBody());
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build Kuaidi100 query payload");
        } catch (RestClientException e) {
            throw new IllegalStateException("Failed to query Kuaidi100 Global: " + e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private LogisticsTrackResponse parseKuaidi100Response(String trackingNumber, String carrier, Map<String, Object> body) {
        LogisticsTrackResponse result = baseResponse(trackingNumber, carrier);
        if (body == null) {
            result.setStatus("EXTERNAL_EMPTY");
            result.setSummary("Kuaidi100 returned an empty response");
            return result;
        }
        String status = String.valueOf(body.getOrDefault("state", body.getOrDefault("status", "EXTERNAL")));
        result.setStatus(mapKuaidi100State(status));
        Object message = body.get("message");
        result.setSummary(message == null ? "Kuaidi100 Global response received" : String.valueOf(message));

        Object data = body.get("data");
        if (data instanceof List<?>) {
            for (Object item : (List<?>) data) {
                if (!(item instanceof Map<?, ?>)) continue;
                Map<String, Object> event = (Map<String, Object>) item;
                result.getEvents().add(new LogisticsTrackResponse.LogisticsTrackEvent(
                        parseKuaidi100Time(stringValue(event.get("ftime"), stringValue(event.get("time"), null))),
                        stringValue(event.get("areaName"), stringValue(event.get("location"), "")),
                        stringValue(event.get("context"), stringValue(event.get("status"), ""))
                ));
            }
        }
        return result;
    }

    private String mapKuaidi100State(String state) {
        switch (state) {
            case "0":
                return "IN_TRANSIT";
            case "1":
                return "PICKED_UP";
            case "2":
                return "PROBLEM";
            case "3":
                return "DELIVERED";
            case "4":
                return "RETURNED";
            case "5":
                return "DISPATCHING";
            case "6":
                return "RETURNING";
            default:
                return state == null ? "EXTERNAL" : state;
        }
    }

    private LocalDateTime parseKuaidi100Time(String value) {
        if (isBlank(value)) return null;
        for (DateTimeFormatter formatter : new DateTimeFormatter[]{
                DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"),
                DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")
        }) {
            try {
                return LocalDateTime.parse(value, formatter);
            } catch (DateTimeParseException ignored) {
            }
        }
        try {
            return LocalDate.parse(value, DateTimeFormatter.ISO_LOCAL_DATE).atStartOfDay();
        } catch (DateTimeParseException ignored) {
            return null;
        }
    }

    private String resolveKuaidi100CompanyCode(String carrier) {
        if (isBlank(carrier)) return null;
        String normalized = carrier.trim().toLowerCase(Locale.ROOT)
                .replace(" ", "")
                .replace("-", "")
                .replace("_", "");
        Map<String, String> aliases = Map.ofEntries(
                Map.entry("sf", "shunfeng"),
                Map.entry("shunfeng", "shunfeng"),
                Map.entry("顺丰", "shunfeng"),
                Map.entry("ems", "ems"),
                Map.entry("chinapost", "youzhengguonei"),
                Map.entry("中国邮政", "youzhengguonei"),
                Map.entry("yto", "yuantong"),
                Map.entry("圆通", "yuantong"),
                Map.entry("zto", "zhongtong"),
                Map.entry("中通", "zhongtong"),
                Map.entry("sto", "shentong"),
                Map.entry("申通", "shentong"),
                Map.entry("yunda", "yunda"),
                Map.entry("韵达", "yunda"),
                Map.entry("jd", "jd"),
                Map.entry("京东", "jd"),
                Map.entry("dhl", "dhl"),
                Map.entry("fedex", "fedex"),
                Map.entry("ups", "ups"),
                Map.entry("cainiao", "cainiao"),
                Map.entry("菜鸟", "cainiao")
        );
        return aliases.getOrDefault(normalized, carrier.trim());
    }

    private String extractPhone(String address) {
        if (address == null) return null;
        java.util.regex.Matcher matcher = java.util.regex.Pattern.compile("(?<!\\d)(1[3-9]\\d{9})(?!\\d)").matcher(address);
        return matcher.find() ? matcher.group(1) : null;
    }

    private String extractChinaDestination(String address) {
        if (address == null) return null;
        String[] parts = address.split("[/，,\\s]+");
        for (String part : parts) {
            if (part.endsWith("市") || part.endsWith("省") || part.endsWith("区")) {
                return part;
            }
        }
        return null;
    }

    private LogisticsTrackResponse trackWithProvider(String trackingNumber, String carrier) {
        String logisticsApiKey = runtimeConfig.getString("logistics.api-key", "");
        String urlTemplate = runtimeConfig.getString("logistics.api-url", "");
        Map<String, String> uriVariables = new HashMap<>();
        uriVariables.put("trackingNumber", trackingNumber);
        uriVariables.put("carrier", carrier);
        uriVariables.put("apiKey", logisticsApiKey == null ? "" : logisticsApiKey);
        UriComponentsBuilder builder = UriComponentsBuilder.fromHttpUrl(urlTemplate);
        if (!templateSuppliesValue(urlTemplate, "trackingNumber", "trackingNumber")) {
            builder.queryParam("trackingNumber", "{trackingNumber}");
        }
        if (!templateSuppliesValue(urlTemplate, "carrier", "carrier")) {
            builder.queryParam("carrier", "{carrier}");
        }
        if (logisticsApiKey != null && !logisticsApiKey.isBlank()
                && !templateSuppliesValue(urlTemplate, "apiKey", "apiKey")
                && !templateSuppliesValue(urlTemplate, "key", "apiKey")) {
            builder.queryParam("apiKey", "{apiKey}");
        }
        String requestUrl = builder.buildAndExpand(uriVariables)
                .encode(StandardCharsets.UTF_8)
                .toUriString();

        try {
            ResponseEntity<Map<String, Object>> response = circuitBreakerService.execute("logistics-provider", () -> restTemplate.exchange(
                    requestUrl,
                    HttpMethod.GET,
                    null,
                    new ParameterizedTypeReference<Map<String, Object>>() {
                    }
            ));
            return parseProviderResponse(trackingNumber, carrier, response.getBody());
        } catch (RestClientException e) {
            throw new IllegalStateException("Failed to query logistics provider: " + e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private LogisticsTrackResponse parseProviderResponse(String trackingNumber, String carrier, Map<String, Object> body) {
        LogisticsTrackResponse result = baseResponse(trackingNumber, carrier);
        if (body == null) {
            result.setStatus("EXTERNAL_EMPTY");
            result.setSummary("Provider returned an empty response");
            return result;
        }
        result.setStatus(normalizeProviderStatus(firstString(body, "status", "state", "deliveryStatus", "code")));
        String summary = firstString(body, "summary", "message", "description", "statusDescription", "reason");
        result.setSummary(isBlank(summary) ? "Provider response received" : summary);

        Object eventSource = firstValue(body, "events", "data", "traces", "trackingEvents");
        if (eventSource instanceof List<?>) {
            for (Object item : (List<?>) eventSource) {
                if (!(item instanceof Map<?, ?>)) {
                    continue;
                }
                Map<?, ?> event = (Map<?, ?>) item;
                result.getEvents().add(new LogisticsTrackResponse.LogisticsTrackEvent(
                        parseKuaidi100Time(firstString(event, "time", "ftime", "timestamp", "date", "createdAt")),
                        firstString(event, "location", "areaName", "area", "checkpoint", "city"),
                        firstString(event, "description", "context", "status", "message", "detail")
                ));
            }
        }
        return result;
    }

    private LogisticsTrackResponse mockTrack(String trackingNumber, String carrier) {
        LogisticsTrackResponse result = baseResponse(trackingNumber, carrier);
        result.setStatus("IN_TRANSIT");
        result.setSummary("Shipment is in transit");
        LocalDateTime now = LocalDateTime.now();
        result.getEvents().add(new LogisticsTrackResponse.LogisticsTrackEvent(
                now.minusDays(2), "Warehouse", "Parcel accepted by fulfillment center"));
        result.getEvents().add(new LogisticsTrackResponse.LogisticsTrackEvent(
                now.minusDays(1), "Sorting center", "Parcel departed regional sorting center"));
        result.getEvents().add(new LogisticsTrackResponse.LogisticsTrackEvent(
                now.minusHours(4), "Local delivery station", "Parcel arrived near destination"));
        return result;
    }

    private LogisticsTrackResponse unavailableTrack(String trackingNumber, String carrier) {
        LogisticsTrackResponse result = baseResponse(trackingNumber, carrier);
        result.setStatus("TRACKING_UNAVAILABLE");
        result.setSummary("Real-time logistics tracking is not configured yet. Check the carrier site or contact support with this tracking number.");
        return result;
    }

    private LogisticsTrackResponse baseResponse(String trackingNumber, String carrier) {
        LogisticsTrackResponse result = new LogisticsTrackResponse();
        result.setTrackingNumber(trackingNumber);
        result.setCarrier(carrier);
        return result;
    }

    private String md5Upper(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("MD5");
            byte[] hash = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder();
            for (byte b : hash) {
                builder.append(String.format("%02x", b));
            }
            return builder.toString().toUpperCase(Locale.ROOT);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("MD5 is not available", e);
        }
    }

    private String stringValue(Object value, String fallback) {
        return value == null ? fallback : String.valueOf(value);
    }

    private String normalizeTrackingNumber(String value, int maxChars) {
        String cleaned = normalizeText(value);
        if (cleaned == null || cleaned.isEmpty()) {
            throw new IllegalArgumentException("Tracking number is required");
        }
        cleaned = cleaned.replaceAll("\\s+", "");
        if (cleaned.isEmpty()) {
            throw new IllegalArgumentException("Tracking number is required");
        }
        if (cleaned.length() > maxChars) {
            throw new IllegalArgumentException("Tracking number must be at most " + maxChars + " characters");
        }
        if (!TRACKING_NUMBER_PATTERN.matcher(cleaned).matches()) {
            throw new IllegalArgumentException("Tracking number may contain only letters, numbers, hyphens, and underscores");
        }
        return cleaned;
    }

    private String normalizeRequiredText(String value, String fieldName, int maxChars) {
        String cleaned = normalizeText(value);
        if (cleaned == null || cleaned.isEmpty()) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
        if (cleaned.length() > maxChars) {
            throw new IllegalArgumentException(fieldName + " must be at most " + maxChars + " characters");
        }
        return cleaned;
    }

    private String normalizeOptionalText(String value, int maxChars) {
        String cleaned = normalizeText(value);
        if (cleaned == null || cleaned.isEmpty()) {
            return null;
        }
        if (cleaned.length() > maxChars) {
            throw new IllegalArgumentException("Carrier must be at most " + maxChars + " characters");
        }
        return cleaned;
    }

    private String normalizeText(String value) {
        if (value == null) {
            return null;
        }
        return value.replaceAll("\\p{Cntrl}", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private boolean templateSuppliesValue(String template, String queryParam, String placeholder) {
        String lowerTemplate = template == null ? "" : template.toLowerCase(Locale.ROOT);
        return lowerTemplate.contains(queryParam.toLowerCase(Locale.ROOT) + "=")
                || (template != null && template.contains("{" + placeholder + "}"));
    }

    private Object firstValue(Map<?, ?> values, String... keys) {
        if (values == null) {
            return null;
        }
        for (String key : keys) {
            if (values.containsKey(key)) {
                return values.get(key);
            }
        }
        return null;
    }

    private String firstString(Map<?, ?> values, String... keys) {
        Object value = firstValue(values, keys);
        return value == null ? null : String.valueOf(value);
    }

    private String normalizeProviderStatus(String status) {
        if (isBlank(status)) {
            return "EXTERNAL";
        }
        String normalized = status.trim().toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9_-]+", "_");
        return normalized.isEmpty() ? "EXTERNAL" : normalized;
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
