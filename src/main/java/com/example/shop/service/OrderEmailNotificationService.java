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
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
public class OrderEmailNotificationService {
    private static final String DEFAULT_STOREFRONT_BASE_URL = "https://petsanything.com";
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private final MailAccountProperties mailAccountProperties;
    private final Map<String, JavaMailSenderImpl> mailSenderCache = new ConcurrentHashMap<>();

    @Value("${app.storefront-base-url:https://petsanything.com}")
    private String storefrontBaseUrlConfig = "https://petsanything.com";

    @Transactional(rollbackFor = Exception.class, propagation = Propagation.NOT_SUPPORTED)
    public boolean trySendOrderStatusEmail(String email, String title, String message) {
        String normalizedEmail = normalizeEmail(email);
        String normalizedTitle = title == null ? "" : title.trim();
        String normalizedMessage = message == null ? "" : message.trim();
        if (normalizedEmail == null || normalizedTitle.isEmpty() || normalizedMessage.isEmpty()) {
            return false;
        }
        List<MailAccountProperties.Account> accounts = randomizedConfiguredAccounts();
        if (accounts.isEmpty()) {
            return false;
        }
        Exception lastFailure = null;
        for (MailAccountProperties.Account account : accounts) {
            try {
                sendMailWithAccount(account, normalizedEmail, normalizedTitle, normalizedMessage);
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
            String from = account.getFrom().trim();
            helper.setFrom(from, brandName);
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
        String storefrontBaseUrl = storefrontBaseUrl();
        String ordersUrl = escapeHtml(storefrontBaseUrl + "/profile?tab=orders");
        String trackUrl = escapeHtml(storefrontBaseUrl + "/track-order");
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
                + eyebrow + "</div>"
                + "<div style=\"font-size:18px;font-weight:700;margin-bottom:12px;color:#173f2b;\">" + safeTitle + "</div>"
                + "<div style=\"font-size:15px;line-height:1.65;color:#3d4f44;margin-bottom:22px;\">" + safeMessage + "</div>"
                + "<div style=\"margin:0 0 18px 0;\">"
                + "<a href=\"" + ordersUrl + "\" style=\"display:inline-block;background:#ee4d2d;color:#ffffff;"
                + "text-decoration:none;font-weight:700;font-size:14px;padding:12px 18px;border-radius:8px;\">"
                + ordersCta + "</a>"
                + "<a href=\"" + trackUrl + "\" style=\"display:inline-block;margin-left:10px;background:#ffffff;color:#173f2b;"
                + "text-decoration:none;font-weight:700;font-size:14px;padding:11px 16px;border-radius:8px;"
                + "border:1px solid #d5e0d7;\">" + trackCta + "</a>"
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
        String configured = trimmedOrNull(storefrontBaseUrlConfig);
        if (configured == null) {
            configured = trimmedOrNull(System.getProperty("app.storefront-base-url"));
        }
        if (configured == null) {
            configured = trimmedOrNull(System.getenv("STOREFRONT_BASE_URL"));
        }
        if (configured == null) {
            configured = DEFAULT_STOREFRONT_BASE_URL;
        }
        int end = configured.length();
        while (end > 0 && configured.charAt(end - 1) == '/') {
            end--;
        }
        return end == configured.length() ? configured : configured.substring(0, end);
    }

    private List<MailAccountProperties.Account> randomizedConfiguredAccounts() {
        List<MailAccountProperties.Account> accounts = configuredAccounts();
        if (accounts.isEmpty()) {
            return accounts;
        }
        Collections.shuffle(accounts);
        return accounts;
    }

    private List<MailAccountProperties.Account> configuredAccounts() {
        if (mailAccountProperties.getAccounts() == null) {
            return Collections.emptyList();
        }
        List<MailAccountProperties.Account> configured = mailAccountProperties.getAccounts();
        List<MailAccountProperties.Account> valid = new ArrayList<>(configured.size());
        for (MailAccountProperties.Account account : configured) {
            if (!isBlank(account.getHost())
                    && account.getPort() != null && account.getPort() > 0
                    && !isBlank(account.getUsername())
                    && !isBlank(account.getPassword())
                    && !isBlank(account.getFrom())) {
                valid.add(account);
            }
        }
        return valid;
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
                + "|" + Integer.toHexString(account.getPassword().trim().hashCode());
    }

    private String normalizeEmail(String email) {
        if (email == null) {
            return null;
        }
        String trimmed = email.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        String normalized = trimmed.toLowerCase(Locale.ROOT);
        return EMAIL_PATTERN.matcher(normalized).matches() ? normalized : null;
    }

    private String normalizeForKey(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private String brandName() {
        String configuredBrand = mailAccountProperties.getBrandName();
        if (configuredBrand == null) {
            return "ShopMX";
        }
        String normalizedBrand = configuredBrand.trim();
        return normalizedBrand.isEmpty() ? "ShopMX" : normalizedBrand;
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
        boolean requiresEscaping = false;
        for (int i = 0; i < value.length(); i++) {
            char character = value.charAt(i);
            if (character == '&' || character == '<' || character == '>'
                    || character == '"' || character == '\'') {
                requiresEscaping = true;
                break;
            }
        }
        if (!requiresEscaping) {
            return value;
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

    private String trimmedOrNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
