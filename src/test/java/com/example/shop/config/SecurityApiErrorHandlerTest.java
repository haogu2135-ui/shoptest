package com.example.shop.config;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;

import java.time.Instant;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class SecurityApiErrorHandlerTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final SecurityApiErrorHandler handler = new SecurityApiErrorHandler(
            new ApiErrorResponseFactory(),
            objectMapper
    );

    @Test
    void authenticationFailureUsesUniformJsonPayload() throws Exception {
        MockHttpServletRequest request = request("GET", "/orders/me", "sec-401");
        MockHttpServletResponse response = new MockHttpServletResponse();

        handler.commence(request, response, new BadCredentialsException("bad token"));

        Map<String, Object> body = body(response);
        assertEquals(HttpStatus.UNAUTHORIZED.value(), response.getStatus());
        assertEquals("application/json;charset=UTF-8", response.getContentType());
        assertEquals("UTF-8", response.getCharacterEncoding());
        assertEquals("sec-401", response.getHeader(RequestCorrelationFilter.REQUEST_ID_HEADER));
        assertEquals("Unauthorized", body.get("error"));
        assertEquals("Unauthorized", body.get("message"));
        assertEquals(401, body.get("status"));
        assertEquals("Unauthorized", body.get("statusText"));
        assertEquals("/orders/me", body.get("path"));
        assertEquals("sec-401", body.get("requestId"));
        assertDoesNotThrow(() -> Instant.parse(String.valueOf(body.get("timestamp"))));
    }

    @Test
    void accessDeniedUsesUniformJsonPayload() throws Exception {
        MockHttpServletRequest request = request("POST", "/admin/orders", "sec-403");
        MockHttpServletResponse response = new MockHttpServletResponse();

        handler.handle(request, response, new AccessDeniedException("missing role"));

        Map<String, Object> body = body(response);
        assertEquals(HttpStatus.FORBIDDEN.value(), response.getStatus());
        assertEquals("sec-403", response.getHeader(RequestCorrelationFilter.REQUEST_ID_HEADER));
        assertEquals("Forbidden", body.get("error"));
        assertEquals("Forbidden", body.get("message"));
        assertEquals(403, body.get("status"));
        assertEquals("Forbidden", body.get("statusText"));
        assertEquals("/admin/orders", body.get("path"));
        assertEquals("sec-403", body.get("requestId"));
        assertNotNull(body.get("timestamp"));
    }

    private MockHttpServletRequest request(String method, String path, String requestId) {
        MockHttpServletRequest request = new MockHttpServletRequest(method, path);
        request.setAttribute(RequestCorrelationFilter.REQUEST_ID_ATTRIBUTE, requestId);
        return request;
    }

    private Map<String, Object> body(MockHttpServletResponse response) throws Exception {
        return objectMapper.readValue(response.getContentAsString(), new TypeReference<Map<String, Object>>() {
        });
    }
}
