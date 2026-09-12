import type { ProductPublic } from '../types';
import { dispatchDomEvent } from './domEvents';
import { reportNonBlockingError } from './nonBlockingError';
import { getLocalStorageItem, setLocalStorageItem } from './safeStorage';

export const PRODUCT_VIEW_PREFERENCES_KEY = 'shop-product-view-preferences';
export const MAX_PRODUCT_VIEW_HISTORY_ITEMS = 30;

export type ProductViewPreferences = {
  categories: Record<string, number>;
  brands: Record<string, number>;
  tags: Record<string, number>;
  recent: number[];
  recentEntries: Array<{ productId: number; viewedAt: number }>;
  updatedAt?: number;
};

const emptyPreferences = (): ProductViewPreferences => ({
  categories: {},
  brands: {},
  tags: {},
  recent: [],
  recentEntries: [],
});

const normalizeScoreBucket = (value: unknown): Record<string, number> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const normalized: Record<string, number> = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, score]) => {
    const normalizedKey = String(key);
    const normalizedScore = Math.max(0, Math.min(Number(score) || 0, 999));
    if (normalizedKey && Number.isFinite(normalizedScore) && normalizedScore > 0) {
      normalized[normalizedKey] = normalizedScore;
    }
  });
  return normalized;
};

const normalizeRecentEntries = (value: unknown, recent: number[]) => {
  if (!Array.isArray(value)) {
    return recent.map((productId) => ({ productId, viewedAt: 0 }));
  }

  const seen = new Set<number>();
  const normalized: Array<{ productId: number; viewedAt: number }> = [];
  value.forEach((entry) => {
    if (normalized.length >= MAX_PRODUCT_VIEW_HISTORY_ITEMS) return;
    const productId = Number(entry?.productId ?? entry?.id);
    if (!Number.isSafeInteger(productId) || productId <= 0 || seen.has(productId)) return;
    seen.add(productId);
    normalized.push({ productId, viewedAt: Number(entry?.viewedAt ?? 0) });
  });
  return normalized;
};

export const loadProductViewPreferences = (): ProductViewPreferences => {
  try {
    const parsed = JSON.parse(getLocalStorageItem(PRODUCT_VIEW_PREFERENCES_KEY) || '{}');
    const recent: number[] = [];
    if (Array.isArray(parsed.recent)) {
      const seenRecent = new Set<number>();
      parsed.recent.forEach((value: unknown) => {
        const id = Number(value);
        if (!Number.isSafeInteger(id) || id <= 0 || seenRecent.has(id)) return;
        seenRecent.add(id);
        recent.push(id);
      });
    }
    const recentEntries = normalizeRecentEntries(parsed.recentEntries, recent);
    return {
      categories: normalizeScoreBucket(parsed.categories),
      brands: normalizeScoreBucket(parsed.brands),
      tags: normalizeScoreBucket(parsed.tags),
      recent: recent.slice(0, MAX_PRODUCT_VIEW_HISTORY_ITEMS),
      recentEntries,
      updatedAt: Number.isFinite(Number(parsed.updatedAt)) ? Number(parsed.updatedAt) : undefined,
    };
  } catch (error) {
    reportNonBlockingError('productViewPreferences.loadProductViewPreferences', error);
    return emptyPreferences();
  }
};

const saveProductViewPreferences = (preferences: ProductViewPreferences) => {
  setLocalStorageItem(PRODUCT_VIEW_PREFERENCES_KEY, JSON.stringify(preferences));
  dispatchDomEvent('shop:product-view-preferences-updated');
};

export const recordProductView = (product: Pick<ProductPublic, 'id' | 'categoryId' | 'brand' | 'tag'>) => {
  try {
    const preferences = loadProductViewPreferences();
    const now = Date.now();
    const productId = Number(product.id);
    if (!Number.isSafeInteger(productId) || productId <= 0) return;

    const bump = (bucket: Record<string, number>, value?: string | number) => {
      if (value === undefined || value === null || value === '') return;
      const key = String(value);
      bucket[key] = (bucket[key] || 0) + 1;
    };

    bump(preferences.categories, product.categoryId);
    bump(preferences.brands, product.brand);
    bump(preferences.tags, product.tag);
    const recent: number[] = [productId];
    const recentEntries: Array<{ productId: number; viewedAt: number }> = [{ productId, viewedAt: now }];
    preferences.recent.forEach((id) => {
      if (id !== productId && recent.length < MAX_PRODUCT_VIEW_HISTORY_ITEMS) recent.push(id);
    });
    preferences.recentEntries.forEach((entry) => {
      if (entry.productId !== productId && recentEntries.length < MAX_PRODUCT_VIEW_HISTORY_ITEMS) recentEntries.push(entry);
    });
    preferences.recent = recent;
    preferences.recentEntries = recentEntries;
    preferences.updatedAt = now;
    saveProductViewPreferences(preferences);
  } catch (error) {
    reportNonBlockingError('productViewPreferences.rememberProductView', error);
  }
};

export const clearProductViewHistory = () => {
  const preferences = loadProductViewPreferences();
  saveProductViewPreferences({
    ...preferences,
    categories: {},
    brands: {},
    tags: {},
    recent: [],
    recentEntries: [],
    updatedAt: Date.now(),
  });
};

export const removeProductViewHistoryItem = (productId: number) => {
  const normalizedProductId = Number(productId);
  if (!Number.isSafeInteger(normalizedProductId) || normalizedProductId <= 0) return;
  const preferences = loadProductViewPreferences();
  const recent: number[] = [];
  const recentEntries: Array<{ productId: number; viewedAt: number }> = [];
  preferences.recent.forEach((id) => {
    if (id !== normalizedProductId) recent.push(id);
  });
  preferences.recentEntries.forEach((entry) => {
    if (entry.productId !== normalizedProductId) recentEntries.push(entry);
  });
  saveProductViewPreferences({ ...preferences, recent, recentEntries, updatedAt: Date.now() });
};
