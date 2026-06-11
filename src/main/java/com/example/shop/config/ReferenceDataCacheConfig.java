package com.example.shop.config;

import java.time.Duration;
import java.util.Collection;
import java.util.Collections;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.TimeUnit;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.lang.Nullable;

@Configuration
public class ReferenceDataCacheConfig {
    static final String CATEGORY_REFERENCE_CACHE = "categoryReferenceData";
    static final String BRAND_REFERENCE_CACHE = "brandReferenceData";
    static final String REFERENCE_DATA_CACHE_TTL_PROPERTY = "shop.cache.reference-data-ttl-ms";
    static final long DEFAULT_REFERENCE_DATA_CACHE_TTL_MS = TimeUnit.HOURS.toMillis(1);

    @Bean
    public CacheManager referenceDataCacheManager(Environment environment,
                                                  ObjectProvider<RedisConnectionFactory> redisConnectionFactoryProvider) {
        long ttlMillis = referenceDataCacheTtlMillis(environment);
        RedisConnectionFactory redisConnectionFactory = redisConnectionFactoryProvider.getIfAvailable();
        if (redisConnectionFactory != null && redisCacheTypeAllowed(environment)) {
            return referenceDataRedisCacheManager(redisConnectionFactory, ttlMillis);
        }
        return inMemoryReferenceDataCacheManager(ttlMillis);
    }

    private long referenceDataCacheTtlMillis(Environment environment) {
        Long configured = environment.getProperty(REFERENCE_DATA_CACHE_TTL_PROPERTY, Long.class);
        if (configured == null || configured <= 0) {
            return DEFAULT_REFERENCE_DATA_CACHE_TTL_MS;
        }
        return configured;
    }

    CacheManager inMemoryReferenceDataCacheManager(Environment environment) {
        return inMemoryReferenceDataCacheManager(referenceDataCacheTtlMillis(environment));
    }

    private CacheManager inMemoryReferenceDataCacheManager(long ttlMillis) {
        return new ExpiringReferenceDataCacheManager(ttlMillis);
    }

    private CacheManager referenceDataRedisCacheManager(RedisConnectionFactory redisConnectionFactory, long ttlMillis) {
        RedisCacheConfiguration cacheConfiguration = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofMillis(ttlMillis))
                .disableCachingNullValues();
        return RedisCacheManager.builder(redisConnectionFactory)
                .cacheDefaults(cacheConfiguration)
                .withInitialCacheConfigurations(Map.of(
                        CATEGORY_REFERENCE_CACHE, cacheConfiguration,
                        BRAND_REFERENCE_CACHE, cacheConfiguration))
                .transactionAware()
                .build();
    }

    private boolean redisCacheTypeAllowed(Environment environment) {
        String cacheType = environment.getProperty("spring.cache.type");
        return cacheType == null || cacheType.isBlank() || "redis".equalsIgnoreCase(cacheType);
    }

    private static class ExpiringReferenceDataCacheManager implements CacheManager {
        private final long ttlMillis;
        private final ConcurrentMap<String, Cache> caches = new ConcurrentHashMap<>();

        private ExpiringReferenceDataCacheManager(long ttlMillis) {
            this.ttlMillis = ttlMillis;
            caches.put(CATEGORY_REFERENCE_CACHE, new ExpiringReferenceDataCache(CATEGORY_REFERENCE_CACHE, ttlMillis));
            caches.put(BRAND_REFERENCE_CACHE, new ExpiringReferenceDataCache(BRAND_REFERENCE_CACHE, ttlMillis));
        }

        @Override
        @Nullable
        public Cache getCache(String name) {
            return caches.computeIfAbsent(name, cacheName -> new ExpiringReferenceDataCache(cacheName, ttlMillis));
        }

        @Override
        public Collection<String> getCacheNames() {
            return Collections.unmodifiableSet(caches.keySet());
        }
    }

    private static class ExpiringReferenceDataCache implements Cache {
        private final String name;
        private final long ttlMillis;
        private final ConcurrentMap<Object, ExpiringValue> values = new ConcurrentHashMap<>();

        private ExpiringReferenceDataCache(String name, long ttlMillis) {
            this.name = name;
            this.ttlMillis = ttlMillis;
        }

        @Override
        public String getName() {
            return name;
        }

        @Override
        public Object getNativeCache() {
            return values;
        }

        @Override
        @Nullable
        public ValueWrapper get(Object key) {
            ExpiringValue value = values.get(key);
            if (value == null) {
                return null;
            }
            if (value.isExpired(System.currentTimeMillis())) {
                values.remove(key, value);
                return null;
            }
            return () -> value.value;
        }

        @Override
        @Nullable
        public <T> T get(Object key, @Nullable Class<T> type) {
            ValueWrapper wrapper = get(key);
            if (wrapper == null) {
                return null;
            }
            Object value = wrapper.get();
            if (value != null && type != null && !type.isInstance(value)) {
                throw new IllegalStateException("Cached value is not of required type " + type.getName());
            }
            return type == null ? (T) value : type.cast(value);
        }

        @Override
        @Nullable
        public <T> T get(Object key, Callable<T> valueLoader) {
            ValueWrapper wrapper = get(key);
            if (wrapper != null) {
                return (T) wrapper.get();
            }
            synchronized (values) {
                wrapper = get(key);
                if (wrapper != null) {
                    return (T) wrapper.get();
                }
                try {
                    T value = valueLoader.call();
                    put(key, value);
                    return value;
                } catch (Exception ex) {
                    throw new ValueRetrievalException(key, valueLoader, ex);
                }
            }
        }

        @Override
        public void put(Object key, @Nullable Object value) {
            values.put(key, new ExpiringValue(value, System.currentTimeMillis() + ttlMillis));
        }

        @Override
        @Nullable
        public ValueWrapper putIfAbsent(Object key, @Nullable Object value) {
            ExpiringValue candidate = new ExpiringValue(value, System.currentTimeMillis() + ttlMillis);
            ExpiringValue existing = values.putIfAbsent(key, candidate);
            if (existing == null || existing.isExpired(System.currentTimeMillis())) {
                if (existing != null) {
                    values.replace(key, existing, candidate);
                }
                return null;
            }
            return () -> existing.value;
        }

        @Override
        public void evict(Object key) {
            values.remove(key);
        }

        @Override
        public boolean evictIfPresent(Object key) {
            return values.remove(key) != null;
        }

        @Override
        public void clear() {
            values.clear();
        }

        @Override
        public boolean invalidate() {
            boolean hadEntries = !values.isEmpty();
            values.clear();
            return hadEntries;
        }
    }

    private static class ExpiringValue {
        @Nullable
        private final Object value;
        private final long expiresAtMillis;

        private ExpiringValue(@Nullable Object value, long expiresAtMillis) {
            this.value = value;
            this.expiresAtMillis = expiresAtMillis;
        }

        private boolean isExpired(long now) {
            return now >= expiresAtMillis;
        }
    }
}
