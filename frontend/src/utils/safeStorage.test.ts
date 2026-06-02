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
  const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
  const originalSessionStorageDescriptor = Object.getOwnPropertyDescriptor(window, 'sessionStorage');

  const restoreStorage = () => {
    if (originalLocalStorageDescriptor) {
      Object.defineProperty(window, 'localStorage', originalLocalStorageDescriptor);
    }
    if (originalSessionStorageDescriptor) {
      Object.defineProperty(window, 'sessionStorage', originalSessionStorageDescriptor);
    }
  };

  const clearStorage = () => {
    try {
      window.localStorage.clear();
    } catch {
      // Individual tests replace storage with throwing mocks.
    }
    try {
      window.sessionStorage.clear();
    } catch {
      // Individual tests replace storage with throwing mocks.
    }
  };

  beforeEach(() => {
    restoreStorage();
    clearStorage();
  });

  afterEach(() => {
    restoreStorage();
    clearStorage();
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
