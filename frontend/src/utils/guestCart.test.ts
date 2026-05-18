import { addGuestCartItem, clearGuestCart, getGuestCartItems, removeGuestCartItems, updateGuestCartQuantity } from './guestCart';

describe('guestCart', () => {
  const originalSetItem = Storage.prototype.setItem;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    Storage.prototype.setItem = originalSetItem;
    jest.restoreAllMocks();
  });

  it('clamps added guest cart quantities to available stock', () => {
    addGuestCartItem({ id: 1, name: 'Harness', price: 20, stock: 3 }, 2);
    addGuestCartItem({ id: 1, name: 'Harness', price: 20, stock: 3 }, 5);

    expect(getGuestCartItems()[0].quantity).toBe(3);
  });

  it('normalizes invalid quantity updates', () => {
    const item = addGuestCartItem({ id: 2, name: 'Treats', price: 8, stock: 10 }, 1);

    updateGuestCartQuantity(item.id, Number.NaN);
    expect(getGuestCartItems()[0].quantity).toBe(1);

    updateGuestCartQuantity(item.id, -4);
    expect(getGuestCartItems()[0].quantity).toBe(1);
  });

  it('caps guest cart quantities without a stock snapshot', () => {
    addGuestCartItem({ id: 3, name: 'Toy', price: 12 }, 500);

    expect(getGuestCartItems()[0].quantity).toBe(99);
  });

  it('clears guest cart data', () => {
    addGuestCartItem({ id: 4, name: 'Bowl', price: 10, stock: 2 }, 1);
    clearGuestCart();

    expect(getGuestCartItems()).toEqual([]);
  });

  it('does not crash when guest cart persistence is unavailable', () => {
    Storage.prototype.setItem = jest.fn(() => {
      throw new Error('storage unavailable');
    });
    const listener = jest.fn();
    window.addEventListener('shop:cart-updated', listener);

    expect(() => addGuestCartItem({ id: 5, name: 'Mat', price: 18, stock: 1 }, 1)).not.toThrow();
    expect(listener).toHaveBeenCalled();
    window.removeEventListener('shop:cart-updated', listener);
  });

  it('drops corrupt stored cart rows and normalizes money fields', () => {
    localStorage.setItem('shop-guest-cart', JSON.stringify([
      { id: -1, productId: 10, quantity: 1.8, productName: ' Bowl ', price: 'Infinity', stock: 2.9 },
      { id: 'bad', productId: 11, quantity: 1, productName: 'Bad id', price: 5 },
      { id: -2, productId: 0, quantity: 1, productName: 'Bad product', price: 5 },
    ]));

    expect(getGuestCartItems()).toEqual([
      expect.objectContaining({
        id: -1,
        productId: 10,
        quantity: 1,
        productName: 'Bowl',
        price: 0,
        stock: 2,
      }),
    ]);
  });

  it('removes only normalized numeric guest cart ids', () => {
    addGuestCartItem({ id: 6, name: 'Leash', price: 15, stock: 4 }, 1);

    removeGuestCartItems([Number.NaN, -123456]);

    expect(getGuestCartItems()).toHaveLength(1);
  });

  it('rejects malformed products before creating guest cart items', () => {
    const result = addGuestCartItem({ id: 1.5, name: 'Bad product', price: 12 }, 1);

    expect(result).toBeNull();
    expect(getGuestCartItems()).toEqual([]);
  });
});
