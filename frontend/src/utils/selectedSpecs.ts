export const parseSelectedSpecs = (value?: string | null): Record<string, string> => {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.entries(parsed).reduce((result: Record<string, string>, [key, option]) => {
      const normalizedKey = String(key || '').trim();
      if (!normalizedKey || option === undefined || option === null) return result;
      result[normalizedKey] = typeof option === 'string' ? option : String(option);
      return result;
    }, {});
  } catch {
    return {};
  }
};

export const isSubscribeAndSave = (value?: string | null) =>
  parseSelectedSpecs(value)._purchaseMode === 'subscribe';

export const isBundlePurchase = (value?: string | null) =>
  parseSelectedSpecs(value)._purchaseMode === 'bundle';

type Translate = (key: string, params?: Record<string, string | number>) => string;

export const getSubscriptionIntervalLabel = (value?: string | null, t?: Translate) => {
  const interval = parseSelectedSpecs(value)._subscriptionInterval;
  if (interval === '2w') return t ? t('subscription.interval2w') : 'Deliver every 2 weeks';
  if (interval === '4w') return t ? t('subscription.interval4w') : 'Deliver every 4 weeks';
  if (interval === '8w') return t ? t('subscription.interval8w') : 'Deliver every 8 weeks';
  return t ? t('subscription.intervalMonthly') : 'Deliver every month';
};

export const formatSelectedSpecs = (value?: string | null, t?: Translate) =>
  [
    ...Object.entries(parseSelectedSpecs(value))
    .filter(([name]) => !name.startsWith('_'))
    .filter(([, option]) => option)
      .map(([name, option]) => `${name}: ${option}`),
    ...(isBundlePurchase(value)
      ? [
        t ? t('bundle.bundleDeal') : 'Bundle deal',
        parseSelectedSpecs(value)._bundleItems,
      ].filter(Boolean)
      : []),
    ...(isSubscribeAndSave(value) ? [t ? t('subscription.subscribeSave') : 'Subscribe & Save 20%', getSubscriptionIntervalLabel(value, t)] : []),
  ]
    .join(' / ');
