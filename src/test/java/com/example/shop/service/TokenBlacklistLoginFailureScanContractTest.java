package com.example.shop.service;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TokenBlacklistLoginFailureScanContractTest {
    private static final Path TOKEN_BLACKLIST_SERVICE =
            Path.of("src/main/java/com/example/shop/service/TokenBlacklistService.java");

    @Test
    void loginFailureSnapshotsUseRedisScanInsteadOfBlockingKeys() throws IOException {
        String source = Files.readString(TOKEN_BLACKLIST_SERVICE);

        assertFalse(source.contains("redis.keys(LOGIN_ATTEMPT_PREFIX + \"*\")"),
                "Login failure snapshots must not enumerate Redis with blocking KEYS");
        assertFalse(source.contains(".keys(LOGIN_ATTEMPT_PREFIX"),
                "Login failure snapshots must not call Redis KEYS for login:ip:*");
        assertTrue(source.contains("ScanOptions.scanOptions()"),
                "Login failure snapshots should build Redis SCAN options");
        assertTrue(source.contains(".match(LOGIN_ATTEMPT_PREFIX + \"*\")"),
                "Redis SCAN should be scoped to login failure keys only");
        assertTrue(source.contains(".count(batchSize)"),
                "Redis SCAN should use a bounded, configurable batch size");
        assertTrue(source.contains("connection.scan(options)"),
                "Login failure snapshots should scan through the Redis connection cursor");
        assertTrue(source.contains("security.ip-blacklist.redis-scan-count"),
                "SCAN count should be runtime configurable for production tuning");
    }
}
