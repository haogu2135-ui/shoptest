import type { AxiosResponse } from 'axios';

export const MAX_API_CACHE_ENTRIES = 80;
export const MAX_API_REQUEST_ENTRIES = 80;

type CacheOptions = {
    bypassCache?: boolean;
    signal?: AbortSignal;
};

type TimedCacheMap = Map<unknown, { expiresAt: number }>;
const timedCacheMaps = new Set<TimedCacheMap>();
const timedCacheGenerations = new WeakMap<object, number>();
let timedCacheCleanupTimer: number | null = null;
let timedCacheCleanupDueAt: number | null = null;

const createAbortError = () => {
    if (typeof DOMException === 'function') {
        return new DOMException('The operation was aborted.', 'AbortError');
    }
    const error = new Error('The operation was aborted.');
    error.name = 'AbortError';
    return error;
};

export const withAbortSignal = <T,>(promise: Promise<T>, signal?: AbortSignal) => {
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
    const normalizedMaxEntries = Number.isSafeInteger(maxEntries) && maxEntries >= 0 ? maxEntries : 0;
    while (map.size > normalizedMaxEntries) {
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
    scheduleTimedCacheCleanup();
};

const shouldStartTimedCacheCleanup = () => (
    typeof window !== 'undefined'
    && typeof window.setTimeout === 'function'
    && typeof window.clearTimeout === 'function'
    && !(typeof process !== 'undefined' && process.env?.NODE_ENV === 'test')
);

const scheduleTimedCacheCleanup = () => {
    if (!shouldStartTimedCacheCleanup()) return;
    let nextExpiry: number | null = null;
    timedCacheMaps.forEach((map) => {
        map.forEach((entry) => {
            if (nextExpiry === null || entry.expiresAt < nextExpiry) nextExpiry = entry.expiresAt;
        });
    });
    if (nextExpiry === null) {
        if (timedCacheCleanupTimer !== null) window.clearTimeout(timedCacheCleanupTimer);
        timedCacheCleanupTimer = null;
        timedCacheCleanupDueAt = null;
        return;
    }
    if (timedCacheCleanupTimer !== null && timedCacheCleanupDueAt !== null && timedCacheCleanupDueAt <= nextExpiry) return;
    if (timedCacheCleanupTimer !== null) window.clearTimeout(timedCacheCleanupTimer);
    timedCacheCleanupDueAt = nextExpiry;
    timedCacheCleanupTimer = window.setTimeout(() => {
        timedCacheCleanupTimer = null;
        timedCacheCleanupDueAt = null;
        cleanupExpiredTimedCaches();
    }, Math.max(0, nextExpiry - Date.now()));
};

const registerTimedCacheMap = (map: TimedCacheMap) => {
    timedCacheMaps.add(map);
    scheduleTimedCacheCleanup();
};

export const setTimedCacheEntry = <K, V extends { expiresAt: number }>(map: Map<K, V>, key: K, value: V) => {
    cleanupExpiredTimedCacheEntries(map as TimedCacheMap);
    const expiresAt = Number.isFinite(value.expiresAt) ? value.expiresAt : Date.now();
    map.set(key, { ...value, expiresAt } as V);
    registerTimedCacheMap(map as TimedCacheMap);
    trimMapToSize(map, MAX_API_CACHE_ENTRIES);
};

export const getTimedCacheGeneration = (map: object) => timedCacheGenerations.get(map) || 0;

export const clearTimedCacheMap = <K, V>(map: Map<K, V>) => {
    timedCacheGenerations.set(map, getTimedCacheGeneration(map) + 1);
    map.clear();
    timedCacheMaps.delete(map as TimedCacheMap);
    scheduleTimedCacheCleanup();
};

export const deleteTimedCacheEntry = <K, V>(map: Map<K, V>, key: K) => {
    timedCacheGenerations.set(map, getTimedCacheGeneration(map) + 1);
    map.delete(key);
    if (map.size === 0) timedCacheMaps.delete(map as TimedCacheMap);
    scheduleTimedCacheCleanup();
};

export const isTimedCacheGenerationCurrent = (map: object, generation: number) => (
    getTimedCacheGeneration(map) === generation
);

export const cachedGet = <K, T>(
    cache: Map<K, { expiresAt: number; response: AxiosResponse<T> }>,
    requests: Map<K, Promise<AxiosResponse<T>>>,
    cacheKey: K,
    ttlMs: number,
    loader: () => Promise<AxiosResponse<T>>,
    options?: CacheOptions,
) => {
    if (options?.signal?.aborted) return Promise.reject(createAbortError());
    const shouldTrackRequest = !options?.bypassCache;
    const normalizedTtlMs = Number.isFinite(ttlMs) ? Math.max(0, Math.floor(ttlMs)) : 0;
    const cacheGeneration = getTimedCacheGeneration(cache);
    const cached = cache.get(cacheKey);
    if (!options?.bypassCache && cached && cached.expiresAt > Date.now()) return withAbortSignal(Promise.resolve(cached.response), options?.signal);
    const pending = options?.bypassCache ? undefined : requests.get(cacheKey);
    if (pending) return withAbortSignal(pending, options?.signal);
    const loaded = loader()
        .then((response) => {
            if (shouldTrackRequest && isTimedCacheGenerationCurrent(cache, cacheGeneration)) {
                setTimedCacheEntry(cache, cacheKey, { response, expiresAt: Date.now() + normalizedTtlMs });
            }
            return response;
        });
    let request: Promise<AxiosResponse<T>>;
    request = shouldTrackRequest
        ? loaded.finally(() => {
            if (requests.get(cacheKey) === request) requests.delete(cacheKey);
        })
        : loaded;
    if (shouldTrackRequest) setBoundedMapEntry(requests, cacheKey, request);
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
    const shouldTrackRequest = !options?.bypassCache;
    const cached = cache.get(cacheKey);
    if (!options?.bypassCache && cached && cached.expiresAt > Date.now()) return withAbortSignal(Promise.resolve(cached.response), options?.signal);
    const pending = options?.bypassCache ? undefined : requests.get(cacheKey);
    if (pending) return withAbortSignal(pending, options?.signal);
    const loaded = loader();
    let request: Promise<AxiosResponse<T>>;
    request = shouldTrackRequest
        ? loaded.finally(() => {
            if (requests.get(cacheKey) === request) requests.delete(cacheKey);
        })
        : loaded;
    if (shouldTrackRequest) setBoundedMapEntry(requests, cacheKey, request);
    return withAbortSignal(request, options?.signal);
};
