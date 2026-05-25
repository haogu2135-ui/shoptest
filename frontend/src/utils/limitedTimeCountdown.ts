import type { Product } from '../types';

export const getLimitedTimeEndMs = (value: unknown): number => {
  if (!value) return 0;
  const endMs = new Date(String(value)).getTime();
  return Number.isFinite(endMs) ? endMs : 0;
};

export const getLimitedTimeRemainingMs = (
  product: Pick<Product, 'activeLimitedTimeDiscount' | 'limitedTimeEndAt'> | null | undefined,
  now = Date.now(),
): number => {
  if (!product?.activeLimitedTimeDiscount) return 0;
  const endMs = getLimitedTimeEndMs(product.limitedTimeEndAt);
  return endMs > now ? endMs - now : 0;
};

export const shouldRunLimitedTimeTicker = (
  product: Pick<Product, 'activeLimitedTimeDiscount' | 'limitedTimeEndAt'> | null | undefined,
  now = Date.now(),
): boolean => getLimitedTimeRemainingMs(product, now) > 0;
