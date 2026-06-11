package com.example.shop.config;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CartQuantityInputContractTest {

    @Test
    void cartQuantityInputFloorsUserEnteredNumbersBeforeDispatchingUpdate() throws Exception {
        String source = Files.readString(Path.of("frontend/src/pages/Cart.tsx"), StandardCharsets.UTF_8);
        String quantityInput = sliceBetween(source,
                "className=\"cart-page__quantityInput\"",
                "<Button\n          size=\"small\"\n          icon={<PlusOutlined />}");

        assertTrue(quantityInput.contains("Math.floor(Number(event.currentTarget.value) || 1)"),
                "Quantity input should floor decimal user input before calling updateQuantity");
        assertFalse(quantityInput.contains("updateQuantity(item, Number(event.currentTarget.value) || 1)"),
                "Quantity input must not dispatch fractional numbers to updateQuantity");
    }

    private static String sliceBetween(String source, String startMarker, String endMarker) {
        int start = source.indexOf(startMarker);
        assertTrue(start >= 0, "Missing start marker: " + startMarker);
        int end = source.indexOf(endMarker, start + startMarker.length());
        assertTrue(end > start, "Missing end marker after " + startMarker + ": " + endMarker);
        return source.substring(start, end);
    }
}
