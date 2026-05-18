import { getCouponUiText } from './couponUiText';

describe('coupon UI text', () => {
  it('returns localized coupon labels and falls back to English', () => {
    expect(getCouponUiText('zh').remainingLabel).toBe('剩余');
    expect(getCouponUiText('es').walletAll).toBe('Todos');
    expect(getCouponUiText('unknown').searchPlaceholder).toBe('Search coupon name or details');
  });

  it('keeps batch summary placeholders available', () => {
    expect(getCouponUiText('en').claimSummary).toContain('{claimed}');
    expect(getCouponUiText('en').claimSummary).toContain('{total}');
  });
});
