package com.example.shop.service;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.core.Cursor;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.data.redis.core.script.RedisScript;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TokenBlacklistServiceTest {

    @Test
    void refreshTokensStoreAndConsumeUsernameWithoutJpaRefreshTokenEntity() {
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        ValueOperations<String, String> valueOperations = mockValueOperations();
        when(redis.opsForValue()).thenReturn(valueOperations);
        when(redis.execute(
                anyRedisScript(),
                org.mockito.ArgumentMatchers.eq(List.of("refresh:refresh-token"))))
                .thenReturn("mia");
        TokenBlacklistService service = new TokenBlacklistService(redisProvider(redis), mock(RuntimeConfigService.class), mock(ClientIpResolver.class));

        service.storeRefreshToken("refresh-token", "mia");
        String username = service.consumeRefreshToken("refresh-token");

        assertEquals("mia", username);
        verify(valueOperations).set("refresh:refresh-token", "mia", 7L, TimeUnit.DAYS);
        verify(redis).execute(anyRedisScript(), org.mockito.ArgumentMatchers.eq(List.of("refresh:refresh-token")));
        verify(redis, never()).delete("refresh:refresh-token");
        assertFalse(Files.exists(Path.of("src/main/java/com/example/shop/entity/RefreshToken.java")));
        assertFalse(Files.exists(Path.of("src/main/java/com/example/shop/service/RefreshTokenService.java")));
    }

    @Test
    void blacklistedAccessTokenFallsBackToLocalStoreWhenRedisIsUnavailable() {
        ObjectProvider<StringRedisTemplate> redisProvider = redisProvider(null);
        TokenBlacklistService service = new TokenBlacklistService(redisProvider, mock(RuntimeConfigService.class), mock(ClientIpResolver.class));

        service.blacklistAccessToken("access-jti", TimeUnit.MINUTES.toMillis(5));

        assertTrue(service.isAccessTokenBlacklisted("access-jti"));
    }

    @Test
    void blacklistedAccessTokenRemainsLocalWhenRedisLaterBecomesUnavailable() {
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        ValueOperations<String, String> valueOperations = mockValueOperations();
        when(redis.opsForValue()).thenReturn(valueOperations);
        ObjectProvider<StringRedisTemplate> redisProvider = redisProvider(redis, null);
        TokenBlacklistService service = new TokenBlacklistService(redisProvider, mock(RuntimeConfigService.class), mock(ClientIpResolver.class));

        service.blacklistAccessToken("access-jti", TimeUnit.MINUTES.toMillis(5));

        assertTrue(service.isAccessTokenBlacklisted("access-jti"));
    }

    @Test
    void revokedRefreshTokenCannotBeConsumedWhenRedisDeleteFails() {
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        when(redis.delete("refresh:refresh-token")).thenThrow(new RuntimeException("redis unavailable"));
        ObjectProvider<StringRedisTemplate> redisProvider = redisProvider(redis);
        TokenBlacklistService service = new TokenBlacklistService(redisProvider, mock(RuntimeConfigService.class), mock(ClientIpResolver.class));

        service.revokeRefreshToken("refresh-token");

        assertNull(service.consumeRefreshToken("refresh-token"));
    }

    @Test
    void locallyRevokedRefreshTokenSkipsRedisLookup() {
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        ObjectProvider<StringRedisTemplate> redisProvider = redisProvider(redis);
        TokenBlacklistService service = new TokenBlacklistService(redisProvider, mock(RuntimeConfigService.class), mock(ClientIpResolver.class));

        service.revokeRefreshToken("refresh-token");
        assertNull(service.consumeRefreshToken("refresh-token"));

        verify(redis, never()).opsForValue();
    }

    @Test
    void trustedIpSkipsLoginFailureRateLimitCounters() {
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
        ClientIpResolver clientIpResolver = mock(ClientIpResolver.class);
        when(clientIpResolver.normalizeIpAddress("129.146.180.88")).thenReturn("129.146.180.88");
        when(runtimeConfig.getString("security.ip-blacklist.trusted-ips", "127.0.0.1,::1,0:0:0:0:0:0:0:1"))
                .thenReturn("127.0.0.1,129.146.180.88");
        when(clientIpResolver.matchesAny("129.146.180.88", "127.0.0.1,129.146.180.88")).thenReturn(true);
        TokenBlacklistService service = new TokenBlacklistService(redisProvider(redis), runtimeConfig, clientIpResolver);

        service.recordLoginFailure("129.146.180.88", "demo@example.com");

        assertFalse(service.isLoginRateLimited("129.146.180.88"));
        verify(redis, never()).opsForValue();
    }

    @Test
    void findLoginIpFailuresScansRedisInsteadOfUsingKeys() throws Exception {
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        ValueOperations<String, String> valueOperations = mockValueOperations();
        RedisConnection connection = mock(RedisConnection.class);
        Cursor<byte[]> cursor = mockCursor();
        RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
        when(runtimeConfig.getInt("security.ip-blacklist.redis-scan-count", 500)).thenReturn(2);
        when(runtimeConfig.getInt("security.ip-blacklist.login-failure-threshold", 5)).thenReturn(5);
        when(redis.opsForValue()).thenReturn(valueOperations);
        when(connection.scan(any(ScanOptions.class))).thenReturn(cursor);
        when(cursor.hasNext()).thenReturn(true, true, false);
        byte[] firstKey = "login:ip:203.0.113.10".getBytes(StandardCharsets.UTF_8);
        byte[] secondKey = "login:ip:203.0.113.11".getBytes(StandardCharsets.UTF_8);
        when(cursor.next()).thenReturn(firstKey, secondKey);
        when(valueOperations.get("login:ip:203.0.113.10")).thenReturn("6");
        when(valueOperations.get("login:ip:203.0.113.11")).thenReturn("2");
        when(redis.getExpire("login:ip:203.0.113.10", TimeUnit.SECONDS)).thenReturn(120L);
        when(redis.getExpire("login:ip:203.0.113.11", TimeUnit.SECONDS)).thenReturn(30L);
        runRedisCallback(redis, connection);
        TokenBlacklistService service = new TokenBlacklistService(redisProvider(redis), runtimeConfig, mock(ClientIpResolver.class));

        List<TokenBlacklistService.LoginIpFailureSnapshot> snapshots = service.findLoginIpFailures();

        assertEquals(2, snapshots.size());
        assertEquals("203.0.113.10", snapshots.get(0).getIpAddress());
        assertEquals(6, snapshots.get(0).getFailureCount());
        assertEquals(120L, snapshots.get(0).getTtlSeconds());
        assertTrue(snapshots.get(0).isLocked());
        assertEquals("203.0.113.11", snapshots.get(1).getIpAddress());
        assertEquals(2, snapshots.get(1).getFailureCount());
        assertEquals(30L, snapshots.get(1).getTtlSeconds());
        assertFalse(snapshots.get(1).isLocked());
        verify(redis, never()).keys(anyString());
        verify(redis).execute(any(RedisCallback.class));
        ArgumentCaptor<ScanOptions> options = ArgumentCaptor.forClass(ScanOptions.class);
        verify(connection).scan(options.capture());
        assertEquals("login:ip:*", options.getValue().getPattern());
        assertEquals(2L, options.getValue().getCount());
        verify(cursor).close();
    }

    @SuppressWarnings("unchecked")
    private ObjectProvider<StringRedisTemplate> redisProvider(StringRedisTemplate redis) {
        ObjectProvider<StringRedisTemplate> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(redis);
        return provider;
    }

    @SuppressWarnings("unchecked")
    private ObjectProvider<StringRedisTemplate> redisProvider(StringRedisTemplate first, StringRedisTemplate second) {
        ObjectProvider<StringRedisTemplate> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(first, second);
        return provider;
    }

    @SuppressWarnings("unchecked")
    private ValueOperations<String, String> mockValueOperations() {
        return mock(ValueOperations.class);
    }

    @SuppressWarnings("unchecked")
    private Cursor<byte[]> mockCursor() {
        return mock(Cursor.class);
    }

    private RedisScript<String> anyRedisScript() {
        return org.mockito.ArgumentMatchers.any();
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private void runRedisCallback(StringRedisTemplate redis, RedisConnection connection) {
        doAnswer(invocation -> ((RedisCallback) invocation.getArgument(0)).doInRedis(connection))
                .when(redis)
                .execute(any(RedisCallback.class));
    }
}
