import {
  filterPublicCoupons,
  getCartItemCount,
  getCartSubtotal,
  getCouponEstimatedValue,
  getCouponPayablePercent,
  getCouponRemaining,
  sortPublicCoupons,
  toSafeArray,
} from './couponCenter';
import type { CartItem, CouponPublic } from '../types';

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
    expect(toSafeArray<CouponPublic>(null)).toEqual([]);
    expect(toSafeArray<CouponPublic>(undefined)).toEqual([]);
    expect(toSafeArray<CouponPublic>({ data: [] })).toEqual([]);
    expect(toSafeArray<CouponPublic>([{ id: 1 } as CouponPublic, null, undefined])).toHaveLength(1);
  });

  it('clamps coupon values and remaining quantity to safe numbers', () => {
    expect(getCouponEstimatedValue({
      couponType: 'FULL_REDUCTION',
      reductionAmount: 'not-a-number',
    } as unknown as CouponPublic)).toBe(0);

    expect(getCouponEstimatedValue({
      couponType: 'DISCOUNT',
      thresholdAmount: 100,
      discountPercent: 150,
      maxDiscountAmount: -10,
    } as unknown as CouponPublic)).toBe(0);

    expect(getCouponEstimatedValue({
      couponType: 'DISCOUNT',
      thresholdAmount: 100,
      discountPercent: 80,
      maxDiscountAmount: -10,
    } as unknown as CouponPublic)).toBe(20);
    expect(getCouponPayablePercent({
      discountPercent: 80,
    })).toBe(80);

    expect(getCouponRemaining({
      remainingQuantity: -3.9,
    })).toBe(0);
  });

  it('documents discountPercent as payable percent instead of savings percent', () => {
    const typesSource = require('fs').readFileSync(require('path').join(__dirname, '../types.ts'), 'utf8') as string;
    const helperSource = require('fs').readFileSync(require('path').join(__dirname, 'couponCenter.ts'), 'utf8') as string;

    expect((typesSource.match(/stores the payable percent/g) || []).length).toBeGreaterThanOrEqual(3);
    expect(helperSource).toContain('export const getCouponPayablePercent');
    expect(helperSource).toContain('100 - payablePercent');
  });

  it('sorts and filters public coupons without mutating the source list', () => {
    const coupons = [
      { id: 1, name: 'Basic food coupon', couponType: 'FULL_REDUCTION', reductionAmount: 5, thresholdAmount: 20, remainingQuantity: 10, endAt: '2099-01-03T00:00:00' },
      { id: 2, name: 'Premium grooming coupon', couponType: 'FULL_REDUCTION', reductionAmount: 15, thresholdAmount: 80, remainingQuantity: 10, endAt: '2099-01-02T00:00:00' },
      { id: 3, name: 'Sold out coupon', couponType: 'FULL_REDUCTION', reductionAmount: 30, thresholdAmount: 100, remainingQuantity: 0, endAt: '2099-01-01T00:00:00' },
    ] as unknown as CouponPublic[];
    const sorted = sortPublicCoupons(coupons, new Set([1]), '', 'recommended');

    expect(sorted.map((coupon) => coupon.id)).toEqual([2, 3, 1]);
    expect(coupons.map((coupon) => coupon.id)).toEqual([1, 2, 3]);
    expect(filterPublicCoupons(sorted, new Set([1]), 'claimable').map((coupon) => coupon.id)).toEqual([2]);
    expect(sortPublicCoupons(coupons, new Set(), 'grooming', 'value').map((coupon) => coupon.id)).toEqual([2]);
  });
});
