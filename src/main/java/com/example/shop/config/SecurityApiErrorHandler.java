package com.example.shop.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class SecurityApiErrorHandler implements AuthenticationEntryPoint, AccessDeniedHandler {
    private final ApiErrorResponseFactory errorResponses;
    private final ObjectMapper objectMapper;

    @Override
    public void commence(
            HttpServletRequest request,
            HttpServletResponse response,
            AuthenticationException authException
    ) throws IOException {
        writeError(response, HttpStatus.UNAUTHORIZED, "Unauthorized", request);
    }

    @Override
    public void handle(
            HttpServletRequest request,
            HttpServletResponse response,
            AccessDeniedException accessDeniedException
    ) throws IOException {
        writeError(response, HttpStatus.FORBIDDEN, "Forbidden", request);
    }

    private void writeError(
            HttpServletResponse response,
            HttpStatus status,
            String message,
            HttpServletRequest request
    ) throws IOException {
        if (response.isCommitted()) {
            return;
        }
        Map<String, Object> payload = errorResponses.buildPayload(status, message, request);
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.setHeader(RequestCorrelationFilter.REQUEST_ID_HEADER, String.valueOf(payload.get("requestId")));
        objectMapper.writeValue(response.getWriter(), payload);
    }
}
