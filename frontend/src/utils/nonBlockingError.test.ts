import {
  buildNonBlockingErrorReport,
  installGlobalErrorReporting,
  reportNonBlockingError,
  resetNonBlockingErrorReportingForTest,
} from './nonBlockingError';

describe('nonBlockingError remote reporting', () => {
  const originalFetch = global.fetch;
  const originalSendBeacon = navigator.sendBeacon;
  let fetchMock: jest.Mock;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    resetNonBlockingErrorReportingForTest();
    delete window.__SHOP_RUNTIME_CONFIG__;
    delete window.__SHOP_API_BASE_URL__;
    window.history.replaceState(null, '', '/checkout/123?token=raw-token');
    fetchMock = jest.fn(() => Promise.resolve({ ok: true } as Response));
    (global as typeof globalThis & { fetch?: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
    Object.defineProperty(navigator, 'sendBeacon', {
      configurable: true,
      value: undefined,
    });
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    resetNonBlockingErrorReportingForTest();
    warnSpy.mockRestore();
    if (originalFetch) {
      (global as typeof globalThis & { fetch?: typeof fetch }).fetch = originalFetch;
    } else {
      delete (global as unknown as { fetch?: typeof fetch }).fetch;
    }
    Object.defineProperty(navigator, 'sendBeacon', {
      configurable: true,
      value: originalSendBeacon,
    });
    delete window.__SHOP_RUNTIME_CONFIG__;
    delete window.__SHOP_API_BASE_URL__;
  });

  it('keeps Jest runs console-only unless remote reporting is explicitly enabled', () => {
    reportNonBlockingError('Cart.loadRecentProducts', new Error('catalog failed'));

    expect(warnSpy).toHaveBeenCalledWith('[shop] Cart.loadRecentProducts', expect.any(Error));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts sanitized reports to the configured API base without leaking secrets', () => {
    window.__SHOP_RUNTIME_CONFIG__ = {
      apiBaseUrl: '/api',
      clientErrorReportingEnabled: true,
    };
    const error = new Error('token=raw-token password=raw-password owner@example.com');
    error.stack = 'Error: token=raw-token\n at pay (Authorization Bearer abcdefghijklmnop)';

    reportNonBlockingError('Checkout.submit', error);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/errors');
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('omit');
    const payload = JSON.parse(String(init.body));
    expect(payload.context).toBe('Checkout.submit');
    expect(payload.path).toBe('/checkout/123');
    expect(payload.message).toContain('token=******');
    expect(payload.message).toContain('password=******');
    expect(payload.message).toContain('email******');
    expect(payload.stack).toContain('Authorization Bearer ******');
    expect(JSON.stringify(payload)).not.toContain('raw-token');
    expect(JSON.stringify(payload)).not.toContain('owner@example.com');
  });

  it('extracts ErrorBoundary nested errors and masks component stacks', () => {
    window.__SHOP_RUNTIME_CONFIG__ = {
      apiBaseUrl: '/api',
      clientErrorReportingEnabled: true,
    };

    reportNonBlockingError('ErrorBoundary caught', {
      error: new Error('Render failed password=raw-secret'),
      componentStack: 'at Checkout email=owner@example.com',
    });

    const payload = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(payload.context).toBe('ErrorBoundary caught');
    expect(payload.message).toBe('Render failed password=******');
    expect(payload.componentStack).toContain('email=******');
    expect(JSON.stringify(payload)).not.toContain('owner@example.com');
  });

  it('deduplicates repeated reports inside the local reporting window', () => {
    window.__SHOP_RUNTIME_CONFIG__ = {
      apiBaseUrl: '/api',
      clientErrorReportingEnabled: true,
    };

    reportNonBlockingError('Wishlist.load', new Error('same failure'));
    reportNonBlockingError('Wishlist.load', new Error('same failure'));

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('installs a global browser error handler that uses the same remote reporter', () => {
    window.__SHOP_RUNTIME_CONFIG__ = {
      apiBaseUrl: '/api',
      clientErrorReportingEnabled: true,
    };

    installGlobalErrorReporting();
    window.dispatchEvent(new ErrorEvent('error', {
      message: 'Global crash',
      error: new Error('Global crash token=raw-token'),
    }));

    const payload = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(payload.context).toBe('window.error');
    expect(payload.message).toBe('Global crash token=******');
  });

  it('builds bounded non-error object summaries instead of serializing raw payloads', () => {
    const payload = buildNonBlockingErrorReport('Support.poll', {
      status: 500,
      token: 'raw-token',
      email: 'owner@example.com',
    });

    expect(payload.message).toBe('Non-Error object keys: status,token,email');
    expect(JSON.stringify(payload)).not.toContain('raw-token');
    expect(JSON.stringify(payload)).not.toContain('owner@example.com');
  });
});
