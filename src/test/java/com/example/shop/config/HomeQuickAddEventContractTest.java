package com.example.shop.config;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class HomeQuickAddEventContractTest {

    @Test
    void homeQuickAddDoesNotUseFakeMouseEvents() throws Exception {
        String source = Files.readString(Path.of("frontend/src/pages/Home.tsx"), StandardCharsets.UTF_8);
        String quickAdd = sliceBetween(source,
                "const handleQuickAddToCart = async",
                "const handleQuickWishlist = async");

        assertTrue(quickAdd.contains("event: React.MouseEvent | undefined"),
                "Quick-add handler should accept missing events from non-event callers");
        assertTrue(quickAdd.contains("event?.stopPropagation();"),
                "Quick-add should only stop propagation when a real event exists");
        assertTrue(source.contains("handleQuickAddToCart(undefined, heroFeaturedProduct)"),
                "Hero quick-add should call without fabricating a MouseEvent");
        assertTrue(source.contains("handleQuickAddToCart(undefined, bestSellers[0])"),
                "Editorial quick-add should call without fabricating a MouseEvent");
        assertFalse(source.contains("{ stopPropagation() {} } as React.MouseEvent"),
                "Home quick-add must not cast incomplete object literals to React.MouseEvent");
    }

    private static String sliceBetween(String source, String startMarker, String endMarker) {
        int start = source.indexOf(startMarker);
        assertTrue(start >= 0, "Missing start marker: " + startMarker);
        int end = source.indexOf(endMarker, start + startMarker.length());
        assertTrue(end > start, "Missing end marker after " + startMarker + ": " + endMarker);
        return source.substring(start, end);
    }
}
