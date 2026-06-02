import type { CartItem, CouponPublic, UserCoupon } from '../types';

export type CouponFilter = 'all' | 'claimable' | 'ending';
export type CouponSort = 'recommended' | 'value' | 'ending' | 'threshold';

export const toFiniteNumber = (value: unknown, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

export const toSafeArray = <T,>(value: unknown): T[] =>
  Array.isArray(value) ? value.filter((item) => item != null) as T[] : [];

const toSafeQuantity = (value: unknown) => {
  const numeric = toFiniteNumber(value);
  return Math.max(0, Math.floor(numeric));
};

export const getCouponEstimatedValue = (
  coupon:
    Pick<CouponPublic, 'couponType' | 'thresholdAmount' | 'reductionAmount' | 'discountPercent' | 'maxDiscountAmount'>
    | Pick<UserCoupon, 'couponType' | 'thresholdAmount' | 'reductionAmount' | 'discountPercent' | 'maxDiscountAmount'>,
) => {
  if (coupon.couponType === 'FULL_REDUCTION') {
    return Math.max(0, toFiniteNumber(coupon.reductionAmount));
  }
  if (coupon.couponType !== 'DISCOUNT') return 0;
  const payablePercent = Math.max(0, Math.min(toFiniteNumber(coupon.discountPercent, 100), 100));
  const maxDiscount = Math.max(0, toFiniteNumber(coupon.maxDiscountAmount));
  const threshold = Math.max(0, toFiniteNumber(coupon.thresholdAmount));
  const estimated = threshold * (100 - payablePercent) / 100;
  return maxDiscount > 0 ? Math.min(maxDiscount, estimated || maxDiscount) : estimated;
};

export const getDaysUntilEnd = (endAt?: string) => {
  if (!endAt) return null;
  const endTime = new Date(endAt).getTime();
  if (!Number.isFinite(endTime)) return null;
  return Math.ceil((endTime - Date.now()) / (24 * 60 * 60 * 1000));
};

export const getCouponRemaining = (coupon: Pick<CouponPublic, 'remainingQuantity'>) =>
  coupon.remainingQuantity == null ? null : toSafeQuantity(coupon.remainingQuantity);

export const isCouponEndingSoon = (endAt?: string) => {
  const days = getDaysUntilEnd(endAt);
  return days != null && days >= 0 && days <= 3;
};

export const isCouponInValidWindow = (coupon: Pick<CouponPublic, 'startAt' | 'endAt'> | Pick<UserCoupon, 'startAt' | 'endAt'>) => {
  const now = Date.now();
  if (coupon.startAt) {
    const startTime = new Date(coupon.startAt).getTime();
    if (Number.isFinite(startTime) && startTime > now) return false;
  }
  if (coupon.endAt) {
    const endTime = new Date(coupon.endAt).getTime();
    if (Number.isFinite(endTime) && endTime < now) return false;
  }
  return true;
};

export const getFallbackPublicCoupons = (now = Date.now()): CouponPublic[] => {
  const startAt = new Date(now - 60 * 60 * 1000).toISOString();
  const inDays = (days: number) => new Date(now + days * 24 * 60 * 60 * 1000).toISOString();

  return [
    {
      id: -101,
      name: 'New Pet Parent Starter Perk',
      couponType: 'FULL_REDUCTION',
      thresholdAmount: 79,
      reductionAmount: 12,
      remainingQuantity: 500,
      startAt,
      endAt: inDays(14),
      description: 'Starter savings for food, walking and comfort essentials.',
    },
    {
      id: -102,
      name: 'Smart Care Upgrade Deal',
      couponType: 'DISCOUNT',
      thresholdAmount: 120,
      discountPercent: 90,
      maxDiscountAmount: 24,
      remainingQuantity: 180,
      startAt,
      endAt: inDays(7),
      description: 'A limited smart-care coupon for feeders, fountains and daily care devices.',
    },
    {
      id: -103,
      name: 'Weekend Walk & Play Bundle',
      couponType: 'FULL_REDUCTION',
      thresholdAmount: 45,
      reductionAmount: 6,
      remainingQuantity: 320,
      startAt,
      endAt: inDays(21),
      description: 'Bundle savings for toys, leashes, collars and small accessories.',
    },
  ];
};

const isCouponClaimable = (coupon: CouponPublic, ownedCouponIds: Set<number>) => {
  const remaining = getCouponRemaining(coupon);
  return !ownedCouponIds.has(coupon.id) && remaining !== 0 && isCouponInValidWindow(coupon);
};

export const sortPublicCoupons = (
  publicCoupons: CouponPublic[],
  ownedCouponIds: Set<number>,
  couponSearch: string,
  couponSort: CouponSort,
) => {
  const query = couponSearch.trim().toLocaleLowerCase();
  const coupons = publicCoupons.filter((coupon) => {
    if (!query) return true;
    const searchText = [
      coupon.name,
      coupon.description,
      coupon.couponType,
      coupon.thresholdAmount,
      coupon.reductionAmount,
      coupon.discountPercent,
    ].filter((value) => value != null).join(' ').toLocaleLowerCase();
    return searchText.includes(query);
  });
  return coupons.sort((a, b) => {
    const remainingA = getCouponRemaining(a);
    const remainingB = getCouponRemaining(b);
    const claimableA = !ownedCouponIds.has(a.id) && remainingA !== 0 && isCouponInValidWindow(a);
    const claimableB = !ownedCouponIds.has(b.id) && remainingB !== 0 && isCouponInValidWindow(b);
    const daysA = getDaysUntilEnd(a.endAt) ?? Number.MAX_SAFE_INTEGER;
    const daysB = getDaysUntilEnd(b.endAt) ?? Number.MAX_SAFE_INTEGER;
    const remainingScoreA = remainingA == null ? Number.MAX_SAFE_INTEGER : remainingA;
    const remainingScoreB = remainingB == null ? Number.MAX_SAFE_INTEGER : remainingB;
    if (couponSort === 'value') {
      return getCouponEstimatedValue(b) - getCouponEstimatedValue(a)
        || Number(claimableB) - Number(claimableA)
        || daysA - daysB;
    }
    if (couponSort === 'ending') {
      return daysA - daysB
        || Number(claimableB) - Number(claimableA)
        || getCouponEstimatedValue(b) - getCouponEstimatedValue(a);
    }
    if (couponSort === 'threshold') {
      return Math.max(0, toFiniteNumber(a.thresholdAmount)) - Math.max(0, toFiniteNumber(b.thresholdAmount))
        || getCouponEstimatedValue(b) - getCouponEstimatedValue(a)
        || daysA - daysB;
    }
    return Number(claimableB) - Number(claimableA)
      || Number(isCouponEndingSoon(b.endAt)) - Number(isCouponEndingSoon(a.endAt))
      || getCouponEstimatedValue(b) - getCouponEstimatedValue(a)
      || daysA - daysB
      || remainingScoreA - remainingScoreB;
  });
};

export const filterPublicCoupons = (
  coupons: CouponPublic[],
  ownedCouponIds: Set<number>,
  couponFilter: CouponFilter,
) => coupons.filter((coupon) => {
  const claimable = isCouponClaimable(coupon, ownedCouponIds);
  if (couponFilter === 'claimable') {
    return claimable;
  }
  if (couponFilter === 'ending') {
    return claimable && isCouponEndingSoon(coupon.endAt);
  }
  return true;
});

export const getCartSubtotal = (items: CartItem[]) =>
  items.reduce((sum, item) => {
    const price = Math.max(0, toFiniteNumber(item.price));
    const quantity = toSafeQuantity(item.quantity);
    return sum + price * quantity;
  }, 0);

export const getCartItemCount = (items: CartItem[]) =>
  items.reduce((sum, item) => sum + toSafeQuantity(item.quantity), 0);
