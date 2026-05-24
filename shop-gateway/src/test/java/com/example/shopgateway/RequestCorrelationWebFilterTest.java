package com.example.shopgateway;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import reactor.core.publisher.Mono;

import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

class RequestCorrelationWebFilterTest {

    private final RequestCorrelationWebFilter filter = new RequestCorrelationWebFilter();

    @AfterEach
    void tearDown() {
        MDC.clear();
    }

    @Test
    void reusesSafeRequestIdAndForwardsItDownstream() {
        MockServerWebExchange exchange = MockServerWebExchange.from(
            MockServerHttpRequest.get("/gateway/status")
                .header(RequestCorrelationWebFilter.REQUEST_ID_HEADER, "web-req:123")
        );
        AtomicReference<String> downstreamHeader = new AtomicReference<>();
        AtomicReference<String> downstreamAttribute = new AtomicReference<>();
        AtomicReference<String> downstreamMdc = new AtomicReference<>();

        filter.filter(exchange, (filteredExchange) -> {
            downstreamHeader.set(filteredExchange.getRequest().getHeaders().getFirst(RequestCorrelationWebFilter.REQUEST_ID_HEADER));
            Object requestIdAttribute = filteredExchange.getAttribute(RequestCorrelationWebFilter.REQUEST_ID_ATTRIBUTE);
            downstreamAttribute.set(String.valueOf(requestIdAttribute));
            downstreamMdc.set(MDC.get(RequestCorrelationWebFilter.REQUEST_ID_ATTRIBUTE));
            return Mono.empty();
        }).block();

        assertThat(exchange.getResponse().getHeaders().getFirst(RequestCorrelationWebFilter.REQUEST_ID_HEADER))
            .isEqualTo("web-req:123");
        assertThat(downstreamHeader.get()).isEqualTo("web-req:123");
        assertThat(downstreamAttribute.get()).isEqualTo("web-req:123");
        assertThat(downstreamMdc.get()).isEqualTo("web-req:123");
        assertThat(MDC.get(RequestCorrelationWebFilter.REQUEST_ID_ATTRIBUTE)).isNull();
    }

    @Test
    void fallsBackToCorrelationIdWhenRequestIdIsUnsafe() {
        MockServerWebExchange exchange = MockServerWebExchange.from(
            MockServerHttpRequest.get("/gateway/status")
                .header(RequestCorrelationWebFilter.REQUEST_ID_HEADER, "bad request id")
                .header(RequestCorrelationWebFilter.CORRELATION_ID_HEADER, "gateway.456")
        );
        AtomicReference<String> downstreamHeader = new AtomicReference<>();

        filter.filter(exchange, (filteredExchange) -> {
            downstreamHeader.set(filteredExchange.getRequest().getHeaders().getFirst(RequestCorrelationWebFilter.REQUEST_ID_HEADER));
            return Mono.empty();
        }).block();

        assertThat(exchange.getResponse().getHeaders().getFirst(RequestCorrelationWebFilter.REQUEST_ID_HEADER))
            .isEqualTo("gateway.456");
        assertThat(downstreamHeader.get()).isEqualTo("gateway.456");
    }

    @Test
    void generatesSafeRequestIdWhenNoSafeHeaderExists() {
        MockServerWebExchange exchange = MockServerWebExchange.from(
            MockServerHttpRequest.get("/gateway/status")
                .header(RequestCorrelationWebFilter.CORRELATION_ID_HEADER, "bad correlation id")
        );
        AtomicReference<String> downstreamHeader = new AtomicReference<>();

        filter.filter(exchange, (filteredExchange) -> {
            downstreamHeader.set(filteredExchange.getRequest().getHeaders().getFirst(RequestCorrelationWebFilter.REQUEST_ID_HEADER));
            return Mono.empty();
        }).block();

        String requestId = exchange.getResponse().getHeaders().getFirst(RequestCorrelationWebFilter.REQUEST_ID_HEADER);
        assertThat(requestId).matches("[A-Za-z0-9._:-]{1,96}");
        assertThat(downstreamHeader.get()).isEqualTo(requestId);
    }
}
