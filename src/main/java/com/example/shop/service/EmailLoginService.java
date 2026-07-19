package com.example.shop.service;

import com.example.shop.config.MailAccountProperties;
import com.example.shop.entity.User;
import com.example.shop.security.UserAccountStatusPolicy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.mail.MailException;
import org.springframework.mail.MailPreparationException;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import javax.mail.MessagingException;
import javax.mail.internet.MimeMessage;
import java.io.UnsupportedEncodingException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Properties;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailLoginService {
    private final UserService userService;
    private final MailAccountProperties mailAccountProperties;
    private final ObjectProvider<StringRedisTemplate> redisTemplateProvider;
    private final Clock clock = Clock.systemUTC();
    private final SecureRandom random = new SecureRandom();
    private final Map<String, VerificationCode> codes = new ConcurrentHashMap<>();
    private final Map<String, Instant> sendCooldowns = new ConcurrentHashMap<>();
    private final Map<String, RateBucket> sendBuckets = new ConcurrentHashMap<>();
    private final Map<String, RateBucket> verifyBuckets = new ConcurrentHashMap<>();
    private final Map<String, JavaMailSenderImpl> mailSenderCache = new ConcurrentHashMap<>();
    private final byte[] localCodePepper = createCodePepper();
    private static final int MAX_EMAIL_LENGTH = 180;
    private static final int MAX_ACCOUNT_ENUMERATION_PADDING_MS = 5_000;
    private static final int MAX_IN_MEMORY_RATE_BUCKETS = 100_000;
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

    public void sendLoginCode(String email) {
        sendLoginCode(email, "unknown");
    }

    public void sendLoginCode(String email, String clientKey) {
        String normalizedEmail = normalizeEmail(email);
        ensureMailConfigured();
        if (shouldUseRedis()) {
            try {
                sendLoginCodeWithRedis(normalizedEmail, clientKey);
                return;
            } catch (EmailLoginException | MailException | IllegalStateException e) {
                throw e;
            } catch (RuntimeException e) {
                throw redisCodeStoreUnavailable("send login code", e);
            }
        }
        sendLoginCodeInMemory(normalizedEmail, clientKey);
    }

    public void sendPasswordResetCode(String email, String clientKey) {
        String normalizedEmail = normalizeEmail(email);
        ensureMailConfigured();
        String purposeKey = passwordResetPurposeKey(normalizedEmail);
        User user = userService.findByUsernameOrPhoneOrEmail(normalizedEmail);
        boolean canDeliverCode = user != null && !isDisabled(user);
        if (shouldUseRedis()) {
            try {
                sendPurposeCodeWithRedis(purposeKey, normalizedEmail, clientKey, "password reset", canDeliverCode);
                return;
            } catch (EmailLoginException | MailException | IllegalStateException e) {
                throw e;
            } catch (RuntimeException e) {
                throw redisCodeStoreUnavailable("send password reset code", e);
            }
        }
        sendPurposeCodeInMemory(purposeKey, normalizedEmail, clientKey, "password reset", canDeliverCode);
    }

    public User verifyPasswordResetCode(String email, String code, String clientKey) {
        String normalizedEmail = normalizeEmail(email);
        String normalizedCode = normalizeCode(code);
        String purposeKey = passwordResetPurposeKey(normalizedEmail);
        if (shouldUseRedis()) {
            try {
                verifyPurposeCodeWithRedis(purposeKey, normalizedEmail, normalizedCode, clientKey);
            } catch (EmailLoginException e) {
                throw e;
            } catch (RuntimeException e) {
                throw redisCodeStoreUnavailable("verify password reset code", e);
            }
        } else {
            verifyPurposeCodeInMemory(purposeKey, normalizedEmail, normalizedCode, clientKey);
        }
        User user = userService.findByUsernameOrPhoneOrEmail(normalizedEmail);
        if (user == null || isDisabled(user)) {
            throw invalidCode();
        }
        return user;
    }

    public void sendProfileEmailChangeCode(Long userId, String email, String clientKey) {
        String normalizedEmail = normalizeEmail(email);
        if (userId == null) {
            throw new IllegalArgumentException("User is required");
        }
        User existing = userService.findByUsernameOrPhoneOrEmail(normalizedEmail);
        if (existing != null && !userId.equals(existing.getId())) {
            throw new IllegalArgumentException("Email already registered");
        }
        ensureMailConfigured();
        String purposeKey = profileEmailPurposeKey(userId, normalizedEmail);
        if (shouldUseRedis()) {
            try {
                sendPurposeCodeWithRedis(purposeKey, normalizedEmail, clientKey);
                return;
            } catch (EmailLoginException | MailException | IllegalStateException e) {
                throw e;
            } catch (RuntimeException e) {
                throw redisCodeStoreUnavailable("send profile email code", e);
            }
        }
        sendPurposeCodeInMemory(purposeKey, normalizedEmail, clientKey);
    }

    private String passwordResetPurposeKey(String normalizedEmail) {
        return "password-reset:" + normalizedEmail;
    }

    private void sendLoginCodeInMemory(String normalizedEmail, String clientKey) {
        Instant now = Instant.now(clock);
        consumeRate(sendBuckets, rateKey("send-email", normalizedEmail), sendWindow(), maxSendAttemptsPerWindow(), now, "RATE_LIMITED");
        consumeRate(sendBuckets, rateKey("send-client", normalizeClientKey(clientKey)), sendWindow(), maxSendAttemptsPerWindow() * 3, now, "RATE_LIMITED");

        Instant previousSend = sendCooldowns.get(normalizedEmail);
        if (previousSend != null && Duration.between(previousSend, now).compareTo(resendInterval()) < 0) {
            throw rateLimited("RATE_LIMITED", previousSend.plus(resendInterval()), now);
        }
        Instant lookupStartedAt = Instant.now(clock);
        User user = userService.findByUsernameOrPhoneOrEmail(normalizedEmail);
        if (user == null || isDisabled(user)) {
            sendCooldowns.put(normalizedEmail, now);
            padAccountEnumerationResponse(lookupStartedAt);
            return;
        }

        VerificationCode existing = codes.get(normalizedEmail);
        if (existing != null && Duration.between(existing.sentAt, now).compareTo(resendInterval()) < 0) {
            throw rateLimited("RATE_LIMITED", existing.sentAt.plus(resendInterval()), now);
        }

        String code = String.format("%06d", random.nextInt(1_000_000));
        VerificationCode pendingCode = new VerificationCode(hashCode(normalizedEmail, code), now.plus(codeTtl()), now);
        codes.put(normalizedEmail, pendingCode);
        try {
            sendMail(normalizedEmail, code);
            sendCooldowns.put(normalizedEmail, now);
        } catch (RuntimeException e) {
            codes.remove(normalizedEmail, pendingCode);
            throw e;
        }
    }

    private void sendLoginCodeWithRedis(String normalizedEmail, String clientKey) {
        StringRedisTemplate redisTemplate = redisTemplate();
        Instant now = Instant.now(clock);
        consumeRedisRate(redisTemplate, redisRateKey("send-email", normalizedEmail), sendWindow(), maxSendAttemptsPerWindow(), now, "RATE_LIMITED");
        consumeRedisRate(redisTemplate, redisRateKey("send-client", normalizeClientKey(clientKey)), sendWindow(), maxSendAttemptsPerWindow() * 3, now, "RATE_LIMITED");

        String cooldownKey = redisKey("cooldown", normalizedEmail);
        Long cooldownTtl = redisTemplate.getExpire(cooldownKey);
        if (cooldownTtl != null && cooldownTtl > 0) {
            throw rateLimited("RATE_LIMITED", now.plusSeconds(cooldownTtl), now);
        }

        Instant lookupStartedAt = Instant.now(clock);
        User user = userService.findByUsernameOrPhoneOrEmail(normalizedEmail);
        if (user == null || isDisabled(user)) {
            redisTemplate.opsForValue().set(cooldownKey, Long.toString(now.toEpochMilli()), resendInterval());
            padAccountEnumerationResponse(lookupStartedAt);
            return;
        }

        String code = String.format("%06d", random.nextInt(1_000_000));
        String codeKey = redisKey("code", normalizedEmail);
        redisTemplate.opsForHash().put(codeKey, "hash", hashCode(normalizedEmail, code));
        redisTemplate.opsForHash().put(codeKey, "sentAt", Long.toString(now.toEpochMilli()));
        redisTemplate.opsForHash().put(codeKey, "failedAttempts", "0");
        redisTemplate.expire(codeKey, codeTtl());
        try {
            sendMail(normalizedEmail, code);
            redisTemplate.opsForValue().set(cooldownKey, Long.toString(now.toEpochMilli()), resendInterval());
        } catch (RuntimeException e) {
            redisTemplate.delete(codeKey);
            throw e;
        }
    }

    private void sendPurposeCodeInMemory(String purposeKey, String normalizedEmail, String clientKey) {
        sendPurposeCodeInMemory(purposeKey, normalizedEmail, clientKey, "email change");
    }

    private void sendPurposeCodeInMemory(String purposeKey, String normalizedEmail, String clientKey, String purposeLabel) {
        sendPurposeCodeInMemory(purposeKey, normalizedEmail, clientKey, purposeLabel, true);
    }

    private void sendPurposeCodeInMemory(String purposeKey, String normalizedEmail, String clientKey, String purposeLabel, boolean deliverCode) {
        Instant now = Instant.now(clock);
        consumeRate(sendBuckets, rateKey("send-purpose", purposeKey), sendWindow(), maxSendAttemptsPerWindow(), now, "RATE_LIMITED");
        consumeRate(sendBuckets, rateKey("send-client", normalizeClientKey(clientKey)), sendWindow(), maxSendAttemptsPerWindow() * 3, now, "RATE_LIMITED");

        Instant previousSend = sendCooldowns.get(purposeKey);
        if (previousSend != null && Duration.between(previousSend, now).compareTo(resendInterval()) < 0) {
            throw rateLimited("RATE_LIMITED", previousSend.plus(resendInterval()), now);
        }
        if (!deliverCode) {
            sendCooldowns.put(purposeKey, now);
            padAccountEnumerationResponse(now);
            return;
        }

        String code = String.format("%06d", random.nextInt(1_000_000));
        VerificationCode pendingCode = new VerificationCode(hashCode(purposeKey, code), now.plus(codeTtl()), now);
        codes.put(purposeKey, pendingCode);
        try {
            sendMail(normalizedEmail, code, purposeLabel);
            sendCooldowns.put(purposeKey, now);
        } catch (RuntimeException e) {
            codes.remove(purposeKey, pendingCode);
            throw e;
        }
    }

    private void sendPurposeCodeWithRedis(String purposeKey, String normalizedEmail, String clientKey) {
        sendPurposeCodeWithRedis(purposeKey, normalizedEmail, clientKey, "email change");
    }

    private void sendPurposeCodeWithRedis(String purposeKey, String normalizedEmail, String clientKey, String purposeLabel) {
        sendPurposeCodeWithRedis(purposeKey, normalizedEmail, clientKey, purposeLabel, true);
    }

    private void sendPurposeCodeWithRedis(String purposeKey, String normalizedEmail, String clientKey, String purposeLabel, boolean deliverCode) {
        StringRedisTemplate redisTemplate = redisTemplate();
        Instant now = Instant.now(clock);
        consumeRedisRate(redisTemplate, redisRateKey("send-purpose", purposeKey), sendWindow(), maxSendAttemptsPerWindow(), now, "RATE_LIMITED");
        consumeRedisRate(redisTemplate, redisRateKey("send-client", normalizeClientKey(clientKey)), sendWindow(), maxSendAttemptsPerWindow() * 3, now, "RATE_LIMITED");

        String cooldownKey = redisKey("cooldown", purposeKey);
        Long cooldownTtl = redisTemplate.getExpire(cooldownKey);
        if (cooldownTtl != null && cooldownTtl > 0) {
            throw rateLimited("RATE_LIMITED", now.plusSeconds(cooldownTtl), now);
        }
        if (!deliverCode) {
            redisTemplate.opsForValue().set(cooldownKey, Long.toString(now.toEpochMilli()), resendInterval());
            padAccountEnumerationResponse(now);
            return;
        }

        String code = String.format("%06d", random.nextInt(1_000_000));
        String codeKey = redisKey("code", purposeKey);
        redisTemplate.opsForHash().put(codeKey, "hash", hashCode(purposeKey, code));
        redisTemplate.opsForHash().put(codeKey, "sentAt", Long.toString(now.toEpochMilli()));
        redisTemplate.opsForHash().put(codeKey, "failedAttempts", "0");
        redisTemplate.expire(codeKey, codeTtl());
        try {
            sendMail(normalizedEmail, code, purposeLabel);
            redisTemplate.opsForValue().set(cooldownKey, Long.toString(now.toEpochMilli()), resendInterval());
        } catch (RuntimeException e) {
            redisTemplate.delete(codeKey);
            throw e;
        }
    }

    public User verifyLoginCode(String email, String code) {
        return verifyLoginCode(email, code, "unknown");
    }

    public User verifyLoginCode(String email, String code, String clientKey) {
        String normalizedEmail = normalizeEmail(email);
        String normalizedCode = normalizeCode(code);
        if (shouldUseRedis()) {
            try {
                return verifyLoginCodeWithRedis(normalizedEmail, normalizedCode, clientKey);
            } catch (EmailLoginException e) {
                throw e;
            } catch (RuntimeException e) {
                throw redisCodeStoreUnavailable("verify login code", e);
            }
        }
        return verifyLoginCodeInMemory(normalizedEmail, normalizedCode, clientKey);
    }

    public void verifyProfileEmailChangeCode(Long userId, String email, String code, String clientKey) {
        String normalizedEmail = normalizeEmail(email);
        String normalizedCode = normalizeCode(code);
        if (userId == null) {
            throw new IllegalArgumentException("User is required");
        }
        String purposeKey = profileEmailPurposeKey(userId, normalizedEmail);
        if (shouldUseRedis()) {
            try {
                verifyPurposeCodeWithRedis(purposeKey, normalizedEmail, normalizedCode, clientKey);
                return;
            } catch (EmailLoginException e) {
                throw e;
            } catch (RuntimeException e) {
                throw redisCodeStoreUnavailable("verify profile email code", e);
            }
        }
        verifyPurposeCodeInMemory(purposeKey, normalizedEmail, normalizedCode, clientKey);
    }

    private User verifyLoginCodeInMemory(String normalizedEmail, String normalizedCode, String clientKey) {
        Instant now = Instant.now(clock);
        consumeRate(verifyBuckets, rateKey("verify-email", normalizedEmail), verifyWindow(), maxVerifyFailuresPerWindow(), now, "TOO_MANY_ATTEMPTS");
        consumeRate(verifyBuckets, rateKey("verify-client", normalizeClientKey(clientKey)), verifyWindow(), maxVerifyFailuresPerWindow() * 3, now, "TOO_MANY_ATTEMPTS");
        if (normalizedCode.length() != 6) {
            throw invalidCode();
        }
        VerificationCode verificationCode = codes.get(normalizedEmail);
        if (verificationCode == null || verificationCode.expiresAt.isBefore(now)) {
            codes.remove(normalizedEmail);
            throw invalidCode();
        }
        if (!matchesCodeHash(verificationCode.codeHash, normalizedEmail, normalizedCode)) {
            verificationCode.failedAttempts++;
            if (verificationCode.failedAttempts >= maxCodeAttempts()) {
                codes.remove(normalizedEmail);
                throw tooManyAttempts(now);
            }
            throw invalidCode();
        }
        codes.remove(normalizedEmail);
        clearVerifyBuckets(normalizedEmail, clientKey);

        User user = userService.findByUsernameOrPhoneOrEmail(normalizedEmail);
        if (user == null || isDisabled(user)) {
            throw invalidCode();
        }
        return user;
    }

    private User verifyLoginCodeWithRedis(String normalizedEmail, String normalizedCode, String clientKey) {
        StringRedisTemplate redisTemplate = redisTemplate();
        Instant now = Instant.now(clock);
        consumeRedisRate(redisTemplate, redisRateKey("verify-email", normalizedEmail), verifyWindow(), maxVerifyFailuresPerWindow(), now, "TOO_MANY_ATTEMPTS");
        consumeRedisRate(redisTemplate, redisRateKey("verify-client", normalizeClientKey(clientKey)), verifyWindow(), maxVerifyFailuresPerWindow() * 3, now, "TOO_MANY_ATTEMPTS");
        if (normalizedCode.length() != 6) {
            throw invalidCode();
        }

        String codeKey = redisKey("code", normalizedEmail);
        Object storedHash = redisTemplate.opsForHash().get(codeKey, "hash");
        if (storedHash == null) {
            redisTemplate.delete(codeKey);
            throw invalidCode();
        }
        if (!matchesCodeHash(storedHash.toString(), normalizedEmail, normalizedCode)) {
            Long failedAttempts = redisTemplate.opsForHash().increment(codeKey, "failedAttempts", 1);
            if (failedAttempts != null && failedAttempts >= maxCodeAttempts()) {
                redisTemplate.delete(codeKey);
                throw tooManyAttempts(now);
            }
            throw invalidCode();
        }

        redisTemplate.delete(codeKey);
        redisTemplate.delete(redisRateKey("verify-email", normalizedEmail));
        redisTemplate.delete(redisRateKey("verify-client", normalizeClientKey(clientKey)));

        User user = userService.findByUsernameOrPhoneOrEmail(normalizedEmail);
        if (user == null || isDisabled(user)) {
            throw invalidCode();
        }
        return user;
    }

    private void verifyPurposeCodeInMemory(String purposeKey, String normalizedEmail, String normalizedCode, String clientKey) {
        Instant now = Instant.now(clock);
        consumeRate(verifyBuckets, rateKey("verify-purpose", purposeKey), verifyWindow(), maxVerifyFailuresPerWindow(), now, "TOO_MANY_ATTEMPTS");
        consumeRate(verifyBuckets, rateKey("verify-client", normalizeClientKey(clientKey)), verifyWindow(), maxVerifyFailuresPerWindow() * 3, now, "TOO_MANY_ATTEMPTS");
        if (normalizedCode.length() != 6) {
            throw invalidCode();
        }
        VerificationCode verificationCode = codes.get(purposeKey);
        if (verificationCode == null || verificationCode.expiresAt.isBefore(now)) {
            codes.remove(purposeKey);
            throw invalidCode();
        }
        if (!matchesCodeHash(verificationCode.codeHash, purposeKey, normalizedCode)) {
            verificationCode.failedAttempts++;
            if (verificationCode.failedAttempts >= maxCodeAttempts()) {
                codes.remove(purposeKey);
                throw tooManyAttempts(now);
            }
            throw invalidCode();
        }
        codes.remove(purposeKey);
        clearPurposeVerifyBuckets(purposeKey, clientKey);
        assertProfileEmailStillAvailable(purposeKey, normalizedEmail);
    }

    private void verifyPurposeCodeWithRedis(String purposeKey, String normalizedEmail, String normalizedCode, String clientKey) {
        StringRedisTemplate redisTemplate = redisTemplate();
        Instant now = Instant.now(clock);
        consumeRedisRate(redisTemplate, redisRateKey("verify-purpose", purposeKey), verifyWindow(), maxVerifyFailuresPerWindow(), now, "TOO_MANY_ATTEMPTS");
        consumeRedisRate(redisTemplate, redisRateKey("verify-client", normalizeClientKey(clientKey)), verifyWindow(), maxVerifyFailuresPerWindow() * 3, now, "TOO_MANY_ATTEMPTS");
        if (normalizedCode.length() != 6) {
            throw invalidCode();
        }

        String codeKey = redisKey("code", purposeKey);
        Object storedHash = redisTemplate.opsForHash().get(codeKey, "hash");
        if (storedHash == null) {
            redisTemplate.delete(codeKey);
            throw invalidCode();
        }
        if (!matchesCodeHash(storedHash.toString(), purposeKey, normalizedCode)) {
            Long failedAttempts = redisTemplate.opsForHash().increment(codeKey, "failedAttempts", 1);
            if (failedAttempts != null && failedAttempts >= maxCodeAttempts()) {
                redisTemplate.delete(codeKey);
                throw tooManyAttempts(now);
            }
            throw invalidCode();
        }

        redisTemplate.delete(codeKey);
        redisTemplate.delete(redisRateKey("verify-purpose", purposeKey));
        redisTemplate.delete(redisRateKey("verify-client", normalizeClientKey(clientKey)));
        assertProfileEmailStillAvailable(purposeKey, normalizedEmail);
    }

    public int codeTtlMinutes() {
        return (int) codeTtl().toMinutes();
    }

    public int resendIntervalSeconds() {
        return (int) resendInterval().getSeconds();
    }

    @Scheduled(fixedDelayString = "${app.mail.cleanup-interval-ms:300000}")
    public void cleanupExpiredCodes() {
        Instant now = Instant.now(clock);
        codes.entrySet().removeIf(entry -> entry.getValue().expiresAt.isBefore(now));
        sendCooldowns.entrySet().removeIf(entry -> entry.getValue().plus(resendInterval()).isBefore(now));
        cleanupBuckets(sendBuckets, sendWindow(), now);
        cleanupBuckets(verifyBuckets, verifyWindow(), now);
    }

    private void sendMail(String to, String code) {
        sendMail(to, code, "login");
    }

    private void sendMail(String to, String code, String purposeLabel) {
        List<MailAccountProperties.Account> accounts = randomizedConfiguredAccounts();
        MailException lastFailure = null;
        for (MailAccountProperties.Account account : accounts) {
            try {
                sendMailWithAccount(account, to, code, purposeLabel);
                return;
            } catch (MailException e) {
                lastFailure = e;
                log.warn("Email login code send failed through SMTP account {}", maskEmail(account.getUsername()), e);
            }
        }
        if (lastFailure != null) {
            throw lastFailure;
        }
        throw new IllegalStateException("Email service is not configured");
    }

    private void sendMailWithAccount(MailAccountProperties.Account account, String to, String code) {
        sendMailWithAccount(account, to, code, "login");
    }

    private void sendMailWithAccount(MailAccountProperties.Account account, String to, String code, String purposeLabel) {
        try {
            JavaMailSenderImpl sender = mailSenderFor(account);
            MimeMessage message = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            String brandName = mailAccountProperties.getBrandName();
            String safePurpose = isBlank(purposeLabel) ? "login" : purposeLabel.trim();
            helper.setFrom(account.getFrom().trim(), isBlank(brandName) ? "ShopMX" : brandName.trim());
            helper.setTo(to);
            helper.setSubject((isBlank(brandName) ? "ShopMX" : brandName.trim()) + " " + safePurpose + " verification code");
            helper.setText(renderEmailText(code, safePurpose), renderEmailHtml(code, safePurpose));
            sender.send(message);
        } catch (MessagingException | UnsupportedEncodingException e) {
            throw new MailPreparationException("Unable to prepare login verification email", e);
        }
    }

    private void ensureMailConfigured() {
        if (configuredAccounts().isEmpty()) {
            throw new IllegalStateException("Email service is not configured");
        }
    }

    private List<MailAccountProperties.Account> randomizedConfiguredAccounts() {
        List<MailAccountProperties.Account> accounts = configuredAccounts();
        if (accounts.isEmpty()) {
            throw new IllegalStateException("Email service is not configured");
        }
        List<MailAccountProperties.Account> randomized = new ArrayList<>(accounts);
        Collections.shuffle(randomized, random);
        return randomized;
    }

    private List<MailAccountProperties.Account> configuredAccounts() {
        return mailAccountProperties.getAccounts().stream()
                .filter(account -> !isBlank(account.getHost()))
                .filter(account -> account.getPort() != null && account.getPort() > 0)
                .filter(account -> !isBlank(account.getUsername()))
                .filter(account -> !isBlank(account.getPassword()))
                .filter(account -> !isBlank(account.getFrom()))
                .collect(Collectors.toList());
    }

    private JavaMailSenderImpl mailSenderFor(MailAccountProperties.Account account) {
        return mailSenderCache.computeIfAbsent(accountCacheKey(account), ignored -> createMailSender(account));
    }

    private JavaMailSenderImpl createMailSender(MailAccountProperties.Account account) {
        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setHost(account.getHost().trim());
        sender.setPort(account.getPort());
        sender.setUsername(account.getUsername().trim());
        sender.setPassword(account.getPassword().trim());
        sender.setProtocol("smtp");
        sender.setDefaultEncoding("UTF-8");

        Properties properties = sender.getJavaMailProperties();
        properties.put("mail.smtp.auth", "true");
        properties.put("mail.smtp.ssl.enable", Boolean.toString(account.isSsl()));
        properties.put("mail.smtp.starttls.enable", Boolean.toString(account.isStarttls()));
        properties.put("mail.smtp.connectiontimeout", "8000");
        properties.put("mail.smtp.timeout", "8000");
        properties.put("mail.smtp.writetimeout", "8000");
        return sender;
    }

    private Duration codeTtl() {
        return Duration.ofMinutes(Math.max(1, mailAccountProperties.getCodeTtlMinutes()));
    }

    private Duration resendInterval() {
        return Duration.ofSeconds(Math.max(10, mailAccountProperties.getResendIntervalSeconds()));
    }

    private int maxCodeAttempts() {
        return Math.max(1, mailAccountProperties.getMaxCodeAttempts());
    }

    private Duration sendWindow() {
        return Duration.ofMinutes(Math.max(1, mailAccountProperties.getSendWindowMinutes()));
    }

    private int maxSendAttemptsPerWindow() {
        return Math.max(1, mailAccountProperties.getMaxSendAttemptsPerWindow());
    }

    private Duration verifyWindow() {
        return Duration.ofMinutes(Math.max(1, mailAccountProperties.getVerifyWindowMinutes()));
    }

    private int maxVerifyFailuresPerWindow() {
        return Math.max(1, mailAccountProperties.getMaxVerifyFailuresPerWindow());
    }

    private Duration accountEnumerationPadding() {
        int configured = mailAccountProperties.getAccountEnumerationPaddingMs();
        int bounded = Math.max(0, Math.min(configured, MAX_ACCOUNT_ENUMERATION_PADDING_MS));
        return Duration.ofMillis(bounded);
    }

    private void padAccountEnumerationResponse(Instant startedAt) {
        Duration minimum = accountEnumerationPadding();
        if (minimum.isZero() || minimum.isNegative()) {
            return;
        }
        Duration elapsed = Duration.between(startedAt, Instant.now(clock));
        Duration remaining = minimum.minus(elapsed);
        if (remaining.isZero() || remaining.isNegative()) {
            return;
        }
        sleepForPadding(remaining);
    }

    protected void sleepForPadding(Duration duration) {
        try {
            Thread.sleep(duration.toMillis());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private String accountCacheKey(MailAccountProperties.Account account) {
        return normalizeForKey(account.getHost())
                + "|" + account.getPort()
                + "|" + normalizeForKey(account.getUsername())
                + "|" + normalizeForKey(account.getFrom())
                + "|" + account.isSsl()
                + "|" + account.isStarttls()
                + "|" + Integer.toHexString(account.getPassword().hashCode());
    }

    private boolean isDisabled(User user) {
        return !UserAccountStatusPolicy.canIssueUserSession(user);
    }

    private String normalizeEmail(String email) {
        if (email == null || email.trim().isEmpty()) {
            throw new IllegalArgumentException("Email is required");
        }
        String normalized = email.trim().toLowerCase(Locale.ROOT);
        if (normalized.length() > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.matcher(normalized).matches()) {
            throw new IllegalArgumentException("Valid email is required");
        }
        return normalized;
    }

    private String normalizeCode(String code) {
        if (code == null) {
            return "";
        }
        return code.replaceAll("\\D+", "").trim();
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private String normalizeForKey(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private String normalizeClientKey(String value) {
        if (isBlank(value)) {
            return "unknown";
        }
        String normalized = value.trim().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9:._-]", "");
        if (normalized.isEmpty()) {
            return "unknown";
        }
        return normalized.length() > 96 ? normalized.substring(0, 96) : normalized;
    }

    private String rateKey(String scope, String value) {
        return scope + ":" + value;
    }

    private boolean shouldUseRedis() {
        return mailAccountProperties.isRedisEnabled() && redisTemplateProvider.getIfAvailable() != null;
    }

    private StringRedisTemplate redisTemplate() {
        StringRedisTemplate redisTemplate = redisTemplateProvider.getIfAvailable();
        if (redisTemplate == null) {
            throw new IllegalStateException("RedisTemplate is not configured");
        }
        return redisTemplate;
    }

    private IllegalStateException redisCodeStoreUnavailable(String operation, RuntimeException cause) {
        log.warn("Redis email code store is unavailable during {}. Failing closed to avoid split-brain verification codes.", operation, cause);
        return new IllegalStateException("Verification code service is temporarily unavailable", cause);
    }

    private String redisKey(String type, String value) {
        return redisPrefix() + ":" + type + ":" + sha256Hex(value);
    }

    private String redisRateKey(String scope, String value) {
        return redisPrefix() + ":rate:" + scope + ":" + sha256Hex(value);
    }

    private String redisPrefix() {
        String prefix = mailAccountProperties.getRedisKeyPrefix();
        if (isBlank(prefix)) {
            return "shop:mail-code";
        }
        return prefix.trim().replaceAll("[^a-zA-Z0-9:._-]", "_");
    }

    private void consumeRedisRate(StringRedisTemplate redisTemplate, String key, Duration window, int maxAttempts, Instant now, String errorCode) {
        Long attempts = redisTemplate.opsForValue().increment(key);
        if (attempts != null && attempts == 1L) {
            redisTemplate.expire(key, window);
        }
        if (attempts != null && attempts > maxAttempts) {
            Long ttlSeconds = redisTemplate.getExpire(key);
            if (ttlSeconds == null || ttlSeconds < 1) {
                ttlSeconds = window.getSeconds();
            }
            throw rateLimited(errorCode, now.plusSeconds(ttlSeconds), now);
        }
    }

    private void consumeRate(Map<String, RateBucket> buckets, String key, Duration window, int maxAttempts, Instant now, String errorCode) {
        RateBucket bucket = rateBucket(buckets, key, window, now, errorCode);
        synchronized (bucket) {
            if (Duration.between(bucket.windowStart, now).compareTo(window) >= 0) {
                bucket.windowStart = now;
                bucket.attempts = 0;
            }
            bucket.attempts++;
            if (bucket.attempts > maxAttempts) {
                throw rateLimited(errorCode, bucket.windowStart.plus(window), now);
            }
        }
    }

    private RateBucket rateBucket(Map<String, RateBucket> buckets, String key, Duration window, Instant now, String errorCode) {
        RateBucket existing = buckets.get(key);
        if (existing != null) {
            return existing;
        }
        synchronized (buckets) {
            existing = buckets.get(key);
            if (existing != null) {
                return existing;
            }
            int maxBuckets = maxInMemoryRateBuckets();
            if (buckets.size() >= maxBuckets) {
                cleanupBuckets(buckets, window, now);
            }
            if (buckets.size() >= maxBuckets) {
                throw rateLimited(errorCode, now.plus(window), now);
            }
            RateBucket created = new RateBucket(now);
            buckets.put(key, created);
            return created;
        }
    }

    private int maxInMemoryRateBuckets() {
        int configured = mailAccountProperties.getMaxRateBuckets();
        return Math.max(1, Math.min(configured, MAX_IN_MEMORY_RATE_BUCKETS));
    }

    private void clearVerifyBuckets(String email, String clientKey) {
        verifyBuckets.remove(rateKey("verify-email", email));
        verifyBuckets.remove(rateKey("verify-client", normalizeClientKey(clientKey)));
    }

    private void clearPurposeVerifyBuckets(String purposeKey, String clientKey) {
        verifyBuckets.remove(rateKey("verify-purpose", purposeKey));
        verifyBuckets.remove(rateKey("verify-client", normalizeClientKey(clientKey)));
    }

    private void cleanupBuckets(Map<String, RateBucket> buckets, Duration window, Instant now) {
        buckets.entrySet().removeIf(entry -> entry.getValue().windowStart.plus(window).isBefore(now));
    }

    private String maskEmail(String email) {
        if (isBlank(email)) {
            return "(blank)";
        }
        String normalized = email.trim();
        int atIndex = normalized.indexOf('@');
        if (atIndex <= 1) {
            return "***" + (atIndex >= 0 ? normalized.substring(atIndex) : "");
        }
        return normalized.charAt(0) + "***" + normalized.substring(atIndex);
    }

    private String profileEmailPurposeKey(Long userId, String normalizedEmail) {
        return "profile-email:" + userId + ":" + normalizedEmail;
    }

    private Long userIdFromProfileEmailPurposeKey(String purposeKey) {
        if (purposeKey == null || !purposeKey.startsWith("profile-email:")) {
            return null;
        }
        int start = "profile-email:".length();
        int end = purposeKey.indexOf(':', start);
        if (end <= start) {
            return null;
        }
        try {
            return Long.parseLong(purposeKey.substring(start, end));
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private void assertProfileEmailStillAvailable(String purposeKey, String normalizedEmail) {
        Long userId = userIdFromProfileEmailPurposeKey(purposeKey);
        if (userId == null) {
            return;
        }
        User existing = userService.findByUsernameOrPhoneOrEmail(normalizedEmail);
        if (existing != null && !userId.equals(existing.getId())) {
            throw invalidCode();
        }
    }

    private String renderEmailText(String code) {
        return renderEmailText(code, "login");
    }

    private String renderEmailText(String code, String purposeLabel) {
        String brandName = isBlank(mailAccountProperties.getBrandName()) ? "ShopMX" : mailAccountProperties.getBrandName().trim();
        String safePurpose = isBlank(purposeLabel) ? "login" : purposeLabel.trim();
        return "Your " + brandName + " " + safePurpose + " verification code is " + code
                + ". It expires in " + codeTtl().toMinutes()
                + " minutes. If you did not request this, you can ignore this email.";
    }

    private String renderEmailHtml(String code) {
        return renderEmailHtml(code, "login");
    }

    private String renderEmailHtml(String code, String purposeLabel) {
        String brandName = isBlank(mailAccountProperties.getBrandName()) ? "ShopMX" : mailAccountProperties.getBrandName().trim();
        String safePurpose = isBlank(purposeLabel) ? "Login" : purposeLabel.trim();
        long minutes = codeTtl().toMinutes();
        return "<!doctype html>"
                + "<html lang=\"en\"><head><meta charset=\"UTF-8\"/>"
                + "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"/>"
                + "<title>" + escapeHtml(brandName) + " verification</title></head>"
                + "<body style=\"margin:0;background:#f6f8f6;font-family:Arial,sans-serif;color:#173f2b;\">"
                + "<div style=\"max-width:520px;margin:0 auto;padding:28px 18px;\">"
                + "<div style=\"background:#ffffff;border:1px solid #e4ebe4;border-radius:8px;padding:26px;\">"
                + "<div style=\"font-size:22px;font-weight:800;color:#ee4d2d;margin-bottom:14px;\">" + escapeHtml(brandName) + "</div>"
                + "<div style=\"font-size:16px;font-weight:700;margin-bottom:10px;\">" + escapeHtml(safePurpose) + " verification code</div>"
                + "<div style=\"font-size:34px;font-weight:800;letter-spacing:6px;background:#f8fcf9;border:1px solid #e4ebe4;border-radius:8px;padding:16px 18px;text-align:center;margin:16px 0;\">"
                + escapeHtml(code)
                + "</div>"
                + "<div style=\"font-size:14px;line-height:1.6;color:#5f6f64;\">This code expires in " + minutes
                + " minutes. If you did not request this, you can safely ignore this email.</div>"
                + "</div></div></body></html>";
    }


    private String escapeHtml(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }

    private String hashCode(String email, String code) {
        return digestCode("SHA-512", email, code);
    }

    private boolean matchesCodeHash(String storedHash, String email, String code) {
        if (storedHash == null || storedHash.isBlank()) {
            return false;
        }
        String normalizedStoredHash = storedHash.trim();
        String algorithm = normalizedStoredHash.length() == 64 ? "SHA-256" : "SHA-512";
        return MessageDigest.isEqual(
                normalizedStoredHash.getBytes(StandardCharsets.UTF_8),
                digestCode(algorithm, email, code).getBytes(StandardCharsets.UTF_8));
    }

    private String digestCode(String algorithm, String email, String code) {
        try {
            MessageDigest digest = MessageDigest.getInstance(algorithm);
            digest.update(codePepper());
            byte[] hashed = digest.digest((email + ":" + code).getBytes(StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder(hashed.length * 2);
            for (byte value : hashed) {
                builder.append(String.format("%02x", value));
            }
            return builder.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(algorithm + " is not available", e);
        }
    }

    private String sha256Hex(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder(hashed.length * 2);
            for (byte current : hashed) {
                builder.append(String.format("%02x", current));
            }
            return builder.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is not available", e);
        }
    }

    private byte[] codePepper() {
        String configuredPepper = mailAccountProperties.getCodePepper();
        if (!isBlank(configuredPepper)) {
            return configuredPepper.getBytes(StandardCharsets.UTF_8);
        }
        return localCodePepper;
    }

    private byte[] createCodePepper() {
        byte[] pepper = new byte[32];
        new SecureRandom().nextBytes(pepper);
        return pepper;
    }

    private EmailLoginException invalidCode() {
        return new EmailLoginException("INVALID_CODE", "Verification code expired or invalid", 0);
    }

    private EmailLoginException tooManyAttempts(Instant now) {
        return rateLimited("TOO_MANY_ATTEMPTS", now.plus(verifyWindow()), now);
    }

    private EmailLoginException rateLimited(String code, Instant retryAfter, Instant now) {
        long remainingMillis = Duration.between(now, retryAfter).toMillis();
        long seconds = Math.max(1, (remainingMillis + 999) / 1000);
        return new EmailLoginException(code, "Please wait before trying again", seconds);
    }

    private static class VerificationCode {
        private final String codeHash;
        private final Instant expiresAt;
        private final Instant sentAt;
        private int failedAttempts;

        private VerificationCode(String codeHash, Instant expiresAt, Instant sentAt) {
            this.codeHash = codeHash;
            this.expiresAt = expiresAt;
            this.sentAt = sentAt;
        }
    }

    private static class RateBucket {
        private Instant windowStart;
        private int attempts;

        private RateBucket(Instant windowStart) {
            this.windowStart = windowStart;
        }
    }

    public static class EmailLoginException extends RuntimeException {
        private final String code;
        private final long retryAfterSeconds;

        public EmailLoginException(String code, String message, long retryAfterSeconds) {
            super(message);
            this.code = code;
            this.retryAfterSeconds = retryAfterSeconds;
        }

        public String getCode() {
            return code;
        }

        public long getRetryAfterSeconds() {
            return retryAfterSeconds;
        }
    }
}
