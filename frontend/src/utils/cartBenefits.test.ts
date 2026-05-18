import { getGiftThreshold, getNearestCartBenefitTarget, isGiftUnlocked } from './cartBenefits';

describe('cartBenefits', () => {
  it('normalizes currency case for gift thresholds', () => {
    expect(getGiftThreshold('mxn')).toBe(getGiftThreshold('MXN'));
  });

  it('does not leak NaN into benefit targets', () => {
    expect(getNearestCartBenefitTarget(Number.NaN, Number.NaN, 'USD')).toBeNull();
  });

  it('clamps negative subtotals before calculating the closest target', () => {
    expect(getNearestCartBenefitTarget(-10, 50, 'USD')).toEqual({
      reason: 'shipping',
      remainingAmount: 50,
      threshold: 50,
    });
  });

  it('does not unlock gifts for malformed subtotals', () => {
    expect(isGiftUnlocked(Number.NaN, 'MXN')).toBe(false);
  });
});
