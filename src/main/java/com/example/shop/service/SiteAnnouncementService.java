package com.example.shop.service;

import com.example.shop.dto.SiteAnnouncementAdminPageResponse;
import com.example.shop.dto.SiteAnnouncementAdminSummaryResponse;
import com.example.shop.dto.SiteAnnouncementPublicResponse;
import com.example.shop.entity.SiteAnnouncement;
import com.example.shop.repository.SiteAnnouncementRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.net.URISyntaxException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.ArrayList;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
public class SiteAnnouncementService {
    private static final int DEFAULT_ACTIVE_LIMIT = 10;
    private static final int DEFAULT_ADMIN_PAGE_SIZE = 20;
    private static final int DEFAULT_ADMIN_PAGE_MAX_SIZE = 100;
    private static final int PLACEHOLDER_SCAN_BATCH_SIZE = 100;
    private static final int DEFAULT_TITLE_MAX_CHARS = 120;
    private static final int DEFAULT_CONTENT_MAX_CHARS = 500;
    private static final int DEFAULT_LINK_URL_MAX_CHARS = 500;
    private static final PageRequest PLACEHOLDER_SCAN_PAGE = PageRequest.of(0, PLACEHOLDER_SCAN_BATCH_SIZE);
    private static final Sort ADMIN_SORT = Sort.by(Sort.Order.asc("sortOrder"), Sort.Order.desc("id"));
    private static final Pattern PLACEHOLDER_COPY_PATTERN = Pattern.compile(
            "(?i)(^|\\b)(test|testing|dummy|placeholder|lorem|ipsum|asdf|qwer|sadsad|foobar|sample|demo|xxx|yyyy|zzzz|junk|garbage|qa|tmp|temp|hello\\s*world|foo\\s*bar)(\\b|$)");
    private static final Pattern REPEATED_CHARACTER_PATTERN = Pattern.compile("(?i)([a-z])\\1{4,}");
    private static final Pattern LONG_ALPHANUMERIC_TOKEN_PATTERN = Pattern.compile("(?i)\\b[a-z0-9]{18,}\\b");
    private static final Pattern KEYBOARD_MASH_PATTERN = Pattern.compile(
            "(?i)(qwerty|asdfgh|zxcvbn|123456789|987654321|abcdefg|aabbcc|abcabc)");
    private static final Pattern ANNOUNCEMENT_WHITESPACE_PATTERN = Pattern.compile("\\s+");
    private static final Pattern ANNOUNCEMENT_CONTROL_PATTERN = Pattern.compile("[\\r\\n\\t]+");

    private final SiteAnnouncementRepository repository;
    private final RuntimeConfigService runtimeConfig;

    @EventListener(ApplicationReadyEvent.class)
    @Transactional(rollbackFor = Exception.class)
    public void deactivatePlaceholderActiveAnnouncements() {
        long lastId = 0L;
        while (true) {
            List<SiteAnnouncement> batch = repository
                    .findByStatusIgnoreCaseAndIdGreaterThanOrderByIdAsc(
                            "ACTIVE", lastId, PLACEHOLDER_SCAN_PAGE);
            if (batch == null || batch.isEmpty()) {
                return;
            }
            List<SiteAnnouncement> invalidActiveAnnouncements = new ArrayList<>(batch.size());
            for (SiteAnnouncement announcement : batch) {
                if (hasPlaceholderOrGibberishCopy(announcement)) invalidActiveAnnouncements.add(announcement);
            }
            if (!invalidActiveAnnouncements.isEmpty()) {
                for (SiteAnnouncement announcement : invalidActiveAnnouncements) {
                    announcement.setStatus("INACTIVE");
                }
                repository.saveAll(invalidActiveAnnouncements);
                log.warn("Deactivated {} active site announcement(s) that matched QA/test placeholder content guards",
                        invalidActiveAnnouncements.size());
            }
            long scanAfterId = lastId;
            Long nextId = null;
            for (SiteAnnouncement announcement : batch) {
                Long id = announcement.getId();
                if (id != null && id > scanAfterId && (nextId == null || id > nextId)) nextId = id;
            }
            if (nextId == null || batch.size() < PLACEHOLDER_SCAN_BATCH_SIZE) {
                return;
            }
            lastId = nextId;
        }
    }

