package com.example.shop.service;

import com.example.shop.config.MailAccountProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.MailPreparationException;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import javax.mail.MessagingException;
import javax.mail.internet.MimeMessage;
import java.io.UnsupportedEncodingException;
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
public class OrderEmailNotificationService {
    private final MailAccountProperties mailAccountProperties;
    private final Map<String, JavaMailSenderImpl> mailSenderCache = new ConcurrentHashMap<>();

    @Transactional(rollbackFor = Exception.class, propagation = Propagation.NOT_SUPPORTED)
    public boolean trySendOrderStatusEmail(String email, String title, String message) {
        String normalizedEmail = normalizeEmail(email);
        if (normalizedEmail == null || isBlank(title) || isBlank(message)) {
            return false;
        }
        List<MailAccountProperties.Account> accounts = randomizedConfiguredAccounts();
        if (accounts.isEmpty()) {
            return false;
        }
        Exception lastFailure = null;
        for (MailAccountProperties.Account account : accounts) {
            try {
                sendMailWithAccount(account, normalizedEmail, title.trim(), message.trim());
                return true;
            } catch (Exception e) {
                lastFailure = e;
                log.warn("Order status email send failed through SMTP account {}", maskEmail(account.getUsername()), e);
            }
        }
        if (lastFailure != null) {
            log.warn("Order status email was not delivered to {}", maskEmail(normalizedEmail), lastFailure);
        }
        return false;
    }

    private void sendMailWithAccount(MailAccountProperties.Account account, String to, String title, String messageText) {
        try {
            JavaMailSenderImpl sender = mailSenderFor(account);
            MimeMessage message = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, "UTF-8");
            String brandName = brandName();
            helper.setFrom(account.getFrom().trim(), brandName);
            helper.setTo(to);
            helper.setSubject(brandName + " - " + title);
            helper.setText(messageText, renderHtml(brandName, title, messageText));
            sender.send(message);
        } catch (MessagingException | UnsupportedEncodingException e) {
            throw new MailPreparationException("Unable to prepare order status email", e);
        }
    }

    private String renderHtml(String brandName, String title, String messageText) {
        return "<!doctype html><html><body>"
                + "<h2>" + escapeHtml(brandName) + "</h2>"
                + "<h3>" + escapeHtml(title) + "</h3>"
                + "<p>" + escapeHtml(messageText).replace("\n", "<br/>") + "</p>"
                + "</body></html>";
    }

    private List<MailAccountProperties.Account> randomizedConfiguredAccounts() {
        List<MailAccountProperties.Account> accounts = configuredAccounts();
        if (accounts.isEmpty()) {
            return accounts;
        }
        List<MailAccountProperties.Account> randomized = new ArrayList<>(accounts);
        Collections.shuffle(randomized);
        return randomized;
    }

    private List<MailAccountProperties.Account> configuredAccounts() {
        if (mailAccountProperties.getAccounts() == null) {
            return Collections.emptyList();
        }
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

    private String accountCacheKey(MailAccountProperties.Account account) {
        return normalizeForKey(account.getHost())
                + "|" + account.getPort()
                + "|" + normalizeForKey(account.getUsername())
                + "|" + normalizeForKey(account.getFrom())
                + "|" + account.isSsl()
                + "|" + account.isStarttls()
                + "|" + Integer.toHexString(account.getPassword().hashCode());
    }

    private String normalizeEmail(String email) {
        if (isBlank(email)) {
            return null;
        }
        String normalized = email.trim().toLowerCase(Locale.ROOT);
        return normalized.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$") ? normalized : null;
    }

    private String normalizeForKey(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private String brandName() {
        return isBlank(mailAccountProperties.getBrandName()) ? "ShopMX" : mailAccountProperties.getBrandName().trim();
    }

    private String maskEmail(String value) {
        String email = normalizeEmail(value);
        if (email == null) {
            return "";
        }
        int at = email.indexOf('@');
        if (at <= 1) {
            return "***" + email.substring(at);
        }
        return email.charAt(0) + "***" + email.substring(at);
    }

    private String escapeHtml(String value) {
        if (value == null) {
            return "";
        }
        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
