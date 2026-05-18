import { addCompareProduct, clearCompareProducts, readCompareProductIds, removeCompareProduct } from './productCompare';

describe('productCompare', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('deduplicates and drops unsafe ids from storage', () => {
    localStorage.setItem('shop-product-compare', JSON.stringify([1, '1', 2, 1.5, -3, Number.MAX_SAFE_INTEGER + 1]));

    expect(readCompareProductIds()).toEqual([1, 2]);
  });

  it('rejects malformed products before adding to compare', () => {
    expect(addCompareProduct({ id: 0 }).status).toBe('invalid');
    expect(readCompareProductIds()).toEqual([]);
  });

  it('does not throw when compare persistence is unavailable', () => {
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    expect(() => addCompareProduct({ id: 3 })).not.toThrow();
    expect(() => removeCompareProduct(3)).not.toThrow();
    expect(() => clearCompareProducts()).not.toThrow();

    setItemSpy.mockRestore();
  });
});
