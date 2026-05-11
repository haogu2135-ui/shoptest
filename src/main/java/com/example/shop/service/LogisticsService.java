package com.example.shop.service;

import com.example.shop.entity.Order;
import com.example.shop.dto.LogisticsTrackResponse;
import com.example.shop.repository.OrderRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
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

@Service
public class LogisticsService {
    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    private OrderRepository orderRepository;

    @Value("${logistics.api-url:}")
    private String logisticsApiUrl;

    @Value("${logistics.api-key:}")
    private String logisticsApiKey;

    @Value("${kuaidi100.enabled:true}")
    private boolean kuaidi100Enabled;

    @Value("${kuaidi100.customer:}")
    private String kuaidi100Customer;

    @Value("${kuaidi100.key:}")
    private String kuaidi100Key;

    @Value("${kuaidi100.query-url:https://poll.kuaidi100.com/poll/query.do}")
    private String kuaidi100QueryUrl;

    @Value("${kuaidi100.default-com:auto}")
    private String kuaidi100DefaultCom;

    @Value("${kuaidi100.lang:zh_CN}")
    private String kuaidi100Lang;

    public LogisticsTrackResponse track(String trackingNumber, String carrier) {
        return track(trackingNumber, carrier, null);
    }

    public LogisticsTrackResponse track(String trackingNumber, String carrier, Long orderId) {
        if (trackingNumber == null || trackingNumber.trim().isEmpty()) {
            throw new IllegalArgumentException("Tracking number is required");
        }
        String normalizedTrackingNumber = trackingNumber.trim();
        String normalizedCarrier = carrier == null || carrier.trim().isEmpty() ? "STANDARD" : carrier.trim();
        Order order = orderId == null ? null : orderRepository.findById(orderId);

        if (shouldUseKuaidi100(order)) {
            return trackWithKuaidi100(normalizedTrackingNumber, normalizedCarrier, order);
        }

        if (logisticsApiUrl != null && !logisticsApiUrl.trim().isEmpty()) {
            return trackWithProvider(normalizedTrackingNumber, normalizedCarrier);
        }
        return mockTrack(normalizedTrackingNumber, normalizedCarrier);
    }

    private boolean shouldUseKuaidi100(Order order) {
        return kuaidi100Enabled && order != null && isChinaAddress(order.getShippingAddress());
    }

    private boolean isChinaAddress(String address) {
        if (address == null) return false;
        String normalized = address.toLowerCase(Locale.ROOT);
        return normalized.contains("中国")
                || normalized.contains("china")
                || normalized.contains("cn ");
    }

    private LogisticsTrackResponse trackWithKuaidi100(String trackingNumber, String carrier, Order order) {
        if (isBlank(kuaidi100Customer) || isBlank(kuaidi100Key)) {
            throw new IllegalStateException("Kuaidi100 Global customer/key is not configured");
        }
        String companyCode = resolveKuaidi100CompanyCode(carrier);
        if (isBlank(companyCode) || "STANDARD".equalsIgnoreCase(companyCode) || "AUTO".equalsIgnoreCase(companyCode)) {
            companyCode = kuaidi100DefaultCom;
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
        if (!isBlank(kuaidi100Lang)) {
            param.put("lang", kuaidi100Lang);
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
            body.add("customer", kuaidi100Customer);
            body.add("sign", md5Upper(paramJson + kuaidi100Key + kuaidi100Customer));
            body.add("param", paramJson);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    kuaidi100QueryUrl,
                    HttpMethod.POST,
                    new HttpEntity<>(body, headers),
                    new ParameterizedTypeReference<Map<String, Object>>() {
                    }
            );
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
        result.setRawResponse(body);
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
        String url = logisticsApiUrl
                .replace("{trackingNumber}", trackingNumber)
                .replace("{carrier}", carrier)
                .replace("{apiKey}", logisticsApiKey == null ? "" : logisticsApiKey);

        UriComponentsBuilder builder = UriComponentsBuilder.fromHttpUrl(url);
        if (!url.contains("trackingNumber=") && !url.contains("{trackingNumber}")) {
            builder.queryParam("trackingNumber", trackingNumber);
        }
        if (!url.contains("carrier=") && !url.contains("{carrier}")) {
            builder.queryParam("carrier", carrier);
        }
        if (logisticsApiKey != null && !logisticsApiKey.isBlank()
                && !url.contains("apiKey=") && !url.contains("key=") && !url.contains("{apiKey}")) {
            builder.queryParam("apiKey", logisticsApiKey);
        }

        try {
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    builder.toUriString(),
                    HttpMethod.GET,
                    null,
                    new ParameterizedTypeReference<Map<String, Object>>() {
                    }
            );
            LogisticsTrackResponse result = baseResponse(trackingNumber, carrier);
            result.setStatus("EXTERNAL");
            result.setSummary("Provider response received");
            result.setRawResponse(response.getBody());
            return result;
        } catch (RestClientException e) {
            throw new IllegalStateException("Failed to query logistics provider: " + e.getMessage());
        }
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

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
