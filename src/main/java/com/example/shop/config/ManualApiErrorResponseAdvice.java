package com.example.shop.config;

import org.springframework.core.MethodParameter;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.http.server.ServletServerHttpResponse;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyAdvice;

import javax.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class ManualApiErrorResponseAdvice implements ResponseBodyAdvice<Object> {
    private final ApiErrorResponseFactory errorResponses;

    public ManualApiErrorResponseAdvice(ApiErrorResponseFactory errorResponses) {
        this.errorResponses = errorResponses;
    }

    @Override
    public boolean supports(MethodParameter returnType, Class<? extends HttpMessageConverter<?>> converterType) {
        return true;
    }

    @Override
    public Object beforeBodyWrite(
            Object body,
            MethodParameter returnType,
            MediaType selectedContentType,
            Class<? extends HttpMessageConverter<?>> selectedConverterType,
            ServerHttpRequest request,
            ServerHttpResponse response
    ) {
        if (!(body instanceof Map) || !isJsonLike(selectedContentType)) {
            return body;
        }
        Map<?, ?> map = (Map<?, ?>) body;
        if (!shouldNormalize(map)) {
            return body;
        }

        HttpStatus status = resolveStatus(response);
        HttpServletRequest servletRequest = request instanceof ServletServerHttpRequest
                ? ((ServletServerHttpRequest) request).getServletRequest()
                : null;
        String message = String.valueOf(map.get("error"));
        Map<String, Object> normalized = new LinkedHashMap<>(
                errorResponses.buildPayload(status, message, servletRequest));
        map.forEach((key, value) -> {
            if (key instanceof String && !normalized.containsKey(key)) {
                normalized.put((String) key, value);
            }
        });
        return normalized;
    }

    private boolean shouldNormalize(Map<?, ?> map) {
        return map.containsKey("error")
                && (!map.containsKey("message")
                || !map.containsKey("status")
                || !map.containsKey("statusText")
                || !map.containsKey("path")
                || !map.containsKey("requestId")
                || !map.containsKey("timestamp"));
    }

    private boolean isJsonLike(MediaType mediaType) {
        return mediaType == null
                || MediaType.APPLICATION_JSON.includes(mediaType)
                || mediaType.getSubtype().endsWith("+json");
    }

    private HttpStatus resolveStatus(ServerHttpResponse response) {
        HttpStatus status = response instanceof ServletServerHttpResponse
                ? HttpStatus.resolve(((ServletServerHttpResponse) response).getServletResponse().getStatus())
                : null;
        if (status == null || !status.isError()) {
            status = HttpStatus.BAD_REQUEST;
            response.setStatusCode(status);
        }
        return status;
    }
}
