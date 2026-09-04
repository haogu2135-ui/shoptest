import { act, render } from '@testing-library/react';
import React from 'react';

jest.mock('../api', () => ({
  createApiAbortController: jest.fn(() => new AbortController()),
  cartApi: {
    getItems: jest.fn(),
  },
  productApi: {
    getByIds: jest.fn(),
  },
}));

jest.mock('../utils/cartSession', () => ({
  clearCheckoutCartItemIds: jest.fn(),
  hasAuthenticatedCartSession: jest.fn(() => false),
}));

jest.mock('../utils/productViewPreferences', () => ({
  loadProductViewPreferences: jest.fn(),
}));

jest.mock('../utils/guestCart', () => ({
  getGuestCartItems: jest.fn(() => []),
}));

jest.mock('../utils/accessibleMessage', () => ({
  announceAccessibleMessage: jest.fn(),
}));

jest.mock('../utils/nonBlockingError', () => ({
  reportNonBlockingError: jest.fn(),
}));

jest.mock('../pages/cartHelpers', () => ({
  clearRecentProductsCache: jest.fn(),
  // Caching is bypassed so every load reaches the API and the ordering of the
  // in-flight responses is what the test actually exercises.
  getCachedRecentProducts: jest.fn(() => null),
  getSavedForLaterItemsSnapshot: jest.fn(() => []),
  normalizeCartItems: jest.fn((items: unknown[]) => items),
  setCachedRecentProducts: jest.fn(),
}));

const { useCartSessionData } = require('./useCartSessionData') as typeof import('./useCartSessionData');
const { createApiAbortController: mockCreateApiAbortController, productApi: mockProductApi } = require('../api');
const { loadProductViewPreferences: mockLoadPreferences } = require('../utils/productViewPreferences');
const { getGuestCartItems: mockGetGuestCartItems } = require('../utils/guestCart');
const { hasAuthenticatedCartSession: mockHasAuthenticatedCartSession } = require('../utils/cartSession');
const {
  getCachedRecentProducts: mockGetCachedRecentProducts,
  getSavedForLaterItemsSnapshot: mockGetSavedForLaterItemsSnapshot,
  normalizeCartItems: mockNormalizeCartItems,
} = require('../pages/cartHelpers');

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

const createDeferred = <T,>(): Deferred<T> => {
  let resolve: Deferred<T>['resolve'] = () => undefined;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
};

const buildProduct = (id: number, name: string) => ({
  id,
  name,
  price: 10,
  stock: 5,
});

const flushMicrotasks = async () => {
  await act(async () => {
    for (let i = 0; i < 8; i += 1) {
      await Promise.resolve();
    }
  });
};

/** Minimal host that exposes only the recently-viewed products the hook resolves. */
const Harness: React.FC<{ onRecent: (products: Array<{ id: number; name: string }>) => void }> = ({ onRecent }) => {
  const [recentProducts, setRecentProducts] = React.useState<Array<{ id: number; name: string }>>([]);
  const noop = React.useCallback(() => undefined, []);

  React.useEffect(() => {
    onRecent(recentProducts);
  }, [onRecent, recentProducts]);

  useCartSessionData({
    cartItems: [],
    language: 'en',
    setCartItems: noop as never,
    setLoadError: noop as never,
    setLoadErrorMessage: noop as never,
    setLoading: noop as never,
    setQuantityDrafts: noop as never,
    setRecentProducts: setRecentProducts as never,
    setSavedItems: noop as never,
    setSelectedIds: noop as never,
    t: ((key: string) => key) as never,
  } as never);

  return null;
};

describe('useCartSessionData recently-viewed loads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // CRA's jest preset sets resetMocks: true, which strips the implementations
    // given in the jest.mock factories, so they are restored per test here.
    (mockLoadPreferences as jest.Mock).mockReturnValue({ recent: [1, 2], categories: [], brands: [] });
    (mockGetGuestCartItems as jest.Mock).mockReturnValue([]);
    (mockHasAuthenticatedCartSession as jest.Mock).mockReturnValue(false);
    (mockGetCachedRecentProducts as jest.Mock).mockReturnValue(null);
    (mockGetSavedForLaterItemsSnapshot as jest.Mock).mockReturnValue([]);
    (mockNormalizeCartItems as jest.Mock).mockImplementation((items: unknown[]) => items);
    (mockCreateApiAbortController as jest.Mock).mockImplementation(() => new AbortController());
  });

  it('keeps the newest recently-viewed products when a superseded load resolves last', async () => {
    // Each call parks its resolver so two loads can be in flight at once and be
    // completed out of order.
    const deferreds: Array<Deferred<{ data: Array<{ id: number; name: string }> }>> = [];
    const signals: Array<AbortSignal | undefined> = [];
    (mockProductApi.getByIds as jest.Mock).mockImplementation((_ids: number[], options?: { signal?: AbortSignal }) => {
      const deferred = createDeferred<{ data: Array<{ id: number; name: string }> }>();
      deferreds.push(deferred);
      signals.push(options?.signal);
      return deferred.promise;
    });

    let latestRecent: Array<{ id: number; name: string }> = [];
    const view = render(<Harness onRecent={(products) => { latestRecent = products; }} />);

    await act(async () => {
      await Promise.resolve();
    });
    expect(deferreds).toHaveLength(1);

    // The listener re-invokes the loader inside the same effect run, so this second
    // load shares the first one's `disposed` flag - the exact case a boolean cannot
    // separate.
    await act(async () => {
      window.dispatchEvent(new Event('shop:product-view-preferences-updated'));
      await Promise.resolve();
    });
    expect(deferreds).toHaveLength(2);
    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);

    // Newer load answers first; the superseded one then answers with stale history
    // that must not replace it.
    deferreds[1].resolve({ data: [buildProduct(2, 'current-product')] });
    await flushMicrotasks();
    deferreds[0].resolve({ data: [buildProduct(1, 'superseded-product')] });
    await flushMicrotasks();

    expect(latestRecent.map((product) => product.name)).toEqual(['current-product']);

    view.unmount();
    expect(signals[1]?.aborted).toBe(true);
  });
});
