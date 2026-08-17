package com.example.shop.service;

import com.example.shop.entity.Order;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PaymentReturnUrlContractTest {

    @Test
    void guestCancelAndSuccessUrlsTargetTrackOrderWithoutGuestPii() {
        PaymentService service = new PaymentService();
        RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
        when(runtimeConfig.getString("app.storefront-base-url", "https://petsanything.com"))
                .thenReturn("https://shop.example.com/");
        ReflectionTestUtils.setField(service, "runtimeConfig", runtimeConfig);

        Order guestOrder = new Order();
        guestOrder.setId(42L);
        guestOrder.setOrderNo("SO-GUEST-1");
        guestOrder.setGuestOrder(true);
        guestOrder.setContactEmail("Buyer@Example.com");

        String cancelUrl = ReflectionTestUtils.invokeMethod(
                service,
                "contextualPaymentCancelUrl",
                guestOrder);
        String successUrl = ReflectionTestUtils.invokeMethod(
                service,
                "contextualPaymentSuccessUrl",
                guestOrder);

        assertTrue(cancelUrl.startsWith("https://shop.example.com/track-order?"));
        assertTrue(cancelUrl.contains("orderNo=SO-GUEST-1"));
        assertFalse(cancelUrl.contains("guestEmail="));
        assertFalse(cancelUrl.contains("buyer%40example.com"));
        assertFalse(cancelUrl.contains("buyer@example.com"));
        assertTrue(cancelUrl.contains("payment=cancelled"));
        assertFalse(cancelUrl.contains("/profile"));
        assertFalse(cancelUrl.contains("orderId="));

        assertTrue(successUrl.startsWith("https://shop.example.com/track-order?"));
        assertTrue(successUrl.contains("orderNo=SO-GUEST-1"));
        assertFalse(successUrl.contains("guestEmail="));
        assertFalse(successUrl.contains("buyer%40example.com"));
        assertFalse(successUrl.contains("buyer@example.com"));
        assertTrue(successUrl.contains("payment=success"));
    }

    @Test
    void registeredCancelUrlTargetsProfileOrdersWithOrderContext() {
        PaymentService service = new PaymentService();
        RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
        when(runtimeConfig.getString("app.storefront-base-url", "https://petsanything.com"))
                .thenReturn("https://shop.example.com");
        when(runtimeConfig.getString("payment.cancel-url", ""))
                .thenReturn("");
        ReflectionTestUtils.setField(service, "runtimeConfig", runtimeConfig);

        Order order = new Order();
        order.setId(7L);
        order.setOrderNo("SO-REG-7");
        order.setGuestOrder(false);

        String cancelUrl = ReflectionTestUtils.invokeMethod(
                service,
                "contextualPaymentCancelUrl",
                order);

        assertTrue(cancelUrl.contains("https://shop.example.com/profile"));
        assertTrue(cancelUrl.contains("orderNo=SO-REG-7"));
        assertTrue(cancelUrl.contains("orderId=7"));
        assertTrue(cancelUrl.contains("tab=orders"));
        assertTrue(cancelUrl.contains("payment=cancelled"));
        assertFalse(cancelUrl.contains("guestEmail="));
        assertFalse(cancelUrl.contains("/track-order"));
    }

    @Test
    void sourceKeepsGuestPiiOutOfPaymentReturnUrls() throws Exception {
        String source = java.nio.file.Files.readString(
                java.nio.file.Path.of("src/main/java/com/example/shop/service/PaymentService.java"));
        assertFalse(source.contains("appendQueryParam(url, \"guestEmail\""));
        assertFalse(source.contains("appendQueryParam(url, \"email\""));
        assertTrue(source.contains("appendQueryParam(url, \"tab\", \"orders\")"));
        assertTrue(source.contains("appendQueryParam(url, \"orderId\", String.valueOf(order.getId()))"));
    }
}
