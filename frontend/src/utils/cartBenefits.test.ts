import { getGiftThreshold, getNearestCartBenefitTarget, isGiftUnlocked } from './cartBenefits';
import { markets } from './market';

describe('cartBenefits', () => {
  it('normalizes currency case for gift thresholds', () => {
    expect(getGiftThreshold('mxn')).toBe(getGiftThreshold('MXN'));
  });

  it('configures a positive gift threshold for every supported shopper currency', () => {
    Object.keys(markets).forEach((currency) => {
      expect(getGiftThreshold(currency)).toBeGreaterThan(0);
    });
  });

  it('does not enable gift incentives for unsupported currency values', () => {
    expect(getGiftThreshold('DOGE')).toBe(0);
    expect(isGiftUnlocked(999999, 'DOGE')).toBe(false);
  });

  it('does not leak NaN into benefit targets', () => {
    const target = getNearestCartBenefitTarget(Number.NaN, Number.NaN, 'USD');

    expect(target).not.toEqual(expect.objectContaining({
      remainingAmount: Number.NaN,
      threshold: Number.NaN,
    }));
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
