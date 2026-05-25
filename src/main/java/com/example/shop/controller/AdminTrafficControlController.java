package com.example.shop.controller;

import com.example.shop.dto.TrafficCircuitResetRequest;
import com.example.shop.dto.TrafficControlStatusResponse;
import com.example.shop.service.CircuitBreakerService;
import com.example.shop.service.RateLimitService;
import com.example.shop.service.SecurityAuditLogService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/admin/traffic-control")
public class AdminTrafficControlController {
    private final RateLimitService rateLimitService;
    private final CircuitBreakerService circuitBreakerService;
    private final SecurityAuditLogService auditLogService;

    public AdminTrafficControlController(RateLimitService rateLimitService,
                                         CircuitBreakerService circuitBreakerService,
                                         SecurityAuditLogService auditLogService) {
        this.rateLimitService = rateLimitService;
        this.circuitBreakerService = circuitBreakerService;
        this.auditLogService = auditLogService;
    }

    @GetMapping
    public TrafficControlStatusResponse status() {
        TrafficControlStatusResponse response = new TrafficControlStatusResponse();
        response.setRateLimit(rateLimitService.status());
        response.setCircuitBreakerConfig(circuitBreakerService.configStatus());
        response.setCircuits(circuitBreakerService.status());
        return response;
    }

    @PostMapping("/rate-limit/clear")
    public TrafficControlStatusResponse clearRateLimit(Authentication authentication, HttpServletRequest request) {
        rateLimitService.clear();
        auditLogService.record("TRAFFIC_RATE_LIMIT_CLEAR", "SUCCESS", authentication, "TRAFFIC_CONTROL", "rate-limit", request,
                "Rate limit counters cleared", "");
        return status();
    }

    @PostMapping("/circuit-breakers/reset")
    public TrafficControlStatusResponse resetCircuit(@RequestBody(required = false) TrafficCircuitResetRequest body,
                                                     Authentication authentication,
                                                     HttpServletRequest request) {
        String name = body == null ? null : body.getName();
        String auditName = name == null || name.isBlank() ? "all" : circuitBreakerService.normalizeName(name);
        circuitBreakerService.reset(name);
        auditLogService.record("TRAFFIC_CIRCUIT_RESET", "SUCCESS", authentication, "TRAFFIC_CONTROL", auditName, request,
                "Circuit breaker reset", "name=" + auditName);
        return status();
    }
}
