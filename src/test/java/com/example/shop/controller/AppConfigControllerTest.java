package com.example.shop.controller;

import com.example.shop.config.MailAccountProperties;
import com.example.shop.dto.AppConfigResponse;
import com.example.shop.service.RuntimeConfigService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AppConfigControllerTest {

    @Test
    void publicAppConfigOmitsRuntimeBuildAndSimulationState() throws Exception {
        RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
        MailAccountProperties mailAccountProperties = new MailAccountProperties();
        when(runtimeConfig.getBigDecimal("order.default-shipping-fee", new BigDecimal("30.00")))
                .thenReturn(new BigDecimal("12.34"));
        when(runtimeConfig.getBigDecimal("order.free-shipping-threshold", new BigDecimal("899.00")))
                .thenReturn(new BigDecimal("250.00"));
        AppConfigController controller = new AppConfigController(runtimeConfig, mailAccountProperties);

        AppConfigResponse response = controller.config();
        String json = new ObjectMapper().writeValueAsString(response);

        assertTrue(json.contains("emailCodeEnabled"));
        assertTrue(json.contains("defaultShippingFee"));
        assertTrue(json.contains("freeShippingThreshold"));
        assertFalse(json.contains("runtimeMode"));
        assertFalse(json.contains("paymentSimulationEnabled"));
        assertFalse(json.contains("buildTime"));
        assertFalse(json.contains("mobileVersionCode"));
        assertFalse(json.contains("mobileVersionName"));
        assertFalse(json.contains("appId"));
        verify(runtimeConfig, never()).getString("app.runtime-mode", "production");
        verify(runtimeConfig, never()).getString("payment.simulation-enabled", "");
    }
}
