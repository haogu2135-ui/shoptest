package com.example.shop.controller;

import com.example.shop.dto.AdminBugReportPageResponse;
import com.example.shop.dto.AdminBugReportRequest;
import com.example.shop.dto.AdminBugReportStatusRequest;
import com.example.shop.dto.AdminBugReportSummaryResponse;
import com.example.shop.entity.AdminBugReport;
import com.example.shop.security.SecurityUtils;
import com.example.shop.security.UserDetailsImpl;
import com.example.shop.service.AdminBugReportService;
import com.example.shop.service.AdminRoleService;
import com.example.shop.service.SecurityAuditLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
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

@RestController
@RequiredArgsConstructor
@RequestMapping("/admin/bugs")
@PreAuthorize("hasRole('ADMIN')")
public class AdminBugReportController {
    private final AdminBugReportService bugReportService;
    private final AdminRoleService adminRoleService;
    private final SecurityAuditLogService auditLogService;

    @GetMapping
    public AdminBugReportPageResponse search(@RequestParam(defaultValue = "1") int page,
                                             @RequestParam(defaultValue = "20") int size,
                                             @RequestParam(required = false) String status,
                                             @RequestParam(required = false) String severity,
                                             @RequestParam(required = false) String module,
                                             @RequestParam(required = false) String keyword,
                                             @RequestParam(defaultValue = "false") boolean scanQueueOnly,
                                             Authentication authentication,
                                             HttpServletRequest request) {
        requireReadPermission(authentication, "BUG_READ", null, request);
        return bugReportService.search(page, size, status, severity, module, keyword, scanQueueOnly);
    }

    @GetMapping("/summary")
    public AdminBugReportSummaryResponse summary(Authentication authentication,
                                                HttpServletRequest request) {
        requireReadPermission(authentication, "BUG_SUMMARY_READ", null, request);
        return bugReportService.summary();
    }

    @PostMapping
    public AdminBugReport create(@RequestBody(required = false) AdminBugReportRequest body,
                                 Authentication authentication,
                                 HttpServletRequest request) {
        requirePermission(authentication, AdminRoleService.BUGS_WRITE_PERMISSION, "BUG_CREATE", null, request);
        UserDetailsImpl user = SecurityUtils.requireUser(authentication);
        try {
            AdminBugReport bug = bugReportService.create(body, user.getId(), user.getUsername());
            auditLogService.record("BUG_CREATE", "SUCCESS", authentication, "ADMIN_BUG_REPORT", bug.getId(), request,
                    "Admin bug report created", metadata(bug));
            return bug;
        } catch (RuntimeException e) {
            auditLogService.record("BUG_CREATE", "FAILURE", authentication, "ADMIN_BUG_REPORT", null, request,
                    e.getMessage(), null);
            throw e;
        }
    }

    @PutMapping("/{id}")
    public AdminBugReport update(@PathVariable Long id,
                                 @RequestBody(required = false) AdminBugReportRequest body,
                                 Authentication authentication,
                                 HttpServletRequest request) {
        requirePermission(authentication, AdminRoleService.BUGS_WRITE_PERMISSION, "BUG_UPDATE", id, request);
        try {
            AdminBugReport bug = bugReportService.update(id, body, actor(authentication));
            auditLogService.record("BUG_UPDATE", "SUCCESS", authentication, "ADMIN_BUG_REPORT", id, request,
                    "Admin bug report updated", metadata(bug));
            return bug;
        } catch (RuntimeException e) {
            auditLogService.record("BUG_UPDATE", "FAILURE", authentication, "ADMIN_BUG_REPORT", id, request,
                    e.getMessage(), null);
            throw e;
        }
    }

    @PostMapping("/{id}/status")
    public AdminBugReport updateStatus(@PathVariable Long id,
                                       @RequestBody(required = false) AdminBugReportStatusRequest body,
                                       Authentication authentication,
                                       HttpServletRequest request) {
        requirePermission(authentication, AdminRoleService.BUGS_STATUS_PERMISSION, "BUG_STATUS_UPDATE", id, request);
        try {
            AdminBugReport bug = bugReportService.updateStatus(id, body, actor(authentication));
            auditLogService.record("BUG_STATUS_UPDATE", "SUCCESS", authentication, "ADMIN_BUG_REPORT", id, request,
                    "Admin bug status updated", metadata(bug));
            return bug;
        } catch (RuntimeException e) {
            auditLogService.record("BUG_STATUS_UPDATE", "FAILURE", authentication, "ADMIN_BUG_REPORT", id, request,
                    e.getMessage(), null);
            throw e;
        }
    }

    @PostMapping("/{id}/scan")
    public AdminBugReport markScanned(@PathVariable Long id,
                                      @RequestBody(required = false) AdminBugReportStatusRequest body,
                                      Authentication authentication,
                                      HttpServletRequest request) {
        requirePermission(authentication, AdminRoleService.BUGS_SCAN_PERMISSION, "BUG_SCAN", id, request);
        try {
            AdminBugReport bug = bugReportService.markScanned(id, body, actor(authentication));
            auditLogService.record("BUG_SCAN", "SUCCESS", authentication, "ADMIN_BUG_REPORT", id, request,
                    "Admin bug report scan recorded", metadata(bug));
            return bug;
        } catch (RuntimeException e) {
            auditLogService.record("BUG_SCAN", "FAILURE", authentication, "ADMIN_BUG_REPORT", id, request,
                    e.getMessage(), null);
            throw e;
        }
    }

    private void requirePermission(Authentication authentication,
                                   String permission,
                                   String auditAction,
                                   Long resourceId,
                                   HttpServletRequest request) {
        UserDetailsImpl user = SecurityUtils.requireUser(authentication);
        if (adminRoleService.hasPermission(user.getId(), permission)) {
            return;
        }
        auditLogService.record(auditAction, "FAILURE", authentication, "ADMIN_BUG_REPORT", resourceId, request,
                "Missing admin action permission", "permission=" + permission);
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Missing admin action permission");
    }

    private void requireReadPermission(Authentication authentication,
                                       String auditAction,
                                       Long resourceId,
                                       HttpServletRequest request) {
        UserDetailsImpl user = SecurityUtils.requireUser(authentication);
        if (adminRoleService.hasAnyBugPermission(user.getId())) {
            return;
        }
        auditLogService.record(auditAction, "FAILURE", authentication, "ADMIN_BUG_REPORT", resourceId, request,
                "Missing admin read permission", "permission=" + AdminRoleService.BUGS_READ_PERMISSION);
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Missing admin read permission");
    }

    private String actor(Authentication authentication) {
        return authentication == null ? null : authentication.getName();
    }

    private String metadata(AdminBugReport bug) {
        if (bug == null) {
            return "";
        }
        return "title=" + safe(bug.getTitle())
                + ",status=" + safe(bug.getStatus())
                + ",severity=" + safe(bug.getSeverity())
                + ",module=" + safe(bug.getModule());
    }

    private String safe(String value) {
        if (value == null) {
            return "";
        }
        String normalized = value.replaceAll("[\\r\\n\\t]+", " ").trim();
        return normalized.length() > 160 ? normalized.substring(0, 160) : normalized;
    }
}
