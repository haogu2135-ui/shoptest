package com.example.shop.controller;

import com.example.shop.service.PaymentService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/app")
public class AppConfigController {
    private final PaymentService paymentService;

    @Value("${app.runtime-mode:production}")
    private String runtimeMode;

    public AppConfigController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @GetMapping("/config")
    public Map<String, Object> config() {
        String mode = runtimeMode == null || runtimeMode.trim().isEmpty()
                ? "production"
                : runtimeMode.trim().toLowerCase();
        return Map.of(
                "runtimeMode", mode,
                "paymentSimulationEnabled", paymentService.isPaymentSimulationEnabled()
        );
    }
}
