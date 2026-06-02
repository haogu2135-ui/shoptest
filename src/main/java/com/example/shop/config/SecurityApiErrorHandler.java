package com.example.shop.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

@Component
public class SecurityApiErrorHandler implements AuthenticationEntryPoint, AccessDeniedHandler {
    private final ApiErrorResponseFactory errorResponses;
    private final ObjectMapper objectMapper;
    private final RequestMappingHandlerMapping requestMappingHandlerMapping;
    private final AntPathMatcher pathMatcher = new AntPathMatcher();

    @Autowired
    public SecurityApiErrorHandler(
            ApiErrorResponseFactory errorResponses,
            ObjectMapper objectMapper,
            @Qualifier("requestMappingHandlerMapping") RequestMappingHandlerMapping requestMappingHandlerMapping
    ) {
        this.errorResponses = errorResponses;
        this.objectMapper = objectMapper;
        this.requestMappingHandlerMapping = requestMappingHandlerMapping;
    }

    public SecurityApiErrorHandler(ApiErrorResponseFactory errorResponses, ObjectMapper objectMapper) {
        this.errorResponses = errorResponses;
        this.objectMapper = objectMapper;
        this.requestMappingHandlerMapping = null;
    }

    @Override
    public void commence(
            HttpServletRequest request,
            HttpServletResponse response,
            AuthenticationException authException
    ) throws IOException {
        if (controllerHandlerMissing(request)) {
            writeError(response, HttpStatus.NOT_FOUND, "Not Found", request);
            return;
        }
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

    private boolean controllerHandlerMissing(HttpServletRequest request) {
        if (requestMappingHandlerMapping == null) {
            return false;
        }
        String path = servletPath(request);
        String method = request.getMethod();
        return requestMappingHandlerMapping.getHandlerMethods().keySet().stream()
                .noneMatch(mapping -> pathMatches(mapping, path) && methodMatches(mapping, method));
    }

    private String servletPath(HttpServletRequest request) {
        String uri = request.getRequestURI();
        String contextPath = request.getContextPath();
        if (contextPath != null && !contextPath.isBlank() && uri.startsWith(contextPath)) {
            uri = uri.substring(contextPath.length());
        }
        return uri == null || uri.isBlank() ? "/" : uri;
    }

    private boolean pathMatches(RequestMappingInfo mapping, String path) {
        Set<String> patterns = new LinkedHashSet<>();
        if (mapping.getPatternsCondition() != null) {
            patterns.addAll(mapping.getPatternsCondition().getPatterns());
        }
        if (mapping.getPathPatternsCondition() != null) {
            patterns.addAll(mapping.getPathPatternsCondition().getPatternValues());
        }
        return patterns.stream().anyMatch(pattern -> pathMatcher.match(pattern, path));
    }

    private boolean methodMatches(RequestMappingInfo mapping, String method) {
        Set<RequestMethod> methods = mapping.getMethodsCondition().getMethods();
        return methods.isEmpty() || methods.stream().anyMatch(requestMethod -> requestMethod.name().equalsIgnoreCase(method));
    }
}
