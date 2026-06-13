import { getCouponUiText } from './couponUiText';
import enLocale from '../locales/en.json';
import esLocale from '../locales/es.json';
import zhLocale from '../locales/zh.json';
import type { TranslateFn } from '../i18n';

const createTranslate = (labels: Record<string, string>): TranslateFn => (key) => labels[key] || key;

describe('coupon UI text', () => {
  it('returns coupon labels through the shared i18n key path', () => {
    const labels = getCouponUiText(createTranslate({
      'pages.coupons.ui.remainingLabel': 'Remaining',
      'pages.coupons.ui.walletAll': 'All',
      'pages.coupons.ui.searchPlaceholder': 'Search coupon name or details',
      'pages.coupons.ui.claimSummary': 'Claimed {claimed}/{total} coupons this time',
    }));

    expect(labels.remainingLabel).toBe('Remaining');
    expect(labels.walletAll).toBe('All');
    expect(labels.searchPlaceholder).toBe('Search coupon name or details');
  });

  it('keeps batch summary placeholders available', () => {
    const labels = getCouponUiText(createTranslate({
      'pages.coupons.ui.claimSummary': 'Claimed {claimed}/{total} coupons this time',
    }));

    expect(labels.claimSummary).toContain('{claimed}');
    expect(labels.claimSummary).toContain('{total}');
  });

  it('keeps coupon labels in main locale files', () => {
    expect(enLocale.pages.coupons.ui.searchPlaceholder).toBe('Search coupon name or details');
    expect(esLocale.pages.coupons.ui.walletAll).toBe('Todos');
    expect(zhLocale.pages.coupons.ui.remainingLabel).toBe('剩余');
  });
});
