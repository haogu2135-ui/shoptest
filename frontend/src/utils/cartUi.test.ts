import {
  canCartItemCheckout,
  deriveCartShippingSummary,
  getCartLineAmount,
  getCartLineQuantity,
  getCartQuantityLimit,
  isCartItemFreeShippingQualified,
  isCartItemAvailable,
  normalizeCartQuantity,
} from './cartUi';
import type { CartItem } from '../types';

jest.mock('./productMedia', () => ({
  productImageFallback: 'fallback.png',
  resolveProductImage: (value?: string) => value || 'fallback.png',
}));

const cartItem = (overrides: Partial<CartItem>): CartItem => ({
  id: 1,
  productId: 1,
  productName: 'Test',
  imageUrl: '',
  price: 10,
  quantity: 1,
  ...overrides,
});

describe('cartUi', () => {
  it('treats invalid stock snapshots as unavailable', () => {
    expect(isCartItemAvailable(cartItem({ stock: Number.NaN }))).toBe(false);
  });

  it('marks cart lines unavailable when requested quantity exceeds stock', () => {
    expect(isCartItemAvailable(cartItem({ stock: 2, quantity: 3 }))).toBe(false);
    expect(isCartItemAvailable(cartItem({ stock: 3, quantity: 3 }))).toBe(true);
  });

  it('checks checkout quantity using integer stock snapshots', () => {
    expect(canCartItemCheckout(cartItem({ stock: 1.9, quantity: 1.2 }))).toBe(true);
    expect(canCartItemCheckout(cartItem({ stock: 1.1, quantity: 2 }))).toBe(false);
  });

  it('normalizes cart line quantities consistently for page and drawer controls', () => {
    expect(getCartQuantityLimit(undefined)).toBe(99);
    expect(getCartQuantityLimit(null)).toBe(99);
    expect(getCartQuantityLimit(Number.NaN)).toBe(99);
    expect(getCartQuantityLimit(2.9)).toBe(2);
    expect(getCartQuantityLimit(0)).toBe(1);

    expect(getCartLineQuantity('3.9')).toBe(3);
    expect(getCartLineQuantity(0)).toBe(1);
    expect(getCartLineQuantity('bad')).toBe(1);

    expect(normalizeCartQuantity(undefined, 200)).toBe(99);
    expect(normalizeCartQuantity(cartItem({ stock: undefined }), 200)).toBe(99);
    expect(normalizeCartQuantity(cartItem({ stock: 3 }), 8)).toBe(3);
    expect(normalizeCartQuantity(cartItem({ stock: 0 }), 8)).toBe(1);
    expect(normalizeCartQuantity(cartItem({ stock: 10 }), Number.NaN)).toBe(1);
  });

  it('rounds each cart line amount to cents before subtotal calculations', () => {
    const first = cartItem({ price: 10.005, quantity: 1 });
    const second = cartItem({ price: 10.005, quantity: 1 });

    expect(getCartLineAmount(first)).toBe(10.01);
    expect([first, second].reduce((sum, item) => sum + getCartLineAmount(item), 0)).toBe(20.02);
  });

  it('marks shipping unlocked when the selected subtotal reaches the global threshold', () => {
    expect(deriveCartShippingSummary([cartItem({ price: 40, quantity: 2 })], 75)).toEqual(
      expect.objectContaining({
        freeShippingUnlocked: true,
        remainingAmount: 0,
        progressPercent: 100,
      }),
    );
  });

  it('marks shipping unlocked when every selected item qualifies by product shipping policy', () => {
    const freeByFlag = cartItem({ price: 12, quantity: 1, freeShipping: true });
    const freeByProductThreshold = cartItem({ price: 30, quantity: 2, freeShippingThreshold: 50 });

    expect(isCartItemFreeShippingQualified(freeByFlag)).toBe(true);
    expect(isCartItemFreeShippingQualified(freeByProductThreshold)).toBe(true);
    expect(deriveCartShippingSummary([freeByFlag, freeByProductThreshold], 1000)).toEqual(
      expect.objectContaining({
        allItemsQualifyForFreeShipping: true,
        freeShippingUnlocked: true,
        remainingAmount: 0,
        progressPercent: 100,
      }),
    );
  });

  it('keeps the global threshold gap when any selected item does not qualify for item-level free shipping', () => {
    const summary = deriveCartShippingSummary([
      cartItem({ price: 10, quantity: 1, freeShipping: true }),
      cartItem({ price: 20, quantity: 1, freeShippingThreshold: 50 }),
    ], 100);

    expect(summary.freeShippingUnlocked).toBe(false);
    expect(summary.remainingAmount).toBe(70);
    expect(summary.progressPercent).toBe(30);
  });
});
