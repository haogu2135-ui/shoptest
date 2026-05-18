import type { CartItem, Coupon, UserCoupon } from '../types';

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
    Pick<Coupon, 'couponType' | 'thresholdAmount' | 'reductionAmount' | 'discountPercent' | 'maxDiscountAmount'>
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

export const getCouponRemaining = (coupon: Pick<Coupon, 'totalQuantity' | 'claimedQuantity'>) =>
  coupon.totalQuantity == null ? null : Math.max(0, toSafeQuantity(coupon.totalQuantity) - toSafeQuantity(coupon.claimedQuantity));

export const isCouponEndingSoon = (endAt?: string) => {
  const days = getDaysUntilEnd(endAt);
  return days != null && days >= 0 && days <= 3;
};

export const isCouponInValidWindow = (coupon: Pick<Coupon, 'startAt' | 'endAt'> | Pick<UserCoupon, 'startAt' | 'endAt'>) => {
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

const isCouponClaimable = (coupon: Coupon, ownedCouponIds: Set<number>) => {
  const remaining = getCouponRemaining(coupon);
  return !ownedCouponIds.has(coupon.id) && remaining !== 0 && isCouponInValidWindow(coupon);
};

export const sortPublicCoupons = (
  publicCoupons: Coupon[],
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
  coupons: Coupon[],
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
