import type { TranslateFn } from '../i18n';

export type CouponUiText = {
  searchPlaceholder: string;
  sortRecommended: string;
  sortValue: string;
  sortEnding: string;
  sortThreshold: string;
  visibleResults: string;
  resetSearch: string;
  noSearchResults: string;
  claimSummary: string;
  bestMatch: string;
  cartReady: string;
  activeControls: string;
  resetControls: string;
  walletNext: string;
  listMatched: string;
  alreadySaved: string;
  walletGuide: string;
  nextExpiry: string;
  strongestSaved: string;
  noExpiry: string;
  noSavedValue: string;
  daysShort: string;
  unlimitedStock: string;
  today: string;
  walletAll: string;
  walletFilteredEmpty: string;
  walletThreshold: string;
  remainingLabel: string;
};

const couponUiTextKeys = [
  'searchPlaceholder',
  'sortRecommended',
  'sortValue',
  'sortEnding',
  'sortThreshold',
  'visibleResults',
  'resetSearch',
  'noSearchResults',
  'claimSummary',
  'bestMatch',
  'cartReady',
  'activeControls',
  'resetControls',
  'walletNext',
  'listMatched',
  'alreadySaved',
  'walletGuide',
  'nextExpiry',
  'strongestSaved',
  'noExpiry',
  'noSavedValue',
  'daysShort',
  'unlimitedStock',
  'today',
  'walletAll',
  'walletFilteredEmpty',
  'walletThreshold',
  'remainingLabel',
] as const satisfies readonly (keyof CouponUiText)[];

export const getCouponUiText = (t: TranslateFn): CouponUiText =>
  couponUiTextKeys.reduce<CouponUiText>((labels, key) => {
    labels[key] = t(`pages.coupons.ui.${key}`);
    return labels;
  }, {} as CouponUiText);
