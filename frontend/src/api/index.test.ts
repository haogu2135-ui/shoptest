const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPut = jest.fn();
const mockDelete = jest.fn();
const mockRequest = jest.fn();

type MockApiHeaders = Record<string, unknown> & {
  Accept?: unknown;
  Authorization?: unknown;
};

type MockApiRequestConfig = {
  url?: string;
  headers?: MockApiHeaders;
  _authRetry?: boolean;
  [key: string]: unknown;
};

type MockApiError = {
  response?: {
    status?: number;
    data?: unknown;
  };
  config?: MockApiRequestConfig;
  code?: string;
  message?: string;
  [key: string]: unknown;
};

type MockRequestInterceptor = (config: MockApiRequestConfig) => MockApiRequestConfig | Promise<MockApiRequestConfig>;
type MockResponseInterceptor = (response: unknown) => unknown;
type MockResponseErrorInterceptor = (error: MockApiError) => Promise<unknown>;

let mockRequestInterceptorFulfilled: MockRequestInterceptor | undefined;
let mockResponseInterceptorRejected: MockResponseErrorInterceptor | undefined;

export {};

const originalApiBaseUrl = process.env.REACT_APP_API_BASE_URL;
const originalSupportWebSocketUrl = process.env.REACT_APP_SUPPORT_WEBSOCKET_URL;
const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');

const restoreLocalStorage = () => {
  if (originalLocalStorageDescriptor) {
    Object.defineProperty(window, 'localStorage', originalLocalStorageDescriptor);
  }
};

const clearLocalStorage = () => {
  try {
    window.localStorage.clear();
  } catch (error) {
    void error;
  }
};

const base64UrlEncode = (value: string) => window.btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

const createJwt = (expiresAtSeconds: number) => [
  base64UrlEncode(JSON.stringify({ alg: 'none', typ: 'JWT' })),
  base64UrlEncode(JSON.stringify({ exp: expiresAtSeconds })),
  'signature',
].join('.');

const readApiSource = (fileName?: string) => {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  if (fileName) {
    return fs.readFileSync(path.join(__dirname, fileName), 'utf8');
  }
  return ['core.ts', 'storefront.ts', 'admin.ts', 'index.ts']
    .map((name) => fs.readFileSync(path.join(__dirname, name), 'utf8'))
    .join('\n');
};

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: jest.fn((config?: { baseURL?: string }) => ({
      get: mockGet,
      post: mockPost,
      put: mockPut,
      delete: mockDelete,
      request: mockRequest,
      defaults: { baseURL: config?.baseURL || 'https://api.example.com' },
      interceptors: {
        request: {
          use: jest.fn((fulfilled: MockRequestInterceptor) => {
            mockRequestInterceptorFulfilled = fulfilled;
          }),
        },
        response: {
          use: jest.fn((_fulfilled: MockResponseInterceptor, rejected: MockResponseErrorInterceptor) => {
            mockResponseInterceptorRejected = rejected;
          }),
        },
      },
    })),
  },
}));

