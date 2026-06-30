import type { CartItem } from '../types';
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

type GuestCartProductInput = {
  id?: unknown;
  name?: unknown;
  imageUrl?: unknown;
  images?: unknown;
  price?: unknown;
  effectivePrice?: unknown;
  stock?: unknown;
  status?: unknown;
  freeShipping?: unknown;
  freeShippingThreshold?: unknown;
  [key: string]: unknown;
};

const EMPTY_PRODUCT_SNAPSHOT: GuestCartProductInput = {};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const toProductInput = (value: unknown): GuestCartProductInput => (isRecord(value) ? value : EMPTY_PRODUCT_SNAPSHOT);

const normalizeOptionalStock = (stock: unknown) => (stock === undefined ? undefined : normalizeStockLimit(stock));

const normalizeProductStatus = (status: unknown) => {
  const normalized = String(status || '').trim().toUpperCase();
  return normalized || 'ACTIVE';
};

const resolveProductSnapshotImage = (product: GuestCartProductInput) => {
  const primary = String(product.imageUrl || '').trim();
  if (primary) return primary;
  const galleryImage = Array.isArray(product.images)
    ? product.images.find((image) => String(image || '').trim())
    : '';
  return String(galleryImage || '').trim();
};

export type NormalizedGuestCartItem = CartItem & {
  readonly product?: never;
};

const isNormalizedGuestCartItem = (item: NormalizedGuestCartItem | null): item is NormalizedGuestCartItem => Boolean(item);

const normalizeCartItem = (item: unknown): NormalizedGuestCartItem | null => {
  const row = isRecord(item) ? item : {};
  const productSnapshot = toProductInput(row.product);
  const id = normalizeSafeId(row.id);
  const productId = normalizeSafeId(row.productId ?? productSnapshot.id);
  if (id === null || productId === null || productId <= 0) return null;
  const stock = row.stock === undefined ? productSnapshot.stock : row.stock;
  const productStatus = row.productStatus || productSnapshot.status;

  return {
    id,
    productId,
    quantity: normalizeGuestCartQuantity(row.quantity, stock),
    productName: String(row.productName || productSnapshot.name || '').trim(),
    imageUrl: row.imageUrl ? String(row.imageUrl).trim() : resolveProductSnapshotImage(productSnapshot),
    price: normalizePrice(row.price ?? productSnapshot.effectivePrice ?? productSnapshot.price),
    stock: normalizeOptionalStock(stock),
    productStatus: normalizeProductStatus(productStatus),
    freeShipping: Boolean(row.freeShipping ?? productSnapshot.freeShipping),
    freeShippingThreshold: normalizeOptionalNonNegativeMoney(row.freeShippingThreshold ?? productSnapshot.freeShippingThreshold),
    selectedSpecs: row.selectedSpecs ? String(row.selectedSpecs).trim() : undefined,
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

export const addGuestCartItem = (product: GuestCartProductInput | null | undefined, quantity = 1, selectedSpecs?: string, price?: number): CartItem | null => {
  const productInput = toProductInput(product);
  const items = readGuestCart();
  const productId = normalizePositiveProductId(productInput.id);
  const productName = String(productInput.name || '').trim();
  if (productId === null || !productName) {
    return null;
  }
  const normalizedSpecs = selectedSpecs ? String(selectedSpecs).trim().slice(0, 600) : undefined;
  const stockLimit = normalizeStockLimit(productInput.stock);
  const productStock = normalizeOptionalStock(productInput.stock);
  const productPrice = normalizePrice(price ?? productInput.effectivePrice ?? productInput.price);
  const normalizedQuantity = normalizeGuestCartQuantity(quantity, stockLimit);
  const existing = items.find((item) => item.productId === productId && (item.selectedSpecs || '') === (normalizedSpecs || ''));
  if (existing) {
    const updatedExisting: CartItem = {
      ...existing,
      quantity: normalizeGuestCartQuantity(existing.quantity + normalizedQuantity, stockLimit),
      price: productPrice,
      stock: productStock,
      productStatus: normalizeProductStatus(productInput.status),
      freeShipping: Boolean(productInput.freeShipping),
      freeShippingThreshold: normalizeOptionalNonNegativeMoney(productInput.freeShippingThreshold),
    };
    writeGuestCart(items.map((item) => (item.id === existing.id ? updatedExisting : item)));
    return updatedExisting;
  }

  const item: CartItem = {
    id: createLocalId(items.map((cartItem) => cartItem.id)),
    productId,
    quantity: normalizedQuantity,
    productName,
    imageUrl: resolveProductSnapshotImage(productInput),
    price: productPrice,
    stock: productStock,
    productStatus: normalizeProductStatus(productInput.status),
    freeShipping: Boolean(productInput.freeShipping),
    freeShippingThreshold: normalizeOptionalNonNegativeMoney(productInput.freeShippingThreshold),
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
