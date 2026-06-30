import {
  clearProductViewHistory,
  loadProductViewPreferences,
  MAX_PRODUCT_VIEW_HISTORY_ITEMS,
  PRODUCT_VIEW_PREFERENCES_KEY,
  recordProductView,
  removeProductViewHistoryItem,
} from './productViewPreferences';

describe('productViewPreferences', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('normalizes malformed preference buckets and recent items', () => {
    localStorage.setItem(PRODUCT_VIEW_PREFERENCES_KEY, JSON.stringify({
      categories: { 1: 4, 2: -10, 3: 'bad', 4: 5000 },
      brands: ['bad'],
      tags: { sale: 2 },
      recent: [1, '1', 2, 2.5, -3, 'bad'],
      recentEntries: [
        { productId: 1, viewedAt: 10 },
        { productId: 1, viewedAt: 15 },
        { id: 2, viewedAt: '20' },
        { productId: 2.5, viewedAt: 25 },
        { productId: -1, viewedAt: 30 },
      ],
      updatedAt: 'bad',
    }));

    expect(loadProductViewPreferences()).toEqual({
      categories: { 1: 4, 4: 999 },
      brands: {},
      tags: { sale: 2 },
      recent: [1, 2],
      recentEntries: [
        { productId: 1, viewedAt: 10 },
        { productId: 2, viewedAt: 20 },
      ],
      updatedAt: undefined,
    });
  });

  it('does not throw when preference storage writes are unavailable', () => {
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    expect(() => recordProductView({ id: 5, categoryId: 1, brand: 'Acme', tag: 'sale' })).not.toThrow();
    expect(() => clearProductViewHistory()).not.toThrow();
    expect(() => removeProductViewHistoryItem(5)).not.toThrow();

    setItemSpy.mockRestore();
  });

  it('ignores malformed product ids when removing a view history item', () => {
    localStorage.setItem(PRODUCT_VIEW_PREFERENCES_KEY, JSON.stringify({
      recent: [4],
      recentEntries: [{ productId: 4, viewedAt: 10 }],
    }));

    removeProductViewHistoryItem(0);

    expect(loadProductViewPreferences().recent).toEqual([4]);
  });

  it('ignores fractional product ids when recording views', () => {
    recordProductView({ id: 4.5, categoryId: 1, brand: 'Acme', tag: 'sale' });

    expect(loadProductViewPreferences().recent).toEqual([]);
  });

  it('caps recent browsing history with the named history limit', () => {
    const overLimitIds = Array.from({ length: MAX_PRODUCT_VIEW_HISTORY_ITEMS + 5 }, (_, index) => index + 1);
    localStorage.setItem(PRODUCT_VIEW_PREFERENCES_KEY, JSON.stringify({
      recent: overLimitIds,
      recentEntries: overLimitIds.map((productId) => ({ productId, viewedAt: productId })),
    }));

    expect(loadProductViewPreferences().recent).toEqual(overLimitIds.slice(0, MAX_PRODUCT_VIEW_HISTORY_ITEMS));
    expect(loadProductViewPreferences().recentEntries).toHaveLength(MAX_PRODUCT_VIEW_HISTORY_ITEMS);

    recordProductView({ id: 99, categoryId: 1, brand: 'Acme', tag: 'sale' });

    const preferences = loadProductViewPreferences();
    expect(preferences.recent).toHaveLength(MAX_PRODUCT_VIEW_HISTORY_ITEMS);
    expect(preferences.recent[0]).toBe(99);
    expect(preferences.recentEntries).toHaveLength(MAX_PRODUCT_VIEW_HISTORY_ITEMS);
    expect(preferences.recentEntries[0].productId).toBe(99);
  });
});
