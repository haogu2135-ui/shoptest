import type { Product } from '../types';

const COMPARE_STORAGE_KEY = 'shop-product-compare';
export const MAX_COMPARE_ITEMS = 4;

export const readCompareProductIds = (): number[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(COMPARE_STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return Array.from(new Set(parsed.map(Number).filter((id) => Number.isFinite(id) && id > 0))).slice(0, MAX_COMPARE_ITEMS);
  } catch {
    return [];
  }
};

const writeCompareProductIds = (ids: number[]) => {
  localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(ids.slice(0, MAX_COMPARE_ITEMS)));
  window.dispatchEvent(new Event('shop:compare-updated'));
};

export const isProductCompared = (productId: number) => readCompareProductIds().includes(productId);

export const addCompareProduct = (product: Pick<Product, 'id'>) => {
  const current = readCompareProductIds();
  if (current.includes(product.id)) return { status: 'exists' as const, ids: current };
  if (current.length >= MAX_COMPARE_ITEMS) return { status: 'full' as const, ids: current };
  const next = [...current, product.id];
  writeCompareProductIds(next);
  return { status: 'added' as const, ids: next };
};

export const removeCompareProduct = (productId: number) => {
  const next = readCompareProductIds().filter((id) => id !== productId);
  writeCompareProductIds(next);
  return next;
};

export const clearCompareProducts = () => writeCompareProductIds([]);
