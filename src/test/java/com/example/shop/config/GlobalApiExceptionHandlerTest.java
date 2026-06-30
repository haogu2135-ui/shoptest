package com.example.shop.config;

import com.example.shop.service.SystemAlertService;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.junit.jupiter.api.extension.ExtendWith;

import javax.validation.ConstraintViolation;
import javax.validation.ConstraintViolationException;
import javax.validation.Path;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(OutputCaptureExtension.class)
class GlobalApiExceptionHandlerTest {

    private final GlobalApiExceptionHandler handler = new GlobalApiExceptionHandler(
            new ApiErrorResponseFactory(),
            mock(SystemAlertService.class));

    @Test
    void duplicateKeyExceptionsAreNotCollapsedIntoBadRequestHandler() throws Exception {
        String source = Files.readString(Paths.get("src/main/java/com/example/shop/config/GlobalApiExceptionHandler.java"));

        assertFalse(source.contains("DuplicateKeyException"));
        assertFalse(source.contains("DataIntegrityViolationException.class"));
        assertTrue(source.contains("@ExceptionHandler(Exception.class)"));
    }

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
        assertEquals("NOT_FOUND", body.get("code"));
        assertEquals(404, body.get("status"));
        assertEquals("Not Found", body.get("statusText"));
        assertEquals("/payments/order/9", body.get("path"));
        assertEquals("req-123", body.get("requestId"));
        assertDoesNotThrow(() -> Instant.parse(String.valueOf(body.get("timestamp"))));
    }

    @Test
    void apiErrorFactoryIncludesFrontendStableErrorCodes() {
        ApiErrorResponseFactory factory = new ApiErrorResponseFactory();
        MockHttpServletRequest request = request("/gateway/payments");

        Map<String, Object> rateLimited = factory.buildPayload(
                HttpStatus.TOO_MANY_REQUESTS,
                "Too many requests",
                request);
        Map<String, Object> serviceUnavailable = factory.buildPayload(
                HttpStatus.SERVICE_UNAVAILABLE,
                "Service unavailable",
                request);

        assertEquals("RATE_LIMITED", rateLimited.get("code"));
        assertEquals("SERVICE_UNAVAILABLE", serviceUnavailable.get("code"));
    }

    @Test
    void responseStatusExceptionFiltersSensitiveClientReason() {
        MockHttpServletRequest request = request("/gateway/payments");

        ResponseEntity<Map<String, Object>> response = handler.handleResponseStatus(
                new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Gateway secret is not configured: jdbc:mysql://127.0.0.1/shop"),
                request
        );

        Map<String, Object> body = response.getBody();
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertNotNull(body);
        assertEquals("Bad request", body.get("error"));
        assertFalse(String.valueOf(body).contains("jdbc:mysql"));
        assertFalse(String.valueOf(body).contains("secret"));
    }

    @Test
    void responseStatusExceptionDoesNotExposeServerErrorReason() {
        MockHttpServletRequest request = request("/reviews/images");

        ResponseEntity<Map<String, Object>> response = handler.handleResponseStatus(
                new ResponseStatusException(
                        HttpStatus.INTERNAL_SERVER_ERROR,
                        "Could not save review image at /var/app/uploads/reviews"),
                request
        );

        Map<String, Object> body = response.getBody();
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
        assertNotNull(body);
        assertEquals("Internal server error", body.get("error"));
        assertFalse(String.valueOf(body).contains("/var/app"));
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
    void badRequestWritesApplicationLogAndRecordsAlert(CapturedOutput output) {
        SystemAlertService systemAlertService = mock(SystemAlertService.class);
        GlobalApiExceptionHandler handler = new GlobalApiExceptionHandler(
                new ApiErrorResponseFactory(),
                systemAlertService);
        MockHttpServletRequest request = request("/cart/add");
        request.setAttribute(RequestCorrelationFilter.REQUEST_ID_ATTRIBUTE, "req-bad-400");
        IllegalArgumentException exception = new IllegalArgumentException("Quantity is invalid");

        ResponseEntity<Map<String, Object>> response = handler.handleBadRequest(exception, request);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        verify(systemAlertService).recordException(eq(exception), eq(HttpStatus.BAD_REQUEST), eq(request));
        String logs = capturedLogs(output);
        assertTrue(logs.contains("Bad API request"));
        assertTrue(logs.contains("/cart/add"));
        assertTrue(logs.contains("req-bad-400"));
        assertTrue(logs.contains("Quantity is invalid"));
    }

    @Test
    void badRequestFiltersSensitiveIllegalStateMessage() {
        MockHttpServletRequest request = request("/auth/email-code");

        ResponseEntity<Map<String, Object>> response = handler.handleBadRequest(
                new IllegalStateException("RedisTemplate is not configured"),
                request
        );

        Map<String, Object> body = response.getBody();
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertNotNull(body);
        assertEquals("Bad request", body.get("error"));
        assertFalse(String.valueOf(body).contains("RedisTemplate"));
    }

    @Test
    void badRequestFiltersExternalIllegalArgumentMessages() throws Exception {
        MockHttpServletRequest request = request("/orders/track");
        IllegalArgumentException exception = new IllegalArgumentException("Inventory lookup failed");
        exception.setStackTrace(new StackTraceElement[]{
                new StackTraceElement("org.hibernate.engine.jdbc.spi.SqlExceptionHelper", "convert", "SqlExceptionHelper.java", 120)
        });

        ResponseEntity<Map<String, Object>> response = handler.handleBadRequest(exception, request);

        Map<String, Object> body = response.getBody();
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertNotNull(body);
        assertEquals("Bad request", body.get("error"));
        assertFalse(String.valueOf(body).contains("Inventory lookup failed"));
        String source = java.nio.file.Files.readString(
                java.nio.file.Paths.get("src/main/java/com/example/shop/config/GlobalApiExceptionHandler.java"));
        assertTrue(source.contains("safeBusinessExceptionMessage(exception)"));
        assertTrue(source.contains("className.startsWith(\"com.example.shop.\")"));
        assertTrue(source.contains("(?:[a-z_$][\\\\w$]*\\\\.){2,}[a-z_$][\\\\w$]*"));
    }

    @Test
    void badRequestKeepsSafePasswordValidationMessage() {
        MockHttpServletRequest request = request("/users/password");

        ResponseEntity<Map<String, Object>> response = handler.handleBadRequest(
                new IllegalArgumentException("Current password is incorrect"),
                request
        );

        Map<String, Object> body = response.getBody();
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertNotNull(body);
        assertEquals("Current password is incorrect", body.get("error"));
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
    void constraintViolationUsesBadRequestInsteadOfUnexpectedServerError() {
        MockHttpServletRequest request = request("/cart/add");
        ConstraintViolation<?> violation = mock(ConstraintViolation.class);
        Path path = mock(Path.class);
        when(path.toString()).thenReturn("addToCart.quantity");
        when(violation.getPropertyPath()).thenReturn(path);
        when(violation.getMessage()).thenReturn("must be less than or equal to 999");
        ConstraintViolationException exception = new ConstraintViolationException(Set.of(violation));

        ResponseEntity<Map<String, Object>> response = handler.handleBadRequest(exception, request);

        Map<String, Object> body = response.getBody();
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertNotNull(body);
        assertEquals("quantity: must be less than or equal to 999", body.get("error"));
    }

    @Test
    void noHandlerFoundReturnsNotFoundInsteadOfUnexpectedServerError() throws Exception {
        MockHttpServletRequest request = request("/missing-route");

        ResponseEntity<Map<String, Object>> response = handler.handleNoHandlerFound(
                new NoHandlerFoundException("GET", "/missing-route", new HttpHeaders()),
                request
        );

        Map<String, Object> body = response.getBody();
        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        assertNotNull(body);
        assertEquals("Not Found", body.get("error"));
        assertEquals(404, body.get("status"));
        assertEquals("/missing-route", body.get("path"));

        String source = java.nio.file.Files.readString(
                java.nio.file.Paths.get("src/main/java/com/example/shop/config/GlobalApiExceptionHandler.java"));
        assertTrue(source.contains("@ExceptionHandler(NoHandlerFoundException.class)"));
        assertTrue(source.indexOf("handleNoHandlerFound") < source.indexOf("handleUnexpected"));
    }

    @Test
    void businessIllegalStateMessagesAreReturnedAsBadRequest() throws Exception {
        MockHttpServletRequest request = request("/orders/checkout/me");

        ResponseEntity<Map<String, Object>> response = handler.handleBadRequest(
                new IllegalStateException("Insufficient stock"),
                request
        );

        Map<String, Object> body = response.getBody();
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertNotNull(body);
        assertEquals("Insufficient stock", body.get("error"));
        String source = java.nio.file.Files.readString(
                java.nio.file.Paths.get("src/main/java/com/example/shop/config/GlobalApiExceptionHandler.java"));
        assertFalse(source.contains("handleRuntimeException"));
        assertFalse(source.contains("Server error, please try again later"));
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
        assertEquals(ApiErrorResponseFactory.FALLBACK_REQUEST_ID, body.get("requestId"));
    }

    @Test
    void unexpectedExceptionPayloadDoesNotExposeStackTraceFields() {
        MockHttpServletRequest request = request("/admin/system/status");

        ResponseEntity<Map<String, Object>> response = handler.handleUnexpected(
                new RuntimeException("boom"),
                request
        );

        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertFalse(body.containsKey("trace"));
        assertFalse(body.containsKey("stackTrace"));
        assertFalse(body.containsKey("exception"));
        assertFalse(String.valueOf(body).contains("RuntimeException"));
    }

    @Test
    void accessDeniedWritesApplicationLogAndRecordsSecurityAlert(CapturedOutput output) {
        SystemAlertService systemAlertService = mock(SystemAlertService.class);
        GlobalApiExceptionHandler handler = new GlobalApiExceptionHandler(
                new ApiErrorResponseFactory(),
                systemAlertService);
        MockHttpServletRequest request = request("/admin/orders/42");
        request.setAttribute(RequestCorrelationFilter.REQUEST_ID_ATTRIBUTE, "req-denied-403");
        AccessDeniedException exception = new AccessDeniedException("missing orders:payment permission");

        ResponseEntity<Map<String, Object>> response = handler.handleAccessDenied(exception, request);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("Forbidden", response.getBody().get("error"));
        verify(systemAlertService).recordException(eq(exception), eq(HttpStatus.FORBIDDEN), eq(request));
        verify(systemAlertService).recordSecurityEvent(
                eq("WARNING"),
                eq("ACCESS_DENIED"),
                eq("API access denied"),
                eq("missing orders:payment permission"),
                eq("access-denied:/admin/orders/42"),
                eq("httpStatus=403, method=GET, path=/admin/orders/42, requestId=req-denied-403"));
        String logs = capturedLogs(output);
        assertTrue(logs.contains("API access denied"));
        assertTrue(logs.contains("/admin/orders/42"));
        assertTrue(logs.contains("req-denied-403"));
        assertTrue(logs.contains("missing orders:payment permission"));
    }

    @Test
    void methodAndMediaTypeErrorsRecordAlerts() {
        SystemAlertService systemAlertService = mock(SystemAlertService.class);
        GlobalApiExceptionHandler handler = new GlobalApiExceptionHandler(
                new ApiErrorResponseFactory(),
                systemAlertService);
        MockHttpServletRequest request = request("/orders/me");
        HttpRequestMethodNotSupportedException methodException =
                new HttpRequestMethodNotSupportedException("PATCH", new String[]{"GET"});
        HttpMediaTypeNotSupportedException mediaTypeException =
                new HttpMediaTypeNotSupportedException("application/xml");

        ResponseEntity<Map<String, Object>> methodResponse = handler.handleMethodNotAllowed(methodException, request);
        ResponseEntity<Map<String, Object>> mediaTypeResponse = handler.handleUnsupportedMediaType(mediaTypeException, request);

        assertEquals(HttpStatus.METHOD_NOT_ALLOWED, methodResponse.getStatusCode());
        assertEquals("Method not allowed", methodResponse.getBody().get("error"));
        assertEquals(HttpStatus.UNSUPPORTED_MEDIA_TYPE, mediaTypeResponse.getStatusCode());
        assertEquals("Unsupported media type", mediaTypeResponse.getBody().get("error"));
        verify(systemAlertService).recordException(eq(methodException), eq(HttpStatus.METHOD_NOT_ALLOWED), eq(request));
        verify(systemAlertService).recordException(eq(mediaTypeException), eq(HttpStatus.UNSUPPORTED_MEDIA_TYPE), eq(request));
    }

    @Test
    void errorPayloadUsesFallbackRequestIdWhenRequestIsUnavailable() {
        Map<String, Object> body = new ApiErrorResponseFactory()
                .buildPayload(HttpStatus.INTERNAL_SERVER_ERROR, "Internal server error", null);

        assertEquals("", body.get("path"));
        assertEquals(ApiErrorResponseFactory.FALLBACK_REQUEST_ID, body.get("requestId"));
    }

    private MockHttpServletRequest request(String uri) {
        return new MockHttpServletRequest("GET", uri);
    }

    private String capturedLogs(CapturedOutput output) {
        return output.getOut() + output.getErr();
    }
}
