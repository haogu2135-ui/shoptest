package com.example.shop.controller;

import com.example.shop.dto.ConfigCenterHealthResponse;
import com.example.shop.dto.ConfigCenterPublishRequest;
import com.example.shop.dto.ConfigCenterSnapshotResponse;
import com.example.shop.security.SecurityUtils;
import com.example.shop.security.UserDetailsImpl;
import com.example.shop.service.AdminRoleService;
import com.example.shop.service.ConfigCenterService;
import com.example.shop.service.SecurityAuditLogService;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import javax.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/admin/config-center")
@PreAuthorize("hasRole('ADMIN')")
public class AdminConfigCenterController {
    private final ConfigCenterService configCenterService;
    private final SecurityAuditLogService auditLogService;
    private final AdminRoleService adminRoleService;

    public AdminConfigCenterController(ConfigCenterService configCenterService,
                                       SecurityAuditLogService auditLogService,
                                       AdminRoleService adminRoleService) {
        this.configCenterService = configCenterService;
        this.auditLogService = auditLogService;
        this.adminRoleService = adminRoleService;
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
            requireAdminActionPermission(authentication, AdminRoleService.CONFIG_CENTER_PUBLISH_PERMISSION);
            if (request != null && request.isApplyRuntime()) {
                requireAdminActionPermission(authentication, AdminRoleService.CONFIG_CENTER_APPLY_PERMISSION);
            }
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
            requireAdminActionPermission(authentication, AdminRoleService.CONFIG_CENTER_APPLY_PERMISSION);
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

    private void requireAdminActionPermission(Authentication authentication, String permission) {
        UserDetailsImpl user = SecurityUtils.requireUser(authentication);
        if (adminRoleService.hasPermission(user.getId(), permission)) {
            return;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Missing admin action permission");
    }

    private String normalizeNamespace(String namespace) {
        return namespace == null || namespace.trim().isEmpty() ? "public" : namespace.trim();
    }
}
