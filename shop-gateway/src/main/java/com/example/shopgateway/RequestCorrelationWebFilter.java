package com.example.shopgateway;

import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;

import java.util.UUID;
import java.util.regex.Pattern;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestCorrelationWebFilter implements WebFilter {
    public static final String REQUEST_ID_HEADER = "X-Request-Id";
    public static final String CORRELATION_ID_HEADER = "X-Correlation-Id";
    public static final String REQUEST_ID_ATTRIBUTE = "requestId";

    private static final int MAX_REQUEST_ID_LENGTH = 96;
    private static final Pattern SAFE_REQUEST_ID = Pattern.compile("[A-Za-z0-9._:-]{1," + MAX_REQUEST_ID_LENGTH + "}");

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        String requestId = resolveRequestId(
            exchange.getRequest().getHeaders().getFirst(REQUEST_ID_HEADER),
            exchange.getRequest().getHeaders().getFirst(CORRELATION_ID_HEADER)
        );
        ServerHttpRequest request = exchange.getRequest().mutate()
            .headers((headers) -> headers.set(REQUEST_ID_HEADER, requestId))
            .build();
        ServerWebExchange correlatedExchange = exchange.mutate().request(request).build();
        correlatedExchange.getAttributes().put(REQUEST_ID_ATTRIBUTE, requestId);
        correlatedExchange.getResponse().getHeaders().set(REQUEST_ID_HEADER, requestId);
        MDC.put(REQUEST_ID_ATTRIBUTE, requestId);
        return chain.filter(correlatedExchange)
            .doFinally((signalType) -> MDC.remove(REQUEST_ID_ATTRIBUTE));
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
