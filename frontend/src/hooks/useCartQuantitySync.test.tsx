import React, { useImperativeHandle } from 'react';
import { act, render } from '@testing-library/react';
import type { CartItem } from '../types';
import { useCartQuantitySync } from './useCartQuantitySync';

const mockUpdateQuantity = jest.fn();
const mockDispatchDomEvent = jest.fn();
let mockAuthenticated = true;

jest.mock('../api', () => ({
  cartApi: {
    updateQuantity: (...args: unknown[]) => mockUpdateQuantity(...args),
  },
}));

jest.mock('../utils/cartSession', () => ({
  hasAuthenticatedCartSession: () => mockAuthenticated,
}));

jest.mock('../utils/domEvents', () => ({
  dispatchDomEvent: (...args: unknown[]) => mockDispatchDomEvent(...args),
}));

type CartQuantitySyncApi = ReturnType<typeof useCartQuantitySync>;

const cartItem = (overrides: Partial<CartItem> = {}): CartItem => ({
  id: 10,
  productId: 20,
  productName: 'Harness',
  imageUrl: '/harness.jpg',
  price: 12,
  quantity: 1,
  stock: 99,
  ...overrides,
});

const SyncProbe = React.forwardRef<CartQuantitySyncApi, {
  clearPending?: jest.Mock;
  mounted?: boolean;
  onError?: jest.Mock;
  setPending?: jest.Mock;
}>(({ clearPending = jest.fn(), mounted = true, onError = jest.fn(), setPending = jest.fn() }, ref) => {
  const api = useCartQuantitySync({
    isMounted: () => mounted,
    onQuantitySyncError: onError,
    setQuantityPending: setPending,
    clearQuantityPending: clearPending,
  });
  useImperativeHandle(ref, () => api, [api]);
  return null;
});

describe('useCartQuantitySync', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockAuthenticated = true;
    mockUpdateQuantity.mockResolvedValue({ data: {} });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('debounces rapid quantity edits and syncs only the final value', async () => {
    const setPending = jest.fn();
    const ref = React.createRef<CartQuantitySyncApi>();
    render(<SyncProbe ref={ref} setPending={setPending} />);

    act(() => {
      ref.current?.scheduleQuantitySync(10, 2);
      ref.current?.scheduleQuantitySync(10, 5);
    });
    expect(mockUpdateQuantity).not.toHaveBeenCalled();
    expect(setPending).toHaveBeenCalledWith(10, true);

    await act(async () => {
      jest.advanceTimersByTime(350);
      await Promise.resolve();
    });

    expect(mockUpdateQuantity).toHaveBeenCalledTimes(1);
    expect(mockUpdateQuantity).toHaveBeenCalledWith(10, 5);
    expect(mockDispatchDomEvent).toHaveBeenCalledWith('shop:cart-updated');
    expect(setPending).toHaveBeenLastCalledWith(10, false);
  });

  it('clears pending timers on unmount before they can sync', () => {
    const ref = React.createRef<CartQuantitySyncApi>();
    const { unmount } = render(<SyncProbe ref={ref} />);

    act(() => {
      ref.current?.scheduleQuantitySync(10, 4);
    });
    unmount();
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(mockUpdateQuantity).not.toHaveBeenCalled();
    expect(mockDispatchDomEvent).not.toHaveBeenCalled();
  });

  it('flushes pending timer-backed quantities before checkout', async () => {
    const clearPending = jest.fn();
    const ref = React.createRef<CartQuantitySyncApi>();
    render(<SyncProbe ref={ref} clearPending={clearPending} />);

    act(() => {
      ref.current?.scheduleQuantitySync(10, 3);
    });

    await act(async () => {
      await ref.current?.flushPendingQuantityUpdates([cartItem({ id: 10, quantity: 7 })]);
    });

    expect(mockUpdateQuantity).toHaveBeenCalledTimes(1);
    expect(mockUpdateQuantity).toHaveBeenCalledWith(10, 7);
    expect(mockDispatchDomEvent).toHaveBeenCalledWith('shop:cart-updated');
    expect(clearPending).toHaveBeenCalledWith([10]);

    act(() => {
      jest.advanceTimersByTime(350);
    });
    expect(mockUpdateQuantity).toHaveBeenCalledTimes(1);
  });

  it('does not flush quantities for guest carts', async () => {
    mockAuthenticated = false;
    const ref = React.createRef<CartQuantitySyncApi>();
    render(<SyncProbe ref={ref} />);

    await act(async () => {
      await ref.current?.flushPendingQuantityUpdates([cartItem({ id: 10, quantity: 7 })]);
    });

    expect(mockUpdateQuantity).not.toHaveBeenCalled();
  });
});
