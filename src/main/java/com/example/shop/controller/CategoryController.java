package com.example.shop.controller;

import com.example.shop.dto.CategoryPublicResponse;
import com.example.shop.entity.Category;
import com.example.shop.security.SecurityUtils;
import com.example.shop.service.AdminRoleService;
import com.example.shop.service.CategoryService;
import com.example.shop.service.SecurityAuditLogService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/categories")
public class CategoryController {

    @Autowired
    private CategoryService categoryService;

    @Autowired
    private SecurityAuditLogService auditLogService;

    @Autowired
    private AdminRoleService adminRoleService;

    @GetMapping
    public ResponseEntity<List<CategoryPublicResponse>> getAll(
            @RequestParam(required = false) Long parentId,
            @RequestParam(required = false) Integer level) {
        if (parentId != null) {
            return ResponseEntity.ok(publicCategories(categoryService.findByParentId(parentId)));
        }
        if (level != null) {
            return ResponseEntity.ok(publicCategories(categoryService.findByLevel(level)));
        }
        return ResponseEntity.ok(publicCategories(categoryService.findTopLevel()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<CategoryPublicResponse> getById(@PathVariable Long id) {
        return categoryService.findByIdWithProductCount(id)
                .map(CategoryPublicResponse::from)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Category> create(@RequestBody(required = false) Category category,
                                           Authentication authentication,
                                           HttpServletRequest request) {
        requireAdminActionPermission(authentication, AdminRoleService.CATEGORIES_WRITE_PERMISSION,
                "CATEGORY_CREATE", "CATEGORY", null, request, categoryAuditMetadata(category));
        if (category == null) {
            auditLogService.record("CATEGORY_CREATE", "FAILURE", authentication, "CATEGORY", null, request,
                    "Category payload is required", null);
            return ResponseEntity.badRequest().build();
        }
        try {
            Category savedCategory = categoryService.save(category);
            auditLogService.record("CATEGORY_CREATE", "SUCCESS", authentication, "CATEGORY", savedCategory.getId(), request,
                    "Category created", categoryAuditMetadata(savedCategory));
            return ResponseEntity.ok(savedCategory);
        } catch (IllegalArgumentException e) {
            auditLogService.record("CATEGORY_CREATE", "FAILURE", authentication, "CATEGORY", null, request,
                    e.getMessage(), categoryAuditMetadata(category));
            return ResponseEntity.badRequest().build();
        }
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Category> update(@PathVariable Long id,
                                           @RequestBody(required = false) Category category,
                                           Authentication authentication,
                                           HttpServletRequest request) {
        requireAdminActionPermission(authentication, AdminRoleService.CATEGORIES_WRITE_PERMISSION,
                "CATEGORY_UPDATE", "CATEGORY", id, request, categoryAuditMetadata(category));
        if (category == null) {
            auditLogService.record("CATEGORY_UPDATE", "FAILURE", authentication, "CATEGORY", id, request,
                    "Category payload is required", null);
            return ResponseEntity.badRequest().build();
        }
        return categoryService.findById(id)
                .map(existing -> {
                    category.setId(id);
                    try {
                        Category savedCategory = categoryService.save(category);
                        auditLogService.record("CATEGORY_UPDATE", "SUCCESS", authentication, "CATEGORY", id, request,
                                "Category updated", categoryAuditMetadata(savedCategory));
                        return ResponseEntity.ok(savedCategory);
                    } catch (IllegalArgumentException e) {
                        auditLogService.record("CATEGORY_UPDATE", "FAILURE", authentication, "CATEGORY", id, request,
                                e.getMessage(), categoryAuditMetadata(category));
                        return ResponseEntity.badRequest().<Category>build();
                    }
                })
                .orElseGet(() -> {
                    auditLogService.record("CATEGORY_UPDATE", "FAILURE", authentication, "CATEGORY", id, request,
                            "Category not found", categoryAuditMetadata(category));
                    return ResponseEntity.notFound().build();
                });
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long id,
                                       Authentication authentication,
                                       HttpServletRequest request) {
        requireAdminActionPermission(authentication, AdminRoleService.CATEGORIES_DELETE_PERMISSION,
                "CATEGORY_DELETE", "CATEGORY", id, request, null);
        try {
            Category category = categoryService.findById(id).orElse(null);
            categoryService.deleteById(id);
            auditLogService.record("CATEGORY_DELETE", "SUCCESS", authentication, "CATEGORY", id, request,
                    "Category deleted", categoryAuditMetadata(category));
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException e) {
            auditLogService.record("CATEGORY_DELETE", "FAILURE", authentication, "CATEGORY", id, request,
                    e.getMessage(), null);
            return ResponseEntity.badRequest().build();
        }
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

    private String categoryAuditMetadata(Category category) {
        if (category == null) {
            return null;
        }
        return "name=" + category.getName()
                + ",parentId=" + category.getParentId()
                + ",level=" + category.getLevel();
    }

    private List<CategoryPublicResponse> publicCategories(List<Category> categories) {
        return categories.stream()
                .map(CategoryPublicResponse::from)
                .collect(Collectors.toList());
    }
}
