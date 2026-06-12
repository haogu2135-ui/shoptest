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
        assertTrue(orderService.contains("@Transactional(rollbackFor = Exception.class)\n    public Order checkout(CheckoutRequest request)"),
                "authenticated checkout stock reservation should run inside a rollback-aware transaction");
        assertTrue(orderService.contains("@Transactional(rollbackFor = Exception.class)\n    public Order guestCheckout(GuestCheckoutRequest request)"),
                "guest checkout stock reservation should run inside a rollback-aware transaction");
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

        String memberCheckout = methodBlock(orderService,
                "private CheckoutItemsSelection prepareCheckoutItems(Long userId, List<Long> cartItemIds, boolean reserveStock)");
        String guestCheckout = methodBlock(orderService,
                "private CheckoutItemsSelection prepareGuestCheckoutItems(Long userId, List<GuestCheckoutItemRequest> items, boolean reserveStock)");
        String reserveProductStock = methodBlock(orderService,
                "private void reserveProductStock(Product product, String selectedSpecs, int quantity)");

        assertOccursBefore(
                memberCheckout,
                "if (availableStock == null || availableStock < item.getQuantity())",
                "reserveProductStock(product, item.getSelectedSpecs(), item.getQuantity())",
                "member checkout should reject insufficient locked stock before decrementing");
        assertOccursBefore(
                guestCheckout,
                "if (availableStock == null || availableStock < normalizedQuantity)",
                "reserveProductStock(product, normalizedSpecs, normalizedQuantity)",
                "guest checkout should reject insufficient locked stock before decrementing");
        assertFalse(reserveProductStock.contains("productRepository.save("),
                "stock deduction helper should mutate only the already-locked entity");
        assertTrue(orderService.contains("saveReservedProducts(reservedProducts);"),
                "touched products should be saved after checkout line validation, not by an unlocked per-line helper");
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

    private static void assertOccursBefore(String source, String first, String second, String message) {
        int firstIndex = source.indexOf(first);
        int secondIndex = source.indexOf(second);
        assertTrue(firstIndex >= 0, "Missing first source marker: " + first);
        assertTrue(secondIndex >= 0, "Missing second source marker: " + second);
        assertTrue(firstIndex < secondIndex, message);
    }
}
