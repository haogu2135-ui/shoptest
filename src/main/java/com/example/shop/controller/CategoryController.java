package com.example.shop.controller;

import com.example.shop.entity.Category;
import com.example.shop.service.CategoryService;
import com.example.shop.service.SecurityAuditLogService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import java.util.List;

@RestController
@RequestMapping("/categories")
public class CategoryController {

    @Autowired
    private CategoryService categoryService;

    @Autowired
    private SecurityAuditLogService auditLogService;

    @GetMapping
    public ResponseEntity<List<Category>> getAll(
            @RequestParam(required = false) Long parentId,
            @RequestParam(required = false) Integer level) {
        if (parentId != null) {
            return ResponseEntity.ok(categoryService.findByParentId(parentId));
        }
        if (level != null && level == 1) {
            return ResponseEntity.ok(categoryService.findTopLevel());
        }
        return ResponseEntity.ok(categoryService.findAll());
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Category> create(@RequestBody(required = false) Category category,
                                           Authentication authentication,
                                           HttpServletRequest request) {
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

    private String categoryAuditMetadata(Category category) {
        if (category == null) {
            return null;
        }
        return "name=" + category.getName()
                + ",parentId=" + category.getParentId()
                + ",level=" + category.getLevel();
    }
} 
