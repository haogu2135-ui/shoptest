import type { CartItem, ProductPublic } from '../types';
import { createLocalId } from './localIds';
import { dispatchDomEvent } from './domEvents';
import { getLocalStorageItem, setLocalStorageItem } from './safeStorage';
import { reportNonBlockingError } from './nonBlockingError';

const GUEST_CART_KEY = 'shop-guest-cart';
const MAX_GUEST_CART_QUANTITY = 99;

const normalizeStockLimit = (stock: unknown) => {
  const numeric = Number(stock);
  return Number.isFinite(numeric) && numeric >= 0 ? Math.floor(numeric) : MAX_GUEST_CART_QUANTITY;
};

const normalizeGuestCartQuantity = (quantity: unknown, stock?: unknown) => {
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

const hasLocalStorage = () => {
  try {
    return typeof window !== 'undefined' && Boolean(window.localStorage);
  } catch (error) {
    reportNonBlockingError('guestCart.hasLocalStorage', error);
    return false;
  }
};

const normalizePrice = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
};

const normalizeOptionalNonNegativeMoney = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : undefined;
};

const resolveProductSnapshotImage = (product: Partial<ProductPublic> | any) => {
  const primary = String(product?.imageUrl || '').trim();
  if (primary) return primary;
  const galleryImage = Array.isArray(product?.images)
    ? product.images.find((image: unknown) => String(image || '').trim())
    : '';
  return String(galleryImage || '').trim();
};

type StoredGuestCartItem = Partial<CartItem> & {
  product?: Partial<ProductPublic> & Record<string, unknown>;
};

export type NormalizedGuestCartItem = CartItem & {
  readonly product?: never;
};

const isNormalizedGuestCartItem = (item: NormalizedGuestCartItem | null): item is NormalizedGuestCartItem => Boolean(item);

const normalizeCartItem = (item: StoredGuestCartItem): NormalizedGuestCartItem | null => {
  const id = normalizeSafeId(item.id);
  const productSnapshot: Partial<ProductPublic> & Record<string, unknown> = item.product || {};
  const productId = normalizeSafeId(item.productId ?? productSnapshot.id);
  if (id === null || productId === null || productId <= 0) return null;
  const stock = item.stock === undefined ? productSnapshot.stock : item.stock;
  const productStatus = item.productStatus || productSnapshot.status;

  return {
    id,
    productId,
    quantity: normalizeGuestCartQuantity(item.quantity, stock),
    productName: String(item.productName || productSnapshot.name || '').trim(),
    imageUrl: item.imageUrl ? String(item.imageUrl).trim() : resolveProductSnapshotImage(productSnapshot),
    price: normalizePrice(item.price ?? productSnapshot.effectivePrice ?? productSnapshot.price),
    stock: stock === undefined ? undefined : normalizeStockLimit(stock),
    productStatus: productStatus ? String(productStatus).trim().toUpperCase() : 'ACTIVE',
    freeShipping: Boolean(item.freeShipping ?? productSnapshot.freeShipping),
    freeShippingThreshold: normalizeOptionalNonNegativeMoney(item.freeShippingThreshold ?? productSnapshot.freeShippingThreshold),
    selectedSpecs: item.selectedSpecs ? String(item.selectedSpecs).trim() : undefined,
  };
};

const readGuestCart = (): NormalizedGuestCartItem[] => {
  try {
    const parsed = JSON.parse(getLocalStorageItem(GUEST_CART_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.map(normalizeCartItem).filter(isNormalizedGuestCartItem) : [];
  } catch (error) {
    reportNonBlockingError('guestCart.readGuestCart parse failed', error);
    return [];
  }
};

const writeGuestCart = (items: CartItem[]) => {
  const normalizedItems = items.map(normalizeCartItem).filter(isNormalizedGuestCartItem);
  const persisted = setLocalStorageItem(GUEST_CART_KEY, JSON.stringify(normalizedItems));
  if (!persisted && hasLocalStorage()) {
    reportNonBlockingError('guestCart.writeGuestCart persistence failed', new Error('Unable to persist guest cart'));
  }
  dispatchDomEvent('shop:cart-updated');
  return persisted;
};

/**
 * @invariant Returned rows are flat cart items. Legacy nested product snapshots
 * are consumed during normalization and never returned or persisted again.
 */
export const getGuestCartItems = (): NormalizedGuestCartItem[] => readGuestCart();

export const clearGuestCart = () => writeGuestCart([]);

export const replaceGuestCartItems = (items: CartItem[]) => writeGuestCart(items);

export const addGuestCartItem = (product: ProductPublic | any, quantity = 1, selectedSpecs?: string, price?: number): CartItem | null => {
  const items = readGuestCart();
  const productId = normalizePositiveProductId(product.id);
  const productName = String(product.name || '').trim();
  if (productId === null || !productName) {
    return null;
  }
  const normalizedSpecs = selectedSpecs ? String(selectedSpecs).trim().slice(0, 600) : undefined;
  const stockLimit = normalizeStockLimit(product.stock);
  const normalizedQuantity = normalizeGuestCartQuantity(quantity, stockLimit);
  const existing = items.find((item) => item.productId === productId && (item.selectedSpecs || '') === (normalizedSpecs || ''));
  if (existing) {
    existing.quantity = normalizeGuestCartQuantity(existing.quantity + normalizedQuantity, stockLimit);
    existing.price = price ?? product.effectivePrice ?? product.price;
    existing.stock = product.stock;
    existing.freeShipping = Boolean(product.freeShipping);
    existing.freeShippingThreshold = normalizeOptionalNonNegativeMoney(product.freeShippingThreshold);
    writeGuestCart(items);
    return existing;
  }

  const item: CartItem = {
    id: createLocalId(items.map((cartItem) => cartItem.id)),
    productId,
    quantity: normalizedQuantity,
    productName,
    imageUrl: resolveProductSnapshotImage(product),
    price: price ?? product.effectivePrice ?? product.price,
    stock: product.stock,
    productStatus: 'ACTIVE',
    freeShipping: Boolean(product.freeShipping),
    freeShippingThreshold: normalizeOptionalNonNegativeMoney(product.freeShippingThreshold),
    selectedSpecs: normalizedSpecs,
  };
  writeGuestCart([...items, item]);
  return item;
};

export const updateGuestCartQuantity = (itemId: number, quantity: number) => {
  const items = readGuestCart().map((item) => item.id === itemId ? { ...item, quantity: normalizeGuestCartQuantity(quantity, item.stock) } : item);
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
