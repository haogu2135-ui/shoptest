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
            return "";
        }
        Object attribute = request.getAttribute(RequestCorrelationFilter.REQUEST_ID_ATTRIBUTE);
        if (attribute != null) {
            return String.valueOf(attribute);
        }
        String header = request.getHeader(RequestCorrelationFilter.REQUEST_ID_HEADER);
        return header == null ? "" : sanitizeMessage(header);
    }

    public String sanitizeMessage(String value) {
        if (value == null || value.isBlank()) {
            return "Request failed";
        }
        String normalized = value.replaceAll("[\\r\\n\\t]+", " ").trim();
        return normalized.length() > 240 ? normalized.substring(0, 240) : normalized;
    }
}
