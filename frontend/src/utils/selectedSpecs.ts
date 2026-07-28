import type { Language } from '../i18n';
import { getLocalizedOptionLabel } from './localizedProductOptions';
import { reportNonBlockingError } from './nonBlockingError';
import { formatProductSpecLabel } from './productSpecLabels';

const LEGACY_SELECTED_SPEC_PAIR_PATTERN = /(?:^|[;/|,]\s*|\s+)([^:=;/|,][^:=;/|,]*?)\s*[:=]\s*([^:=;/|,]+?)(?=\s*(?:[;/|,]|\s+[^:=;/|,]+?\s*[:=]|$))/g;

const normalizeSelectedSpecEntries = (entries: Array<[string, unknown]>): Record<string, string> => entries.reduce((result: Record<string, string>, [key, option]) => {
  const normalizedKey = String(key || '').trim();
  if (!normalizedKey || option === undefined || option === null) return result;
  if (typeof option === 'object') return result;
  const normalizedOption = String(option).trim();
  if (normalizedOption) result[normalizedKey] = normalizedOption;
  return result;
}, {});

const parseLegacySelectedSpecs = (value: string): Record<string, string> => {
  const normalizedValue = value.replace(/\s+/g, ' ').trim();
  if (!normalizedValue) return {};

  const entries: Array<[string, string]> = [];
  let match: RegExpExecArray | null;
  LEGACY_SELECTED_SPEC_PAIR_PATTERN.lastIndex = 0;
  while ((match = LEGACY_SELECTED_SPEC_PAIR_PATTERN.exec(normalizedValue)) !== null) {
    entries.push([match[1], match[2]]);
  }
  return normalizeSelectedSpecEntries(entries);
};

export const parseSelectedSpecs = (value?: string | null): Record<string, string> => {
  if (!value) return {};
  const normalizedValue = String(value).trim();
  if (!normalizedValue) return {};
  const looksLikeJson = normalizedValue.startsWith('{') || normalizedValue.startsWith('[');
  if (!looksLikeJson) return parseLegacySelectedSpecs(normalizedValue);

  try {
    const parsed = JSON.parse(normalizedValue);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return normalizeSelectedSpecEntries(Object.entries(parsed));
  } catch (error) {
    reportNonBlockingError('selectedSpecs.parseSelectedSpecs', error);
    return parseLegacySelectedSpecs(normalizedValue);
  }
};

export const isSubscribeAndSave = (value?: string | null) =>
  parseSelectedSpecs(value)._purchaseMode === 'subscribe';

export const isBundlePurchase = (value?: string | null) =>
  parseSelectedSpecs(value)._purchaseMode === 'bundle';

type Translate = (key: string, params?: Record<string, string | number>) => string;

const formatSelectedSpecName = (name: string, t?: Translate, language?: Language | string) => {
  if (language) {
    const localizedOptionLabel = getLocalizedOptionLabel(name, language);
    if (localizedOptionLabel !== name) return localizedOptionLabel;
  }
  return t ? formatProductSpecLabel(name, t) : name;
};

const formatSelectedSpecValue = (value: string, language?: Language | string) =>
  language ? getLocalizedOptionLabel(value, language) : value;

export const getSubscriptionIntervalLabel = (value?: string | null, t?: Translate) => {
  const interval = parseSelectedSpecs(value)._subscriptionInterval;
  if (interval === '2w') return t ? t('subscription.interval2w') : 'Deliver every 2 weeks';
  if (interval === '4w') return t ? t('subscription.interval4w') : 'Deliver every 4 weeks';
  if (interval === '8w') return t ? t('subscription.interval8w') : 'Deliver every 8 weeks';
  return t ? t('subscription.intervalMonthly') : 'Deliver every month';
};

export const formatSelectedSpecs = (value?: string | null, t?: Translate, language?: Language | string) =>
  {
    const specs = parseSelectedSpecs(value);
    return [
      ...Object.entries(specs)
    .filter(([name]) => !name.startsWith('_'))
    .filter(([, option]) => option)
      .map(([name, option]) => `${formatSelectedSpecName(name, t, language)}: ${formatSelectedSpecValue(option, language)}`),
      ...(specs._purchaseMode === 'bundle'
      ? [
        t ? t('bundle.bundleDeal') : 'Bundle deal',
        specs._bundleItems,
      ].filter(Boolean)
      : []),
      ...(specs._purchaseMode === 'subscribe' ? [t ? t('subscription.subscribeSave') : 'Refill deal 20% off', getSubscriptionIntervalLabel(value, t)] : []),
    ].join(' / ');
  };
