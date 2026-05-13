package com.example.shop.controller;

import com.example.shop.entity.Category;
import com.example.shop.service.CategoryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/categories")
public class CategoryController {

    @Autowired
    private CategoryService categoryService;

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
    public ResponseEntity<Category> create(@RequestBody Category category) {
        try {
            return ResponseEntity.ok(categoryService.save(category));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Category> update(@PathVariable Long id, @RequestBody Category category) {
        return categoryService.findById(id)
                .map(existing -> {
                    category.setId(id);
                    try {
                        return ResponseEntity.ok(categoryService.save(category));
                    } catch (IllegalArgumentException e) {
                        return ResponseEntity.badRequest().<Category>build();
                    }
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        try {
            categoryService.deleteById(id);
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }
} 
