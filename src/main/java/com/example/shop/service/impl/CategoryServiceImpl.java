package com.example.shop.service.impl;

import lombok.extern.slf4j.Slf4j;

import com.example.shop.entity.Category;
import com.example.shop.repository.CategoryRepository;
import com.example.shop.repository.ProductRepository;
import com.example.shop.service.CategoryService;
import com.example.shop.util.ImageUrlValidator;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@Slf4j
public class CategoryServiceImpl implements CategoryService {
    private static final int MAX_CATEGORY_COUNT_DEPTH = 3;

    @Autowired
    private CategoryRepository categoryRepository;

    @Autowired
    private ProductRepository productRepository;

    @Override
    @Cacheable(cacheNames = "categoryReferenceData", key = "'all'")
    public List<Category> findAll() {
        return withProductCounts(categoryRepository.findAll());
    }

    @Override
    @Cacheable(cacheNames = "categoryReferenceData", key = "'all:max=' + #maxRows")
    public List<Category> findAll(int maxRows) {
        return withProductCounts(categoryRepository.findAllByOrderByLevelAscParentIdAscNameAscIdAsc(
                PageRequest.of(0, Math.max(1, maxRows))));
    }

    @Override
    @Cacheable(cacheNames = "categoryReferenceData", key = "'parent=' + (#parentId == null ? 'root' : #parentId)")
    public List<Category> findByParentId(Long parentId) {
        if (parentId == null) {
            return withProductCounts(categoryRepository.findByParentIdIsNull());
        }
        return withProductCounts(categoryRepository.findByParentId(parentId));
    }

    @Override
    @Cacheable(cacheNames = "categoryReferenceData", key = "'level=' + #level")
    public List<Category> findByLevel(Integer level) {
        if (level == null || level <= 0) {
            return List.of();
        }
        if (level == 1) {
            return findTopLevel();
        }
        return withProductCounts(categoryRepository.findByLevel(level));
    }

