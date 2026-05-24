package com.example.shop.config;

import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import java.util.regex.Pattern;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestCorrelationFilter extends OncePerRequestFilter {
    public static final String REQUEST_ID_HEADER = "X-Request-Id";
    public static final String CORRELATION_ID_HEADER = "X-Correlation-Id";
    public static final String REQUEST_ID_ATTRIBUTE = "requestId";

    private static final int MAX_REQUEST_ID_LENGTH = 96;
    private static final Pattern SAFE_REQUEST_ID = Pattern.compile("[A-Za-z0-9._:-]{1," + MAX_REQUEST_ID_LENGTH + "}");

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String requestId = resolveRequestId(
                request.getHeader(REQUEST_ID_HEADER),
                request.getHeader(CORRELATION_ID_HEADER)
        );
        request.setAttribute(REQUEST_ID_ATTRIBUTE, requestId);
        response.setHeader(REQUEST_ID_HEADER, requestId);
        MDC.put(REQUEST_ID_ATTRIBUTE, requestId);
        try {
            filterChain.doFilter(request, response);
        } finally {
            MDC.remove(REQUEST_ID_ATTRIBUTE);
        }
    }

    private String resolveRequestId(String requestId, String correlationId) {
        String normalizedRequestId = normalizeRequestId(requestId);
        if (normalizedRequestId != null) {
            return normalizedRequestId;
        }
        String normalizedCorrelationId = normalizeRequestId(correlationId);
        return normalizedCorrelationId != null ? normalizedCorrelationId : UUID.randomUUID().toString();
    }

    private String normalizeRequestId(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String trimmed = value.trim();
        return SAFE_REQUEST_ID.matcher(trimmed).matches() ? trimmed : null;
    }
}
