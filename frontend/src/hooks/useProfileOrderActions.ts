import { useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { useNavigate } from 'react-router-dom';
import { cartApi, orderApi } from '../api';
import type { Language } from '../i18n';
import type { OrderCustomer, OrderItemCustomer } from '../types';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { getApiErrorMessage } from '../utils/apiError';
import { dispatchDomEvent } from '../utils/domEvents';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import {
  isReturnReasonReady,
  isReturnTrackingReady,
  normalizeReturnReason,
  normalizeReturnTrackingNumber,
} from '../utils/returnFlow';
import { getLocalStorageItem } from '../utils/safeStorage';

type NavigateFn = ReturnType<typeof useNavigate>;

type UseProfileOrderActionsParams = {
  fetchOrders: () => void | Promise<void>;
  language: Language;
  mountedRef: MutableRefObject<boolean>;
  navigate: NavigateFn;
  orderDetailRequestSeqRef: MutableRefObject<number>;
  orderItems: OrderItemCustomer[];
  returnReason: string;
  returnRequestOrder: OrderCustomer | null;
  returnShipmentOrder: OrderCustomer | null;
  returnTrackingNumber: string;
  setConfirmingReceipt: Dispatch<SetStateAction<boolean>>;
  setOrderDetailVisible: Dispatch<SetStateAction<boolean>>;
  setOrderItems: Dispatch<SetStateAction<OrderItemCustomer[]>>;
  setReceiptConfirmOrder: Dispatch<SetStateAction<OrderCustomer | null>>;
  setReordering: Dispatch<SetStateAction<boolean>>;
  setRequestingReturn: Dispatch<SetStateAction<boolean>>;
  setReturnReason: Dispatch<SetStateAction<string>>;
  setReturnRequestOrder: Dispatch<SetStateAction<OrderCustomer | null>>;
  setReturnShipmentOrder: Dispatch<SetStateAction<OrderCustomer | null>>;
  setReturnTrackingNumber: Dispatch<SetStateAction<string>>;
  setSelectedOrder: Dispatch<SetStateAction<OrderCustomer | null>>;
  setSelectedTrackingCarrierCode: Dispatch<SetStateAction<string | undefined>>;
  setSelectedTrackingNumber: Dispatch<SetStateAction<string>>;
  setSelectedTrackingOrderId: Dispatch<SetStateAction<number | undefined>>;
  setSubmittingReturnShipment: Dispatch<SetStateAction<boolean>>;
  setTrackingVisible: Dispatch<SetStateAction<boolean>>;
  t: (key: string, params?: Record<string, string | number>) => string;
};

/**
 * Commercial profile order lifecycle:
 * detail, reorder, cancel, confirm receipt, return, and tracking.
 */
export const useProfileOrderActions = ({
  fetchOrders,
  language,
  mountedRef,
  navigate,
  orderDetailRequestSeqRef,
  orderItems,
  returnReason,
  returnRequestOrder,
  returnShipmentOrder,
  returnTrackingNumber,
  setConfirmingReceipt,
  setOrderDetailVisible,
  setOrderItems,
  setReceiptConfirmOrder,
  setReordering,
  setRequestingReturn,
  setReturnReason,
  setReturnRequestOrder,
  setReturnShipmentOrder,
  setReturnTrackingNumber,
  setSelectedOrder,
  setSelectedTrackingCarrierCode,
  setSelectedTrackingNumber,
  setSelectedTrackingOrderId,
  setSubmittingReturnShipment,
  setTrackingVisible,
  t,
}: UseProfileOrderActionsParams) => {
  const reorderingRef = useRef(false);
  const cancelingOrderIdsRef = useRef(new Set<number>());
  const confirmingReceiptRef = useRef(false);
  const requestingReturnRef = useRef(false);
  const submittingReturnShipmentRef = useRef(false);

  const handleViewOrder = async (order: OrderCustomer) => {
    const requestSeq = orderDetailRequestSeqRef.current + 1;
    orderDetailRequestSeqRef.current = requestSeq;
    setSelectedOrder(order);
    setOrderDetailVisible(true);
    setOrderItems([]);
    try {
      const res = await orderApi.getItems(order.id);
      if (!mountedRef.current || orderDetailRequestSeqRef.current !== requestSeq) return;
      setOrderItems(res.data);
    } catch (error) {
      if (!mountedRef.current || orderDetailRequestSeqRef.current !== requestSeq) return;
      reportNonBlockingError('Profile.loadOrderItems', error);
      setOrderItems([]);
    }
  };

  const openProductDetail = (productId: number) => {
    setOrderDetailVisible(false);
    navigate(`/products/${productId}`);
  };

  const handleReorder = async () => {
    if (!mountedRef.current || reorderingRef.current || !getLocalStorageItem('token') || orderItems.length === 0) return;
    reorderingRef.current = true;
    setReordering(true);
    let added = 0;
    const expectedQuantity = orderItems.reduce((sum, item) => sum + item.quantity, 0);
    try {
      for (const item of orderItems) {
        try {
          await cartApi.addItem(0, item.productId, item.quantity, item.selectedSpecs);
          added += item.quantity;
        } catch (error) {
          if (mountedRef.current) {
            reportNonBlockingError('Profile.reorderItem', error);
          }
        }
      }
      if (!mountedRef.current) return;
      if (added === 0) {
        announceAccessibleMessage(t('pages.profile.reorderFailed'), 'error');
        return;
      }
      announceAccessibleMessage(
        added === expectedQuantity
          ? t('pages.profile.reordered', { count: added })
          : t('pages.profile.reorderPartial', { count: added }), 'success');
      dispatchDomEvent('shop:cart-updated');
      dispatchDomEvent('shop:open-cart');
    } finally {
      reorderingRef.current = false;
      if (mountedRef.current) {
        setReordering(false);
      }
    }
  };

  const handleCancelOrder = async (orderId: number) => {
    if (!mountedRef.current || cancelingOrderIdsRef.current.has(orderId)) return;
    cancelingOrderIdsRef.current.add(orderId);
    try {
      await orderApi.cancel(orderId);
      if (!mountedRef.current) return;
      announceAccessibleMessage(t('pages.profile.orderCancelled'), 'success');
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      announceAccessibleMessage(getApiErrorMessage(err, t('pages.profile.cancelFailed'), language), 'error');
    } finally {
      cancelingOrderIdsRef.current.delete(orderId);
      if (mountedRef.current) void fetchOrders();
    }
  };

  const handleConfirmReceipt = async (orderId: number) => {
    if (!mountedRef.current || confirmingReceiptRef.current) return;
    confirmingReceiptRef.current = true;
    setConfirmingReceipt(true);
    try {
      await orderApi.confirm(orderId);
      if (!mountedRef.current) return;
      setReceiptConfirmOrder(null);
      announceAccessibleMessage(t('pages.profile.receiptConfirmed'), 'success');
      void fetchOrders();
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      announceAccessibleMessage(getApiErrorMessage(err, t('pages.profile.confirmFailed'), language), 'error');
    } finally {
      confirmingReceiptRef.current = false;
      if (mountedRef.current) setConfirmingReceipt(false);
    }
  };

  const confirmReceiptOrder = (order: OrderCustomer) => {
    setReceiptConfirmOrder(order);
  };

  const openReturnModal = (order: OrderCustomer) => {
    setReturnRequestOrder(order);
    setReturnReason(order.returnReason || '');
  };

  const handleReturnOrder = async () => {
    if (!mountedRef.current || requestingReturnRef.current || !returnRequestOrder) return;
    const cleanedReason = normalizeReturnReason(returnReason);
    if (!isReturnReasonReady(cleanedReason)) {
      announceAccessibleMessage(t('pages.profile.returnReasonRequired'), 'warning');
      return;
    }
    requestingReturnRef.current = true;
    try {
      setRequestingReturn(true);
      await orderApi.returnOrder(returnRequestOrder.id, cleanedReason);
      if (!mountedRef.current) return;
      announceAccessibleMessage(t('pages.profile.returnRequested'), 'success');
      setReturnRequestOrder(null);
      setReturnReason('');
      void fetchOrders();
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      announceAccessibleMessage(getApiErrorMessage(err, t('pages.profile.returnFailed'), language), 'error');
    } finally {
      requestingReturnRef.current = false;
      if (mountedRef.current) setRequestingReturn(false);
    }
  };

  const handleSubmitReturnShipment = async () => {
    if (!mountedRef.current || submittingReturnShipmentRef.current || !returnShipmentOrder) return;
    const cleanedTracking = normalizeReturnTrackingNumber(returnTrackingNumber);
    if (!isReturnTrackingReady(cleanedTracking)) {
      announceAccessibleMessage(t('pages.profile.returnTrackingInvalid'), 'error');
      return;
    }
    submittingReturnShipmentRef.current = true;
    try {
      setSubmittingReturnShipment(true);
      await orderApi.submitReturnShipment(returnShipmentOrder.id, cleanedTracking);
      if (!mountedRef.current) return;
      announceAccessibleMessage(t('pages.profile.returnShipmentSubmitted'), 'success');
      setReturnShipmentOrder(null);
      setReturnTrackingNumber('');
      void fetchOrders();
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      announceAccessibleMessage(getApiErrorMessage(err, t('pages.profile.returnShipmentFailed'), language), 'error');
    } finally {
      submittingReturnShipmentRef.current = false;
      if (mountedRef.current) setSubmittingReturnShipment(false);
    }
  };

  const handleTrackShipment = (trackingNumber?: string, carrierCode?: string, orderId?: number) => {
    if (!trackingNumber) {
      announceAccessibleMessage(t('pages.adminOrders.noTrackingNumber'), 'warning');
      return;
    }
    setSelectedTrackingNumber(trackingNumber);
    setSelectedTrackingCarrierCode(carrierCode);
    setSelectedTrackingOrderId(orderId);
    setTrackingVisible(true);
  };

  return {
    confirmReceiptOrder,
    handleCancelOrder,
    handleConfirmReceipt,
    handleReorder,
    handleReturnOrder,
    handleSubmitReturnShipment,
    handleTrackShipment,
    handleViewOrder,
    openProductDetail,
    openReturnModal,
  };
};
