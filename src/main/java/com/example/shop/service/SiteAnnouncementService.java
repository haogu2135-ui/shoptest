package com.example.shop.service;

import com.example.shop.dto.SiteAnnouncementAdminSummaryResponse;
import com.example.shop.entity.SiteAnnouncement;
import com.example.shop.repository.SiteAnnouncementRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.net.URISyntaxException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SiteAnnouncementService {
    private static final int DEFAULT_ACTIVE_LIMIT = 10;
    private static final int DEFAULT_TITLE_MAX_CHARS = 120;
    private static final int DEFAULT_CONTENT_MAX_CHARS = 500;
    private static final int DEFAULT_LINK_URL_MAX_CHARS = 500;

    private final SiteAnnouncementRepository repository;
    private final RuntimeConfigService runtimeConfig;

    @Transactional(readOnly = true)
    public List<SiteAnnouncement> findAll() {
        return repository.findAllByOrderBySortOrderAscIdDesc();
    }

    @Transactional(readOnly = true)
    public List<SiteAnnouncement> findActive(int limit) {
        int safeLimit = clamp(limit, 1, activeLimit());
        return repository.findActive(LocalDateTime.now(), PageRequest.of(0, safeLimit)).stream()
                .filter(Objects::nonNull)
                .map(this::toPublicAnnouncement)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public SiteAnnouncementAdminSummaryResponse adminSummary() {
        LocalDateTime now = LocalDateTime.now();
        SiteAnnouncementAdminSummaryResponse response = new SiteAnnouncementAdminSummaryResponse();
        response.setTotalAnnouncements(repository.count());
        response.setActiveAnnouncements(repository.countCurrentlyActive(now));
        response.setScheduledAnnouncements(repository.countScheduled(now));
        response.setExpiredAnnouncements(repository.countExpired(now));
        response.setInactiveAnnouncements(repository.countByStatusIgnoreCase("INACTIVE"));
        response.setLinkedAnnouncements(repository.countLinked());
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
        String linkUrl = announcement.getLinkUrl();
        if (linkUrl != null && !linkUrl.trim().isEmpty()) {
            String trimmedLink = linkUrl.trim();
            if (trimmedLink.length() > linkUrlMaxChars()) {
                throw new IllegalArgumentException("Link URL is too long");
            }
            if (!isSafeLinkUrl(trimmedLink)) {
                throw new IllegalArgumentException("Link URL must be a relative path or an HTTP(S) URL");
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

    private SiteAnnouncement toPublicAnnouncement(SiteAnnouncement announcement) {
        SiteAnnouncement response = new SiteAnnouncement();
        response.setId(announcement.getId());
        response.setTitle(announcement.getTitle());
        response.setContent(announcement.getContent());
        response.setLinkUrl(safePublicLinkUrl(announcement.getLinkUrl()));
        response.setStatus(announcement.getStatus());
        response.setSortOrder(announcement.getSortOrder());
        response.setStartsAt(announcement.getStartsAt());
        response.setEndsAt(announcement.getEndsAt());
        response.setCreatedAt(announcement.getCreatedAt());
        response.setUpdatedAt(announcement.getUpdatedAt());
        return response;
    }

    private String safePublicLinkUrl(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() || !isSafeLinkUrl(trimmed) ? null : trimmed;
    }

    private boolean isSafeLinkUrl(String value) {
        if (value.indexOf('\\') >= 0 || value.chars().anyMatch(ch -> ch <= 31 || ch == 127)) {
            return false;
        }
        if (value.startsWith("/")) {
            return !value.startsWith("//");
        }
        try {
            URI uri = new URI(value);
            String scheme = uri.getScheme();
            return scheme != null
                    && ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme))
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
