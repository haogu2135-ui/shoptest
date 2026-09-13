import type { CartItem } from '../types';
import { createLocalId } from './localIds';
import { dispatchDomEvent } from './domEvents';
import { getLocalStorageItem, setLocalStorageItem } from './safeStorage';
import { reportNonBlockingError } from './nonBlockingError';
import { normalizePositiveProductId } from './cartUi';

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

export type GuestCartProductInput = {
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
};

const EMPTY_PRODUCT_SNAPSHOT: GuestCartProductInput = {};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const toProductInput = (value: unknown): GuestCartProductInput => (
  isRecord(value) ? (value as GuestCartProductInput) : EMPTY_PRODUCT_SNAPSHOT
);

const normalizeOptionalStock = (stock: unknown) => (stock === undefined ? undefined : normalizeStockLimit(stock));

const normalizeProductStatus = (status: unknown) => {
  const normalized = String(status || '').trim().toUpperCase();
  return normalized || 'ACTIVE';
};

const resolveProductSnapshotImage = (product: GuestCartProductInput) => {
  const primary = String(product.imageUrl || '').trim();
  if (primary) return primary;
  let galleryImage = '';
  if (Array.isArray(product.images)) {
    for (const image of product.images) {
      const candidate = String(image || '').trim();
      if (candidate) {
        galleryImage = candidate;
        break;
      }
    }
  }
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
    const raw = getLocalStorageItem(GUEST_CART_KEY) || '[]';
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const normalizedItems: NormalizedGuestCartItem[] = [];
    let hasLegacyNestedProduct = false;
    for (const item of parsed) {
      if (isRecord(item) && Object.prototype.hasOwnProperty.call(item, 'product')) {
        hasLegacyNestedProduct = true;
      }
      const normalized = normalizeCartItem(item);
      if (isNormalizedGuestCartItem(normalized)) normalizedItems.push(normalized);
    }
    if (hasLegacyNestedProduct) {
      setLocalStorageItem(GUEST_CART_KEY, JSON.stringify(normalizedItems));
    }
    return normalizedItems;
  } catch (error) {
    reportNonBlockingError('guestCart.readGuestCart parse failed', error);
    return [];
  }
};

const writeGuestCart = (items: CartItem[]) => {
  const normalizedItems: NormalizedGuestCartItem[] = [];
  for (const item of items) {
    const normalized = normalizeCartItem(item);
    if (isNormalizedGuestCartItem(normalized)) normalizedItems.push(normalized);
  }
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

export const addGuestCartItem = (product: unknown, quantity = 1, selectedSpecs?: string, price?: number): CartItem | null => {
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
  let existingIndex = -1;
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (item.productId === productId && (item.selectedSpecs || '') === (normalizedSpecs || '')) {
      existingIndex = index;
      break;
    }
  }
  if (existingIndex >= 0) {
    const existing = items[existingIndex];
    const updatedExisting: CartItem = {
      ...existing,
      quantity: normalizeGuestCartQuantity(existing.quantity + normalizedQuantity, stockLimit),
      price: productPrice,
      stock: productStock,
      productStatus: normalizeProductStatus(productInput.status),
      freeShipping: Boolean(productInput.freeShipping),
      freeShippingThreshold: normalizeOptionalNonNegativeMoney(productInput.freeShippingThreshold),
    };
    items[existingIndex] = updatedExisting;
    writeGuestCart(items);
    return updatedExisting;
  }

  const existingIds = new Set<number>();
  for (const cartItem of items) existingIds.add(cartItem.id);
  const item: CartItem = {
    id: createLocalId(existingIds),
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
  const items = readGuestCart();
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (item.id === itemId) {
      items[index] = { ...item, quantity: normalizeGuestCartQuantity(quantity, item.stock) };
      break;
    }
  }
  writeGuestCart(items);
  return items;
};

export const removeGuestCartItem = (itemId: number) => {
  const storedItems = readGuestCart();
  const items: NormalizedGuestCartItem[] = [];
  for (const item of storedItems) {
    if (item.id !== itemId) items.push(item);
  }
  writeGuestCart(items);
  return items;
};

export const removeGuestCartItems = (itemIds: number[]) => {
  const targetIds = new Set(itemIds);
  const items: NormalizedGuestCartItem[] = [];
  for (const item of readGuestCart()) {
    if (!targetIds.has(item.id)) items.push(item);
  }
  writeGuestCart(items);
  return items;
};
