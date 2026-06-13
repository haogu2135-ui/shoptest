package com.example.shop.config;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.http.server.ServletServerHttpResponse;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;

class ManualApiErrorResponseAdviceTest {
    private final ManualApiErrorResponseAdvice advice = new ManualApiErrorResponseAdvice(
            new ApiErrorResponseFactory());

    @Test
    void normalizesManualErrorMapToUniformApiPayload() {
        MockHttpServletRequest request = request("POST", "/cart/add", "manual-123");
        MockHttpServletResponse response = new MockHttpServletResponse();
        response.setStatus(HttpStatus.CONFLICT.value());
        Map<String, Object> manualError = new LinkedHashMap<>();
        manualError.put("error", "Insufficient stock");
        manualError.put("max", 3);

        Map<String, Object> body = writeBody(manualError, MediaType.APPLICATION_JSON, request, response);

        assertEquals(HttpStatus.CONFLICT.value(), response.getStatus());
        assertEquals("Insufficient stock", body.get("error"));
        assertEquals("Insufficient stock", body.get("message"));
        assertEquals(409, body.get("status"));
        assertEquals("Conflict", body.get("statusText"));
        assertEquals("/cart/add", body.get("path"));
        assertEquals("manual-123", body.get("requestId"));
        assertEquals(3, body.get("max"));
        assertDoesNotThrow(() -> Instant.parse(String.valueOf(body.get("timestamp"))));
    }

    @Test
    void defaultErrorStatusBecomesBadRequestWhenControllerReturnedSuccessStatus() {
        MockHttpServletRequest request = request("POST", "/brands", "manual-400");
        MockHttpServletResponse response = new MockHttpServletResponse();
        response.setStatus(HttpStatus.OK.value());

        Map<String, Object> body = writeBody(
                Map.of("error", "Brand payload is required"),
                MediaType.APPLICATION_JSON,
                request,
                response);

        assertEquals(HttpStatus.BAD_REQUEST.value(), response.getStatus());
        assertEquals(400, body.get("status"));
        assertEquals("Bad Request", body.get("statusText"));
        assertEquals("Brand payload is required", body.get("message"));
    }

    @Test
    void normalizesEmptyErrorBodyToUniformApiPayload() {
        MockHttpServletRequest request = request("POST", "/categories", "empty-400");
        MockHttpServletResponse response = new MockHttpServletResponse();
        response.setStatus(HttpStatus.BAD_REQUEST.value());

        Map<String, Object> body = writeBody(null, MediaType.APPLICATION_JSON, request, response);

        assertEquals(HttpStatus.BAD_REQUEST.value(), response.getStatus());
        assertEquals("Bad Request", body.get("error"));
        assertEquals("Bad Request", body.get("message"));
        assertEquals(400, body.get("status"));
        assertEquals("Bad Request", body.get("statusText"));
        assertEquals("/categories", body.get("path"));
        assertEquals("empty-400", body.get("requestId"));
        assertDoesNotThrow(() -> Instant.parse(String.valueOf(body.get("timestamp"))));
    }

    @Test
    void leavesAlreadyUniformErrorPayloadUnchanged() {
        MockHttpServletRequest request = request("GET", "/orders/missing", "uniform-404");
        MockHttpServletResponse response = new MockHttpServletResponse();
        response.setStatus(HttpStatus.NOT_FOUND.value());
        Map<String, Object> uniformBody = new ApiErrorResponseFactory()
                .buildPayload(HttpStatus.NOT_FOUND, "Order not found", request);

        Object body = advice.beforeBodyWrite(
                uniformBody,
                null,
                MediaType.APPLICATION_JSON,
                MappingJackson2HttpMessageConverter.class,
                new ServletServerHttpRequest(request),
                new ServletServerHttpResponse(response));

        assertSame(uniformBody, body);
    }

    @Test
    void ignoresNonJsonResponses() {
        MockHttpServletRequest request = request("POST", "/cart/add", "manual-text");
        MockHttpServletResponse response = new MockHttpServletResponse();
        response.setStatus(HttpStatus.BAD_REQUEST.value());
        Map<String, Object> manualError = Map.of("error", "No cart items selected");

        Object body = advice.beforeBodyWrite(
                manualError,
                null,
                MediaType.TEXT_PLAIN,
                MappingJackson2HttpMessageConverter.class,
                new ServletServerHttpRequest(request),
                new ServletServerHttpResponse(response));

        assertSame(manualError, body);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> writeBody(
            Object body,
            MediaType mediaType,
            MockHttpServletRequest request,
            MockHttpServletResponse response
    ) {
        return (Map<String, Object>) advice.beforeBodyWrite(
                body,
                null,
                mediaType,
                MappingJackson2HttpMessageConverter.class,
                new ServletServerHttpRequest(request),
                new ServletServerHttpResponse(response));
    }

    private MockHttpServletRequest request(String method, String path, String requestId) {
        MockHttpServletRequest request = new MockHttpServletRequest(method, path);
        request.setAttribute(RequestCorrelationFilter.REQUEST_ID_ATTRIBUTE, requestId);
        return request;
    }
}
