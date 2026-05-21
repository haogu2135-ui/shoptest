package com.example.shop.service;

import com.example.shop.config.MailAccountProperties;
import com.example.shop.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailLoginService {
    private final UserService userService;
    private final MailAccountProperties mailAccountProperties;
    private final Clock clock = Clock.systemUTC();
    private final SecureRandom random = new SecureRandom();
    private final Map<String, VerificationCode> codes = new ConcurrentHashMap<>();
    private final Map<String, JavaMailSenderImpl> mailSenderCache = new ConcurrentHashMap<>();

    public void sendLoginCode(String email) {
        String normalizedEmail = normalizeEmail(email);
        ensureMailConfigured();
        User user = userService.findByUsernameOrPhoneOrEmail(normalizedEmail);
        if (user == null || isDisabled(user)) {
            return;
        }

        Instant now = Instant.now(clock);
        VerificationCode existing = codes.get(normalizedEmail);
        if (existing != null && Duration.between(existing.sentAt, now).compareTo(resendInterval()) < 0) {
            throw new IllegalStateException("Please wait before requesting another code");
        }

        String code = String.format("%06d", random.nextInt(1_000_000));
        VerificationCode pendingCode = new VerificationCode(hashCode(normalizedEmail, code), now.plus(codeTtl()), now);
        codes.put(normalizedEmail, pendingCode);
        try {
            sendMail(normalizedEmail, code);
        } catch (RuntimeException e) {
            codes.remove(normalizedEmail, pendingCode);
            throw e;
        }
    }

    public User verifyLoginCode(String email, String code) {
        String normalizedEmail = normalizeEmail(email);
        String normalizedCode = normalizeCode(code);
        if (normalizedCode.length() != 6) {
            throw new IllegalArgumentException("Verification code expired or invalid");
        }
        VerificationCode verificationCode = codes.get(normalizedEmail);
        Instant now = Instant.now(clock);
        if (verificationCode == null || verificationCode.expiresAt.isBefore(now)) {
            codes.remove(normalizedEmail);
            throw new IllegalArgumentException("Verification code expired or invalid");
        }
        if (!MessageDigest.isEqual(
                verificationCode.codeHash.getBytes(StandardCharsets.UTF_8),
                hashCode(normalizedEmail, normalizedCode).getBytes(StandardCharsets.UTF_8))) {
            verificationCode.failedAttempts++;
            if (verificationCode.failedAttempts >= maxCodeAttempts()) {
                codes.remove(normalizedEmail);
            }
            throw new IllegalArgumentException("Verification code expired or invalid");
        }
        codes.remove(normalizedEmail);

        User user = userService.findByUsernameOrPhoneOrEmail(normalizedEmail);
        if (user == null || isDisabled(user)) {
            throw new IllegalArgumentException("Email is not linked to an active account");
        }
        return user;
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
    }

    private void sendMail(String to, String code) {
        List<MailAccountProperties.Account> accounts = randomizedConfiguredAccounts();
        MailException lastFailure = null;
        for (MailAccountProperties.Account account : accounts) {
            try {
                sendMailWithAccount(account, to, code);
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
        try {
            JavaMailSenderImpl sender = mailSenderFor(account);
            MimeMessage message = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, "UTF-8");
            String brandName = mailAccountProperties.getBrandName();
            helper.setFrom(account.getFrom().trim(), isBlank(brandName) ? "ShopMX" : brandName.trim());
            helper.setTo(to);
            helper.setSubject((isBlank(brandName) ? "ShopMX" : brandName.trim()) + " login verification code");
            helper.setText(renderEmailText(code), renderEmailHtml(code));
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
        return "BANNED".equalsIgnoreCase(user.getStatus());
    }

    private String normalizeEmail(String email) {
        if (email == null || email.trim().isEmpty()) {
            throw new IllegalArgumentException("Email is required");
        }
        return email.trim().toLowerCase(Locale.ROOT);
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

    private String renderEmailText(String code) {
        String brandName = isBlank(mailAccountProperties.getBrandName()) ? "ShopMX" : mailAccountProperties.getBrandName().trim();
        return "Your " + brandName + " login verification code is " + code
                + ". It expires in " + codeTtl().toMinutes()
                + " minutes. If you did not request this, you can ignore this email.";
    }

    private String renderEmailHtml(String code) {
        String brandName = isBlank(mailAccountProperties.getBrandName()) ? "ShopMX" : mailAccountProperties.getBrandName().trim();
        long minutes = codeTtl().toMinutes();
        return "<!doctype html>"
                + "<html><body style=\"margin:0;background:#f6f8f6;font-family:Arial,sans-serif;color:#173f2b;\">"
                + "<div style=\"max-width:520px;margin:0 auto;padding:28px 18px;\">"
                + "<div style=\"background:#ffffff;border:1px solid #e4ebe4;border-radius:8px;padding:26px;\">"
                + "<div style=\"font-size:22px;font-weight:800;color:#ee4d2d;margin-bottom:14px;\">" + escapeHtml(brandName) + "</div>"
                + "<div style=\"font-size:16px;font-weight:700;margin-bottom:10px;\">Login verification code</div>"
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
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest((email + ":" + code).getBytes(StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder(hashed.length * 2);
            for (byte value : hashed) {
                builder.append(String.format("%02x", value));
            }
            return builder.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is not available", e);
        }
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
}
