package com.example.shop.config;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertTrue;

class CheckoutIdempotencyLifecycleContractTest {
    private static final Path CHECKOUT_SOURCE = Path.of("frontend/src/pages/Checkout.tsx");

    @Test
    void checkoutIdempotencyKeyCannotBeLeftWithoutCleanupOrPendingOrderRecovery() throws IOException {
        String source = Files.readString(CHECKOUT_SOURCE);
        if (!source.contains("checkoutIdempotencyKey") && !source.contains("CHECKOUT_IDEMPOTENCY_KEY")) {
            return;
        }

        assertTrue(
                clearsIdempotencyKeyInSubmitFinally(source) || preservesPendingOrderRecovery(source),
                "Checkout idempotency keys must be cleared in submit finally or paired with pending-order payment recovery");
    }

    @Test
    void checkoutPersistsPendingOrderBeforeClearingCartSelection() throws IOException {
        String source = Files.readString(CHECKOUT_SOURCE);
        int persistIndex = source.indexOf("persistCheckoutPendingOrder(orderRes.data, normalizedPaymentMethod, normalizedGuestEmail);");
        int clearCartIndex = source.indexOf("clearCheckoutCartItemIds();", Math.max(0, persistIndex));

        assertTrue(persistIndex >= 0, "Checkout should persist pending-order recovery after order creation");
        assertTrue(clearCartIndex > persistIndex, "Checkout should persist pending-order recovery before clearing cart selection");
    }

    private boolean clearsIdempotencyKeyInSubmitFinally(String source) {
        return Pattern.compile(
                "finally\\s*\\{[\\s\\S]{0,240}clearCheckoutIdempotencyKey\\(\\);[\\s\\S]{0,240}setSubmitting\\(false\\)")
                .matcher(source)
                .find();
    }

    private boolean preservesPendingOrderRecovery(String source) {
        int persistIndex = source.indexOf("persistCheckoutPendingOrder(orderRes.data, normalizedPaymentMethod, normalizedGuestEmail);");
        int paymentCreateIndex = source.indexOf("paymentApi.create(", Math.max(0, persistIndex));
        return source.contains("CHECKOUT_PENDING_ORDER_KEY")
                && source.contains("const readCheckoutPendingOrder = () =>")
                && persistIndex >= 0
                && paymentCreateIndex > persistIndex
                && Pattern.compile("catch \\(paymentError: unknown\\) \\{[\\s\\S]{0,480}setPaymentCreateError\\([\\s\\S]{0,480}return;")
                        .matcher(source)
                        .find()
                && Pattern.compile("setPayment\\(paymentRes\\.data\\);[\\s\\S]{0,220}clearCheckoutIdempotencyKey\\(\\);[\\s\\S]{0,220}clearCheckoutPendingOrder\\(\\);")
                        .matcher(source)
                        .find()
                && Pattern.compile("const retryCreatePayment = async \\(\\) => \\{[\\s\\S]{0,520}paymentApi\\.create\\([\\s\\S]{0,520}clearCheckoutIdempotencyKey\\(\\);[\\s\\S]{0,220}clearCheckoutPendingOrder\\(\\);")
                        .matcher(source)
                        .find();
    }
}
