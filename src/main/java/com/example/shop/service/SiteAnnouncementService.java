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
import java.util.Objects;
import java.util.stream.Collectors;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
public class SiteAnnouncementService {
    private static final int DEFAULT_ACTIVE_LIMIT = 10;
    private static final int DEFAULT_ADMIN_PAGE_SIZE = 20;
    private static final int DEFAULT_ADMIN_PAGE_MAX_SIZE = 100;
    private static final int DEFAULT_TITLE_MAX_CHARS = 120;
    private static final int DEFAULT_CONTENT_MAX_CHARS = 500;
    private static final int DEFAULT_LINK_URL_MAX_CHARS = 500;
    private static final Pattern PLACEHOLDER_COPY_PATTERN = Pattern.compile(
            "(?i)(^|\\b)(test|testing|dummy|placeholder|lorem|asdf|qwer|sadsad|foobar)(\\b|$)");
    private static final Pattern REPEATED_CHARACTER_PATTERN = Pattern.compile("(?i)([a-z])\\1{4,}");
    private static final Pattern LONG_ALPHANUMERIC_TOKEN_PATTERN = Pattern.compile("(?i)\\b[a-z0-9]{18,}\\b");

    private final SiteAnnouncementRepository repository;
    private final RuntimeConfigService runtimeConfig;

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void deactivatePlaceholderActiveAnnouncements() {
        List<SiteAnnouncement> invalidActiveAnnouncements = repository.findByStatusIgnoreCase("ACTIVE").stream()
                .filter(this::hasPlaceholderOrGibberishCopy)
                .collect(Collectors.toList());
        if (invalidActiveAnnouncements.isEmpty()) {
            return;
        }
        invalidActiveAnnouncements.forEach(announcement -> announcement.setStatus("INACTIVE"));
        repository.saveAll(invalidActiveAnnouncements);
        log.warn("Deactivated {} active site announcement(s) that matched QA/test placeholder content guards",
                invalidActiveAnnouncements.size());
    }

    @Transactional(readOnly = true)
    public SiteAnnouncementAdminPageResponse findAdminPage(int page, int size, String status, String keyword) {
        int safeSize = clamp(size <= 0 ? DEFAULT_ADMIN_PAGE_SIZE : size, 1, adminPageMaxSize());
        int safePage = Math.max(1, page);
        String safeStatus = normalizeStatusFilter(status);
        String keywordPattern = searchKeywordPattern(keyword);
        Sort sort = Sort.by(Sort.Order.asc("sortOrder"), Sort.Order.desc("id"));
        Page<SiteAnnouncement> result = repository.searchAdmin(
                safeStatus,
                keywordPattern,
                PageRequest.of(safePage - 1, safeSize, sort));
        if (result.getTotalPages() > 0 && safePage > result.getTotalPages()) {
            safePage = result.getTotalPages();
            result = repository.searchAdmin(
                    safeStatus,
                    keywordPattern,
                    PageRequest.of(safePage - 1, safeSize, sort));
        }
        return SiteAnnouncementAdminPageResponse.of(result.getContent(), result.getTotalElements(), safePage, safeSize);
    }

