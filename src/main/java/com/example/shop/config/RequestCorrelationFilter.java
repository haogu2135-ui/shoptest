package com.example.shop.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.concurrent.TimeUnit;
import java.util.UUID;
import java.util.regex.Pattern;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestCorrelationFilter extends OncePerRequestFilter {
    public static final String REQUEST_ID_HEADER = "X-Request-Id";
    public static final String CORRELATION_ID_HEADER = "X-Correlation-Id";
    public static final String REQUEST_ID_ATTRIBUTE = "requestId";

    private static final Logger log = LoggerFactory.getLogger(RequestCorrelationFilter.class);
    private static final int MAX_REQUEST_ID_LENGTH = 96;
    private static final int MAX_LOGGED_PATH_LENGTH = 240;
    private static final Pattern SAFE_REQUEST_ID = Pattern.compile("[A-Za-z0-9._:-]{1," + MAX_REQUEST_ID_LENGTH + "}");

    @Value("${observability.request-latency.enabled:true}")
    private boolean requestLatencyLoggingEnabled = true;

    @Value("${observability.slow-request.api-threshold-ms:1000}")
    private long slowApiRequestThresholdMs = 1000L;

    @Value("${observability.slow-request.admin-threshold-ms:5000}")
    private long slowAdminRequestThresholdMs = 5000L;

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
        long startedAtNanos = System.nanoTime();
        try {
            filterChain.doFilter(request, response);
        } finally {
            logSlowRequestIfNeeded(request, response, requestId, startedAtNanos);
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

    private void logSlowRequestIfNeeded(HttpServletRequest request,
                                        HttpServletResponse response,
                                        String requestId,
                                        long startedAtNanos) {
        if (!requestLatencyLoggingEnabled) {
            return;
        }
        long durationMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedAtNanos);
        String path = safeRequestPath(request);
        long thresholdMs = slowRequestThresholdMs(path);
        if (durationMs < thresholdMs) {
            return;
        }
        log.warn(
                "Slow HTTP request: method={}, path={}, status={}, durationMs={}, thresholdMs={}, requestId={}",
                request.getMethod(),
                path,
                response.getStatus(),
                durationMs,
                thresholdMs,
                requestId);
    }

    private long slowRequestThresholdMs(String path) {
        long configured = isAdminRequestPath(path) ? slowAdminRequestThresholdMs : slowApiRequestThresholdMs;
        return Math.max(0L, configured);
    }

    private boolean isAdminRequestPath(String path) {
        return "/admin".equals(path)
                || (path != null && path.startsWith("/admin/"))
                || "/api/admin".equals(path)
                || (path != null && path.startsWith("/api/admin/"));
    }

    private String safeRequestPath(HttpServletRequest request) {
        String path = request.getRequestURI();
        if (path == null || path.isBlank()) {
            path = request.getServletPath();
        }
        if (path == null || path.isBlank()) {
            return "/";
        }
        return path.length() <= MAX_LOGGED_PATH_LENGTH ? path : path.substring(0, MAX_LOGGED_PATH_LENGTH) + "...";
    }
}
