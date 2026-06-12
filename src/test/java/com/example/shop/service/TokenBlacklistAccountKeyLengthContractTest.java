package com.example.shop.service;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class TokenBlacklistAccountKeyLengthContractTest {

    @Test
    void normalizedAccountKeysHaveHardLengthBound() throws Exception {
        String source = Files.readString(
                Path.of("src/main/java/com/example/shop/service/TokenBlacklistService.java"),
                StandardCharsets.UTF_8);

        assertTrue(source.contains("private static final int MAX_ACCOUNT_KEY_CHARS = 255;"),
                "TokenBlacklistService should define a hard account key length bound");

        String normalizeAccountKey = sliceBetween(
                source,
                "private String normalizeAccountKey(String username)",
                "\n    private int parseCounter");
        assertTrue(normalizeAccountKey.contains("normalized.length() > MAX_ACCOUNT_KEY_CHARS"),
                "normalizeAccountKey should reject overlong normalized usernames before Redis key construction");
        assertTrue(normalizeAccountKey.contains("return null;"),
                "Overlong or blank account keys should be skipped instead of written to Redis");

        String recordLoginFailure = sliceBetween(
                source,
                "public void recordLoginFailure(String clientIp, String username)",
                "\n    public void clearLoginFailures");
        assertTrue(recordLoginFailure.contains("String normalizedUsername = normalizeAccountKey(username);"),
                "recordLoginFailure should normalize and bound account lock keys before constructing Redis keys");
        assertTrue(recordLoginFailure.contains("if (normalizedUsername != null)"),
                "recordLoginFailure should skip account counters when normalization rejects an unsafe key");
        assertTrue(recordLoginFailure.contains("String accountKey = ACCOUNT_LOCK_PREFIX + normalizedUsername;"),
                "Account Redis keys should be constructed only from the bounded normalized value");
    }

    private static String sliceBetween(String source, String startMarker, String endMarker) {
        int start = source.indexOf(startMarker);
        assertTrue(start >= 0, "Missing start marker: " + startMarker);
        int end = source.indexOf(endMarker, start + startMarker.length());
        assertTrue(end > start, "Missing end marker after " + startMarker + ": " + endMarker);
        return source.substring(start, end);
    }
}
