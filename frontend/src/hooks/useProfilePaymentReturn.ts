import { useCallback, useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { SetURLSearchParams } from 'react-router-dom';
import { createApiAbortController, paymentApi } from '../api';
import type { Language } from '../i18n';
import type { OrderCustomer, PaymentChannel, PaymentCustomer } from '../types';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import {
  getPreferredPaymentChannel,
  normalizeProfileOrderNo,
  normalizeProfileTab,
  normalizeStatusCode,
} from '../utils/profileHelpers';

type ProfileLocalization = {
  language: Language;
  t: (key: string, params?: Record<string, string | number>) => string;
};

type UseProfilePaymentReturnParams = {
  fetchOrders: () => void | Promise<void>;
  handleContinuePayment: (order: OrderCustomer) => void | Promise<void>;
  isPaymentReturnIncomplete: boolean;
  mountedRef: MutableRefObject<boolean>;
  ordersInitialLoadComplete: boolean;
  ordersRef: MutableRefObject<OrderCustomer[]>;
  paymentChannels: PaymentChannel[];
  paymentChannelsLoaded: boolean;
  paymentReturnOrderId: number;
  paymentReturnOrderNo: string;
  paymentReturnStatus: string;
  paymentReturnSyncSeqRef: MutableRefObject<number>;
  profileLocalizationRef: MutableRefObject<ProfileLocalization>;
  searchParams: URLSearchParams;
  setOrderPayments: Dispatch<SetStateAction<PaymentCustomer[]>>;
  setOrderSearchText: Dispatch<SetStateAction<string>>;
  setOrderStatusFilter: Dispatch<SetStateAction<string>>;
  setProfileActiveTab: Dispatch<SetStateAction<string>>;
  setSearchParams: SetURLSearchParams;
  setSelectedPayment: Dispatch<SetStateAction<PaymentCustomer | null>>;
  setSelectedPaymentMethod: Dispatch<SetStateAction<string>>;
};

/**
 * Commercial profile payment-return recovery:
 * success sync, cancelled/failed routing, and continue-pay auto-resume.
 */
export const useProfilePaymentReturn = ({
  fetchOrders,
  handleContinuePayment,
  isPaymentReturnIncomplete,
  mountedRef,
  ordersInitialLoadComplete,
  ordersRef,
  paymentChannels,
  paymentChannelsLoaded,
  paymentReturnOrderId,
  paymentReturnOrderNo,
  paymentReturnStatus,
  paymentReturnSyncSeqRef,
  profileLocalizationRef,
  searchParams,
  setOrderPayments,
  setOrderSearchText,
  setOrderStatusFilter,
  setProfileActiveTab,
  setSearchParams,
  setSelectedPayment,
  setSelectedPaymentMethod,
}: UseProfilePaymentReturnParams) => {
  const handledPaymentReturnRef = useRef('');
  const autoResumePaymentReturnRef = useRef('');
  const paymentReturnAbortRef = useRef<AbortController | null>(null);

  useEffect(() => () => {
    paymentReturnAbortRef.current?.abort();
  }, []);

  const syncPaymentReturnState = useCallback(async (order: OrderCustomer) => {
    paymentReturnAbortRef.current?.abort();
    const abortController = createApiAbortController();
    paymentReturnAbortRef.current = abortController;
    const syncSeq = paymentReturnSyncSeqRef.current + 1;
    paymentReturnSyncSeqRef.current = syncSeq;
    const isCurrentPaymentReturnSync = () => mountedRef.current && paymentReturnSyncSeqRef.current === syncSeq;
    try {
      const paymentListRes = await paymentApi.syncByOrder(order.id, { signal: abortController.signal });
      if (!isCurrentPaymentReturnSync()) return;
      const mergedPayments = paymentListRes.data || [];
      const latestPayment = mergedPayments[0] || null;
      setOrderPayments(mergedPayments);
      if (latestPayment) {
        setSelectedPayment(latestPayment);
        setSelectedPaymentMethod(getPreferredPaymentChannel(paymentChannels, latestPayment.channel));
      }
      await fetchOrders();
      if (!isCurrentPaymentReturnSync()) return;
      const { t: latestT } = profileLocalizationRef.current;
      if (mergedPayments.some((payment) => normalizeStatusCode(payment.status) === 'RECONCILE_REQUIRED')) {
        announceAccessibleMessage(latestT('pages.profile.paymentReturnReconcileRequired'), 'warning');
      } else if (mergedPayments.some((payment) => normalizeStatusCode(payment.status) === 'PAID')) {
        announceAccessibleMessage(latestT('pages.profile.paymentReturnSynced'), 'success');
      } else {
        announceAccessibleMessage(latestT('pages.profile.paymentReturnPending'), 'info');
      }
    } catch (error) {
      if (!abortController.signal.aborted) throw error;
    } finally {
      if (paymentReturnAbortRef.current === abortController) paymentReturnAbortRef.current = null;
    }
  }, [
    fetchOrders,
    mountedRef,
    paymentChannels,
    paymentReturnSyncSeqRef,
    profileLocalizationRef,
    setOrderPayments,
    setSelectedPayment,
    setSelectedPaymentMethod,
  ]);

  useEffect(() => {
    if (paymentReturnStatus !== 'success') return;
    if (!paymentChannelsLoaded) return;
    if (!ordersInitialLoadComplete) return;
    const targetOrderId = Number.isFinite(paymentReturnOrderId) && paymentReturnOrderId > 0 ? paymentReturnOrderId : null;
    const targetOrder = ordersRef.current.find((order) => paymentReturnOrderNo && normalizeProfileOrderNo(order.orderNo) === paymentReturnOrderNo)
      || ordersRef.current.find((order) => targetOrderId !== null && order.id === targetOrderId);
    if (!targetOrder) return;
    const returnKey = `${paymentReturnStatus}:${targetOrder.id}:${paymentReturnOrderNo || targetOrder.orderNo || ''}`;
    if (handledPaymentReturnRef.current === returnKey) return;
    handledPaymentReturnRef.current = returnKey;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('payment');
    nextParams.delete('orderNo');
    nextParams.delete('orderId');
    if (!normalizeProfileTab(nextParams.get('tab'))) {
      nextParams.set('tab', 'orders');
    }
    setSearchParams(nextParams, { replace: true });
    syncPaymentReturnState(targetOrder).catch(() => {
      if (mountedRef.current && handledPaymentReturnRef.current === returnKey) {
        announceAccessibleMessage(profileLocalizationRef.current.t('pages.profile.paymentReturnSyncFailed'), 'error');
        fetchOrders();
      }
    });
  }, [
    fetchOrders,
    mountedRef,
    ordersInitialLoadComplete,
    ordersRef,
    paymentChannelsLoaded,
    paymentReturnOrderId,
    paymentReturnOrderNo,
    paymentReturnStatus,
    profileLocalizationRef,
    searchParams,
    setSearchParams,
    syncPaymentReturnState,
  ]);

  useEffect(() => {
    if (!isPaymentReturnIncomplete) return;
    if (!ordersInitialLoadComplete) return;
    const returnKey = `incomplete:${paymentReturnStatus}:${paymentReturnOrderNo || paymentReturnOrderId || ''}`;
    if (handledPaymentReturnRef.current === returnKey) return;
    handledPaymentReturnRef.current = returnKey;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('payment');
    if (!normalizeProfileTab(nextParams.get('tab'))) {
      nextParams.set('tab', 'orders');
    }
    // Keep orderNo so orders list can surface the pending order when present.
    setSearchParams(nextParams, { replace: true });
    setProfileActiveTab('orders');
    setOrderStatusFilter('PENDING_PAYMENT');
    if (paymentReturnOrderNo) {
      setOrderSearchText(paymentReturnOrderNo);
    }
    const { t: latestT } = profileLocalizationRef.current;
    if (paymentReturnStatus === 'failed') {
      announceAccessibleMessage(paymentReturnOrderNo
        ? latestT('pages.profile.paymentReturnFailedOrder', { orderNo: paymentReturnOrderNo })
        : latestT('pages.profile.paymentReturnFailed'), 'error');
    } else {
      announceAccessibleMessage(paymentReturnOrderNo
        ? latestT('pages.profile.paymentReturnCancelledOrder', { orderNo: paymentReturnOrderNo })
        : latestT('pages.profile.paymentReturnCancelled'), 'warning');
    }
  }, [
    isPaymentReturnIncomplete,
    ordersInitialLoadComplete,
    paymentReturnOrderId,
    paymentReturnOrderNo,
    paymentReturnStatus,
    profileLocalizationRef,
    searchParams,
    setOrderSearchText,
    setOrderStatusFilter,
    setProfileActiveTab,
    setSearchParams,
  ]);

  // After cancelled/failed gateway return, open continue-payment for the matching pending order.
  useEffect(() => {
    if (!ordersInitialLoadComplete || !paymentChannelsLoaded) return;
    if (!paymentReturnOrderNo && !(Number.isFinite(paymentReturnOrderId) && paymentReturnOrderId > 0)) return;
    // Resume is keyed off the incomplete return handling ref once URL payment= is cleared.
    const handledKey = handledPaymentReturnRef.current;
    if (!handledKey.startsWith('incomplete:')) return;

    const targetOrderId = Number.isFinite(paymentReturnOrderId) && paymentReturnOrderId > 0 ? paymentReturnOrderId : null;
    const targetOrder = ordersRef.current.find((order) => paymentReturnOrderNo && normalizeProfileOrderNo(order.orderNo) === paymentReturnOrderNo)
      || ordersRef.current.find((order) => targetOrderId !== null && order.id === targetOrderId);
    if (!targetOrder || normalizeStatusCode(targetOrder.status) !== 'PENDING_PAYMENT') return;

    const resumeKey = `resume:${handledKey}:${targetOrder.id}`;
    if (autoResumePaymentReturnRef.current === resumeKey) return;
    autoResumePaymentReturnRef.current = resumeKey;
    void handleContinuePayment(targetOrder);
  }, [
    handleContinuePayment,
    ordersInitialLoadComplete,
    ordersRef,
    paymentChannelsLoaded,
    paymentReturnOrderId,
    paymentReturnOrderNo,
  ]);
};
