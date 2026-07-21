package com.example.shop.config;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;

class PaymentCallbackSignatureContractTest {

    @Test
    void genericPaymentCallbacksRequireHmacSignatureBeforeStateMutation() throws Exception {
        String service = read("src/main/java/com/example/shop/service/PaymentService.java");
        String request = read("src/main/java/com/example/shop/dto/PaymentCallbackRequest.java");
        String controller = read("src/main/java/com/example/shop/controller/PaymentController.java");

        assertTrue(request.contains("@NotNull\n    private Long callbackTimestamp;"));
        assertTrue(request.contains("@NotBlank\n    private String signature;"));
        assertTrue(controller.contains("@PostMapping(\"/callback\")"));
        assertTrue(controller.contains("paymentService.handleCallback(request)"));

        String handleCallback = methodBlock(service, "public Payment handleCallback(PaymentCallbackRequest request)");
        assertOrder(handleCallback, "assertProductionCallbackSecretConfigured()", "findByOrderNoAndChannel");
        assertOrder(handleCallback, "findByOrderNoAndChannel", "verifySignature(request)");
        assertOrder(handleCallback, "verifySignature(request)", "resolveCallbackAt(request)");
        assertOrder(handleCallback, "validateCallbackFreshness(callbackAt)", "markPaidDetailed");
        assertTrue(handleCallback.contains("throw new IllegalArgumentException(\"Invalid payment callback signature\")"));

        String expectedSignature = methodBlock(service, "public String expectedSignature(PaymentCallbackRequest request)");
        assertTrue(expectedSignature.contains("requiredCallbackTimestamp(request.getCallbackTimestamp())"));
        assertTrue(expectedSignature.contains("return hmacSha256Hex(payload, callbackSecret());"));
        assertFalse(expectedSignature.contains("+ \"|\" + callbackSecret()"));
        assertFalse(expectedSignature.contains("return sha256(payload)"));

        String verifySignature = methodBlock(service, "private boolean verifySignature(PaymentCallbackRequest request)");
        assertTrue(verifySignature.contains("MessageDigest.isEqual(expected, actual)"));

        String hmac = methodBlock(service, "private String hmacSha256Hex(String value, String secret)");
        assertTrue(hmac.contains("Mac.getInstance(\"HmacSHA256\")"));
        assertTrue(hmac.contains("new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), \"HmacSHA256\")"));
    }

    @Test
    void stripeWebhooksUseStripeSignatureContract() throws Exception {
        String service = read("src/main/java/com/example/shop/service/PaymentService.java");
        String controller = read("src/main/java/com/example/shop/controller/PaymentController.java");

        assertTrue(controller.contains("@PostMapping(\"/stripe/webhook\")"));
        assertTrue(controller.contains("@RequestHeader(value = \"Stripe-Signature\", required = false) String signatureHeader"));

        String handleStripeWebhook = methodBlock(service, "public Payment handleStripeWebhook(String payload, String signatureHeader)");
        assertTrue(handleStripeWebhook.contains("String webhookSecret = stripeWebhookSecret();"));
        assertTrue(service.contains("STRIPE_WEBHOOK_TOLERANCE_SECONDS = 300L"));
        assertOrder(handleStripeWebhook, "String webhookSecret = stripeWebhookSecret();", "Webhook.constructEvent(payload, signatureHeader, webhookSecret, STRIPE_WEBHOOK_TOLERANCE_SECONDS)");
        assertTrue(handleStripeWebhook.contains("throw new IllegalArgumentException(\"Invalid Stripe webhook signature\", e)"));
        assertFalse(handleStripeWebhook.contains("expectedSignature("));
        // Signed webhooks must not 500 when Stripe SDK fails to deserialize (missing api_version etc.).
        assertTrue(handleStripeWebhook.contains("getDataObjectDeserializer().getObject()"));
        assertTrue(handleStripeWebhook.contains("could not deserialize checkout session payload"));
        assertTrue(handleStripeWebhook.contains("catch (RuntimeException deserializeError)"));
    }

    @Test
    void paymentCallbacksDoNotUseLegacyHandlerCouponOrHardcodedOrderStatusPaths() throws Exception {
        String service = read("src/main/java/com/example/shop/service/PaymentService.java");
        String handleCallback = methodBlock(service, "public Payment handleCallback(PaymentCallbackRequest request)");

        assertFalse(Files.exists(Path.of("src/main/java/com/example/shop/handler/PayCallbackHandler.java")));
        assertFalse(Files.exists(Path.of("src/main/java/com/example/shop/service/PayCallbackHandler.java")));
        assertFalse(service.contains("checkAndUpdateOrderStatus"));
        assertFalse(service.contains("sendReplenishReminderToCustomer"));
        assertFalse(service.contains("notificationRequest.setOrderStatus(1)"));
        assertFalse(handleCallback.contains("couponService"));
        assertFalse(handleCallback.contains("setOrderStatus(1)"));
        assertFalse(handleCallback.contains("updateStock"));
        assertFalse(handleCallback.contains("releaseReservation"));
        assertFalse(handleCallback.contains("reserveProductStock"));
        assertFalse(handleCallback.contains("productRepository"));
        assertFalse(handleCallback.contains("transfer"));
        assertTrue(handleCallback.contains("claimOrderForProviderPaidSuccessOrReconcile("));
        assertTrue(handleCallback.contains("paymentRepository.markPaidDetailed("));
    }

