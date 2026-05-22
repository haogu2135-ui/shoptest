package com.example.shop.service;

import com.example.shop.config.MailAccountProperties;
import com.example.shop.service.EmailLoginService.EmailLoginException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class EmailLoginServiceTest {
    private UserService userService;
    private EmailLoginService service;

    @BeforeEach
    void setUp() {
        userService = mock(UserService.class);
        @SuppressWarnings("unchecked")
        ObjectProvider<StringRedisTemplate> redisTemplateProvider = mock(ObjectProvider.class);
        when(redisTemplateProvider.getIfAvailable()).thenReturn(null);
        service = new EmailLoginService(userService, mailProperties(), redisTemplateProvider);
    }

    @Test
    void sendLoginCodeRateLimitsRepeatedUnknownEmailWithoutRevealingAccountStatus() {
        when(userService.findByUsernameOrPhoneOrEmail("missing@example.com")).thenReturn(null);

        service.sendLoginCode(" Missing@Example.COM ", "203.0.113.10");
        EmailLoginException exception = assertThrows(EmailLoginException.class,
                () -> service.sendLoginCode("missing@example.com", "203.0.113.10"));

        assertEquals("RATE_LIMITED", exception.getCode());
        assertEquals(10, exception.getRetryAfterSeconds());
    }

    @Test
    void verifyLoginCodeRejectsMalformedCodeAsInvalidCode() {
        EmailLoginException exception = assertThrows(EmailLoginException.class,
                () -> service.verifyLoginCode("user@example.com", "12x", "203.0.113.11"));

        assertEquals("INVALID_CODE", exception.getCode());
        assertEquals(0, exception.getRetryAfterSeconds());
    }

    @Test
    void verifyLoginCodeRateLimitsRepeatedFailuresByEmailAndClient() {
        assertThrows(EmailLoginException.class,
                () -> service.verifyLoginCode("user@example.com", "000000", "203.0.113.12"));
        assertThrows(EmailLoginException.class,
                () -> service.verifyLoginCode("user@example.com", "111111", "203.0.113.12"));

        EmailLoginException exception = assertThrows(EmailLoginException.class,
                () -> service.verifyLoginCode("user@example.com", "222222", "203.0.113.12"));

        assertEquals("TOO_MANY_ATTEMPTS", exception.getCode());
        assertEquals(60, exception.getRetryAfterSeconds());
    }

    private MailAccountProperties mailProperties() {
        MailAccountProperties properties = new MailAccountProperties();
        properties.setResendIntervalSeconds(10);
        properties.setSendWindowMinutes(1);
        properties.setMaxSendAttemptsPerWindow(2);
        properties.setVerifyWindowMinutes(1);
        properties.setMaxVerifyFailuresPerWindow(2);

        MailAccountProperties.Account account = new MailAccountProperties.Account();
        account.setHost("smtp.example.com");
        account.setPort(465);
        account.setUsername("no-reply@example.com");
        account.setPassword("mail-password");
        account.setFrom("no-reply@example.com");
        account.setSsl(true);
        account.setStarttls(false);
        properties.setAccounts(List.of(account));
        return properties;
    }
}
