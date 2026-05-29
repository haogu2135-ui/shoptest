package com.example.shop.controller;

import com.example.shop.dto.ConfigCenterHealthResponse;
import com.example.shop.dto.ConfigCenterPublishRequest;
import com.example.shop.dto.ConfigCenterSnapshotResponse;
import com.example.shop.service.ConfigCenterService;
import com.example.shop.service.SecurityAuditLogService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/admin/config-center")
public class AdminConfigCenterController {
    private final ConfigCenterService configCenterService;
    private final SecurityAuditLogService auditLogService;

    public AdminConfigCenterController(ConfigCenterService configCenterService, SecurityAuditLogService auditLogService) {
        this.configCenterService = configCenterService;
        this.auditLogService = auditLogService;
    }

    @GetMapping
    public ConfigCenterSnapshotResponse getSnapshot(
            @RequestParam(required = false) String dataId,
            @RequestParam(required = false) String group,
            @RequestParam(required = false) String namespace
    ) {
        return configCenterService.snapshot(dataId, group, namespace);
    }

    @GetMapping("/health")
    public ConfigCenterHealthResponse health(
            @RequestParam(required = false) String dataId,
            @RequestParam(required = false) String group,
            @RequestParam(required = false) String namespace
    ) {
        return configCenterService.health(dataId, group, namespace);
    }

    @PostMapping("/publish")
    public ConfigCenterSnapshotResponse publish(
            @RequestBody(required = false) ConfigCenterPublishRequest request,
            Authentication authentication,
            HttpServletRequest httpRequest
    ) {
        try {
            ConfigCenterSnapshotResponse response = configCenterService.publish(request);
            String result = response.getErrors() == null || response.getErrors().isEmpty() ? "SUCCESS" : "FAILURE";
            auditLogService.record("CONFIG_PUBLISH", result, authentication, "CONFIG_CENTER", response.getDataId(), httpRequest,
                    result.equals("SUCCESS") ? "Config center properties published" : "Config center publish failed",
                    "dataId=" + response.getDataId()
                            + ", group=" + response.getGroup()
                            + ", namespace=" + normalizeNamespace(response.getNamespace())
                            + ", propertyCount=" + response.getPropertyCount()
                            + ", runtimeApplied=" + response.isRuntimeApplied());
            return response;
        } catch (RuntimeException e) {
            auditLogService.record("CONFIG_PUBLISH", "FAILURE", authentication, "CONFIG_CENTER", request == null ? null : request.getDataId(), httpRequest,
                    e.getMessage(), "group=" + (request == null ? "" : request.getGroup())
                            + ", namespace=" + normalizeNamespace(request == null ? "" : request.getNamespace()));
            throw e;
        }
    }

    @PostMapping("/apply")
    public ConfigCenterSnapshotResponse apply(
            @RequestBody(required = false) ConfigCenterPublishRequest request,
            Authentication authentication,
            HttpServletRequest httpRequest
    ) {
        try {
            ConfigCenterSnapshotResponse response = configCenterService.apply(request);
            String result = response.getErrors() == null || response.getErrors().isEmpty() ? "SUCCESS" : "FAILURE";
            auditLogService.record("CONFIG_APPLY_RUNTIME", result, authentication, "CONFIG_CENTER", response.getDataId(), httpRequest,
                    result.equals("SUCCESS") ? "Config center properties applied at runtime" : "Config center runtime apply failed",
                    "dataId=" + response.getDataId()
                            + ", group=" + response.getGroup()
                            + ", namespace=" + normalizeNamespace(response.getNamespace())
                            + ", propertyCount=" + response.getPropertyCount()
                            + ", runtimeApplied=" + response.isRuntimeApplied());
            return response;
        } catch (RuntimeException e) {
            auditLogService.record("CONFIG_APPLY_RUNTIME", "FAILURE", authentication, "CONFIG_CENTER", request == null ? null : request.getDataId(), httpRequest,
                    e.getMessage(), "group=" + (request == null ? "" : request.getGroup())
                            + ", namespace=" + normalizeNamespace(request == null ? "" : request.getNamespace()));
            throw e;
        }
    }

    private String normalizeNamespace(String namespace) {
        return namespace == null || namespace.trim().isEmpty() ? "public" : namespace.trim();
    }
}
