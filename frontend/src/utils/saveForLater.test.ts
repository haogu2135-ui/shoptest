import { getSavedForLaterItems, removeSavedForLaterItem, removeSavedForLaterProduct, saveCartItemForLater } from './saveForLater';

describe('saveForLater', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('drops malformed saved items and normalizes quantity', () => {
    localStorage.setItem('shop-save-for-later', JSON.stringify([
      { id: 'bad', productId: 1, quantity: 2, savedAt: 1 },
      { id: 9.5, productId: 1, quantity: 2, savedAt: 1 },
      { id: 10, productId: 2, quantity: 500, productName: 'Toy', price: 12 },
      { id: 12, productId: 4, quantity: 1, productName: 'Bad time', price: 1, savedAt: -10, sourceCartItemId: Infinity },
      { id: 11, productId: -1, quantity: 1, productName: 'Invalid', price: 1 },
    ]));

    const items = getSavedForLaterItems();
    expect(items).toMatchObject([
      { id: 10, productId: 2, quantity: 99, productName: 'Toy' },
      { id: 12, productId: 4, quantity: 1, productName: 'Bad time', sourceCartItemId: undefined },
    ]);
    expect(items[1].savedAt).toBeGreaterThan(0);
  });

  it('caps merged saved item quantities', () => {
    const baseItem = {
      id: 1,
      productId: 3,
      quantity: 80,
      productName: 'Treats',
      imageUrl: '',
      price: 8,
      selectedSpecs: 'size=S',
    };

    saveCartItemForLater(baseItem);
    saveCartItemForLater({ ...baseItem, id: 2, quantity: 80 });

    expect(getSavedForLaterItems()[0].quantity).toBe(99);
  });

  it('does not throw when storage writes are unavailable', () => {
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    expect(() => saveCartItemForLater({
      id: 1,
      productId: 3,
      quantity: 1,
      productName: 'Treats',
      imageUrl: '',
      price: 8,
    })).not.toThrow();

    setItemSpy.mockRestore();
  });

  it('rejects malformed cart items before saving for later', () => {
    const result = saveCartItemForLater({
      id: 0,
      productId: 0,
      quantity: 1,
      productName: 'Invalid',
      imageUrl: '',
      price: 1,
    });

    expect(result).toBeNull();
    expect(getSavedForLaterItems()).toEqual([]);
  });

  it('normalizes ids and specs when removing saved items', () => {
    saveCartItemForLater({
      id: 1,
      productId: 3,
      quantity: 1,
      productName: 'Treats',
      imageUrl: '',
      price: 8,
      selectedSpecs: ' size=S ',
    });

    removeSavedForLaterItem(Number.NaN);
    expect(getSavedForLaterItems()).toHaveLength(1);

    removeSavedForLaterProduct('3' as unknown as number, 'size=S');
    expect(getSavedForLaterItems()).toEqual([]);
  });
});
