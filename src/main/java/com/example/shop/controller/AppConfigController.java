package com.example.shop.controller;

import com.example.shop.dto.AppConfigResponse;
import com.example.shop.service.PaymentService;
import com.example.shop.service.RuntimeConfigService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;

@RestController
@RequestMapping("/app")
public class AppConfigController {
    private final PaymentService paymentService;
    private final RuntimeConfigService runtimeConfig;

    public AppConfigController(PaymentService paymentService, RuntimeConfigService runtimeConfig) {
        this.paymentService = paymentService;
        this.runtimeConfig = runtimeConfig;
    }

    @GetMapping("/config")
    public AppConfigResponse config() {
        String runtimeMode = runtimeConfig.getString("app.runtime-mode", "production");
        String mode = runtimeMode == null || runtimeMode.trim().isEmpty()
                ? "production"
                : runtimeMode.trim().toLowerCase();
        return new AppConfigResponse(
                mode,
                paymentService.isPaymentSimulationEnabled(),
                positiveMoney(runtimeConfig.getBigDecimal("order.default-shipping-fee", new BigDecimal("30.00"))),
                positiveMoney(runtimeConfig.getBigDecimal("order.free-shipping-threshold", new BigDecimal("899.00")))
        );
    }

    private BigDecimal positiveMoney(BigDecimal value) {
        return value == null || value.compareTo(BigDecimal.ZERO) < 0 ? BigDecimal.ZERO : value;
    }
}
