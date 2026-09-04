import { useCallback, useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { createApiAbortController, orderApi, paymentApi } from '../api';
import type { Language } from '../i18n';
import type { OrderCustomer, PaymentChannel, PaymentCustomer } from '../types';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { getApiErrorMessage } from '../utils/apiError';
import { getPaymentRecoveryState } from '../utils/paymentRecovery';
import {
  getPreferredPaymentChannel,
  normalizeStatusCode,
} from '../utils/profileHelpers';

type ProfileLocalization = {
  language: Language;
  t: (key: string, params?: Record<string, string | number>) => string;
};

type UseProfilePaymentActionsParams = {
  continuingPaymentRef: MutableRefObject<number | null>;
  fetchOrders: () => void | Promise<void>;
  language: Language;
  mountedRef: MutableRefObject<boolean>;
  paymentChannels: PaymentChannel[];
  profileLocalizationRef: MutableRefObject<ProfileLocalization>;
  selectedOrder: OrderCustomer | null;
  selectedPayment: PaymentCustomer | null;
  selectedPaymentMethod: string;
  setOrderPayments: Dispatch<SetStateAction<PaymentCustomer[]>>;
  setPayingOrderId: Dispatch<SetStateAction<number | null>>;
  setPaymentChannels: Dispatch<SetStateAction<PaymentChannel[]>>;
  setPaymentChannelsError: Dispatch<SetStateAction<string>>;
  setPaymentChannelsLoaded: Dispatch<SetStateAction<boolean>>;
  setPaymentChannelsLoading: Dispatch<SetStateAction<boolean>>;
  setPaymentModalVisible: Dispatch<SetStateAction<boolean>>;
  setRefreshingPayment: Dispatch<SetStateAction<boolean>>;
  setSelectedOrder: Dispatch<SetStateAction<OrderCustomer | null>>;
  setSelectedPayment: Dispatch<SetStateAction<PaymentCustomer | null>>;
  setSelectedPaymentMethod: Dispatch<SetStateAction<string>>;
  t: ProfileLocalization['t'];
};

/**
 * Commercial profile payment actions:
 * continue-pay, channel load, refresh charge, and payment modal state refresh.
 */
export const useProfilePaymentActions = ({
  continuingPaymentRef,
  fetchOrders,
  language,
  mountedRef,
  paymentChannels,
  profileLocalizationRef,
  selectedOrder,
  selectedPayment,
  selectedPaymentMethod,
  setOrderPayments,
  setPayingOrderId,
  setPaymentChannels,
  setPaymentChannelsError,
  setPaymentChannelsLoaded,
  setPaymentChannelsLoading,
  setPaymentModalVisible,
  setRefreshingPayment,
  setSelectedOrder,
  setSelectedPayment,
  setSelectedPaymentMethod,
  t,
}: UseProfilePaymentActionsParams) => {
  const refreshStateAbortRef = useRef<AbortController | null>(null);
  const channelsAbortRef = useRef<AbortController | null>(null);
  const continuePaymentAbortRef = useRef<AbortController | null>(null);
  const refreshPaymentAbortRef = useRef<AbortController | null>(null);
  const refreshingPaymentRef = useRef(false);

  useEffect(() => () => {
    refreshStateAbortRef.current?.abort();
    channelsAbortRef.current?.abort();
    continuePaymentAbortRef.current?.abort();
    refreshPaymentAbortRef.current?.abort();
  }, []);

  const refreshPaymentState = useCallback(async (orderId: number, isActive: () => boolean = () => true) => {
    refreshStateAbortRef.current?.abort();
    const abortController = createApiAbortController();
    refreshStateAbortRef.current = abortController;
    const requestIsActive = () => !abortController.signal.aborted && mountedRef.current && isActive();
    try {
      const [orderRes, paymentListRes] = await Promise.all([
        orderApi.getById(orderId, undefined, undefined, { signal: abortController.signal }),
        paymentApi.getByOrder(orderId, undefined, undefined, { signal: abortController.signal }),
      ]);
      if (!requestIsActive()) return;
      const paymentList = paymentListRes.data || [];
      const latestPayment = paymentList[0] || null;
      setSelectedOrder(orderRes.data);
      setOrderPayments(paymentList);
      if (latestPayment) {
        setSelectedPayment(latestPayment);
        setSelectedPaymentMethod(getPreferredPaymentChannel(paymentChannels, latestPayment.channel));
      }
    } catch (error) {
      if (!abortController.signal.aborted) throw error;
    } finally {
      if (refreshStateAbortRef.current === abortController) refreshStateAbortRef.current = null;
    }
  }, [mountedRef, paymentChannels, setOrderPayments, setSelectedOrder, setSelectedPayment, setSelectedPaymentMethod]);

  const handleContinuePayment = useCallback(async (order: OrderCustomer) => {
    if (continuingPaymentRef.current !== null) return;
    continuePaymentAbortRef.current?.abort();
    const abortController = createApiAbortController();
    continuePaymentAbortRef.current = abortController;
    continuingPaymentRef.current = order.id;
    if (mountedRef.current) setPayingOrderId(order.id);
    try {
      const paymentListRes = await paymentApi.getByOrder(order.id, undefined, undefined, { signal: abortController.signal });
      const paymentList = paymentListRes.data;
      const preferredMethod = getPreferredPaymentChannel(paymentChannels, order.paymentMethod || paymentList[0]?.channel);
      const paidPayment = paymentList.find((item) => normalizeStatusCode(item.status) === 'PAID');
      const reconcilePayment = paymentList.find((item) => normalizeStatusCode(item.status) === 'RECONCILE_REQUIRED');
      const pendingPayment = paymentList.find((item) => normalizeStatusCode(item.status) === 'PENDING' && !getPaymentRecoveryState(item).isExpired);
      // Reconcile payments must surface for review — never open/create a competing gateway charge.
      const reusablePayment = paidPayment || reconcilePayment || pendingPayment;
      if (!reusablePayment && !preferredMethod) {
        throw new Error(profileLocalizationRef.current.t('pages.checkout.paymentUnavailable'));
      }
      const latestPayment = reusablePayment || (await paymentApi.create(order.id, preferredMethod, undefined, undefined, { signal: abortController.signal })).data;
      if (abortController.signal.aborted || !mountedRef.current) return;
      setSelectedOrder(order);
      setOrderPayments(paymentList.some((item) => item.id === latestPayment.id) ? paymentList : [latestPayment, ...paymentList]);
      setSelectedPayment(latestPayment);
      setSelectedPaymentMethod(latestPayment.channel || preferredMethod);
      setPaymentModalVisible(true);
    } catch (err: unknown) {
      if (abortController.signal.aborted || !mountedRef.current) return;
      const { t: latestT, language: latestLanguage } = profileLocalizationRef.current;
      announceAccessibleMessage(getApiErrorMessage(err, latestT('pages.profile.continuePayFailed'), latestLanguage, { includeClientMessage: true }), 'error');
      void fetchOrders();
    } finally {
      if (continuingPaymentRef.current === order.id) {
        continuingPaymentRef.current = null;
      }
      if (mountedRef.current) setPayingOrderId(null);
      if (continuePaymentAbortRef.current === abortController) continuePaymentAbortRef.current = null;
    }
  }, [
    continuingPaymentRef,
    fetchOrders,
    paymentChannels,
    profileLocalizationRef,
    setOrderPayments,
    setPayingOrderId,
    setPaymentModalVisible,
    setSelectedOrder,
    setSelectedPayment,
    setSelectedPaymentMethod,
  ]);

  const handleRefreshPayment = useCallback(async () => {
    if (refreshingPaymentRef.current) return;
    if (!selectedOrder) return;
    if (normalizeStatusCode(selectedPayment?.status) === 'RECONCILE_REQUIRED') {
      announceAccessibleMessage(t('pages.profile.paymentReturnReconcileRequired'), 'warning');
      return;
    }
    const method = getPreferredPaymentChannel(paymentChannels, selectedPaymentMethod || selectedPayment?.channel || selectedOrder.paymentMethod);
    if (!method) {
      announceAccessibleMessage(t('pages.checkout.paymentUnavailable'), 'error');
      return;
    }
    refreshingPaymentRef.current = true;
    refreshPaymentAbortRef.current?.abort();
    const abortController = createApiAbortController();
    refreshPaymentAbortRef.current = abortController;
    setRefreshingPayment(true);
    try {
      const paymentRes = await paymentApi.create(selectedOrder.id, method, undefined, undefined, { signal: abortController.signal });
      if (abortController.signal.aborted || !mountedRef.current) return;
      setSelectedPayment(paymentRes.data);
      setSelectedPaymentMethod(paymentRes.data.channel);
      setOrderPayments((items) => [paymentRes.data, ...items.filter((item) => item.id !== paymentRes.data.id)]);
      announceAccessibleMessage(t('pages.profile.paymentRefreshed'), 'success');
      await fetchOrders();
    } catch (err: unknown) {
      if (abortController.signal.aborted || !mountedRef.current) return;
      announceAccessibleMessage(getApiErrorMessage(err, t('pages.profile.continuePayFailed'), language, { includeClientMessage: true }), 'error');
      await fetchOrders();
    } finally {
      refreshingPaymentRef.current = false;
      if (refreshPaymentAbortRef.current === abortController) refreshPaymentAbortRef.current = null;
      if (mountedRef.current) setRefreshingPayment(false);
    }
  }, [
    fetchOrders,
    language,
    paymentChannels,
    selectedOrder,
    selectedPayment,
    selectedPaymentMethod,
    setOrderPayments,
    setRefreshingPayment,
    setSelectedPayment,
    setSelectedPaymentMethod,
    t,
  ]);

  const loadPaymentChannels = useCallback(async (isActive: () => boolean = () => mountedRef.current) => {
    const abortController = createApiAbortController();
    const previousRequest = channelsAbortRef.current;
    previousRequest?.abort();
    channelsAbortRef.current = abortController;
    const requestIsActive = () => !abortController.signal.aborted && isActive();
    setPaymentChannelsLoading(true);
    setPaymentChannelsError('');
    try {
      const res = await paymentApi.getChannels({ signal: abortController.signal });
      if (!requestIsActive()) return;
      setPaymentChannels(res.data || []);
      setPaymentChannelsLoaded(true);
    } catch (error: unknown) {
      if (!requestIsActive()) return;
      setPaymentChannels([]);
      setPaymentChannelsLoaded(true);
      const { t: latestT, language: latestLanguage } = profileLocalizationRef.current;
      setPaymentChannelsError(getApiErrorMessage(error, latestT('pages.checkout.paymentUnavailableDescription'), latestLanguage));
    } finally {
      if (channelsAbortRef.current === abortController) channelsAbortRef.current = null;
      if (requestIsActive()) {
        setPaymentChannelsLoading(false);
      }
    }
  }, [
    mountedRef,
    profileLocalizationRef,
    setPaymentChannels,
    setPaymentChannelsError,
    setPaymentChannelsLoaded,
    setPaymentChannelsLoading,
  ]);

  return {
    handleContinuePayment,
    handleRefreshPayment,
    loadPaymentChannels,
    refreshPaymentState,
  };
};
