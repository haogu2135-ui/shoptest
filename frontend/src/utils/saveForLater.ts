import type { CartItem } from '../types';
import { createLocalId } from './localIds';

const SAVE_FOR_LATER_KEY = 'shop-save-for-later';

export type SavedForLaterItem = CartItem & {
  savedAt: number;
  sourceCartItemId?: number;
};

const readSavedItems = (): SavedForLaterItem[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVE_FOR_LATER_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeSavedItems = (items: SavedForLaterItem[]) => {
  localStorage.setItem(SAVE_FOR_LATER_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event('shop:save-for-later-updated'));
};

export const getSavedForLaterItems = () => readSavedItems();

export const saveCartItemForLater = (item: CartItem) => {
  const items = readSavedItems();
  const existingIndex = items.findIndex(
    (savedItem) => savedItem.productId === item.productId && (savedItem.selectedSpecs || '') === (item.selectedSpecs || ''),
  );
  const savedItem: SavedForLaterItem = {
    ...item,
    id: createLocalId(items.map((savedItem) => savedItem.id)),
    quantity: Math.max(1, item.quantity),
    savedAt: Date.now(),
    sourceCartItemId: item.id,
  };

  if (existingIndex >= 0) {
    items[existingIndex] = {
      ...items[existingIndex],
      ...savedItem,
      quantity: items[existingIndex].quantity + savedItem.quantity,
    };
    writeSavedItems(items);
    return items[existingIndex];
  }

  writeSavedItems([savedItem, ...items].slice(0, 40));
  return savedItem;
};

export const removeSavedForLaterItem = (itemId: number) => {
  const items = readSavedItems().filter((item) => item.id !== itemId);
  writeSavedItems(items);
  return items;
};

export const removeSavedForLaterProduct = (productId: number, selectedSpecs?: string | null) => {
  const items = readSavedItems().filter(
    (item) => !(item.productId === productId && (item.selectedSpecs || '') === (selectedSpecs || '')),
  );
  writeSavedItems(items);
  return items;
};

export const clearSavedForLaterItems = () => writeSavedItems([]);
