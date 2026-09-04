import React, { useImperativeHandle, type Dispatch, type SetStateAction } from 'react';
import { act, render } from '@testing-library/react';
import type { Language } from '../i18n';
import type { ProductPublic as Product } from '../types';
import { useProductListProductActions } from './useProductListProductActions';

const mockAddItem = jest.fn();
const mockAnnounce = jest.fn();
const mockDispatchDomEvent = jest.fn();
const mockNavigate = jest.fn();
const mockOpenCartDrawerWithSnapshot = jest.fn();
const mockCreateApiAbortController = jest.fn(() => new AbortController());
type BundleInfo = {
  price: number;
  title: string;
  items: Array<{ name: string; quantity: number }>;
};
const mockGetBundleInfo = jest.fn((_product?: Product): BundleInfo | null => null);

jest.mock('../api', () => ({
  cartApi: { addItem: (...args: unknown[]) => mockAddItem(...args) },
  createApiAbortController: () => mockCreateApiAbortController(),
  productApi: { prefetchById: jest.fn() },
  wishlistApi: { toggle: jest.fn() },
}));

jest.mock('../utils/accessibleMessage', () => ({
  announceAccessibleMessage: (...args: unknown[]) => mockAnnounce(...args),
}));

jest.mock('../utils/domEvents', () => ({
  dispatchDomEvent: (...args: unknown[]) => mockDispatchDomEvent(...args),
}));

jest.mock('../utils/guestCart', () => ({
  addGuestCartItem: jest.fn(),
}));

jest.mock('../utils/bundle', () => ({
  buildBundleSpecs: jest.fn(),
  getBundleInfo: (value?: Product) => mockGetBundleInfo(value),
}));

jest.mock('../utils/productCompare', () => ({
  addCompareProduct: jest.fn(),
  MAX_COMPARE_ITEMS: 4,
}));

jest.mock('../utils/stockAlerts', () => ({
  addStockAlert: jest.fn(),
  removeStockAlert: jest.fn(),
}));

jest.mock('../utils/productOptions', () => ({
  selectCompatibleProductOption: jest.fn(),
}));

jest.mock('../utils/authRedirect', () => ({
  buildLoginUrlFromWindow: () => '/login',
}));

jest.mock('../utils/safeStorage', () => ({
  getLocalStorageItem: () => 'test-token',
}));

jest.mock('../utils/cartDrawer', () => ({
  openCartDrawerWithSnapshot: (...args: unknown[]) => mockOpenCartDrawerWithSnapshot(...args),
}));

jest.mock('../utils/apiError', () => ({
  getApiErrorMessage: (_error: unknown, fallback: string) => fallback,
}));

jest.mock('../pages/productListHelpers', () => ({
  resolveProductPrimaryImage: (value: Product) => value.imageUrl,
}));

type ProductListActions = ReturnType<typeof useProductListProductActions>;
type ProductListActionParams = Parameters<typeof useProductListProductActions>[0];

const setState = <T,>() => jest.fn() as unknown as Dispatch<SetStateAction<T>>;

const product = {
  id: 52,
  name: 'Travel bowl',
  description: 'A useful travel bowl',
  price: 12,
  stock: 6,
  categoryId: 2,
  imageUrl: '/travel-bowl.jpg',
} as Product;

const deferred = <T,>() => {
  let resolvePromise: (value: T | PromiseLike<T>) => void = () => undefined;
  let rejectPromise: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return { promise, reject: rejectPromise, resolve: resolvePromise };
};

const createParams = (overrides: Partial<ProductListActionParams> = {}): ProductListActionParams => ({
  isAuthenticated: true,
  language: 'en' as Language,
  navigate: mockNavigate,
  quickAddOptionGroups: [],
  quickAddOptions: {},
  quickAddPrice: 12,
  quickAddProduct: product,
  quickAddSubmitting: false,
  quickAddVariant: undefined,
  quickAddVariants: [],
  setPreviewProduct: setState<Product | null>(),
  setQuickAddOptions: setState<Record<string, string>>(),
  setQuickAddProduct: setState<Product | null>(),
  setQuickAddSubmitting: setState<boolean>(),
  setWishlistedProductIds: setState<Set<number>>(),
  t: (key: string) => key,
  ...overrides,
});

