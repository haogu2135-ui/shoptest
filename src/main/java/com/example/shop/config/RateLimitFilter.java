package com.example.shop.config;

import com.example.shop.service.RateLimitService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Map;

@Component
public class RateLimitFilter extends OncePerRequestFilter {
    public static final String LIMIT_HEADER = "X-RateLimit-Limit";
    public static final String REMAINING_HEADER = "X-RateLimit-Remaining";
    public static final String RESET_HEADER = "X-RateLimit-Reset";

    private final RateLimitService rateLimitService;
    private final ApiErrorResponseFactory errorResponseFactory;
    private final ObjectMapper objectMapper;

    public RateLimitFilter(RateLimitService rateLimitService, ApiErrorResponseFactory errorResponseFactory, ObjectMapper objectMapper) {
        this.rateLimitService = rateLimitService;
        this.errorResponseFactory = errorResponseFactory;
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain) throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        RateLimitService.Decision decision = rateLimitService.check(request, authentication);
        response.setHeader(LIMIT_HEADER, String.valueOf(decision.getLimit()));
        response.setHeader(REMAINING_HEADER, String.valueOf(decision.getRemaining()));
        response.setHeader(RESET_HEADER, String.valueOf(decision.getResetAtEpochSeconds()));

        if (decision.isAllowed()) {
            filterChain.doFilter(request, response);
            return;
        }

        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setHeader("Retry-After", String.valueOf(decision.getRetryAfterSeconds()));
        response.setContentType("application/json;charset=UTF-8");
        Map<String, Object> payload = errorResponseFactory.buildPayload(HttpStatus.TOO_MANY_REQUESTS, "Too many requests, please retry later", request);
        payload.put("retryAfterSeconds", decision.getRetryAfterSeconds());
        objectMapper.writeValue(response.getWriter(), payload);
    }
}
