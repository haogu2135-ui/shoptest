import type { CartItem } from '../types';
import { createLocalId } from './localIds';
import { dispatchDomEvent } from './domEvents';
import { reportNonBlockingError } from './nonBlockingError';
import { getLocalStorageItem, setLocalStorageItem } from './safeStorage';

export const SAVE_FOR_LATER_STORAGE_KEY = 'shop-save-for-later';
const MAX_SAVED_ITEM_QUANTITY = 99;
const MAX_SAVED_ITEMS = 40;

export type SavedForLaterItem = CartItem & {
  savedAt: number;
  sourceCartItemId?: number;
};

const normalizeSavedItemQuantity = (quantity: unknown) => {
  const numeric = Number(quantity);
  const requested = Number.isFinite(numeric) ? Math.floor(numeric) : 1;
  return Math.max(1, Math.min(requested, MAX_SAVED_ITEM_QUANTITY));
};

const normalizeSafeInteger = (value: unknown) => {
  if (value === undefined || value === null || value === '') return null;
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) ? numeric : null;
};

const normalizePositiveInteger = (value: unknown) => {
  const numeric = normalizeSafeInteger(value);
  return numeric !== null && numeric > 0 ? numeric : null;
};

const normalizeSavedAt = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : Date.now();
};

const normalizeSavedItem = (item: Partial<SavedForLaterItem>): SavedForLaterItem | null => {
  const id = normalizeSafeInteger(item.id);
  const productId = normalizePositiveInteger(item.productId);
  if (id === null || id === 0 || productId === null) {
    return null;
  }
  return {
    ...(item as SavedForLaterItem),
    id,
    productId,
    quantity: normalizeSavedItemQuantity(item.quantity),
    savedAt: normalizeSavedAt(item.savedAt),
    sourceCartItemId: normalizeSafeInteger(item.sourceCartItemId) ?? undefined,
    selectedSpecs: item.selectedSpecs ? String(item.selectedSpecs).trim().slice(0, 600) : undefined,
  };
};

const normalizeSavedItems = (items: unknown): SavedForLaterItem[] => (
  Array.isArray(items) ? items.map((item) => normalizeSavedItem(item as Partial<SavedForLaterItem>)).filter(Boolean) as SavedForLaterItem[] : []
);

const readSavedItems = (): SavedForLaterItem[] => {
  try {
    const parsed = JSON.parse(getLocalStorageItem(SAVE_FOR_LATER_STORAGE_KEY) || '[]');
    return normalizeSavedItems(parsed);
  } catch (error) {
    reportNonBlockingError('saveForLater.readSavedItems', error);
    return [];
  }
};

const writeSavedItems = (items: SavedForLaterItem[]) => {
  const stored = setLocalStorageItem(SAVE_FOR_LATER_STORAGE_KEY, JSON.stringify(normalizeSavedItems(items)));
  if (stored) {
    dispatchDomEvent('shop:save-for-later-updated');
  }
  return stored;
};

export const getSavedForLaterItems = (): SavedForLaterItem[] => normalizeSavedItems(readSavedItems());

export const replaceSavedForLaterItems = (items: SavedForLaterItem[]) => writeSavedItems(normalizeSavedItems(items));

export const saveCartItemForLater = (item: CartItem) => {
  const items = readSavedItems();
  const normalizedItem = normalizeSavedItem(item);
  if (!normalizedItem) {
    return null;
  }
  const selectedSpecs = normalizedItem.selectedSpecs || '';
  const existingIndex = items.findIndex(
    (savedItem) => savedItem.productId === normalizedItem.productId && (savedItem.selectedSpecs || '') === selectedSpecs,
  );
  const savedItem: SavedForLaterItem = {
    ...normalizedItem,
    id: createLocalId(items.map((savedItem) => savedItem.id)),
    quantity: normalizeSavedItemQuantity(normalizedItem.quantity),
    savedAt: Date.now(),
    sourceCartItemId: normalizedItem.id,
  };

  if (existingIndex >= 0) {
    const mergedItem = {
      ...items[existingIndex],
      ...savedItem,
      quantity: normalizeSavedItemQuantity(items[existingIndex].quantity + savedItem.quantity),
    };
    const nextItems = [...items];
    nextItems[existingIndex] = mergedItem;
    return writeSavedItems(nextItems) ? mergedItem : null;
  }

  return writeSavedItems([savedItem, ...items].slice(0, MAX_SAVED_ITEMS)) ? savedItem : null;
};

export const removeSavedForLaterItem = (itemId: number) => {
  const normalizedItemId = normalizeSafeInteger(itemId);
  const items = normalizedItemId === null ? readSavedItems() : readSavedItems().filter((item) => item.id !== normalizedItemId);
  writeSavedItems(items);
  return items;
};

export const removeSavedForLaterProduct = (productId: number, selectedSpecs?: string | null) => {
  const normalizedProductId = normalizePositiveInteger(productId);
  const normalizedSpecs = selectedSpecs ? String(selectedSpecs).trim().slice(0, 600) : '';
  if (normalizedProductId === null) return readSavedItems();
  const items = readSavedItems().filter(
    (item) => !(item.productId === normalizedProductId && (item.selectedSpecs || '') === normalizedSpecs),
  );
  writeSavedItems(items);
  return items;
};

export const clearSavedForLaterItems = () => writeSavedItems([]);
