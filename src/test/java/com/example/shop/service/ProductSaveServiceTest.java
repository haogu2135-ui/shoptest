package com.example.shop.service;

import com.example.shop.entity.Product;
import com.example.shop.repository.ProductRepository;
import com.example.shop.service.impl.ProductServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;

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
    void saveRejectsInvalidDetailContentBeforePersisting() {
        Product product = validProduct();
        product.setDetailContent("[{\"type\":\"image\",\"url\":\"ftp://example.com/image.jpg\"}]");

        assertThrows(IllegalArgumentException.class, () -> service.save(product));

        verify(productRepository, never()).save(any());
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
}
