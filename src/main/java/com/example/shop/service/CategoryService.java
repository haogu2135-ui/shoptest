package com.example.shop.service;

import com.example.shop.entity.Category;
import java.util.List;
import java.util.Optional;

public interface CategoryService {
    List<Category> findAll();
    List<Category> findAll(int maxRows);
    List<Category> findByParentId(Long parentId);
    List<Category> findByLevel(Integer level);
    List<Long> findSelfAndDescendantIds(Long id);
    List<Category> findTopLevel();
    Optional<Category> findById(Long id);
    Optional<Category> findByIdWithProductCount(Long id);
    Category save(Category category);
    void deleteById(Long id);
}
