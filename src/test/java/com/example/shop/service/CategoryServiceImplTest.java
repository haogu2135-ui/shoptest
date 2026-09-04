package com.example.shop.service;

import com.example.shop.entity.Category;
import com.example.shop.repository.CategoryRepository;
import com.example.shop.repository.ProductRepository;
import com.example.shop.service.impl.CategoryServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CategoryServiceImplTest {
    private CategoryRepository categoryRepository;
    private CategoryServiceImpl categoryService;

    @BeforeEach
    void setUp() {
        categoryRepository = mock(CategoryRepository.class);
        ProductRepository productRepository = mock(ProductRepository.class);
        categoryService = new CategoryServiceImpl();
        ReflectionTestUtils.setField(categoryService, "categoryRepository", categoryRepository);
        ReflectionTestUtils.setField(categoryService, "productRepository", productRepository);
        when(categoryRepository.save(any(Category.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void saveNormalizesSafeImageUrlBeforePersisting() {
        Category category = validRootCategory();
        category.setImageUrl("  /uploads/categories/beds.png  ");

        categoryService.save(category);

        ArgumentCaptor<Category> captor = ArgumentCaptor.forClass(Category.class);
        verify(categoryRepository).save(captor.capture());
        assertEquals("/uploads/categories/beds.png", captor.getValue().getImageUrl());
        assertEquals(1, captor.getValue().getLevel());
    }

    @Test
    void saveAllowsPublicHttpImageUrl() {
        Category category = validRootCategory();
        category.setImageUrl("https://cdn.example.com/categories/beds.png");

        Category saved = categoryService.save(category);

        assertEquals("https://cdn.example.com/categories/beds.png", saved.getImageUrl());
    }

    @Test
    void saveNormalizesLegacyUploadedImageUrlBeforePersisting() {
        Category category = validRootCategory();
        category.setImageUrl("uploads/categories/beds.png");

        Category saved = categoryService.save(category);

        assertEquals("/uploads/categories/beds.png", saved.getImageUrl());
    }

    @Test
    void saveDropsBlankImageUrl() {
        Category category = validRootCategory();
        category.setImageUrl("   ");

        Category saved = categoryService.save(category);

        assertNull(saved.getImageUrl());
    }

    @Test
    void saveRejectsUnsafeImageUrlBeforePersisting() {
        for (String imageUrl : new String[] {
                "data:image/png;base64,abc",
                "blob:https://app.example.com/id",
                "assets/category.png",
                "http://localhost/category.png",
                "https://10.0.0.4/category.png",
                "http://[::ffff:127.0.0.1]/category.png",
                "http://2130706433/category.png",
                "http://0177.0.0.1/category.png",
                "https://cdn.example.com:8443/category.png",
                "https://user:pass@example.com/category.png"
        }) {
            Category category = validRootCategory();
            category.setImageUrl(imageUrl);

            assertThrows(IllegalArgumentException.class, () -> categoryService.save(category), imageUrl);
        }
        verify(categoryRepository, never()).save(any());
    }

    @Test
    void saveValidatesChildCategoryImageBeforeLoadingParent() {
        Category category = validRootCategory();
        category.setParentId(7L);
        category.setImageUrl("data:image/png;base64,abc");

        assertThrows(IllegalArgumentException.class, () -> categoryService.save(category));

        verify(categoryRepository, never()).findById(7L);
        verify(categoryRepository, never()).save(any());
    }

    @Test
    void legacyCategoryLookupUsesBoundedSortedQuery() {
        when(categoryRepository.findAllByOrderByLevelAscParentIdAscNameAscIdAsc(PageRequest.of(0, 500)))
                .thenReturn(List.of());

        assertEquals(List.of(), categoryService.findAll());

        verify(categoryRepository).findAllByOrderByLevelAscParentIdAscNameAscIdAsc(PageRequest.of(0, 500));
        verify(categoryRepository, never()).findAll();
    }

    @Test
    void publicParentLookupUsesBoundedStableQuery() {
        when(categoryRepository.findByParentIdOrderByNameAscIdAsc(7L, PageRequest.of(0, 500)))
                .thenReturn(List.of());

        assertEquals(List.of(), categoryService.findByParentId(7L));

        verify(categoryRepository).findByParentIdOrderByNameAscIdAsc(7L, PageRequest.of(0, 500));
    }

    @Test
    void publicLevelLookupUsesBoundedStableQuery() {
        when(categoryRepository.findByLevelOrderByNameAscIdAsc(2, PageRequest.of(0, 500)))
                .thenReturn(List.of());

        assertEquals(List.of(), categoryService.findByLevel(2));

        verify(categoryRepository).findByLevelOrderByNameAscIdAsc(2, PageRequest.of(0, 500));
    }

    @Test
    void publicTopLevelLookupUsesBoundedStableQuery() {
        when(categoryRepository.findByParentIdIsNullOrderByNameAscIdAsc(PageRequest.of(0, 500)))
                .thenReturn(List.of());

        assertEquals(List.of(), categoryService.findTopLevel());

        verify(categoryRepository).findByParentIdIsNullOrderByNameAscIdAsc(PageRequest.of(0, 500));
    }

    @Test
    void savePreservesHierarchyValidationForSafeChildImage() {
        Category parent = validRootCategory();
        parent.setId(7L);
        parent.setLevel(1);
        Category child = validRootCategory();
        child.setParentId(7L);
        child.setImageUrl("/uploads/categories/kittens.png");
        when(categoryRepository.findById(7L)).thenReturn(Optional.of(parent));

        Category saved = categoryService.save(child);

        assertEquals(2, saved.getLevel());
        assertEquals("/uploads/categories/kittens.png", saved.getImageUrl());
    }

    @Test
    void descendantLookupUsesBatchedParentQueries() {
        Category child = validRootCategory();
        child.setId(8L);
        child.setParentId(7L);
        when(categoryRepository.findByParentIdIn(List.of(7L))).thenReturn(List.of(child));
        when(categoryRepository.findByParentIdIn(List.of(8L))).thenReturn(List.of());

        assertEquals(List.of(7L, 8L), categoryService.findSelfAndDescendantIds(7L));

        verify(categoryRepository).findByParentIdIn(List.of(7L));
        verify(categoryRepository).findByParentIdIn(List.of(8L));
    }

    @Test
    void maxChildDepthUsesBatchedParentQueriesAndCycleProtection() {
        Category child = validRootCategory();
        child.setId(8L);
        child.setParentId(7L);
        Category cycle = validRootCategory();
        cycle.setId(7L);
        cycle.setParentId(8L);
        when(categoryRepository.findByParentIdIn(List.of(7L))).thenReturn(List.of(child));
        when(categoryRepository.findByParentIdIn(List.of(8L))).thenReturn(List.of(cycle));

        Integer maxDepth = ReflectionTestUtils.invokeMethod(categoryService, "maxChildDepth", 7L);
        assertEquals(Integer.valueOf(1), maxDepth);

        verify(categoryRepository).findByParentIdIn(List.of(7L));
        verify(categoryRepository).findByParentIdIn(List.of(8L));
    }

    @Test
    void childHierarchyRefreshUsesBatchedParentQueries() {
        Category child = validRootCategory();
        child.setId(8L);
        child.setParentId(7L);
        Category grandchild = validRootCategory();
        grandchild.setId(9L);
        grandchild.setParentId(8L);
        when(categoryRepository.findByParentIdIn(List.of(7L))).thenReturn(List.of(child));
        when(categoryRepository.findByParentIdIn(List.of(8L))).thenReturn(List.of(grandchild));
        when(categoryRepository.findByParentIdIn(List.of(9L))).thenReturn(List.of());

        ReflectionTestUtils.invokeMethod(categoryService, "refreshChildHierarchy", 7L, 1, "/7/");

        assertEquals(2, child.getLevel());
        assertEquals("/7/8/", child.getPath());
        assertEquals(3, grandchild.getLevel());
        assertEquals("/7/8/9/", grandchild.getPath());
        verify(categoryRepository).findByParentIdIn(List.of(7L));
        verify(categoryRepository).findByParentIdIn(List.of(8L));
        verify(categoryRepository).findByParentIdIn(List.of(9L));
    }

    @Test
    void saveReusesCategoryHierarchyTraversalForMoveValidationAndDepth() {
        Category targetParent = validRootCategory();
        targetParent.setId(9L);
        targetParent.setPath("/9/");
        Category moving = validRootCategory();
        moving.setId(7L);
        moving.setParentId(9L);
        Category child = validRootCategory();
        child.setId(8L);
        child.setParentId(7L);
        when(categoryRepository.findById(9L)).thenReturn(Optional.of(targetParent));
        when(categoryRepository.findByParentIdIn(List.of(7L))).thenReturn(List.of(child));
        when(categoryRepository.findByParentIdIn(List.of(8L))).thenReturn(List.of());

        Category saved = categoryService.save(moving);

        assertEquals(2, saved.getLevel());
        assertEquals("/9/7/", saved.getPath());
        verify(categoryRepository, times(1)).findById(9L);
        verify(categoryRepository, times(2)).findByParentIdIn(List.of(7L));
        verify(categoryRepository, times(2)).findByParentIdIn(List.of(8L));
    }

    private Category validRootCategory() {
        Category category = new Category();
        category.setName("Beds");
        category.setLevel(1);
        return category;
    }
}
