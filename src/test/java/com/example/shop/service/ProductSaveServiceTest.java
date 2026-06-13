package com.example.shop.service;

import com.example.shop.entity.Product;
import com.example.shop.repository.ProductRepository;
import com.example.shop.service.impl.ProductServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ProductSaveServiceTest {
    private ProductRepository productRepository;
    private ProductServiceImpl service;

    @BeforeEach
    void setUp() {
        productRepository = mock(ProductRepository.class);
        service = new ProductServiceImpl();
        ReflectionTestUtils.setField(service, "productRepository", productRepository);
        when(productRepository.save(any(Product.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void saveNormalizesDirectProductBeforePersisting() {
        Product product = validProduct();
        product.setName("  Everyday\tBowl  ");
        product.setDescription("  Food\nsafe\u0000 ceramic  ");
        product.setBrand("  ShopMX  ");
        product.setStatus("active");

        service.save(product);

        ArgumentCaptor<Product> captor = ArgumentCaptor.forClass(Product.class);
        verify(productRepository).save(captor.capture());
        assertEquals("Everyday Bowl", captor.getValue().getName());
        assertEquals("Food safe ceramic", captor.getValue().getDescription());
        assertEquals("ShopMX", captor.getValue().getBrand());
        assertEquals("ACTIVE", captor.getValue().getStatus());
    }

    @Test
    void mergeProductAppliesSharedUpdateFieldsAndNormalizesStatus() {
        Product existing = validProduct();
        existing.setName("Original Bowl");
        existing.setDescription("Original");
        existing.setStatus("INACTIVE");
        existing.setStock(4);
        existing.setBestSellerRank(12);
        Product update = new Product();
        update.setName("Updated Bowl");
        update.setDescription("Updated");
        update.setStatus(" active ");
        update.setBestSellerRank(2);

        Product merged = service.mergeProduct(existing, update);

        assertEquals(existing, merged);
        assertEquals("Updated Bowl", merged.getName());
        assertEquals("Updated", merged.getDescription());
        assertEquals("ACTIVE", merged.getStatus());
        assertEquals(4, merged.getStock());
        assertEquals(2, merged.getBestSellerRank());
    }

    @Test
    void mergeProductRejectsInvalidStatusBeforePersisting() {
        Product existing = validProduct();
        Product update = new Product();
        update.setStatus("ARCHIVED");

        assertThrows(IllegalArgumentException.class, () -> service.mergeProduct(existing, update));

        verify(productRepository, never()).save(any());
    }

    @Test
    void saveRejectsNegativeStockBeforePersisting() {
        Product product = validProduct();
        product.setStock(-1);

        assertThrows(IllegalArgumentException.class, () -> service.save(product));

        verify(productRepository, never()).save(any());
    }

    @Test
    void saveRejectsInvalidMoneyBeforePersisting() {
        Product product = validProduct();
        product.setPrice(new BigDecimal("19.999"));

        assertThrows(IllegalArgumentException.class, () -> service.save(product));

        verify(productRepository, never()).save(any());
    }

    @Test
    void saveRejectsUnsafeImageUrlBeforePersisting() {
        Product product = validProduct();
        product.setImageUrl("http://127.0.0.1/image.jpg");

        assertThrows(IllegalArgumentException.class, () -> service.save(product));

        verify(productRepository, never()).save(any());
    }

    @Test
    void saveRejectsImageUrlsPastBackendEntityLimitBeforePersisting() {
        Product product = validProduct();
        product.setImageUrl(imageUrlWithLength(2001));

        assertThrows(IllegalArgumentException.class, () -> service.save(product));

        verify(productRepository, never()).save(any());
    }

    @Test
    void saveRejectsNonUploadRootRelativeImageUrlBeforePersisting() {
        Product product = validProduct();
        product.setImageUrl("/assets/products/bowl.jpg");

        assertThrows(IllegalArgumentException.class, () -> service.save(product));

        verify(productRepository, never()).save(any());
    }

    @Test
    void saveNormalizesLegacyUploadedProductImageUrlsBeforePersisting() {
        Product product = validProduct();
        product.setImageUrl("uploads/products/bowl.jpg");
        product.setImages("[\"uploads/products/alt.jpg\",\"/uploads/products/extra.jpg\"]");
        product.setDetailContent("[{\"type\":\"image\",\"url\":\"uploads/products/detail.jpg\"},{\"type\":\"text\",\"content\":\"Specs\"}]");
        product.setVariants("[{\"sku\":\"BOWL-S\",\"options\":{\"Size\":\"S\"},\"price\":19.99,\"stock\":2,\"imageUrl\":\"uploads/products/variant.jpg\"}]");

        service.save(product);

        ArgumentCaptor<Product> captor = ArgumentCaptor.forClass(Product.class);
        verify(productRepository).save(captor.capture());
        Product saved = captor.getValue();
        assertEquals("/uploads/products/bowl.jpg", saved.getImageUrl());
        assertEquals("[\"/uploads/products/alt.jpg\",\"/uploads/products/extra.jpg\"]", saved.getImages());
        assertEquals("[{\"type\":\"image\",\"url\":\"/uploads/products/detail.jpg\"},{\"type\":\"text\",\"content\":\"Specs\"}]", saved.getDetailContent());
        assertEquals("[{\"sku\":\"BOWL-S\",\"options\":{\"Size\":\"S\"},\"price\":19.99,\"stock\":2,\"imageUrl\":\"/uploads/products/variant.jpg\"}]", saved.getVariants());
    }

    @Test
    void saveRejectsInvalidDetailContentBeforePersisting() {
        Product product = validProduct();
        product.setDetailContent("[{\"type\":\"image\",\"url\":\"ftp://example.com/image.jpg\"}]");

        assertThrows(IllegalArgumentException.class, () -> service.save(product));

        verify(productRepository, never()).save(any());
    }

    @Test
    void updateStatusByIdsUsesSingleBulkRepositoryUpdate() {
        when(productRepository.updateStatusByIdIn(List.of(7L, 8L), "INACTIVE")).thenReturn(2);

        assertEquals(2, service.updateStatusByIds(Arrays.asList(7L, 7L, null, -3L, 8L), " inactive "));

        verify(productRepository).updateStatusByIdIn(List.of(7L, 8L), "INACTIVE");
        verify(productRepository, never()).findById(any());
        verify(productRepository, never()).save(any());
    }

    @Test
    void updateStatusByIdsRejectsInvalidStatusBeforeRepositoryCall() {
        assertThrows(IllegalArgumentException.class, () -> service.updateStatusByIds(List.of(7L), "ARCHIVED"));

        verify(productRepository, never()).updateStatusByIdIn(any(), any());
    }

    private Product validProduct() {
        Product product = new Product();
        product.setName("Everyday Bowl");
        product.setPrice(new BigDecimal("19.99"));
        product.setStock(8);
        product.setCategoryId(1L);
        product.setImageUrl("https://cdn.example.com/bowl.jpg");
        product.setStatus("ACTIVE");
        return product;
    }

    private String imageUrlWithLength(int length) {
        String prefix = "https://cdn.example.com/products/";
        return prefix + "a".repeat(length - prefix.length());
    }
}
