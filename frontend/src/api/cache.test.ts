import type { AxiosResponse } from 'axios';
import { cachedGet, cachedTypedGet } from './cache';

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
});
