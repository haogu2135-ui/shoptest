package com.example.shop.controller;

import com.example.shop.dto.SiteAnnouncementAdminSummaryResponse;
import com.example.shop.entity.SiteAnnouncement;
import com.example.shop.service.SiteAnnouncementService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class SiteAnnouncementController {
    private final SiteAnnouncementService announcementService;

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
    public ResponseEntity<?> create(@RequestBody SiteAnnouncement announcement) {
        try {
            if (announcement != null) {
                announcement.setId(null);
            }
            return ResponseEntity.ok(announcementService.save(announcement));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    @PutMapping("/admin/announcements/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody SiteAnnouncement announcement) {
        try {
            return ResponseEntity.ok(announcementService.update(id, announcement));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    @DeleteMapping("/admin/announcements/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        announcementService.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Deleted"));
    }
}
