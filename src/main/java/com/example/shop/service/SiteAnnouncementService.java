package com.example.shop.service;

import com.example.shop.entity.SiteAnnouncement;
import com.example.shop.repository.SiteAnnouncementRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class SiteAnnouncementService {
    private final SiteAnnouncementRepository repository;

    public List<SiteAnnouncement> findAll() {
        return repository.findAllByOrderBySortOrderAscIdDesc();
    }

    public List<SiteAnnouncement> findActive(int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 10));
        return repository.findActive(LocalDateTime.now(), PageRequest.of(0, safeLimit));
    }

    @Transactional
    public SiteAnnouncement save(SiteAnnouncement announcement) {
        validate(announcement);
        normalize(announcement);
        return repository.save(announcement);
    }

    @Transactional
    public SiteAnnouncement update(Long id, SiteAnnouncement announcement) {
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
        if (announcement.getStartsAt() != null && announcement.getEndsAt() != null
                && announcement.getEndsAt().isBefore(announcement.getStartsAt())) {
            throw new IllegalArgumentException("End time must be after start time");
        }
    }

    private void normalize(SiteAnnouncement announcement) {
        announcement.setTitle(announcement.getTitle().trim());
        announcement.setContent(announcement.getContent().trim());
        if (announcement.getLinkUrl() != null) {
            announcement.setLinkUrl(announcement.getLinkUrl().trim());
        }
        if (announcement.getStatus() == null || announcement.getStatus().trim().isEmpty()) {
            announcement.setStatus("ACTIVE");
        } else {
            announcement.setStatus(announcement.getStatus().trim().toUpperCase());
        }
        if (announcement.getSortOrder() == null) {
            announcement.setSortOrder(0);
        }
    }
}
