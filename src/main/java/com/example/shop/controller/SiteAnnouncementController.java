package com.example.shop.controller;

import com.example.shop.dto.SiteAnnouncementAdminSummaryResponse;
import com.example.shop.entity.SiteAnnouncement;
import com.example.shop.service.SecurityAuditLogService;
import com.example.shop.service.SiteAnnouncementService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class SiteAnnouncementController {
    private final SiteAnnouncementService announcementService;
    private final SecurityAuditLogService auditLogService;

    @GetMapping("/announcements/active")
    public List<SiteAnnouncement> getActive(@RequestParam(defaultValue = "5") int limit) {
        return announcementService.findActive(limit);
    }

    @GetMapping("/admin/announcements")
    @PreAuthorize("hasRole('ADMIN')")
    public List<SiteAnnouncement> getAll() {
        return announcementService.findAll();
    }

    @GetMapping("/admin/announcements/summary")
    @PreAuthorize("hasRole('ADMIN')")
    public SiteAnnouncementAdminSummaryResponse getSummary() {
        return announcementService.adminSummary();
    }

    @PostMapping("/admin/announcements")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> create(@RequestBody(required = false) SiteAnnouncement announcement,
                                    Authentication authentication,
                                    HttpServletRequest request) {
        if (announcement == null) {
            auditLogService.record("ANNOUNCEMENT_CREATE", "FAILURE", authentication, "SITE_ANNOUNCEMENT", null, request,
                    "Announcement payload is required", null);
            return ResponseEntity.badRequest().body(Map.of("error", "Announcement payload is required"));
        }
        try {
            announcement.setId(null);
            SiteAnnouncement savedAnnouncement = announcementService.save(announcement);
            auditLogService.record("ANNOUNCEMENT_CREATE", "SUCCESS", authentication, "SITE_ANNOUNCEMENT", savedAnnouncement.getId(), request,
                    "Announcement created", announcementAuditMetadata(savedAnnouncement));
            return ResponseEntity.ok(savedAnnouncement);
        } catch (IllegalArgumentException ex) {
            auditLogService.record("ANNOUNCEMENT_CREATE", "FAILURE", authentication, "SITE_ANNOUNCEMENT", null, request,
                    ex.getMessage(), announcementAuditMetadata(announcement));
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    @PutMapping("/admin/announcements/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> update(@PathVariable Long id,
                                    @RequestBody(required = false) SiteAnnouncement announcement,
                                    Authentication authentication,
                                    HttpServletRequest request) {
        if (announcement == null) {
            auditLogService.record("ANNOUNCEMENT_UPDATE", "FAILURE", authentication, "SITE_ANNOUNCEMENT", id, request,
                    "Announcement payload is required", null);
            return ResponseEntity.badRequest().body(Map.of("error", "Announcement payload is required"));
        }
        try {
            SiteAnnouncement savedAnnouncement = announcementService.update(id, announcement);
            auditLogService.record("ANNOUNCEMENT_UPDATE", "SUCCESS", authentication, "SITE_ANNOUNCEMENT", id, request,
                    "Announcement updated", announcementAuditMetadata(savedAnnouncement));
            return ResponseEntity.ok(savedAnnouncement);
        } catch (IllegalArgumentException ex) {
            auditLogService.record("ANNOUNCEMENT_UPDATE", "FAILURE", authentication, "SITE_ANNOUNCEMENT", id, request,
                    ex.getMessage(), announcementAuditMetadata(announcement));
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    @DeleteMapping("/admin/announcements/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> delete(@PathVariable Long id,
                                    Authentication authentication,
                                    HttpServletRequest request) {
        try {
            announcementService.deleteById(id);
            auditLogService.record("ANNOUNCEMENT_DELETE", "SUCCESS", authentication, "SITE_ANNOUNCEMENT", id, request,
                    "Announcement deleted", null);
        } catch (RuntimeException ex) {
            auditLogService.record("ANNOUNCEMENT_DELETE", "FAILURE", authentication, "SITE_ANNOUNCEMENT", id, request,
                    ex.getMessage(), null);
            throw ex;
        }
        return ResponseEntity.ok(Map.of("message", "Deleted"));
    }

    private String announcementAuditMetadata(SiteAnnouncement announcement) {
        if (announcement == null) {
            return null;
        }
        return "title=" + announcement.getTitle()
                + ",status=" + announcement.getStatus()
                + ",sortOrder=" + announcement.getSortOrder();
    }
}
