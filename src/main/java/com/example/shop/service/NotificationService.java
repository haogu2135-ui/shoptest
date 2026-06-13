package com.example.shop.service;

import com.example.shop.entity.Notification;
import com.example.shop.repository.NotificationMapper;
import com.example.shop.repository.UserMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import lombok.RequiredArgsConstructor;
import java.net.URI;
import java.net.URISyntaxException;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {
    private final NotificationMapper notificationMapper;
    private final UserMapper userMapper;
    private final TransactionTemplate transactionTemplate;
    private static final int DEFAULT_PAGE = 1;
    private static final int DEFAULT_PAGE_SIZE = 20;
    private static final int MAX_PAGE_SIZE = 100;
    private static final int BROADCAST_BATCH_SIZE = 500;
    private static final int MAX_BROADCAST_TITLE_LENGTH = 100;
    private static final int MAX_BROADCAST_MESSAGE_LENGTH = 5000;
    private static final Set<String> BLOCKED_HTML_TAGS = Set.of(
            "script", "iframe", "object", "embed", "link", "meta", "style", "form", "input",
            "button", "svg", "math", "frame", "frameset", "base");
    private static final Set<String> URL_ATTRIBUTES = Set.of("href", "src", "xlink:href", "action", "formaction");
    private static final Set<String> ALLOWED_ANCHOR_TARGETS = Set.of("_blank", "_self", "_parent", "_top");
    private static final Pattern HTML_COMMENT_PATTERN = Pattern.compile("(?is)<!--.*?-->");
    private static final Pattern BLOCKED_ELEMENT_PATTERN = Pattern.compile("(?is)<\\s*(script|iframe|object|embed|link|meta|style|form|input|button|svg|math|frame|frameset|base)\\b[^>]*>.*?<\\s*/\\s*\\1\\s*>");
    private static final Pattern BLOCKED_TAG_PATTERN = Pattern.compile("(?is)<\\s*/?\\s*(script|iframe|object|embed|link|meta|style|form|input|button|svg|math|frame|frameset|base)\\b[^>]*>");
    private static final Pattern START_TAG_PATTERN = Pattern.compile("(?is)<([a-z][a-z0-9:-]*)([\\s/]+[^<>]*?)?>");
    private static final Pattern ATTRIBUTE_PATTERN = Pattern.compile("(?is)([a-z_:][a-z0-9_:\\-]*)(?:\\s*=\\s*(\"[^\"]*\"|'[^']*'|[^\\s\"'=<>`]+))?");

    public List<Notification> getNotifications(Long userId) {
        return getNotifications(userId, DEFAULT_PAGE, DEFAULT_PAGE_SIZE);
    }

    public List<Notification> getNotifications(Long userId, Integer page, Integer size) {
        int normalizedPage = page == null || page < 1 ? DEFAULT_PAGE : page;
        int normalizedSize = size == null || size < 1 ? DEFAULT_PAGE_SIZE : Math.min(size, MAX_PAGE_SIZE);
        long offsetLong = (long) (normalizedPage - 1) * normalizedSize;
        int offset = offsetLong > Integer.MAX_VALUE ? Integer.MAX_VALUE : (int) offsetLong;
        return notificationMapper.findByUserIdPage(userId, normalizedSize, offset);
    }

    public Notification getNotification(Long id) {
        return notificationMapper.findById(id);
    }

    public int getUnreadCount(Long userId) {
        return notificationMapper.countUnread(userId);
    }

    @Transactional(rollbackFor = Exception.class)
    public void createNotification(Long userId, String type, String title, String message) {
        Notification n = new Notification();
        n.setUserId(userId);
        n.setType(normalizeType(type));
        n.setTitle(title);
        n.setMessage(message);
        n.setContentFormat("TEXT");
        n.setIsRead(false);
        n.setCreatedAt(LocalDateTime.now());
        notificationMapper.insert(n);
    }

    @Transactional(rollbackFor = Exception.class, propagation = Propagation.REQUIRES_NEW)
    public boolean tryCreateNotification(Long userId, String type, String title, String message) {
        try {
            createNotification(userId, type, title, message);
            return true;
        } catch (RuntimeException e) {
            log.warn("Customer notification creation failed: userId={}, type={}, title={}", userId, normalizeType(type), title, e);
            return false;
        }
    }

    public int broadcastToCustomers(String type, String title, String message, String contentFormat) {
        String normalizedTitle = title == null ? "" : title.trim();
        String rawMessage = message == null ? "" : message.trim();
        if (normalizedTitle.isEmpty()) {
            throw new IllegalArgumentException("Title is required");
        }
        if (normalizedTitle.length() > MAX_BROADCAST_TITLE_LENGTH) {
            throw new IllegalArgumentException("Title must be 100 characters or fewer");
        }
        if (rawMessage.isEmpty()) {
            throw new IllegalArgumentException("Message is required");
        }
        if (rawMessage.length() > MAX_BROADCAST_MESSAGE_LENGTH) {
            throw new IllegalArgumentException("Message must be 5000 characters or fewer");
        }
        String normalizedFormat = normalizeFormat(contentFormat);
        String normalizedMessage = normalizeMessage(rawMessage, normalizedFormat);
        if (normalizedMessage.isEmpty()) {
            throw new IllegalArgumentException("Message is required");
        }
        LocalDateTime now = LocalDateTime.now();
        int sent = 0;
        long lastId = 0L;
        while (true) {
            List<Long> customerIds = userMapper.findActiveCustomerIdsAfter(lastId, BROADCAST_BATCH_SIZE);
            if (customerIds.isEmpty()) {
                return sent;
            }
            sent += transactionTemplate.execute(status ->
                    insertBroadcastBatch(customerIds, type, normalizedTitle, normalizedMessage, normalizedFormat, now));
            lastId = customerIds.get(customerIds.size() - 1);
        }
    }

    int insertBroadcastBatch(List<Long> customerIds,
                             String type,
                             String title,
                             String message,
                             String contentFormat,
                             LocalDateTime createdAt) {
        List<Notification> notifications = customerIds.stream()
            .map(userId -> {
                Notification n = new Notification();
                n.setUserId(userId);
                n.setType(normalizeType(type));
                n.setTitle(title.trim());
                n.setMessage(message);
                n.setContentFormat(contentFormat);
                n.setIsRead(false);
                n.setCreatedAt(createdAt);
                return n;
            })
            .collect(Collectors.toList());
        if (notifications.isEmpty()) {
            return 0;
        }
        return notificationMapper.insertBatch(notifications);
    }

    @Transactional(rollbackFor = Exception.class)
    public void markAsRead(Long id) {
        notificationMapper.markAsRead(id);
    }

    @Transactional(rollbackFor = Exception.class)
    public void markAllAsRead(Long userId) {
        notificationMapper.markAllAsRead(userId);
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteNotification(Long id) {
        notificationMapper.deleteById(id);
    }

    private String normalizeType(String type) {
        String normalized = type == null || type.trim().isEmpty()
                ? "SYSTEM"
                : type.trim().toUpperCase(Locale.ROOT);
        return "PROMOTION".equals(normalized) || "ORDER".equals(normalized) || "DELIVERY".equals(normalized)
                ? normalized
                : "SYSTEM";
    }

    private String normalizeFormat(String contentFormat) {
        String normalized = contentFormat == null || contentFormat.trim().isEmpty()
                ? "TEXT"
                : contentFormat.trim().toUpperCase(Locale.ROOT);
        return "HTML".equals(normalized) ? "HTML" : "TEXT";
    }

    private String normalizeMessage(String message, String contentFormat) {
        String trimmed = message == null ? "" : message.trim();
        if (!"HTML".equals(contentFormat)) {
            return trimmed;
        }
        return sanitizeHtml(trimmed).trim();
    }

    private String sanitizeHtml(String html) {
        String sanitized = HTML_COMMENT_PATTERN.matcher(html == null ? "" : html).replaceAll("");
        String previous;
        do {
            previous = sanitized;
            sanitized = BLOCKED_ELEMENT_PATTERN.matcher(sanitized).replaceAll("");
            sanitized = BLOCKED_TAG_PATTERN.matcher(sanitized).replaceAll("");
        } while (!previous.equals(sanitized));

        Matcher matcher = START_TAG_PATTERN.matcher(sanitized);
        StringBuffer buffer = new StringBuffer();
        while (matcher.find()) {
            String tagName = matcher.group(1).toLowerCase(Locale.ROOT);
            String replacement = BLOCKED_HTML_TAGS.contains(tagName)
                    ? ""
                    : rebuildStartTag(tagName, matcher.group(2));
            matcher.appendReplacement(buffer, Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(buffer);
        return buffer.toString();
    }

    private String rebuildStartTag(String tagName, String attributeSource) {
        Map<String, String> attributes = new LinkedHashMap<>();
        if (attributeSource != null && !attributeSource.isBlank()) {
            Matcher matcher = ATTRIBUTE_PATTERN.matcher(attributeSource);
            while (matcher.find()) {
                String name = matcher.group(1).toLowerCase(Locale.ROOT);
                String value = unquoteAttributeValue(matcher.group(2));
                if (isUnsafeAttribute(name, value)) {
                    continue;
                }
                if (URL_ATTRIBUTES.contains(name) && !isAllowedHtmlUrl(value)) {
                    continue;
                }
                if ("target".equals(name) && "a".equals(tagName)) {
                    String normalizedTarget = value.toLowerCase(Locale.ROOT);
                    if (!ALLOWED_ANCHOR_TARGETS.contains(normalizedTarget)) {
                        continue;
                    }
                    attributes.put(name, normalizedTarget);
                    continue;
                }
                attributes.put(name, value);
            }
        }
        if ("a".equals(tagName) && "_blank".equals(attributes.get("target"))) {
            attributes.put("rel", "noopener noreferrer");
        }
        StringBuilder builder = new StringBuilder("<").append(tagName);
        attributes.forEach((name, value) -> builder.append(' ')
                .append(name)
                .append("=\"")
                .append(escapeAttributeValue(value))
                .append('"'));
        return builder.append('>').toString();
    }

    private boolean isUnsafeAttribute(String name, String value) {
        return name.startsWith("on")
                || "srcdoc".equals(name)
                || "style".equals(name)
                || hasUnsafeControlCharacter(name)
                || hasUnsafeControlCharacter(value);
    }

    private boolean isAllowedHtmlUrl(String value) {
        String trimmed = value == null ? "" : value.trim();
        if (trimmed.isEmpty() || trimmed.startsWith("#")) {
            return true;
        }
        String normalized = trimmed.toLowerCase(Locale.ROOT);
        if (hasUnsafeControlCharacter(trimmed)
                || trimmed.contains("\\")
                || normalized.contains("%00")
                || normalized.contains("%5c")
                || trimmed.startsWith("//")
                || trimmed.startsWith("\\\\")) {
            return false;
        }
        if (trimmed.startsWith("/")) {
            return true;
        }
        try {
            URI uri = new URI(trimmed);
            if (uri.getScheme() == null) {
                return true;
            }
            String scheme = uri.getScheme().toLowerCase(Locale.ROOT);
            return uri.getUserInfo() == null && Set.of("http", "https", "mailto", "tel").contains(scheme);
        } catch (URISyntaxException e) {
            return false;
        }
    }

    private boolean hasUnsafeControlCharacter(String value) {
        if (value == null) {
            return false;
        }
        for (int i = 0; i < value.length(); i++) {
            char ch = value.charAt(i);
            if (ch <= 31 || ch == 127) {
                return true;
            }
        }
        return false;
    }

    private String unquoteAttributeValue(String raw) {
        if (raw == null) {
            return "";
        }
        String value = raw.trim();
        if (value.length() >= 2
                && (value.startsWith("\"") && value.endsWith("\"") || value.startsWith("'") && value.endsWith("'"))) {
            return value.substring(1, value.length() - 1);
        }
        return value;
    }

    private String escapeAttributeValue(String value) {
        return (value == null ? "" : value)
                .replace("&", "&amp;")
                .replace("\"", "&quot;")
                .replace("<", "&lt;")
                .replace(">", "&gt;");
    }
}
