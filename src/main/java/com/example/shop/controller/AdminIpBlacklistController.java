package com.example.shop.controller;

import com.example.shop.dto.IpBlacklistBatchReleaseRequest;
import com.example.shop.dto.IpBlacklistBatchReleaseResponse;
import com.example.shop.dto.IpBlacklistRequest;
import com.example.shop.dto.IpBlacklistStatusResponse;
import com.example.shop.entity.IpBlacklistEntry;
import com.example.shop.service.IpBlacklistService;
import com.example.shop.service.SecurityAuditLogService;
import com.example.shop.util.SensitiveDataMasker;
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
@RequestMapping("/admin/ip-blacklist")
public class AdminIpBlacklistController {
    private final IpBlacklistService ipBlacklistService;
    private final SecurityAuditLogService auditLogService;

    public AdminIpBlacklistController(IpBlacklistService ipBlacklistService, SecurityAuditLogService auditLogService) {
        this.ipBlacklistService = ipBlacklistService;
        this.auditLogService = auditLogService;
    }

    @GetMapping
    public List<IpBlacklistEntry> search(@RequestParam(required = false) String status,
                                         @RequestParam(required = false) String source,
                                         @RequestParam(required = false) String ipAddress,
                                         @RequestParam(defaultValue = "200") int limit) {
        return ipBlacklistService.search(status, source, ipAddress, limit);
    }

    @GetMapping("/status")
    public IpBlacklistStatusResponse status() {
        return ipBlacklistService.status();
    }

    @PostMapping
    public IpBlacklistEntry block(@RequestBody IpBlacklistRequest body, Authentication authentication, HttpServletRequest request) {
        IpBlacklistEntry entry = ipBlacklistService.block(
                body == null ? null : body.getIpAddress(),
                IpBlacklistService.SOURCE_MANUAL,
                body == null || body.getBlockMinutes() == null ? 0 : body.getBlockMinutes(),
                body == null ? "Manual block" : body.getReason(),
                actor(authentication));
        auditLogService.record("IP_BLACKLIST_BLOCK", "SUCCESS", authentication, "IP_BLACKLIST", entry.getIpAddress(), request,
                "IP manually blocked", "minutes=" + (body == null ? "" : body.getBlockMinutes()));
        return entry;
    }

    @PostMapping("/{id}/release")
    public IpBlacklistEntry release(@PathVariable Long id, Authentication authentication, HttpServletRequest request) {
        IpBlacklistEntry entry = ipBlacklistService.release(id, actor(authentication))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "IP blacklist entry not found"));
        auditLogService.record("IP_BLACKLIST_RELEASE", "SUCCESS", authentication, "IP_BLACKLIST", id, request,
                "IP blacklist entry released", "ip=" + entry.getIpAddress());
        return entry;
    }

    @PostMapping("/batch/release")
    public IpBlacklistBatchReleaseResponse releaseBatch(@RequestBody(required = false) IpBlacklistBatchReleaseRequest body,
                                                        Authentication authentication,
                                                        HttpServletRequest request) {
        IpBlacklistBatchReleaseResponse response = ipBlacklistService.releaseBatch(body == null ? null : body.getIds(), actor(authentication));
        auditLogService.record("IP_BLACKLIST_BATCH_RELEASE", "SUCCESS", authentication, "IP_BLACKLIST", "batch", request,
                "IP blacklist entries released in batch",
                "requestedCount=" + response.getRequestedCount()
                        + ", releasedCount=" + response.getReleasedCount()
                        + ", note=" + safe(body == null ? null : body.getNote()));
        return response;
    }

    @PostMapping("/record-login-failure")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void recordLoginFailure(@RequestBody IpBlacklistRequest body) {
        ipBlacklistService.recordFailure(IpBlacklistService.SOURCE_LOGIN, body == null ? null : body.getIpAddress(), body == null ? null : body.getReason());
    }

    private String actor(Authentication authentication) {
        return authentication == null ? null : authentication.getName();
    }

    private String safe(String value) {
        if (value == null) {
            return "";
        }
        String normalized = SensitiveDataMasker.mask(value)
                .replaceAll("[\\r\\n\\t]+", " ")
                .replaceAll("\\s+", " ")
                .trim();
        return normalized.length() > 200 ? normalized.substring(0, 200) : normalized;
    }
}
