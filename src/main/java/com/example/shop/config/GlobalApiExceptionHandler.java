package com.example.shop.config;

import com.example.shop.service.SystemAlertService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.BindException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.NoHandlerFoundException;

import javax.servlet.http.HttpServletRequest;
import javax.validation.ConstraintViolation;
import javax.validation.ConstraintViolationException;
import java.util.Map;
import java.util.regex.Pattern;

@RestControllerAdvice
public class GlobalApiExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalApiExceptionHandler.class);
    private static final Pattern CLIENT_SAFE_ERROR_MESSAGE = Pattern.compile(
            "^[A-Za-z0-9][A-Za-z0-9 .,()'/:#+\\-]{0,180}$");
    private static final Pattern SENSITIVE_ERROR_DETAIL = Pattern.compile(
            "(?i)(secret|jwt|token|redis|jdbc|sql|database|nacos|hikari|classpath|stack trace|"
                    + "exception|circuit breaker|not configured|configuration|sha-?\\d+|[a-z]+://|"
                    + "localhost|127\\.0\\.0\\.1|\\b10\\.\\d+\\.\\d+\\.\\d+\\b|\\b172\\.(1[6-9]|2\\d|3[0-1])\\.\\d+\\.\\d+\\b|"
                    + "\\b192\\.168\\.\\d+\\.\\d+\\b|[/\\\\{}\\[\\]_;=@])");

    private final ApiErrorResponseFactory errorResponses;
    private final SystemAlertService systemAlertService;

    public GlobalApiExceptionHandler(ApiErrorResponseFactory errorResponses, SystemAlertService systemAlertService) {
        this.errorResponses = errorResponses;
        this.systemAlertService = systemAlertService;
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> handleResponseStatus(
            ResponseStatusException exception,
            HttpServletRequest request
    ) {
        HttpStatus status = exception.getStatus();
        String message = resolveResponseStatusMessage(status, exception, request);
        if (status.is5xxServerError()) {
            log.error("API request failed with response status: status={} path={} requestId={}",
                    status.value(), resolvePath(request), resolveRequestId(request), exception);
        }
        systemAlertService.recordException(exception, status, request);
        return buildResponse(status, message, request);
    }

    @ExceptionHandler({
            IllegalArgumentException.class,
            IllegalStateException.class,
            MissingServletRequestParameterException.class,
            MethodArgumentTypeMismatchException.class,
            HttpMessageNotReadableException.class,
            BindException.class,
            MethodArgumentNotValidException.class,
            ConstraintViolationException.class
    })
    public ResponseEntity<Map<String, Object>> handleBadRequest(Exception exception, HttpServletRequest request) {
        log.warn("Bad API request: path={} requestId={} reason={}",
                resolvePath(request), resolveRequestId(request), safeLogReason(exception));
        systemAlertService.recordException(exception, HttpStatus.BAD_REQUEST, request);
        return buildResponse(HttpStatus.BAD_REQUEST, resolveBadRequestMessage(exception, request), request);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> handleAccessDenied(
            AccessDeniedException exception,
            HttpServletRequest request
    ) {
        log.warn("API access denied: path={} requestId={} reason={}",
                resolvePath(request), resolveRequestId(request), safeLogReason(exception));
        recordAccessDeniedSecurityEvent(exception, request);
        return buildResponse(HttpStatus.FORBIDDEN, "Forbidden", request);
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<Map<String, Object>> handleMethodNotAllowed(
            HttpRequestMethodNotSupportedException exception,
            HttpServletRequest request
    ) {
        return buildResponse(HttpStatus.METHOD_NOT_ALLOWED, "Method not allowed", request);
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<Map<String, Object>> handleUnsupportedMediaType(
            HttpMediaTypeNotSupportedException exception,
            HttpServletRequest request
    ) {
        return buildResponse(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Unsupported media type", request);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, Object>> handleMaxUploadSizeExceeded(
            MaxUploadSizeExceededException exception,
            HttpServletRequest request
    ) {
        systemAlertService.recordException(exception, HttpStatus.PAYLOAD_TOO_LARGE, request);
        return buildResponse(HttpStatus.PAYLOAD_TOO_LARGE, "Uploaded file is too large", request);
    }

    @ExceptionHandler(NoHandlerFoundException.class)
    public ResponseEntity<Map<String, Object>> handleNoHandlerFound(
            NoHandlerFoundException exception,
            HttpServletRequest request
    ) {
        systemAlertService.recordException(exception, HttpStatus.NOT_FOUND, request);
        return buildResponse(HttpStatus.NOT_FOUND, "Not Found", request);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleUnexpected(Exception exception, HttpServletRequest request) {
        log.error("Unexpected API request failure: path={} requestId={}",
                resolvePath(request), resolveRequestId(request), exception);
        systemAlertService.recordException(exception, HttpStatus.INTERNAL_SERVER_ERROR, request);
        return buildResponse(HttpStatus.INTERNAL_SERVER_ERROR, "Internal server error", request);
    }

    private ResponseEntity<Map<String, Object>> buildResponse(
            HttpStatus status,
            String message,
            HttpServletRequest request
    ) {
        return errorResponses.buildResponse(status, message, request);
    }

    private String resolvePath(HttpServletRequest request) {
        return errorResponses.resolvePath(request);
    }

    private String resolveBadRequestMessage(Exception exception, HttpServletRequest request) {
        if (exception instanceof MethodArgumentNotValidException) {
            MethodArgumentNotValidException validationException = (MethodArgumentNotValidException) exception;
            String fieldMessage = firstFieldMessage(validationException.getBindingResult().getFieldError());
            return fieldMessage != null ? fieldMessage : "Request validation failed";
        }
        if (exception instanceof BindException) {
            BindException bindException = (BindException) exception;
            String fieldMessage = firstFieldMessage(bindException.getBindingResult().getFieldError());
            return fieldMessage != null ? fieldMessage : "Request validation failed";
        }
        if (exception instanceof ConstraintViolationException) {
            ConstraintViolationException violationException = (ConstraintViolationException) exception;
            String violationMessage = firstConstraintViolationMessage(violationException);
            return violationMessage != null ? violationMessage : "Request validation failed";
        }
        if (exception instanceof MissingServletRequestParameterException) {
            MissingServletRequestParameterException missing = (MissingServletRequestParameterException) exception;
            return missing.getParameterName() + " is required";
        }
        if (exception instanceof MethodArgumentTypeMismatchException) {
            MethodArgumentTypeMismatchException mismatch = (MethodArgumentTypeMismatchException) exception;
            return mismatch.getName() + " is invalid";
        }
        if (exception instanceof HttpMessageNotReadableException) {
            return "Request body is invalid";
        }
        String safeMessage = safeClientMessage(exception.getMessage());
        if (safeMessage != null) {
            return safeMessage;
        }
        logFilteredClientError(HttpStatus.BAD_REQUEST, exception, request);
        return "Bad request";
    }

    private String firstFieldMessage(FieldError fieldError) {
        if (fieldError == null) {
            return null;
        }
        String message = fieldError.getDefaultMessage();
        if (message == null || message.isBlank()) {
            return fieldError.getField() + " is invalid";
        }
        return fieldError.getField() + ": " + message;
    }

    private String firstConstraintViolationMessage(ConstraintViolationException exception) {
        if (exception == null || exception.getConstraintViolations() == null) {
            return null;
        }
        return exception.getConstraintViolations().stream()
                .findFirst()
                .map(this::constraintViolationMessage)
                .orElse(null);
    }

    private String constraintViolationMessage(ConstraintViolation<?> violation) {
        if (violation == null) {
            return null;
        }
        String path = violation.getPropertyPath() == null ? "" : violation.getPropertyPath().toString();
        String field = path.contains(".") ? path.substring(path.lastIndexOf('.') + 1) : path;
        String message = violation.getMessage();
        if (message == null || message.isBlank()) {
            return field.isBlank() ? "Request validation failed" : field + " is invalid";
        }
        return field.isBlank() ? message : field + ": " + message;
    }

    private String resolveRequestId(HttpServletRequest request) {
        return errorResponses.resolveRequestId(request);
    }

    private String resolveResponseStatusMessage(
            HttpStatus status,
            ResponseStatusException exception,
            HttpServletRequest request
    ) {
        if (status.is5xxServerError()) {
            return "Internal server error";
        }
        String safeReason = safeClientMessage(exception.getReason());
        if (safeReason != null) {
            return safeReason;
        }
        if (exception.getReason() != null && !exception.getReason().isBlank()) {
            logFilteredClientError(status, exception, request);
        }
        if (status == HttpStatus.BAD_REQUEST) {
            return "Bad request";
        }
        return status.getReasonPhrase();
    }

    private String safeClientMessage(String rawMessage) {
        if (rawMessage == null || rawMessage.isBlank()) {
            return null;
        }
        String message = errorResponses.sanitizeMessage(rawMessage);
        if (message.isBlank() || SENSITIVE_ERROR_DETAIL.matcher(message).find()) {
            return null;
        }
        return CLIENT_SAFE_ERROR_MESSAGE.matcher(message).matches() ? message : null;
    }

    private void logFilteredClientError(HttpStatus status, Exception exception, HttpServletRequest request) {
        log.warn("Filtered unsafe API error detail from client response: status={} path={} requestId={}",
                status.value(), resolvePath(request), resolveRequestId(request), exception);
    }

    private String safeLogReason(Exception exception) {
        if (exception == null) {
            return "";
        }
        String message = errorResponses.sanitizeMessage(exception.getMessage());
        if (message == null || message.isBlank()) {
            return exception.getClass().getSimpleName();
        }
        return message;
    }

    private void recordAccessDeniedSecurityEvent(AccessDeniedException exception, HttpServletRequest request) {
        String path = resolvePath(request);
        String requestId = resolveRequestId(request);
        systemAlertService.recordSecurityEvent(
                "WARNING",
                "ACCESS_DENIED",
                "API access denied",
                safeLogReason(exception),
                "access-denied:" + path,
                "httpStatus=403, method=" + (request == null ? "" : request.getMethod())
                        + ", path=" + path
                        + ", requestId=" + requestId);
    }
}
