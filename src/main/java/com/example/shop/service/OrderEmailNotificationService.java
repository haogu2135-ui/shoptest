package com.example.shop.service;

import com.example.shop.config.MailAccountProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
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

    @Value("${app.storefront-base-url:https://pet.686888666.xyz}")
    private String storefrontBaseUrlConfig = "https://pet.686888666.xyz";

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
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
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

    String renderHtml(String brandName, String title, String messageText) {
        String language = detectEmailLanguage(title, messageText);
        String safeBrand = escapeHtml(brandName);
        String safeTitle = escapeHtml(title);
        String safeMessage = escapeHtml(messageText).replace("\n", "<br/>");
        String ordersUrl = escapeHtml(storefrontOrdersUrl());
        String trackUrl = escapeHtml(storefrontTrackUrl());
        String eyebrow = emailCopy(language, "ORDER_UPDATE", "订单动态", "Actualización del pedido");
        String ordersCta = emailCopy(language, "View my orders", "查看我的订单", "Ver mis pedidos");
        String trackCta = emailCopy(language, "Track order", "物流查询", "Rastrear pedido");
        String footer = emailCopy(
                language,
                "You are receiving this email because there was an update on your " + brandName + " order. If you did not place this order, contact support from your account.",
                "您收到此邮件是因为您在 " + brandName + " 的订单状态有更新。如非本人操作，请通过账户联系客服。",
                "Recibiste este correo porque hubo una actualización en tu pedido de " + brandName + ". Si no realizaste este pedido, contacta a soporte desde tu cuenta."
        );
        String langAttr = "zh".equals(language) ? "zh-CN" : ("es".equals(language) ? "es-MX" : "en");
        return "<!doctype html>"
                + "<html lang=\"" + langAttr + "\"><head><meta charset=\"UTF-8\"/>"
                + "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"/>"
                + "<title>" + safeTitle + "</title></head>"
                + "<body style=\"margin:0;background:#f6f8f6;font-family:Arial,Helvetica,sans-serif;color:#173f2b;\">"
                + "<div style=\"display:none;max-height:0;overflow:hidden;opacity:0;\">" + safeTitle + " — " + safeBrand + "</div>"
                + "<div style=\"max-width:560px;margin:0 auto;padding:28px 16px;\">"
                + "<div style=\"background:#ffffff;border:1px solid #e4ebe4;border-radius:10px;padding:28px 24px;\">"
                + "<div style=\"font-size:22px;font-weight:800;color:#ee4d2d;margin-bottom:6px;\">" + safeBrand + "</div>"
                + "<div style=\"font-size:12px;letter-spacing:0.04em;text-transform:uppercase;color:#7a8a80;margin-bottom:16px;\">"
                + escapeHtml(eyebrow) + "</div>"
                + "<div style=\"font-size:18px;font-weight:700;margin-bottom:12px;color:#173f2b;\">" + safeTitle + "</div>"
                + "<div style=\"font-size:15px;line-height:1.65;color:#3d4f44;margin-bottom:22px;\">" + safeMessage + "</div>"
                + "<div style=\"margin:0 0 18px 0;\">"
                + "<a href=\"" + ordersUrl + "\" style=\"display:inline-block;background:#ee4d2d;color:#ffffff;"
                + "text-decoration:none;font-weight:700;font-size:14px;padding:12px 18px;border-radius:8px;\">"
                + escapeHtml(ordersCta) + "</a>"
                + "<a href=\"" + trackUrl + "\" style=\"display:inline-block;margin-left:10px;background:#ffffff;color:#173f2b;"
                + "text-decoration:none;font-weight:700;font-size:14px;padding:11px 16px;border-radius:8px;"
                + "border:1px solid #d5e0d7;\">" + escapeHtml(trackCta) + "</a>"
                + "</div>"
                + "<div style=\"font-size:12px;line-height:1.55;color:#7a8a80;border-top:1px solid #eef3ef;padding-top:14px;\">"
                + escapeHtml(footer)
                + "</div>"
                + "</div>"
                + "<div style=\"text-align:center;font-size:11px;color:#9aa79f;margin-top:14px;\">&copy; " + safeBrand + "</div>"
                + "</div></body></html>";
    }

    private String detectEmailLanguage(String title, String messageText) {
        String sample = ((title == null ? "" : title) + " " + (messageText == null ? "" : messageText)).trim();
        if (sample.isEmpty()) {
            return "en";
        }
        for (int i = 0; i < sample.length(); i++) {
            char ch = sample.charAt(i);
            if (Character.UnicodeScript.of(ch) == Character.UnicodeScript.HAN) {
                return "zh";
            }
        }
        String lower = sample.toLowerCase(Locale.ROOT);
        if (lower.contains("pedido")
                || lower.contains("pago")
                || lower.contains("envío")
                || lower.contains("envio")
                || lower.contains("reembolso")
                || lower.contains("guía")
                || lower.contains("guia")) {
            return "es";
        }
        return "en";
    }

    private String emailCopy(String language, String en, String zh, String es) {
        if ("zh".equals(language)) {
            return zh;
        }
        if ("es".equals(language)) {
            return es;
        }
        return en;
    }

    private String storefrontOrdersUrl() {
        return storefrontBaseUrl() + "/profile?tab=orders";
    }

    private String storefrontTrackUrl() {
        return storefrontBaseUrl() + "/track-order";
    }

    private String storefrontBaseUrl() {
        String configured = storefrontBaseUrlConfig;
        if (isBlank(configured)) {
            configured = System.getProperty("app.storefront-base-url");
        }
        if (isBlank(configured)) {
            configured = System.getenv("STOREFRONT_BASE_URL");
        }
        if (isBlank(configured)) {
            configured = "https://pet.686888666.xyz";
        }
        return configured.trim().replaceAll("/+$", "");
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
