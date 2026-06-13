import { clearAuthClientState } from './authClientStateCleanup';

describe('authClientStateCleanup', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('clears user-scoped local client state without deleting the guest cart', () => {
    localStorage.setItem('token', 'access-token');
    localStorage.setItem('userId', '42');
    localStorage.setItem('shop-product-view-preferences', JSON.stringify({
      categories: { food: 2 },
      brands: { Acme: 1 },
      tags: { puppy: 1 },
      recent: [7],
      recentEntries: [{ productId: 7, viewedAt: 1 }],
    }));
    localStorage.setItem('shop-product-compare', JSON.stringify([7]));
    localStorage.setItem('shop-stock-alerts', JSON.stringify([
      { productId: 7, productName: 'Harness', createdAt: '2026-01-01T00:00:00.000Z' },
    ]));
    localStorage.setItem('shop-save-for-later', JSON.stringify([
      { id: 10, productId: 7, quantity: 1, productName: 'Harness', price: 12, savedAt: 1 },
    ]));
    localStorage.setItem('shop-guest-support-context', JSON.stringify({
      orderNo: 'ORD-1',
      email: 'buyer@example.com',
      savedAt: Date.now(),
    }));
    localStorage.setItem('shop-pet-gallery-local-likes', JSON.stringify([7]));
    localStorage.setItem('shop-guest-cart', JSON.stringify([{ productId: 99, quantity: 1 }]));
    sessionStorage.setItem('checkoutCartItemIds:auth:42', JSON.stringify([10]));
    sessionStorage.setItem('checkoutPaymentMethod', 'OXXO');
    sessionStorage.setItem('checkoutGuestDraft', JSON.stringify({ email: 'buyer@example.com' }));

    clearAuthClientState();

    expect(JSON.parse(localStorage.getItem('shop-product-view-preferences') || '{}')).toMatchObject({
      categories: {},
      brands: {},
      tags: {},
      recent: [],
      recentEntries: [],
    });
    expect(localStorage.getItem('shop-product-compare')).toBe('[]');
    expect(localStorage.getItem('shop-stock-alerts')).toBe('[]');
    expect(localStorage.getItem('shop-save-for-later')).toBe('[]');
    expect(localStorage.getItem('shop-guest-support-context')).toBeNull();
    expect(localStorage.getItem('shop-pet-gallery-local-likes')).toBeNull();
    expect(localStorage.getItem('shop-guest-cart')).toBe(JSON.stringify([{ productId: 99, quantity: 1 }]));
    expect(sessionStorage.getItem('checkoutCartItemIds:auth:42')).toBeNull();
    expect(sessionStorage.getItem('checkoutPaymentMethod')).toBeNull();
    expect(sessionStorage.getItem('checkoutGuestDraft')).toBeNull();
  });

  it('does not throw when browser storage operations are unavailable', () => {
    const getItemSpy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    const removeItemSpy = jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    expect(() => clearAuthClientState()).not.toThrow();

    getItemSpy.mockRestore();
    setItemSpy.mockRestore();
    removeItemSpy.mockRestore();
  });
});
