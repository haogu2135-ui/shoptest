package com.example.shop.config;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import javax.servlet.FilterChain;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RequestCorrelationFilterTest {

    private final RequestCorrelationFilter filter = new RequestCorrelationFilter();

    @AfterEach
    void tearDown() {
        MDC.clear();
    }

    @Test
    void reusesSafeRequestIdAndClearsMdcAfterRequest() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/products");
        request.addHeader(RequestCorrelationFilter.REQUEST_ID_HEADER, "web-req:123");
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicReference<String> mdcInsideChain = new AtomicReference<>();

        filter.doFilter(request, response, chain((servletRequest, servletResponse) ->
                mdcInsideChain.set(MDC.get(RequestCorrelationFilter.REQUEST_ID_ATTRIBUTE))));

        assertEquals("web-req:123", response.getHeader(RequestCorrelationFilter.REQUEST_ID_HEADER));
        assertEquals("web-req:123", request.getAttribute(RequestCorrelationFilter.REQUEST_ID_ATTRIBUTE));
        assertEquals("web-req:123", mdcInsideChain.get());
        assertNull(MDC.get(RequestCorrelationFilter.REQUEST_ID_ATTRIBUTE));
    }

    @Test
    void fallsBackToCorrelationIdWhenRequestIdIsUnsafe() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/products");
        request.addHeader(RequestCorrelationFilter.REQUEST_ID_HEADER, "bad request id");
        request.addHeader(RequestCorrelationFilter.CORRELATION_ID_HEADER, "gateway.456");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, chain((servletRequest, servletResponse) -> {
        }));

        assertEquals("gateway.456", response.getHeader(RequestCorrelationFilter.REQUEST_ID_HEADER));
        assertEquals("gateway.456", request.getAttribute(RequestCorrelationFilter.REQUEST_ID_ATTRIBUTE));
    }

    @Test
    void generatesRequestIdWhenNoSafeHeaderExists() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/products");
        request.addHeader(RequestCorrelationFilter.CORRELATION_ID_HEADER, "bad correlation id");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, chain((servletRequest, servletResponse) -> {
        }));

        String requestId = response.getHeader(RequestCorrelationFilter.REQUEST_ID_HEADER);
        assertNotNull(requestId);
        assertTrue(requestId.matches("[A-Za-z0-9._:-]{1,96}"));
        assertEquals(requestId, request.getAttribute(RequestCorrelationFilter.REQUEST_ID_ATTRIBUTE));
    }

    private FilterChain chain(FilterChain delegate) {
        return delegate;
    }
}
