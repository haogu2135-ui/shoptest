package com.example.shop.service;

import com.example.shop.entity.Product;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ProductVariantServiceTest {
    private final ProductVariantService service = new ProductVariantService();

    @Test
    void rejectsSkuWhenSelectedOptionsDoNotMatchVariant() {
        Product product = new Product();
        product.setName("Harness");
        product.setPrice(new BigDecimal("20.00"));
        product.setStock(10);
        product.setSpecificationsMap(Map.of(
                "options.Size", "S,M",
                "options.Color", "Red,Blue"
        ));
        product.setVariantsList(List.of(
                Map.of("sku", "SKU-S-RED", "price", "18.00", "stock", 4, "options", Map.of("Size", "S", "Color", "Red")),
                Map.of("sku", "SKU-M-BLUE", "price", "22.00", "stock", 6, "options", Map.of("Size", "M", "Color", "Blue"))
        ));

        String mismatchedSpecs = "{\"_variantSku\":\"SKU-S-RED\",\"Size\":\"M\",\"Color\":\"Blue\"}";

        assertTrue(service.findSelectedVariant(product, mismatchedSpecs).isEmpty());
        assertThrows(IllegalArgumentException.class, () -> service.validateSelection(product, mismatchedSpecs));
    }

    @Test
    void rejectsUnavailablePurchaseModeMetadata() {
        Product product = new Product();
        product.setName("Treats");
        product.setPrice(new BigDecimal("12.00"));
        product.setStock(8);

        assertThrows(
                IllegalArgumentException.class,
                () -> service.validateSelection(product, "{\"_purchaseMode\":\"subscribe\"}")
        );
    }
}
