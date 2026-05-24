package com.example.shop.config;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class GlobalApiExceptionHandlerTest {

    private final GlobalApiExceptionHandler handler = new GlobalApiExceptionHandler(new ApiErrorResponseFactory());

    @Test
    void responseStatusExceptionUsesUniformPayloadWithRequestId() {
        MockHttpServletRequest request = request("/payments/order/9");
        request.setAttribute(RequestCorrelationFilter.REQUEST_ID_ATTRIBUTE, "req-123");

        ResponseEntity<Map<String, Object>> response = handler.handleResponseStatus(
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"),
                request
        );

        Map<String, Object> body = response.getBody();
        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        assertNotNull(body);
        assertEquals("Order not found", body.get("error"));
        assertEquals("Order not found", body.get("message"));
        assertEquals(404, body.get("status"));
        assertEquals("Not Found", body.get("statusText"));
        assertEquals("/payments/order/9", body.get("path"));
        assertEquals("req-123", body.get("requestId"));
        assertDoesNotThrow(() -> Instant.parse(String.valueOf(body.get("timestamp"))));
    }

    @Test
    void badRequestMessageIsSanitized() {
        MockHttpServletRequest request = request("/products");

        ResponseEntity<Map<String, Object>> response = handler.handleBadRequest(
                new IllegalArgumentException("bad\ninput\tvalue"),
                request
        );

        Map<String, Object> body = response.getBody();
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertNotNull(body);
        assertEquals("bad input value", body.get("error"));
        assertFalse(String.valueOf(body.get("error")).contains("\n"));
        assertFalse(String.valueOf(body.get("error")).contains("\t"));
    }

    @Test
    void missingRequestParameterUsesFieldSpecificMessage() {
        MockHttpServletRequest request = request("/orders/history");
        request.addHeader(RequestCorrelationFilter.REQUEST_ID_HEADER, "header-456");

        ResponseEntity<Map<String, Object>> response = handler.handleBadRequest(
                new MissingServletRequestParameterException("orderNo", "String"),
                request
        );

        Map<String, Object> body = response.getBody();
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertNotNull(body);
        assertEquals("orderNo is required", body.get("error"));
        assertEquals("header-456", body.get("requestId"));
    }

    @Test
    void unexpectedExceptionDoesNotExposeInternalMessage() {
        MockHttpServletRequest request = request("/admin/system/status");

        ResponseEntity<Map<String, Object>> response = handler.handleUnexpected(
                new RuntimeException("database password leaked"),
                request
        );

        Map<String, Object> body = response.getBody();
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
        assertNotNull(body);
        assertEquals("Internal server error", body.get("error"));
        assertEquals("Internal Server Error", body.get("statusText"));
    }

    private MockHttpServletRequest request(String uri) {
        return new MockHttpServletRequest("GET", uri);
    }
}