    @Test
    void productionCallbackSecretMustBeConfiguredAndStrong() throws Exception {
        String service = read("src/main/java/com/example/shop/service/PaymentService.java");
        String properties = read("src/main/resources/application.properties");

        assertTrue(properties.contains("payment.callback-secret=${PAYMENT_CALLBACK_SECRET:}"));

        String secretGuard = methodBlock(service, "private void assertProductionCallbackSecretConfigured()");
        assertTrue(secretGuard.contains("if (!isProductionMode())"));
        assertTrue(secretGuard.contains("isWeakCallbackSecret(secret)"));
        assertTrue(secretGuard.contains("Payment callback secret is not configured for production"));

        String weakSecret = methodBlock(service, "private boolean isWeakCallbackSecret(String secret)");
        assertTrue(weakSecret.contains("normalized.length() < 32"));
        assertTrue(weakSecret.contains("\"dev-payment-secret\".equals(lower)"));
        assertTrue(weakSecret.contains("lower.contains(\"replace-with\")"));
        assertTrue(weakSecret.contains("lower.contains(\"your-\")"));
    }

    private static String read(String path) throws Exception {
        return Files.readString(Path.of(path), StandardCharsets.UTF_8);
    }

    private static void assertOrder(String source, String before, String after) {
        int beforeIndex = source.indexOf(before);
        int afterIndex = source.indexOf(after);
        assertTrue(beforeIndex >= 0, "Missing marker: " + before);
        assertTrue(afterIndex >= 0, "Missing marker: " + after);
        assertTrue(beforeIndex < afterIndex, "Expected `" + before + "` before `" + after + "`");
    }

    private static String methodBlock(String source, String signaturePrefix) {
        int start = source.indexOf(signaturePrefix);
        assertTrue(start >= 0, "Missing method signature: " + signaturePrefix);
        int openBrace = source.indexOf('{', start);
        assertTrue(openBrace >= 0, "Missing method body: " + signaturePrefix);
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
        throw new AssertionError("Unterminated method body: " + signaturePrefix);
    }


    @Test
    void mercadoPagoWebhooksRequireSignedProviderLookupBeforeStateMutation() throws Exception {
        String service = read("src/main/java/com/example/shop/service/PaymentService.java");
        String controller = read("src/main/java/com/example/shop/controller/PaymentController.java");
        String security = read("src/main/java/com/example/shop/config/SecurityConfig.java");
        String rateLimit = read("src/main/java/com/example/shop/service/RateLimitService.java");

        assertTrue(controller.contains("@PostMapping({\"/mercado-pago/webhook\", \"/mercadopago/webhook\"})"));
        assertTrue(controller.contains("@RequestHeader(value = \"x-signature\", required = false) String signatureHeader"));
        assertTrue(controller.contains("paymentService.handleMercadoPagoWebhook("));
        assertTrue(security.contains("/payments/mercado-pago/webhook"));
        assertTrue(rateLimit.contains("/payments/mercado-pago/webhook"));

        int start = service.indexOf("public Payment handleMercadoPagoWebhook");
        assertTrue(start >= 0);
        int end = service.indexOf("public List<Payment> findByOrderId", start);
        assertTrue(end > start);
        String handle = service.substring(start, end);
        assertTrue(handle.contains("mercadoPagoWebhookSecret()"));
        assertTrue(handle.contains("mercadoPagoAccessToken()"));
        assertTrue(handle.contains("verifyMercadoPagoSignature("));
        assertTrue(handle.contains("fetchMercadoPagoPayment("));
        assertOrder(handle, "verifyMercadoPagoSignature(", "fetchMercadoPagoPayment(");
        assertOrder(handle, "fetchMercadoPagoPayment(", "markPaidDetailed(");
        assertTrue(handle.contains("Invalid Mercado Pago webhook signature"));
        assertTrue(service.contains("MERCADO_PAGO_WEBHOOK_TOLERANCE_SECONDS = 300L"));
        assertTrue(service.contains("id:\" + dataId + \";request-id:\""));

        int fetchStart = service.indexOf("private JsonNode fetchMercadoPagoPayment");
        assertTrue(fetchStart >= 0);
        int fetchEnd = service.indexOf("private void validateMercadoPagoPaidPayment", fetchStart);
        assertTrue(fetchEnd > fetchStart);
        String fetch = service.substring(fetchStart, fetchEnd);
        // Commercial: signed webhook for unknown remote payments should not 500-retry forever.
        assertTrue(fetch.contains("getRawStatusCode() == 404"));
        assertTrue(fetch.contains("return null;"));
        // Simulation-aware ack after signature verify keeps local contract smokes green.
        assertTrue(fetch.contains("isPaymentSimulationEnabled()"));
        assertTrue(fetch.contains("getRawStatusCode() == 401 || e.getRawStatusCode() == 403"));
    }

}