    @Transactional(rollbackFor = Exception.class, readOnly = true)
    public SiteAnnouncementAdminPageResponse findAdminPage(int page, int size, String status, String keyword) {
        int safeSize = clamp(size <= 0 ? DEFAULT_ADMIN_PAGE_SIZE : size, 1, adminPageMaxSize());
        int safePage = Math.max(1, page);
        String safeStatus = normalizeStatusFilter(status);
        String keywordPattern = searchKeywordPattern(keyword);
        Page<SiteAnnouncement> result = repository.searchAdmin(
                safeStatus,
                keywordPattern,
                PageRequest.of(safePage - 1, safeSize, ADMIN_SORT));
        if (result.getTotalPages() > 0 && safePage > result.getTotalPages()) {
            safePage = result.getTotalPages();
            result = repository.searchAdmin(
                    safeStatus,
                    keywordPattern,
                    PageRequest.of(safePage - 1, safeSize, ADMIN_SORT));
        }
        return SiteAnnouncementAdminPageResponse.of(result.getContent(), result.getTotalElements(), safePage, safeSize);
    }

    @Transactional(rollbackFor = Exception.class, readOnly = true)
    public List<SiteAnnouncementPublicResponse> findActive(int limit) {
        int safeLimit = clamp(limit, 1, activeLimit());
        int fetchLimit = Math.max(safeLimit, Math.min(activeLimit(), safeLimit * 4));
        List<SiteAnnouncement> announcements = repository.findActive(LocalDateTime.now(), PageRequest.of(0, fetchLimit));
        if (announcements == null || announcements.isEmpty()) {
            return List.of();
        }
        List<SiteAnnouncementPublicResponse> result = new ArrayList<>(Math.min(safeLimit, announcements.size()));
        for (SiteAnnouncement announcement : announcements) {
            if (announcement == null || !isPubliclyDisplayable(announcement)) continue;
            result.add(toPublicAnnouncement(announcement));
            if (result.size() >= safeLimit) break;
        }
        return result;
    }

    @Transactional(rollbackFor = Exception.class, readOnly = true)
    public SiteAnnouncementAdminSummaryResponse adminSummary() {
        return adminSummary(null, null);
    }

    @Transactional(rollbackFor = Exception.class, readOnly = true)
    public SiteAnnouncementAdminSummaryResponse adminSummary(String status, String keyword) {
        LocalDateTime now = LocalDateTime.now();
        String safeStatus = normalizeStatusFilter(status);
        String keywordPattern = searchKeywordPattern(keyword);
        SiteAnnouncementAdminSummaryResponse response = new SiteAnnouncementAdminSummaryResponse();
        List<Object[]> metricRows = repository.summarizeAdminMetrics(safeStatus, keywordPattern, now);
        Object[] metrics = metricRows == null || metricRows.isEmpty() ? null : metricRows.get(0);
        response.setTotalAnnouncements(metricValue(metrics, 0));
        response.setActiveAnnouncements(metricValue(metrics, 1));
        response.setScheduledAnnouncements(metricValue(metrics, 2));
        response.setExpiredAnnouncements(metricValue(metrics, 3));
        response.setInactiveAnnouncements(metricValue(metrics, 4));
        response.setLinkedAnnouncements(metricValue(metrics, 5));
        response.setMaxActiveRows(activeLimit());
        response.setTitleMaxChars(titleMaxChars());
        response.setContentMaxChars(contentMaxChars());
        response.setLinkUrlMaxChars(linkUrlMaxChars());
        response.setCheckedAt(now);
        return response;
    }

    private long metricValue(Object[] metrics, int index) {
        if (metrics == null || index < 0 || index >= metrics.length || !(metrics[index] instanceof Number)) {
            return 0L;
        }
        return ((Number) metrics[index]).longValue();
    }

    @Transactional(rollbackFor = Exception.class)
    public SiteAnnouncement save(SiteAnnouncement announcement) {
        if (announcement == null) {
            throw new IllegalArgumentException("Announcement is required");
        }
        validate(announcement);
        normalize(announcement);
        return repository.save(announcement);
    }

