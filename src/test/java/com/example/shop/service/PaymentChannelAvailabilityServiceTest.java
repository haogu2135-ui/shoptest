package com.example.shop.service;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class PaymentChannelAvailabilityServiceTest {
    private static final Path SOURCE = Path.of("src/main/java/com/example/shop/service/PaymentChannelAvailabilityService.java");

    @Test
    void paymentChannelAvailabilityKeepsProductionReadinessGates() throws Exception {
        String source = Files.readString(SOURCE, StandardCharsets.UTF_8);

        assertTrue(source.contains("PaymentChannelConfig.Channel requireAvailableForCheckout(String channel)"));
        assertTrue(source.contains("paymentChannelConfig.requireEnabled(channel)"));
        assertTrue(source.contains("throw new IllegalStateException(\"Payment channel is not configured for checkout\")"));
        assertTrue(source.contains("if (!isProductionMode())"));
        assertTrue(source.contains("return true;"));
        assertTrue(source.contains("runtimeConfig.getString(\"app.runtime-mode\", \"production\")"));
        assertTrue(source.contains("\"production\".equals(mode) || \"prod\".equals(mode)"));
    }

    @Test
    void paymentChannelAvailabilityRejectsIncompleteOrUnsafeGatewayUrlsInProduction() throws Exception {
        String source = Files.readString(SOURCE, StandardCharsets.UTF_8);

        assertTrue(source.contains("channelConfig.isStripeProvider()"));
        assertTrue(source.contains("!isBlank(stripeSecretKey())"));
        assertTrue(source.contains("!isBlank(stripeWebhookSecret())"));
        assertTrue(source.contains("isProductionGatewayUrl(stripeSuccessUrl())"));
        assertTrue(source.contains("isProductionGatewayUrl(stripeCancelUrl())"));
        assertTrue(source.contains("channelConfig.isGenericApiProvider()"));
        assertTrue(source.contains("isProductionGatewayUrl(channelConfig.getCreateUrl())"));
        assertTrue(source.contains("!\"GENERIC_API\".equals(channelConfig.getRefundMode())"));
        assertTrue(source.contains("isProductionGatewayUrl(channelConfig.getRefundUrl())"));
        assertTrue(source.contains("GatewayUrlValidator.isLocalOrPrivateHost(host)"));
        assertTrue(source.contains("containsPlaceholderGatewayHost(configuredUrl)"));
    }
}
