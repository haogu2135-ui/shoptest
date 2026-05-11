export type CurrencyCode = 'USD' | 'MXN' | 'EUR' | 'GBP' | 'CAD';

export interface MarketConfig {
  currency: CurrencyCode;
  locale: string;
  label: string;
  freeShippingThreshold: number;
  rateFromMxn: number;
}

export const CURRENCY_STORAGE_KEY = 'currency';
export const CURRENCY_CHANGED_EVENT = 'shop:currency-changed';

export const markets: Record<CurrencyCode, MarketConfig> = {
  USD: { currency: 'USD', locale: 'en-US', label: 'USD $', freeShippingThreshold: 900, rateFromMxn: 0.055 },
  MXN: { currency: 'MXN', locale: 'es-MX', label: 'MXN $', freeShippingThreshold: 899, rateFromMxn: 1 },
  EUR: { currency: 'EUR', locale: 'en-IE', label: 'EUR', freeShippingThreshold: 900, rateFromMxn: 0.051 },
  GBP: { currency: 'GBP', locale: 'en-GB', label: 'GBP', freeShippingThreshold: 815, rateFromMxn: 0.044 },
  CAD: { currency: 'CAD', locale: 'en-CA', label: 'CAD $', freeShippingThreshold: 1270, rateFromMxn: 0.075 },
};

export const isCurrencyCode = (value: string | null): value is CurrencyCode =>
  value === 'USD' || value === 'MXN' || value === 'EUR' || value === 'GBP' || value === 'CAD';

export const detectDefaultCurrency = (): CurrencyCode => {
  if (typeof window === 'undefined') return 'USD';
  const stored = localStorage.getItem(CURRENCY_STORAGE_KEY);
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
  localStorage.setItem(CURRENCY_STORAGE_KEY, currency);
  window.dispatchEvent(new CustomEvent(CURRENCY_CHANGED_EVENT, { detail: { currency } }));
};

export const getMarket = (currency: CurrencyCode = getCurrency()) => markets[currency] || markets.USD;

export const formatMarketMoney = (value?: number | null, currency: CurrencyCode = getCurrency()) => {
  const market = getMarket(currency);
  const displayValue = Number(value || 0) * market.rateFromMxn;
  return new Intl.NumberFormat(market.locale, {
    style: 'currency',
    currency: market.currency,
  }).format(displayValue);
};
