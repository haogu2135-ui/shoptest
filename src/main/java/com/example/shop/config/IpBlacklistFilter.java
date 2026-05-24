package com.example.shop.config;

import com.example.shop.entity.IpBlacklistEntry;
import com.example.shop.service.IpBlacklistService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Map;
import java.util.Optional;

@Component
public class IpBlacklistFilter extends OncePerRequestFilter {
    private final IpBlacklistService ipBlacklistService;
    private final ApiErrorResponseFactory errorResponseFactory;
    private final ObjectMapper objectMapper;

    public IpBlacklistFilter(IpBlacklistService ipBlacklistService,
                             ApiErrorResponseFactory errorResponseFactory,
                             ObjectMapper objectMapper) {
        this.ipBlacklistService = ipBlacklistService;
        this.errorResponseFactory = errorResponseFactory;
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain) throws ServletException, IOException {
        if (!ipBlacklistService.shouldCheckPath(request)) {
            filterChain.doFilter(request, response);
            return;
        }
        String ipAddress = ipBlacklistService.resolveClientIp(request);
        Optional<IpBlacklistEntry> blocked = ipBlacklistService.findBlockingEntry(ipAddress);
        if (blocked.isEmpty()) {
            filterChain.doFilter(request, response);
            return;
        }
        response.setStatus(HttpStatus.FORBIDDEN.value());
        response.setContentType("application/json;charset=UTF-8");
        Map<String, Object> payload = errorResponseFactory.buildPayload(HttpStatus.FORBIDDEN, "IP address is temporarily blocked", request);
        payload.put("ipAddress", ipAddress);
        payload.put("blockedUntil", blocked.get().getBlockedUntil() == null ? null : blocked.get().getBlockedUntil().toString());
        objectMapper.writeValue(response.getWriter(), payload);
    }
}
