package com.example.shop.config;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class NavbarGuestStockAlertContractTest {

    @Test
    void navbarDoesNotFetchStockAlertProductsForGuests() throws Exception {
        String source = Files.readString(Path.of("frontend/src/components/Navbar.tsx"), StandardCharsets.UTF_8);
        String refreshAlertCount = sliceBetween(source,
                "const refreshAlertCount = () => {",
                "const refreshGuestCartCount = () => {");

        int tokenGuardIndex = refreshAlertCount.indexOf("if (!token) {");
        int readAlertsIndex = refreshAlertCount.indexOf("const alerts = readStockAlerts();");
        int fetchProductsIndex = refreshAlertCount.indexOf("productApi.getByIds(productIds)");

        assertTrue(tokenGuardIndex >= 0, "Stock alert refresh should explicitly guard guest users");
        assertTrue(refreshAlertCount.contains("setAlertCount(0);"),
                "Guest stock alert refresh should clear stale badge counts");
        assertTrue(tokenGuardIndex < readAlertsIndex,
                "Guest guard should run before reading persisted stock alerts");
        assertTrue(tokenGuardIndex < fetchProductsIndex,
                "Guest guard should run before productApi.getByIds can be called");
        assertTrue(source.contains("queueIdleRefresh(refreshAlertCount, token ? 1900 : 900);"),
                "The idle refresh may still be scheduled, but refreshAlertCount must be safe for guests");
    }

    private static String sliceBetween(String source, String startMarker, String endMarker) {
        int start = source.indexOf(startMarker);
        assertTrue(start >= 0, "Missing start marker: " + startMarker);
        int end = source.indexOf(endMarker, start + startMarker.length());
        assertTrue(end > start, "Missing end marker after " + startMarker + ": " + endMarker);
        return source.substring(start, end);
    }
}
