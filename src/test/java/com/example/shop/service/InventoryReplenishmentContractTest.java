package com.example.shop.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;

class InventoryReplenishmentContractTest {

    @Test
    void productionSourceDoesNotContainStaleInventoryReplenishPath() throws IOException {
        List<String> offenders = new ArrayList<>();
        try (Stream<Path> paths = Files.walk(Path.of("src/main/java"))) {
            paths.filter(Files::isRegularFile)
                    .filter(path -> path.getFileName().toString().endsWith(".java"))
                    .forEach(path -> collectStaleInventoryMarkers(path, offenders));
        }

        assertFalse(Files.exists(Path.of("src/main/java/com/example/shop/service/InventoryService.java")),
                "The stale InventoryService target should not return without batched replenishment coverage");
        assertFalse(Files.exists(Path.of("src/main/java/com/example/shop/service/impl/InventoryServiceImpl.java")),
                "The stale InventoryServiceImpl target should not return without batched replenishment coverage");
        assertTrue(offenders.isEmpty(), () -> "Stale per-product replenishment markers found:\n"
                + String.join("\n", offenders));
    }

    @Test
    void currentStockRestorationGroupsSimpleProductUpdates() throws IOException {
        String orderService = read("src/main/java/com/example/shop/service/OrderService.java");
        String productRepository = read("src/main/java/com/example/shop/repository/ProductRepository.java");

        assertTrue(orderService.contains("private void restoreStock(List<OrderItem> items)"));
        assertTrue(orderService.contains("Map<Long, List<OrderItem>> simpleItemsByProductId = new LinkedHashMap<>()"));
        assertTrue(orderService.contains("target.computeIfAbsent(item.getProductId(), ignored -> new ArrayList<>()).add(item)"));
        assertTrue(orderService.contains("restoreSimpleProductStock(simpleItemsByProductId)"));
        assertTrue(orderService.contains("int updated = productRepository.increaseStock(entry.getKey(), totalQuantity)"),
                "Simple stock restoration should update once per product with the aggregated quantity");
        assertFalse(orderService.contains("for (OrderItem item : items) {\n            restoreStock(item);\n        }"),
                "Do not restore order stock through a per-item helper loop");
        assertTrue(productRepository.contains("int increaseStock(@Param(\"productId\") Long productId, @Param(\"quantity\") Integer quantity);"));
        assertTrue(productRepository.contains("update products set stock = coalesce(stock, 0) + :quantity"),
                "Simple stock increments should be handled by one database UPDATE statement");
    }

    @Test
    void currentVariantStockRestorationLocksAndSavesOncePerProduct() throws IOException {
        String orderService = read("src/main/java/com/example/shop/service/OrderService.java");
        String variantRestore = methodBlock(orderService,
                "private void restoreVariantProductStock(Map<Long, List<OrderItem>> itemsByProductId)");

        assertTrue(variantRestore.contains("for (Map.Entry<Long, List<OrderItem>> entry : itemsByProductId.entrySet())"));
        assertTrue(variantRestore.contains("Product product = findProductForStockRestoration(entry.getKey())"));
        assertTrue(variantRestore.contains("for (OrderItem item : entry.getValue())"));
        assertTrue(variantRestore.contains("productRepository.save(product);"));
        assertTrue(variantRestore.indexOf("Product product = findProductForStockRestoration(entry.getKey())")
                        < variantRestore.indexOf("for (OrderItem item : entry.getValue())"),
                "Variant stock restoration should lock the product once before applying grouped item quantities");
        assertTrue(variantRestore.lastIndexOf("productRepository.save(product)")
                        > variantRestore.indexOf("for (OrderItem item : entry.getValue())"),
                "Variant stock restoration should save once after applying grouped item quantities");
    }

    private static void collectStaleInventoryMarkers(Path path, List<String> offenders) {
        String source;
        try {
            source = Files.readString(path, StandardCharsets.UTF_8);
        } catch (IOException ex) {
            throw new IllegalStateException("Unable to read production source " + path, ex);
        }

        String[] lines = source.split("\\R", -1);
        for (int index = 0; index < lines.length; index++) {
            String line = lines[index];
            if (line.contains("replenishStock(")
                    || line.contains("class InventoryService")
                    || line.contains("updateProductStock(")) {
                offenders.add(path + ":" + (index + 1) + ": " + line.trim());
            }
        }
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
