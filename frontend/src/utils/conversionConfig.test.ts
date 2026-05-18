import { estimatePetSize, getLowStockCount } from './conversionConfig';

describe('conversionConfig helpers', () => {
  it('normalizes low-stock calculations for fractional and invalid values', () => {
    expect(getLowStockCount(3.8, 1.2)).toBe(3);
    expect(getLowStockCount(2, Number.NaN)).toBe(2);
    expect(getLowStockCount(Number.NaN, 1)).toBeNull();
  });

  it('does not crash on missing breed or non-finite weight', () => {
    expect(estimatePetSize(undefined as unknown as string, Infinity)).toBeNull();
    expect(estimatePetSize('', 7.5)).toBe('S');
  });
});
