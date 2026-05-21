import type { CartItem, Product } from '../types';
import { createLocalId } from './localIds';
import { dispatchDomEvent } from './domEvents';
import { getLocalStorageItem, setLocalStorageItem } from './safeStorage';

const GUEST_CART_KEY = 'shop-guest-cart';
const MAX_GUEST_CART_QUANTITY = 99;

const normalizeStockLimit = (stock: unknown) => {
  const numeric = Number(stock);
  return Number.isFinite(numeric) && numeric >= 0 ? Math.floor(numeric) : MAX_GUEST_CART_QUANTITY;
};

const normalizeQuantity = (quantity: unknown, stock?: unknown) => {
  const numeric = Number(quantity);
  const requested = Number.isFinite(numeric) ? Math.floor(numeric) : 1;
  const maxByStock = normalizeStockLimit(stock);
  return Math.max(1, Math.min(requested, Math.max(1, Math.min(maxByStock, MAX_GUEST_CART_QUANTITY))));
};

const normalizeSafeId = (value: unknown) => {
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
};

const normalizePositiveProductId = (value: unknown) => {
  const id = normalizeSafeId(value);
  return id !== null && id > 0 ? id : null;
};

const normalizePrice = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
};

const normalizeCartItem = (item: Partial<CartItem>): CartItem | null => {
  const id = normalizeSafeId(item.id);
  const productId = normalizeSafeId(item.productId);
  if (id === null || productId === null || productId <= 0) return null;

  return {
    ...item,
    id,
    userId: normalizeSafeId(item.userId) ?? 0,
    productId,
    quantity: normalizeQuantity(item.quantity, item.stock),
    productName: String(item.productName || '').trim(),
    imageUrl: item.imageUrl ? String(item.imageUrl).trim() : '',
    price: normalizePrice(item.price),
    stock: item.stock === undefined ? undefined : normalizeStockLimit(item.stock),
    productStatus: item.productStatus ? String(item.productStatus).trim().toUpperCase() : 'ACTIVE',
    selectedSpecs: item.selectedSpecs ? String(item.selectedSpecs).trim() : undefined,
  };
};

const readGuestCart = (): CartItem[] => {
  try {
    const parsed = JSON.parse(getLocalStorageItem(GUEST_CART_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.map(normalizeCartItem).filter(Boolean) as CartItem[] : [];
  } catch {
    return [];
  }
};

const writeGuestCart = (items: CartItem[]) => {
  setLocalStorageItem(GUEST_CART_KEY, JSON.stringify(items.map(normalizeCartItem).filter(Boolean)));
  dispatchDomEvent('shop:cart-updated');
};

export const getGuestCartItems = () => readGuestCart();

export const clearGuestCart = () => writeGuestCart([]);

export const replaceGuestCartItems = (items: CartItem[]) => writeGuestCart(items);

export const addGuestCartItem = (product: Product | any, quantity = 1, selectedSpecs?: string, price?: number): CartItem => {
  const items = readGuestCart();
  const productId = normalizePositiveProductId(product.id);
  const productName = String(product.name || '').trim();
  if (productId === null || !productName) {
    return null as unknown as CartItem;
  }
  const normalizedSpecs = selectedSpecs ? String(selectedSpecs).trim().slice(0, 600) : undefined;
  const stockLimit = normalizeStockLimit(product.stock);
  const normalizedQuantity = normalizeQuantity(quantity, stockLimit);
  const existing = items.find((item) => item.productId === productId && (item.selectedSpecs || '') === (normalizedSpecs || ''));
  if (existing) {
    existing.quantity = normalizeQuantity(existing.quantity + normalizedQuantity, stockLimit);
    existing.price = price ?? product.effectivePrice ?? product.price;
    existing.stock = product.stock;
    writeGuestCart(items);
    return existing;
  }

  const item: CartItem = {
    id: createLocalId(items.map((cartItem) => cartItem.id)),
    userId: 0,
    productId,
    quantity: normalizedQuantity,
    productName,
    imageUrl: product.imageUrl,
    price: price ?? product.effectivePrice ?? product.price,
    stock: product.stock,
    productStatus: product.status || 'ACTIVE',
    selectedSpecs: normalizedSpecs,
  };
  writeGuestCart([...items, item]);
  return item;
};

export const updateGuestCartQuantity = (itemId: number, quantity: number) => {
  const items = readGuestCart().map((item) => item.id === itemId ? { ...item, quantity: normalizeQuantity(quantity, item.stock) } : item);
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
