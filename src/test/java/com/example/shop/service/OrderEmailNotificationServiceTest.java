package com.example.shop.service;

import com.example.shop.config.MailAccountProperties;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

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
}
