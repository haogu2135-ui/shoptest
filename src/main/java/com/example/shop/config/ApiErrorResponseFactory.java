package com.example.shop.config;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;

import javax.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@Component
public class ApiErrorResponseFactory {
    public static final String FALLBACK_REQUEST_ID = "unavailable";

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
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("error", safeMessage);
        payload.put("message", safeMessage);
        payload.put("status", status.value());
        payload.put("statusText", status.getReasonPhrase());
        payload.put("path", resolvePath(request));
        payload.put("requestId", resolveRequestId(request));
        payload.put("timestamp", Instant.now().toString());
        return payload;
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
        String normalized = value.replaceAll("[\\r\\n\\t]+", " ").trim();
        return normalized.length() > 240 ? normalized.substring(0, 240) : normalized;
    }

    private String sanitizeRequestId(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        String normalized = value.replaceAll("[\\r\\n\\t]+", " ").trim();
        return normalized.length() > 96 ? normalized.substring(0, 96) : normalized;
    }
}
