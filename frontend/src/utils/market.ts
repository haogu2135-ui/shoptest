import { dispatchDomEvent } from './domEvents';
import { getLocalStorageItem, setLocalStorageItem } from './safeStorage';

export type CurrencyCode = 'USD' | 'MXN' | 'EUR' | 'GBP' | 'CAD';

export interface MarketConfig {
  currency: CurrencyCode;
  locale: string;
  label: string;
  freeShippingThreshold: number;
  defaultShippingFee: number;
  rateFromMxn: number;
}

export const CURRENCY_STORAGE_KEY = 'currency';
export const CURRENCY_CHANGED_EVENT = 'shop:currency-changed';

export const markets: Record<CurrencyCode, MarketConfig> = {
  USD: { currency: 'USD', locale: 'en-US', label: 'USD $', freeShippingThreshold: 899, defaultShippingFee: 30, rateFromMxn: 0.055 },
  MXN: { currency: 'MXN', locale: 'es-MX', label: 'MXN $', freeShippingThreshold: 899, defaultShippingFee: 30, rateFromMxn: 1 },
  EUR: { currency: 'EUR', locale: 'en-IE', label: 'EUR', freeShippingThreshold: 899, defaultShippingFee: 30, rateFromMxn: 0.051 },
  GBP: { currency: 'GBP', locale: 'en-GB', label: 'GBP', freeShippingThreshold: 899, defaultShippingFee: 30, rateFromMxn: 0.044 },
  CAD: { currency: 'CAD', locale: 'en-CA', label: 'CAD $', freeShippingThreshold: 899, defaultShippingFee: 30, rateFromMxn: 0.075 },
};

export const isCurrencyCode = (value: string | null): value is CurrencyCode =>
  value === 'USD' || value === 'MXN' || value === 'EUR' || value === 'GBP' || value === 'CAD';

const readStoredCurrency = () => {
  return getLocalStorageItem(CURRENCY_STORAGE_KEY);
};

const writeStoredCurrency = (currency: CurrencyCode) => {
  setLocalStorageItem(CURRENCY_STORAGE_KEY, currency);
};

export const detectDefaultCurrency = (): CurrencyCode => {
  if (typeof window === 'undefined') return 'USD';
  const stored = readStoredCurrency();
  if (isCurrencyCode(stored)) return stored;

  const locale = navigator.language || '';
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  if (locale.toLowerCase().includes('mx') || timezone.includes('Mexico')) {
    return 'MXN';
  }
  return 'USD';
};

export const getCurrency = (): CurrencyCode => detectDefaultCurrency();

export const setCurrency = (currency: CurrencyCode) => {
  const nextCurrency = isCurrencyCode(currency) ? currency : 'USD';
  writeStoredCurrency(nextCurrency);
  dispatchDomEvent(CURRENCY_CHANGED_EVENT, { currency: nextCurrency });
};

export const getMarket = (currency: CurrencyCode = getCurrency()) => markets[currency] || markets.USD;

export const withShippingConfig = (
  market: MarketConfig,
  config?: { freeShippingThreshold?: number | null; defaultShippingFee?: number | null },
): MarketConfig => {
  const threshold = Number(config?.freeShippingThreshold ?? market.freeShippingThreshold);
  const fee = Number(config?.defaultShippingFee ?? market.defaultShippingFee);
  return {
    ...market,
    freeShippingThreshold: Number.isFinite(threshold) ? Math.max(0, threshold) : market.freeShippingThreshold,
    defaultShippingFee: Number.isFinite(fee) ? Math.max(0, fee) : market.defaultShippingFee,
  };
};

export const formatMarketMoney = (value?: number | null, currency: CurrencyCode = getCurrency()) => {
  const market = getMarket(currency);
  const amount = Number(value);
  const displayValue = (Number.isFinite(amount) ? amount : 0) * market.rateFromMxn;
  return new Intl.NumberFormat(market.locale, {
    style: 'currency',
    currency: market.currency,
  }).format(displayValue);
};
