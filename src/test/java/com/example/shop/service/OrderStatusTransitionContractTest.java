package com.example.shop.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;

class OrderStatusTransitionContractTest {

    @Test
    void orderStatusTransitionRulesArePrecomputedOutsideTheHotPath() throws IOException {
        String source = Files.readString(
                Path.of("src/main/java/com/example/shop/service/OrderService.java"),
                StandardCharsets.UTF_8);
        String assertNextStatus = methodBlock(source, "public void assertNextStatus(String currentStatus, String nextStatus)");

        assertTrue(source.contains("private static final Map<String, String> ORDER_STATUS_NEXT_STEP = Map.of("));
        assertTrue(source.contains(
                "private static final Set<String> ORDER_STATUS_REFUNDABLE_STEPS = Set.of("));
        assertFalse(assertNextStatus.contains("Map.of("));
        assertFalse(assertNextStatus.contains("Set.of("));
        assertFalse(assertNextStatus.contains("new HashMap"));
        assertTrue(assertNextStatus.contains("ORDER_STATUS_NEXT_STEP.get(currentStatus)"));
        assertTrue(assertNextStatus.contains("ORDER_STATUS_REFUNDABLE_STEPS.contains(currentStatus)"));
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
