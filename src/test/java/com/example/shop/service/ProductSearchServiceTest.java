package com.example.shop.service;

import com.example.shop.dto.ProductListQuery;
import com.example.shop.entity.Category;
import com.example.shop.entity.Product;
import com.example.shop.repository.CategoryRepository;
import com.example.shop.repository.ProductRepository;
import com.example.shop.repository.ReviewRepository;
import com.example.shop.service.impl.ProductServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
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
        when(runtimeConfig.getInt("product.public-default-page-size", 20)).thenReturn(20);
        when(runtimeConfig.getInt("product.public-max-page-size", 100)).thenReturn(100);
        when(runtimeConfig.getInt("product.search-legacy-max-results", 100)).thenReturn(100);
        when(runtimeConfig.getInt("product.public-legacy-list-max-rows", 20)).thenReturn(24);
        when(runtimeConfig.getInt("product.legacy-list-max-rows", 500)).thenReturn(500);
        when(runtimeConfig.getInt("product.discount-list-max-rows", 100)).thenReturn(100);
        when(reviewRepository.summarizeApprovedReviewsByProductIds(anyList())).thenReturn(List.of());
        when(categoryRepository.findIdsByKeyword(any(), any(Pageable.class))).thenReturn(List.of());
        when(categoryRepository.findByParentId(any())).thenReturn(List.of());
        when(categoryRepository.findAllById(anyList())).thenReturn(List.of());
        stubPublicProductPage(List.of());
    }

    @Test
    void publicProductQueryWithoutSizeUsesConfiguredBoundedPageInsteadOfFullCatalogLoad() {
        Product product = product(11L, "Bounded Bowl", 5L);
        when(runtimeConfig.getInt("product.public-default-page-size", 20)).thenReturn(18);
        stubPublicProductPage(List.of(product));
        when(categoryRepository.findAllById(List.of(product.getCategoryId()))).thenReturn(List.of());

        List<Product> results = service.findPublicProducts(new ProductListQuery());

        assertEquals(List.of(product), results);
        Pageable pageable = capturedPublicPageable();
        assertEquals(0, pageable.getPageNumber());
        assertEquals(18, pageable.getPageSize());
        verify(productRepository, never()).findAll();
    }

    @Test
    void publicProductQueryNormalizesNegativePageAndCapsOversizedPageSize() {
        when(runtimeConfig.getInt("product.public-max-page-size", 100)).thenReturn(35);
        ProductListQuery query = new ProductListQuery();
        query.setPage(-9);
        query.setSize(1000);

        service.findPublicProducts(query);

        Pageable pageable = capturedPublicPageable();
        assertEquals(0, pageable.getPageNumber());
        assertEquals(35, pageable.getPageSize());
        verify(productRepository, never()).findAll();
    }

    @Test
    void legacySearchUsesCappedPagedQueryInsteadOfUnboundedRepositoryReads() {
        Product product = product(12L, "Legacy Search Bowl", 9L);
        when(runtimeConfig.getInt("product.search-legacy-max-results", 100)).thenReturn(500);
        when(runtimeConfig.getInt("product.public-max-page-size", 100)).thenReturn(80);
        when(categoryRepository.findByParentId(9L)).thenReturn(List.of());
        when(categoryRepository.findAllById(List.of(product.getCategoryId()))).thenReturn(List.of());
        stubPublicProductPage(List.of(product));

        List<Product> results = service.search("legacy", 9L);

        assertEquals(List.of(product), results);
        Pageable pageable = capturedPublicPageable();
        assertEquals(0, pageable.getPageNumber());
        assertEquals(80, pageable.getPageSize());
        verify(productRepository, never()).findAll();
        verify(productRepository, never()).findByCategoryId(any());
        verify(productRepository, never()).findByNameContainingIgnoreCase(any());
    }

    @Test
    void categoryFilterIncludesChildCategoriesByDefaultForStorefrontNavigation() {
        Product childCategoryProduct = product(16L, "Puppy Feeding Kit", 11L);
        ProductListQuery query = new ProductListQuery();
        query.setCategoryId(10L);
        query.setPage(0);
        query.setSize(24);
        when(categoryRepository.findByParentId(10L)).thenReturn(List.of(category(11L, "Puppy Feeding", 10L)));
        when(categoryRepository.findByParentId(11L)).thenReturn(List.of());
        when(categoryRepository.findAllById(List.of(childCategoryProduct.getCategoryId()))).thenReturn(List.of());
        stubPublicProductPage(List.of(childCategoryProduct));

        List<Product> results = service.findPublicProductPage(query).getContent();

        assertEquals(List.of(childCategoryProduct), results);
        verify(categoryRepository).findByParentId(10L);
        verify(categoryRepository).findByParentId(11L);
        verify(productRepository, never()).findAll();
    }

    @Test
    void categoryFilterCanOptOutOfChildCategoriesForExactCategoryMatching() {
        Product childCategoryProduct = product(17L, "Puppy Feeding Kit", 11L);
        ProductListQuery query = new ProductListQuery();
        query.setCategoryId(10L);
        query.setIncludeChildren(false);
        query.setPage(0);
        query.setSize(24);
        when(categoryRepository.findAllById(List.of(childCategoryProduct.getCategoryId()))).thenReturn(List.of());
        stubPublicProductPage(List.of(childCategoryProduct));

        Page<Product> page = service.findPublicProductPage(query);

        assertEquals(List.of(), page.getContent());
        assertEquals(1, page.getTotalElements());
        verify(categoryRepository, never()).findByParentId(10L);
        verify(productRepository, never()).findAll();
    }

    @Test
    void zeroPriceProductsAreExcludedFromPublicCatalogSurfaces() {
        Product zeroPriceProduct = product(18L, "Zero Price Test Product", 6L);
        zeroPriceProduct.setPrice(BigDecimal.ZERO);
        zeroPriceProduct.setStock(0);
        Product paidProduct = product(19L, "Paid Bowl", 6L);
        stubPublicProductPage(List.of(zeroPriceProduct, paidProduct));
        when(categoryRepository.findAllById(List.of(zeroPriceProduct.getCategoryId(), paidProduct.getCategoryId()))).thenReturn(List.of());
        when(productRepository.findById(zeroPriceProduct.getId())).thenReturn(java.util.Optional.of(zeroPriceProduct));
        when(productRepository.findAllById(List.of(zeroPriceProduct.getId(), paidProduct.getId()))).thenReturn(List.of(zeroPriceProduct, paidProduct));

        assertEquals(List.of(paidProduct), service.findPublicProductPage(new ProductListQuery()).getContent());
        assertTrue(service.findPublicById(zeroPriceProduct.getId()).isEmpty());
        assertEquals(List.of(paidProduct), service.findPublicByIds(List.of(zeroPriceProduct.getId(), paidProduct.getId())));
    }

    @Test
    void productListCacheKeySeparatesExactAndHierarchicalCategoryScope() {
        ProductListQuery exactQuery = new ProductListQuery();
        exactQuery.setCategoryId(10L);
        exactQuery.setIncludeChildren(false);
        ProductListQuery hierarchicalQuery = new ProductListQuery();
        hierarchicalQuery.setCategoryId(10L);
        hierarchicalQuery.setIncludeChildren(true);

        String exactKey = ReflectionTestUtils.invokeMethod(service, "productListCacheKey", exactQuery, null);
        String hierarchicalKey = ReflectionTestUtils.invokeMethod(service, "productListCacheKey", hierarchicalQuery, null);

        assertTrue(exactKey.contains(":includeChildren=false"));
        assertTrue(hierarchicalKey.contains(":includeChildren=true"));
    }

    private void stubPublicProductPage(List<Product> products) {
        when(productRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenAnswer(invocation -> {
                    Pageable pageable = invocation.getArgument(1);
                    return new PageImpl<>(products, pageable, products.size());
                });
    }

    private Pageable capturedPublicPageable() {
        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(productRepository).findAll(any(Specification.class), pageableCaptor.capture());
        return pageableCaptor.getValue();
    }

    @Test
    void searchUsesSingleCategoryLookupForCategoryText() {
        Product product = product(7L, "Everyday Bowl", 2L);
        Category root = category(1L, "Dogs", null);
        Category child = category(2L, "Feeding", 1L);

        stubPublicProductPage(List.of(product));
        when(categoryRepository.findIdsByKeyword(eq("dogs"), any(Pageable.class))).thenReturn(List.of(root.getId()));
        when(categoryRepository.findIdsByKeyword(eq("dog"), any(Pageable.class))).thenReturn(List.of());
        when(categoryRepository.findByParentId(root.getId())).thenReturn(List.of(child));
        when(categoryRepository.findByParentId(child.getId())).thenReturn(List.of());
        when(categoryRepository.findAllById(List.of(child.getId()))).thenReturn(List.of(child));
        when(categoryRepository.findAllById(List.of(root.getId()))).thenReturn(List.of(root));

        List<Product> results = service.search("dogs", null);

        assertEquals(List.of(product), results);
        verify(categoryRepository).findIdsByKeyword(eq("dogs"), any(Pageable.class));
        verify(categoryRepository).findAllById(List.of(child.getId()));
        verify(categoryRepository).findAllById(List.of(root.getId()));
        verify(categoryRepository, never()).findAll();
        verify(categoryRepository, never()).findById(1L);
        verify(categoryRepository, never()).findById(2L);
        verify(productRepository, never()).findAll();
    }

    @Test
    void searchEscapesLikeWildcardCharactersBeforeRepositoryLookup() {
        assertEquals("100!%!_!!promo", ReflectionTestUtils.invokeMethod(service, "escapeLikeTerm", "100%_!promo"));
        assertEquals("%100!%!_!!promo%", ReflectionTestUtils.invokeMethod(service, "containsLikePattern", "100%_!promo"));
    }

    @Test
    void keywordRepositoryQueriesUseExplicitLikeEscapeContract() throws IOException {
        String categoryRepositorySource = Files.readString(Path.of("src/main/java/com/example/shop/repository/CategoryRepository.java"));
        String productRepositorySource = Files.readString(Path.of("src/main/java/com/example/shop/repository/ProductRepository.java"));
        String productServiceSource = Files.readString(Path.of("src/main/java/com/example/shop/service/impl/ProductServiceImpl.java"));

        assertTrue(categoryRepositorySource.contains("like concat('%', :keyword, '%') escape '!'"));
        assertTrue(productRepositorySource.contains("like concat('%', :keyword, '%') escape '!'"));
        assertTrue(productRepositorySource.contains("p.price is not null and p.price > 0"));
        assertTrue(!productRepositorySource.contains("p.price is not null and p.price >= 0"));
        assertTrue(productServiceSource.contains("criteriaBuilder.greaterThan(root.get(\"price\"), BigDecimal.ZERO)"));
        assertTrue(!productServiceSource.contains("criteriaBuilder.greaterThanOrEqualTo(root.get(\"price\"), BigDecimal.ZERO)"));
        assertTrue(productServiceSource.contains("product.getPrice().compareTo(BigDecimal.ZERO) <= 0"));
    }

    @Test
    void emptySearchDoesNotLoadCategories() {
        Product product = product(8L, "Cat Bed", 3L);
        stubPublicProductPage(List.of(product));
        when(categoryRepository.findAllById(List.of(product.getCategoryId()))).thenReturn(List.of());

        List<Product> results = service.search("   ", null);

        assertEquals(List.of(product), results);
        verify(categoryRepository, never()).findIdsByKeyword(any(), any(Pageable.class));
        verify(categoryRepository, never()).findAll();
        verify(categoryRepository, never()).findById(org.mockito.ArgumentMatchers.anyLong());
        verify(productRepository, never()).findAll();
    }

    @Test
    void searchCacheSerializesConcurrentMissesForSameKey() throws Exception {
        Product product = product(10L, "Travel Harness", 4L);
        CountDownLatch loaderEntered = new CountDownLatch(1);
        CountDownLatch releaseLoader = new CountDownLatch(1);
        AtomicInteger loads = new AtomicInteger();
        when(runtimeConfig.getLong("product.search-cache-ttl-ms", 30000)).thenReturn(60000L);
        when(runtimeConfig.getInt("product.search-cache-max-entries", 80)).thenReturn(80);
        when(productRepository.findAll(any(Pageable.class))).thenAnswer(invocation -> {
            loads.incrementAndGet();
            loaderEntered.countDown();
            assertTrue(releaseLoader.await(2, TimeUnit.SECONDS));
            Pageable pageable = invocation.getArgument(0);
            return new PageImpl<>(List.of(product), pageable, 1);
        });

        ExecutorService executor = Executors.newFixedThreadPool(6);
        try {
            List<Future<List<Product>>> futures = new ArrayList<>();
            for (int i = 0; i < 6; i++) {
                futures.add(executor.submit(() -> service.findAll()));
            }
            assertTrue(loaderEntered.await(2, TimeUnit.SECONDS));
            releaseLoader.countDown();
            for (Future<List<Product>> future : futures) {
                assertEquals(List.of(product), future.get(2, TimeUnit.SECONDS));
            }
        } finally {
            executor.shutdownNow();
        }

        assertEquals(1, loads.get());
        verify(productRepository, never()).findAll();
    }

    @Test
    void searchCacheAvoidsStartupRedisHotKeyWarmupContract() throws IOException {
        String productServiceSource = Files.readString(
                Path.of("src/main/java/com/example/shop/service/impl/ProductServiceImpl.java"));

        assertFalse(Files.exists(Path.of("src/main/java/com/example/shop/service/impl/ProductSearchServiceImpl.java")));
        assertFalse(productServiceSource.contains("@PostConstruct"));
        assertFalse(productServiceSource.contains("searchHot"));
        assertFalse(productServiceSource.contains("trending:hot"));
        assertFalse(productServiceSource.contains("StringRedisTemplate"));
        assertFalse(productServiceSource.contains("ThreadLocal"));
        assertFalse(productServiceSource.contains("@Cacheable"));
        assertTrue(productServiceSource.contains("private final Object productSearchCacheLock = new Object();"));
        assertTrue(productServiceSource.contains("synchronized (productSearchCacheLock)"));
        assertTrue(productServiceSource.contains("runtimeConfig.getLong(\"product.search-cache-ttl-ms\", 30000)"));
    }

    @Test
    void productSaveInvalidatesMatchingSearchCacheEntriesWithoutFullClear() {
        Product cachedProduct = product(21L, "Cached Bowl", 3L);
        Product unrelatedFeatured = product(22L, "Featured Leash", 4L);
        unrelatedFeatured.setIsFeatured(true);
        when(runtimeConfig.getLong("product.search-cache-ttl-ms", 30000)).thenReturn(60000L);
        when(runtimeConfig.getInt("product.search-cache-max-entries", 80)).thenReturn(80);
        when(productRepository.findAll(any(Pageable.class))).thenAnswer(invocation ->
                new PageImpl<>(List.of(cachedProduct), invocation.getArgument(0), 1));
        when(productRepository.findPublicFeaturedProducts(any(Pageable.class))).thenReturn(List.of(unrelatedFeatured));
        when(productRepository.save(any(Product.class))).thenAnswer(invocation -> invocation.getArgument(0));

        service.findAll();
        service.findPublicFeaturedProducts(1);
        assertEquals(2, productSearchCache().size());

        service.save(cachedProduct);

        ConcurrentMap<String, ?> cache = productSearchCache();
        assertEquals(1, cache.size());
        assertTrue(cache.keySet().stream().anyMatch(key -> key.startsWith("featured:public:limit=")));
    }

    @Test
    void searchCacheCapacityEvictsSingleOldEntryInsteadOfClearingAllEntries() {
        Product allProduct = product(31L, "All Bowl", 3L);
        Product featuredProduct = product(32L, "Featured Bowl", 3L);
        featuredProduct.setIsFeatured(true);
        Product discountProduct = product(33L, "Discount Bowl", 3L);
        discountProduct.setDiscount(20);
        when(runtimeConfig.getLong("product.search-cache-ttl-ms", 30000)).thenReturn(60000L);
        when(runtimeConfig.getInt("product.search-cache-max-entries", 80)).thenReturn(2);
        when(productRepository.findAll(any(Pageable.class))).thenAnswer(invocation ->
                new PageImpl<>(List.of(allProduct), invocation.getArgument(0), 1));
        when(productRepository.findPublicFeaturedProducts(any(Pageable.class))).thenReturn(List.of(featuredProduct));
        stubPublicProductPage(List.of(discountProduct));

        service.findAll();
        service.findPublicFeaturedProducts(1);
        service.findDiscountProducts();

        assertEquals(2, productSearchCache().size());
    }

    @Test
    void legacyFindAllUsesBoundedPageableRepositoryCall() {
        Product product = product(13L, "Legacy List Bowl", 5L);
        when(runtimeConfig.getInt("product.legacy-list-max-rows", 500)).thenReturn(1200);
        when(productRepository.findAll(any(Pageable.class))).thenAnswer(invocation -> {
            Pageable pageable = invocation.getArgument(0);
            return new PageImpl<>(List.of(product), pageable, 1);
        });

        List<Product> results = service.findAll();

        assertEquals(List.of(product), results);
        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(productRepository).findAll(pageableCaptor.capture());
        assertEquals(0, pageableCaptor.getValue().getPageNumber());
        assertEquals(500, pageableCaptor.getValue().getPageSize());
        verify(productRepository, never()).findAll();
    }

    @Test
    void legacyPublicProductListUsesBoundedPagedPublicQuery() {
        Product product = product(14L, "Public Legacy Bowl", 6L);
        when(runtimeConfig.getInt("product.public-legacy-list-max-rows", 20)).thenReturn(500);
        stubPublicProductPage(List.of(product));
        when(categoryRepository.findAllById(List.of(product.getCategoryId()))).thenReturn(List.of());

        List<Product> results = service.findPublicProducts();

        assertEquals(List.of(product), results);
        Pageable pageable = capturedPublicPageable();
        assertEquals(0, pageable.getPageNumber());
        assertEquals(100, pageable.getPageSize());
        verify(productRepository, never()).findAll();
    }

    @Test
    void discountProductListUsesBoundedPagedPublicQuery() {
        Product product = product(15L, "Sale Bowl", 7L);
        product.setDiscount(20);
        when(runtimeConfig.getInt("product.discount-list-max-rows", 100)).thenReturn(500);
        stubPublicProductPage(List.of(product));
        when(categoryRepository.findAllById(List.of(product.getCategoryId()))).thenReturn(List.of());

        List<Product> results = service.findDiscountProducts();

        assertEquals(List.of(product), results);
        Pageable pageable = capturedPublicPageable();
        assertEquals(0, pageable.getPageNumber());
        assertEquals(100, pageable.getPageSize());
        verify(productRepository, never()).findAll();
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

    @SuppressWarnings("unchecked")
    private ConcurrentMap<String, ?> productSearchCache() {
        return (ConcurrentMap<String, ?>) ReflectionTestUtils.getField(service, "productSearchCache");
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
