import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CURRENCY_CHANGED_EVENT,
  CurrencyCode,
  formatMarketMoney,
  getCurrency,
  getMarket,
  setCurrency as persistCurrency,
} from '../utils/market';

export const useMarket = () => {
  const [currency, setCurrencyState] = useState<CurrencyCode>(() => getCurrency());

  useEffect(() => {
    const syncCurrency = () => setCurrencyState(getCurrency());
    window.addEventListener(CURRENCY_CHANGED_EVENT, syncCurrency);
    window.addEventListener('storage', syncCurrency);
    return () => {
      window.removeEventListener(CURRENCY_CHANGED_EVENT, syncCurrency);
      window.removeEventListener('storage', syncCurrency);
    };
  }, []);

  const setCurrency = useCallback((nextCurrency: CurrencyCode) => {
    persistCurrency(nextCurrency);
    setCurrencyState(nextCurrency);
  }, []);

  const market = useMemo(() => getMarket(currency), [currency]);
  const formatMoney = useCallback((value?: number | null) => formatMarketMoney(value, currency), [currency]);

  return { currency, market, setCurrency, formatMoney };
};
