import type { Language } from '../i18n';
import { getLocalizedOptionLabel } from './localizedProductOptions';
import { reportNonBlockingError } from './nonBlockingError';
import { formatProductSpecLabel } from './productSpecLabels';

const LEGACY_SELECTED_SPEC_PAIR_PATTERN = /(?:^|[;/|,]\s*|\s+)([^:=;/|,][^:=;/|,]*?)\s*[:=]\s*([^:=;/|,]+?)(?=\s*(?:[;/|,]|\s+[^:=;/|,]+?\s*[:=]|$))/g;

const normalizeSelectedSpecObject = (value: Record<string, unknown>): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const key in value) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
    const option = value[key];
    const normalizedKey = String(key || '').trim();
    if (!normalizedKey || option === undefined || option === null || typeof option === 'object') continue;
    const normalizedOption = String(option).trim();
    if (normalizedOption) result[normalizedKey] = normalizedOption;
  }
  return result;
};

const parseLegacySelectedSpecs = (value: string): Record<string, string> => {
  const normalizedValue = value.replace(/\s+/g, ' ').trim();
  if (!normalizedValue) return {};

  const result: Record<string, string> = {};
  let match: RegExpExecArray | null;
  LEGACY_SELECTED_SPEC_PAIR_PATTERN.lastIndex = 0;
  while ((match = LEGACY_SELECTED_SPEC_PAIR_PATTERN.exec(normalizedValue)) !== null) {
    const normalizedKey = match[1].trim();
    const normalizedOption = match[2].trim();
    if (normalizedKey && normalizedOption) result[normalizedKey] = normalizedOption;
  }
  return result;
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
    return normalizeSelectedSpecObject(parsed as Record<string, unknown>);
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
    const parts: string[] = [];
    for (const name in specs) {
      if (!Object.prototype.hasOwnProperty.call(specs, name)) continue;
      const option = specs[name];
      if (name.startsWith('_') || !option) continue;
      parts.push(`${formatSelectedSpecName(name, t, language)}: ${formatSelectedSpecValue(option, language)}`);
    }
    if (specs._purchaseMode === 'bundle') {
      const bundleLabel = t ? t('bundle.bundleDeal') : 'Bundle deal';
      if (bundleLabel) parts.push(bundleLabel);
      if (specs._bundleItems) parts.push(specs._bundleItems);
    }
    if (specs._purchaseMode === 'subscribe') {
      parts.push(t ? t('subscription.subscribeSave') : 'Refill deal 20% off');
      parts.push(getSubscriptionIntervalLabel(value, t));
    }
    return parts.join(' / ');
  };
