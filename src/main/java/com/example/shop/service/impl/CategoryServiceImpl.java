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

@Service
@Slf4j
public class CategoryServiceImpl implements CategoryService {
    private static final int MAX_CATEGORY_COUNT_DEPTH = 3;
    private static final int DEFAULT_PUBLIC_CATEGORY_LIST_LIMIT = 500;
    private static final int DEFAULT_LEGACY_CATEGORY_LIST_LIMIT = 500;
    private static final int HARD_CATEGORY_REFERENCE_LIST_LIMIT = 1_000;
    private static final PageRequest PUBLIC_CATEGORY_PAGE =
            PageRequest.of(0, DEFAULT_PUBLIC_CATEGORY_LIST_LIMIT);

    @Autowired
    private CategoryRepository categoryRepository;

    @Autowired
    private ProductRepository productRepository;

    @Override
    @Cacheable(cacheNames = "categoryReferenceData", key = "'all'")
    public List<Category> findAll() {
        return findAll(DEFAULT_LEGACY_CATEGORY_LIST_LIMIT);
    }

    @Override
    @Cacheable(cacheNames = "categoryReferenceData", key = "'all:max=' + #maxRows")
    public List<Category> findAll(int maxRows) {
        int boundedMaxRows = Math.max(1, Math.min(maxRows, HARD_CATEGORY_REFERENCE_LIST_LIMIT));
        PageRequest page = boundedMaxRows == DEFAULT_LEGACY_CATEGORY_LIST_LIMIT
                ? PUBLIC_CATEGORY_PAGE
                : PageRequest.of(0, boundedMaxRows);
        return withProductCounts(categoryRepository.findAllByOrderByLevelAscParentIdAscNameAscIdAsc(
                page));
    }

    @Override
    @Cacheable(cacheNames = "categoryReferenceData", key = "'parent=' + (#parentId == null ? 'root' : #parentId)")
    public List<Category> findByParentId(Long parentId) {
        if (parentId == null) {
            return withProductCounts(categoryRepository.findByParentIdIsNullOrderByNameAscIdAsc(PUBLIC_CATEGORY_PAGE));
        }
        return withProductCounts(categoryRepository.findByParentIdOrderByNameAscIdAsc(parentId, PUBLIC_CATEGORY_PAGE));
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
        return withProductCounts(categoryRepository.findByLevelOrderByNameAscIdAsc(
                level,
                PUBLIC_CATEGORY_PAGE));
    }