    @Transactional(rollbackFor = Exception.class)
    public SiteAnnouncement update(Long id, SiteAnnouncement announcement) {
        if (announcement == null) {
            throw new IllegalArgumentException("Announcement is required");
        }
        SiteAnnouncement existing = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Announcement not found"));
        existing.setTitle(announcement.getTitle());
        existing.setContent(announcement.getContent());
        existing.setLinkUrl(announcement.getLinkUrl());
        existing.setStatus(announcement.getStatus());
        existing.setSortOrder(announcement.getSortOrder());
        existing.setStartsAt(announcement.getStartsAt());
        existing.setEndsAt(announcement.getEndsAt());
        validate(existing);
        normalize(existing);
        return repository.save(existing);
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteById(Long id) {
        repository.deleteById(id);
    }

    private void validate(SiteAnnouncement announcement) {
        String title = announcement.getTitle();
        String content = announcement.getContent();
        String trimmedTitle = title == null ? "" : title.trim();
        String trimmedContent = content == null ? "" : content.trim();
        if (trimmedTitle.isEmpty()) {
            throw new IllegalArgumentException("Title is required");
        }
        if (trimmedContent.isEmpty()) {
            throw new IllegalArgumentException("Content is required");
        }
        if (trimmedTitle.length() > titleMaxChars()) {
            throw new IllegalArgumentException("Title is too long");
        }
        if (trimmedContent.length() > contentMaxChars()) {
            throw new IllegalArgumentException("Content is too long");
        }
        String status = normalizeStatus(announcement.getStatus());
        if (!"ACTIVE".equals(status) && !"INACTIVE".equals(status)) {
            throw new IllegalArgumentException("Unsupported announcement status");
        }
        if ("ACTIVE".equals(status) && hasPlaceholderOrGibberishCopy(announcement)) {
            throw new IllegalArgumentException("Active announcement appears to contain QA/test placeholder content");
        }
        String linkUrl = announcement.getLinkUrl();
        String trimmedLink = linkUrl == null ? "" : linkUrl.trim();
        if (!trimmedLink.isEmpty()) {
            if (trimmedLink.length() > linkUrlMaxChars()) {
                throw new IllegalArgumentException("Link URL is too long");
            }
            if (!isSafeLinkUrl(trimmedLink)) {
                throw new IllegalArgumentException("Link URL must be a relative path or an HTTPS URL");
            }
        }
        if (announcement.getStartsAt() != null && announcement.getEndsAt() != null
                && announcement.getEndsAt().isBefore(announcement.getStartsAt())) {
            throw new IllegalArgumentException("End time must be after start time");
        }
    }

    private void normalize(SiteAnnouncement announcement) {
        announcement.setTitle(announcement.getTitle().trim());
        announcement.setContent(announcement.getContent().trim());
        if (announcement.getLinkUrl() != null) {
            String linkUrl = announcement.getLinkUrl().trim();
            announcement.setLinkUrl(linkUrl.isEmpty() ? null : linkUrl);
        }
        announcement.setStatus(normalizeStatus(announcement.getStatus()));
        if (announcement.getSortOrder() == null) {
            announcement.setSortOrder(0);
        }
    }

    private String normalizeStatus(String status) {
        String trimmed = status == null ? "" : status.trim();
        if (trimmed.isEmpty()) {
            return "ACTIVE";
        }
        return trimmed.toUpperCase(Locale.ROOT);
    }

    private String normalizeStatusFilter(String status) {
        String trimmed = status == null ? "" : status.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        String normalized = trimmed.toUpperCase(Locale.ROOT);
        return "ACTIVE".equals(normalized) || "INACTIVE".equals(normalized) ? normalized : null;
    }

    private String searchKeywordPattern(String keyword) {
        if (keyword == null) {
            return null;
        }
        StringBuilder cleaned = new StringBuilder(keyword.length());
        for (int index = 0; index < keyword.length(); index++) {
            char character = keyword.charAt(index);
            cleaned.append(character <= 31 || character == 127 ? ' ' : character);
        }
        String normalized = ANNOUNCEMENT_WHITESPACE_PATTERN.matcher(cleaned.toString().trim())
                .replaceAll(" ")
                .toLowerCase(Locale.ROOT);
        if (normalized.isEmpty()) {
            return null;
        }
        String bounded = normalized.substring(0, Math.min(normalized.length(), 120));
        return "%" + bounded.replace("!", "!!")
                .replace("%", "!%")
                .replace("_", "!_") + "%";
    }

    private SiteAnnouncementPublicResponse toPublicAnnouncement(SiteAnnouncement announcement) {
        return SiteAnnouncementPublicResponse.from(announcement, safePublicLinkUrl(announcement.getLinkUrl()));
    }

    private boolean isPubliclyDisplayable(SiteAnnouncement announcement) {
        return !hasPlaceholderOrGibberishCopy(announcement);
    }

    private boolean hasPlaceholderOrGibberishCopy(SiteAnnouncement announcement) {
        if (announcement == null) {
            return true;
        }
        String text = normalizeCopy(announcement.getTitle()) + " " + normalizeCopy(announcement.getContent());
        if (text.isBlank()) {
            return true;
        }
        if (PLACEHOLDER_COPY_PATTERN.matcher(text).find()
                || REPEATED_CHARACTER_PATTERN.matcher(text).find()
                || KEYBOARD_MASH_PATTERN.matcher(text).find()) {
            return true;
        }
        Matcher matcher = LONG_ALPHANUMERIC_TOKEN_PATTERN.matcher(text);
        while (matcher.find()) {
            if (looksLikeGibberishToken(matcher.group())) return true;
        }
        return false;
    }

    private String normalizeCopy(String value) {
        if (value == null || value.isEmpty()) return "";
        return ANNOUNCEMENT_WHITESPACE_PATTERN.matcher(
                ANNOUNCEMENT_CONTROL_PATTERN.matcher(value).replaceAll(" "))
                .replaceAll(" ").trim();
    }

    private boolean looksLikeGibberishToken(String token) {
        int letters = 0;
        int digits = 0;
        int vowels = 0;
        for (int i = 0; i < token.length(); i++) {
            char ch = token.charAt(i);
            if (Character.isDigit(ch)) {
                digits++;
            } else if (Character.isLetter(ch)) {
                letters++;
                char lower = Character.toLowerCase(ch);
                if (lower == 'a' || lower == 'e' || lower == 'i' || lower == 'o' || lower == 'u') {
                    vowels++;
                }
            }
        }
        if (digits >= 12) {
            return true;
        }
        if (letters >= 6 && digits >= 6) {
            return true;
        }
        return letters >= 8 && ((double) vowels / (double) letters) < 0.2d;
    }

    private String safePublicLinkUrl(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() || !isSafeLinkUrl(trimmed) ? null : trimmed;
    }

    private boolean isSafeLinkUrl(String value) {
        String normalizedValue = value.indexOf('%') >= 0 ? value.toLowerCase(Locale.ROOT) : "";
        boolean hasControl = false;
        for (int index = 0; index < value.length(); index++) {
            char character = value.charAt(index);
            if (character <= 31 || character == 127) {
                hasControl = true;
                break;
            }
        }
        if (value.indexOf('\\') >= 0 || hasControl
                || normalizedValue.contains("%00") || normalizedValue.contains("%5c")) {
            return false;
        }
        if (value.startsWith("/")) {
            return !value.startsWith("//");
        }
        try {
            URI uri = new URI(value);
            String scheme = uri.getScheme();
            String host = uri.getHost();
            return scheme != null
                    && "https".equalsIgnoreCase(scheme)
                    && uri.getUserInfo() == null
                    && host != null
                    && !host.trim().isEmpty();
        } catch (URISyntaxException ex) {
            return false;
        }
    }

    private int activeLimit() {
        return clamp(runtimeConfig.getInt("announcement.active-max-rows", DEFAULT_ACTIVE_LIMIT), 1, 20);
    }

    private int adminPageMaxSize() {
        return clamp(runtimeConfig.getInt("admin.announcements.page-max-size", DEFAULT_ADMIN_PAGE_MAX_SIZE), 1, 500);
    }

    private int titleMaxChars() {
        return clamp(runtimeConfig.getInt("admin.announcements.title-max-chars", DEFAULT_TITLE_MAX_CHARS), 1, DEFAULT_TITLE_MAX_CHARS);
    }

    private int contentMaxChars() {
        return clamp(runtimeConfig.getInt("admin.announcements.content-max-chars", DEFAULT_CONTENT_MAX_CHARS), 1, 2000);
    }

    private int linkUrlMaxChars() {
        return clamp(runtimeConfig.getInt("admin.announcements.link-url-max-chars", DEFAULT_LINK_URL_MAX_CHARS), 1, DEFAULT_LINK_URL_MAX_CHARS);
    }

    private int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(value, max));
    }
}
