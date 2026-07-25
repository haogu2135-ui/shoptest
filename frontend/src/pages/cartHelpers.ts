import type { CartItem, ProductPublic as Product } from '../types';
import { getSavedForLaterItems, type SavedForLaterItem } from '../utils/saveForLater';
import {
  canCartItemCheckout as canCheckout,
  getCartLineAmount,
  getCartLineQuantity,
  roundCartMoney,
} from '../utils/cartUi';

export const RECENT_PRODUCTS_CACHE_MS = 2 * 60 * 1000;
export const RECENT_PRODUCTS_CACHE_MAX_ENTRIES = 50;
type RecentProductsCacheEntry = { expiresAt: number; products: Product[] };
const recentProductsCache = new Map<string, RecentProductsCacheEntry>();

export const pruneRecentProductsCache = (now = Date.now()) => {
  recentProductsCache.forEach((entry, key) => {
    if (entry.expiresAt <= now) {
      recentProductsCache.delete(key);
    }
  });
  while (recentProductsCache.size > RECENT_PRODUCTS_CACHE_MAX_ENTRIES) {
    const oldestKey = recentProductsCache.keys().next().value;
    if (!oldestKey) break;
    recentProductsCache.delete(oldestKey);
  }
};

export const getCachedRecentProducts = (cacheKey: string, now = Date.now()) => {
  const cached = recentProductsCache.get(cacheKey);
  if (!cached) {
    pruneRecentProductsCache(now);
    return null;
  }
  if (cached.expiresAt <= now) {
    recentProductsCache.delete(cacheKey);
    return null;
  }
  recentProductsCache.delete(cacheKey);
  recentProductsCache.set(cacheKey, cached);
  return cached.products;
};

export const setCachedRecentProducts = (cacheKey: string, products: Product[], now = Date.now()) => {
  pruneRecentProductsCache(now);
  recentProductsCache.delete(cacheKey);
  recentProductsCache.set(cacheKey, {
    expiresAt: now + RECENT_PRODUCTS_CACHE_MS,
    products,
  });
  pruneRecentProductsCache(now);
};

export const clearRecentProductsCache = () => {
  recentProductsCache.clear();
};

export const getSavedAgeDays = (savedAt?: number) => {
  if (!savedAt) return 0;
  return Math.max(0, Math.floor((Date.now() - savedAt) / 86400000));
};

export const getLineTotal = (item: Pick<CartItem, 'price' | 'quantity'> | Pick<SavedForLaterItem, 'price' | 'quantity'>) =>
  getCartLineAmount(item);

export const normalizeCartItems = (items: unknown): CartItem[] => (Array.isArray(items) ? items : []);

export const normalizeSavedForLaterItems = (items: unknown): SavedForLaterItem[] => (Array.isArray(items) ? items : []);

export const getSavedForLaterItemsSnapshot = () => normalizeSavedForLaterItems(getSavedForLaterItems());

export const normalizePositiveProductId = (value: unknown) => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

export const deriveCartCheckoutMetrics = (
  items: unknown,
  selectedIds: number[],
  canCheckoutItem: (item: CartItem) => boolean = canCheckout,
) => {
  const selectedIdSet = new Set(selectedIds);
  const nextSelectedItems: CartItem[] = [];
  const nextPurchasableItems: CartItem[] = [];
  const nextUnavailableItems: CartItem[] = [];
  let nextSelectedTotal = 0;
  let nextSelectedUnitCount = 0;
  let nextPurchasableUnitCount = 0;
  let nextSelectedPurchasableCount = 0;
  let selectedHasUnavailableItem = false;

  normalizeCartItems(items).forEach((item) => {
    const checkoutReady = canCheckoutItem(item);
    if (checkoutReady) {
      nextPurchasableItems.push(item);
      nextPurchasableUnitCount += getCartLineQuantity(item.quantity);
    } else {
      nextUnavailableItems.push(item);
    }

    if (!selectedIdSet.has(item.id)) return;
    nextSelectedItems.push(item);
    nextSelectedTotal += getLineTotal(item);
    nextSelectedUnitCount += getCartLineQuantity(item.quantity);
    if (checkoutReady) {
      nextSelectedPurchasableCount += 1;
    } else {
      selectedHasUnavailableItem = true;
    }
  });

  return {
    checkoutBlocked: nextSelectedPurchasableCount === 0 || selectedHasUnavailableItem,
    purchasableItems: nextPurchasableItems,
    purchasableUnitCount: nextPurchasableUnitCount,
    selectedItems: nextSelectedItems,
    selectedPurchasableCount: nextSelectedPurchasableCount,
    selectedTotal: roundCartMoney(nextSelectedTotal),
    selectedUnitCount: nextSelectedUnitCount,
    unavailableItems: nextUnavailableItems,
  };
};
