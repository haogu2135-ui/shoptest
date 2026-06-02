package com.example.shop.controller;

import com.example.shop.dto.SiteAnnouncementAdminPageResponse;
import com.example.shop.dto.SiteAnnouncementAdminSummaryResponse;
import com.example.shop.dto.SiteAnnouncementPublicResponse;
import com.example.shop.entity.SiteAnnouncement;
import com.example.shop.security.SecurityUtils;
import com.example.shop.security.UserDetailsImpl;
import com.example.shop.service.AdminRoleService;
import com.example.shop.service.SecurityAuditLogService;
import com.example.shop.service.SiteAnnouncementService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
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
import org.springframework.web.server.ResponseStatusException;

import javax.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class SiteAnnouncementController {
    private final SiteAnnouncementService announcementService;
    private final SecurityAuditLogService auditLogService;
    private final AdminRoleService adminRoleService;

    @GetMapping("/announcements/active")
    public List<SiteAnnouncementPublicResponse> getActive(@RequestParam(defaultValue = "5") int limit) {
        return announcementService.findActive(limit);
    }

    @GetMapping("/admin/announcements")
    @PreAuthorize("hasRole('ADMIN')")
    public SiteAnnouncementAdminPageResponse getAll(@RequestParam(defaultValue = "1") int page,
                                                    @RequestParam(defaultValue = "20") int size,
                                                    @RequestParam(required = false) String status,
                                                    @RequestParam(required = false) String keyword) {
        return announcementService.findAdminPage(page, size, status, keyword);
    }

    @GetMapping("/admin/announcements/summary")
    @PreAuthorize("hasRole('ADMIN')")
    public SiteAnnouncementAdminSummaryResponse getSummary(@RequestParam(required = false) String status,
                                                           @RequestParam(required = false) String keyword) {
        return announcementService.adminSummary(status, keyword);
    }

    @PostMapping("/admin/announcements")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> create(@RequestBody(required = false) SiteAnnouncement announcement,
                                    Authentication authentication,
                                    HttpServletRequest request) {
        requireAdminActionPermission(authentication, AdminRoleService.ANNOUNCEMENTS_WRITE_PERMISSION,
                "ANNOUNCEMENT_CREATE", "SITE_ANNOUNCEMENT", null, request, announcementAuditMetadata(announcement));
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
        requireAdminActionPermission(authentication, AdminRoleService.ANNOUNCEMENTS_WRITE_PERMISSION,
                "ANNOUNCEMENT_UPDATE", "SITE_ANNOUNCEMENT", id, request, announcementAuditMetadata(announcement));
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
        requireAdminActionPermission(authentication, AdminRoleService.ANNOUNCEMENTS_DELETE_PERMISSION,
                "ANNOUNCEMENT_DELETE", "SITE_ANNOUNCEMENT", id, request, null);
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

    private void requireAdminActionPermission(Authentication authentication,
                                              String permission,
                                              String auditAction,
                                              String resourceType,
                                              Long resourceId,
                                              HttpServletRequest request,
                                              String metadata) {
        UserDetailsImpl user = SecurityUtils.requireUser(authentication);
        if (adminRoleService.hasPermission(user.getId(), permission)) {
            return;
        }
        String auditMetadata = metadata == null || metadata.isBlank()
                ? "permission=" + permission
                : metadata + ",permission=" + permission;
        auditLogService.record(auditAction, "FAILURE", authentication, resourceType, resourceId, request,
                "Missing admin action permission", auditMetadata);
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Missing admin action permission");
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
