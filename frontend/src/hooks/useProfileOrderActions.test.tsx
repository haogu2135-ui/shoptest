import React, { useImperativeHandle, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { act, render } from '@testing-library/react';
import type { Language } from '../i18n';
import type { OrderCustomer, OrderItemCustomer } from '../types';
import { useProfileOrderActions } from './useProfileOrderActions';

const mockAddItem = jest.fn();
const mockCancel = jest.fn();
const mockConfirm = jest.fn();
const mockReturnOrder = jest.fn();
const mockSubmitReturnShipment = jest.fn();
const mockFetchOrders = jest.fn();
const mockAnnounce = jest.fn();
const mockDispatchDomEvent = jest.fn();
const mockReportError = jest.fn();

jest.mock('../api', () => ({
  cartApi: { addItem: (...args: unknown[]) => mockAddItem(...args) },
  orderApi: {
    cancel: (...args: unknown[]) => mockCancel(...args),
    confirm: (...args: unknown[]) => mockConfirm(...args),
    getItems: jest.fn(),
    returnOrder: (...args: unknown[]) => mockReturnOrder(...args),
    submitReturnShipment: (...args: unknown[]) => mockSubmitReturnShipment(...args),
  },
}));

jest.mock('../utils/accessibleMessage', () => ({
  announceAccessibleMessage: (...args: unknown[]) => mockAnnounce(...args),
}));

jest.mock('../utils/domEvents', () => ({
  dispatchDomEvent: (...args: unknown[]) => mockDispatchDomEvent(...args),
}));

jest.mock('../utils/nonBlockingError', () => ({
  reportNonBlockingError: (...args: unknown[]) => mockReportError(...args),
}));

type ProfileOrderActionParams = Parameters<typeof useProfileOrderActions>[0];
type ProfileOrderActions = ReturnType<typeof useProfileOrderActions>;

const setState = <T,>() => jest.fn() as unknown as Dispatch<SetStateAction<T>>;

const order: OrderCustomer = {
  id: 42,
  totalAmount: 25,
  status: 'SHIPPED',
};

const orderItems: OrderItemCustomer[] = [
  {
    id: 1,
    productId: 101,
    quantity: 1,
    price: 10,
    productName: 'First item',
    imageUrl: '/first.jpg',
  },
  {
    id: 2,
    productId: 102,
    quantity: 2,
    price: 5,
    productName: 'Second item',
    imageUrl: '/second.jpg',
  },
];

const createParams = (mountedRef: MutableRefObject<boolean>, overrides: Partial<ProfileOrderActionParams> = {}): ProfileOrderActionParams => ({
  fetchOrders: mockFetchOrders,
  language: 'en' as Language,
  mountedRef,
  navigate: jest.fn(),
  orderDetailRequestSeqRef: { current: 0 },
  orderItems,
  returnReason: 'The item arrived damaged',
  returnRequestOrder: order,
  returnShipmentOrder: order,
  returnTrackingNumber: 'TRACK123',
  setConfirmingReceipt: setState<boolean>(),
  setOrderDetailVisible: setState<boolean>(),
  setOrderItems: setState<OrderItemCustomer[]>(),
  setReceiptConfirmOrder: setState<OrderCustomer | null>(),
  setReordering: setState<boolean>(),
  setRequestingReturn: setState<boolean>(),
  setReturnReason: setState<string>(),
  setReturnRequestOrder: setState<OrderCustomer | null>(),
  setReturnShipmentOrder: setState<OrderCustomer | null>(),
  setReturnTrackingNumber: setState<string>(),
  setSelectedOrder: setState<OrderCustomer | null>(),
  setSelectedTrackingCarrierCode: setState<string | undefined>(),
  setSelectedTrackingNumber: setState<string>(),
  setSelectedTrackingOrderId: setState<number | undefined>(),
  setSubmittingReturnShipment: setState<boolean>(),
  setTrackingVisible: setState<boolean>(),
  t: (key: string) => key,
  ...overrides,
});

const ActionProbe = React.forwardRef<ProfileOrderActions, { params: ProfileOrderActionParams }>(({ params }, ref) => {
  const actions = useProfileOrderActions(params);
  useImperativeHandle(ref, () => actions, [actions]);
  return null;
});

const deferred = <T,>() => {
  let resolvePromise: (value: T | PromiseLike<T>) => void = () => undefined;
  let rejectPromise: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return { promise, resolve: resolvePromise, reject: rejectPromise };
};

describe('useProfileOrderActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('token', 'member-token');
    mockAddItem.mockResolvedValue({ data: {} });
    mockCancel.mockResolvedValue({ data: {} });
    mockConfirm.mockResolvedValue({ data: {} });
    mockReturnOrder.mockResolvedValue({ data: {} });
    mockSubmitReturnShipment.mockResolvedValue({ data: {} });
  });

  it('suppresses cancel feedback and refreshes after unmount while preserving the mutation', async () => {
    const pending = deferred<unknown>();
    mockCancel.mockReturnValueOnce(pending.promise);
    const mountedRef = { current: true };
    const ref = React.createRef<ProfileOrderActions>();
    const { unmount } = render(<ActionProbe ref={ref} params={createParams(mountedRef)} />);

    let action: Promise<void> | undefined;
    act(() => {
      action = ref.current?.handleCancelOrder(order.id);
    });
    mountedRef.current = false;
    pending.resolve({});
    await act(async () => {
      await action;
    });

    expect(mockCancel).toHaveBeenCalledWith(order.id);
    expect(mockAnnounce).not.toHaveBeenCalled();
    expect(mockFetchOrders).not.toHaveBeenCalled();
    unmount();
  });

  it('latches duplicate receipt confirmations and avoids post-unmount state cleanup', async () => {
    const pending = deferred<unknown>();
    mockConfirm.mockReturnValueOnce(pending.promise);
    const mountedRef = { current: true };
    const confirmingReceipt = jest.fn() as unknown as Dispatch<SetStateAction<boolean>>;
    const params = createParams(mountedRef, { setConfirmingReceipt: confirmingReceipt });
    const ref = React.createRef<ProfileOrderActions>();
    const { unmount } = render(<ActionProbe ref={ref} params={params} />);

    let firstAction: Promise<void> | undefined;
    act(() => {
      firstAction = ref.current?.handleConfirmReceipt(order.id);
      void ref.current?.handleConfirmReceipt(order.id);
    });
    mountedRef.current = false;
    pending.resolve({});
    await act(async () => {
      await firstAction;
    });

    expect(mockConfirm).toHaveBeenCalledTimes(1);
    expect(confirmingReceipt).toHaveBeenCalledTimes(1);
    expect(mockAnnounce).not.toHaveBeenCalled();
    expect(mockFetchOrders).not.toHaveBeenCalled();
    unmount();
  });

  it('suppresses return and return-shipment feedback after unmount', async () => {
    const mountedRef = { current: true };
    const returnPending = deferred<unknown>();
    mockReturnOrder.mockReturnValueOnce(returnPending.promise);
    const ref = React.createRef<ProfileOrderActions>();
    const { unmount } = render(<ActionProbe ref={ref} params={createParams(mountedRef)} />);

    let returnAction: Promise<void> | undefined;
    act(() => {
      returnAction = ref.current?.handleReturnOrder();
    });
    mountedRef.current = false;
    returnPending.resolve({});
    await act(async () => {
      await returnAction;
    });

    expect(mockReturnOrder).toHaveBeenCalledWith(order.id, 'The item arrived damaged');
    expect(mockAnnounce).not.toHaveBeenCalled();
    expect(mockFetchOrders).not.toHaveBeenCalled();
    unmount();

    const nextMountedRef = { current: true };
    const shipmentPending = deferred<unknown>();
    mockSubmitReturnShipment.mockReturnValueOnce(shipmentPending.promise);
    const shipmentRef = React.createRef<ProfileOrderActions>();
    const { unmount: unmountShipment } = render(
      <ActionProbe ref={shipmentRef} params={createParams(nextMountedRef)} />,
    );
    let shipmentAction: Promise<void> | undefined;
    act(() => {
      shipmentAction = shipmentRef.current?.handleSubmitReturnShipment();
    });
    nextMountedRef.current = false;
    shipmentPending.resolve({});
    await act(async () => {
      await shipmentAction;
    });

    expect(mockSubmitReturnShipment).toHaveBeenCalledWith(order.id, 'TRACK123');
    expect(mockAnnounce).not.toHaveBeenCalled();
    expect(mockFetchOrders).not.toHaveBeenCalled();
    unmountShipment();
  });

  it('finishes all started reorder mutations after unmount without stale UI effects', async () => {
    const mountedRef = { current: true };
    mockAddItem.mockImplementationOnce(async () => {
      mountedRef.current = false;
      return { data: {} };
    });
    const ref = React.createRef<ProfileOrderActions>();
    const { unmount } = render(<ActionProbe ref={ref} params={createParams(mountedRef)} />);

    await act(async () => {
      await ref.current?.handleReorder();
    });

    expect(mockAddItem).toHaveBeenCalledTimes(2);
    expect(mockDispatchDomEvent).not.toHaveBeenCalled();
    expect(mockAnnounce).not.toHaveBeenCalled();
    unmount();
  });
});
