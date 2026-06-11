package com.example.shop.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;

class OrderItemListNPlusOneContractTest {
    @Test
    void customerOrderListDoesNotLoadOrderItemsOneOrderAtATime() throws IOException {
        String orderService = read("src/main/java/com/example/shop/service/OrderService.java");
        String orderItemRepository = read("src/main/java/com/example/shop/repository/OrderItemRepository.java");
        String orderItemMapper = read("src/main/resources/mapper/OrderItemMapper.xml");

        assertFalse(orderService.contains("getOrdersByUserIdWithItems"),
                "Do not reintroduce the stale order-list-with-items N+1 method");
        assertFalse(orderService.contains("OrderServiceImpl"),
                "Current source should not depend on the stale OrderServiceImpl implementation path");

        String customerListMethods = methodBlock(orderService, "public List<Order> getOrdersByUserId(Long userId, int page, int size)");
        assertTrue(customerListMethods.contains("orderRepository.findByUserIdPage"),
                "Customer order lists should use the paged order query");
        assertFalse(customerListMethods.contains("orderItemRepository.findByOrderId"),
                "Customer order lists must not query order items once per order");
        assertFalse(customerListMethods.contains("orderItemService.getOrderItemsByOrderId"),
                "Customer order lists must not query order items once per order through the service layer");

        assertTrue(orderItemRepository.contains("List<OrderItem> findByOrderIds"),
                "Bulk order-item reads must remain available for list/export flows that need item details");
        assertTrue(orderItemMapper.contains("<select id=\"findByOrderIds\""),
                "MyBatis mapper must keep the bulk order-item query");
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
