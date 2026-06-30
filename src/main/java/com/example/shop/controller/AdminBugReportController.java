package com.example.shop.controller;

import com.example.shop.dto.AdminBugAttachmentUploadResponse;
import com.example.shop.dto.AdminBugReportPageResponse;
import com.example.shop.dto.AdminBugReportRequest;
import com.example.shop.dto.AdminBugReportResponse;
import com.example.shop.dto.AdminBugReportStatusRequest;
import com.example.shop.dto.AdminBugReportSummaryResponse;
import com.example.shop.entity.AdminBugReport;
import com.example.shop.security.SecurityUtils;
import com.example.shop.security.UserDetailsImpl;
import com.example.shop.service.AdminBugAttachmentService;
import com.example.shop.service.AdminBugReportService;
import com.example.shop.service.AdminRoleService;
import com.example.shop.service.SecurityAuditLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
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
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import javax.servlet.http.HttpServletRequest;
import javax.validation.Valid;

@RestController
@RequiredArgsConstructor
@RequestMapping("/admin/bugs")
@PreAuthorize("hasRole('ADMIN')")
public class AdminBugReportController {
    private final AdminBugAttachmentService attachmentService;
    private final AdminBugReportService bugReportService;
    private final AdminRoleService adminRoleService;
    private final SecurityAuditLogService auditLogService;

