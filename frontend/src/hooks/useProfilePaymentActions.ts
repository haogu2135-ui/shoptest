import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { orderApi, paymentApi } from '../api';
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
  const refreshPaymentState = useCallback(async (orderId: number, isActive: () => boolean = () => true) => {
    const [orderRes, paymentListRes] = await Promise.all([
      orderApi.getById(orderId),
      paymentApi.getByOrder(orderId),
    ]);
    if (!mountedRef.current || !isActive()) return;
    const paymentList = paymentListRes.data || [];
    const latestPayment = paymentList[0] || null;
    setSelectedOrder(orderRes.data);
    setOrderPayments(paymentList);
    if (latestPayment) {
      setSelectedPayment(latestPayment);
      setSelectedPaymentMethod(getPreferredPaymentChannel(paymentChannels, latestPayment.channel));
    }
  }, [mountedRef, paymentChannels, setOrderPayments, setSelectedOrder, setSelectedPayment, setSelectedPaymentMethod]);

  const handleContinuePayment = useCallback(async (order: OrderCustomer) => {
    if (continuingPaymentRef.current !== null) return;
    continuingPaymentRef.current = order.id;
    setPayingOrderId(order.id);
    try {
      const paymentListRes = await paymentApi.getByOrder(order.id);
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
      const latestPayment = reusablePayment || (await paymentApi.create(order.id, preferredMethod)).data;
      setSelectedOrder(order);
      setOrderPayments(paymentList.some((item) => item.id === latestPayment.id) ? paymentList : [latestPayment, ...paymentList]);
      setSelectedPayment(latestPayment);
      setSelectedPaymentMethod(latestPayment.channel || preferredMethod);
      setPaymentModalVisible(true);
    } catch (err: unknown) {
      const { t: latestT, language: latestLanguage } = profileLocalizationRef.current;
      announceAccessibleMessage(getApiErrorMessage(err, latestT('pages.profile.continuePayFailed'), latestLanguage, { includeClientMessage: true }), 'error');
      fetchOrders();
    } finally {
      if (continuingPaymentRef.current === order.id) {
        continuingPaymentRef.current = null;
      }
      setPayingOrderId(null);
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
    setRefreshingPayment(true);
    try {
      const paymentRes = await paymentApi.create(selectedOrder.id, method);
      setSelectedPayment(paymentRes.data);
      setSelectedPaymentMethod(paymentRes.data.channel);
      setOrderPayments((items) => [paymentRes.data, ...items.filter((item) => item.id !== paymentRes.data.id)]);
      announceAccessibleMessage(t('pages.profile.paymentRefreshed'), 'success');
      await fetchOrders();
    } catch (err: unknown) {
      announceAccessibleMessage(getApiErrorMessage(err, t('pages.profile.continuePayFailed'), language, { includeClientMessage: true }), 'error');
      await fetchOrders();
    } finally {
      setRefreshingPayment(false);
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
    setPaymentChannelsLoading(true);
    setPaymentChannelsError('');
    try {
      const res = await paymentApi.getChannels();
      if (!isActive()) return;
      setPaymentChannels(res.data || []);
      setPaymentChannelsLoaded(true);
    } catch (error: unknown) {
      if (!isActive()) return;
      setPaymentChannels([]);
      setPaymentChannelsLoaded(true);
      const { t: latestT, language: latestLanguage } = profileLocalizationRef.current;
      setPaymentChannelsError(getApiErrorMessage(error, latestT('pages.checkout.paymentUnavailableDescription'), latestLanguage));
    } finally {
      if (isActive()) {
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
