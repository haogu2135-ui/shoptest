package com.example.shop.service.impl;

import com.example.shop.entity.Category;
import com.example.shop.repository.CategoryRepository;
import com.example.shop.service.CategoryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.ArrayList;

@Service
public class CategoryServiceImpl implements CategoryService {

    @Autowired
    private CategoryRepository categoryRepository;

    @Override
    public List<Category> findAll() {
        return categoryRepository.findAll();
    }

    @Override
    public List<Category> findByParentId(Long parentId) {
        if (parentId == null) {
            return categoryRepository.findByParentIdIsNull();
        }
        return categoryRepository.findByParentId(parentId);
    }

    @Override
    public List<Category> findTopLevel() {
        return categoryRepository.findByParentIdIsNull();
    }

    @Override
    public List<Long> findSelfAndDescendantIds(Long id) {
        List<Long> ids = new ArrayList<>();
        collectDescendantIds(id, ids);
        return ids;
    }

    @Override
    public Optional<Category> findById(Long id) {
        return categoryRepository.findById(id);
    }

    @Override
    @Transactional
    public Category save(Category category) {
        if (category.getId() != null && category.getParentId() != null && category.getId().equals(category.getParentId())) {
            throw new IllegalArgumentException("Category cannot be its own parent");
        }
        int newLevel;
        if (category.getParentId() == null) {
            newLevel = 1;
        } else {
            Category parent = categoryRepository.findById(category.getParentId())
                    .orElseThrow(() -> new IllegalArgumentException("Parent category not found"));
            if (category.getId() != null && findSelfAndDescendantIds(category.getId()).contains(parent.getId())) {
                throw new IllegalArgumentException("Category cannot move under itself or its descendants");
            }
            if (parent.getLevel() == null) {
                parent.setLevel(1);
            }
            if (parent.getLevel() >= 3) {
                throw new IllegalArgumentException("Category depth cannot exceed 3 levels");
            }
            newLevel = parent.getLevel() + 1;
        }
        if (category.getId() != null && newLevel + maxChildDepth(category.getId()) > 3) {
            throw new IllegalArgumentException("Moving this category would exceed 3 levels");
        }
        category.setLevel(newLevel);
        Category saved = categoryRepository.save(category);
        refreshChildLevels(saved.getId(), saved.getLevel());
        return saved;
    }

    @Override
    @Transactional
    public void deleteById(Long id) {
        if (categoryRepository.existsByParentId(id)) {
            throw new IllegalArgumentException("Please delete child categories first");
        }
        categoryRepository.deleteById(id);
    }

    private void collectDescendantIds(Long id, List<Long> ids) {
        ids.add(id);
        categoryRepository.findByParentId(id).forEach(child -> collectDescendantIds(child.getId(), ids));
    }

    private int maxChildDepth(Long id) {
        return categoryRepository.findByParentId(id).stream()
                .mapToInt(child -> 1 + maxChildDepth(child.getId()))
                .max()
                .orElse(0);
    }

    private void refreshChildLevels(Long parentId, Integer parentLevel) {
        categoryRepository.findByParentId(parentId).forEach(child -> {
            child.setLevel(parentLevel + 1);
            categoryRepository.save(child);
            refreshChildLevels(child.getId(), child.getLevel());
        });
    }
} 
