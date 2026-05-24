package com.example.shop.config;

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

import javax.servlet.http.HttpServletRequest;
import java.util.Map;

@RestControllerAdvice
public class GlobalApiExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalApiExceptionHandler.class);

    private final ApiErrorResponseFactory errorResponses;

    public GlobalApiExceptionHandler(ApiErrorResponseFactory errorResponses) {
        this.errorResponses = errorResponses;
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> handleResponseStatus(
            ResponseStatusException exception,
            HttpServletRequest request
    ) {
        HttpStatus status = exception.getStatus();
        String message = exception.getReason() != null ? exception.getReason() : status.getReasonPhrase();
        if (status.is5xxServerError()) {
            log.error("API request failed with response status: status={} path={} requestId={}",
                    status.value(), resolvePath(request), resolveRequestId(request), exception);
        }
        return buildResponse(status, message, request);
    }

    @ExceptionHandler({
            IllegalArgumentException.class,
            IllegalStateException.class,
            MissingServletRequestParameterException.class,
            MethodArgumentTypeMismatchException.class,
            HttpMessageNotReadableException.class,
            BindException.class,
            MethodArgumentNotValidException.class
    })
    public ResponseEntity<Map<String, Object>> handleBadRequest(Exception exception, HttpServletRequest request) {
        return buildResponse(HttpStatus.BAD_REQUEST, resolveBadRequestMessage(exception), request);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> handleAccessDenied(
            AccessDeniedException exception,
            HttpServletRequest request
    ) {
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
        return buildResponse(HttpStatus.PAYLOAD_TOO_LARGE, "Uploaded file is too large", request);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleUnexpected(Exception exception, HttpServletRequest request) {
        log.error("Unexpected API request failure: path={} requestId={}",
                resolvePath(request), resolveRequestId(request), exception);
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

    private String resolveBadRequestMessage(Exception exception) {
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
        return exception.getMessage() == null ? "Bad request" : exception.getMessage();
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

    private String resolveRequestId(HttpServletRequest request) {
        return errorResponses.resolveRequestId(request);
    }
}
