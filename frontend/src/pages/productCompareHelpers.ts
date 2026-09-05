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
  const metrics = readyProducts.reduce((acc, product) => {
    const price = getPrice(product);
    const rating = Number(product.averageRating || 0);
    const recommendationScore = rating * 8 - price * 0.08 - (product.stock ?? 999) * 0.01;
    if (!acc.bestValue || price < acc.bestValuePrice) {
      acc.bestValue = product;
      acc.bestValuePrice = price;
    }
    if (!acc.topRated || rating > acc.topRatedRating) {
      acc.topRated = product;
      acc.topRatedRating = rating;
    }
    if (product.stock !== undefined && product.stock > 0 && product.stock <= 5) acc.lowStock += 1;
    if (needsOptionSelection(product)) acc.needsSelection += 1;
    acc.minPrice = Math.min(acc.minPrice, price);
    acc.maxPrice = Math.max(acc.maxPrice, price);
    if (!acc.recommended || recommendationScore > acc.recommendedScore) {
      acc.recommended = product;
      acc.recommendedScore = recommendationScore;
    }
    return acc;
  }, {
    bestValue: undefined as Product | undefined,
    bestValuePrice: Number.POSITIVE_INFINITY,
    topRated: undefined as Product | undefined,
    topRatedRating: Number.NEGATIVE_INFINITY,
    lowStock: 0,
    needsSelection: 0,
    minPrice: Number.POSITIVE_INFINITY,
    maxPrice: Number.NEGATIVE_INFINITY,
    recommended: undefined as Product | undefined,
    recommendedScore: Number.NEGATIVE_INFINITY,
  });
  const bestValue = metrics.bestValue;
  const topRated = metrics.topRated;
  const lowStock = metrics.lowStock;
  const needsSelection = metrics.needsSelection;
  const priceSpread = readyProducts.length > 1 ? metrics.maxPrice - metrics.minPrice : 0;
  const recommended = metrics.recommended;
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
