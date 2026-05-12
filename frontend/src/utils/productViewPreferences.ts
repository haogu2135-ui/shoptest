import type { Product } from '../types';

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

const normalizeRecentEntries = (value: unknown, recent: number[]) => {
  if (!Array.isArray(value)) {
    return recent.map((productId) => ({ productId, viewedAt: 0 }));
  }

  return value
    .map((entry) => ({
      productId: Number(entry?.productId ?? entry?.id),
      viewedAt: Number(entry?.viewedAt ?? 0),
    }))
    .filter((entry) => Number.isFinite(entry.productId) && entry.productId > 0);
};

export const loadProductViewPreferences = (): ProductViewPreferences => {
  try {
    const parsed = JSON.parse(localStorage.getItem(PRODUCT_VIEW_PREFERENCES_KEY) || '{}');
    const recent = Array.isArray(parsed.recent)
      ? parsed.recent.map(Number).filter((id: number) => Number.isFinite(id) && id > 0)
      : [];
    const recentEntries = normalizeRecentEntries(parsed.recentEntries, recent);
    return {
      categories: parsed.categories || {},
      brands: parsed.brands || {},
      tags: parsed.tags || {},
      recent,
      recentEntries,
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return emptyPreferences();
  }
};

const saveProductViewPreferences = (preferences: ProductViewPreferences) => {
  localStorage.setItem(PRODUCT_VIEW_PREFERENCES_KEY, JSON.stringify(preferences));
  window.dispatchEvent(new Event('shop:product-view-preferences-updated'));
};

export const recordProductView = (product: Pick<Product, 'id' | 'categoryId' | 'brand' | 'tag'>) => {
  try {
    const preferences = loadProductViewPreferences();
    const now = Date.now();
    const productId = Number(product.id);
    if (!Number.isFinite(productId) || productId <= 0) return;

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
  const preferences = loadProductViewPreferences();
  saveProductViewPreferences({
    ...preferences,
    recent: preferences.recent.filter((id) => id !== productId),
    recentEntries: preferences.recentEntries.filter((entry) => entry.productId !== productId),
    updatedAt: Date.now(),
  });
};
