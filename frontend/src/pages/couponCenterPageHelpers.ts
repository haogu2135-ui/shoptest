import { couponApi } from '../api';
import type { CouponPublic, UserCoupon } from '../types';

export const couponStatusColor: Record<string, string> = {
  UNUSED: 'green',
  USED: 'default',
  EXPIRED: 'volcano',
};

export const COUPON_WALLET_STATUS_KEYS = new Set(['UNUSED', 'USED', 'EXPIRED']);

export type WalletFilter = 'all' | 'UNUSED' | 'USED' | 'EXPIRED';

export const CLAIM_BATCH_SIZE = 4;

export const getCouponDisplayName = (coupon: CouponPublic | UserCoupon) =>
  'couponName' in coupon ? coupon.couponName : coupon.name;

export const isFallbackCoupon = (couponId: number) => couponId < 0;

export const claimCouponsInBatches = async (coupons: CouponPublic[]) => {
  const results: PromiseSettledResult<unknown>[] = [];
  for (let index = 0; index < coupons.length; index += CLAIM_BATCH_SIZE) {
    const batch = coupons.slice(index, index + CLAIM_BATCH_SIZE);
    results.push(...await Promise.allSettled(batch.map((coupon) => couponApi.claim(coupon.id, 0))));
  }
  return results;
};
