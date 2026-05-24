package com.example.shop.controller;

import com.example.shop.dto.SystemAlertActionRequest;
import com.example.shop.dto.SystemAlertBatchActionRequest;
import com.example.shop.dto.SystemAlertBatchActionResponse;
import com.example.shop.dto.SystemAlertPurgeResponse;
import com.example.shop.dto.SystemAlertSummaryResponse;
import com.example.shop.entity.SystemAlert;
import com.example.shop.service.SecurityAuditLogService;
import com.example.shop.service.SystemAlertService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import javax.servlet.http.HttpServletRequest;
import java.util.List;

@RestController
@RequestMapping("/admin/alerts")
public class AdminAlertController {
    private final SystemAlertService systemAlertService;
    private final SecurityAuditLogService auditLogService;

    public AdminAlertController(SystemAlertService systemAlertService, SecurityAuditLogService auditLogService) {
        this.systemAlertService = systemAlertService;
        this.auditLogService = auditLogService;
    }

    @GetMapping
    public List<SystemAlert> search(@RequestParam(required = false) String status,
                                    @RequestParam(required = false) String severity,
                                    @RequestParam(required = false) String category,
                                    @RequestParam(defaultValue = "200") int limit) {
        return systemAlertService.search(status, severity, category, limit);
    }

    @GetMapping("/summary")
    public SystemAlertSummaryResponse summary() {
        return systemAlertService.summary();
    }

    @PostMapping("/self-check")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void runSelfCheck(Authentication authentication, HttpServletRequest request) {
        systemAlertService.runSelfCheck();
        auditLogService.record("ALERT_SELF_CHECK", "SUCCESS", authentication, "SYSTEM_ALERT", "self-check", request,
                "System alert self-check executed", "");
    }

    @PostMapping("/{id}/acknowledge")
    public SystemAlert acknowledge(@PathVariable Long id,
                                   @RequestBody(required = false) SystemAlertActionRequest body,
                                   Authentication authentication,
                                   HttpServletRequest request) {
        SystemAlert alert = systemAlertService.acknowledge(id, actor(authentication))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Alert not found"));
        auditLogService.record("ALERT_ACKNOWLEDGE", "SUCCESS", authentication, "SYSTEM_ALERT", id, request,
                "System alert acknowledged", body == null ? "" : safe(body.getNote()));
        return alert;
    }

    @PostMapping("/{id}/resolve")
    public SystemAlert resolve(@PathVariable Long id,
                               @RequestBody(required = false) SystemAlertActionRequest body,
                               Authentication authentication,
                               HttpServletRequest request) {
        SystemAlert alert = systemAlertService.resolve(id, actor(authentication))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Alert not found"));
        auditLogService.record("ALERT_RESOLVE", "SUCCESS", authentication, "SYSTEM_ALERT", id, request,
                "System alert resolved", body == null ? "" : safe(body.getNote()));
        return alert;
    }

    @PostMapping("/batch/acknowledge")
    public SystemAlertBatchActionResponse acknowledgeBatch(@RequestBody SystemAlertBatchActionRequest body,
                                                           Authentication authentication,
                                                           HttpServletRequest request) {
        SystemAlertBatchActionResponse response = systemAlertService.acknowledgeBatch(body == null ? null : body.getIds(), actor(authentication));
        auditLogService.record("ALERT_BATCH_ACKNOWLEDGE", "SUCCESS", authentication, "SYSTEM_ALERT", "batch", request,
                "System alerts acknowledged in batch",
                "requestedCount=" + response.getRequestedCount() + ", updatedCount=" + response.getUpdatedCount()
                        + ", note=" + safe(body == null ? null : body.getNote()));
        return response;
    }

    @PostMapping("/batch/resolve")
    public SystemAlertBatchActionResponse resolveBatch(@RequestBody SystemAlertBatchActionRequest body,
                                                       Authentication authentication,
                                                       HttpServletRequest request) {
        SystemAlertBatchActionResponse response = systemAlertService.resolveBatch(body == null ? null : body.getIds(), actor(authentication));
        auditLogService.record("ALERT_BATCH_RESOLVE", "SUCCESS", authentication, "SYSTEM_ALERT", "batch", request,
                "System alerts resolved in batch",
                "requestedCount=" + response.getRequestedCount() + ", updatedCount=" + response.getUpdatedCount()
                        + ", note=" + safe(body == null ? null : body.getNote()));
        return response;
    }

    @PostMapping("/purge-resolved")
    public SystemAlertPurgeResponse purgeResolved(@RequestParam(defaultValue = "30") int retentionDays,
                                                  Authentication authentication,
                                                  HttpServletRequest request) {
        SystemAlertPurgeResponse response = systemAlertService.purgeResolved(retentionDays);
        auditLogService.record("ALERT_PURGE_RESOLVED", "SUCCESS", authentication, "SYSTEM_ALERT", "resolved", request,
                "Resolved system alerts purged",
                "retentionDays=" + response.getRetentionDays() + ", deletedCount=" + response.getDeletedCount()
                        + ", purgedBefore=" + response.getPurgedBefore());
        return response;
    }

    private String actor(Authentication authentication) {
        return authentication == null ? null : authentication.getName();
    }

    private String safe(String value) {
        if (value == null) {
            return "";
        }
        String normalized = value.replaceAll("[\\r\\n\\t]+", " ").trim();
        return normalized.length() > 200 ? normalized.substring(0, 200) : normalized;
    }
}
