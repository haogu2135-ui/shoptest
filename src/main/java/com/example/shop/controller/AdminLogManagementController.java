package com.example.shop.controller;

import com.example.shop.dto.LogDebugRequest;
import com.example.shop.dto.LogManagementStatusResponse;
import com.example.shop.dto.LogPreviewResponse;
import com.example.shop.security.SecurityUtils;
import com.example.shop.security.UserDetailsImpl;
import com.example.shop.service.AdminRoleService;
import com.example.shop.service.LogManagementService;
import com.example.shop.service.SecurityAuditLogService;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import javax.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;

@RestController
@RequestMapping("/admin/logs")
public class AdminLogManagementController {
    private final LogManagementService logManagementService;
    private final SecurityAuditLogService auditLogService;
    private final AdminRoleService adminRoleService;

    public AdminLogManagementController(LogManagementService logManagementService,
                                        SecurityAuditLogService auditLogService,
                                        AdminRoleService adminRoleService) {
        this.logManagementService = logManagementService;
        this.auditLogService = auditLogService;
        this.adminRoleService = adminRoleService;
    }

    @GetMapping
    public LogManagementStatusResponse status(@RequestParam(required = false) String loggerName) {
        return logManagementService.status(loggerName);
    }

    @PutMapping("/debug")
    public LogManagementStatusResponse setDebug(
            @RequestBody(required = false) LogDebugRequest request,
            Authentication authentication,
            HttpServletRequest httpRequest
    ) {
        try {
            requireAdminActionPermission(authentication, AdminRoleService.LOGS_DEBUG_PERMISSION);
            if (request == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Log debug payload is required");
            }
            LogManagementStatusResponse response = logManagementService.setDebug(request.isEnabled(), request.getLoggerName());
            auditLogService.record("LOG_DEBUG_TOGGLE", "SUCCESS", authentication, "LOGGING", response.getLoggerName(), httpRequest,
                    request.isEnabled() ? "Debug logging enabled" : "Debug logging disabled",
                    "logger=" + response.getLoggerName()
                            + ", configuredLevel=" + response.getConfiguredLevel()
                            + ", effectiveLevel=" + response.getEffectiveLevel());
            return response;
        } catch (RuntimeException e) {
            auditLogService.record("LOG_DEBUG_TOGGLE", "FAILURE", authentication, "LOGGING", request == null ? null : request.getLoggerName(), httpRequest,
                    e.getMessage(), "enabled=" + (request != null && request.isEnabled()));
            throw e;
        }
    }

    private void requireAdminActionPermission(Authentication authentication, String permission) {
        UserDetailsImpl user = SecurityUtils.requireUser(authentication);
        if (adminRoleService.hasPermission(user.getId(), permission)) {
            return;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Missing admin action permission");
    }

    @GetMapping("/preview")
    public LogPreviewResponse preview(
            @RequestParam String start,
            @RequestParam String end,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String level,
            @RequestParam(defaultValue = "200") int limit,
            Authentication authentication,
            HttpServletRequest httpRequest
    ) {
        try {
            requireAdminActionPermission(authentication, AdminRoleService.LOGS_DOWNLOAD_PERMISSION);
            LocalDateTime startTime = LogManagementService.parseClientDateTime(start);
            LocalDateTime endTime = LogManagementService.parseClientDateTime(end);
            LogPreviewResponse response = logManagementService.preview(startTime, endTime, keyword, level, limit);
            auditLogService.record("LOG_PREVIEW", "SUCCESS", authentication, "LOGGING", null, httpRequest,
                    "Runtime logs previewed",
                    "start=" + startTime + ", end=" + endTime + ", level=" + safe(level) + ", keyword=" + safe(keyword)
                            + ", matchedLines=" + response.getMatchedLines() + ", truncated=" + response.isTruncated());
            return response;
        } catch (RuntimeException e) {
            auditLogService.record("LOG_PREVIEW", "FAILURE", authentication, "LOGGING", null, httpRequest,
                    e.getMessage(), "start=" + start + ", end=" + end + ", level=" + safe(level) + ", keyword=" + safe(keyword));
            throw e;
        }
    }

    @GetMapping("/download")
    public ResponseEntity<byte[]> download(
            @RequestParam String start,
            @RequestParam String end,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String level,
            Authentication authentication,
            HttpServletRequest httpRequest
    ) {
        try {
            requireAdminActionPermission(authentication, AdminRoleService.LOGS_DOWNLOAD_PERMISSION);
            LocalDateTime startTime = LogManagementService.parseClientDateTime(start);
            LocalDateTime endTime = LogManagementService.parseClientDateTime(end);
            byte[] body = logManagementService.download(startTime, endTime, keyword, level);
            String filename = "shop-logs-" + startTime.toLocalDate() + "-to-" + endTime.toLocalDate() + ".log";
            auditLogService.record("LOG_DOWNLOAD", "SUCCESS", authentication, "LOGGING", filename, httpRequest,
                    "Runtime logs downloaded",
                    "start=" + startTime + ", end=" + endTime + ", level=" + safe(level) + ", keyword=" + safe(keyword) + ", bytes=" + body.length);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                            .filename(filename, StandardCharsets.UTF_8)
                            .build()
                            .toString())
                    .contentType(MediaType.TEXT_PLAIN)
                    .body(body);
        } catch (RuntimeException e) {
            auditLogService.record("LOG_DOWNLOAD", "FAILURE", authentication, "LOGGING", null, httpRequest,
                    e.getMessage(), "start=" + start + ", end=" + end + ", level=" + safe(level) + ", keyword=" + safe(keyword));
            throw e;
        }
    }

    private String safe(String value) {
        if (value == null) {
            return "";
        }
        String trimmed = value.replaceAll("[\\r\\n\\t]+", " ").trim();
        return trimmed.length() > 120 ? trimmed.substring(0, 120) : trimmed;
    }
}
