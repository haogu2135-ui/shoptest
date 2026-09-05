import type { AxiosResponse } from 'axios';
import { cachedGet, cachedTypedGet, clearTimedCacheMap, trimMapToSize } from './cache';

const response = <T,>(data: T) => ({ data } as AxiosResponse<T>);

describe('api cache request ownership', () => {
  it('does not let a bypass request overwrite a shared pending request', async () => {
    const cache = new Map<string, { expiresAt: number; response: AxiosResponse<string> }>();
    const requests = new Map<string, Promise<AxiosResponse<string>>>();
    let resolveShared!: (value: AxiosResponse<string>) => void;
    let resolveBypass!: (value: AxiosResponse<string>) => void;
    const shared = cachedGet(cache, requests, 'catalog', 1000, () => new Promise((resolve) => { resolveShared = resolve; }));
    const bypass = cachedGet(cache, requests, 'catalog', 1000, () => new Promise((resolve) => { resolveBypass = resolve; }), { bypassCache: true });

    expect(requests.get('catalog')).toBe(shared);
    resolveBypass(response('fresh'));
    await expect(bypass).resolves.toEqual(response('fresh'));
    expect(requests.get('catalog')).toBe(shared);

    resolveShared(response('shared'));
    await expect(shared).resolves.toEqual(response('shared'));
    expect(requests.has('catalog')).toBe(false);
  });

  it('keeps typed bypass requests independent from the request registry', async () => {
    const cache = new Map<number, { expiresAt: number; response: AxiosResponse<number> }>();
    const requests = new Map<number, Promise<AxiosResponse<number>>>();
    const shared = cachedTypedGet(cache, requests, 7, () => Promise.resolve(response(7)));
    await expect(shared).resolves.toEqual(response(7));
    expect(cache.has(7)).toBe(false);

    const bypass = cachedTypedGet(cache, requests, 7, () => Promise.resolve(response(8)), { bypassCache: true });
    await expect(bypass).resolves.toEqual(response(8));
    expect(requests.has(7)).toBe(false);
  });

  it('does not populate the cache from a bypass request', async () => {
    const cache = new Map<string, { expiresAt: number; response: AxiosResponse<string> }>();
    const requests = new Map<string, Promise<AxiosResponse<string>>>();

    await cachedGet(cache, requests, 'catalog', 1000, () => Promise.resolve(response('fresh')), { bypassCache: true });

    expect(cache.has('catalog')).toBe(false);
    expect(requests.has('catalog')).toBe(false);
  });

  it('does not let a cleared request repopulate the cache after it settles', async () => {
    const cache = new Map<string, { expiresAt: number; response: AxiosResponse<string> }>();
    const requests = new Map<string, Promise<AxiosResponse<string>>>();
    let resolveLoader!: (value: AxiosResponse<string>) => void;
    const request = cachedGet(cache, requests, 'catalog', 1000, () => new Promise((resolve) => {
      resolveLoader = resolve;
    }));

    clearTimedCacheMap(cache);
    clearTimedCacheMap(requests);
    resolveLoader(response('stale'));
    await expect(request).resolves.toEqual(response('stale'));

    expect(cache.has('catalog')).toBe(false);
  });

  it('treats invalid map limits as zero and keeps valid fractional limits bounded', () => {
    const map = new Map([[1, 'one'], [2, 'two']]);

    trimMapToSize(map, -1);
    expect(map.size).toBe(0);

    map.set(1, 'one');
    map.set(2, 'two');
    trimMapToSize(map, 1.8);
    expect(map.size).toBe(0);
  });
});
