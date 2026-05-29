package com.example.shop.controller;

import com.example.shop.entity.Brand;
import com.example.shop.service.BrandService;
import com.example.shop.service.SecurityAuditLogService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/brands")
public class BrandController {
    private final BrandService brandService;
    private final SecurityAuditLogService auditLogService;

    public BrandController(BrandService brandService, SecurityAuditLogService auditLogService) {
        this.brandService = brandService;
        this.auditLogService = auditLogService;
    }

    @GetMapping
    public ResponseEntity<List<Brand>> getAll(@RequestParam(required = false, defaultValue = "false") boolean activeOnly) {
        return ResponseEntity.ok(brandService.findAll(activeOnly));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> create(@RequestBody(required = false) Brand brand,
                                    Authentication authentication,
                                    HttpServletRequest request) {
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

    private String brandAuditMetadata(Brand brand) {
        if (brand == null) {
            return null;
        }
        return "name=" + brand.getName() + ",status=" + brand.getStatus();
    }
}
