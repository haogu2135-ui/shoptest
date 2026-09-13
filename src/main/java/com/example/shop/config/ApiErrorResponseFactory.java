package com.example.shop.config;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;

import javax.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Pattern;

@Component
public class ApiErrorResponseFactory {
    public static final String FALLBACK_REQUEST_ID = "unavailable";
    private static final int MAX_ERROR_MESSAGE_LENGTH = 240;
    private static final int MAX_REQUEST_ID_LENGTH = 96;
    private static final Pattern CONTROL_TEXT_PATTERN = Pattern.compile("[\\r\\n\\t]+");

    public ResponseEntity<Map<String, Object>> buildResponse(
            HttpStatus status,
            String message,
            HttpServletRequest request
    ) {
        return ResponseEntity.status(status).body(buildPayload(status, message, request));
    }

    public Map<String, Object> buildPayload(
            HttpStatus status,
            String message,
            HttpServletRequest request
    ) {
        String safeMessage = sanitizeMessage(message);
        Map<String, Object> payload = new LinkedHashMap<>(8);
        payload.put("error", safeMessage);
        payload.put("message", safeMessage);
        payload.put("code", resolveCode(status));
        payload.put("status", status.value());
        payload.put("statusText", status.getReasonPhrase());
        payload.put("path", resolvePath(request));
        payload.put("requestId", resolveRequestId(request));
        payload.put("timestamp", Instant.now().toString());
        return payload;
    }

    public String resolveCode(HttpStatus status) {
        if (status == null) {
            return "REQUEST_FAILED";
        }
        if (status == HttpStatus.TOO_MANY_REQUESTS) {
            return "RATE_LIMITED";
        }
        return status.name();
    }

    public String resolvePath(HttpServletRequest request) {
        return request == null ? "" : request.getRequestURI();
    }

    public String resolveRequestId(HttpServletRequest request) {
        if (request == null) {
            return FALLBACK_REQUEST_ID;
        }
        Object attribute = request.getAttribute(RequestCorrelationFilter.REQUEST_ID_ATTRIBUTE);
        if (attribute != null) {
            String requestId = sanitizeRequestId(String.valueOf(attribute));
            if (!requestId.isBlank()) {
                return requestId;
            }
        }
        String header = request.getHeader(RequestCorrelationFilter.REQUEST_ID_HEADER);
        String requestId = sanitizeRequestId(header);
        return requestId.isBlank() ? FALLBACK_REQUEST_ID : requestId;
    }

    public String sanitizeMessage(String value) {
        if (value == null || value.isBlank()) {
            return "Request failed";
        }
        String normalized = sanitizeControlText(value);
        return normalized.length() > MAX_ERROR_MESSAGE_LENGTH
                ? normalized.substring(0, MAX_ERROR_MESSAGE_LENGTH)
                : normalized;
    }

    private String sanitizeRequestId(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        String normalized = sanitizeControlText(value);
        return normalized.length() > MAX_REQUEST_ID_LENGTH
                ? normalized.substring(0, MAX_REQUEST_ID_LENGTH)
                : normalized;
    }

    private String sanitizeControlText(String value) {
        boolean hasControlText = false;
        for (int index = 0; index < value.length(); index++) {
            char character = value.charAt(index);
            if (character == '\r' || character == '\n' || character == '\t') {
                hasControlText = true;
                break;
            }
        }
        return (hasControlText ? CONTROL_TEXT_PATTERN.matcher(value).replaceAll(" ") : value).trim();
    }
}
