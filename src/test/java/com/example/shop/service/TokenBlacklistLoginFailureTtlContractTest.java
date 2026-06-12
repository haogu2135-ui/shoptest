package com.example.shop.service;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TokenBlacklistLoginFailureTtlContractTest {

    @Test
    void loginFailureCountersIncrementAndSetTtlAtomically() throws Exception {
        String source = Files.readString(
                Path.of("src/main/java/com/example/shop/service/TokenBlacklistService.java"),
                StandardCharsets.UTF_8);

        assertTrue(source.contains("private static final RedisScript<Long> LOGIN_FAILURE_INCREMENT_SCRIPT = loginFailureIncrementScript();"),
                "Login failure counters should use a dedicated Redis script");
        assertTrue(source.contains("private Long incrementLoginFailureCounter(StringRedisTemplate redis, String key, long ttlSeconds)"),
                "IP and account login failure counters should share one helper");
        assertTrue(source.contains("redis.execute(LOGIN_FAILURE_INCREMENT_SCRIPT, List.of(key), String.valueOf(ttlSeconds));"),
                "Counter increments should execute the Redis script with a key and TTL argument");

        String scriptFactory = sliceBetween(
                source,
                "private static RedisScript<Long> loginFailureIncrementScript()",
                "\n    private String normalizeAccountKey");
        assertTrue(scriptFactory.contains("redis.call('INCR', KEYS[1])"),
                "The Redis script should increment the login failure key");
        assertTrue(scriptFactory.contains("redis.call('TTL', KEYS[1])"),
                "The Redis script should inspect the key TTL in the same atomic operation");
        assertTrue(scriptFactory.contains("redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1]))"),
                "The Redis script should set the expiry when the key has no TTL");
        assertTrue(scriptFactory.contains("script.setResultType(Long.class);"),
                "The Redis script should return the incremented counter");

        String recordLoginFailure = sliceBetween(
                source,
                "public void recordLoginFailure(String clientIp, String username)",
                "\n    public void clearLoginFailures");
        assertTrue(recordLoginFailure.contains(
                        "incrementLoginFailureCounter(redis, ipKey, TimeUnit.MINUTES.toSeconds(ipFailureWindowMinutes()));"),
                "IP login failures should increment and set TTL atomically");
        assertTrue(recordLoginFailure.contains(
                        "incrementLoginFailureCounter(redis, accountKey, TimeUnit.MINUTES.toSeconds(accountLockoutMinutes()));"),
                "Account login failures should increment and set TTL atomically");
        assertFalse(recordLoginFailure.contains("opsForValue().increment"),
                "recordLoginFailure must not split INCR from TTL assignment");
        assertFalse(recordLoginFailure.contains("redis.expire("),
                "recordLoginFailure must not assign TTL in a separate Redis command");
    }

    private static String sliceBetween(String source, String startMarker, String endMarker) {
        int start = source.indexOf(startMarker);
        assertTrue(start >= 0, "Missing start marker: " + startMarker);
        int end = source.indexOf(endMarker, start + startMarker.length());
        assertTrue(end > start, "Missing end marker after " + startMarker + ": " + endMarker);
        return source.substring(start, end);
    }
}
