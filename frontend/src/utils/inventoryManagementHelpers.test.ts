import {
  deriveInventoryHealth,
  getStockLevel,
  normalizeInventorySummary,
  resolveAdjustedStock,
} from '../pages/inventoryManagementHelpers';
import type { Product } from '../types';

describe('InventoryManagement commercial inventory contracts', () => {
  it('classifies stock levels at the operational thresholds', () => {
    expect(getStockLevel(0)).toBe('out');
    expect(getStockLevel(5)).toBe('critical');
    expect(getStockLevel(9)).toBe('low');
    expect(getStockLevel(10)).toBe('healthy');
  });

  it('never permits a stock adjustment to produce negative or fractional inventory', () => {
    expect(resolveAdjustedStock(7, 'decrease', 20)).toBe(0);
    expect(resolveAdjustedStock(7, 'increase', 2.9)).toBe(9);
    expect(resolveAdjustedStock(7, 'set', -3)).toBe(0);
  });

  it('derives and normalizes inventory health defensively', () => {
    const products = [{ stock: 0 }, { stock: 4 }, { stock: 8 }, { stock: 20 }] as Product[];
    expect(deriveInventoryHealth(products)).toEqual({
      outOfStock: 1, critical: 1, low: 1, healthy: 1, totalUnits: 32, score: 38,
    });
    expect(normalizeInventorySummary({ score: 140, totalUnits: -10 })).toEqual({
      outOfStock: 0, critical: 0, low: 0, healthy: 0, totalUnits: 0, score: 100,
    });
  });
});
