import { resolveApiDispatcherUrl, resolveApiServiceId } from './apiDispatcher';

describe('apiDispatcher', () => {
  it('resolves service ids from API paths', () => {
    expect(resolveApiServiceId('/products/12')).toBe('catalog');
    expect(resolveApiServiceId('/orders/track')).toBe('order');
    expect(resolveApiServiceId('/payments/channels')).toBe('payment');
    expect(resolveApiServiceId('/admin/orders/page')).toBe('admin');
  });

  it('rewrites relative API urls through the gateway', () => {
    expect(resolveApiDispatcherUrl('/products?keyword=cat')).toBe('/gateway/catalog/products?keyword=cat');
    expect(resolveApiDispatcherUrl('/auth/login')).toBe('/gateway/identity/auth/login');
    expect(resolveApiDispatcherUrl('/support/messages')).toBe('/gateway/support/support/messages');
  });

  it('leaves non-api, absolute, and already-dispatched urls alone', () => {
    expect(resolveApiDispatcherUrl('https://api.example.com/products')).toBe('https://api.example.com/products');
    expect(resolveApiDispatcherUrl('//api.example.com/products')).toBe('//api.example.com/products');
    expect(resolveApiDispatcherUrl('/gateway/catalog/products')).toBe('/gateway/catalog/products');
    expect(resolveApiDispatcherUrl('/unknown/path')).toBe('/unknown/path');
  });
});
