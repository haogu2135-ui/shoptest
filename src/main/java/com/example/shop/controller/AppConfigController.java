package com.example.shop.controller;

import com.example.shop.config.MailAccountProperties;
import com.example.shop.dto.AppConfigResponse;
import com.example.shop.service.RuntimeConfigService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;

@RestController
@RequestMapping("/app")
public class AppConfigController {
    private final RuntimeConfigService runtimeConfig;
    private final MailAccountProperties mailAccountProperties;

    public AppConfigController(RuntimeConfigService runtimeConfig, MailAccountProperties mailAccountProperties) {
        this.runtimeConfig = runtimeConfig;
        this.mailAccountProperties = mailAccountProperties;
    }

    @GetMapping("/config")
    public AppConfigResponse config() {
        return new AppConfigResponse(
                mailAccountProperties.hasConfiguredAccount(),
                positiveMoney(runtimeConfig.getBigDecimal("order.default-shipping-fee", new BigDecimal("30.00"))),
                positiveMoney(runtimeConfig.getBigDecimal("order.free-shipping-threshold", new BigDecimal("899.00")))
        );
    }

    private BigDecimal positiveMoney(BigDecimal value) {
        return value == null || value.compareTo(BigDecimal.ZERO) < 0 ? BigDecimal.ZERO : value;
    }
}
