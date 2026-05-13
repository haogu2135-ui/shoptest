import { conversionConfig } from './conversionConfig';

export type CartBenefitTarget = {
  reason: 'shipping' | 'gift';
  remainingAmount: number;
  threshold: number;
};

export const getGiftThreshold = (currency: string) => {
  if (!conversionConfig.giftAtCheckout.enabled) return 0;
  return currency === 'MXN' ? conversionConfig.giftAtCheckout.thresholdMxn : 0;
};

export const getNearestCartBenefitTarget = (
  subtotal: number,
  freeShippingThreshold: number,
  currency: string,
): CartBenefitTarget | null => {
  const candidates: CartBenefitTarget[] = [];
  const shippingRemaining = Math.max(0, freeShippingThreshold - subtotal);
  if (freeShippingThreshold > 0 && shippingRemaining > 0) {
    candidates.push({
      reason: 'shipping',
      remainingAmount: shippingRemaining,
      threshold: freeShippingThreshold,
    });
  }

  const giftThreshold = getGiftThreshold(currency);
  const giftRemaining = Math.max(0, giftThreshold - subtotal);
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
  return giftThreshold > 0 && subtotal >= giftThreshold;
};
