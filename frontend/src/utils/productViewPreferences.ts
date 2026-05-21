import type { Product } from '../types';
import { dispatchDomEvent } from './domEvents';
import { getLocalStorageItem, setLocalStorageItem } from './safeStorage';

export const PRODUCT_VIEW_PREFERENCES_KEY = 'shop-product-view-preferences';

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
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, score]) => [String(key), Math.max(0, Math.min(Number(score) || 0, 999))] as const)
      .filter(([key, score]) => key && Number.isFinite(score) && score > 0),
  );
};

const normalizeRecentEntries = (value: unknown, recent: number[]) => {
  if (!Array.isArray(value)) {
    return recent.map((productId) => ({ productId, viewedAt: 0 }));
  }

  const seen = new Set<number>();
  return value
    .map((entry) => ({
      productId: Number(entry?.productId ?? entry?.id),
      viewedAt: Number(entry?.viewedAt ?? 0),
    }))
    .filter((entry) => {
      if (!Number.isSafeInteger(entry.productId) || entry.productId <= 0 || seen.has(entry.productId)) return false;
      seen.add(entry.productId);
      return true;
    })
    .slice(0, 30);
};

export const loadProductViewPreferences = (): ProductViewPreferences => {
  try {
    const parsed = JSON.parse(getLocalStorageItem(PRODUCT_VIEW_PREFERENCES_KEY) || '{}');
    const recent: number[] = Array.isArray(parsed.recent)
      ? parsed.recent.map(Number).filter((id: number) => Number.isSafeInteger(id) && id > 0)
      : [];
    const recentEntries = normalizeRecentEntries(parsed.recentEntries, recent);
    return {
      categories: normalizeScoreBucket(parsed.categories),
      brands: normalizeScoreBucket(parsed.brands),
      tags: normalizeScoreBucket(parsed.tags),
      recent: Array.from(new Set(recent)).slice(0, 30),
      recentEntries,
      updatedAt: Number.isFinite(Number(parsed.updatedAt)) ? Number(parsed.updatedAt) : undefined,
    };
  } catch {
    return emptyPreferences();
  }
};

const saveProductViewPreferences = (preferences: ProductViewPreferences) => {
  setLocalStorageItem(PRODUCT_VIEW_PREFERENCES_KEY, JSON.stringify(preferences));
  dispatchDomEvent('shop:product-view-preferences-updated');
};

export const recordProductView = (product: Pick<Product, 'id' | 'categoryId' | 'brand' | 'tag'>) => {
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
    preferences.recent = [productId, ...preferences.recent.filter((id) => id !== productId)].slice(0, 30);
    preferences.recentEntries = [
      { productId, viewedAt: now },
      ...preferences.recentEntries.filter((entry) => entry.productId !== productId),
    ].slice(0, 30);
    preferences.updatedAt = now;
    saveProductViewPreferences(preferences);
  } catch {
    // View tracking is best-effort only.
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
  saveProductViewPreferences({
    ...preferences,
    recent: preferences.recent.filter((id) => id !== normalizedProductId),
    recentEntries: preferences.recentEntries.filter((entry) => entry.productId !== normalizedProductId),
    updatedAt: Date.now(),
  });
};
