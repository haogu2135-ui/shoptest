package com.example.shop.service;

import com.example.shop.config.MailAccountProperties;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OrderEmailNotificationServiceTest {
    @Test
    void trySendOrderStatusEmailReturnsFalseWhenNoMailAccountsAreConfigured() {
        MailAccountProperties properties = new MailAccountProperties();
        properties.setAccounts(List.of());
        OrderEmailNotificationService service = new OrderEmailNotificationService(properties);

        assertEquals(false, service.trySendOrderStatusEmail("customer@example.com", "Order shipped", "Your order shipped."));
    }

    @Test
    void trySendOrderStatusEmailRejectsMalformedEmailBeforeUsingMailAccount() {
        MailAccountProperties properties = new MailAccountProperties();
        MailAccountProperties.Account account = new MailAccountProperties.Account();
        account.setHost("smtp.example.com");
        account.setPort(465);
        account.setUsername("no-reply@example.com");
        account.setPassword("mail-password");
        account.setFrom("no-reply@example.com");
        properties.setAccounts(List.of(account));
        OrderEmailNotificationService service = new OrderEmailNotificationService(properties);

        assertEquals(false, service.trySendOrderStatusEmail("not-an-email", "Order shipped", "Your order shipped."));
    }

    @Test
    void renderHtmlBuildsCommercialTemplateWithEscapedContentAndStorefrontCtas() {
        MailAccountProperties properties = new MailAccountProperties();
        properties.setBrandName("ShopMX");
        OrderEmailNotificationService service = new OrderEmailNotificationService(properties);
        ReflectionTestUtils.setField(service, "storefrontBaseUrlConfig", "https://shop.example.com/");

        String html = service.renderHtml(
                "ShopMX",
                "Order <shipped>",
                "Tracking for order A&B is ready.\nOpen your account.");

        assertTrue(html.contains("<!doctype html>"));
        assertTrue(html.contains("UTF-8"));
        assertTrue(html.contains("viewport"));
        assertTrue(html.contains("ShopMX"));
        assertTrue(html.contains("Order &lt;shipped&gt;"));
        assertTrue(html.contains("A&amp;B"));
        assertTrue(html.contains("<br/>"));
        assertTrue(html.contains("https://shop.example.com/profile?tab=orders"));
        assertTrue(html.contains("https://shop.example.com/track-order"));
        assertTrue(html.contains("View my orders"));
        assertTrue(html.contains("Track order"));
        assertFalse(html.contains("Order <shipped>"));
        assertFalse(html.contains("A&B is ready"));
    }

    @Test
    void sourceUsesMultipartMimeMessageHelperForHtmlAlternativeBodies() throws Exception {
        String source = Files.readString(
                Path.of("src/main/java/com/example/shop/service/OrderEmailNotificationService.java"),
                StandardCharsets.UTF_8);
        String loginSource = Files.readString(
                Path.of("src/main/java/com/example/shop/service/EmailLoginService.java"),
                StandardCharsets.UTF_8);
        assertTrue(source.contains("new MimeMessageHelper(message, true, \"UTF-8\")"));
        assertTrue(loginSource.contains("new MimeMessageHelper(message, true, \"UTF-8\")"));
        assertFalse(source.contains("new MimeMessageHelper(message, \"UTF-8\")"));
    }

    @Test
    void renderHtmlLocalizesCtasForChineseAndSpanishBodies() {
        OrderEmailNotificationService service = new OrderEmailNotificationService(new MailAccountProperties());
        ReflectionTestUtils.setField(service, "storefrontBaseUrlConfig", "https://shop.example.com");

        String zh = service.renderHtml("ShopMX", "订单已发货", "订单 SO1 已发货。");
        assertTrue(zh.contains("查看我的订单"));
        assertTrue(zh.contains("物流查询"));
        assertTrue(zh.contains("lang=\"zh-CN\""));

        String es = service.renderHtml("ShopMX", "Pedido enviado", "El pedido SO1 ha sido enviado.");
        assertTrue(es.contains("Ver mis pedidos"));
        assertTrue(es.contains("Rastrear pedido"));
        assertTrue(es.contains("lang=\"es-MX\""));
    }
}
