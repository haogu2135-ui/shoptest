import { detectDefaultCurrency, formatMarketMoney, getCurrency, getMarket, setCurrency, withShippingConfig } from './market';

describe('market currency storage', () => {
  const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');

  const restoreLocalStorage = () => {
    if (originalLocalStorageDescriptor) {
      Object.defineProperty(window, 'localStorage', originalLocalStorageDescriptor);
    }
  };

  const clearLocalStorage = () => {
    try {
      window.localStorage.clear();
    } catch {
      // Individual tests replace storage with throwing mocks.
    }
  };

  beforeEach(() => {
    restoreLocalStorage();
    clearLocalStorage();
  });

  afterEach(() => {
    restoreLocalStorage();
    clearLocalStorage();
  });

  it('falls back when localStorage cannot be read', () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: jest.fn(() => {
          throw new Error('storage unavailable');
        }),
      },
    });

    expect(getCurrency()).toBe(detectDefaultCurrency());
  });

  it('still dispatches currency changes when persistence fails', () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: jest.fn(() => null),
        setItem: jest.fn(() => {
          throw new Error('storage unavailable');
        }),
      },
    });
    const listener = jest.fn();
    window.addEventListener('shop:currency-changed', listener);

    setCurrency('MXN');

    expect(listener).toHaveBeenCalledTimes(1);
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({ currency: 'MXN' });
    window.removeEventListener('shop:currency-changed', listener);
  });

  it('falls back when runtime passes an invalid currency', () => {
    const listener = jest.fn();
    window.addEventListener('shop:currency-changed', listener);

    setCurrency('DOGE' as any);

    expect(localStorage.getItem('currency')).toBe('USD');
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({ currency: 'USD' });
    window.removeEventListener('shop:currency-changed', listener);
  });

  it('keeps shipping config and money formatting finite', () => {
    const market = getMarket('MXN');

    expect(withShippingConfig(market, { freeShippingThreshold: Infinity, defaultShippingFee: Number.NaN })).toEqual(market);
    expect(formatMarketMoney(Infinity, 'USD')).toBe('$0.00');
  });
});
