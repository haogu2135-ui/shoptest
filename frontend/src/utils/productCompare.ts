import type { Product } from '../types';
import { dispatchDomEvent } from './domEvents';
import { reportNonBlockingError } from './nonBlockingError';
import { getLocalStorageItem, setLocalStorageItem } from './safeStorage';

const COMPARE_STORAGE_KEY = 'shop-product-compare';
export const MAX_COMPARE_ITEMS = 4;

export const readCompareProductIds = (): number[] => {
  try {
    const parsed = JSON.parse(getLocalStorageItem(COMPARE_STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return Array.from(new Set(parsed.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))).slice(0, MAX_COMPARE_ITEMS);
  } catch (error) {
    reportNonBlockingError('productCompare.readCompareProductIds', error);
    return [];
  }
};

const writeCompareProductIds = (ids: number[]) => {
  const normalizedIds = Array.from(new Set(ids.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))).slice(0, MAX_COMPARE_ITEMS);
  setLocalStorageItem(COMPARE_STORAGE_KEY, JSON.stringify(normalizedIds));
  dispatchDomEvent('shop:compare-updated');
};

export const isProductCompared = (productId: number) => readCompareProductIds().includes(Number(productId));

export const addCompareProduct = (product: Pick<Product, 'id'>) => {
  const productId = Number(product.id);
  if (!Number.isSafeInteger(productId) || productId <= 0) {
    return { status: 'invalid' as const, ids: readCompareProductIds() };
  }
  const current = readCompareProductIds();
  if (current.includes(productId)) return { status: 'exists' as const, ids: current };
  if (current.length >= MAX_COMPARE_ITEMS) return { status: 'full' as const, ids: current };
  const next = [...current, productId];
  writeCompareProductIds(next);
  return { status: 'added' as const, ids: next };
};

export const removeCompareProduct = (productId: number) => {
  const normalizedProductId = Number(productId);
  const next = readCompareProductIds().filter((id) => id !== normalizedProductId);
  writeCompareProductIds(next);
  return next;
};

export const clearCompareProducts = () => writeCompareProductIds([]);