    @Override
    @Cacheable(cacheNames = "categoryReferenceData", key = "'top'")
    public List<Category> findTopLevel() {
        return withProductCounts(categoryRepository.findByParentIdIsNull());
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
    @Cacheable(cacheNames = "categoryReferenceData", key = "'id:count=' + #id", unless = "#result == null || #result.isEmpty()")
    public Optional<Category> findByIdWithProductCount(Long id) {
        return categoryRepository.findById(id)
                .map(category -> {
                    category.setProductCount(countPublicProductsForRoots(List.of(category)).getOrDefault(category.getId(), 0L));
                    return category;
                });
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(cacheNames = "categoryReferenceData", allEntries = true)
    public Category save(Category category) {
        category.setImageUrl(ImageUrlValidator.normalizePersistentImageUrl(category.getImageUrl(), "imageUrl"));
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
        category.setPath(buildCategoryPath(category.getParentId(), category.getId()));
        Category saved = categoryRepository.save(category);
        if (saved.getId() != null) {
            String savedPath = buildCategoryPath(saved.getParentId(), saved.getId());
            if (!savedPath.equals(saved.getPath())) {
                saved.setPath(savedPath);
                saved = categoryRepository.save(saved);
            }
            refreshChildHierarchy(saved.getId(), saved.getLevel(), saved.getPath());
        }
        return saved;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(cacheNames = "categoryReferenceData", allEntries = true)
    public void deleteById(Long id) {
        if (id == null || !categoryRepository.existsById(id)) {
            throw new IllegalArgumentException("Category not found");
        }
        if (categoryRepository.existsByParentId(id)) {
            throw new IllegalArgumentException("Please delete child categories first");
        }
        if (productRepository.existsByCategoryId(id)) {
            throw new IllegalArgumentException("Please move or delete products in this category first");
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

    private void refreshChildHierarchy(Long parentId, Integer parentLevel, String parentPath) {
        categoryRepository.findByParentId(parentId).forEach(child -> {
            child.setLevel(parentLevel + 1);
            child.setPath(appendPath(parentPath, child.getId()));
            categoryRepository.save(child);
            refreshChildHierarchy(child.getId(), child.getLevel(), child.getPath());
        });
    }

    private String buildCategoryPath(Long parentId, Long categoryId) {
        if (categoryId == null) {
            return null;
        }
        if (parentId == null) {
            return appendPath(null, categoryId);
        }
        return categoryRepository.findById(parentId)
                .map(parent -> appendPath(parent.getPath() != null && !parent.getPath().isBlank()
                        ? parent.getPath()
                        : buildCategoryPath(parent.getParentId(), parent.getId()), categoryId))
                .orElse(appendPath(null, categoryId));
    }

    private String appendPath(String parentPath, Long categoryId) {
        if (categoryId == null) {
            return parentPath;
        }
        String normalizedParent = parentPath == null ? "" : parentPath.trim();
        if (normalizedParent.isEmpty()) {
            return "/" + categoryId + "/";
        }
        String prefix = normalizedParent.startsWith("/") ? normalizedParent : "/" + normalizedParent;
        if (!prefix.endsWith("/")) {
            prefix += "/";
        }
        return prefix + categoryId + "/";
    }

    private List<Category> withProductCounts(List<Category> categories) {
        if (categories == null || categories.isEmpty()) {
            return categories;
        }
        Map<Long, Long> productCounts = countPublicProductsForRoots(categories);
        categories.forEach(category -> category.setProductCount(productCounts.getOrDefault(category.getId(), 0L)));
        return categories;
    }

    private Map<Long, Long> countPublicProductsForRoots(List<Category> rootCategories) {
        Set<Long> rootIds = rootCategories.stream()
                .map(Category::getId)
                .filter(id -> id != null && id > 0)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (rootIds.isEmpty()) {
            return Collections.emptyMap();
        }

        Map<Long, Set<Long>> categoryIdsByRoot = new LinkedHashMap<>();
        Map<Long, Set<Long>> rootsByParentId = new LinkedHashMap<>();
        for (Long rootId : rootIds) {
            categoryIdsByRoot.put(rootId, new LinkedHashSet<>(List.of(rootId)));
            rootsByParentId.put(rootId, new LinkedHashSet<>(List.of(rootId)));
        }

        Set<Long> frontier = new LinkedHashSet<>(rootIds);
        for (int depth = 1; depth < MAX_CATEGORY_COUNT_DEPTH && !frontier.isEmpty(); depth++) {
            List<Category> children = categoryRepository.findByParentIdIn(new ArrayList<>(frontier));
            Set<Long> nextFrontier = new LinkedHashSet<>();
            Map<Long, Set<Long>> nextRootsByParentId = new LinkedHashMap<>();
            for (Category child : children) {
                Long childId = child.getId();
                Long parentId = child.getParentId();
                if (childId == null || parentId == null) {
                    continue;
                }
                Set<Long> owningRoots = rootsByParentId.get(parentId);
                if (owningRoots == null || owningRoots.isEmpty()) {
                    continue;
                }
                for (Long rootId : owningRoots) {
                    categoryIdsByRoot.computeIfAbsent(rootId, ignored -> new LinkedHashSet<>()).add(childId);
                }
                nextFrontier.add(childId);
                nextRootsByParentId.computeIfAbsent(childId, ignored -> new LinkedHashSet<>()).addAll(owningRoots);
            }
            frontier = nextFrontier;
            rootsByParentId = nextRootsByParentId;
        }

        Set<Long> categoryIds = categoryIdsByRoot.values().stream()
                .flatMap(Set::stream)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        Map<Long, Long> directCounts = productRepository.countPublicProductsByCategoryIds(new ArrayList<>(categoryIds)).stream()
                .collect(Collectors.toMap(
                        row -> ((Number) row[0]).longValue(),
                        row -> ((Number) row[1]).longValue(),
                        Long::sum,
                        LinkedHashMap::new));

        Map<Long, Long> countsByRoot = new LinkedHashMap<>();
        categoryIdsByRoot.forEach((rootId, ids) -> {
            long total = ids.stream()
                    .mapToLong(id -> directCounts.getOrDefault(id, 0L))
                    .sum();
            countsByRoot.put(rootId, total);
        });
        return countsByRoot;
    }

    private long countPublicProducts(Long categoryId) {
        if (categoryId == null) {
            return 0;
        }
        Category category = new Category();
        category.setId(categoryId);
        return countPublicProductsForRoots(List.of(category)).getOrDefault(categoryId, 0L);
    }
}
