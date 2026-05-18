import {
  filterPublicCoupons,
  getCartItemCount,
  getCartSubtotal,
  getCouponEstimatedValue,
  getCouponRemaining,
  sortPublicCoupons,
  toSafeArray,
} from './couponCenter';
import type { CartItem, Coupon } from '../types';

describe('coupon center helpers', () => {
  it('keeps cart totals finite when cart data is malformed', () => {
    const items = [
      { price: 'bad', quantity: 2 },
      { price: 8, quantity: '3.7' },
      { price: 5, quantity: -2 },
    ] as unknown as CartItem[];

    expect(getCartSubtotal(items)).toBe(24);
    expect(getCartItemCount(items)).toBe(5);
  });

  it('normalizes non-array API payloads to empty arrays', () => {
    expect(toSafeArray<Coupon>(null)).toEqual([]);
    expect(toSafeArray<Coupon>(undefined)).toEqual([]);
    expect(toSafeArray<Coupon>({ data: [] })).toEqual([]);
    expect(toSafeArray<Coupon>([{ id: 1 } as Coupon, null, undefined])).toHaveLength(1);
  });

  it('clamps coupon values and remaining quantity to safe numbers', () => {
    expect(getCouponEstimatedValue({
      couponType: 'FULL_REDUCTION',
      reductionAmount: 'not-a-number',
    } as unknown as Coupon)).toBe(0);

    expect(getCouponEstimatedValue({
      couponType: 'DISCOUNT',
      thresholdAmount: 100,
      discountPercent: 150,
      maxDiscountAmount: -10,
    } as unknown as Coupon)).toBe(0);

    expect(getCouponEstimatedValue({
      couponType: 'DISCOUNT',
      thresholdAmount: 100,
      discountPercent: 80,
      maxDiscountAmount: -10,
    } as unknown as Coupon)).toBe(20);

    expect(getCouponRemaining({
      totalQuantity: 3.9,
      claimedQuantity: 20,
    })).toBe(0);
  });

  it('sorts and filters public coupons without mutating the source list', () => {
    const coupons = [
      { id: 1, name: 'Basic food coupon', couponType: 'FULL_REDUCTION', reductionAmount: 5, thresholdAmount: 20, totalQuantity: 10, claimedQuantity: 0, endAt: '2099-01-03T00:00:00' },
      { id: 2, name: 'Premium grooming coupon', couponType: 'FULL_REDUCTION', reductionAmount: 15, thresholdAmount: 80, totalQuantity: 10, claimedQuantity: 0, endAt: '2099-01-02T00:00:00' },
      { id: 3, name: 'Sold out coupon', couponType: 'FULL_REDUCTION', reductionAmount: 30, thresholdAmount: 100, totalQuantity: 1, claimedQuantity: 1, endAt: '2099-01-01T00:00:00' },
    ] as unknown as Coupon[];
    const sorted = sortPublicCoupons(coupons, new Set([1]), '', 'recommended');

    expect(sorted.map((coupon) => coupon.id)).toEqual([2, 3, 1]);
    expect(coupons.map((coupon) => coupon.id)).toEqual([1, 2, 3]);
    expect(filterPublicCoupons(sorted, new Set([1]), 'claimable').map((coupon) => coupon.id)).toEqual([2]);
    expect(sortPublicCoupons(coupons, new Set(), 'grooming', 'value').map((coupon) => coupon.id)).toEqual([2]);
  });
});
