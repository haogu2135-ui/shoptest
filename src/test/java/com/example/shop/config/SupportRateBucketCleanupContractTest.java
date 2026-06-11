package com.example.shop.config;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SupportRateBucketCleanupContractTest {

    @Test
    void supportMessageRateBucketsArePrunedByScheduledCleanup() throws Exception {
        String supportService = read("src/main/java/com/example/shop/service/SupportService.java");
        String applicationProperties = read("src/main/resources/application.properties");
        String configCenterService = read("src/main/java/com/example/shop/service/ConfigCenterService.java");
        String backendEnvExample = read("deploy/backend.env.example");

        assertTrue(supportService.contains("import org.springframework.scheduling.annotation.Scheduled;"),
                "SupportService should import Spring scheduling for periodic rate bucket cleanup");
        assertTrue(supportService.contains("@Scheduled(fixedDelayString = \"${support.message.rate-bucket-cleanup-ms:300000}\")"),
                "SupportService should run periodic rate bucket cleanup on a configurable delay");
        assertTrue(supportService.contains("public void cleanupMessageRateBuckets()"),
                "SupportService should expose a scheduled cleanup method");
        assertTrue(supportService.contains("cleanupMessageRateBucketsBefore(currentWindowStart);"),
                "Scheduled cleanup should prune buckets older than the current window");
        assertTrue(supportService.contains("private void cleanupMessageRateBucketsBefore(long windowStart)"),
                "Cleanup logic should live in one helper shared by scheduled and emergency cleanup");
        assertTrue(supportService.contains("messageRateBuckets.entrySet().removeIf(entry -> entry.getValue().windowStart < windowStart);"),
                "Cleanup helper should remove stale rate buckets");

        String consumeMessageRate = sliceBetween(
                supportService,
                "private void consumeMessageRate(Long senderId, String senderRole)",
                "\n    @Scheduled(");
        assertTrue(consumeMessageRate.contains("cleanupMessageRateBucketsBefore(windowStart);"),
                "The size guard should still trigger immediate stale bucket cleanup");
        assertFalse(consumeMessageRate.contains("messageRateBuckets.entrySet().removeIf"),
                "consumeMessageRate should delegate cleanup instead of relying on inline weakly consistent iteration");

        assertTrue(applicationProperties.contains(
                "support.message.rate-bucket-cleanup-ms=${SUPPORT_MESSAGE_RATE_BUCKET_CLEANUP_MS:300000}"),
                "application.properties should expose the rate bucket cleanup delay");
        assertTrue(configCenterService.contains("\"support.message.rate-bucket-cleanup-ms=300000\""),
                "Config Center defaults should expose the rate bucket cleanup delay");
        assertTrue(backendEnvExample.contains("SUPPORT_MESSAGE_RATE_BUCKET_CLEANUP_MS=300000"),
                "Production env example should expose the rate bucket cleanup delay");
    }

    private static String read(String path) throws Exception {
        return Files.readString(Path.of(path), StandardCharsets.UTF_8);
    }

    private static String sliceBetween(String source, String startMarker, String endMarker) {
        int start = source.indexOf(startMarker);
        assertTrue(start >= 0, "Missing start marker: " + startMarker);
        int end = source.indexOf(endMarker, start + startMarker.length());
        assertTrue(end > start, "Missing end marker after " + startMarker + ": " + endMarker);
        return source.substring(start, end);
    }
}
