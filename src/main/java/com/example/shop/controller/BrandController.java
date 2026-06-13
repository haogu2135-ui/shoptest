package com.example.shop.controller;

import com.example.shop.dto.BrandPublicResponse;
import com.example.shop.entity.Brand;
import com.example.shop.security.SecurityUtils;
import com.example.shop.service.AdminRoleService;
import com.example.shop.service.BrandService;
import com.example.shop.service.RuntimeConfigService;
import com.example.shop.service.SecurityAuditLogService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/brands")
public class BrandController {
    private static final int DEFAULT_PUBLIC_BRAND_LIMIT = 120;
    private static final int HARD_PUBLIC_BRAND_LIMIT = 500;

    private final BrandService brandService;
    private final SecurityAuditLogService auditLogService;
    private final AdminRoleService adminRoleService;
    private final RuntimeConfigService runtimeConfig;

    public BrandController(BrandService brandService,
                           SecurityAuditLogService auditLogService,
                           AdminRoleService adminRoleService,
                           RuntimeConfigService runtimeConfig) {
        this.brandService = brandService;
        this.auditLogService = auditLogService;
        this.adminRoleService = adminRoleService;
        this.runtimeConfig = runtimeConfig;
    }

    @GetMapping
    public ResponseEntity<List<BrandPublicResponse>> getAll() {
        return ResponseEntity.ok(brandService.findAll(true, publicBrandLimit()).stream()
                .map(BrandPublicResponse::from)
                .collect(Collectors.toList()));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> create(@RequestBody(required = false) Brand brand,
                                    Authentication authentication,
                                    HttpServletRequest request) {
        requireAdminActionPermission(authentication, AdminRoleService.BRANDS_WRITE_PERMISSION,
                "BRAND_CREATE", "BRAND", null, request, brandAuditMetadata(brand));
        if (brand == null) {
            auditLogService.record("BRAND_CREATE", "FAILURE", authentication, "BRAND", null, request,
                    "Brand payload is required", null);
            return ResponseEntity.badRequest().body(Map.of("error", "Brand payload is required"));
        }
        try {
            Brand savedBrand = brandService.save(brand);
            auditLogService.record("BRAND_CREATE", "SUCCESS", authentication, "BRAND", savedBrand.getId(), request,
                    "Brand created", brandAuditMetadata(savedBrand));
            return ResponseEntity.ok(savedBrand);
        } catch (IllegalArgumentException e) {
            auditLogService.record("BRAND_CREATE", "FAILURE", authentication, "BRAND", null, request,
                    e.getMessage(), brandAuditMetadata(brand));
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> update(@PathVariable Long id,
                                    @RequestBody(required = false) Brand brand,
                                    Authentication authentication,
                                    HttpServletRequest request) {
        requireAdminActionPermission(authentication, AdminRoleService.BRANDS_WRITE_PERMISSION,
                "BRAND_UPDATE", "BRAND", id, request, brandAuditMetadata(brand));
        if (brand == null) {
            auditLogService.record("BRAND_UPDATE", "FAILURE", authentication, "BRAND", id, request,
                    "Brand payload is required", null);
            return ResponseEntity.badRequest().body(Map.of("error", "Brand payload is required"));
        }
        return brandService.findById(id)
                .map(existing -> {
                    brand.setId(id);
                    try {
                        Brand savedBrand = brandService.save(brand);
                        auditLogService.record("BRAND_UPDATE", "SUCCESS", authentication, "BRAND", id, request,
                                "Brand updated", brandAuditMetadata(savedBrand));
                        return ResponseEntity.ok(savedBrand);
                    } catch (IllegalArgumentException e) {
                        auditLogService.record("BRAND_UPDATE", "FAILURE", authentication, "BRAND", id, request,
                                e.getMessage(), brandAuditMetadata(brand));
                        return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
                    }
                })
                .orElseGet(() -> {
                    auditLogService.record("BRAND_UPDATE", "FAILURE", authentication, "BRAND", id, request,
                            "Brand not found", brandAuditMetadata(brand));
                    return ResponseEntity.notFound().build();
                });
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long id,
                                       Authentication authentication,
                                       HttpServletRequest request) {
        requireAdminActionPermission(authentication, AdminRoleService.BRANDS_DELETE_PERMISSION,
                "BRAND_DELETE", "BRAND", id, request, null);
        Optional<Brand> brand = brandService.findById(id);
        if (brand.isEmpty()) {
            auditLogService.record("BRAND_DELETE", "FAILURE", authentication, "BRAND", id, request,
                    "Brand not found", null);
            return ResponseEntity.notFound().build();
        }
        brandService.deleteById(id);
        auditLogService.record("BRAND_DELETE", "SUCCESS", authentication, "BRAND", id, request,
                "Brand deleted", brandAuditMetadata(brand.get()));
        return ResponseEntity.ok().build();
    }

    private void requireAdminActionPermission(Authentication authentication,
                                              String permission,
                                              String auditAction,
                                              String resourceType,
                                              Long resourceId,
                                              HttpServletRequest request,
                                              String metadata) {
        if (adminRoleService.hasPermission(SecurityUtils.requireUser(authentication).getId(), permission)) {
            return;
        }
        String auditMetadata = metadata == null || metadata.isBlank()
                ? "permission=" + permission
                : metadata + ",permission=" + permission;
        auditLogService.record(auditAction, "FAILURE", authentication, resourceType, resourceId, request,
                "Missing admin action permission", auditMetadata);
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Missing admin action permission");
    }

    private String brandAuditMetadata(Brand brand) {
        if (brand == null) {
            return null;
        }
        return "name=" + brand.getName() + ",status=" + brand.getStatus();
    }

    private int publicBrandLimit() {
        int configured = runtimeConfig.getInt("brand.public-list-max-rows", DEFAULT_PUBLIC_BRAND_LIMIT);
        return Math.max(1, Math.min(configured, HARD_PUBLIC_BRAND_LIMIT));
    }
}
