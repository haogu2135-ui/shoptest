package com.example.shop.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;

class CheckoutStockDistinctProductSaveContractTest {
    @Test
    void checkoutStockReservationPersistsOnlyVariantTouchedProductsAfterLineValidation() throws IOException {
        String orderService = read("src/main/java/com/example/shop/service/OrderService.java");

        assertFalse(orderService.contains("updateProductStock"),
                "Do not reintroduce the stale per-item updateProductStock checkout path");
        assertFalse(orderService.contains("ProductMapper.updateStock"),
                "Do not reintroduce the stale ProductMapper.updateStock checkout path");

        String memberCheckout = methodBlock(orderService,
                "private CheckoutItemsSelection prepareCheckoutItems(Long userId, List<Long> cartItemIds, boolean reserveStock)");
        String guestCheckout = methodBlock(orderService,
                "private CheckoutItemsSelection prepareGuestCheckoutItems(Long userId, List<GuestCheckoutItemRequest> items, boolean reserveStock)");
        String reserveProductStock = methodBlock(orderService,
                "private boolean reserveProductStock(Product product, String selectedSpecs, int quantity)");
        String detachSimpleStockReservation = methodBlock(orderService,
                "private void detachSimpleStockReservation(Product product)");
        String saveReservedProducts = methodBlock(orderService,
                "private void saveReservedProducts(Map<Long, Product> reservedProducts)");

        assertTrue(memberCheckout.contains("if (reserveProductStock(product, item.getSelectedSpecs(), item.getQuantity()))"),
                "Member checkout should track only products with variant JSON changes for persistence");
        assertTrue(memberCheckout.contains("reservedProducts.put(product.getId(), product);"),
                "Member checkout should de-duplicate variant-touched products before persistence");
        assertTrue(memberCheckout.contains("saveReservedProducts(reservedProducts);"),
                "Member checkout should persist variant-touched products after item validation");
        assertFalse(memberCheckout.contains("productRepository.save(product);"),
                "Member checkout must not save inside the per-item validation loop");

        assertTrue(guestCheckout.contains("if (reserveProductStock(product, normalizedSpecs, normalizedQuantity))"),
                "Guest checkout should track only products with variant JSON changes for persistence");
        assertTrue(guestCheckout.contains("reservedProducts.put(product.getId(), product);"),
                "Guest checkout should de-duplicate variant-touched products before persistence");
        assertTrue(guestCheckout.contains("saveReservedProducts(reservedProducts);"),
                "Guest checkout should persist variant-touched products after item validation");
        assertFalse(guestCheckout.contains("productRepository.save(product);"),
                "Guest checkout must not save inside the per-item validation loop");

        assertFalse(reserveProductStock.contains("productRepository.save("),
                "reserveProductStock should not save inside the per-line helper");
        assertTrue(reserveProductStock.contains("productRepository.decreaseStock(product.getId(), quantity)"),
                "reserveProductStock should atomically decrement simple stock");
        assertTrue(reserveProductStock.contains("if (reservedScalarStock && !reservedVariantStock)"),
                "simple-stock-only reservations should not leave a managed dirty Product to flush");
        assertTrue(reserveProductStock.contains("detachSimpleStockReservation(product);"),
                "simple-stock-only reservations should detach the in-memory stock snapshot");
        assertTrue(reserveProductStock.contains("return reservedVariantStock;"),
                "reserveProductStock should tell callers whether variant JSON needs persistence");
        assertTrue(detachSimpleStockReservation.contains("entityManager.detach(product);"));
        assertTrue(saveReservedProducts.contains("reservedProducts.values()"));
        assertTrue(saveReservedProducts.contains("productRepository.save(product);"));
    }

    private static String read(String path) throws IOException {
        return Files.readString(Path.of(path), StandardCharsets.UTF_8);
    }

    private static String methodBlock(String source, String signature) {
        int start = source.indexOf(signature);
        assertTrue(start >= 0, "Missing method signature: " + signature);
        int openBrace = source.indexOf('{', start);
        assertTrue(openBrace >= 0, "Missing method body: " + signature);
        int depth = 0;
        for (int index = openBrace; index < source.length(); index++) {
            char ch = source.charAt(index);
            if (ch == '{') {
                depth++;
            } else if (ch == '}') {
                depth--;
                if (depth == 0) {
                    return source.substring(start, index + 1);
                }
            }
        }
        throw new AssertionError("Unterminated method body: " + signature);
    }
}