    @Override
    @Cacheable(cacheNames = "categoryReferenceData", key = "'top'")
    public List<Category> findTopLevel() {
        return withProductCounts(categoryRepository.findByParentIdIsNullOrderByNameAscIdAsc(
                PUBLIC_CATEGORY_PAGE));
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
        CategoryHierarchy hierarchy = null;
        Category parent = null;
        int newLevel;
        if (category.getParentId() == null) {
            newLevel = 1;
        } else {
            parent = categoryRepository.findById(category.getParentId())
                    .orElseThrow(() -> new IllegalArgumentException("Parent category not found"));
            if (category.getId() != null) {
                hierarchy = loadCategoryHierarchy(category.getId());
                if (hierarchy.ids.contains(parent.getId())) {
                    throw new IllegalArgumentException("Category cannot move under itself or its descendants");
                }
            }
            if (parent.getLevel() == null) {
                parent.setLevel(1);
            }
            if (parent.getLevel() >= 3) {
                throw new IllegalArgumentException("Category depth cannot exceed 3 levels");
            }
            newLevel = parent.getLevel() + 1;
        }
        if (category.getId() != null) {
            if (hierarchy == null) {
                hierarchy = loadCategoryHierarchy(category.getId());
            }
            if (newLevel + hierarchy.maxDepth > 3) {
                throw new IllegalArgumentException("Moving this category would exceed 3 levels");
            }
        }
        category.setLevel(newLevel);
        category.setPath(buildCategoryPath(parent, category.getParentId(), category.getId()));
        Category saved = categoryRepository.save(category);
        if (saved.getId() != null) {
            String savedPath = buildCategoryPath(parent, saved.getParentId(), saved.getId());
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
        if (id == null) {
            return;
        }
        ids.addAll(loadCategoryHierarchy(id).ids);
    }

    private int maxChildDepth(Long id) {
        if (id == null) {
            return 0;
        }
        return loadCategoryHierarchy(id).maxDepth;
    }

    private CategoryHierarchy loadCategoryHierarchy(Long id) {
        Set<Long> visited = new LinkedHashSet<>();
        visited.add(id);
        Set<Long> frontier = new LinkedHashSet<>();
        frontier.add(id);
        int depth = 0;
        while (!frontier.isEmpty()) {
            List<Category> children = categoryRepository.findByParentIdIn(new ArrayList<>(frontier));
            Set<Long> nextFrontier = new LinkedHashSet<>(children.size());
            for (Category child : children) {
                if (child == null || child.getId() == null || !visited.add(child.getId())) {
                    continue;
                }
                nextFrontier.add(child.getId());
            }
            if (nextFrontier.isEmpty()) {
                break;
            }
            depth++;
            frontier = nextFrontier;
        }
        return new CategoryHierarchy(visited, depth);
    }

    private void refreshChildHierarchy(Long parentId, Integer parentLevel, String parentPath) {
        if (parentId == null || parentLevel == null) {
            return;
        }
        Set<Long> visited = new LinkedHashSet<>();
        visited.add(parentId);
        Set<Long> frontier = new LinkedHashSet<>();
        frontier.add(parentId);
        Map<Long, Integer> parentLevels = new LinkedHashMap<>(4);
        Map<Long, String> parentPaths = new LinkedHashMap<>(4);
        parentLevels.put(parentId, parentLevel);
        parentPaths.put(parentId, parentPath);
        while (!frontier.isEmpty()) {
            List<Category> children = categoryRepository.findByParentIdIn(new ArrayList<>(frontier));
            Set<Long> nextFrontier = new LinkedHashSet<>(children.size());
            Map<Long, Integer> nextParentLevels = new LinkedHashMap<>(children.size());
            Map<Long, String> nextParentPaths = new LinkedHashMap<>(children.size());
            for (Category child : children) {
                if (child == null || child.getId() == null || child.getParentId() == null
                        || !parentLevels.containsKey(child.getParentId())
                        || !visited.add(child.getId())) {
                    continue;
                }
                int childLevel = parentLevels.get(child.getParentId()) + 1;
                String childPath = appendPath(parentPaths.get(child.getParentId()), child.getId());
                child.setLevel(childLevel);
                child.setPath(childPath);
                categoryRepository.save(child);
                nextFrontier.add(child.getId());
                nextParentLevels.put(child.getId(), childLevel);
                nextParentPaths.put(child.getId(), childPath);
            }
            frontier = nextFrontier;
            parentLevels = nextParentLevels;
            parentPaths = nextParentPaths;
        }
    }

    private String buildCategoryPath(Long parentId, Long categoryId) {
        return buildCategoryPath(null, parentId, categoryId);
    }

    private String buildCategoryPath(Category loadedParent, Long parentId, Long categoryId) {
        if (categoryId == null) {
            return null;
        }
        if (parentId == null) {
            return appendPath(null, categoryId);
        }
        if (loadedParent != null && parentId.equals(loadedParent.getId())) {
            String loadedParentPath = loadedParent.getPath();
            String parentPath = loadedParentPath != null && !loadedParentPath.isBlank()
                    ? loadedParentPath
                    : buildCategoryPath(loadedParent.getParentId(), loadedParent.getId());
            return appendPath(parentPath, categoryId);
        }
        return categoryRepository.findById(parentId)
                .map(parent -> {
                    String storedParentPath = parent.getPath();
                    String parentPath = storedParentPath != null && !storedParentPath.isBlank()
                            ? storedParentPath
                            : buildCategoryPath(parent.getParentId(), parent.getId());
                    return appendPath(parentPath, categoryId);
                })
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
        String categoryText = String.valueOf(categoryId);
        int extraSlash = prefix.endsWith("/") ? 0 : 1;
        StringBuilder path = new StringBuilder(prefix.length() + extraSlash + categoryText.length() + 1)
                .append(prefix);
        if (extraSlash == 1) {
            path.append('/');
        }
        return path.append(categoryText).append('/').toString();
    }

    private List<Category> withProductCounts(List<Category> categories) {
        if (categories == null || categories.isEmpty()) {
            return categories;
        }
        Map<Long, Long> productCounts = countPublicProductsForRoots(categories);
        for (Category category : categories) {
            category.setProductCount(productCounts.getOrDefault(category.getId(), 0L));
        }
        return categories;
    }

    private Map<Long, Long> countPublicProductsForRoots(List<Category> rootCategories) {
        Set<Long> rootIds = new LinkedHashSet<>(rootCategories.size());
        for (Category rootCategory : rootCategories) {
            Long rootId = rootCategory.getId();
            if (rootId != null && rootId > 0) {
                rootIds.add(rootId);
            }
        }
        if (rootIds.isEmpty()) {
            return Collections.emptyMap();
        }

        Map<Long, Set<Long>> categoryIdsByRoot = new LinkedHashMap<>(rootIds.size());
        Map<Long, Set<Long>> rootsByParentId = new LinkedHashMap<>(rootIds.size());
        for (Long rootId : rootIds) {
            Set<Long> rootCategoryIds = new LinkedHashSet<>();
            rootCategoryIds.add(rootId);
            categoryIdsByRoot.put(rootId, rootCategoryIds);
            Set<Long> owningRoots = new LinkedHashSet<>();
            owningRoots.add(rootId);
            rootsByParentId.put(rootId, owningRoots);
        }

        Set<Long> frontier = new LinkedHashSet<>(rootIds);
        for (int depth = 1; depth < MAX_CATEGORY_COUNT_DEPTH && !frontier.isEmpty(); depth++) {
            List<Category> children = categoryRepository.findByParentIdIn(new ArrayList<>(frontier));
            Set<Long> nextFrontier = new LinkedHashSet<>(children.size());
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

        Set<Long> categoryIds = new LinkedHashSet<>(rootIds.size());
        for (Set<Long> ids : categoryIdsByRoot.values()) {
            categoryIds.addAll(ids);
        }
        List<Object[]> countRows = productRepository.countPublicProductsByCategoryIds(new ArrayList<>(categoryIds));
        Map<Long, Long> directCounts = new LinkedHashMap<>(countRows.size());
        for (Object[] row : countRows) {
            Long categoryId = ((Number) row[0]).longValue();
            Long count = ((Number) row[1]).longValue();
            directCounts.merge(categoryId, count, Long::sum);
        }

        Map<Long, Long> countsByRoot = new LinkedHashMap<>(categoryIdsByRoot.size());
        categoryIdsByRoot.forEach((rootId, ids) -> {
            long total = 0L;
            for (Long id : ids) {
                total += directCounts.getOrDefault(id, 0L);
            }
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

    private static class CategoryHierarchy {
        private final Set<Long> ids;
        private final int maxDepth;

        private CategoryHierarchy(Set<Long> ids, int maxDepth) {
            this.ids = ids;
            this.maxDepth = maxDepth;
        }
    }
}
