package com.example.shop.controller;

import com.example.shop.dto.AppConfigResponse;
import com.example.shop.service.PaymentService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;

@RestController
@RequestMapping("/app")
public class AppConfigController {
    private final PaymentService paymentService;

    @Value("${app.runtime-mode:production}")
    private String runtimeMode;

    @Value("${order.default-shipping-fee:30.00}")
    private BigDecimal defaultShippingFee;

    @Value("${order.free-shipping-threshold:899.00}")
    private BigDecimal freeShippingThreshold;

    public AppConfigController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @GetMapping("/config")
    public AppConfigResponse config() {
        String mode = runtimeMode == null || runtimeMode.trim().isEmpty()
                ? "production"
                : runtimeMode.trim().toLowerCase();
        return new AppConfigResponse(
                mode,
                paymentService.isPaymentSimulationEnabled(),
                positiveMoney(defaultShippingFee),
                positiveMoney(freeShippingThreshold)
        );
    }

    private BigDecimal positiveMoney(BigDecimal value) {
        return value == null || value.compareTo(BigDecimal.ZERO) < 0 ? BigDecimal.ZERO : value;
    }
}
