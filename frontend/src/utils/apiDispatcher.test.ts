describe('apiDispatcher', () => {
  beforeEach(() => {
    jest.resetModules();
    delete window.__SHOP_RUNTIME_CONFIG__;
  });

  it('resolves service ids from API paths', () => {
    const { resolveApiServiceId } = require('./apiDispatcher');

    expect(resolveApiServiceId('/products/12')).toBe('catalog');
    expect(resolveApiServiceId('/orders/track')).toBe('order');
    expect(resolveApiServiceId('/payments/channels')).toBe('payment');
    expect(resolveApiServiceId('/admin/orders/page')).toBe('admin');
  });

  it('leaves relative API urls unchanged when gateway dispatch is not enabled', () => {
    const { resolveApiDispatcherUrl } = require('./apiDispatcher');

    expect(resolveApiDispatcherUrl('/products?keyword=cat')).toBe('/products?keyword=cat');
    expect(resolveApiDispatcherUrl('/auth/login')).toBe('/auth/login');
    expect(resolveApiDispatcherUrl('/support/messages')).toBe('/support/messages');
  });

  it('rewrites relative API urls through the gateway when enabled', () => {
    window.__SHOP_RUNTIME_CONFIG__ = { apiGatewayEnabled: true };
    const { resolveApiDispatcherUrl } = require('./apiDispatcher');

    expect(resolveApiDispatcherUrl('/products?keyword=cat')).toBe('/gateway/catalog/products?keyword=cat');
    expect(resolveApiDispatcherUrl('/auth/login')).toBe('/gateway/identity/auth/login');
    expect(resolveApiDispatcherUrl('/support/messages')).toBe('/gateway/support/support/messages');
  });

  it('leaves non-api, absolute, and already-dispatched urls alone', () => {
    window.__SHOP_RUNTIME_CONFIG__ = { apiGatewayEnabled: true };
    const { resolveApiDispatcherUrl } = require('./apiDispatcher');

    expect(resolveApiDispatcherUrl('https://api.example.com/products')).toBe('https://api.example.com/products');
    expect(resolveApiDispatcherUrl('//api.example.com/products')).toBe('//api.example.com/products');
    expect(resolveApiDispatcherUrl('/gateway/catalog/products')).toBe('/gateway/catalog/products');
    expect(resolveApiDispatcherUrl('/unknown/path')).toBe('/unknown/path');
  });
});

export {};
