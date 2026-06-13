import type { AxiosResponse } from 'axios';

export const MAX_API_CACHE_ENTRIES = 80;
export const MAX_API_REQUEST_ENTRIES = 80;
const API_CACHE_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

type CacheOptions = {
    bypassCache?: boolean;
    signal?: AbortSignal;
};

type TimedCacheMap = Map<unknown, { expiresAt: number }>;
const timedCacheMaps = new Set<TimedCacheMap>();
let timedCacheCleanupTimer: number | null = null;

const createAbortError = () => {
    if (typeof DOMException === 'function') {
        return new DOMException('The operation was aborted.', 'AbortError');
    }
    const error = new Error('The operation was aborted.');
    error.name = 'AbortError';
    return error;
};

const withAbortSignal = <T,>(promise: Promise<T>, signal?: AbortSignal) => {
    if (!signal) return promise;
    if (signal.aborted) return Promise.reject(createAbortError());
    return new Promise<T>((resolve, reject) => {
        const handleAbort = () => {
            signal.removeEventListener('abort', handleAbort);
            reject(createAbortError());
        };
        signal.addEventListener('abort', handleAbort, { once: true });
        promise.then(
            (value) => {
                signal.removeEventListener('abort', handleAbort);
                resolve(value);
            },
            (error) => {
                signal.removeEventListener('abort', handleAbort);
                reject(error);
            },
        );
    });
};

export const trimMapToSize = <K, V>(map: Map<K, V>, maxEntries: number) => {
    while (map.size > maxEntries) {
        const oldest = map.keys().next();
        if (oldest.done) break;
        map.delete(oldest.value);
    }
};

export const setBoundedMapEntry = <K, V>(map: Map<K, V>, key: K, value: V, maxEntries = MAX_API_REQUEST_ENTRIES) => {
    map.set(key, value);
    trimMapToSize(map, maxEntries);
};

const cleanupExpiredTimedCacheEntries = (map: TimedCacheMap, now = Date.now()) => {
    map.forEach((entry, entryKey) => {
        if (entry.expiresAt <= now) {
            map.delete(entryKey);
        }
    });
};

const cleanupExpiredTimedCaches = () => {
    const now = Date.now();
    timedCacheMaps.forEach((map) => {
        cleanupExpiredTimedCacheEntries(map, now);
        if (map.size === 0) {
            timedCacheMaps.delete(map);
        }
    });
    if (timedCacheMaps.size === 0 && timedCacheCleanupTimer !== null) {
        window.clearInterval(timedCacheCleanupTimer);
        timedCacheCleanupTimer = null;
    }
};

const shouldStartTimedCacheCleanup = () => (
    typeof window !== 'undefined'
    && typeof window.setInterval === 'function'
    && typeof window.clearInterval === 'function'
    && !(typeof process !== 'undefined' && process.env?.NODE_ENV === 'test')
);

const registerTimedCacheMap = (map: TimedCacheMap) => {
    timedCacheMaps.add(map);
    if (timedCacheCleanupTimer === null && shouldStartTimedCacheCleanup()) {
        timedCacheCleanupTimer = window.setInterval(cleanupExpiredTimedCaches, API_CACHE_CLEANUP_INTERVAL_MS);
    }
};

export const setTimedCacheEntry = <K, V extends { expiresAt: number }>(map: Map<K, V>, key: K, value: V) => {
    cleanupExpiredTimedCacheEntries(map as TimedCacheMap);
    map.set(key, value);
    registerTimedCacheMap(map as TimedCacheMap);
    trimMapToSize(map, MAX_API_CACHE_ENTRIES);
};

export const cachedGet = <T,>(
    cache: Map<string, { expiresAt: number; response: AxiosResponse<T> }>,
    requests: Map<string, Promise<AxiosResponse<T>>>,
    cacheKey: string,
    ttlMs: number,
    loader: () => Promise<AxiosResponse<T>>,
    options?: CacheOptions,
) => {
    if (options?.signal?.aborted) return Promise.reject(createAbortError());
    const cached = cache.get(cacheKey);
    if (!options?.bypassCache && cached && cached.expiresAt > Date.now()) return withAbortSignal(Promise.resolve(cached.response), options?.signal);
    const pending = options?.bypassCache ? undefined : requests.get(cacheKey);
    if (pending) return withAbortSignal(pending, options?.signal);
    const request = loader()
        .then((response) => {
            setTimedCacheEntry(cache, cacheKey, { response, expiresAt: Date.now() + ttlMs });
            return response;
        })
        .finally(() => requests.delete(cacheKey));
    setBoundedMapEntry(requests, cacheKey, request);
    return withAbortSignal(request, options?.signal);
};

export const cachedTypedGet = <K, T>(
    cache: Map<K, { expiresAt: number; response: AxiosResponse<T> }>,
    requests: Map<K, Promise<AxiosResponse<T>>>,
    cacheKey: K,
    loader: () => Promise<AxiosResponse<T>>,
    options?: CacheOptions,
) => {
    if (options?.signal?.aborted) return Promise.reject(createAbortError());
    const cached = cache.get(cacheKey);
    if (!options?.bypassCache && cached && cached.expiresAt > Date.now()) return withAbortSignal(Promise.resolve(cached.response), options?.signal);
    const pending = options?.bypassCache ? undefined : requests.get(cacheKey);
    if (pending) return withAbortSignal(pending, options?.signal);
    const request = loader().finally(() => requests.delete(cacheKey));
    setBoundedMapEntry(requests, cacheKey, request);
    return withAbortSignal(request, options?.signal);
};
