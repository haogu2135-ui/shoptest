package com.example.shop.service;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OrderStockReservationRaceContractTest {
    private static final Path MAIN_SOURCE_ROOT = Path.of("src/main/java/com/example/shop");
    private static final Path ORDER_SERVICE = Path.of("src/main/java/com/example/shop/service/OrderService.java");
    private static final Path PRODUCT_REPOSITORY = Path.of("src/main/java/com/example/shop/repository/ProductRepository.java");

    @Test
    void checkoutStockReservationUsesLockedProductRowsInsteadOfCheckThenDeductService() throws IOException {
        String productionSource = readAllJavaSource();
        String orderService = Files.readString(ORDER_SERVICE);
        String productRepository = Files.readString(PRODUCT_REPOSITORY);

        assertFalse(productionSource.contains("class InventoryService"),
                "legacy check-then-deduct InventoryService should not be active production code");
        assertFalse(productionSource.contains("checkAndDeductStock"),
                "legacy stock check/deduct method should not be active production code");
        assertTrue(orderService.contains("prepareCheckoutItems(request.getUserId(), request.getCartItemIds(), true)"),
                "authenticated checkout should enter the stock-reserving path");
        assertTrue(orderService.contains("prepareGuestCheckoutItems(guestUserId, request.getItems(), true)"),
                "guest checkout should enter the stock-reserving path");
        assertTrue(orderService.contains("loadProductsForCartItems(selectedItems, reserveStock)"),
                "cart checkout reservation should load products through the reserve-aware loader");
        assertTrue(orderService.contains("productRepository.findAllByIdForUpdate(productIds)"),
                "reserve-aware checkout loaders should lock product rows before stock checks");
        assertTrue(orderService.contains("reserveProductStock(product, item.getSelectedSpecs(), item.getQuantity())"),
                "authenticated checkout should reserve stock only after locked product loading");
        assertTrue(orderService.contains("reserveProductStock(product, normalizedSpecs, normalizedQuantity)"),
                "guest checkout should reserve stock only after locked product loading");
        assertTrue(orderService.contains("product.setStock(product.getStock() - quantity);"),
                "locked product stock should be decremented in the checkout transaction");
        assertTrue(productRepository.contains("@Lock(LockModeType.PESSIMISTIC_WRITE)"),
                "product repository should declare pessimistic row locking for checkout reservations");
        assertTrue(productRepository.contains("List<Product> findAllByIdForUpdate(@Param(\"ids\") List<Long> ids)"),
                "checkout reservation should use a dedicated locked product lookup");
    }

    private String readAllJavaSource() throws IOException {
        StringBuilder builder = new StringBuilder();
        try (var paths = Files.walk(MAIN_SOURCE_ROOT)) {
            paths.filter(path -> path.toString().endsWith(".java"))
                    .sorted()
                    .forEach(path -> {
                        try {
                            builder.append(Files.readString(path)).append('\n');
                        } catch (IOException e) {
                            throw new IllegalStateException("Failed to read " + path, e);
                        }
                    });
        }
        return builder.toString();
    }
}
