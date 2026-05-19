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

    @Test
    void rejectsDuplicateVariantSku() {
        Product product = baseVariantProduct();
        product.setVariantsList(List.of(
                Map.of("sku", "DUP-SKU", "price", "18.00", "stock", 4, "options", Map.of("Size", "S", "Color", "Red")),
                Map.of("sku", "DUP-SKU", "price", "20.00", "stock", 3, "options", Map.of("Size", "M", "Color", "Blue"))
        ));

        assertThrows(
                IllegalArgumentException.class,
                () -> service.validateSelection(product, "{\"Size\":\"S\",\"Color\":\"Red\",\"_variantSku\":\"DUP-SKU\"}")
        );
    }

    @Test
    void rejectsVariantCatalogWithTooManyCombinations() {
        Product product = new Product();
        product.setName("Configurable Bed");
        product.setPrice(new BigDecimal("40.00"));
        product.setStock(12);
        product.setSpecificationsMap(Map.of(
                "options.Size", commaRange("S", 24),
                "options.Color", commaRange("Color", 24)
        ));

        assertThrows(
                IllegalArgumentException.class,
                () -> service.validateSelection(product, "{\"Size\":\"S1\",\"Color\":\"Color1\"}")
        );
    }

    @Test
    void rejectsUnknownSelectedOptionKey() {
        Product product = baseVariantProduct();

        assertThrows(
                IllegalArgumentException.class,
                () -> service.validateSelection(product, "{\"Size\":\"S\",\"Color\":\"Red\",\"Engraving\":\"Buddy\"}")
        );
    }

    private Product baseVariantProduct() {
        Product product = new Product();
        product.setName("Harness");
        product.setPrice(new BigDecimal("20.00"));
        product.setStock(10);
        product.setSpecificationsMap(Map.of(
                "options.Size", "S,M",
                "options.Color", "Red,Blue"
        ));
        return product;
    }

    private String commaRange(String prefix, int count) {
        StringBuilder builder = new StringBuilder();
        for (int index = 1; index <= count; index++) {
            if (index > 1) {
                builder.append(',');
            }
            builder.append(prefix).append(index);
        }
        return builder.toString();
    }
}
