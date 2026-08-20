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
  const safeCurrent = Math.max(0, Math.trunc(Number(currentStock ?? 0) || 0));
  const safeAmount = Math.max(0, Math.trunc(Number(amount ?? 0) || 0));
  if (mode === 'set') return safeAmount;
  if (mode === 'increase') return safeCurrent + safeAmount;
  return Math.max(0, safeCurrent - safeAmount);
};

export const deriveInventoryHealth = (products: Product[]): InventoryHealth => {
  const rows = Array.isArray(products) ? products : [];
  const counts = rows.reduce(
    (acc, product) => {
      acc[getStockLevel(product.stock)] += 1;
      acc.totalUnits += Math.max(0, Math.trunc(Number(product.stock ?? 0) || 0));
      return acc;
    },
    { out: 0, critical: 0, low: 0, healthy: 0, totalUnits: 0 },
  );
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
  outOfStock: Math.max(0, Math.trunc(Number(summary?.outOfStock ?? 0) || 0)),
  critical: Math.max(0, Math.trunc(Number(summary?.critical ?? 0) || 0)),
  low: Math.max(0, Math.trunc(Number(summary?.low ?? 0) || 0)),
  healthy: Math.max(0, Math.trunc(Number(summary?.healthy ?? 0) || 0)),
  totalUnits: Math.max(0, Math.trunc(Number(summary?.totalUnits ?? 0) || 0)),
  score: Math.max(0, Math.min(100, Math.trunc(Number(summary?.score ?? 100) || 0))),
});
