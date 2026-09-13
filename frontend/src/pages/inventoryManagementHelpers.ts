import type { AdminInventorySummary, Product } from '../types';

/** Mirrors the backend dashboard low-stock rule (`stock < 10`). */
export const LOW_STOCK_THRESHOLD = 10;
/** Stock at or below this level is treated as an imminent stockout. */
export const CRITICAL_STOCK_THRESHOLD = 5;

export type StockLevel = 'out' | 'critical' | 'low' | 'healthy';
export type StockAdjustMode = 'set' | 'increase' | 'decrease';

export type InventoryHealth = {
  outOfStock: number;
  critical: number;
  low: number;
  healthy: number;
  totalUnits: number;
  score: number;
};

export const EMPTY_INVENTORY_HEALTH: InventoryHealth = {
  outOfStock: 0,
  critical: 0,
  low: 0,
  healthy: 0,
  totalUnits: 0,
  score: 100,
};

export const getStockLevel = (stock?: number | null): StockLevel => {
  const safeStock = Number(stock ?? 0);
  const normalized = Number.isFinite(safeStock) ? Math.max(0, Math.trunc(safeStock)) : 0;
  if (normalized <= 0) return 'out';
  if (normalized <= CRITICAL_STOCK_THRESHOLD) return 'critical';
  if (normalized < LOW_STOCK_THRESHOLD) return 'low';
  return 'healthy';
};

export const resolveAdjustedStock = (
  currentStock: number | null | undefined,
  mode: StockAdjustMode,
  amount: number | null | undefined,
): number => {
  const safeCurrent = normalizeStockUnits(currentStock);
  const safeAmount = normalizeStockUnits(amount);
  if (mode === 'set') return safeAmount;
  if (mode === 'increase') return safeCurrent + safeAmount;
  return Math.max(0, safeCurrent - safeAmount);
};

export const deriveInventoryHealth = (products: Product[]): InventoryHealth => {
  const rows = Array.isArray(products) ? products : [];
  const counts = { out: 0, critical: 0, low: 0, healthy: 0, totalUnits: 0 };
  for (const product of rows) {
    counts[getStockLevel(product.stock)] += 1;
    counts.totalUnits += normalizeStockUnits(product.stock);
  }
  const score = rows.length === 0
    ? 100
    : Math.max(0, Math.round(((counts.healthy + counts.low * 0.5) / rows.length) * 100));

  return {
    outOfStock: counts.out,
    critical: counts.critical,
    low: counts.low,
    healthy: counts.healthy,
    totalUnits: counts.totalUnits,
    score,
  };
};

export const normalizeInventorySummary = (summary?: Partial<AdminInventorySummary> | null): InventoryHealth => ({
  outOfStock: normalizeStockUnits(summary?.outOfStock),
  critical: normalizeStockUnits(summary?.critical),
  low: normalizeStockUnits(summary?.low),
  healthy: normalizeStockUnits(summary?.healthy),
  totalUnits: normalizeStockUnits(summary?.totalUnits),
  score: Math.max(0, Math.min(100, Math.trunc(Number(summary?.score ?? 100) || 0))),
});

const normalizeStockUnits = (value?: number | null) => Math.max(0, Math.trunc(Number(value ?? 0) || 0));
