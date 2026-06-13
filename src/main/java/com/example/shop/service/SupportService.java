package com.example.shop.service;

import com.example.shop.dto.SupportAdminSummaryResponse;
import com.example.shop.dto.SupportAdminSessionPageResponse;
import com.example.shop.entity.SupportMessage;
import com.example.shop.entity.SupportSession;
import com.example.shop.repository.SupportMessageMapper;
import com.example.shop.repository.SupportSessionMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class SupportService {
    private static final int DEFAULT_MESSAGE_LIMIT = 80;
    private static final int MAX_MESSAGE_LIMIT = 120;
    private static final int DEFAULT_SESSION_LIMIT = 12;
    private static final int MAX_SESSION_LIMIT = 30;
    private static final int DEFAULT_ADMIN_SESSION_PAGE_SIZE = 20;
    private static final int MAX_ADMIN_SESSION_PAGE_SIZE = 50;
    private static final Pattern HTML_ENTITY_PATTERN = Pattern.compile(
            "&(#(?:x[0-9a-fA-F]{1,6}|[0-9]{1,7})|lt|gt|amp|quot|apos);?",
            Pattern.CASE_INSENSITIVE);

    private final SupportSessionMapper supportSessionMapper;
    private final SupportMessageMapper supportMessageMapper;
    private final RuntimeConfigService runtimeConfig;
    private final ConcurrentMap<String, RateBucket> messageRateBuckets = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, Object> sessionCreationLocks = new ConcurrentHashMap<>();

    @Transactional(rollbackFor = Exception.class)
    public SupportSession getOrCreateOpenSession(Long userId) {
        SupportSession session = supportSessionMapper.findOpenByUserId(userId);
        return getOrCreateOpenSession(userId, null, session);
    }

    @Transactional(rollbackFor = Exception.class)
    public SupportSession getOrCreateOpenSession(Long userId, String contextKey) {
        String normalizedContextKey = normalizeContextKey(contextKey);
        if (normalizedContextKey == null) {
            return getOrCreateOpenSession(userId);
        }
        SupportSession session = supportSessionMapper.findOpenByUserIdAndContextKey(userId, normalizedContextKey);
        return getOrCreateOpenSession(userId, normalizedContextKey, session);
    }

    public SupportSession findOpenSession(Long userId) {
        return supportSessionMapper.findOpenByUserId(userId);
    }

    public SupportSession findOpenSession(Long userId, String contextKey) {
        String normalizedContextKey = normalizeContextKey(contextKey);
        if (normalizedContextKey == null) {
            return findOpenSession(userId);
        }
        return supportSessionMapper.findOpenByUserIdAndContextKey(userId, normalizedContextKey);
    }

    private SupportSession getOrCreateOpenSession(Long userId, String contextKey, SupportSession existingSession) {
        SupportSession session = existingSession;
        if (session != null) {
            return session;
        }
        String lockKey = sessionCreationLockKey(userId, contextKey);
        Object lock = sessionCreationLocks.computeIfAbsent(lockKey, key -> new Object());
        try {
            synchronized (lock) {
                SupportSession current = contextKey == null
                        ? supportSessionMapper.findOpenByUserId(userId)
                        : supportSessionMapper.findOpenByUserIdAndContextKey(userId, contextKey);
                if (current != null) {
                    return current;
                }
                session = new SupportSession();
                session.setUserId(userId);
                session.setContextKey(contextKey);
                session.setStatus("OPEN");
                session.setLastMessage("");
                session.setLastMessageAt(LocalDateTime.now());
                session.setCreatedAt(LocalDateTime.now());
                session.setUpdatedAt(LocalDateTime.now());
                supportSessionMapper.insert(session);
                return supportSessionMapper.findById(session.getId());
            }
        } finally {
            sessionCreationLocks.remove(lockKey, lock);
        }
    }

    private String sessionCreationLockKey(Long userId, String contextKey) {
        return String.valueOf(userId) + ":" + (contextKey == null ? "" : contextKey);
    }

    public SupportSession getLatestSession(Long userId) {
        SupportSession latest = supportSessionMapper.findLatestByUserId(userId);
        return latest != null ? latest : getOrCreateOpenSession(userId);
    }

    public SupportSession getSession(Long sessionId) {
        return supportSessionMapper.findById(sessionId);
    }

    public List<SupportSession> getUserSessions(Long userId) {
        return getUserSessions(userId, DEFAULT_SESSION_LIMIT);
    }

    public List<SupportSession> getUserSessions(Long userId, Integer limit) {
        return supportSessionMapper.findByUserId(userId, normalizeSessionLimit(limit));
    }

    public boolean isDefaultUserSession(SupportSession session) {
        return normalizeContextKey(session == null ? null : session.getContextKey()) == null;
    }

    public SupportAdminSessionPageResponse getAdminSessionPage(String status,
                                                               Boolean needsReply,
                                                               Long assignedAdminId,
                                                               String search,
                                                               Integer page,
                                                               Integer size) {
        int safeSize = normalizeAdminSessionPageSize(size);
        int safePage = normalizeAdminSessionPage(page);
        String safeStatus = normalizeAdminStatus(status);
        String safeSearch = normalizeAdminSearch(search);
        Long safeAssignedAdminId = assignedAdminId != null && assignedAdminId > 0 ? assignedAdminId : null;
        Boolean safeNeedsReply = Boolean.TRUE.equals(needsReply) ? Boolean.TRUE : null;
        long total = supportSessionMapper.countAdminPage(safeStatus, safeNeedsReply, safeAssignedAdminId, safeSearch);
        int totalPages = total <= 0 ? 0 : (int) Math.ceil((double) total / safeSize);
        if (totalPages > 0 && safePage > totalPages) {
            safePage = totalPages;
        }
        int offset = (safePage - 1) * safeSize;
        List<SupportSession> items = supportSessionMapper.findAdminPage(
                safeStatus, safeNeedsReply, safeAssignedAdminId, safeSearch, safeSize, offset);
        return SupportAdminSessionPageResponse.of(items, total, safePage, safeSize);
    }

    public SupportAdminSummaryResponse adminSummary(Long adminId) {
        int staleMinutes = Math.max(5, Math.min(runtimeConfig.getInt("support.admin.stale-minutes", 30), 24 * 60));
        Map<String, Object> row = supportSessionMapper.adminSummary(adminId, LocalDateTime.now().minusMinutes(staleMinutes));
        SupportAdminSummaryResponse response = new SupportAdminSummaryResponse();
        response.setTotalSessions(numberValue(row, "totalSessions"));
        response.setOpenSessions(numberValue(row, "openSessions"));
        response.setClosedSessions(numberValue(row, "closedSessions"));
        response.setUnreadSessions(numberValue(row, "unreadSessions"));
        response.setUnreadMessages(numberValue(row, "unreadMessages"));
        response.setUnassignedOpenSessions(numberValue(row, "unassignedOpenSessions"));
        response.setMyOpenSessions(numberValue(row, "myOpenSessions"));
        response.setStaleOpenSessions(numberValue(row, "staleOpenSessions"));
        response.setStaleMinutes(staleMinutes);
        response.setResponseScore(calculateResponseScore(response));
        response.setCheckedAt(Instant.now().toString());
        return response;
    }

    public List<SupportMessage> getMessages(Long sessionId) {
        return getMessages(sessionId, DEFAULT_MESSAGE_LIMIT, null);
    }

    public List<SupportMessage> getMessages(Long sessionId, Integer limit, Long afterId) {
        int normalizedLimit = normalizeMessageLimit(limit);
        Long normalizedAfterId = afterId != null && afterId > 0 ? afterId : null;
        if (normalizedAfterId != null) {
            return supportMessageMapper.findBySessionIdAfterId(sessionId, normalizedAfterId, normalizedLimit);
        }
        return supportMessageMapper.findRecentBySessionId(sessionId, normalizedLimit);
    }

    @Transactional(rollbackFor = Exception.class)
    public SupportMessage sendUserMessage(Long userId, Long sessionId, String content) {
        return sendUserMessage(userId, sessionId, content, null);
    }

    @Transactional(rollbackFor = Exception.class)
    public SupportMessage sendUserMessage(Long userId, Long sessionId, String content, String contextKey) {
        String normalizedContextKey = normalizeContextKey(contextKey);
        SupportSession session = null;
        if (sessionId != null) {
            session = supportSessionMapper.findById(sessionId);
            if (session == null) {
                throw new IllegalArgumentException("Support session not found");
            }
            if (!userId.equals(session.getUserId())) {
                throw new IllegalStateException("Forbidden");
            }
            assertContextMatches(session, normalizedContextKey);
        }
        if (session == null || !"OPEN".equals(session.getStatus())) {
            session = getOrCreateOpenSession(userId, normalizedContextKey);
        }
        return sendMessage(session.getId(), userId, "USER", content);
    }

    @Transactional(rollbackFor = Exception.class)
    public SupportMessage sendAdminMessage(Long adminId, Long sessionId, String content, String senderRole) {
        requireAdminSenderRole(senderRole);
        return sendMessageInternal(sessionId, adminId, "ADMIN", content);
    }

    @Transactional(rollbackFor = Exception.class)
    public SupportMessage sendMessage(Long sessionId, Long senderId, String senderRole, String content) {
        String normalizedRole = normalizeSenderRole(senderRole);
        if ("ADMIN".equals(normalizedRole)) {
            throw new IllegalStateException("Admin support messages must use the admin message entrypoint");
        }
        return sendMessageInternal(sessionId, senderId, normalizedRole, content);
    }

    private SupportMessage sendMessageInternal(Long sessionId, Long senderId, String senderRole, String content) {
        String normalizedContent = normalizeContent(content);
        if (normalizedContent.isEmpty()) {
            throw new IllegalArgumentException("Message content is required");
        }
        SupportSession session = supportSessionMapper.findById(sessionId);
        if (session == null) {
            throw new IllegalArgumentException("Support session not found");
        }
        if (!"OPEN".equals(session.getStatus())) {
            throw new IllegalStateException("Support session is closed");
        }
        if ("ADMIN".equals(senderRole) && session.getAssignedAdminId() == null) {
            supportSessionMapper.assignAdmin(sessionId, senderId);
        }
        consumeMessageRate(senderId, senderRole);
        SupportMessage message = new SupportMessage();
        message.setSessionId(sessionId);
        message.setSenderId(senderId);
        message.setSenderRole(senderRole);
        message.setContent(normalizedContent);
        message.setIsReadByUser("USER".equals(senderRole));
        message.setIsReadByAdmin("ADMIN".equals(senderRole));
        message.setCreatedAt(LocalDateTime.now());
        supportMessageMapper.insert(message);
        supportSessionMapper.updateLastMessage(sessionId, message.getContent());
        SupportMessage saved = supportMessageMapper.findById(message.getId());
        return saved == null ? message : saved;
    }

    private String normalizeSenderRole(String senderRole) {
        String normalized = senderRole == null ? "USER" : senderRole.trim().toUpperCase(Locale.ROOT);
        if (normalized.isEmpty() || "USER".equals(normalized)) {
            return "USER";
        }
        if (isAdminSenderRole(normalized)) {
            return "ADMIN";
        }
        throw new IllegalArgumentException("Unsupported support message sender role");
    }

    private void requireAdminSenderRole(String senderRole) {
        String normalized = senderRole == null ? "" : senderRole.trim().toUpperCase(Locale.ROOT);
        if (!isAdminSenderRole(normalized)) {
            throw new IllegalStateException("Admin role is required to send support messages");
        }
    }

    private boolean isAdminSenderRole(String senderRole) {
        return "ADMIN".equals(senderRole) || "SUPER_ADMIN".equals(senderRole);
    }

    private int normalizeMessageLimit(Integer limit) {
        int normalizedLimit = limit == null || limit <= 0 ? DEFAULT_MESSAGE_LIMIT : limit;
        return Math.max(1, Math.min(normalizedLimit, MAX_MESSAGE_LIMIT));
    }

    private int normalizeSessionLimit(Integer limit) {
        int normalizedLimit = limit == null || limit <= 0 ? DEFAULT_SESSION_LIMIT : limit;
        return Math.max(1, Math.min(normalizedLimit, MAX_SESSION_LIMIT));
    }

    private int normalizeAdminSessionPage(Integer page) {
        return Math.max(1, page == null || page <= 0 ? 1 : page);
    }

    private int normalizeAdminSessionPageSize(Integer size) {
        int configuredMax = runtimeConfig.getInt("support.admin.sessions.max-page-size", MAX_ADMIN_SESSION_PAGE_SIZE);
        int maxSize = Math.max(1, Math.min(configuredMax, 200));
        int normalizedSize = size == null || size <= 0 ? DEFAULT_ADMIN_SESSION_PAGE_SIZE : size;
        return Math.max(1, Math.min(normalizedSize, maxSize));
    }

    private String normalizeAdminStatus(String status) {
        if (status == null) {
            return null;
        }
        String normalized = status.replaceAll("[\\p{Cntrl}&&[^\\r\\n\\t]]", " ")
                .trim()
                .toUpperCase()
                .replaceAll("\\s+", "");
        if (normalized.isEmpty() || "ALL".equals(normalized)) {
            return null;
        }
        return normalized.length() <= 40 ? normalized : normalized.substring(0, 40);
    }

    private String normalizeAdminSearch(String search) {
        if (search == null) {
            return null;
        }
        String normalized = search.replaceAll("[\\p{Cntrl}&&[^\\r\\n\\t]]", " ")
                .trim()
                .replaceAll("\\s+", " ");
        if (normalized.isEmpty()) {
            return null;
        }
        return normalized.length() <= 120 ? normalized : normalized.substring(0, 120);
    }

    private String normalizeContent(String content) {
        String normalized = String.valueOf(content == null ? "" : content)
                .replaceAll("[\\p{Cntrl}&&[^\r\n\t]]", " ")
                .trim()
                .replaceAll("\\s+", " ");
        normalized = neutralizeHtmlAngles(decodeHtmlEntities(normalized))
                .replaceAll("[\\p{Cntrl}&&[^\r\n\t]]", " ")
                .trim()
                .replaceAll("\\s+", " ");
        int maxChars = runtimeConfig.getInt("support.message.max-chars",
                runtimeConfig.getInt("support.websocket.max-message-chars", 1000));
        maxChars = maxChars > 0 ? maxChars : 1000;
        if (normalized.length() > maxChars) {
            throw new IllegalArgumentException("Message is too long");
        }
        return normalized;
    }

    private String decodeHtmlEntities(String value) {
        String decoded = value;
        for (int i = 0; i < 3; i++) {
            Matcher matcher = HTML_ENTITY_PATTERN.matcher(decoded);
            StringBuffer buffer = new StringBuffer();
            boolean changed = false;
            while (matcher.find()) {
                String replacement = decodeHtmlEntity(matcher.group(1), matcher.group());
                if (!matcher.group().equals(replacement)) {
                    changed = true;
                }
                matcher.appendReplacement(buffer, Matcher.quoteReplacement(replacement));
            }
            matcher.appendTail(buffer);
            decoded = buffer.toString();
            if (!changed) {
                break;
            }
        }
        return decoded;
    }

    private String decodeHtmlEntity(String entity, String original) {
        String normalized = entity == null ? "" : entity.toLowerCase();
        switch (normalized) {
            case "lt":
                return "<";
            case "gt":
                return ">";
            case "amp":
                return "&";
            case "quot":
                return "\"";
            case "apos":
                return "'";
            default:
                if (normalized.startsWith("#x")) {
                    return codePointToString(normalized.substring(2), 16, original);
                }
                if (normalized.startsWith("#")) {
                    return codePointToString(normalized.substring(1), 10, original);
                }
                return original;
        }
    }

    private String codePointToString(String value, int radix, String original) {
        try {
            int codePoint = Integer.parseInt(value, radix);
            if (!Character.isValidCodePoint(codePoint)
                    || Character.isISOControl(codePoint)
                    || (codePoint >= Character.MIN_SURROGATE && codePoint <= Character.MAX_SURROGATE)) {
                return " ";
            }
            return new String(Character.toChars(codePoint));
        } catch (RuntimeException ignored) {
            return original;
        }
    }

    private String neutralizeHtmlAngles(String value) {
        return value.replace("<", "\uFF1C").replace(">", "\uFF1E");
    }

    private String normalizeContextKey(String contextKey) {
        if (contextKey == null || contextKey.trim().isEmpty()) {
            return null;
        }
        String normalized = contextKey.trim().toLowerCase()
                .replaceAll("[\\p{Cntrl}&&[^\\r\\n\\t]]", " ")
                .replaceAll("\\s+", " ")
                .replaceAll("[^a-z0-9:._-]", "_");
        if (normalized.isBlank()) {
            return null;
        }
        return normalized.length() <= 120 ? normalized : normalized.substring(0, 120);
    }

    private void assertContextMatches(SupportSession session, String contextKey) {
        String sessionContextKey = normalizeContextKey(session == null ? null : session.getContextKey());
        if (contextKey == null) {
            if (sessionContextKey != null) {
                throw new IllegalStateException("Forbidden");
            }
            return;
        }
        if (!contextKey.equals(sessionContextKey)) {
            throw new IllegalStateException("Forbidden");
        }
    }

    private void consumeMessageRate(Long senderId, String senderRole) {
        if (!runtimeConfig.getBoolean("support.message.rate-limit-enabled", true)) {
            return;
        }
        String normalizedRole = senderRole == null ? "USER" : senderRole.trim().toUpperCase();
        int defaultLimit = "ADMIN".equals(normalizedRole) ? 60 : 20;
        int maxPerMinute = runtimeConfig.getInt("support.message.max-per-minute", defaultLimit);
        if (maxPerMinute <= 0) {
            return;
        }
        long now = Instant.now().getEpochSecond();
        long windowStart = now - Math.floorMod(now, 60);
        String key = normalizedRole + ":" + senderId;
        RateBucket bucket = messageRateBuckets.compute(key, (ignored, current) -> {
            if (current == null || current.windowStart != windowStart) {
                return new RateBucket(windowStart, 1);
            }
            current.count++;
            return current;
        });
        if (bucket.count > maxPerMinute) {
            throw new IllegalStateException("Too many support messages. Please try again later.");
        }
        if (messageRateBuckets.size() > runtimeConfig.getInt("support.message.max-rate-buckets", 5000)) {
            cleanupMessageRateBucketsBefore(windowStart);
        }
    }

    @Scheduled(fixedDelayString = "${support.message.rate-bucket-cleanup-ms:300000}")
    public void cleanupMessageRateBuckets() {
        long now = Instant.now().getEpochSecond();
        long currentWindowStart = now - Math.floorMod(now, 60);
        cleanupMessageRateBucketsBefore(currentWindowStart);
    }

    private void cleanupMessageRateBucketsBefore(long windowStart) {
        messageRateBuckets.entrySet().removeIf(entry -> entry.getValue().windowStart < windowStart);
    }

    @Transactional(rollbackFor = Exception.class)
    public SupportSession closeSession(Long sessionId) {
        SupportSession session = supportSessionMapper.findById(sessionId);
        if (session == null) {
            throw new IllegalArgumentException("Support session not found");
        }
        if (!"CLOSED".equals(session.getStatus())) {
            supportSessionMapper.close(sessionId);
        }
        return supportSessionMapper.findById(sessionId);
    }

    @Transactional(rollbackFor = Exception.class)
    public SupportSession assignSession(Long sessionId, Long adminId) {
        SupportSession session = supportSessionMapper.findById(sessionId);
        if (session == null) {
            throw new IllegalArgumentException("Support session not found");
        }
        supportSessionMapper.assignAdmin(sessionId, adminId);
        return supportSessionMapper.findById(sessionId);
    }

    @Transactional(rollbackFor = Exception.class)
    public SupportSession reopenSession(Long sessionId, Long adminId) {
        SupportSession session = supportSessionMapper.findById(sessionId);
        if (session == null) {
            throw new IllegalArgumentException("Support session not found");
        }
        if ("OPEN".equals(session.getStatus())) {
            return assignSession(sessionId, adminId);
        }
        supportSessionMapper.reopen(sessionId, adminId);
        return supportSessionMapper.findById(sessionId);
    }

    @Transactional(rollbackFor = Exception.class)
    public void markRead(Long sessionId, String role) {
        if ("ADMIN".equals(role)) {
            supportMessageMapper.markReadByAdmin(sessionId);
        } else {
            supportMessageMapper.markReadByUser(sessionId);
        }
    }

    public int countUnreadByAdmin() {
        return supportMessageMapper.countUnreadByAdmin();
    }

    public int countUnreadByUser(Long userId) {
        return supportMessageMapper.countUnreadByUser(userId);
    }

    private int calculateResponseScore(SupportAdminSummaryResponse summary) {
        long rawScore = 100
                - summary.getUnreadSessions() * 10
                - summary.getUnassignedOpenSessions() * 8
                - summary.getStaleOpenSessions() * 18;
        return (int) Math.max(0, Math.min(100, rawScore));
    }

    private long numberValue(Map<String, Object> row, String key) {
        if (row == null || row.isEmpty()) {
            return 0;
        }
        Object value = row.get(key);
        if (value == null) {
            String snake = camelToSnake(key);
            value = row.get(snake);
            if (value == null) {
                value = row.get(snake.toUpperCase());
            }
        }
        if (value == null) {
            value = row.get(key.toLowerCase());
        }
        if (value == null) {
            value = row.get(key.toUpperCase());
        }
        return value instanceof Number ? ((Number) value).longValue() : 0;
    }

    private String camelToSnake(String value) {
        return value.replaceAll("([a-z])([A-Z])", "$1_$2").toLowerCase();
    }

    private static class RateBucket {
        private final long windowStart;
        private int count;

        private RateBucket(long windowStart, int count) {
            this.windowStart = windowStart;
            this.count = count;
        }
    }
}
