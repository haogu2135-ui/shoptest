import type { Product } from '../types';

const STORAGE_KEY = 'shop-stock-alerts';

export type StockAlertItem = {
  productId: number;
  productName: string;
  imageUrl?: string;
  createdAt: string;
};

const readRaw = (): StockAlertItem[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        productId: Number(item?.productId),
        productName: String(item?.productName || '').trim(),
        imageUrl: item?.imageUrl ? String(item.imageUrl) : undefined,
        createdAt: String(item?.createdAt || new Date().toISOString()),
      }))
      .filter((item) => Number.isFinite(item.productId) && item.productId > 0 && item.productName);
  } catch {
    return [];
  }
};

const writeRaw = (items: StockAlertItem[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event('shop:stock-alerts-updated'));
};

export const readStockAlerts = () => readRaw();

export const hasStockAlert = (productId: number) => readRaw().some((item) => item.productId === productId);

export const addStockAlert = (product: Pick<Product, 'id' | 'name' | 'imageUrl'>) => {
  const current = readRaw();
  if (current.some((item) => item.productId === product.id)) {
    return { status: 'exists' as const, items: current };
  }
  const next = [
    {
      productId: product.id,
      productName: product.name,
      imageUrl: product.imageUrl,
      createdAt: new Date().toISOString(),
    },
    ...current,
  ];
  writeRaw(next);
  return { status: 'added' as const, items: next };
};

export const removeStockAlert = (productId: number) => {
  const next = readRaw().filter((item) => item.productId !== productId);
  writeRaw(next);
  return next;
};

export const clearStockAlerts = () => writeRaw([]);
