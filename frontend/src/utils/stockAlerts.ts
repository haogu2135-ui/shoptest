import type { ProductPublic } from '../types';
import { dispatchDomEvent } from './domEvents';
import { reportNonBlockingError } from './nonBlockingError';
import { getLocalStorageItem, setLocalStorageItem } from './safeStorage';

const STORAGE_KEY = 'shop-stock-alerts';
const MAX_ALERTS = 50;
const MAX_PRODUCT_NAME_LENGTH = 160;
const MAX_IMAGE_URL_LENGTH = 1000;

const normalizePositiveId = (value: unknown) => {
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : null;
};

const normalizeCreatedAt = (value: unknown) => {
  const text = String(value || '').trim();
  const timestamp = new Date(text).getTime();
  return Number.isFinite(timestamp) ? text : new Date().toISOString();
};

export type StockAlertItem = {
  productId: number;
  productName: string;
  imageUrl?: string;
  createdAt: string;
};

const normalizeProductName = (value: unknown) => String(value || '').trim().slice(0, MAX_PRODUCT_NAME_LENGTH);

const normalizeImageUrl = (value: unknown) => {
  if (!value) return undefined;
  const normalized = String(value).trim().slice(0, MAX_IMAGE_URL_LENGTH);
  return normalized || undefined;
};

const normalizeStoredAlert = (item: Partial<StockAlertItem> | null | undefined): StockAlertItem | null => {
  const productId = normalizePositiveId(item?.productId);
  const productName = normalizeProductName(item?.productName);
  if (productId === null || !productName) return null;
  return {
    productId,
    productName,
    imageUrl: normalizeImageUrl(item?.imageUrl),
    createdAt: normalizeCreatedAt(item?.createdAt),
  };
};

const readRaw = (): StockAlertItem[] => {
  try {
    const parsed = JSON.parse(getLocalStorageItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    const seenProductIds = new Set<number>();
    const items: StockAlertItem[] = [];
    for (const item of parsed) {
      const normalized = normalizeStoredAlert(item);
      if (!normalized || seenProductIds.has(normalized.productId)) continue;
      seenProductIds.add(normalized.productId);
      items.push(normalized);
    }
    return items;
  } catch (error) {
    reportNonBlockingError('stockAlerts.readRaw', error);
    return [];
  }
};

const writeRaw = (items: StockAlertItem[]) => {
  const seenProductIds = new Set<number>();
  const normalizedItems: StockAlertItem[] = [];
  for (const item of items) {
    if (normalizedItems.length >= MAX_ALERTS) break;
    const normalized = normalizeStoredAlert(item);
    if (!normalized || seenProductIds.has(normalized.productId)) continue;
    seenProductIds.add(normalized.productId);
    normalizedItems.push(normalized);
  }
  setLocalStorageItem(STORAGE_KEY, JSON.stringify(normalizedItems));
  dispatchDomEvent('shop:stock-alerts-updated');
};

export const readStockAlerts = () => readRaw();

export const hasStockAlert = (productId: number) => {
  const normalizedProductId = normalizePositiveId(productId);
  return normalizedProductId !== null && readRaw().some((item) => item.productId === normalizedProductId);
};

export const addStockAlert = (product: Pick<ProductPublic, 'id' | 'name' | 'imageUrl'>) => {
  const productId = normalizePositiveId(product.id);
  const productName = normalizeProductName(product.name);
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
      imageUrl: normalizeImageUrl(product.imageUrl),
      createdAt: new Date().toISOString(),
    },
    ...current,
  ];
  writeRaw(next);
  return { status: 'added' as const, items: next };
};

export const removeStockAlert = (productId: number) => {
  const normalizedProductId = normalizePositiveId(productId);
  const current = readRaw();
  const next = normalizedProductId === null ? current : current.filter((item) => item.productId !== normalizedProductId);
  writeRaw(next);
  return next;
};

export const clearStockAlerts = () => writeRaw([]);
