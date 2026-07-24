import type { ReactNode } from 'react';
import type { ProductPublic as Product } from '../types';
import { productImageFallback, resolveProductImage } from '../utils/productMedia';
import { needsOptionSelection } from '../utils/productOptions';

export const compareImageFallback = productImageFallback;
export const resolveCompareImage = resolveProductImage;

export const getPrice = (product: Product) => product.effectivePrice ?? product.price;

export const HIDDEN_SPEC_PREFIXES = ['options.', 'i18n.', 'bundle.'];

export const PRIORITY_SPEC_KEYS = [
  'Pet Size',
  'Capacity',
  'Material',
  'Color',
  'Size',
  'Weight',
  'Volume',
  'Pack',
  'Filter',
  'Formula',
  'Closure',
  'Care',
  'Flavor',
  'Life Stage',
  'Coat Type',
];

export type CompareRow = {
  key: string;
  label: ReactNode;
  rawLabel?: string;
  isDifferent?: boolean;
  alwaysVisible?: boolean;
  render: (product: Product) => ReactNode;
};

export const isHiddenSpecKey = (key: string) => {
  const normalized = key.trim().toLowerCase();
  return HIDDEN_SPEC_PREFIXES.some((prefix) => normalized.startsWith(prefix));
};

export const normalizeSpecValue = (value?: string | null) =>
  String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();

export const valuesDiffer = (products: Product[], getValue: (product: Product) => string | number | undefined | null) =>
  products.length > 1 && new Set(products.map((product) => normalizeSpecValue(String(getValue(product) ?? '')))).size > 1;

export const getSpecValue = (product: Product, specKey: string) => {
  const normalizedKey = specKey.trim().toLowerCase();
  const matchedEntry = Object.entries(product.specifications || {}).find(([key]) =>
    !isHiddenSpecKey(key) && key.trim().toLowerCase() === normalizedKey
  );
  return matchedEntry ? String(matchedEntry[1] || '').trim() : '';
};

export const collectCompareSpecKeys = (products: Product[]) => {
  const keyByNormalized = new Map<string, string>();
  products.forEach((product) => {
    Object.keys(product.specifications || {}).forEach((rawKey) => {
      const key = rawKey.trim();
      if (!key || isHiddenSpecKey(key)) return;
      const normalized = key.toLowerCase();
      if (!keyByNormalized.has(normalized)) {
        keyByNormalized.set(normalized, key);
      }
    });
  });
  return Array.from(keyByNormalized.values()).sort((left, right) => {
    const leftPriority = PRIORITY_SPEC_KEYS.findIndex((key) => key.toLowerCase() === left.toLowerCase());
    const rightPriority = PRIORITY_SPEC_KEYS.findIndex((key) => key.toLowerCase() === right.toLowerCase());
    if (leftPriority !== -1 || rightPriority !== -1) {
      return (leftPriority === -1 ? Number.MAX_SAFE_INTEGER : leftPriority)
        - (rightPriority === -1 ? Number.MAX_SAFE_INTEGER : rightPriority);
    }
    return left.localeCompare(right);
  });
};

export type CompareDecision = {
  readyCount: number;
  bestValue?: Product;
  topRated?: Product;
  lowStock: number;
  needsSelection: number;
  priceSpread: number;
  recommended?: Product;
  recommendedNeedsSelection: boolean;
  recommendedLowStock: boolean;
};

export const buildCompareDecision = (products: Product[]): CompareDecision => {
  const readyProducts = products.filter((product) => product.stock === undefined || product.stock > 0);
  const bestValue = readyProducts
    .slice()
    .sort((left, right) => getPrice(left) - getPrice(right))[0];
  const topRated = readyProducts
    .slice()
    .sort((left, right) => Number(right.averageRating || 0) - Number(left.averageRating || 0))[0];
  const lowStock = readyProducts.filter((product) => product.stock !== undefined && product.stock > 0 && product.stock <= 5).length;
  const needsSelection = readyProducts.filter(needsOptionSelection).length;
  const priceSpread = readyProducts.length > 1
    ? Math.max(...readyProducts.map(getPrice)) - Math.min(...readyProducts.map(getPrice))
    : 0;
  const recommended = readyProducts
    .slice()
    .sort((left, right) => {
      const ratingDelta = Number(right.averageRating || 0) - Number(left.averageRating || 0);
      const priceDelta = getPrice(left) - getPrice(right);
      const stockDelta = (right.stock ?? 999) - (left.stock ?? 999);
      return ratingDelta * 8 + priceDelta * 0.08 + stockDelta * 0.01;
    })[0];
  const recommendedNeedsSelection = recommended ? needsOptionSelection(recommended) : false;
  const recommendedLowStock = recommended?.stock !== undefined && recommended.stock > 0 && recommended.stock <= 5;
  return {
    readyCount: readyProducts.length,
    bestValue,
    topRated,
    lowStock,
    needsSelection,
    priceSpread,
    recommended,
    recommendedNeedsSelection,
    recommendedLowStock,
  };
};

export type CompareTranslate = (key: string, params?: Record<string, string | number>) => string;
