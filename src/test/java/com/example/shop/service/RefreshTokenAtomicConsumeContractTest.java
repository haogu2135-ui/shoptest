package com.example.shop.service;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatchers;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;

import java.lang.reflect.Constructor;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RefreshTokenAtomicConsumeContractTest {

    @Test
    void consumeRefreshTokenUsesAtomicRedisScriptInsteadOfSeparateGetAndDelete() {
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        when(redis.execute(
                ArgumentMatchers.<RedisScript<String>>any(),
                eq(List.of("refresh:refresh-token"))))
                .thenReturn("mia");
        TokenBlacklistService service = newService(redisProvider(redis));

        String username = service.consumeRefreshToken("refresh-token");

        assertEquals("mia", username);
        verify(redis).execute(
                ArgumentMatchers.<RedisScript<String>>any(),
                eq(List.of("refresh:refresh-token")));
        verify(redis, never()).opsForValue();
        verify(redis, never()).delete("refresh:refresh-token");
    }

    @Test
    void consumeRefreshTokenReturnsNullWhenAtomicScriptFindsNoToken() {
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        when(redis.execute(
                ArgumentMatchers.<RedisScript<String>>any(),
                eq(List.of("refresh:missing-token"))))
                .thenReturn(null);
        TokenBlacklistService service = newService(redisProvider(redis));

        assertNull(service.consumeRefreshToken("missing-token"));

        verify(redis).execute(
                ArgumentMatchers.<RedisScript<String>>any(),
                eq(List.of("refresh:missing-token")));
        verify(redis, never()).delete("refresh:missing-token");
    }

    @Test
    void consumeRefreshTokenFailsClosedWhenAtomicScriptFails() {
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        when(redis.execute(
                ArgumentMatchers.<RedisScript<String>>any(),
                eq(List.of("refresh:refresh-token"))))
                .thenThrow(new RuntimeException("redis unavailable"));
        TokenBlacklistService service = newService(redisProvider(redis));

        assertNull(service.consumeRefreshToken("refresh-token"));

        verify(redis, never()).delete("refresh:refresh-token");
    }

    @SuppressWarnings("unchecked")
    private ObjectProvider<StringRedisTemplate> redisProvider(StringRedisTemplate redis) {
        ObjectProvider<StringRedisTemplate> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(redis);
        return provider;
    }

    private TokenBlacklistService newService(ObjectProvider<StringRedisTemplate> redisProvider) {
        RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
        for (Constructor<?> constructor : TokenBlacklistService.class.getConstructors()) {
            Class<?>[] parameterTypes = constructor.getParameterTypes();
            try {
                if (parameterTypes.length == 2) {
                    return (TokenBlacklistService) constructor.newInstance(redisProvider, runtimeConfig);
                }
                if (parameterTypes.length == 3) {
                    return (TokenBlacklistService) constructor.newInstance(
                            redisProvider,
                            runtimeConfig,
                            mock(ClientIpResolver.class));
                }
            } catch (ReflectiveOperationException ex) {
                throw new IllegalStateException("Unable to construct TokenBlacklistService", ex);
            }
        }
        throw new IllegalStateException("Supported TokenBlacklistService constructor not found");
    }
}
