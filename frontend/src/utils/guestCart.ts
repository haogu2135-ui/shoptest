import type { CartItem, Product } from '../types';

const GUEST_CART_KEY = 'shop-guest-cart';

const readGuestCart = (): CartItem[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(GUEST_CART_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeGuestCart = (items: CartItem[]) => {
  localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
};

export const getGuestCartItems = () => readGuestCart();

export const clearGuestCart = () => writeGuestCart([]);

export const replaceGuestCartItems = (items: CartItem[]) => writeGuestCart(items);

export const addGuestCartItem = (product: Product | any, quantity = 1, selectedSpecs?: string, price?: number) => {
  const items = readGuestCart();
  const existing = items.find((item) => item.productId === product.id && (item.selectedSpecs || '') === (selectedSpecs || ''));
  if (existing) {
    existing.quantity += quantity;
    existing.price = price ?? product.effectivePrice ?? product.price;
    existing.stock = product.stock;
    writeGuestCart(items);
    return existing;
  }

  const item: CartItem = {
    id: -Date.now(),
    userId: 0,
    productId: product.id,
    quantity,
    productName: product.name,
    imageUrl: product.imageUrl,
    price: price ?? product.effectivePrice ?? product.price,
    stock: product.stock,
    productStatus: product.status || 'ACTIVE',
    selectedSpecs,
  };
  writeGuestCart([...items, item]);
  return item;
};

export const updateGuestCartQuantity = (itemId: number, quantity: number) => {
  const items = readGuestCart().map((item) => item.id === itemId ? { ...item, quantity } : item);
  writeGuestCart(items);
  return items;
};

export const removeGuestCartItem = (itemId: number) => {
  const items = readGuestCart().filter((item) => item.id !== itemId);
  writeGuestCart(items);
  return items;
};

export const removeGuestCartItems = (itemIds: number[]) => {
  const targetIds = new Set(itemIds);
  const items = readGuestCart().filter((item) => !targetIds.has(item.id));
  writeGuestCart(items);
  return items;
};
