package com.example.shop.service;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CheckoutIdempotencyServiceContractTest {
    private static final Path SERVICE_SOURCE = Path.of("src/main/java/com/example/shop/service/CheckoutIdempotencyService.java");

    @Test
    void checkoutIdempotencyUsesAtomicClaimFlowWithoutLegacySaveGetRemoveMethods() throws Exception {
        String source = Files.readString(SERVICE_SOURCE);

        assertTrue(source.contains("public Claim claim("));
        assertTrue(source.contains("INSERT INTO checkout_idempotency_keys"));
        assertTrue(source.contains("catch (DataIntegrityViolationException duplicate)"));
        assertTrue(source.contains("private Claim claimExisting("));
        assertTrue(source.contains("public void complete("));

        assertFalse(source.contains("@Transactional"));
        assertFalse(Pattern.compile("\\bpublic\\s+\\w[\\w<>?, ]*\\s+save\\s*\\(").matcher(source).find());
        assertFalse(Pattern.compile("\\bpublic\\s+\\w[\\w<>?, ]*\\s+get\\s*\\(").matcher(source).find());
        assertFalse(Pattern.compile("\\bpublic\\s+\\w[\\w<>?, ]*\\s+remove\\s*\\(").matcher(source).find());
        assertFalse(source.contains("return existing;"));
    }
}
