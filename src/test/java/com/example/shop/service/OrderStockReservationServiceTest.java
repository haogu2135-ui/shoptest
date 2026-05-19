package com.example.shop.service;

import com.example.shop.entity.OrderItem;
import com.example.shop.entity.Product;
import com.example.shop.repository.ProductRepository;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OrderStockReservationServiceTest {
    private final ProductVariantService productVariantService = new ProductVariantService();

    @Test
    void reservesVariantOnlyStockWithoutRequiringProductStock() {
        ProductRepository productRepository = mock(ProductRepository.class);
        OrderService service = serviceWith(productRepository);
        Product product = variantOnlyProduct(5);

        ReflectionTestUtils.invokeMethod(service, "reserveProductStock", product, "{\"Size\":\"S\",\"Color\":\"Red\",\"_variantSku\":\"SKU-S-RED\"}", 2);

        assertNull(product.getStock());
        assertEquals(3, product.getVariantsList().get(0).get("stock"));
        verify(productRepository).save(product);
    }

    @Test
    void restoresVariantOnlyStockWithoutCreatingProductStock() {
        ProductRepository productRepository = mock(ProductRepository.class);
        OrderService service = serviceWith(productRepository);
        Product product = variantOnlyProduct(3);
        when(productRepository.findById(7L)).thenReturn(Optional.of(product));

        OrderItem item = new OrderItem();
        item.setProductId(7L);
        item.setQuantity(2);
        item.setSelectedSpecs("{\"Size\":\"S\",\"Color\":\"Red\",\"_variantSku\":\"SKU-S-RED\"}");

        ReflectionTestUtils.invokeMethod(service, "restoreStock", item);

        assertNull(product.getStock());
        assertEquals(5, product.getVariantsList().get(0).get("stock"));
        verify(productRepository).save(product);
    }

    private OrderService serviceWith(ProductRepository productRepository) {
        OrderService service = new OrderService();
        ReflectionTestUtils.setField(service, "productRepository", productRepository);
        ReflectionTestUtils.setField(service, "productVariantService", productVariantService);
        return service;
    }

    private Product variantOnlyProduct(int variantStock) {
        Product product = new Product();
        product.setId(7L);
        product.setName("Harness");
        product.setPrice(new BigDecimal("20.00"));
        product.setStock(null);
        product.setSpecificationsMap(Map.of(
                "options.Size", "S,M",
                "options.Color", "Red,Blue"
        ));
        product.setVariantsList(List.of(
                Map.of("sku", "SKU-S-RED", "price", "18.00", "stock", variantStock, "options", Map.of("Size", "S", "Color", "Red"))
        ));
        return product;
    }
}
