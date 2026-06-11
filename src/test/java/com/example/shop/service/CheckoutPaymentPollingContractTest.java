package com.example.shop.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

class CheckoutPaymentPollingContractTest {

    @Test
    void checkoutPaymentRefreshTimeoutIsDisposedBeforeSettingState() throws IOException {
        String source = checkoutSource();
        String refreshEffect = sliceBetween(source,
                "if (!createdOrderId || payment || !pendingPaymentMethod) return",
                "if (!createdOrderId || paymentStatus !== 'PENDING') return");

        assertTrue(refreshEffect.contains("let disposed = false;"));
        assertTrue(refreshEffect.contains("const timer = window.setTimeout(async () => {"));
        assertTrue(refreshEffect.contains("if (!disposed) {"));
        assertTrue(refreshEffect.contains("setPayment(paymentRes.data);"));
        assertTrue(refreshEffect.contains("disposed = true;"));
        assertTrue(refreshEffect.contains("window.clearTimeout(timer);"));
        assertFalse(refreshEffect.contains("window.location"));
    }

    @Test
    void checkoutPaymentPollIntervalGuardsQueuedCallbacksAndAsyncResults() throws IOException {
        String source = checkoutSource();
        String pollingEffect = sliceBetween(source,
                "if (!createdOrderId || paymentStatus !== 'PENDING') return",
                checkoutPostPollingMarker(source));

        assertTrue(pollingEffect.contains("const applySharedPollResult = (result: CheckoutPaymentPollResult | null) => {"));
        assertTrue(pollingEffect.contains(
                "if (disposed || !result || result.ownerId === ownerId || result.orderId !== createdOrderId) return false;"));
        assertTrue(pollingEffect.contains("const timer = window.setInterval(async () => {"));
        assertTrue(pollingEffect.contains("if (disposed || polling) return;"));
        assertTrue(countOccurrences(pollingEffect, "if (disposed) return;") >= 2);
        assertTrue(pollingEffect.contains("window.clearInterval(timer);"));
        assertTrue(pollingEffect.contains("window.removeEventListener('storage', handlePaymentPollStorage);"));
        assertTrue(source.contains("const paymentStatus = payment?.status;"));
        assertFalse(pollingEffect.matches("(?s).*}, \\[[^\\]]*\\bpayment\\b[^\\]]*\\]\\);.*"));
    }

    private static String checkoutSource() throws IOException {
        return Files.readString(Path.of("frontend/src/pages/Checkout.tsx"), StandardCharsets.UTF_8);
    }

    private static String checkoutPostPollingMarker(String source) {
        int renderStatus = source.indexOf("const renderCheckoutStatusLiveRegion");
        if (renderStatus >= 0) {
            return "const renderCheckoutStatusLiveRegion";
        }
        return "if (loading) {";
    }

    private static String sliceBetween(String source, String startMarker, String endMarker) {
        int start = source.indexOf(startMarker);
        assertTrue(start >= 0, "Missing start marker: " + startMarker);
        int end = source.indexOf(endMarker, start + startMarker.length());
        assertTrue(end > start, "Missing end marker after " + startMarker + ": " + endMarker);
        return source.substring(start, end);
    }

    private static int countOccurrences(String source, String needle) {
        int count = 0;
        int index = source.indexOf(needle);
        while (index >= 0) {
            count++;
            index = source.indexOf(needle, index + needle.length());
        }
        return count;
    }
}
