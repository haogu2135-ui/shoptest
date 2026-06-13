import { conversionConfig } from './conversionConfig';
import { isCurrencyCode } from './market';

export type CartBenefitTarget = {
  reason: 'shipping' | 'gift';
  remainingAmount: number;
  threshold: number;
};

const toNonNegativeFinite = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
};

export const getGiftThreshold = (currency: string) => {
  if (!conversionConfig.giftAtCheckout.enabled) return 0;
  const currencyCode = String(currency || '').toUpperCase();
  if (!isCurrencyCode(currencyCode)) return 0;
  return toNonNegativeFinite(conversionConfig.giftAtCheckout.thresholdsByCurrency[currencyCode]);
};

export const getNearestCartBenefitTarget = (
  subtotal: number,
  freeShippingThreshold: number,
  currency: string,
): CartBenefitTarget | null => {
  const candidates: CartBenefitTarget[] = [];
  const safeSubtotal = toNonNegativeFinite(subtotal);
  const safeFreeShippingThreshold = toNonNegativeFinite(freeShippingThreshold);
  const shippingRemaining = Math.max(0, safeFreeShippingThreshold - safeSubtotal);
  if (safeFreeShippingThreshold > 0 && shippingRemaining > 0) {
    candidates.push({
      reason: 'shipping',
      remainingAmount: shippingRemaining,
      threshold: safeFreeShippingThreshold,
    });
  }

  const giftThreshold = getGiftThreshold(currency);
  const giftRemaining = Math.max(0, giftThreshold - safeSubtotal);
  if (giftThreshold > 0 && giftRemaining > 0) {
    candidates.push({
      reason: 'gift',
      remainingAmount: giftRemaining,
      threshold: giftThreshold,
    });
  }

  return candidates.sort((left, right) => left.remainingAmount - right.remainingAmount)[0] || null;
};

export const isGiftUnlocked = (subtotal: number, currency: string) => {
  const giftThreshold = getGiftThreshold(currency);
  return giftThreshold > 0 && toNonNegativeFinite(subtotal) >= giftThreshold;
};
