import { canCartItemCheckout, isCartItemAvailable } from './cartUi';
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

  it('checks checkout quantity using integer stock snapshots', () => {
    expect(canCartItemCheckout(cartItem({ stock: 1.9, quantity: 1.2 }))).toBe(true);
    expect(canCartItemCheckout(cartItem({ stock: 1.1, quantity: 2 }))).toBe(false);
  });
});
