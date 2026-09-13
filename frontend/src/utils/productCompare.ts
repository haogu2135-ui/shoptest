import type { Product } from '../types';
import { dispatchDomEvent } from './domEvents';
import { reportNonBlockingError } from './nonBlockingError';
import { getLocalStorageItem, setLocalStorageItem } from './safeStorage';

const COMPARE_STORAGE_KEY = 'shop-product-compare';
export const MAX_COMPARE_ITEMS = 4;

const normalizeCompareProductIds = (values: unknown[]) => {
  const normalized: number[] = [];
  const seen = new Set<number>();
  for (const value of values) {
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id <= 0 || seen.has(id)) continue;
    if (normalized.length >= MAX_COMPARE_ITEMS) break;
    seen.add(id);
    normalized.push(id);
  }
  return normalized;
};

export const readCompareProductIds = (): number[] => {
  try {
    const parsed = JSON.parse(getLocalStorageItem(COMPARE_STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return normalizeCompareProductIds(parsed);
  } catch (error) {
    reportNonBlockingError('productCompare.readCompareProductIds', error);
    return [];
  }
};

const writeCompareProductIds = (ids: number[]) => {
  const normalizedIds = normalizeCompareProductIds(ids);
  setLocalStorageItem(COMPARE_STORAGE_KEY, JSON.stringify(normalizedIds));
  dispatchDomEvent('shop:compare-updated');
};

export const isProductCompared = (productId: number) => {
  const normalizedProductId = Number(productId);
  for (const id of readCompareProductIds()) {
    if (id === normalizedProductId) return true;
  }
  return false;
};

export const addCompareProduct = (product: Pick<Product, 'id'>) => {
  const productId = Number(product.id);
  if (!Number.isSafeInteger(productId) || productId <= 0) {
    return { status: 'invalid' as const, ids: readCompareProductIds() };
  }
  const current = readCompareProductIds();
  if (current.includes(productId)) return { status: 'exists' as const, ids: current };
  if (current.length >= MAX_COMPARE_ITEMS) return { status: 'full' as const, ids: current };
  const next = current.slice();
  next.push(productId);
  writeCompareProductIds(next);
  return { status: 'added' as const, ids: next };
};

export const removeCompareProduct = (productId: number) => {
  const normalizedProductId = Number(productId);
  const current = readCompareProductIds();
  const next: number[] = [];
  for (const id of current) {
    if (id !== normalizedProductId) next.push(id);
  }
  writeCompareProductIds(next);
  return next;
};

export const clearCompareProducts = () => writeCompareProductIds([]);
