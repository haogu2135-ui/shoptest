import React, { useImperativeHandle, type Dispatch, type SetStateAction } from 'react';
import { act, render } from '@testing-library/react';
import type { Language } from '../i18n';
import type { PetGalleryPhotoPublic, PetGalleryQuota, ProductPublic as Product } from '../types';
import { useHomeProductActions } from './useHomeProductActions';

const mockAddItem = jest.fn();
const mockAnnounce = jest.fn();
const mockDispatchDomEvent = jest.fn();
const mockNavigate = jest.fn();
const mockOpenCartWithSnapshot = jest.fn();

jest.mock('../api', () => ({
  cartApi: { addItem: (...args: unknown[]) => mockAddItem(...args) },
  createApiAbortController: () => new AbortController(),
  petGalleryApi: {
    delete: jest.fn(),
    getAll: jest.fn(),
    getQuota: jest.fn(),
    like: jest.fn(),
    upload: jest.fn(),
  },
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

jest.mock('../utils/productOptions', () => ({
  needsOptionSelection: () => false,
}));

jest.mock('../utils/authRedirect', () => ({
  buildLoginUrlFromWindow: () => '/login',
}));

jest.mock('../utils/apiError', () => ({
  getApiErrorMessage: (_error: unknown, fallback: string) => fallback,
}));

jest.mock('../utils/idleScheduler', () => ({
  cancelIdleTask: jest.fn(),
  scheduleIdleTask: jest.fn(() => ({ type: 'timeout', id: 0 })),
}));

jest.mock('../utils/petGalleryUpload', () => ({
  isSupportedPetGalleryImageFile: () => true,
}));

jest.mock('../pages/homeHelpers', () => ({
  PET_GALLERY_MAX_FILE_SIZE: 5 * 1024 * 1024,
  writeLocalPetGalleryLikes: jest.fn(),
}));

type HomeActions = ReturnType<typeof useHomeProductActions>;
type HomeActionParams = Parameters<typeof useHomeProductActions>[0];

const setState = <T,>() => jest.fn() as unknown as Dispatch<SetStateAction<T>>;

const product = {
  id: 41,
  name: 'Harness',
  description: 'A useful harness',
  price: 18,
  stock: 9,
  categoryId: 2,
  imageUrl: '/harness.jpg',
} as Product;

const deferred = <T,>() => {
  let resolvePromise: (value: T | PromiseLike<T>) => void = () => undefined;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
};

const createParams = (overrides: Partial<HomeActionParams> = {}): HomeActionParams => ({
  isAuthenticated: true,
  language: 'en' as Language,
  localPetGalleryLikes: [],
  navigate: mockNavigate,
  openCartWithSnapshot: mockOpenCartWithSnapshot,
  personalizedReadyProducts: [],
  petGalleryQuota: null,
  petUploadInputRef: { current: null },
  setLocalPetGalleryLikes: setState<string[]>(),
  setPetGalleryPhotos: setState<PetGalleryPhotoPublic[]>(),
  setPetGalleryQuota: setState<PetGalleryQuota | null>(),
  setUploadingPetPhoto: setState<boolean>(),
  setWishlistedProductIds: setState<Set<number>>(),
  t: (key: string) => key,
  ...overrides,
});

const ActionProbe = React.forwardRef<HomeActions, { params: HomeActionParams }>(({ params }, ref) => {
  const actions = useHomeProductActions(params);
  useImperativeHandle(ref, () => actions, [actions]);
  return null;
});

describe('useHomeProductActions lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAddItem.mockResolvedValue({ data: {} });
    mockOpenCartWithSnapshot.mockResolvedValue(undefined);
  });

  it('latches duplicate quick adds and opens the cart once after the add settles', async () => {
    const pending = deferred<unknown>();
    mockAddItem.mockReturnValueOnce(pending.promise);
    const ref = React.createRef<HomeActions>();
    render(<ActionProbe ref={ref} params={createParams()} />);

    let firstAction: Promise<void> | undefined;
    act(() => {
      firstAction = ref.current?.handleQuickAddToCart(undefined, product);
      void ref.current?.handleQuickAddToCart(undefined, product);
    });

    expect(mockAddItem).toHaveBeenCalledTimes(1);
    pending.resolve({ data: {} });
    await act(async () => {
      await firstAction;
    });

    expect(mockOpenCartWithSnapshot).toHaveBeenCalledTimes(1);
    expect(mockOpenCartWithSnapshot.mock.calls[0][0]).toEqual(expect.any(AbortSignal));
    expect(mockDispatchDomEvent).toHaveBeenCalledWith('shop:cart-updated');
    expect(mockAnnounce).toHaveBeenCalledWith('messages.addCartSuccess', 'success');
  });

  it('suppresses quick-add effects when the component unmounts before the add resolves', async () => {
    const pending = deferred<unknown>();
    mockAddItem.mockReturnValueOnce(pending.promise);
    const ref = React.createRef<HomeActions>();
    const setPetGalleryPhotos = setState<PetGalleryPhotoPublic[]>();
    const { unmount } = render(
      <ActionProbe ref={ref} params={createParams({ setPetGalleryPhotos })} />,
    );

    let action: Promise<void> | undefined;
    act(() => {
      action = ref.current?.handleQuickAddToCart(undefined, product);
    });
    unmount();
    pending.resolve({ data: {} });
    await act(async () => {
      await action;
    });

    expect(mockOpenCartWithSnapshot).not.toHaveBeenCalled();
    expect(mockAnnounce).not.toHaveBeenCalled();
    expect(mockDispatchDomEvent).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(setPetGalleryPhotos).not.toHaveBeenCalled();
  });
});
