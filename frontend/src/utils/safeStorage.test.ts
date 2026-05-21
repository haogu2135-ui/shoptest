import {
  getLocalStorageItem,
  getSessionStorageItem,
  hasStoredValue,
  removeLocalStorageItem,
  removeSessionStorageItem,
  setLocalStorageItem,
  setSessionStorageItem,
} from './safeStorage';

describe('safeStorage', () => {
  const originalLocalStorage = window.localStorage;
  const originalSessionStorage = window.sessionStorage;

  afterEach(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: originalLocalStorage,
    });
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      value: originalSessionStorage,
    });
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('reads, writes, removes, and checks stored values', () => {
    expect(setLocalStorageItem('token', 'abc')).toBe(true);
    expect(getLocalStorageItem('token')).toBe('abc');
    expect(hasStoredValue('token')).toBe(true);
    expect(removeLocalStorageItem('token')).toBe(true);
    expect(getLocalStorageItem('token')).toBeNull();
  });

  it('fails closed when localStorage throws', () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: jest.fn(() => {
          throw new Error('blocked');
        }),
        setItem: jest.fn(() => {
          throw new Error('blocked');
        }),
        removeItem: jest.fn(() => {
          throw new Error('blocked');
        }),
      },
    });

    expect(getLocalStorageItem('token')).toBeNull();
    expect(hasStoredValue('token')).toBe(false);
    expect(setLocalStorageItem('token', 'abc')).toBe(false);
    expect(removeLocalStorageItem('token')).toBe(false);
  });

  it('reads, writes, and removes session values', () => {
    expect(setSessionStorageItem('checkoutPaymentMethod', 'PAYPAL')).toBe(true);
    expect(getSessionStorageItem('checkoutPaymentMethod')).toBe('PAYPAL');
    expect(removeSessionStorageItem('checkoutPaymentMethod')).toBe(true);
    expect(getSessionStorageItem('checkoutPaymentMethod')).toBeNull();
  });

  it('fails closed when sessionStorage throws', () => {
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      value: {
        getItem: jest.fn(() => {
          throw new Error('blocked');
        }),
        setItem: jest.fn(() => {
          throw new Error('blocked');
        }),
        removeItem: jest.fn(() => {
          throw new Error('blocked');
        }),
      },
    });

    expect(getSessionStorageItem('checkoutPaymentMethod')).toBeNull();
    expect(setSessionStorageItem('checkoutPaymentMethod', 'PAYPAL')).toBe(false);
    expect(removeSessionStorageItem('checkoutPaymentMethod')).toBe(false);
  });
});
