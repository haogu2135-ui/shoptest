package com.example.shop.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.Test;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.mock.env.MockEnvironment;

class ReferenceDataCacheTtlContractTest {
    @Test
    void referenceDataCachesExpireAfterConfiguredTtl() throws Exception {
        ReferenceDataCacheConfig config = new ReferenceDataCacheConfig();
        MockEnvironment environment = new MockEnvironment()
                .withProperty(ReferenceDataCacheConfig.REFERENCE_DATA_CACHE_TTL_PROPERTY, "20");
        CacheManager cacheManager = config.inMemoryReferenceDataCacheManager(environment);

        assertTrue(cacheManager.getCacheNames().contains(ReferenceDataCacheConfig.CATEGORY_REFERENCE_CACHE));
        assertTrue(cacheManager.getCacheNames().contains(ReferenceDataCacheConfig.BRAND_REFERENCE_CACHE));

        Cache categoryCache = cacheManager.getCache(ReferenceDataCacheConfig.CATEGORY_REFERENCE_CACHE);
        categoryCache.put("all", "first");
        assertEquals("first", categoryCache.get("all", String.class));

        Thread.sleep(40);

        assertNull(categoryCache.get("all"));
    }

    @Test
    void referenceDataCacheGetWithLoaderReloadsAfterTtl() throws Exception {
        ReferenceDataCacheConfig config = new ReferenceDataCacheConfig();
        MockEnvironment environment = new MockEnvironment()
                .withProperty(ReferenceDataCacheConfig.REFERENCE_DATA_CACHE_TTL_PROPERTY, "20");
        Cache cache = config.inMemoryReferenceDataCacheManager(environment)
                .getCache(ReferenceDataCacheConfig.BRAND_REFERENCE_CACHE);
        AtomicInteger loads = new AtomicInteger();

        assertEquals("value-1", cache.get("brands", () -> "value-" + loads.incrementAndGet()));
        assertEquals("value-1", cache.get("brands", () -> "value-" + loads.incrementAndGet()));

        Thread.sleep(40);

        assertEquals("value-2", cache.get("brands", () -> "value-" + loads.incrementAndGet()));
        assertEquals(2, loads.get());
    }

    @Test
    void referenceDataCacheConfigDeclaresOneHourDefaultTtl() throws IOException {
        String source = Files.readString(
                Path.of("src/main/java/com/example/shop/config/ReferenceDataCacheConfig.java"),
                StandardCharsets.UTF_8);

        assertTrue(source.contains("DEFAULT_REFERENCE_DATA_CACHE_TTL_MS = TimeUnit.HOURS.toMillis(1)"));
        assertTrue(source.contains("shop.cache.reference-data-ttl-ms"));
        assertTrue(source.contains("RedisCacheManager.builder(redisConnectionFactory)"));
        assertTrue(source.contains(".entryTtl(Duration.ofMillis(ttlMillis))"));
        assertTrue(source.contains("categoryReferenceData"));
        assertTrue(source.contains("brandReferenceData"));
        assertTrue(source.contains("values.remove(key, value);"));
    }
}
