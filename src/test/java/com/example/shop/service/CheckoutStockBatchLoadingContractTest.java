package com.example.shop.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;

class CheckoutStockBatchLoadingContractTest {
    @Test
    void checkoutStockValidationUsesBulkProductLoadsInsteadOfPerItemQueries() throws IOException {
        String orderService = read("src/main/java/com/example/shop/service/OrderService.java");
        String productRepository = read("src/main/java/com/example/shop/repository/ProductRepository.java");

        String memberCheckout = methodBlock(orderService,
                "private CheckoutItemsSelection prepareCheckoutItems(Long userId, List<Long> cartItemIds, boolean reserveStock)");
        String guestCheckout = methodBlock(orderService,
                "private CheckoutItemsSelection prepareGuestCheckoutItems(Long userId, List<GuestCheckoutItemRequest> items, boolean reserveStock)");
        String productLoader = methodBlock(orderService,
                "private Map<Long, Product> loadProductsForCartItems(List<CartItem> items, boolean forUpdate)");

        assertTrue(memberCheckout.contains("loadProductsForCartItems(selectedItems, reserveStock)"),
                "Member checkout must bulk-load all selected products before stock validation");
        assertFalse(memberCheckout.contains("productRepository.findById("),
                "Member checkout stock validation must not query product rows one item at a time");
        assertFalse(memberCheckout.contains("getProductDetailById"),
                "Member checkout must not use product-detail lookups for stock validation");

        assertTrue(guestCheckout.contains(".distinct()"),
                "Guest checkout must de-duplicate product ids before loading stock rows");
        assertTrue(guestCheckout.contains("productRepository.findAllByIdForUpdate(productIds)"),
                "Guest checkout reservations must use one bulk pessimistic-lock query");
        assertFalse(guestCheckout.contains("productRepository.findById("),
                "Guest checkout stock validation must not query product rows one item at a time");
        assertFalse(guestCheckout.contains("getProductDetailById"),
                "Guest checkout must not use product-detail lookups for stock validation");

        assertTrue(productLoader.contains(".distinct()"),
                "Shared checkout product loader must de-duplicate product ids");
        assertTrue(productLoader.contains("productRepository.findAllByIdForUpdate(productIds)"),
                "Shared checkout product loader must support bulk pessimistic locking");
        assertTrue(productRepository.contains("LockModeType.PESSIMISTIC_WRITE"));
        assertTrue(productRepository.contains("List<Product> findAllByIdForUpdate"));
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
