package com.example.shop.config;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CartGuestRemovalEventContractTest {

    @Test
    void guestCartRemovalPathsDispatchCartUpdatedEvent() throws Exception {
        String source = Files.readString(Path.of("frontend/src/pages/Cart.tsx"), StandardCharsets.UTF_8);

        assertGuestRemovalDispatchesCartUpdated(sliceBetween(source,
                "const removeItem = async (itemId: number) => {",
                "const saveForLater = async (item: CartItem) => {"),
                "removeGuestCartItem(itemId)");
        assertGuestRemovalDispatchesCartUpdated(sliceBetween(source,
                "const saveForLater = async (item: CartItem) => {",
                "const moveSavedItemToCart = async (item: SavedForLaterItem) => {"),
                "removeGuestCartItem(item.id)");
        assertGuestRemovalDispatchesCartUpdated(sliceBetween(source,
                "const removeItems = async (itemIds: number[], successMessage: string) => {",
                "const cartCheckoutMetrics = useMemo"),
                "removeGuestCartItems(normalizedIds)");
    }

    private static void assertGuestRemovalDispatchesCartUpdated(String block, String guestRemovalCall) {
        assertTrue(block.contains(guestRemovalCall),
                "Expected guest removal call in cart mutation block: " + guestRemovalCall);
        assertTrue(block.contains("dispatchDomEvent('shop:cart-updated');"),
                "Guest cart removal must notify Navbar/cart listeners after mutation");
        assertFalse(block.contains("if (authenticated) dispatchDomEvent('shop:cart-updated');"),
                "Cart-updated event must not be limited to authenticated carts for removal paths");
    }

    private static String sliceBetween(String source, String startMarker, String endMarker) {
        int start = source.indexOf(startMarker);
        assertTrue(start >= 0, "Missing start marker: " + startMarker);
        int end = source.indexOf(endMarker, start + startMarker.length());
        assertTrue(end > start, "Missing end marker after " + startMarker + ": " + endMarker);
        return source.substring(start, end);
    }
}
