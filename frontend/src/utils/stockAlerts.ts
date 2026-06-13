import type { ProductPublic } from '../types';
import { dispatchDomEvent } from './domEvents';
import { reportNonBlockingError } from './nonBlockingError';
import { getLocalStorageItem, setLocalStorageItem } from './safeStorage';

const STORAGE_KEY = 'shop-stock-alerts';
const MAX_ALERTS = 50;

const normalizePositiveId = (value: unknown) => {
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : null;
};

const normalizeCreatedAt = (value: unknown) => {
  const text = String(value || '').trim();
  return Number.isFinite(new Date(text).getTime()) ? text : new Date().toISOString();
};

export type StockAlertItem = {
  productId: number;
  productName: string;
  imageUrl?: string;
  createdAt: string;
};

const readRaw = (): StockAlertItem[] => {
  try {
    const parsed = JSON.parse(getLocalStorageItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    const seenProductIds = new Set<number>();
    return parsed
      .map((item) => ({
        productId: normalizePositiveId(item?.productId),
        productName: String(item?.productName || '').trim().slice(0, 160),
        imageUrl: item?.imageUrl ? String(item.imageUrl).trim().slice(0, 1000) : undefined,
        createdAt: normalizeCreatedAt(item?.createdAt),
      }))
      .filter((item) => {
        if (item.productId === null || !item.productName || seenProductIds.has(item.productId)) {
          return false;
        }
        seenProductIds.add(item.productId);
        return true;
      }) as StockAlertItem[];
  } catch (error) {
    reportNonBlockingError('stockAlerts.readRaw', error);
    return [];
  }
};

const writeRaw = (items: StockAlertItem[]) => {
  const seenProductIds = new Set<number>();
  const normalizedItems = items.map((item) => ({
    ...item,
    productId: normalizePositiveId(item.productId),
    productName: String(item.productName || '').trim().slice(0, 160),
    imageUrl: item.imageUrl ? String(item.imageUrl).trim().slice(0, 1000) : undefined,
    createdAt: normalizeCreatedAt(item.createdAt),
  })).filter((item) => {
    if (item.productId === null || !item.productName || seenProductIds.has(item.productId)) {
      return false;
    }
    seenProductIds.add(item.productId);
    return true;
  }).slice(0, MAX_ALERTS) as StockAlertItem[];
  setLocalStorageItem(STORAGE_KEY, JSON.stringify(normalizedItems));
  dispatchDomEvent('shop:stock-alerts-updated');
};

export const readStockAlerts = () => readRaw();

export const hasStockAlert = (productId: number) => readRaw().some((item) => item.productId === productId);

export const addStockAlert = (product: Pick<ProductPublic, 'id' | 'name' | 'imageUrl'>) => {
  const productId = normalizePositiveId(product.id);
  const productName = String(product.name || '').trim().slice(0, 160);
  if (productId === null || !productName) {
    return { status: 'invalid' as const, items: readRaw() };
  }
  const current = readRaw();
  if (current.some((item) => item.productId === productId)) {
    return { status: 'exists' as const, items: current };
  }
  const next = [
    {
      productId,
      productName,
      imageUrl: product.imageUrl ? String(product.imageUrl).trim().slice(0, 1000) : undefined,
      createdAt: new Date().toISOString(),
    },
    ...current,
  ];
  writeRaw(next);
  return { status: 'added' as const, items: next };
};

export const removeStockAlert = (productId: number) => {
  const normalizedProductId = normalizePositiveId(productId);
  const next = normalizedProductId === null ? readRaw() : readRaw().filter((item) => item.productId !== normalizedProductId);
  writeRaw(next);
  return next;
};

export const clearStockAlerts = () => writeRaw([]);