    @GetMapping
    public AdminBugReportPageResponse search(@RequestParam(defaultValue = "0") int page,
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

    @PostMapping(value = "/attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public AdminBugAttachmentUploadResponse uploadAttachment(@RequestParam(value = "file", required = false) MultipartFile file,
                                                             Authentication authentication,
                                                             HttpServletRequest request) {
        requirePermission(authentication, AdminRoleService.BUGS_WRITE_PERMISSION, "BUG_ATTACHMENT_UPLOAD", null, request);
        try {
            String attachmentUrl = attachmentService.upload(file);
            auditLogService.record("BUG_ATTACHMENT_UPLOAD", "SUCCESS", authentication, "ADMIN_BUG_REPORT", null, request,
                    "Admin bug attachment uploaded", "attachmentUrl=" + safe(attachmentUrl));
            return new AdminBugAttachmentUploadResponse(attachmentUrl);
        } catch (RuntimeException e) {
            auditLogService.record("BUG_ATTACHMENT_UPLOAD", "FAILURE", authentication, "ADMIN_BUG_REPORT", null, request,
                    e.getMessage(), null);
            throw e;
        }
    }

    @GetMapping("/attachments/{filename:.+}")
    public ResponseEntity<Resource> getAttachment(@PathVariable String filename,
                                                  Authentication authentication,
                                                  HttpServletRequest request) {
        requireReadPermission(authentication, "BUG_ATTACHMENT_READ", null, request);
        AdminBugAttachmentService.AttachmentResource attachment = attachmentService.load(filename);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(attachment.getContentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline()
                        .filename(attachment.getFilename())
                        .build()
                        .toString())
                .body(attachment.getResource());
    }

    @GetMapping("/{id}")
    public AdminBugReportResponse findById(@PathVariable Long id,
                                           Authentication authentication,
                                           HttpServletRequest request) {
        requireReadPermission(authentication, "BUG_DETAIL_READ", id, request);
        try {
            return AdminBugReportResponse.from(bugReportService.findById(id));
        } catch (IllegalArgumentException e) {
            auditLogService.record("BUG_DETAIL_READ", "FAILURE", authentication, "ADMIN_BUG_REPORT", id, request,
                    e.getMessage(), null);
            throw badRequest(e, "Invalid bug report request");
        }
    }

    @PostMapping
    public AdminBugReportResponse create(@Valid @RequestBody AdminBugReportRequest body,
                                         Authentication authentication,
                                         HttpServletRequest request) {
        requirePermission(authentication, AdminRoleService.BUGS_WRITE_PERMISSION, "BUG_CREATE", null, request);
        UserDetailsImpl user = SecurityUtils.requireUser(authentication);
        try {
            AdminBugReport bug = bugReportService.create(body, user.getId(), user.getUsername());
            auditLogService.record("BUG_CREATE", "SUCCESS", authentication, "ADMIN_BUG_REPORT", bug.getId(), request,
                    "Admin bug report created", metadata(bug));
            return AdminBugReportResponse.from(bug);
        } catch (IllegalArgumentException e) {
            auditLogService.record("BUG_CREATE", "FAILURE", authentication, "ADMIN_BUG_REPORT", null, request,
                    e.getMessage(), null);
            throw badRequest(e, "Invalid bug report request");
        } catch (RuntimeException e) {
            auditLogService.record("BUG_CREATE", "FAILURE", authentication, "ADMIN_BUG_REPORT", null, request,
                    e.getMessage(), null);
            throw e;
        }
    }

    @PutMapping("/{id}")
    public AdminBugReportResponse update(@PathVariable Long id,
                                         @Valid @RequestBody AdminBugReportRequest body,
                                         Authentication authentication,
                                         HttpServletRequest request) {
        requirePermission(authentication, AdminRoleService.BUGS_WRITE_PERMISSION, "BUG_UPDATE", id, request);
        try {
            AdminBugReport bug = bugReportService.update(id, body, actor(authentication));
            auditLogService.record("BUG_UPDATE", "SUCCESS", authentication, "ADMIN_BUG_REPORT", id, request,
                    "Admin bug report updated", metadata(bug));
            return AdminBugReportResponse.from(bug);
        } catch (IllegalArgumentException e) {
            auditLogService.record("BUG_UPDATE", "FAILURE", authentication, "ADMIN_BUG_REPORT", id, request,
                    e.getMessage(), null);
            throw badRequest(e, "Invalid bug report update");
        } catch (RuntimeException e) {
            auditLogService.record("BUG_UPDATE", "FAILURE", authentication, "ADMIN_BUG_REPORT", id, request,
                    e.getMessage(), null);
            throw e;
        }
    }

    @PostMapping("/{id}/status")
    public AdminBugReportResponse updateStatus(@PathVariable Long id,
                                               @Valid @RequestBody AdminBugReportStatusRequest body,
                                               Authentication authentication,
                                               HttpServletRequest request) {
        requirePermission(authentication, AdminRoleService.BUGS_STATUS_PERMISSION, "BUG_STATUS_UPDATE", id, request);
        try {
            AdminBugReport bug = bugReportService.updateStatus(id, body, actor(authentication));
            auditLogService.record("BUG_STATUS_UPDATE", "SUCCESS", authentication, "ADMIN_BUG_REPORT", id, request,
                    "Admin bug status updated", metadata(bug));
            return AdminBugReportResponse.from(bug);
        } catch (IllegalArgumentException e) {
            auditLogService.record("BUG_STATUS_UPDATE", "FAILURE", authentication, "ADMIN_BUG_REPORT", id, request,
                    e.getMessage(), null);
            throw badRequest(e, "Invalid bug status update");
        } catch (RuntimeException e) {
            auditLogService.record("BUG_STATUS_UPDATE", "FAILURE", authentication, "ADMIN_BUG_REPORT", id, request,
                    e.getMessage(), null);
            throw e;
        }
    }

    @PostMapping("/{id}/scan")
    public AdminBugReportResponse markScanned(@PathVariable Long id,
                                              @RequestBody(required = false) AdminBugReportStatusRequest body,
                                              Authentication authentication,
                                              HttpServletRequest request) {
        requirePermission(authentication, AdminRoleService.BUGS_SCAN_PERMISSION, "BUG_SCAN", id, request);
        try {
            AdminBugReport bug = bugReportService.markScanned(id, body, actor(authentication));
            auditLogService.record("BUG_SCAN", "SUCCESS", authentication, "ADMIN_BUG_REPORT", id, request,
                    "Admin bug report scan recorded", metadata(bug));
            return AdminBugReportResponse.from(bug);
        } catch (IllegalArgumentException e) {
            auditLogService.record("BUG_SCAN", "FAILURE", authentication, "ADMIN_BUG_REPORT", id, request,
                    e.getMessage(), null);
            throw badRequest(e, "Invalid bug scan update");
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

    private ResponseStatusException badRequest(IllegalArgumentException e, String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message, e);
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
        String limited = normalized.length() > 160 ? normalized.substring(0, 160) : normalized;
        return htmlEncode(limited);
    }

    private String htmlEncode(String value) {
        StringBuilder encoded = new StringBuilder(value.length());
        for (int i = 0; i < value.length(); i++) {
            char ch = value.charAt(i);
            switch (ch) {
                case '&':
                    encoded.append("&amp;");
                    break;
                case '<':
                    encoded.append("&lt;");
                    break;
                case '>':
                    encoded.append("&gt;");
                    break;
                case '"':
                    encoded.append("&quot;");
                    break;
                case '\'':
                    encoded.append("&#39;");
                    break;
                default:
                    encoded.append(ch);
                    break;
            }
        }
        return encoded.toString();
    }
}
