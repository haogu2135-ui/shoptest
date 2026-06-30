package com.example.shop.service;

import com.example.shop.config.MailAccountProperties;
import com.example.shop.entity.User;
import com.example.shop.service.EmailLoginService.EmailLoginException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.time.Duration;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class EmailLoginServiceTest {
    private UserService userService;
    private TestEmailLoginService service;

    @BeforeEach
    void setUp() {
        userService = mock(UserService.class);
        service = new TestEmailLoginService(userService, mailProperties(), noRedisProvider());
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
    void sendLoginCodePadsUnknownAccountResponse() {
        when(userService.findByUsernameOrPhoneOrEmail("missing@example.com")).thenReturn(null);

        service.sendLoginCode("missing@example.com", "203.0.113.15");

        assertTrue(service.getPaddingCalls() > 0);
    }

    @Test
    void sendLoginCodeTreatsLegacyNullStatusAccountAsDisabled() {
        User user = new User();
        user.setEmail("legacy@example.com");
        user.setStatus(null);
        when(userService.findByUsernameOrPhoneOrEmail("legacy@example.com")).thenReturn(user);

        service.sendLoginCode("legacy@example.com", "203.0.113.19");

        assertTrue(service.getPaddingCalls() > 0);
    }

    @Test
    void sendPasswordResetCodePadsUnknownAccountResponse() {
        when(userService.findByUsernameOrPhoneOrEmail("missing@example.com")).thenReturn(null);

        service.sendPasswordResetCode("missing@example.com", "203.0.113.16");

        assertTrue(service.getPaddingCalls() > 0);
    }

    @Test
    void inMemorySendRateBucketsFailClosedWhenCapacityIsFull() {
        MailAccountProperties properties = mailProperties();
        properties.setMaxRateBuckets(2);
        TestEmailLoginService limitedService = new TestEmailLoginService(userService, properties, noRedisProvider());
        when(userService.findByUsernameOrPhoneOrEmail("first@example.com")).thenReturn(null);

        limitedService.sendLoginCode("first@example.com", "203.0.113.17");
        EmailLoginException exception = assertThrows(EmailLoginException.class,
                () -> limitedService.sendLoginCode("second@example.com", "203.0.113.17"));

        assertEquals("RATE_LIMITED", exception.getCode());
        assertTrue(exception.getRetryAfterSeconds() > 0);
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

    @Test
    void sendProfileEmailChangeCodeRejectsAnotherUsersEmailBeforeMailSend() {
        User existing = new User();
        existing.setId(8L);
        when(userService.findByUsernameOrPhoneOrEmail("taken@example.com")).thenReturn(existing);

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class,
                () -> service.sendProfileEmailChangeCode(5L, " Taken@Example.COM ", "203.0.113.13"));

        assertEquals("Email already registered", exception.getMessage());
    }

    @Test
    void verifyProfileEmailChangeCodeDoesNotAcceptLoginCodeForSameEmail() throws Exception {
        seedVerificationCode("new@example.com", "new@example.com", "123456");

        EmailLoginException exception = assertThrows(EmailLoginException.class,
                () -> service.verifyProfileEmailChangeCode(5L, "new@example.com", "123456", "203.0.113.14"));

        assertEquals("INVALID_CODE", exception.getCode());
    }

    @Test
    void emailHtmlEscapesTemplateValues() throws Exception {
        service = new TestEmailLoginService(userService, mailProperties("<img src=x onerror=alert(1)>"), noRedisProvider());
        Method renderEmailHtml = EmailLoginService.class.getDeclaredMethod("renderEmailHtml", String.class, String.class);
        renderEmailHtml.setAccessible(true);

        String html = (String) renderEmailHtml.invoke(service, "12<456", "<script>alert(1)</script>");

        assertTrue(html.contains("&lt;img src=x onerror=alert(1)&gt;"));
        assertTrue(html.contains("&lt;script&gt;alert(1)&lt;/script&gt;"));
        assertTrue(html.contains("12&lt;456"));
        assertFalse(html.contains("<script>alert(1)</script>"));
        assertFalse(html.contains("12<456"));
    }

    @Test
    void verificationCodeHashUsesSha512AndAcceptsLegacySha256Hashes() throws Exception {
        Method hashCode = EmailLoginService.class.getDeclaredMethod("hashCode", String.class, String.class);
        Method digestCode = EmailLoginService.class.getDeclaredMethod("digestCode", String.class, String.class, String.class);
        hashCode.setAccessible(true);
        digestCode.setAccessible(true);

        String sha512 = (String) hashCode.invoke(service, "user@example.com", "123456");
        String resetPurposeKey = "password-reset:reset@example.com";
        String legacySha256 = (String) digestCode.invoke(service, "SHA-256", resetPurposeKey, "654321");

        assertEquals(128, sha512.length());
        assertEquals(64, legacySha256.length());
        seedVerificationCode(resetPurposeKey, legacySha256);
        User user = new User();
        user.setEmail("reset@example.com");
        user.setStatus("ACTIVE");
        when(userService.findByUsernameOrPhoneOrEmail("reset@example.com")).thenReturn(user);

        User verifiedUser = service.verifyPasswordResetCode("reset@example.com", "654321", "203.0.113.18");

        assertEquals("reset@example.com", verifiedUser.getEmail());
    }

    @Test
    void passwordResetCodeCannotBeReusedAfterSuccessfulVerification() throws Exception {
        String resetPurposeKey = "password-reset:once@example.com";
        seedVerificationCode(resetPurposeKey, resetPurposeKey, "777888");
        User user = new User();
        user.setEmail("once@example.com");
        user.setStatus("ACTIVE");
        when(userService.findByUsernameOrPhoneOrEmail("once@example.com")).thenReturn(user);

        User verifiedUser = service.verifyPasswordResetCode("once@example.com", "777888", "203.0.113.31");
        EmailLoginException replayFailure = assertThrows(
                EmailLoginException.class,
                () -> service.verifyPasswordResetCode("once@example.com", "777888", "203.0.113.31"));

        assertEquals("once@example.com", verifiedUser.getEmail());
        assertEquals("INVALID_CODE", replayFailure.getCode());
    }

    private MailAccountProperties mailProperties() {
        return mailProperties("ShopMX");
    }

    private MailAccountProperties mailProperties(String brandName) {
        MailAccountProperties properties = new MailAccountProperties();
        properties.setBrandName(brandName);
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

    @SuppressWarnings("unchecked")
    private ObjectProvider<StringRedisTemplate> noRedisProvider() {
        ObjectProvider<StringRedisTemplate> redisTemplateProvider = mock(ObjectProvider.class);
        when(redisTemplateProvider.getIfAvailable()).thenReturn(null);
        return redisTemplateProvider;
    }

    @SuppressWarnings("unchecked")
    private void seedVerificationCode(String storeKey, String hashKey, String code) throws Exception {
        Method hashCode = EmailLoginService.class.getDeclaredMethod("hashCode", String.class, String.class);
        hashCode.setAccessible(true);
        seedVerificationCode(storeKey, (String) hashCode.invoke(service, hashKey, code));
    }

    @SuppressWarnings("unchecked")
    private void seedVerificationCode(String storeKey, String codeHash) throws Exception {
        Field codesField = EmailLoginService.class.getDeclaredField("codes");
        codesField.setAccessible(true);
        Map<String, Object> codes = (Map<String, Object>) codesField.get(service);
        java.lang.reflect.Constructor<?> constructor = Class
                .forName("com.example.shop.service.EmailLoginService$VerificationCode")
                .getDeclaredConstructor(String.class, java.time.Instant.class, java.time.Instant.class);
        constructor.setAccessible(true);
        Object verificationCode = constructor.newInstance(
                codeHash,
                java.time.Instant.now().plusSeconds(60),
                java.time.Instant.now());
        codes.put(storeKey, verificationCode);
    }

    private static class TestEmailLoginService extends EmailLoginService {
        private int paddingCalls;

        TestEmailLoginService(UserService userService,
                              MailAccountProperties mailAccountProperties,
                              ObjectProvider<StringRedisTemplate> redisTemplateProvider) {
            super(userService, mailAccountProperties, redisTemplateProvider);
        }

        @Override
        protected void sleepForPadding(Duration duration) {
            paddingCalls++;
        }

        int getPaddingCalls() {
            return paddingCalls;
        }
    }
}
