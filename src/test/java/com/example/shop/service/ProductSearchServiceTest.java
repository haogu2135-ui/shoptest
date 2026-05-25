package com.example.shop.service;

import com.example.shop.entity.Category;
import com.example.shop.entity.Product;
import com.example.shop.repository.CategoryRepository;
import com.example.shop.repository.ProductRepository;
import com.example.shop.repository.ReviewRepository;
import com.example.shop.service.impl.ProductServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ProductSearchServiceTest {
    private ProductServiceImpl service;
    private ProductRepository productRepository;
    private CategoryRepository categoryRepository;
    private ReviewRepository reviewRepository;
    private RuntimeConfigService runtimeConfig;

    @BeforeEach
    void setUp() {
        service = new ProductServiceImpl();
        productRepository = mock(ProductRepository.class);
        categoryRepository = mock(CategoryRepository.class);
        reviewRepository = mock(ReviewRepository.class);
        runtimeConfig = mock(RuntimeConfigService.class);
        ReflectionTestUtils.setField(service, "productRepository", productRepository);
        ReflectionTestUtils.setField(service, "categoryRepository", categoryRepository);
        ReflectionTestUtils.setField(service, "reviewRepository", reviewRepository);
        ReflectionTestUtils.setField(service, "runtimeConfig", runtimeConfig);
        when(runtimeConfig.getLong("product.search-cache-ttl-ms", 30000)).thenReturn(0L);
        when(reviewRepository.summarizeApprovedReviewsByProductIds(anyList())).thenReturn(List.of());
    }

    @Test
    void searchUsesSingleCategoryLookupForCategoryText() {
        Product product = product(7L, "Everyday Bowl", 2L);
        Category root = category(1L, "Dogs", null);
        Category child = category(2L, "Feeding", 1L);

        when(productRepository.findAll()).thenReturn(List.of(product));
        when(categoryRepository.findAll()).thenReturn(List.of(root, child));

        List<Product> results = service.search("dogs", null);

        assertEquals(List.of(product), results);
        verify(categoryRepository).findAll();
        verify(categoryRepository, never()).findById(1L);
        verify(categoryRepository, never()).findById(2L);
    }

    @Test
    void emptySearchDoesNotLoadCategories() {
        Product product = product(8L, "Cat Bed", 3L);
        when(productRepository.findAll()).thenReturn(List.of(product));

        List<Product> results = service.search("   ", null);

        assertEquals(List.of(product), results);
        verify(categoryRepository, never()).findAll();
        verify(categoryRepository, never()).findById(org.mockito.ArgumentMatchers.anyLong());
    }

    private Product product(Long id, String name, Long categoryId) {
        Product product = new Product();
        product.setId(id);
        product.setName(name);
        product.setDescription("");
        product.setPrice(BigDecimal.TEN);
        product.setStock(5);
        product.setCategoryId(categoryId);
        product.setStatus("ACTIVE");
        return product;
    }

    private Category category(Long id, String name, Long parentId) {
        Category category = new Category();
        category.setId(id);
        category.setName(name);
        category.setParentId(parentId);
        category.setLevel(parentId == null ? 1 : 2);
        return category;
    }
}