const ActionProbe = React.forwardRef<ProductListActions, { params: ProductListActionParams }>(({ params }, ref) => {
  const actions = useProductListProductActions(params);
  useImperativeHandle(ref, () => actions, [actions]);
  return null;
});

describe('useProductListProductActions lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateApiAbortController.mockImplementation(() => new AbortController());
    mockGetBundleInfo.mockReturnValue(null);
    mockAddItem.mockResolvedValue({ data: {} });
    mockOpenCartDrawerWithSnapshot.mockResolvedValue(undefined);
  });

  it('latches duplicate quick adds and announces success after the cart snapshot handoff', async () => {
    const pending = deferred<unknown>();
    mockAddItem.mockReturnValueOnce(pending.promise);
    const setQuickAddProduct = setState<Product | null>();
    const ref = React.createRef<ProductListActions>();
    render(<ActionProbe ref={ref} params={createParams({ setQuickAddProduct })} />);

    let firstAction: Promise<void> | undefined;
    act(() => {
      firstAction = ref.current?.submitQuickAdd();
      void ref.current?.submitQuickAdd();
    });

    expect(mockAddItem).toHaveBeenCalledTimes(1);
    pending.resolve({ data: {} });
    await act(async () => {
      await firstAction;
    });

    expect(mockOpenCartDrawerWithSnapshot).toHaveBeenCalledTimes(1);
    expect(mockOpenCartDrawerWithSnapshot).toHaveBeenCalledWith({
      authenticated: true,
      signal: expect.any(AbortSignal),
    });
    expect(mockAnnounce).toHaveBeenCalledWith('messages.addCartSuccess', 'success');
    expect(setQuickAddProduct).toHaveBeenCalledWith(null);
    expect(mockDispatchDomEvent).toHaveBeenCalledWith('shop:cart-updated');
  });

  it('suppresses quick-add state, feedback, events, and drawer opening after unmount', async () => {
    const pending = deferred<unknown>();
    mockAddItem.mockReturnValueOnce(pending.promise);
    const setQuickAddProduct = setState<Product | null>();
    const setQuickAddSubmitting = setState<boolean>();
    const ref = React.createRef<ProductListActions>();
    const { unmount } = render(
      <ActionProbe ref={ref} params={createParams({ setQuickAddProduct, setQuickAddSubmitting })} />,
    );

    let action: Promise<void> | undefined;
    act(() => {
      action = ref.current?.submitQuickAdd();
    });
    unmount();
    pending.resolve({ data: {} });
    await act(async () => {
      await action;
    });

    expect(mockOpenCartDrawerWithSnapshot).not.toHaveBeenCalled();
    expect(mockAnnounce).not.toHaveBeenCalled();
    expect(mockDispatchDomEvent).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(setQuickAddProduct).not.toHaveBeenCalled();
    expect(setQuickAddSubmitting).toHaveBeenCalledTimes(1);
    expect(setQuickAddSubmitting).toHaveBeenCalledWith(true);
  });

  it('suppresses bundle feedback when its cart snapshot signal aborts', async () => {
    const controller = new AbortController();
    const drawerPending = deferred<unknown>();
    mockCreateApiAbortController.mockReturnValueOnce(controller);
    mockGetBundleInfo.mockReturnValueOnce({
      price: 20,
      title: 'Travel set',
      items: [{ name: 'Bowl', quantity: 1 }],
    });
    mockOpenCartDrawerWithSnapshot.mockImplementationOnce(({ signal }: { signal?: AbortSignal }) => {
      signal?.addEventListener('abort', () => drawerPending.reject(new DOMException('Aborted', 'AbortError')));
      return drawerPending.promise;
    });
    const setQuickAddProduct = setState<Product | null>();
    const ref = React.createRef<ProductListActions>();
    render(<ActionProbe ref={ref} params={createParams({ setQuickAddProduct })} />);

    let action: Promise<void> | undefined;
    act(() => {
      action = ref.current?.submitQuickAdd();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockOpenCartDrawerWithSnapshot).toHaveBeenCalledTimes(1);

    act(() => {
      controller.abort();
    });
    await act(async () => {
      await action;
    });

    expect(mockAnnounce).not.toHaveBeenCalled();
    expect(setQuickAddProduct).not.toHaveBeenCalled();
    expect(mockDispatchDomEvent).toHaveBeenCalledWith('shop:cart-updated');
  });
});