describe('api parameter normalization', () => {
  beforeAll(() => {
    process.env.REACT_APP_API_BASE_URL = 'https://api.example.com';
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.REACT_APP_API_BASE_URL = 'https://api.example.com';
    delete process.env.REACT_APP_SUPPORT_WEBSOCKET_URL;
    delete window.__SHOP_RUNTIME_CONFIG__;
    restoreLocalStorage();
    clearLocalStorage();
    mockRequestInterceptorFulfilled = undefined;
    mockResponseInterceptorRejected = undefined;
    mockGet.mockResolvedValue({ data: [] });
    mockPost.mockResolvedValue({ data: {} });
    mockPut.mockResolvedValue({ data: {} });
    mockDelete.mockResolvedValue({ data: {} });
    mockRequest.mockResolvedValue({ data: {} });
  });

  afterAll(() => {
    if (originalApiBaseUrl === undefined) {
      delete process.env.REACT_APP_API_BASE_URL;
    } else {
      process.env.REACT_APP_API_BASE_URL = originalApiBaseUrl;
    }
    if (originalSupportWebSocketUrl === undefined) {
      delete process.env.REACT_APP_SUPPORT_WEBSOCKET_URL;
    } else {
      process.env.REACT_APP_SUPPORT_WEBSOCKET_URL = originalSupportWebSocketUrl;
    }
    restoreLocalStorage();
  });

  it('builds support websocket URLs and ticket subprotocols', () => {
    const { supportApi, supportWebSocketProtocols, supportWebSocketUrl } = require('./index');

    expect(supportWebSocketUrl()).toBe('wss://api.example.com/ws/support');
    expect(supportWebSocketProtocols('  ws-ticket-1  ')).toEqual(['support.v1', 'ticket.ws-ticket-1']);
    expect(() => supportWebSocketProtocols('   ')).toThrow('Support websocket ticket is required');
    supportApi.createWebSocketTicket();
    expect(mockPost.mock.calls[0][0]).toBe('/support/websocket-ticket');
    expect(readApiSource()).toContain('ticket.${normalizedTicket}');
    expect(readApiSource()).not.toContain('auth.${encodedToken}');
  });

  it('keeps support websocket on the same-origin ws proxy when API uses the /api proxy', () => {
    jest.resetModules();
    process.env.REACT_APP_API_BASE_URL = '/api';
    delete window.__SHOP_RUNTIME_CONFIG__;

    const { supportWebSocketUrl } = require('./index');

    expect(supportWebSocketUrl()).toBe('ws://localhost/ws/support');
  });

  it('uses explicit runtime support websocket endpoint when provided', () => {
    jest.resetModules();
    process.env.REACT_APP_API_BASE_URL = '/api';
    window.__SHOP_RUNTIME_CONFIG__ = {
      supportWebSocketUrl: 'wss://support.example.com/ws/support/',
    };

    const { supportWebSocketUrl } = require('./index');

    expect(supportWebSocketUrl()).toBe('wss://support.example.com/ws/support');
  });

  it('normalizes email login payloads before sending', async () => {
    const { userApi } = require('./index');

    await userApi.login('  USER\u0000  Name  ', ' secret ');
    await userApi.sendEmailLoginCode('  USER@Example.COM  ');
    await userApi.emailLogin('  USER@Example.COM  ', ' 12a34 567 ');
    await userApi.logout('  refresh-token\n ');
    await userApi.forgotPassword({
      login: '  USER\u0000  Name  ',
      email: '  USER@Example.COM  ',
      code: ' 12a34 567 ',
      newPassword: ' new password ',
    });

    expect(mockPost.mock.calls[0]).toEqual([
      '/auth/login',
      { username: 'USERNAME', password: ' secret ' },
      expect.objectContaining({ skipAuthHeader: true, skipAuthRedirect: true }),
    ]);
    expect(mockPost.mock.calls[1]).toEqual([
      '/auth/email-code',
      { email: 'user@example.com' },
      expect.objectContaining({ skipAuthHeader: true, skipAuthRedirect: true }),
    ]);
    expect(mockPost.mock.calls[2]).toEqual([
      '/auth/email-login',
      { email: 'user@example.com', code: '123456' },
      expect.objectContaining({ skipAuthHeader: true, skipAuthRedirect: true }),
    ]);
    expect(mockPost.mock.calls[3]).toEqual([
      '/auth/logout',
      { refreshToken: 'refresh-token' },
    ]);
    expect(mockPost.mock.calls[4]).toEqual([
      '/auth/forgot-password',
      {
        login: 'USERNAME',
        email: 'user@example.com',
        code: '123456',
        newPassword: ' new password ',
      },
      expect.objectContaining({ skipAuthHeader: true, skipAuthRedirect: true }),
    ]);
  });

  it('rejects overlong password payloads before sending auth requests', () => {
    const { userApi } = require('./index');
    const overlongPassword = 'A'.repeat(129);

    expect(() => userApi.register({ username: 'mia', email: 'mia@example.com', password: overlongPassword })).toThrow('Password is too long');
    expect(() => userApi.login('mia', overlongPassword)).toThrow('Password is too long');
    expect(() => userApi.forgotPassword({
      login: 'mia',
      email: 'mia@example.com',
      code: '123456',
      newPassword: overlongPassword,
    })).toThrow('New password is too long');
    expect(() => userApi.updatePassword(overlongPassword, 'StrongPass123')).toThrow('Current password is too long');
    expect(() => userApi.updatePassword('Oldpass123', overlongPassword)).toThrow('New password is too long');

    expect(mockPost).not.toHaveBeenCalled();
    expect(mockPut).not.toHaveBeenCalled();
  });

  it('keeps module-level API caches bounded and TTL-based', () => {
    const source = readApiSource();
    const cacheSource = readApiSource('cache.ts');

    expect(cacheSource).toContain('export const MAX_API_CACHE_ENTRIES = 80;');
    expect(cacheSource).toContain('export const MAX_API_REQUEST_ENTRIES = 80;');
    expect(cacheSource).toContain('export const setTimedCacheEntry');
    expect(cacheSource).toContain('entry.expiresAt <= now');
    expect(cacheSource).toContain('trimMapToSize(map, MAX_API_CACHE_ENTRIES)');
    expect(cacheSource).toContain('export const setBoundedMapEntry');
    expect(cacheSource).toContain('trimMapToSize(map, maxEntries)');
    expect(cacheSource).toContain('.finally(() => requests.delete(cacheKey))');
    expect(source).toContain('PRODUCT_DETAIL_CACHE_MS = 30_000');
    expect(source).toContain('PERSONALIZED_RECOMMENDATION_CACHE_MS = 45_000');
    expect(source).toContain('ADMIN_ORDER_CACHE_MS = 15_000');
    expect(source).toContain('setTimedCacheEntry(productDetailCache');
    expect(source).toContain('setTimedCacheEntry(personalizedRecommendationCache');
    expect(source).toContain('cachedGet(\n            adminOrderCache,\n            adminOrderRequests,');
    expect(source).toContain('cachedTypedGet(productDetailCache, productDetailRequests');
    expect(source).toContain('setBoundedMapEntry(orderTrackRequests');
  });

  it('reuses typed cache requests when callers pass abort signals', async () => {
    const { cachedTypedGet, setTimedCacheEntry } = require('./cache');
    const cache = new Map<string, { expiresAt: number; response: { data: { ok: boolean } } }>();
    const requests = new Map<string, Promise<{ data: { ok: boolean } }>>();
    const response = { data: { ok: true } };
    let resolveLoader: ((value: { data: { ok: boolean } }) => void) | undefined;
    const loader = jest.fn(() => new Promise<{ data: { ok: boolean } }>((resolve) => {
      resolveLoader = resolve;
    }).then((loadedResponse) => {
      setTimedCacheEntry(cache, 'product:42', {
        response: loadedResponse,
        expiresAt: Date.now() + 1_000,
      });
      return loadedResponse;
    }));
    const firstController = new AbortController();
    const secondController = new AbortController();

    const first = cachedTypedGet(cache, requests, 'product:42', loader, { signal: firstController.signal });
    const second = cachedTypedGet(cache, requests, 'product:42', loader, { signal: secondController.signal });

    expect(loader).toHaveBeenCalledTimes(1);
    resolveLoader!(response);
    await expect(Promise.all([first, second])).resolves.toEqual([response, response]);
    await expect(cachedTypedGet(cache, requests, 'product:42', loader, {
      signal: new AbortController().signal,
    })).resolves.toBe(response);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('keeps product API normalization free of broad any casts', () => {
    const source = readApiSource();
    const typesSource = readApiSource('../types.ts');
    const adminProductPageSource = typesSource.slice(
      typesSource.indexOf('export interface AdminProductPage'),
      typesSource.indexOf('export interface ProductPublic'),
    );
    const publicProductPageSource = typesSource.slice(
      typesSource.indexOf('export interface ProductPublicPage'),
      typesSource.indexOf('export interface ProductBundleConfig'),
    );

    expect(source).toContain('const isRecord = (value: unknown): value is Record<string, unknown>');
    expect(source).toContain('const productDetailResponseFromList = (');
    expect(source).toContain('): AxiosResponse<ProductPublic> => ({');
    expect(source).toContain('response: productDetailResponseFromList(response, product),');
    expect(source).not.toContain('as unknown as AxiosResponse<ProductPublic>');
    expect(source).not.toMatch(/\bany\b/);
    expect(adminProductPageSource).toContain('totalElements?: number;');
    expect(publicProductPageSource).toContain('totalElements?: number;');
  });

  it('refreshes the auth session and retries the original request after a 401', async () => {
    jest.resetModules();
    window.localStorage.setItem('refreshToken', 'refresh-old');
    mockPost.mockResolvedValueOnce({
      data: {
        token: 'access-new',
        refreshToken: 'refresh-new',
        id: 7,
        username: 'mia',
        role: 'ADMIN',
        roleCode: 'SUPER_ADMIN',
      },
    });
    mockRequest.mockResolvedValueOnce({ data: { ok: true } });

    require('./index');

    const originalRequest = { url: '/users/profile', headers: { Accept: 'application/json' } };
    const response = await mockResponseInterceptorRejected!({
      response: { status: 401 },
      config: originalRequest,
    });

    expect(response).toEqual({ data: { ok: true } });
    expect(mockPost).toHaveBeenCalledWith(
      '/auth/refresh',
      { refreshToken: 'refresh-old' },
      expect.objectContaining({ skipAuthRefresh: true }),
    );
    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      url: '/users/profile',
      _authRetry: true,
      headers: expect.objectContaining({
        Accept: 'application/json',
        Authorization: 'Bearer access-new',
      }),
    }));
    expect(window.localStorage.getItem('token')).toBe('access-new');
    expect(window.localStorage.getItem('refreshToken')).toBe('refresh-new');
    expect(window.localStorage.getItem('userId')).toBe('7');
    expect(window.localStorage.getItem('username')).toBe('mia');
    expect(window.localStorage.getItem('email')).toBeNull();
    expect(window.localStorage.getItem('phone')).toBeNull();
    expect(window.localStorage.getItem('role')).toBe('SUPER_ADMIN');
  });

  it('does not treat contact details as part of the auth session response contract', () => {
    const source = readApiSource();
    const authSessionType = source.slice(
      source.indexOf('type AuthSessionResponse = {'),
      source.indexOf('type AuthRetryConfig ='),
    );
    const persistSession = source.slice(
      source.indexOf('export const persistAuthSession = (data: AuthSessionResponse) => {'),
      source.indexOf('const refreshAuthToken = () =>'),
    );

    expect(authSessionType).not.toContain('email?:');
    expect(authSessionType).not.toContain('phone?:');
    expect(persistSession).not.toContain('data.email');
    expect(persistSession).not.toContain('data.phone');
    expect(persistSession).not.toContain("setStoredItem('email'");
    expect(persistSession).not.toContain("setStoredItem('phone'");
  });

  it('retries token refresh once after a transient network failure', async () => {
    const immediateTimer = window.setTimeout(() => undefined, 0);
    window.clearTimeout(immediateTimer);
    const setTimeoutSpy = jest.spyOn(window, 'setTimeout').mockImplementation(((handler: TimerHandler, _timeout?: number, ...args: any[]) => {
      if (typeof handler === 'function') {
        handler(...args);
      }
      return immediateTimer;
    }) as any);
    try {
      jest.resetModules();
      window.localStorage.setItem('refreshToken', 'refresh-old');
      mockPost
        .mockRejectedValueOnce({ code: 'ERR_NETWORK', message: 'Network Error' })
        .mockResolvedValueOnce({
          data: {
            token: 'access-after-retry',
            refreshToken: 'refresh-after-retry',
            id: 7,
            username: 'mia',
            role: 'USER',
          },
        });
      mockRequest.mockResolvedValueOnce({ data: { ok: true } });

      require('./index');

      const originalRequest = { url: '/users/profile', headers: {} };
      const responsePromise = mockResponseInterceptorRejected!({
        response: { status: 401 },
        config: originalRequest,
      });

      await Promise.resolve();
      expect(mockPost).toHaveBeenCalledTimes(1);
      await Promise.resolve();
      await Promise.resolve();

      await expect(responsePromise).resolves.toEqual({ data: { ok: true } });
      expect(mockPost).toHaveBeenCalledTimes(2);
      expect(mockPost.mock.calls.map((call) => call[0])).toEqual(['/auth/refresh', '/auth/refresh']);
      expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
        url: '/users/profile',
        headers: expect.objectContaining({
          Authorization: 'Bearer access-after-retry',
        }),
      }));
      expect(window.localStorage.getItem('token')).toBe('access-after-retry');
      expect(window.localStorage.getItem('refreshToken')).toBe('refresh-after-retry');
    } finally {
      setTimeoutSpy.mockRestore();
    }
  });

  it('does not retry token refresh when the refresh token is rejected', async () => {
    jest.resetModules();
    window.history.pushState({}, '', '/login');
    window.localStorage.setItem('token', 'access-old');
    window.localStorage.setItem('refreshToken', 'refresh-old');
    mockPost.mockRejectedValueOnce({
      response: { status: 401, data: { message: 'refresh expired' } },
    });

    require('./index');

    const error = {
      response: { status: 401 },
      config: { url: '/users/profile', headers: {} },
    };

    await expect(mockResponseInterceptorRejected!(error)).rejects.toBe(error);

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockRequest).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('token')).toBeNull();
    expect(window.localStorage.getItem('refreshToken')).toBeNull();
  });

  it('refreshes an expiring JWT before attaching the authorization header', async () => {
    jest.resetModules();
    window.localStorage.setItem('token', createJwt(Math.floor(Date.now() / 1000) + 5));
    window.localStorage.setItem('refreshToken', 'refresh-before-request');
    mockPost.mockResolvedValueOnce({
      data: {
        token: 'access-refreshed',
        refreshToken: 'refresh-refreshed',
        id: 8,
        username: 'sol',
        role: 'USER',
      },
    });

    require('./index');

    const config = await mockRequestInterceptorFulfilled!({ url: '/cart', headers: {} });

    expect(mockPost).toHaveBeenCalledWith(
      '/auth/refresh',
      { refreshToken: 'refresh-before-request' },
      expect.objectContaining({ skipAuthRefresh: true, skipAuthHeader: true }),
    );
    expect(config.headers).toEqual(expect.objectContaining({
      Authorization: 'Bearer access-refreshed',
    }));
    expect(window.localStorage.getItem('token')).toBe('access-refreshed');
    expect(window.localStorage.getItem('refreshToken')).toBe('refresh-refreshed');
  });

  it('does not attach an expired JWT when refresh fails before a request', async () => {
    jest.resetModules();
    window.localStorage.setItem('token', createJwt(Math.floor(Date.now() / 1000) - 60));
    window.localStorage.setItem('refreshToken', 'refresh-before-request');
    mockPost.mockRejectedValueOnce(new Error('refresh unavailable'));

    require('./index');

    const config = await mockRequestInterceptorFulfilled!({ url: '/cart', headers: {} });

    expect(mockPost).toHaveBeenCalledWith(
      '/auth/refresh',
      { refreshToken: 'refresh-before-request' },
      expect.objectContaining({ skipAuthRefresh: true, skipAuthHeader: true }),
    );
    expect(config.headers?.Authorization).toBeUndefined();
  });

  it('sends Accept-Language from shop-language for storefront locales', async () => {
    const cases: Array<[string | null, string]> = [
      ['zh', 'zh-CN'],
      ['es', 'es-MX'],
      ['en', 'en-US'],
      [null, 'en-US'],
      ['fr', 'en-US'],
    ];

    for (const [language, expected] of cases) {
      jest.resetModules();
      mockRequestInterceptorFulfilled = undefined;
      clearLocalStorage();
      if (language) {
        window.localStorage.setItem('shop-language', language);
      }

      require('./index');

      const config = await mockRequestInterceptorFulfilled!({ url: '/orders', headers: { Accept: 'application/json' } });
      expect(config.headers).toEqual(expect.objectContaining({
        Accept: 'application/json',
        'Accept-Language': expected,
      }));
    }
  });

  it('keeps Accept-Language wiring in the request interceptor source contract', () => {
    const source = readApiSource();
    expect(source).toContain("const SHOP_LANGUAGE_STORAGE_KEY = 'shop-language'");
    expect(source).toContain('const resolveAcceptLanguageHeader');
    expect(source).toContain('const applyAcceptLanguageHeader');
    expect(source).toContain("setHeader.call(headers, 'Accept-Language', acceptLanguage)");
    expect(source).toContain("'Accept-Language': acceptLanguage");
    expect(source).toContain('applyAcceptLanguageHeader(authConfig)');
    expect(source).toContain("return 'zh-CN'");
    expect(source).toContain("return 'es-MX'");
    expect(source).toContain("return 'en-US'");
  });

  it('clears auth storage when a 401 cannot be refreshed', async () => {
    jest.resetModules();
    window.history.pushState({}, '', '/profile?tab=orders#latest');
    window.localStorage.setItem('token', 'access-old');
    window.localStorage.setItem('refreshToken', 'refresh-old');
    window.localStorage.setItem('userId', '7');
    window.localStorage.setItem('email', 'buyer@example.com');
    window.localStorage.setItem('phone', '5550100');
    window.localStorage.setItem('shop-product-view-preferences', JSON.stringify({
      categories: { food: 2 },
      brands: { Acme: 1 },
      tags: { puppy: 1 },
      recent: [5],
      recentEntries: [{ productId: 5, viewedAt: 1 }],
    }));
    window.localStorage.setItem('shop-product-compare', JSON.stringify([5]));
    window.localStorage.setItem('shop-stock-alerts', JSON.stringify([
      { productId: 5, productName: 'Harness', createdAt: '2026-01-01T00:00:00.000Z' },
    ]));
    window.localStorage.setItem('shop-save-for-later', JSON.stringify([
      { id: 10, productId: 5, quantity: 1, productName: 'Harness', price: 12, savedAt: 1 },
    ]));
    window.localStorage.setItem('shop-guest-support-context', JSON.stringify({
      orderNo: 'ORD-1',
      email: 'buyer@example.com',
      savedAt: Date.now(),
    }));
    window.localStorage.setItem('shop-pet-gallery-local-likes', JSON.stringify([3]));
    window.localStorage.setItem('shop-guest-cart', JSON.stringify([{ productId: 99, quantity: 1 }]));
    window.sessionStorage.setItem('checkoutCartItemIds:auth:7', JSON.stringify([22]));
    window.sessionStorage.setItem('checkoutPaymentMethod', 'OXXO');
    window.sessionStorage.setItem('checkoutGuestDraft', JSON.stringify({ email: 'buyer@example.com' }));
    mockPost.mockRejectedValueOnce(new Error('refresh expired'));
    const popstateListener = jest.fn();
    const authRedirectListener = jest.fn();
    window.addEventListener('popstate', popstateListener);
    window.addEventListener('shop:auth-redirect', authRedirectListener);

    try {
      require('./index');

      const error = {
        response: { status: 401 },
        config: { url: '/users/profile', headers: {} },
      };

      await expect(mockResponseInterceptorRejected!(error)).rejects.toBe(error);

      expect(mockPost).toHaveBeenCalledWith(
        '/auth/refresh',
        { refreshToken: 'refresh-old' },
        expect.objectContaining({ skipAuthRefresh: true }),
      );
      expect(mockRequest).not.toHaveBeenCalled();
      expect(window.location.pathname).toBe('/login');
      expect(window.location.search).toBe('?redirect=%2Fprofile%3Ftab%3Dorders%23latest');
      expect(popstateListener).toHaveBeenCalledTimes(1);
      expect(authRedirectListener).toHaveBeenCalledTimes(1);
      expect((authRedirectListener.mock.calls[0][0] as CustomEvent).detail).toEqual({
        to: '/login?redirect=%2Fprofile%3Ftab%3Dorders%23latest',
      });
      expect(window.localStorage.getItem('token')).toBeNull();
      expect(window.localStorage.getItem('refreshToken')).toBeNull();
      expect(window.localStorage.getItem('userId')).toBeNull();
      expect(window.localStorage.getItem('email')).toBeNull();
      expect(window.localStorage.getItem('phone')).toBeNull();
      expect(JSON.parse(window.localStorage.getItem('shop-product-view-preferences') || '{}')).toMatchObject({
        categories: {},
        brands: {},
        tags: {},
        recent: [],
        recentEntries: [],
      });
      expect(window.localStorage.getItem('shop-product-compare')).toBe('[]');
      expect(window.localStorage.getItem('shop-stock-alerts')).toBe('[]');
      expect(window.localStorage.getItem('shop-save-for-later')).toBe('[]');
      expect(window.localStorage.getItem('shop-guest-support-context')).toBeNull();
      expect(window.localStorage.getItem('shop-pet-gallery-local-likes')).toBeNull();
      expect(window.localStorage.getItem('shop-guest-cart')).toBe(JSON.stringify([{ productId: 99, quantity: 1 }]));
      expect(window.sessionStorage.getItem('checkoutCartItemIds:auth:7')).toBeNull();
      expect(window.sessionStorage.getItem('checkoutPaymentMethod')).toBeNull();
      expect(window.sessionStorage.getItem('checkoutGuestDraft')).toBeNull();
    } finally {
      window.removeEventListener('popstate', popstateListener);
      window.removeEventListener('shop:auth-redirect', authRedirectListener);
    }
  });

  it('clears stale auth credentials without clearing local browsing state', () => {
    jest.resetModules();
    window.localStorage.setItem('token', 'access-old');
    window.localStorage.setItem('refreshToken', 'refresh-old');
    window.localStorage.setItem('userId', '7');
    window.localStorage.setItem('email', 'buyer@example.com');
    window.localStorage.setItem('role', 'USER');
    window.localStorage.setItem('adminDefaultPath', '/admin/dashboard');
    const viewPreferences = JSON.stringify({
      categories: { food: 2 },
      brands: { Acme: 1 },
      tags: { puppy: 1 },
      recent: [5],
      recentEntries: [{ productId: 5, viewedAt: 1 }],
    });
    const compareProducts = JSON.stringify([5]);
    const stockAlerts = JSON.stringify([
      { productId: 5, productName: 'Harness', createdAt: '2026-01-01T00:00:00.000Z' },
    ]);
    const savedForLater = JSON.stringify([
      { id: 10, productId: 5, quantity: 1, productName: 'Harness', price: 12, savedAt: 1 },
    ]);
    window.localStorage.setItem('shop-product-view-preferences', viewPreferences);
    window.localStorage.setItem('shop-product-compare', compareProducts);
    window.localStorage.setItem('shop-stock-alerts', stockAlerts);
    window.localStorage.setItem('shop-save-for-later', savedForLater);
    window.sessionStorage.setItem('checkoutGuestDraft', JSON.stringify({ email: 'buyer@example.com' }));
    const authSessionChangedListener = jest.fn();
    window.addEventListener('auth-session-changed', authSessionChangedListener);

    try {
      const { clearStoredAuthCredentials } = require('./index');

      clearStoredAuthCredentials();

      expect(window.localStorage.getItem('token')).toBeNull();
      expect(window.localStorage.getItem('refreshToken')).toBeNull();
      expect(window.localStorage.getItem('userId')).toBeNull();
      expect(window.localStorage.getItem('email')).toBeNull();
      expect(window.localStorage.getItem('role')).toBeNull();
      expect(window.localStorage.getItem('adminDefaultPath')).toBeNull();
      expect(window.localStorage.getItem('shop-product-view-preferences')).toBe(viewPreferences);
      expect(window.localStorage.getItem('shop-product-compare')).toBe(compareProducts);
      expect(window.localStorage.getItem('shop-stock-alerts')).toBe(stockAlerts);
      expect(window.localStorage.getItem('shop-save-for-later')).toBe(savedForLater);
      expect(window.sessionStorage.getItem('checkoutGuestDraft')).toBe(JSON.stringify({ email: 'buyer@example.com' }));
      expect(authSessionChangedListener).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener('auth-session-changed', authSessionChangedListener);
    }
  });

  it('keeps auth interceptor login redirects inside the SPA', () => {
    const source = readApiSource();
    const redirectBlock = source.slice(source.indexOf('const redirectToLogin = () => {'), source.indexOf('export const persistAuthSession'));

    expect(redirectBlock).toContain('window.history.replaceState');
    expect(redirectBlock).toContain("window.dispatchEvent(new PopStateEvent('popstate'");
    expect(redirectBlock).toContain("dispatchDomEvent('shop:auth-redirect'");
    expect(redirectBlock).not.toContain('window.location.href');
  });

  it('deduplicates concurrent profile requests while preserving startup auth options', async () => {
    jest.resetModules();
    const profileResponse = { data: { id: 7, username: 'mia' } };
    let resolveProfile: (value: typeof profileResponse) => void = () => undefined;
    mockGet.mockReturnValueOnce(new Promise((resolve) => {
      resolveProfile = resolve;
    }));

    const { userApi } = require('./index');

    const firstProfile = userApi.getProfile({ skipAuthRedirect: true });
    const secondProfile = userApi.getProfile({ skipAuthRedirect: true });

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet.mock.calls[0]).toEqual([
      '/users/profile',
      expect.objectContaining({ skipAuthRedirect: true }),
    ]);

    resolveProfile(profileResponse);

    await expect(firstProfile).resolves.toBe(profileResponse);
    await expect(secondProfile).resolves.toBe(profileResponse);

    mockGet.mockResolvedValueOnce({ data: { id: 8, username: 'sol' } });
    await userApi.getProfile({ skipAuthRedirect: true });

    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('passes abort signals through uncached admin permission checks', async () => {
    jest.resetModules();
    const firstController = new AbortController();
    const secondController = new AbortController();
    mockGet
      .mockResolvedValueOnce({ data: { permissions: ['dashboard'] } })
      .mockResolvedValueOnce({ data: { permissions: ['orders'] } });

    const { adminApi } = require('./admin');

    await adminApi.getMyPermissions({ bypassCache: true, signal: firstController.signal });
    await adminApi.getMyPermissions({ signal: secondController.signal });

    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(mockGet.mock.calls[0]).toEqual([
      '/admin/me/permissions',
      expect.objectContaining({ signal: firstController.signal }),
    ]);
    expect(mockGet.mock.calls[1]).toEqual([
      '/admin/me/permissions',
      expect.objectContaining({ signal: secondController.signal }),
    ]);
  });

  it('sends only normalized contact fields when updating a profile', async () => {
    const { userApi } = require('./index');

    await userApi.updateProfile({
      email: '  USER@Example.COM  ',
      phone: '  555\t0100  ext-too-long  ',
      emailCode: ' 12a34 567 ',
      role: 'ADMIN',
      status: 'BANNED',
    });

    expect(mockPut.mock.calls[0]).toEqual([
      '/users/profile',
      {
        email: 'user@example.com',
        phone: '5550100',
        emailCode: '123456',
      },
    ]);
  });

  it('keeps cached API helpers usable when browser storage is unavailable', async () => {
    const originalStorage = window.localStorage;
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: jest.fn(() => {
          throw new Error('storage unavailable');
        }),
        removeItem: jest.fn(() => {
          throw new Error('storage unavailable');
        }),
      },
    });

    try {
      const { productApi, notificationApi, petProfileApi } = require('./index');

      await productApi.getPersonalizedRecommendations();
      await notificationApi.getByUser();
      await notificationApi.getUnreadCount();
      await petProfileApi.getMine();

      expect(mockGet.mock.calls.map((call) => call[0])).toEqual([
        '/products/personalized-recommendations',
        '/notifications/me',
        '/notifications/me/unread-count',
        '/pet-profiles',
      ]);
      expect(mockGet.mock.calls[1][1]).toEqual({ params: { page: 1, size: 50 } });
    } finally {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        value: originalStorage,
      });
    }
  });

  it('filters product id lists to safe positive integers', async () => {
    const { productApi } = require('./index');

    await productApi.getByIds([1, '2', 2.5, -3, Number.MAX_SAFE_INTEGER + 1, 1] as unknown as number[]);

    const params = mockGet.mock.calls[0][1].params as URLSearchParams;
    expect(mockGet.mock.calls[0][0]).toBe('/products/by-ids');
    expect(params.getAll('ids')).toEqual(['1', '2']);
  });

  it('normalizes product list query params before caching and requesting', async () => {
    const { productApi } = require('./index');

    await productApi.getAll('  leash\u0000   kit  ', -2, true, { includeChildren: false });

    expect(mockGet.mock.calls[0][0]).toBe('/products');
    const params = mockGet.mock.calls[0][1].params as URLSearchParams;
    expect(params.get('keyword')).toBe('leash kit');
    expect(params.get('discount')).toBe('true');
    expect(params.has('categoryId')).toBe(false);
    expect(params.get('includeChildren')).toBe('false');
    expect(mockGet.mock.calls[0][1]).toEqual(expect.objectContaining({
      skipAuthHeader: true,
      skipAuthRedirect: true,
    }));
  });

  it('passes exact product category scope through page requests', async () => {
    const { productApi } = require('./index');

    await productApi.getPage(undefined, 7, undefined, { includeChildren: false, page: 0, size: 12 });

    expect(mockGet.mock.calls[0][0]).toBe('/products');
    const params = mockGet.mock.calls[0][1].params as URLSearchParams;
    expect(params.get('categoryId')).toBe('7');
    expect(params.get('includeChildren')).toBe('false');
    expect(params.get('page')).toBe('0');
    expect(params.get('size')).toBe('12');
  });

  it('reuses cached product id list responses for repeated normalized requests', async () => {
    const { productApi } = require('./index');

    mockGet.mockResolvedValueOnce({ data: [{ id: 21, name: 'Harness' }] });
    await productApi.getByIds([21, 22, 21]);
    await productApi.getByIds([21, 22, 21]);

    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('scopes personalized recommendation cache to the active auth session', async () => {
    const { productApi } = require('./index');

    window.localStorage.setItem('userId', '101');
    window.localStorage.setItem('token', 'token-user-101');
    mockGet.mockResolvedValueOnce({ data: [{ id: 31, name: 'User 101 pick' }] });
    await productApi.getPersonalizedRecommendations();
    await productApi.getPersonalizedRecommendations();

    window.localStorage.setItem('userId', '202');
    window.localStorage.setItem('token', 'token-user-202');
    mockGet.mockResolvedValueOnce({ data: [{ id: 42, name: 'User 202 pick' }] });
    await productApi.getPersonalizedRecommendations();

    expect(mockGet.mock.calls.map((call) => call[0])).toEqual([
      '/products/personalized-recommendations',
      '/products/personalized-recommendations',
    ]);
  });

  it('rejects invalid product detail ids before making a request', async () => {
    const { productApi } = require('./index');

    await expect(productApi.getById(Number.NaN)).rejects.toThrow('Invalid product id');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('normalizes add-on candidate query params', async () => {
    const { productApi } = require('./index');

    await productApi.getAddOnCandidates(Infinity, [1, 1.5, 2, -5], 12.8);

    const params = mockGet.mock.calls[0][1].params as URLSearchParams;
    expect(params.get('targetAmount')).toBe('0');
    expect(params.get('limit')).toBe('8');
    expect(params.getAll('excludedIds')).toEqual(['1', '2']);
  });

  it('normalizes cart mutation params', async () => {
    const { cartApi } = require('./index');

    await cartApi.addItem(0, 8, Number.NaN, '  Size=S   Color=Blue  ');
    await cartApi.removeItems([1, '2', 2, 3.4, -1] as unknown as number[]);

    expect(mockPost.mock.calls[0][2].params).toEqual({
      productId: 8,
      quantity: 1,
      selectedSpecs: 'Size=S Color=Blue',
    });
    expect((mockDelete.mock.calls[0][1].params as URLSearchParams).getAll('cartItemIds')).toEqual(['1', '2']);
  });

  it('coalesces identical in-flight cart mutations from rapid repeated clicks', async () => {
    const { cartApi } = require('./index');
    let resolveAdd: (value: unknown) => void = () => undefined;
    const response = { data: { ok: true } };
    mockPost.mockReturnValueOnce(new Promise((resolve) => {
      resolveAdd = resolve;
    }));

    const first = cartApi.addItem(0, 8, 2, 'Size=S');
    const second = cartApi.addItem(0, 8, 2, 'Size=S');

    expect(mockPost).toHaveBeenCalledTimes(1);
    resolveAdd(response);
    const [firstResponse, secondResponse] = await Promise.all([first, second]);
    expect(firstResponse).toBe(response);
    expect(secondResponse).toBe(response);

    mockPost.mockResolvedValueOnce({ data: { ok: true, retry: true } });
    await cartApi.addItem(0, 8, 2, 'Size=S');
    expect(mockPost).toHaveBeenCalledTimes(2);
  });

  it('keeps different in-flight mutation payloads independent', async () => {
    const { cartApi } = require('./index');
    const resolvers: Array<(value: unknown) => void> = [];
    mockPost.mockImplementation(() => new Promise((resolve) => {
      resolvers.push(resolve);
    }));

    const first = cartApi.addItem(0, 8, 2, 'Size=S');
    const second = cartApi.addItem(0, 8, 3, 'Size=S');

    expect(mockPost).toHaveBeenCalledTimes(2);
    resolvers[0]({ data: { quantity: 2 } });
    resolvers[1]({ data: { quantity: 3 } });
    const [firstResponse, secondResponse] = await Promise.all([first, second]);
    expect(firstResponse.data).toEqual({ quantity: 2 });
    expect(secondResponse.data).toEqual({ quantity: 3 });
  });

  it('normalizes coupon quote payloads', async () => {
    const { couponApi } = require('./index');

    await couponApi.quote({ cartItemIds: [4, 4, 5.5, -2], userCouponId: 9.1 });

    expect(mockPost.mock.calls[0][1]).toEqual({ cartItemIds: [4], userCouponId: null });
  });

  it('caches coupon lists until a claim invalidates them', async () => {
    const { couponApi } = require('./index');

    await couponApi.getPublic();
    await couponApi.getPublic();
    await couponApi.getAvailableByUser(0);
    await couponApi.getAvailableByUser(0);
    await couponApi.claim(5, 0);
    await couponApi.getPublic();

    expect(mockGet.mock.calls.map((call) => call[0])).toEqual([
      '/coupons/public',
      '/coupons/me/available',
      '/coupons/public',
    ]);
    expect(mockGet.mock.calls[0][1]).toEqual(expect.objectContaining({ skipAuthHeader: true, skipAuthRedirect: true }));
    expect(mockGet.mock.calls[2][1]).toEqual(expect.objectContaining({ skipAuthHeader: true, skipAuthRedirect: true }));
  });

  it('normalizes payment payloads and guest emails', async () => {
    const { paymentApi } = require('./index');

    await paymentApi.create(7, ' stripe ', ' USER@Example.COM ', ' so202605260001 ');
    await paymentApi.getByOrder(7, 'bad-email', ' so202605260001 ');
    await paymentApi.getByOrder(7, ' USER@Example.COM ', ' so202605260001 ');
    await paymentApi.sync(7, ' USER@Example.COM ', ' so202605260001 ');
    await paymentApi.syncByOrder(7);

    expect(mockPost.mock.calls[0][1]).toEqual({ orderId: 7, channel: 'STRIPE', guestEmail: 'user@example.com', orderNo: 'SO202605260001' });
    expect(mockGet.mock.calls[0][0]).toBe('/payments/order/7');
    expect(mockGet.mock.calls[0][1]).toEqual({ params: undefined });
    expect(mockPost.mock.calls[1][0]).toBe('/payments/guest/order/7');
    expect(mockPost.mock.calls[1][1]).toEqual({ guestEmail: 'user@example.com', orderNo: 'SO202605260001' });
    expect(mockPost.mock.calls[1][2]).toEqual(expect.objectContaining({
      skipAuthHeader: true,
      skipAuthRedirect: true,
    }));
    expect(mockPost.mock.calls[2][0]).toBe('/payments/7/sync');
    expect(mockPost.mock.calls[2][1]).toEqual({ guestEmail: 'user@example.com', orderNo: 'SO202605260001' });
    expect(mockPost.mock.calls[2][2]).toEqual(expect.objectContaining({
      skipAuthHeader: true,
      skipAuthRedirect: true,
    }));
    expect(mockPost.mock.calls[3][0]).toBe('/payments/order/7/sync');
    expect(mockPost.mock.calls[3][1]).toEqual({});
  });

  it('covers payment info, latest, simulation, callback, and admin payment routes', async () => {
    const { paymentApi } = require('./index');
const { adminApi } = require('./admin');
    const callbackPayload = {
      orderNo: 'SO202605260001',
      channel: 'STRIPE',
      transactionId: 'txn-1',
      status: 'PAID',
      amount: 25,
      callbackTimestamp: 1716710400000,
      signature: 'sig',
    };

    await paymentApi.getInfo();
    await paymentApi.getLatestByOrder(7);
    await paymentApi.getLatestByOrder(7, ' USER@Example.COM ', ' so202605260001 ');
    await paymentApi.simulatePaid('8' as unknown as number);
    await paymentApi.simulateCallback('9' as unknown as number);
    await paymentApi.callback(callbackPayload);
    await adminApi.getOrderPayments('7' as unknown as number);
    await adminApi.syncOrderPayment('8' as unknown as number);

    expect(mockGet.mock.calls[0]).toEqual([
      '/payments',
      expect.objectContaining({ skipAuthHeader: true, skipAuthRedirect: true }),
    ]);
    expect(mockGet.mock.calls[1]).toEqual([
      '/payments/order/7/latest',
      { params: undefined },
    ]);
    expect(mockPost.mock.calls[0]).toEqual([
      '/payments/guest/order/7/latest',
      { guestEmail: 'user@example.com', orderNo: 'SO202605260001' },
      expect.objectContaining({
        skipAuthHeader: true,
        skipAuthRedirect: true,
      }),
    ]);
    expect(mockGet.mock.calls[2][0]).toBe('/admin/orders/7/payments');
    expect(mockPost.mock.calls[1][0]).toBe('/payments/8/simulate-paid');
    expect(mockPost.mock.calls[2][0]).toBe('/payments/9/simulate-callback');
    expect(mockPost.mock.calls[3]).toEqual(['/payments/callback', callbackPayload]);
    expect(mockPost.mock.calls[4][0]).toBe('/admin/orders/payments/8/sync');
  });

  it('uses anonymous configs for public storefront bootstrap endpoints', async () => {
    const { appConfigApi, announcementApi } = require('./index');

    await appConfigApi.get();
    await announcementApi.getActive(999);

    expect(mockGet.mock.calls[0]).toEqual([
      '/app/config',
      expect.objectContaining({ skipAuthHeader: true, skipAuthRedirect: true }),
    ]);
    expect(mockGet.mock.calls[1]).toEqual([
      '/announcements/active',
      expect.objectContaining({
        params: { limit: 10 },
        skipAuthHeader: true,
        skipAuthRedirect: true,
      }),
    ]);
  });

  it('caches active announcements until admin announcement mutations', async () => {
    const { announcementApi } = require('./index');
const { adminApi } = require('./admin');

    await announcementApi.getActive(8);
    await announcementApi.getActive(8);
    await adminApi.updateAnnouncement(3, { title: 'Sale', content: 'Details' });
    await announcementApi.getActive(8);

    expect(mockGet.mock.calls.map((call) => call[0])).toEqual([
      '/announcements/active',
      '/announcements/active',
    ]);
    expect(mockGet.mock.calls[0][1]).toEqual(expect.objectContaining({
      params: { limit: 8 },
      skipAuthHeader: true,
      skipAuthRedirect: true,
    }));
    expect(mockPut.mock.calls[0][0]).toBe('/admin/announcements/3');
  });

  it('caches payment channels for repeated checkout renders', async () => {
    const { paymentApi } = require('./index');

    await paymentApi.getChannels();
    await paymentApi.getChannels();

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet.mock.calls[0][0]).toBe('/payments/channels');
    expect(mockGet.mock.calls[0][1]).toEqual(expect.objectContaining({
      skipAuthHeader: true,
      skipAuthRedirect: true,
    }));
  });

  it('unwraps paged payment channel response envelopes before caching', async () => {
    jest.resetModules();
    mockGet.mockResolvedValueOnce({
      data: {
        data: {
          items: [{ code: 'STRIPE', displayName: 'Stripe' }],
        },
      },
    });
    const { paymentApi } = require('./index');

    const response = await paymentApi.getChannels();

    expect(response.data).toEqual([{ code: 'STRIPE', displayName: 'Stripe' }]);
    expect(mockGet).toHaveBeenCalledWith('/payments/channels', expect.objectContaining({
      skipAuthHeader: true,
      skipAuthRedirect: true,
    }));
  });

  it('unwraps direct payment channel item envelopes before caching', async () => {
    jest.resetModules();
    mockGet.mockResolvedValueOnce({
      data: {
        items: [{ code: 'PAYPAL', displayName: 'PayPal' }],
      },
    });
    const { paymentApi } = require('./index');

    const response = await paymentApi.getChannels();

    expect(response.data).toEqual([{ code: 'PAYPAL', displayName: 'PayPal' }]);
  });

  it('normalizes support session path params and optional session payloads', async () => {
    const { supportApi } = require('./index');
const { adminSupportApi } = require('./admin');

    await supportApi.createSession();
    await supportApi.getMessages('9' as unknown as number);
    await supportApi.markRead('11' as unknown as number);
    await supportApi.sendMessage('hello', -4);
    await adminSupportApi.reopenSession(12);
    await adminSupportApi.sendMessage(8, 'reply');

    expect(mockPost.mock.calls[0][0]).toBe('/support/session');
    expect(mockGet.mock.calls[0][0]).toBe('/support/sessions/9/messages');
    expect(mockPut.mock.calls[0][0]).toBe('/support/sessions/11/read');
    expect(mockPost.mock.calls[1][0]).toBe('/support/messages');
    expect(mockPost.mock.calls[1][1]).toEqual({ content: 'hello', sessionId: undefined });
    expect(mockPut.mock.calls[1][0]).toBe('/admin/support/sessions/12/reopen');
    expect(mockPost.mock.calls[2][0]).toBe('/admin/support/sessions/8/messages');
  });

  it('normalizes support message content before REST sends', async () => {
    const { supportApi } = require('./index');
const { adminSupportApi } = require('./admin');

    await supportApi.sendMessage('  hello\u0000   there\r\nline\t two  ', 12);
    await supportApi.sendGuestMessage('  guest\u0007   text\r\nnext\t line  ', ' so-42 ', ' GUEST@Example.COM ', 15);
    await adminSupportApi.sendMessage(8, '  admin\u0000   reply  ');

    expect(mockPost.mock.calls[0]).toEqual([
      '/support/messages',
      { content: 'hello there\nline two', sessionId: 12 },
    ]);
    expect(mockPost.mock.calls[1]).toEqual([
      '/support/guest/messages',
      {
        content: 'guest text\nnext line',
        sessionId: 15,
        orderNo: 'SO-42',
        guestEmail: 'guest@example.com',
      },
      expect.objectContaining({ skipAuthHeader: true, skipAuthRedirect: true }),
    ]);
    expect(mockPost.mock.calls[2]).toEqual([
      '/admin/support/sessions/8/messages',
      { content: 'admin reply' },
    ]);
    const source = readApiSource();
    expect(source).toContain('const normalizeSupportMessageContent = (value: unknown)');
    expect(source).toContain('content: normalizeSupportMessageContent(content)');
    expect(source).not.toContain("content: String(content || '').slice(0, 4000)");
  });

  it('requests admin support summary for queue health panels', async () => {
    const { adminSupportApi } = require('./admin');

    await adminSupportApi.getSummary();

    expect(mockGet.mock.calls[0][0]).toBe('/admin/support/summary');
  });

  it('strips internal support session context keys from admin session pages', async () => {
    const { adminSupportApi } = require('./admin');
    mockGet.mockResolvedValueOnce({
      data: {
        items: [{
          id: 55,
          userId: 42,
          username: 'Guest Buyer',
          contextKey: 'guest-order:so202606030001',
          status: 'OPEN',
          unreadByAdmin: 2,
        }],
        total: 1,
        page: 1,
        size: 20,
        totalPages: 1,
      },
    });

    const response = await adminSupportApi.getSessions({ status: 'OPEN' });

    expect(response.data.items[0]).toEqual(expect.objectContaining({
      id: 55,
      userId: 42,
      username: 'Guest Buyer',
      status: 'OPEN',
      unreadByAdmin: 2,
    }));
    expect(response.data.items[0]).not.toHaveProperty('contextKey');
  });

  it('normalizes product path params and short-circuits invalid recommendation requests', async () => {
    const { productApi } = require('./index');

    await productApi.update(2, { name: 'valid id' });
    await productApi.delete('4' as unknown as number);
    await productApi.getRecommendations(Number.NaN);

    expect(mockPut.mock.calls[0][0]).toBe('/products/2');
    expect(mockDelete.mock.calls[0][0]).toBe('/products/4');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('does not cache lightweight product list items as detail responses', async () => {
    const { productApi } = require('./index');
    mockGet
      .mockResolvedValueOnce({
        data: {
          items: [{ id: 12, name: 'Harness', price: 19.99, detailContent: undefined }],
          total: 1,
          page: 0,
          size: 12,
          totalPages: 1,
        },
      })
      .mockResolvedValueOnce({
        data: { id: 12, name: 'Harness', price: 19.99, detailContent: [{ type: 'text', content: 'Fit notes' }] },
      });

    await productApi.getPage(undefined, undefined, undefined, { page: 0, size: 12 });
    const detail = await productApi.getById(12);

    expect(mockGet.mock.calls.map((call) => call[0])).toEqual(['/products', '/products/12']);
    expect(detail.data.detailContent).toEqual([{ type: 'text', content: 'Fit notes' }]);
  });

  it('normalizes product page totalElements metadata and rich list fields', async () => {
    const { productApi } = require('./index');
const { adminApi } = require('./admin');
    mockGet
      .mockResolvedValueOnce({
        data: {
          content: [{
            id: 31,
            name: 'Travel harness',
            imageUrl: '',
            images: '["/uploads/products/harness-1.jpg","/uploads/products/harness-2.jpg"]',
            specifications: '{"material":"nylon"}',
            detailContent: '[{"type":"text","content":"Fit notes"}]',
            variants: '[{"sku":"HARNESS-S"}]',
            optionGroups: '[{"name":"Size","options":["S","M"]}]',
          }],
          totalElements: 42,
          page: 1,
          size: 12,
        },
      })
      .mockResolvedValueOnce({
        data: {
          items: [{ id: 44, name: 'Admin harness', imageUrl: '/uploads/products/admin-harness.jpg' }],
          totalElements: 7,
          page: 0,
          size: 20,
        },
      });

    const publicPage = await productApi.getPage('f962-total-elements', undefined, undefined, { page: 1, size: 12 });
    const adminPage = await adminApi.getProducts({ keyword: 'f962-total-elements', page: 0, size: 20 });

    expect(publicPage.data.total).toBe(42);
    expect(publicPage.data.totalElements).toBe(42);
    expect(publicPage.data.totalPages).toBe(4);
    expect(publicPage.data.items[0].images).toEqual(['/uploads/products/harness-1.jpg', '/uploads/products/harness-2.jpg']);
    expect(publicPage.data.items[0].specifications).toEqual({ material: 'nylon' });
    expect(publicPage.data.items[0].detailContent).toEqual([{ type: 'text', content: 'Fit notes' }]);
    expect(publicPage.data.items[0].variants).toEqual([{ sku: 'HARNESS-S' }]);
    expect(publicPage.data.items[0].optionGroups).toEqual([{ name: 'Size', values: ['S', 'M'], options: ['S', 'M'] }]);
    expect(adminPage.data.total).toBe(7);
    expect(adminPage.data.totalElements).toBe(7);
    expect(adminPage.data.totalPages).toBe(1);
  });

  it('normalizes product rich-detail media URLs to the backend media contract', async () => {
    const { adminApi } = require('./admin');

    await adminApi.createProduct({
      name: 'Harness',
      detailContent: [
        { type: 'text', content: '  Fit notes  ' },
        { type: 'image', url: '/uploads/products/harness.jpg', caption: ' Detail ' },
        { type: 'video', url: 'https://cdn.example.com/videos/demo.mp4' },
        { type: 'image', url: 'uploads/products/relative.jpg' },
        { type: 'image', url: '/assets/products/preview-only.jpg' },
        { type: 'image', url: 'http://localhost/local.jpg' },
        { type: 'image', url: 'https://192.168.1.10/private.jpg' },
        { type: 'image', url: 'https://[::ffff:192.168.1.10]/mapped-private.jpg' },
        { type: 'image', url: 'https://cdn.example.com:8443/private-port.jpg' },
      ],
    });

    expect(mockPost.mock.calls[0][0]).toBe('/admin/products');
    const detailContent = mockPost.mock.calls[0][1].detailContent;
    expect(detailContent).toHaveLength(4);
    expect(detailContent[0]).toEqual(expect.objectContaining({ type: 'text', content: 'Fit notes' }));
    expect(detailContent[1]).toEqual(expect.objectContaining({ type: 'image', url: '/uploads/products/harness.jpg', caption: 'Detail' }));
    expect(detailContent[2]).toEqual(expect.objectContaining({ type: 'video', url: 'https://cdn.example.com/videos/demo.mp4' }));
    expect(detailContent[3]).toEqual(expect.objectContaining({ type: 'image', url: '/uploads/products/relative.jpg' }));
    expect(JSON.stringify(detailContent)).not.toContain('localhost');
    expect(JSON.stringify(detailContent)).not.toContain('192.168.1.10');
    expect(JSON.stringify(detailContent)).not.toContain('::ffff');
    expect(JSON.stringify(detailContent)).not.toContain(':8443');
    expect(JSON.stringify(detailContent)).not.toContain('/assets/');
  });

  it('keeps admin product search unified on keyword instead of the legacy q alias', async () => {
    const { adminApi } = require('./admin');
    const source = readApiSource();

    await adminApi.getProducts({
      keyword: '  harness\u0000   kit  ',
      categoryId: 7,
      status: ' active ',
      page: 0,
      size: 20,
    });

    expect(mockGet.mock.calls[0][0]).toBe('/admin/products');
    expect(mockGet.mock.calls[0][1]).toEqual({
      params: {
        keyword: 'harness kit',
        categoryId: 7,
        status: 'ACTIVE',
        featured: undefined,
        discount: undefined,
        minPrice: undefined,
        maxPrice: undefined,
        page: 0,
        size: 20,
        sort: undefined,
      },
    });
    expect(source).toContain('getProducts: (params?: { keyword?: string; categoryId?: number;');
    expect(source).not.toContain('q?: string');
    expect(source).not.toContain('q: normalizeTextParam(params.q');
  });

  it('keeps admin product descriptions aligned to the backend entity limit', async () => {
    const { adminApi } = require('./admin');

    await adminApi.createProduct({
      name: 'Harness',
      description: 'x'.repeat(1200),
    });

    expect(mockPost.mock.calls[0][0]).toBe('/admin/products');
    expect(mockPost.mock.calls[0][1].description).toHaveLength(1000);
  });

  it('keeps admin product names aligned to the backend and schema limit', async () => {
    const { adminApi } = require('./admin');
    const source = readApiSource();

    await adminApi.createProduct({
      name: 'x'.repeat(220),
      description: 'Harness',
    });

    expect(mockPost.mock.calls[0][0]).toBe('/admin/products');
    expect(mockPost.mock.calls[0][1].name).toHaveLength(200);
    expect(source).toContain('const PRODUCT_NAME_MAX_LENGTH = 200;');
    expect(source).toContain('normalizeTextParam(value, PRODUCT_NAME_MAX_LENGTH)');
  });

  it('keeps admin product status payloads aligned to the backend entity limit', async () => {
    const { adminApi } = require('./admin');

    await adminApi.createProduct({
      name: 'Harness',
      status: 'custom-status-name-that-is-too-long',
    });
    await adminApi.updateProductStatus(7, 'custom-status-name-that-is-too-long');
    await adminApi.batchUpdateProductStatus([7, 8], 'custom-status-name-that-is-too-long');

    expect(mockPost.mock.calls[0][0]).toBe('/admin/products');
    expect(mockPost.mock.calls[0][1].status).toHaveLength(20);
    expect(mockPut.mock.calls[0][0]).toBe('/admin/products/7/status');
    expect(mockPut.mock.calls[0][1].status).toHaveLength(20);
    expect(mockPost.mock.calls[1][0]).toBe('/admin/products/batch-status');
    expect(mockPost.mock.calls[1][1].status).toHaveLength(20);
  });

  it('keeps admin product imageUrl aligned to the backend entity limit', async () => {
    const { adminApi } = require('./admin');

    await adminApi.createProduct({
      name: 'Harness',
      imageUrl: `https://cdn.example.com/${'p'.repeat(2100)}`,
    });

    expect(mockPost.mock.calls[0][0]).toBe('/admin/products');
    expect(mockPost.mock.calls[0][1].imageUrl).toHaveLength(2000);
  });

  it('normalizes persisted image payload fields to public asset URLs', async () => {
    const { adminApi } = require('./admin');

    await adminApi.createProduct({
      name: 'Harness',
      imageUrl: 'uploads/products/main.jpg',
      images: [
        '/uploads/products/alt.jpg',
        'uploads/products/legacy-alt.jpg',
        'https://cdn.example.com/gallery.jpg',
        'assets/products/local.jpg',
        'data:image/png;base64,abc',
        'blob:https://app.example.com/id',
      ],
      variants: [
        { options: { Size: 'S' }, price: 12, imageUrl: '/uploads/products/variant.jpg' },
        { options: { Size: 'M' }, price: 14, imageUrl: 'https://cdn.example.com/variant.jpg' },
        { options: { Size: 'L' }, price: 16, imageUrl: 'http://localhost/private.jpg' },
      ],
    });
    await adminApi.createCategory({ name: 'Beds', imageUrl: 'data:image/svg+xml,<svg></svg>' });
    await adminApi.createBrand({ name: 'PawCo', logoUrl: 'assets/brand.png' });
    await adminApi.createCategory({ name: 'Legacy beds', imageUrl: 'uploads/categories/beds.png' });
    await adminApi.createBrand({ name: 'Legacy PawCo', logoUrl: 'uploads/brands/pawco.png' });

    expect(mockPost.mock.calls[0][0]).toBe('/admin/products');
    expect(mockPost.mock.calls[0][1].imageUrl).toBe('/uploads/products/main.jpg');
    expect(mockPost.mock.calls[0][1].images).toEqual([
      '/uploads/products/alt.jpg',
      '/uploads/products/legacy-alt.jpg',
      'https://cdn.example.com/gallery.jpg',
    ]);
    expect(mockPost.mock.calls[0][1].variants).toEqual([
      expect.objectContaining({ imageUrl: '/uploads/products/variant.jpg' }),
      expect.objectContaining({ imageUrl: 'https://cdn.example.com/variant.jpg' }),
      expect.objectContaining({ imageUrl: undefined }),
    ]);
    expect(mockPost.mock.calls[1]).toEqual([
      '/admin/categories',
      expect.objectContaining({ imageUrl: null }),
    ]);
    expect(mockPost.mock.calls[2]).toEqual([
      '/admin/brands',
      expect.objectContaining({ logoUrl: null }),
    ]);
    expect(mockPost.mock.calls[3]).toEqual([
      '/admin/categories',
      expect.objectContaining({ imageUrl: '/uploads/categories/beds.png' }),
    ]);
    expect(mockPost.mock.calls[4]).toEqual([
      '/admin/brands',
      expect.objectContaining({ logoUrl: '/uploads/brands/pawco.png' }),
    ]);
  });

  it('normalizes order paths, checkout ids, guest email, and return text fields', async () => {
    const { orderApi } = require('./index');

    await orderApi.checkout({
      cartItemIds: [1, 1, 2.8, -2],
      shippingAddress: 'addr',
      paymentMethod: 'card',
      userCouponId: 7.3,
      recipientName: ' Mia\tCat ',
      recipientPhone: ' 555\t0100 ',
      contactEmail: ' USER@Example.COM ',
    });
    await orderApi.cancel('8' as unknown as number, ' USER@Example.COM ', ' so202605260001 ');
    await orderApi.confirm(9, ' USER@Example.COM ', ' so202605260001 ');
    await orderApi.returnOrder(9, '  Too\t small  ', ' USER@Example.COM ', ' so202605260001 ');
    await orderApi.submitReturnShipment(11, '  TRACK   123  ', ' USER@Example.COM ', ' so202605260001 ');
    await orderApi.pay(12, '  txn\u0000   123  ');
    await orderApi.ship(13, { trackingNumber: '  SHIP\u0000   456  ', trackingCarrierCode: '  DHL ' });
    expect(() => orderApi.ship(14, '   ')).toThrow('Tracking number is required');
    await orderApi.getItems(10);

    expect(mockPost.mock.calls[0][0]).toBe('/orders/checkout/me');
    expect(mockPost.mock.calls[0][1]).toEqual({
      cartItemIds: [1],
      shippingAddress: 'addr',
      recipientName: 'Mia Cat',
      recipientPhone: '555 0100',
      contactEmail: 'user@example.com',
      paymentMethod: 'card',
      userCouponId: null,
    });
    expect(mockPost.mock.calls[1][0]).toBe('/orders/guest/8/cancel');
    expect(mockPost.mock.calls[1][1]).toEqual({ guestEmail: 'user@example.com', orderNo: 'SO202605260001' });
    expect(mockPost.mock.calls[2][0]).toBe('/orders/guest/9/confirm');
    expect(mockPost.mock.calls[2][1]).toEqual({ guestEmail: 'user@example.com', orderNo: 'SO202605260001' });
    expect(mockPost.mock.calls[3][0]).toBe('/orders/guest/9/return');
    expect(mockPost.mock.calls[3][1]).toEqual({ reason: 'Too small', guestEmail: 'user@example.com', orderNo: 'SO202605260001' });
    expect(mockPost.mock.calls[4][0]).toBe('/orders/guest/11/return-shipment');
    expect(mockPost.mock.calls[4][1]).toEqual({ returnTrackingNumber: 'TRACK 123', guestEmail: 'user@example.com', orderNo: 'SO202605260001' });
    expect(mockPost.mock.calls[5][0]).toBe('/orders/12/pay');
    expect(mockPost.mock.calls[5][1]).toEqual({ transactionId: 'txn 123' });
    expect(mockPost.mock.calls[6][0]).toBe('/orders/13/ship');
    expect(mockPost.mock.calls[6][1]).toEqual({ trackingNumber: 'SHIP 456', trackingCarrierCode: 'DHL' });
    expect(mockGet.mock.calls[0][0]).toBe('/orders/10/items');
  });

  it('does not expose legacy order mutations disabled by the backend', () => {
    const { orderApi } = require('./index');
    const source = readApiSource();
    const orderApiSource = source.slice(
      source.indexOf('export const orderApi = {'),
      source.indexOf('export const couponApi = {'),
    );

    expect(orderApi.create).toBeUndefined();
    expect(orderApi.update).toBeUndefined();
    expect(orderApi.delete).toBeUndefined();
    expect(orderApi.addItem).toBeUndefined();
    expect(orderApiSource).toContain("getAll: () => api.get<Order[]>('/orders').then(withArrayData)");
    expect(orderApiSource).not.toContain("getAll: () => api.get<OrderCustomer[]>('/orders').then(withArrayData)");
    expect(orderApiSource).toContain("api.post<OrderCustomer>('/orders/checkout/me'");
    expect(orderApiSource).toContain("api.post<OrderCustomer>('/orders/checkout/guest'");
    expect(orderApiSource).not.toContain("api.post<OrderCustomer>('/orders', order)");
    expect(orderApiSource).not.toContain('api.put<Order>(`/orders/${toPathId(id)}`');
    expect(orderApiSource).not.toContain('api.delete(`/orders/${toPathId(id)}`)');
    expect(orderApiSource).not.toContain('api.post(`/orders/${normalizedOrderId}/items`');
  });

  it('normalizes paged order list envelopes to arrays for existing storefront callers', async () => {
    const { orderApi } = require('./index');
    mockGet
      .mockResolvedValueOnce({
        data: {
          items: [{ id: 31, orderNo: 'SO31' }],
          content: [{ id: 31, orderNo: 'SO31' }],
          totalElements: 1,
          page: 1,
          number: 0,
          size: 20,
          totalPages: 1,
          hasNext: false,
        },
      })
      .mockResolvedValueOnce({
        data: {
          content: [{ id: 32, orderNo: 'SO32' }],
          totalElements: 1,
          page: 1,
          number: 0,
          size: 500,
          totalPages: 1,
          hasNext: false,
        },
      });

    const mine = await orderApi.getMine();
    const all = await orderApi.getAll();

    expect(mockGet.mock.calls[0][0]).toBe('/orders/me');
    expect(mockGet.mock.calls[1][0]).toBe('/orders');
    expect(mine.data).toEqual([{ id: 31, orderNo: 'SO31' }]);
    expect(all.data).toEqual([{ id: 32, orderNo: 'SO32' }]);
  });

  it('uses request bodies for guest order read credentials', async () => {
    const { orderApi } = require('./index');

    await orderApi.getById(8, ' USER@Example.COM ', ' so202605260001 ');
    await orderApi.getItems(9, ' USER@Example.COM ', ' so202605260001 ');

    expect(mockPost.mock.calls[0]).toEqual([
      '/orders/guest/8',
      { guestEmail: 'user@example.com', orderNo: 'SO202605260001' },
      expect.objectContaining({ skipAuthHeader: true, skipAuthRedirect: true }),
    ]);
    expect(mockPost.mock.calls[1]).toEqual([
      '/orders/guest/9/items',
      { guestEmail: 'user@example.com', orderNo: 'SO202605260001' },
      expect.objectContaining({ skipAuthHeader: true, skipAuthRedirect: true }),
    ]);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('preserves uppercase idempotency keys for registered and guest checkout headers', async () => {
    const { orderApi } = require('./index');

    await orderApi.checkout({
      cartItemIds: [1],
      shippingAddress: 'addr',
      paymentMethod: 'card',
    }, { idempotencyKey: '  idem_MyKey-ABC123:Retry.01 /drop ' });

    await orderApi.guestCheckout({
      guestEmail: 'guest@example.com',
      guestName: 'Guest',
      guestPhone: '5550100',
      shippingAddress: 'addr',
      paymentMethod: 'card',
      items: [{ productId: 2, quantity: 1 }],
    }, { idempotencyKey: 'ABC-DEF-123' });

    expect(mockPost.mock.calls[0][2]).toEqual({
      headers: { 'Idempotency-Key': 'idem_MyKey-ABC123:Retry.01drop' },
    });
    expect(mockPost.mock.calls[1][2]).toEqual({
      headers: { 'Idempotency-Key': 'ABC-DEF-123' },
    });
  });

  it('coalesces only checkout mutations that share the same idempotency key', async () => {
    const { orderApi } = require('./index');
    const resolvers: Array<(value: unknown) => void> = [];
    mockPost.mockImplementation(() => new Promise((resolve) => {
      resolvers.push(resolve);
    }));
    const payload = {
      cartItemIds: [1],
      shippingAddress: 'addr',
      paymentMethod: 'card',
    };

    const first = orderApi.checkout(payload, { idempotencyKey: 'checkout-1' });
    const second = orderApi.checkout(payload, { idempotencyKey: 'checkout-1' });
    const third = orderApi.checkout(payload, { idempotencyKey: 'checkout-2' });

    expect(mockPost).toHaveBeenCalledTimes(2);
    expect(mockPost.mock.calls[0][2]).toEqual({
      headers: { 'Idempotency-Key': 'checkout-1' },
    });
    expect(mockPost.mock.calls[1][2]).toEqual({
      headers: { 'Idempotency-Key': 'checkout-2' },
    });
    resolvers[0]({ data: { orderNo: 'A' } });
    resolvers[1]({ data: { orderNo: 'B' } });
    const [firstResponse, secondResponse, thirdResponse] = await Promise.all([first, second, third]);
    expect(firstResponse).toBe(secondResponse);
    expect(thirdResponse).not.toBe(firstResponse);
    expect(thirdResponse.data).toEqual({ orderNo: 'B' });
  });

  it('caches order item lookups and short-circuits invalid order item ids', async () => {
    const { orderApi } = require('./index');

    await orderApi.getItems(22);
    await orderApi.getItems(22);
    const invalidResponse = await orderApi.getItems(22.5);

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet.mock.calls[0][0]).toBe('/orders/22/items');
    expect(invalidResponse.data).toEqual([]);
  });

  it('normalizes guest checkout items and validates tracking inputs', async () => {
    const { orderApi } = require('./index');

    await orderApi.guestCheckout({
      guestEmail: ' USER@Example.COM ',
      guestName: '  Jane   Doe  ',
      guestPhone: '  +52   555  ',
      shippingAddress: '  Calle   1  ',
      paymentMethod: ' stripe ',
      items: [
        { productId: 3.2, quantity: Number.NaN, selectedSpecs: '  Red   Large  ' },
        { productId: 4, quantity: 2.8 },
      ],
    });
    await expect(orderApi.track('   ', 'bad-email')).rejects.toThrow('Order number and email are required');
    await orderApi.track(' ORD  123#! ', ' USER@Example.COM ');

    expect(mockPost.mock.calls[0][0]).toBe('/orders/checkout/guest');
    expect(mockPost.mock.calls[0][1]).toEqual({
      guestEmail: 'user@example.com',
      guestName: 'Jane Doe',
      guestPhone: '+52 555',
      shippingAddress: 'Calle 1',
      paymentMethod: 'stripe',
      items: [{ productId: 4, quantity: 2, selectedSpecs: undefined }],
    });
    expect(mockPost.mock.calls[1][0]).toBe('/orders/track');
    expect(mockPost.mock.calls[1][1]).toEqual({ orderNo: 'ORD123', email: 'user@example.com' });
    expect(mockPost.mock.calls[1][2]).toEqual(expect.objectContaining({
      skipAuthHeader: true,
      skipAuthRedirect: true,
    }));
  });

  it('keeps cart specs, guest checkout items, and review comments within backend limits', async () => {
    const { cartApi, orderApi, reviewApi } = require('./index');
    const oversizedSpecs = 's'.repeat(1200);
    const oversizedComment = 'c'.repeat(1200);

    await cartApi.addItem(0, 5, 1, oversizedSpecs);
    await orderApi.guestCheckout({
      guestEmail: 'guest@example.com',
      guestName: 'Guest',
      guestPhone: '5550100',
      shippingAddress: 'Address',
      paymentMethod: 'stripe',
      items: Array.from({ length: 90 }, (_, index) => ({
        productId: index + 1,
        quantity: 1,
        selectedSpecs: oversizedSpecs,
      })),
    });
    await reviewApi.create(3, 9, 5, oversizedComment);

    expect(mockPost.mock.calls[0][0]).toBe('/cart/me/add');
    expect(mockPost.mock.calls[0][2].params.selectedSpecs).toHaveLength(1000);
    expect(mockPost.mock.calls[1][0]).toBe('/orders/checkout/guest');
    expect(mockPost.mock.calls[1][1].items).toHaveLength(80);
    expect(mockPost.mock.calls[1][1].items[0].selectedSpecs).toHaveLength(1000);
    expect(mockPost.mock.calls[2][0]).toBe('/reviews/product/3');
    expect(mockPost.mock.calls[2][1].comment).toHaveLength(1000);
  });

  it('normalizes admin coupon upsert payloads to the backend DTO contract', async () => {
    const { adminApi } = require('./admin');

    await adminApi.createCoupon({
      id: 99,
      name: '  Spring\u0000   Deal  ',
      couponType: ' discount ',
      scope: ' public ',
      status: ' active ',
      thresholdAmount: '100.50',
      reductionAmount: null,
      discountPercent: 150,
      maxDiscountAmount: '25.25',
      totalQuantity: 200000,
      startAt: ' 2026-06-09T10:00:00 ',
      endAt: ' 2026-06-10T10:00:00 ',
      description: 'd'.repeat(1200),
      claimedQuantity: 5,
      remainingQuantity: 10,
      createdAt: '2026-06-09T00:00:00',
    } as any);
    await adminApi.updateCoupon(7, {
      name: '  Full   cut  ',
      couponType: ' full_reduction ',
      reductionAmount: '30',
      maxDiscountAmount: undefined,
    } as any);

    expect(mockPost.mock.calls[0][0]).toBe('/admin/coupons');
    expect(mockPost.mock.calls[0][1]).toEqual({
      name: 'Spring Deal',
      couponType: 'DISCOUNT',
      scope: 'PUBLIC',
      status: 'ACTIVE',
      thresholdAmount: 100.5,
      reductionAmount: null,
      discountPercent: 99,
      maxDiscountAmount: 25.25,
      totalQuantity: 100000,
      startAt: '2026-06-09T10:00:00',
      endAt: '2026-06-10T10:00:00',
      description: 'd'.repeat(1000),
    });
    expect(mockPost.mock.calls[0][1]).not.toHaveProperty('id');
    expect(mockPost.mock.calls[0][1]).not.toHaveProperty('claimedQuantity');
    expect(mockPost.mock.calls[0][1]).not.toHaveProperty('remainingQuantity');
    expect(mockPost.mock.calls[0][1]).not.toHaveProperty('createdAt');
    expect(mockPut.mock.calls[0][0]).toBe('/admin/coupons/7');
    expect(mockPut.mock.calls[0][1]).toEqual({
      name: 'Full cut',
      couponType: 'FULL_REDUCTION',
      reductionAmount: 30,
      maxDiscountAmount: null,
    });
  });

  it('rejects admin coupon upsert payloads missing backend required fields', () => {
    const { adminApi } = require('./admin');

    expect(() => adminApi.createCoupon({ name: 'Spring' } as any)).toThrow('Coupon type is required');
    expect(() => adminApi.updateCoupon(7, { couponType: 'DISCOUNT' } as any)).toThrow('Coupon name is required');
    expect(() => adminApi.createCoupon({ name: '   ', couponType: '   ' } as any)).toThrow('Coupon name is required');
    expect(() => adminApi.updateCoupon(7, undefined as any)).toThrow('Coupon name is required');

    expect(mockPost).not.toHaveBeenCalled();
    expect(mockPut).not.toHaveBeenCalled();
  });

  it('clears order tracking cache when cancelling an order', async () => {
    const { orderApi } = require('./index');

    await orderApi.track(' CACHECANCEL730 ', ' USER@Example.COM ');
    await orderApi.track(' CACHECANCEL730 ', ' USER@Example.COM ');
    await orderApi.cancel(8, ' USER@Example.COM ', ' CACHECANCEL730 ');
    await orderApi.track(' CACHECANCEL730 ', ' USER@Example.COM ');

    const trackCalls = mockPost.mock.calls.filter((call) => call[0] === '/orders/track');
    expect(trackCalls).toHaveLength(2);
    expect(mockPost.mock.calls.some((call) => call[0] === '/orders/guest/8/cancel')).toBe(true);
  });

  it('normalizes review and question params and text payloads', async () => {
    const { reviewApi, questionApi } = require('./index');
const { adminApi } = require('./admin');

    await reviewApi.create(3, '9' as unknown as number, 9, '  Great   bowl  ');
    await questionApi.ask(4, '  Is   it washable?  ');
    await adminApi.answerQuestion('5' as unknown as number, '  Yes   it is  ');

    expect(mockPost.mock.calls[0][0]).toBe('/reviews/product/3');
    expect(mockPost.mock.calls[0][1]).toEqual({ orderId: 9, rating: 5, comment: 'Great bowl' });
    expect(mockPost.mock.calls[1][0]).toBe('/product-questions/product/4');
    expect(mockPost.mock.calls[1][1]).toEqual({ question: 'Is it washable?' });
    expect(mockPut.mock.calls[0][0]).toBe('/admin/questions/5/answer');
    expect(mockPut.mock.calls[0][1]).toEqual({ answer: 'Yes it is' });
  });

  it('caches product reviews and questions until content changes', async () => {
    const { reviewApi, questionApi } = require('./index');

    await reviewApi.getAll(777);
    await reviewApi.getAll(777);
    await questionApi.getByProduct(778);
    await questionApi.getByProduct(778);
    await reviewApi.create(777, 1, 5, '  Great  ');
    await questionApi.ask(778, '  Washable?  ');
    await reviewApi.getAll(777);
    await questionApi.getByProduct(778);

    expect(mockGet.mock.calls.map((call) => call[0])).toEqual([
      '/reviews/product/777',
      '/product-questions/product/778',
      '/reviews/product/777',
      '/product-questions/product/778',
    ]);
    expect(mockGet.mock.calls[1][1]).toEqual(expect.objectContaining({ skipAuthHeader: true, skipAuthRedirect: true }));
    expect(mockGet.mock.calls[3][1]).toEqual(expect.objectContaining({ skipAuthHeader: true, skipAuthRedirect: true }));
    expect(mockGet.mock.calls[0][1]).toEqual(expect.objectContaining({ skipAuthHeader: true, skipAuthRedirect: true }));
    expect(mockGet.mock.calls[2][1]).toEqual(expect.objectContaining({ skipAuthHeader: true, skipAuthRedirect: true }));
  });

  it('normalizes category, brand, address, and wishlist identifiers', async () => {
    const { categoryApi, brandApi, addressApi, wishlistApi } = require('./index');

    await categoryApi.getAll({ parentId: -2, level: 2.2 });
    await categoryApi.getChildren('6' as unknown as number);
    await brandApi.delete(5);
    await addressApi.setDefault(12);
    await wishlistApi.toggle(0, '14' as unknown as number);

    expect(mockGet.mock.calls[0][1]).toEqual(expect.objectContaining({ params: { parentId: undefined, level: undefined } }));
    expect(mockGet.mock.calls[1][1]).toEqual(expect.objectContaining({ params: { parentId: 6 } }));
    expect(mockGet.mock.calls[0][1]).toEqual(expect.objectContaining({ skipAuthHeader: true, skipAuthRedirect: true }));
    expect(mockGet.mock.calls[1][1]).toEqual(expect.objectContaining({ skipAuthHeader: true, skipAuthRedirect: true }));
    expect(mockDelete.mock.calls[0][0]).toBe('/brands/5');
    expect(mockPut.mock.calls[0][0]).toBe('/addresses/12/default');
    expect(mockPost.mock.calls[0][2]).toEqual({ params: { productId: 14 } });
  });

  it('caches category and brand lists until catalog metadata changes', async () => {
    const { categoryApi, brandApi } = require('./index');

    await categoryApi.create({ name: 'Cache reset' });
    await brandApi.create({ name: 'Cache reset' });
    mockGet.mockClear();
    mockPost.mockClear();

    await categoryApi.getAll({ parentId: -2, level: 2.2 });
    await categoryApi.getAll({ parentId: -2, level: 2.2 });
    await categoryApi.getChildren(6);
    await categoryApi.getChildren(6);
    await brandApi.getAll({ activeOnly: true });
    await brandApi.getAll({ activeOnly: true });
    await categoryApi.create({ name: 'Beds' });
    await brandApi.update(3, { name: 'Acme' });
    await categoryApi.getAll({ parentId: -2, level: 2.2 });
    await brandApi.getAll({ activeOnly: true });

    expect(mockGet.mock.calls.map((call) => call[0])).toEqual([
      '/categories',
      '/categories',
      '/brands',
      '/categories',
      '/brands',
    ]);
    mockGet.mock.calls.forEach((call) => {
      expect(call[1]).toEqual(expect.objectContaining({ skipAuthHeader: true, skipAuthRedirect: true }));
    });
  });

  it('caches address lookups until an address mutation invalidates them', async () => {
    const { addressApi } = require('./index');

    await addressApi.getByUser(0);
    await addressApi.getByUser(0);
    await addressApi.getDefault(0);
    await addressApi.getDefault(0);
    await addressApi.setDefault(3);
    await addressApi.getByUser(0);

    expect(mockGet.mock.calls.map((call) => call[0])).toEqual([
      '/addresses/me',
      '/addresses/me/default',
      '/addresses/me',
    ]);
  });

  it('clears storefront coupon caches after admin coupon changes', async () => {
    const { couponApi } = require('./index');
const { adminApi } = require('./admin');

    await couponApi.claim(99, 0);
    mockGet.mockClear();
    mockPost.mockClear();

    await couponApi.getPublic();
    await couponApi.getPublic();
    await adminApi.createCoupon({ name: 'Spring', couponType: 'FULL_REDUCTION' });
    await couponApi.getPublic();

    expect(mockGet.mock.calls.map((call) => call[0])).toEqual([
      '/coupons/public',
      '/coupons/public',
    ]);
    mockGet.mock.calls.forEach((call) => {
      expect(call[1]).toEqual(expect.objectContaining({ skipAuthHeader: true, skipAuthRedirect: true }));
    });
  });

  it('normalizes admin mutation and batch payload ids', async () => {
    const { adminApi } = require('./admin');

    await adminApi.updateOrderStatus(3, ' SHIPPED ', '  TN\u0000   1 ', '  DHL ');
    await adminApi.getOrdersPage({ status: ' PENDING_SHIPMENT ', search: '  TN\u0000   1 ', quick: ' SLA_OVERDUE ', page: 2, size: 200 });
    await adminApi.exportOrders(' REFUNDED ', '  order   9 ', ' REFUNDED ');
    await adminApi.batchShipOrders([1, '2', 2, -4, 5.5] as unknown as number[], '  PKG   ', '  UPS  ');
    await adminApi.batchUpdateProductStatus([7, 7, Infinity, 8] as unknown as number[], ' INACTIVE ');
    await adminApi.grantCoupon(9, [10, 10, '11', -2] as unknown as number[]);
    await adminApi.getCouponSummary();
    await adminApi.grantCoupon(9, [1, 2, 3, 4], 2);

    expect(mockPut.mock.calls[0][0]).toBe('/admin/orders/3/status');
    expect(mockPut.mock.calls[0][1]).toEqual({ status: 'SHIPPED', trackingNumber: 'TN 1', trackingCarrierCode: 'DHL' });
    expect(mockGet.mock.calls[0][0]).toBe('/admin/orders/page');
    expect(mockGet.mock.calls[0][1]).toEqual({ params: { status: 'PENDING_SHIPMENT', search: 'TN 1', quick: 'SLA_OVERDUE', page: 2, size: 100 } });
    expect(mockGet.mock.calls[1][0]).toBe('/admin/orders/export');
    expect(mockGet.mock.calls[1][1]).toEqual({ params: { status: 'REFUNDED', search: 'order 9', quick: 'REFUNDED' }, responseType: 'blob' });
    expect(mockGet.mock.calls[2][0]).toBe('/admin/coupons/summary');
    expect(mockPost.mock.calls[0][1]).toEqual({ orderIds: [1, 2], trackingPrefix: 'PKG', trackingCarrierCode: 'UPS' });
    expect(mockPost.mock.calls[1][1]).toEqual({ productIds: [7, 8], status: 'INACTIVE' });
    expect(mockPost.mock.calls[2][0]).toBe('/admin/coupons/9/grant');
    expect(mockPost.mock.calls[2][1]).toEqual({ userIds: [10, 11] });
    expect(mockPost.mock.calls[3][0]).toBe('/admin/coupons/9/grant');
    expect(mockPost.mock.calls[3][1]).toEqual({ userIds: [1, 2] });
  });

  it('caps admin coupon page size to the table maximum', async () => {
    const { adminApi } = require('./admin');

    await adminApi.getCoupons({
      keyword: '  summer\u0000   sale  ',
      status: ' active ',
      scope: ' public ',
      page: 0,
      size: 5000,
    });

    expect(mockGet.mock.calls[0]).toEqual([
      '/admin/coupons',
      { params: { keyword: 'summer sale', status: 'ACTIVE', scope: 'PUBLIC', page: 1, size: 100 } },
    ]);
  });

  it('keeps admin bug list pagination zero-based like public product pages', async () => {
    const { adminApi } = require('./admin');

    await adminApi.getBugs({
      keyword: '  checkout\u0000   bug  ',
      status: ' open ',
      severity: ' high ',
      module: ' frontend ',
      page: -4,
      size: 5000,
      scanQueueOnly: true,
    });
    await adminApi.getBugs({ page: 2, size: 25 });

    expect(mockGet.mock.calls[0]).toEqual([
      '/admin/bugs',
      { params: { page: 0, size: 100, status: 'OPEN', severity: 'HIGH', module: 'FRONTEND', keyword: 'checkout bug', scanQueueOnly: true } },
    ]);
    expect(mockGet.mock.calls[1]).toEqual([
      '/admin/bugs',
      { params: { page: 2, size: 25, status: undefined, severity: undefined, module: undefined, keyword: undefined, scanQueueOnly: false } },
    ]);
  });

  it('normalizes system alert batch action and purge payloads', async () => {
    const { adminApi } = require('./admin');

    await adminApi.acknowledgeAlerts([4, '5', 5, 0, -2, 7.7] as unknown as number[], '  ack\u0000   note  ', 3);
    await adminApi.resolveAlerts([9, 9, Number.NaN, 10] as unknown as number[], '  resolve   note  ');
    await adminApi.purgeResolvedAlerts(99999);

    expect(mockPost.mock.calls[0]).toEqual([
      '/admin/alerts/batch/acknowledge',
      { ids: [4, 5], note: 'ack note' },
    ]);
    expect(mockPost.mock.calls[1]).toEqual([
      '/admin/alerts/batch/resolve',
      { ids: [9, 10], note: 'resolve note' },
    ]);
    expect(mockPost.mock.calls[2]).toEqual([
      '/admin/alerts/purge-resolved',
      null,
      { params: { retentionDays: 3650 } },
    ]);
  });

  it('normalizes IP blacklist filters and batch release payloads', async () => {
    const { adminApi } = require('./admin');

    await adminApi.getIpBlacklist({
      status: ' BLOCKED ',
      source: ' LOGIN ',
      ipAddress: ' 203.0.113.10\u0000 ',
      limit: 99999,
    });
    await adminApi.releaseIpBlacklistEntries([8, '9', 9, 0, -3, 10.5] as unknown as number[], '  release\u0000   note  ', 2);

    expect(mockGet.mock.calls[0]).toEqual([
      '/admin/ip-blacklist',
      { params: { status: 'BLOCKED', source: 'LOGIN', ipAddress: '203.0.113.10', limit: 1000 } },
    ]);
    expect(mockPost.mock.calls[0]).toEqual([
      '/admin/ip-blacklist/batch/release',
      { ids: [8, 9], note: 'release note' },
    ]);
  });

  it('normalizes audit log filters, summary params, export params, and purge retention', async () => {
    const { adminApi } = require('./admin');

    await adminApi.getAuditLogs({
      action: ' ORDER_EXPORT\u0000 ',
      result: ' SUCCESS ',
      actorUsername: ' admin\u0000 user ',
      resourceType: ' ORDER ',
      startAt: ' 2026-05-24T10:00:00 ',
      endAt: ' 2026-05-24T12:00:00 ',
      limit: 99999,
    });
    await adminApi.getAuditLogSummary({ action: ' LOGIN ', topLimit: 999 });
    await adminApi.exportAuditLogs({ result: ' FAILURE ', actorUsername: ' jane   doe ' });
    await adminApi.purgeAuditLogs(99999);

    expect(mockGet.mock.calls[0]).toEqual([
      '/admin/audit-logs',
      {
        params: {
          action: 'ORDER_EXPORT',
          result: 'SUCCESS',
          actorUsername: 'admin user',
          resourceType: 'ORDER',
          startAt: '2026-05-24T10:00:00',
          endAt: '2026-05-24T12:00:00',
          limit: 1000,
        },
      },
    ]);
    expect(mockGet.mock.calls[1]).toEqual([
      '/admin/audit-logs/summary',
      {
        params: {
          action: 'LOGIN',
          result: undefined,
          actorUsername: undefined,
          resourceType: undefined,
          startAt: undefined,
          endAt: undefined,
          topLimit: 50,
        },
      },
    ]);
    expect(mockGet.mock.calls[2]).toEqual([
      '/admin/audit-logs/export',
      {
        params: {
          action: undefined,
          result: 'FAILURE',
          actorUsername: 'jane doe',
          resourceType: undefined,
          startAt: undefined,
          endAt: undefined,
        },
        responseType: 'blob',
      },
    ]);
    expect(mockPost.mock.calls[0]).toEqual([
      '/admin/audit-logs/purge',
      null,
      { params: { retentionDays: 3650 } },
    ]);
  });

  it('requests admin announcement summary for CMS health panels', async () => {
    const { adminApi } = require('./admin');

    await adminApi.getAnnouncementSummary();
    await adminApi.getAnnouncements();

    expect(mockGet.mock.calls.map((call) => call[0])).toEqual([
      '/admin/announcements/summary',
      '/admin/announcements',
    ]);
  });

  it('caches admin dashboard and keeps operational health endpoints explicit', async () => {
    const { adminApi } = require('./admin');

    await adminApi.getDashboard();
    await adminApi.getDashboard();
    await adminApi.getAlertSummary();
    await adminApi.getIpBlacklistStatus();
    await adminApi.updateOrderStatus(10, 'SHIPPED');
    await adminApi.getDashboard();

    expect(mockGet.mock.calls.map((call) => call[0])).toEqual([
      '/admin/dashboard',
      '/admin/alerts/summary',
      '/admin/ip-blacklist/status',
      '/admin/dashboard',
    ]);
  });

  it('caches bounded admin order pages while normalizing filters until order mutations', async () => {
    const { adminApi } = require('./admin');

    await adminApi.getOrders(' PENDING ');
    await adminApi.getOrders('PENDING');
    await adminApi.getOrdersPage({ status: ' PAID ', search: '  order   7 ', quick: ' OVERDUE ', page: 1, size: 500 });
    await adminApi.getOrdersPage({ status: 'PAID', search: 'order 7', quick: 'OVERDUE', page: 1, size: 100 });
    await adminApi.batchShipOrders([1, 2], ' PKG ');
    await adminApi.getOrders('PENDING');

    expect(mockGet.mock.calls.map((call) => call[0])).toEqual([
      '/admin/orders/page',
      '/admin/orders/page',
      '/admin/orders/page',
    ]);
    expect(mockGet.mock.calls[1][1]).toEqual({
      params: { status: 'PAID', search: 'order 7', quick: 'OVERDUE', page: 1, size: 100 },
    });
  });

  it('caches admin reviews until review moderation changes', async () => {
    const { adminApi } = require('./admin');

    await adminApi.getReviews();
    await adminApi.getReviews();
    await adminApi.replyReview(5, '  Thanks   for sharing  ');
    await adminApi.getReviews();

    expect(mockGet.mock.calls.map((call) => call[0])).toEqual([
      '/admin/reviews',
      '/admin/reviews',
    ]);
    expect(mockPut.mock.calls[0][1]).toEqual({ reply: 'Thanks for sharing' });
  });

  it('requests admin question summary and normalizes queue filters', async () => {
    const { adminApi } = require('./admin');

    await adminApi.getQuestionSummary();
    await adminApi.getQuestions({ status: ' unanswered ', limit: 99999 });

    expect(mockGet.mock.calls[0][0]).toBe('/admin/questions/summary');
    expect(mockGet.mock.calls[1]).toEqual([
      '/admin/questions',
      { params: { status: 'UNANSWERED', limit: 1000 } },
    ]);
  });

  it('caches admin question queues until an answer invalidates them', async () => {
    const { adminApi } = require('./admin');

    await adminApi.getQuestions({ status: 'UNANSWERED', limit: 200 });
    await adminApi.getQuestions({ status: ' unanswered ', limit: 200 });
    await adminApi.answerQuestion(12, '  It   fits small dogs.  ');
    await adminApi.getQuestions({ status: 'UNANSWERED', limit: 200 });

    expect(mockGet.mock.calls.map((call) => call[0])).toEqual([
      '/admin/questions',
      '/admin/questions',
    ]);
    expect(mockPut.mock.calls[0]).toEqual([
      '/admin/questions/12/answer',
      { answer: 'It fits small dogs.' },
    ]);
  });

  it('caches admin users and roles while normalizing user filters', async () => {
    const { adminApi } = require('./admin');

    await adminApi.getUsers({ keyword: '  jane\u0000   doe ', role: ' ADMIN ', status: ' ACTIVE ' });
    await adminApi.getUsers({ keyword: 'jane doe', role: 'ADMIN', status: 'ACTIVE' });
    await adminApi.getRoles();
    await adminApi.getRoles();
    await adminApi.updateUser(9, {
      status: ' banned ',
      address: '  Operations   desk  ',
      email: 'attacker@example.com',
      phone: '5550100',
      role: 'SUPER_ADMIN',
      roleCode: 'OPS',
    } as any);
    await adminApi.getUsers({ keyword: 'jane doe', role: 'ADMIN', status: 'ACTIVE' });
    await adminApi.saveRole({ code: 'OPS' });
    await adminApi.getRoles();

    expect(mockGet.mock.calls.map((call) => call[0])).toEqual([
      '/admin/users',
      '/admin/roles',
      '/admin/users',
      '/admin/roles',
    ]);
    expect(mockGet.mock.calls[0][1]).toEqual({
      params: { keyword: 'jane doe', role: 'ADMIN', status: 'ACTIVE', page: 1, size: 100 },
    });
    expect(mockPut.mock.calls[0]).toEqual([
      '/admin/users/9',
      { address: 'Operations desk', status: 'BANNED' },
    ]);
  });

  it('keeps role-code cache invalidation on the dedicated role-code endpoint', () => {
    const source = readApiSource();
    const updateUserSource = source.slice(
      source.indexOf('updateUser: (id: number, user: AdminUserUpdatePayload)'),
      source.indexOf('assignUserRole: (id: number, roleCode: string)'),
    );
    const assignUserRoleSource = source.slice(
      source.indexOf('assignUserRole: (id: number, roleCode: string)'),
      source.indexOf('getMyPermissions:', source.indexOf('assignUserRole: (id: number, roleCode: string)')),
    );

    expect(updateUserSource).not.toContain('user.roleCode');
    expect(updateUserSource).not.toContain('roleCode');
    expect(assignUserRoleSource).toContain("api.put<User>(`/admin/users/${toPathId(id)}/role-code`");
    expect(assignUserRoleSource).toContain('clearAdminPermissionsCache();');
    expect(assignUserRoleSource).toContain('clearAdminRoleCache();');
    expect(assignUserRoleSource).toContain("dispatchDomEvent('shop:admin-permissions-updated')");
  });

  it('normalizes admin user summary filters for account health panels', async () => {
    const { adminApi } = require('./admin');

    await adminApi.getUserSummary({ keyword: '  jane\u0000   doe ', role: ' ADMIN ', status: ' ACTIVE ' });

    expect(mockGet.mock.calls[0]).toEqual([
      '/admin/users/summary',
      { params: { keyword: 'jane doe', role: 'ADMIN', status: 'ACTIVE' } },
    ]);
  });

  it('uses the role-code endpoint for user demotion requests', async () => {
    const { adminApi } = require('./admin');

    await adminApi.assignUserRole(9, ' USER ');

    expect(mockPut.mock.calls[0]).toEqual([
      '/admin/users/9/role-code',
      { roleCode: 'USER' },
    ]);
  });

  it('lets the browser set multipart upload boundaries', async () => {
    const { petGalleryApi } = require('./index');
const { adminApi } = require('./admin');
    const csvFile = new File(['id,name,description,price,stock,categoryId\n'], 'products.csv', { type: 'text/csv' });
    const imageFile = new File(['image'], 'pet.jpg', { type: 'image/jpeg' });
    const bugAttachment = new File(['screenshot'], 'bug.png', { type: 'image/png' });

    await adminApi.importProducts(csvFile);
    await adminApi.previewImportProducts(csvFile);
    await petGalleryApi.upload(imageFile);
    await adminApi.uploadBugAttachment(bugAttachment);

    expect(mockPost.mock.calls[0][0]).toBe('/admin/products/import');
    expect(mockPost.mock.calls[0][1]).toBeInstanceOf(FormData);
    expect(mockPost.mock.calls[0][2]).toBeUndefined();
    expect(mockPost.mock.calls[1][0]).toBe('/admin/products/import/preview');
    expect(mockPost.mock.calls[1][1]).toBeInstanceOf(FormData);
    expect(mockPost.mock.calls[1][2]).toBeUndefined();
    expect(mockPost.mock.calls[2][0]).toBe('/pet-gallery');
    expect(mockPost.mock.calls[2][1]).toBeInstanceOf(FormData);
    expect(mockPost.mock.calls[2][2]).toBeUndefined();
    expect(mockPost.mock.calls[3][0]).toBe('/admin/bugs/attachments');
    expect(mockPost.mock.calls[3][1]).toBeInstanceOf(FormData);
    expect(mockPost.mock.calls[3][2]).toBeUndefined();
  });

  it('does not coalesce multipart uploads', async () => {
    const { adminApi } = require('./admin');
    const csvFile = new File(['id,name,description,price,stock,categoryId\n'], 'products.csv', { type: 'text/csv' });
    const resolvers: Array<(value: unknown) => void> = [];
    mockPost.mockImplementation(() => new Promise((resolve) => {
      resolvers.push(resolve);
    }));

    const first = adminApi.importProducts(csvFile);
    const second = adminApi.importProducts(csvFile);

    expect(mockPost).toHaveBeenCalledTimes(2);
    resolvers[0]({ data: { imported: 1 } });
    resolvers[1]({ data: { imported: 2 } });
    await Promise.all([first, second]);
  });

  it('requests typed product import history with a bounded limit', async () => {
    const { adminApi } = require('./admin');

    await adminApi.getProductImportHistory(999);

    expect(mockGet.mock.calls[0]).toEqual([
      '/admin/products/import/history',
      { params: { limit: 20 } },
    ]);
  });

  it('normalizes product URL imports before requesting a preview', async () => {
    const { adminApi } = require('./admin');

    await adminApi.importProductFromUrl('  https://item.taobao.com/item.htm?id=123  ');

    expect(mockPost.mock.calls[0]).toEqual([
      '/admin/products/import-url',
      { url: 'https://item.taobao.com/item.htm?id=123' },
    ]);
  });

  it('covers notification self and explicit user route variants', async () => {
    const { notificationApi } = require('./index');
const { adminApi } = require('./admin');
    const broadcastPayload = {
      type: 'SYSTEM',
      title: 'Maintenance',
      message: 'Window starts soon',
      contentFormat: 'TEXT',
    };

    await notificationApi.getByUser(0, true, -5, 999);
    await notificationApi.getForUser('7' as unknown as number, -2, 999);
    await notificationApi.getUnreadCount(0, true);
    await notificationApi.getUnreadCountForUser('7' as unknown as number);
    await notificationApi.markAsRead('4' as unknown as number, 7);
    await notificationApi.markAllAsRead();
    await notificationApi.markAllAsReadForUser('7' as unknown as number);
    await notificationApi.delete('4' as unknown as number, 7);
    await adminApi.broadcastNotification(broadcastPayload);

    expect(mockGet.mock.calls[0]).toEqual([
      '/notifications/me',
      { params: { page: 1, size: 100 } },
    ]);
    expect(mockGet.mock.calls[1]).toEqual([
      '/notifications',
      { params: { userId: 7, page: 1, size: 100 } },
    ]);
    expect(mockGet.mock.calls[2][0]).toBe('/notifications/me/unread-count');
    expect(mockGet.mock.calls[3]).toEqual([
      '/notifications/unread-count',
      { params: { userId: 7 } },
    ]);
    expect(mockPut.mock.calls[0][0]).toBe('/notifications/4/read');
    expect(mockPut.mock.calls[1][0]).toBe('/notifications/me/read-all');
    expect(mockPut.mock.calls[2]).toEqual([
      '/notifications/read-all',
      null,
      { params: { userId: 7 } },
    ]);
    expect(mockDelete.mock.calls[0][0]).toBe('/notifications/4');
    expect(mockPost.mock.calls[0]).toEqual([
      '/admin/notifications/broadcast',
      broadcastPayload,
    ]);
  });

  it('normalizes notification, pet profile, pet gallery, and logistics params', async () => {
    const { notificationApi, petProfileApi, petGalleryApi, logisticsApi } = require('./index');

    await notificationApi.markAsRead(4);
    await petProfileApi.update('6' as unknown as number, { name: 'Milo' });
    await petGalleryApi.like(7);
    await logisticsApi.track('  1Z   999  ', '  UPS  ', 20);

    expect(mockPut.mock.calls[0][0]).toBe('/notifications/4/read');
    expect(mockPut.mock.calls[1][0]).toBe('/pet-profiles/6');
    expect(mockPost.mock.calls[0][0]).toBe('/pet-gallery/7/like');
    expect(mockGet.mock.calls[0][0]).toBe('/logistics/track');
    expect(mockGet.mock.calls[0][1]).toEqual(expect.objectContaining({ params: { trackingNumber: '1Z 999', carrier: 'UPS', orderId: 20 }, allowAnonymousRetry: false }));
  });

  it('caches logistics tracking and rejects empty tracking requests', async () => {
    const { logisticsApi } = require('./index');

    await expect(logisticsApi.track('   ')).rejects.toThrow('Tracking number or order id is required');
    await logisticsApi.track('  2Z   999  ', '  UPS  ');
    await logisticsApi.track('  2Z   999  ', '  UPS  ');

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet.mock.calls[0][0]).toBe('/logistics/track');
    expect(mockGet.mock.calls[0][1]).toEqual(expect.objectContaining({ allowAnonymousRetry: false }));
    expect(mockGet.mock.calls[0][1]).not.toEqual(expect.objectContaining({ skipAuthHeader: true }));
  });

  it('uses a request body for guest logistics tracking credentials', async () => {
    const { logisticsApi } = require('./index');

    await logisticsApi.track('  3Z   999  ', '  UPS  ', 22, ' USER@Example.COM ', ' so202605260001 ');

    expect(mockPost.mock.calls[0]).toEqual([
      '/logistics/track',
      {
        trackingNumber: '3Z 999',
        carrier: 'UPS',
        orderId: 22,
        guestEmail: 'user@example.com',
        orderNo: 'SO202605260001',
      },
      expect.objectContaining({ skipAuthHeader: true, skipAuthRedirect: true }),
    ]);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('caches logistics carriers until carrier mutations invalidate them', async () => {
    const { logisticsCarrierApi } = require('./index');

    await logisticsCarrierApi.getAll(true);
    await logisticsCarrierApi.getAll(true);
    await logisticsCarrierApi.create({ code: 'DHL' });
    await logisticsCarrierApi.getAll(true);

    expect(mockGet.mock.calls.map((call) => call[0])).toEqual([
      '/admin/logistics-carriers',
      '/admin/logistics-carriers',
    ]);
    expect(mockPost.mock.calls[0][0]).toBe('/admin/logistics-carriers');
  });
});
