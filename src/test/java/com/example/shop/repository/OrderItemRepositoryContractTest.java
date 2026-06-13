package com.example.shop.repository;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OrderItemRepositoryContractTest {

    @Test
    void orderItemRepositoryDoesNotExposeUnboundedFindAll() throws Exception {
        assertThrows(NoSuchMethodException.class, () -> OrderItemRepository.class.getMethod("findAll"));

        String mapper = Files.readString(
                Paths.get("src/main/resources/mapper/OrderItemMapper.xml"),
                StandardCharsets.UTF_8);
        assertFalse(mapper.contains("id=\"findAll\""),
                "OrderItemRepository must not expose a no-arg full-table findAll statement");
    }

    @Test
    void checkoutOrderItemsUseBatchInsertContract() throws Exception {
        assertDoesNotThrow(() -> OrderItemRepository.class.getMethod("insertBatch", List.class));

        String mapper = Files.readString(
                Paths.get("src/main/resources/mapper/OrderItemMapper.xml"),
                StandardCharsets.UTF_8);
        String orderService = Files.readString(
                Paths.get("src/main/java/com/example/shop/service/OrderService.java"),
                StandardCharsets.UTF_8);

        assertTrue(mapper.contains("<insert id=\"insertBatch\""), "OrderItem mapper should expose batch insert");
        assertTrue(mapper.contains("<foreach collection=\"items\""), "OrderItem batch insert should use MyBatis foreach");
        assertTrue(orderService.contains("orderItemRepository.insertBatch(orderItems)"),
                "checkout should persist order items in one batch call");
        assertFalse(orderService.contains("orderItemRepository.insert(orderItem)"),
                "checkout should not insert order items one-by-one");
    }
}
