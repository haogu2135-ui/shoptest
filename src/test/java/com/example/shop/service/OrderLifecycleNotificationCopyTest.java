package com.example.shop.service;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.i18n.LocaleContextHolder;

import java.util.Locale;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OrderLifecycleNotificationCopyTest {

    @AfterEach
    void clearLocale() {
        LocaleContextHolder.resetLocaleContext();
    }

    @Test
    void englishPaymentAndShipCopyStayContractStable() {
        OrderLifecycleNotificationCopy.Notice paid = OrderLifecycleNotificationCopy.paymentReceived(
                Locale.ENGLISH, "SO202605260001", "88.00");
        assertEquals("Payment received", paid.getTitle());
        assertTrue(paid.getMessage().contains("SO202605260001"));
        assertTrue(paid.getMessage().contains("Amount: 88.00."));

        OrderLifecycleNotificationCopy.Notice shipped = OrderLifecycleNotificationCopy.orderShipped(
                Locale.ENGLISH, "SO202605260001", "TRACK123", "DHL Express");
        assertEquals("Order shipped", shipped.getTitle());
        assertTrue(shipped.getMessage().contains("via DHL Express"));
        assertTrue(shipped.getMessage().contains("TRACK123"));
    }

    @Test
    void chineseAndSpanishShipCopyAreLocalized() {
        OrderLifecycleNotificationCopy.Notice zh = OrderLifecycleNotificationCopy.orderShipped(
                Locale.SIMPLIFIED_CHINESE, "SO1", "T1", "顺丰");
        assertEquals("订单已发货", zh.getTitle());
        assertTrue(zh.getMessage().contains("承运商 顺丰"));
        assertTrue(zh.getMessage().contains("运单号：T1"));

        OrderLifecycleNotificationCopy.Notice es = OrderLifecycleNotificationCopy.orderRefunded(
                new Locale("es"), "SO9");
        assertEquals("Pedido reembolsado", es.getTitle());
        assertTrue(es.getMessage().contains("SO9"));
    }

    @Test
    void resolveLocaleReadsLocaleContextHolder() {
        LocaleContextHolder.setLocale(Locale.SIMPLIFIED_CHINESE);
        assertEquals(Locale.SIMPLIFIED_CHINESE, OrderLifecycleNotificationCopy.resolveLocale());

        LocaleContextHolder.setLocale(new Locale("es", "MX"));
        assertEquals("es", OrderLifecycleNotificationCopy.resolveLocale().getLanguage());

        LocaleContextHolder.resetLocaleContext();
        assertEquals(Locale.ENGLISH, OrderLifecycleNotificationCopy.resolveLocale());
    }
}