    @Transactional(readOnly = true)
    public List<SiteAnnouncementPublicResponse> findActive(int limit) {
        int safeLimit = clamp(limit, 1, activeLimit());
        int fetchLimit = Math.max(safeLimit, Math.min(activeLimit(), safeLimit * 4));
        return repository.findActive(LocalDateTime.now(), PageRequest.of(0, fetchLimit)).stream()
                .filter(Objects::nonNull)
                .filter(this::isPubliclyDisplayable)
                .map(this::toPublicAnnouncement)
                .limit(safeLimit)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public SiteAnnouncementAdminSummaryResponse adminSummary() {
        return adminSummary(null, null);
    }

    @Transactional(readOnly = true)
    public SiteAnnouncementAdminSummaryResponse adminSummary(String status, String keyword) {
        LocalDateTime now = LocalDateTime.now();
        String safeStatus = normalizeStatusFilter(status);
        String keywordPattern = searchKeywordPattern(keyword);
        SiteAnnouncementAdminSummaryResponse response = new SiteAnnouncementAdminSummaryResponse();
        response.setTotalAnnouncements(repository.countAdmin(safeStatus, keywordPattern));
        response.setActiveAnnouncements(repository.countAdminCurrentlyActive(safeStatus, keywordPattern, now));
        response.setScheduledAnnouncements(repository.countAdminScheduled(safeStatus, keywordPattern, now));
        response.setExpiredAnnouncements(repository.countAdminExpired(safeStatus, keywordPattern, now));
        response.setInactiveAnnouncements(repository.countAdmin(scopedStatus(safeStatus, "INACTIVE"), keywordPattern));
        response.setLinkedAnnouncements(repository.countAdminLinked(safeStatus, keywordPattern));
        response.setMaxActiveRows(activeLimit());
        response.setTitleMaxChars(titleMaxChars());
        response.setContentMaxChars(contentMaxChars());
        response.setLinkUrlMaxChars(linkUrlMaxChars());
        response.setCheckedAt(now);
        return response;
    }

    @Transactional
    public SiteAnnouncement save(SiteAnnouncement announcement) {
        if (announcement == null) {
            throw new IllegalArgumentException("Announcement is required");
        }
        validate(announcement);
        normalize(announcement);
        return repository.save(announcement);
    }

    @Transactional
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

    @Transactional
    public void deleteById(Long id) {
        repository.deleteById(id);
    }

    private void validate(SiteAnnouncement announcement) {
        if (announcement.getTitle() == null || announcement.getTitle().trim().isEmpty()) {
            throw new IllegalArgumentException("Title is required");
        }
        if (announcement.getContent() == null || announcement.getContent().trim().isEmpty()) {
            throw new IllegalArgumentException("Content is required");
        }
        if (announcement.getTitle().trim().length() > titleMaxChars()) {
            throw new IllegalArgumentException("Title is too long");
        }
        if (announcement.getContent().trim().length() > contentMaxChars()) {
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
        if (linkUrl != null && !linkUrl.trim().isEmpty()) {
            String trimmedLink = linkUrl.trim();
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
        if (status == null || status.trim().isEmpty()) {
            return "ACTIVE";
        }
        return status.trim().toUpperCase(Locale.ROOT);
    }

    private String normalizeStatusFilter(String status) {
        if (status == null || status.trim().isEmpty()) {
            return null;
        }
        String normalized = status.trim().toUpperCase(Locale.ROOT);
        return "ACTIVE".equals(normalized) || "INACTIVE".equals(normalized) ? normalized : null;
    }

    private String scopedStatus(String requestedStatus, String targetStatus) {
        if (requestedStatus == null) {
            return targetStatus;
        }
        return targetStatus.equals(requestedStatus) ? targetStatus : "__NO_MATCH__";
    }

    private String searchKeywordPattern(String keyword) {
        if (keyword == null) {
            return null;
        }
        String normalized = keyword.chars()
                .mapToObj(ch -> ch <= 31 || ch == 127 ? " " : String.valueOf((char) ch))
                .collect(Collectors.joining())
                .trim()
                .replaceAll("\\s+", " ")
                .toLowerCase(Locale.ROOT);
        if (normalized.isEmpty()) {
            return null;
        }
        return "%" + normalized.substring(0, Math.min(normalized.length(), 120)) + "%";
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
        if (PLACEHOLDER_COPY_PATTERN.matcher(text).find() || REPEATED_CHARACTER_PATTERN.matcher(text).find()) {
            return true;
        }
        return LONG_ALPHANUMERIC_TOKEN_PATTERN.matcher(text).results()
                .map(match -> match.group())
                .anyMatch(this::looksLikeGibberishToken);
    }

    private String normalizeCopy(String value) {
        return value == null ? "" : value.replaceAll("[\\r\\n\\t]+", " ").replaceAll("\\s+", " ").trim();
    }

    private boolean looksLikeGibberishToken(String token) {
        int letters = 0;
        int digits = 0;
        for (int i = 0; i < token.length(); i++) {
            char ch = token.charAt(i);
            if (Character.isDigit(ch)) {
                digits++;
            } else if (Character.isLetter(ch)) {
                letters++;
            }
        }
        return letters >= 6 && digits >= 6;
    }

    private String safePublicLinkUrl(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() || !isSafeLinkUrl(trimmed) ? null : trimmed;
    }

    private boolean isSafeLinkUrl(String value) {
        String normalizedValue = value.toLowerCase(Locale.ROOT);
        if (value.indexOf('\\') >= 0
                || value.chars().anyMatch(ch -> ch <= 31 || ch == 127)
                || normalizedValue.contains("%00")
                || normalizedValue.contains("%5c")) {
            return false;
        }
        if (value.startsWith("/")) {
            return !value.startsWith("//");
        }
        try {
            URI uri = new URI(value);
            String scheme = uri.getScheme();
            return scheme != null
                    && "https".equalsIgnoreCase(scheme)
                    && uri.getUserInfo() == null
                    && uri.getHost() != null
                    && !uri.getHost().trim().isEmpty();
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
