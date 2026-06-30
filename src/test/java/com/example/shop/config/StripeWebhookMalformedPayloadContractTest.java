package com.example.shop.config;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class StripeWebhookMalformedPayloadContractTest {

    @Test
    void malformedStripeWebhookSessionPayloadIsIgnoredWithoutThrowing() throws Exception {
        String source = Files.readString(Path.of("src/main/java/com/example/shop/service/PaymentService.java"), StandardCharsets.UTF_8);
        String method = sliceMethod(source, "public Payment handleStripeWebhook(String payload, String signatureHeader)");

        assertTrue(source.contains("STRIPE_WEBHOOK_TOLERANCE_SECONDS = 300L"),
                "Stripe webhook replay tolerance should be explicit");
        assertTrue(method.contains("Webhook.constructEvent(payload, signatureHeader, webhookSecret, STRIPE_WEBHOOK_TOLERANCE_SECONDS)"),
                "Stripe webhook signatures should still be verified before payload handling");
        assertTrue(method.contains("event.getDataObjectDeserializer().getObject().orElse(null)"),
                "Webhook data object should be read without throwing on absent deserialization");
        assertTrue(method.contains("if (!(stripeObject instanceof Session))"),
                "Missing or unexpected Stripe data objects should be treated as ignored events");
        assertTrue(method.contains("Stripe webhook ignored event with unavailable checkout session payload"),
                "Ignored malformed Stripe webhook payloads should leave a warning for operators");
        assertTrue(method.contains("return null;"),
                "Malformed but signed Stripe webhook data should be acknowledged without payment mutation");
        assertFalse(method.contains(".orElseThrow(() -> new IllegalArgumentException(\"Invalid Stripe webhook payload\"))"),
                "Malformed signed Stripe webhook data should not create repeated IllegalArgumentException noise");
    }

    private static String sliceMethod(String source, String signature) {
        int start = source.indexOf(signature);
        assertTrue(start >= 0, "Missing method signature: " + signature);
        int openBrace = source.indexOf('{', start);
        assertTrue(openBrace >= 0, "Missing method body: " + signature);
        int depth = 0;
        for (int index = openBrace; index < source.length(); index++) {
            char current = source.charAt(index);
            if (current == '{') {
                depth++;
            } else if (current == '}') {
                depth--;
                if (depth == 0) {
                    return source.substring(start, index + 1);
                }
            }
        }
        throw new AssertionError("Unterminated method body: " + signature);
    }
}
