import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { Form } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { cartApi, createApiAbortController, orderApi, paymentApi } from '../api';
import type { OrderCustomer, OrderItemCustomer, PaymentCustomer } from '../types';
import { useLanguage } from '../i18n';
import { usePageTitle } from '../hooks/usePageTitle';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useMarket } from '../hooks/useMarket';
import {
  isReturnReasonReady,
  isReturnTrackingReady,
  normalizeReturnReason,
  normalizeReturnTrackingNumber,
} from '../utils/returnFlow';
import { addGuestCartItem } from '../utils/guestCart';
import { dispatchDomEvent } from '../utils/domEvents';
import { getLocalStorageItem, hasStoredValue } from '../utils/safeStorage';
import { loadGuestSupportContext, normalizeGuestSupportContext, saveGuestSupportContext } from '../utils/guestSupportContext';
import { getApiErrorMessage } from '../utils/apiError';
import { buildLoginUrlFromWindow } from '../utils/authRedirect';
import { isAdminRole } from '../utils/roles';
import './OrderTracking.css';
import '../styles/mobile-page-contrast.css';
import { navigateToCommercialPaymentUrl, getPaymentRecoveryState } from '../utils/paymentRecovery';
import {
  ORDER_STATUS_LABEL_KEYS,
  ORDER_TRACKING_AUTO_REFRESH_MS,
  cleanTrackingParam,
  getTrackingStep,
  isGuestTrackedOrder,
  normalizeStatusCode,
  shouldAutoRefreshTrackedOrder,
  statusColor,
} from './orderTrackingHelpers';
import {
  OrderTrackingDialogs,
  OrderTrackingMainPanels,
  type OrderTrackingPanelsProps,
} from './orderTrackingPanels';

export { ORDER_TRACKING_AUTO_REFRESH_MS, shouldAutoRefreshTrackedOrder } from './orderTrackingHelpers';

const OrderTracking: React.FC = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [rollbackConfirmOpen, setRollbackConfirmOpen] = useState(false);
  const [receiptConfirmOpen, setReceiptConfirmOpen] = useState(false);
  const [confirmingReceipt, setConfirmingReceipt] = useState(false);
  const [returning, setReturning] = useState(false);
  const [returnShipping, setReturnShipping] = useState(false);
  const [returnRequestOpen, setReturnRequestOpen] = useState(false);
  const [returnShipmentOpen, setReturnShipmentOpen] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [returnTrackingNumber, setReturnTrackingNumber] = useState('');
  const [lookupError, setLookupError] = useState('');
  const [trackedEmail, setTrackedEmail] = useState('');
  const [order, setOrder] = useState<OrderCustomer | null>(null);
  const [items, setItems] = useState<OrderItemCustomer[]>([]);
  const [detailsRestricted, setDetailsRestricted] = useState(false);
  const [prefillNoticeVisible, setPrefillNoticeVisible] = useState(false);
  const [paymentReturnEmailGateVisible, setPaymentReturnEmailGateVisible] = useState(false);
  const paymentReturnEmailInputRef = useRef<HTMLInputElement | null>(null);
  const paymentReturnAutoTrackKeyRef = useRef('');
  const mountedRef = useRef(true);
  const trackRequestSeqRef = useRef(0);
  const trackAbortRef = useRef<AbortController | null>(null);
  const refreshAbortRef = useRef<AbortController | null>(null);
  const { t, language } = useLanguage();
  usePageTitle(t('pages.orderTracking.title'));
  useDocumentMeta({
    title: t('pages.orderTracking.title'),
    description: t('common.siteDescription'),
    path: '/track-order',
    type: 'website',
    noIndex: true,
    siteName: t('common.siteTitle'),
  });
  const { formatMoney } = useMarket();
  const dateLocale = language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US';
  const orderTrackingItemName = (item: Pick<OrderItemCustomer, 'productId' | 'productName'>) => (
    (item.productName || '').trim() || t('pages.profile.productFallback', { id: item.productId })
  );
  const formatOrderStatusLabel = useCallback((status?: string) => {
    const rawStatus = String(status || '').trim();
    const normalizedStatus = normalizeStatusCode(rawStatus);
    if (!normalizedStatus) return t('common.unknown');
    if (ORDER_STATUS_LABEL_KEYS.has(normalizedStatus)) return t(`status.${normalizedStatus}`);
    return rawStatus;
  }, [t]);
  const getOrderStatusColor = useCallback((status?: string) => {
    const normalizedStatus = normalizeStatusCode(status);
    if (!ORDER_STATUS_LABEL_KEYS.has(normalizedStatus)) return 'default';
    return statusColor[normalizedStatus] || 'default';
  }, []);
  const trackingStep = getTrackingStep(order?.status);
  const paymentReturnStatus = cleanTrackingParam(searchParams.get('payment'), 40).toLowerCase();
  const isSignedIn = hasStoredValue('token');
  const canUseGuestActions = Boolean(isGuestTrackedOrder(order) && trackedEmail && order?.orderNo);
  const canUseSignedInActions = Boolean(
    isSignedIn
    && order
    && !isGuestTrackedOrder(order)
    && (isAdminRole(getLocalStorageItem('role')) || !detailsRestricted),
  );
  const canOperateTrackedOrder = !detailsRestricted && (canUseSignedInActions || canUseGuestActions);
  const canShowFullTrackingDetails = Boolean(order && !detailsRestricted);
  const trackedOrderLabel = order ? order.orderNo || `#${order.id}` : t('pages.orderTracking.title');
  const trackActionLabel = (action: string) => `${action}: ${trackedOrderLabel}`;
  const returnRequestActionLabel = `${t('pages.profile.returnOrder')}: ${trackedOrderLabel}`;
  const returnShipmentActionLabel = `${t('pages.profile.submitReturnShipment')}: ${trackedOrderLabel}`;
  const returnReasonInputLabel = `${t('pages.profile.returnReason')}: ${trackedOrderLabel}`;
  const returnTrackingInputLabel = `${t('pages.profile.returnTracking')}: ${trackedOrderLabel}`;
  const signInForOrder = useCallback(() => navigate(buildLoginUrlFromWindow()), [navigate]);
  const supportOpen = useCallback(() => {
    if (isGuestTrackedOrder(order) && order?.orderNo && trackedEmail) {
      saveGuestSupportContext({ orderNo: order.orderNo, email: trackedEmail });
      dispatchDomEvent('shop:open-support', { orderNo: order.orderNo, email: trackedEmail });
      return;
    }
    if (!hasStoredValue('token')) {
      dispatchDomEvent('shop:open-support', { clearGuestContext: true });
      return;
    }
    dispatchDomEvent('shop:open-support', { clearGuestContext: true });
  }, [order, trackedEmail]);
  const nextAction = useMemo(() => {
    if (!order) return null;
    if (!canOperateTrackedOrder) {
      return {
        title: t('pages.orderTracking.accountOrderTitle'),
        text: t('pages.orderTracking.accountOrderText'),
        tone: 'info',
      };
    }
    if (order.status === 'PENDING_PAYMENT') {
      return {
        title: t('pages.orderTracking.nextPayTitle'),
        text: t('pages.orderTracking.nextPayText'),
        tone: 'warning',
      };
    }
    if (order.status === 'PENDING_SHIPMENT') {
      return {
        title: t('pages.orderTracking.nextPrepareTitle'),
        text: t('pages.orderTracking.nextPrepareText'),
        tone: 'info',
      };
    }
    if (order.status === 'COMPLETED') {
      return {
        title: t('pages.orderTracking.nextDeliveredTitle'),
        text: t('pages.orderTracking.nextDeliveredText'),
        tone: 'success',
      };
    }
    if (order.trackingNumber) {
      return {
        title: t('pages.orderTracking.nextTrackTitle'),
        text: t('pages.orderTracking.nextTrackText', { number: order.trackingNumber }),
        tone: 'success',
      };
    }
    return {
      title: t('pages.orderTracking.nextSupportTitle'),
      text: t('pages.orderTracking.nextSupportText'),
      tone: 'info',
    };
  }, [canOperateTrackedOrder, order, t]);
  const assurancePlan = useMemo(() => {
    if (!order) return null;
    if (detailsRestricted) return null;
    const itemCount = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const isDelivered = order.status === 'COMPLETED';
    const isShipped = Boolean(order.trackingNumber);
    return {
      itemCount,
      title: isDelivered ? t('pages.orderTracking.assuranceDeliveredTitle') : t('pages.orderTracking.assuranceActiveTitle'),
      text: isDelivered
        ? t('pages.orderTracking.assuranceDeliveredText', { count: itemCount })
        : isShipped
          ? t('pages.orderTracking.assuranceShippedText', { count: itemCount })
          : t('pages.orderTracking.assurancePreparingText', { count: itemCount }),
      primaryLabel: isDelivered ? t('pages.orderTracking.shopAgain') : t('pages.profile.contactSupport'),
      primaryAction: isDelivered ? () => navigate('/products') : supportOpen,
    };
  }, [detailsRestricted, items, navigate, order, supportOpen, t]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      trackRequestSeqRef.current += 1;
      trackAbortRef.current?.abort();
      refreshAbortRef.current?.abort();
    };
  }, []);

  const trackOrder = useCallback(async (values: { orderNo: string; email: string }, quiet = false) => {
    trackAbortRef.current?.abort();
    refreshAbortRef.current?.abort();
    const requestSeq = trackRequestSeqRef.current + 1;
    trackRequestSeqRef.current = requestSeq;
    const abortController = createApiAbortController();
    trackAbortRef.current = abortController;
    const isCurrentTrackRequest = () => mountedRef.current && trackRequestSeqRef.current === requestSeq;
    setLoading(true);
    setLookupError('');
    setReturnRequestOpen(false);
    setReturnShipmentOpen(false);
    setReturnReason('');
    setReturnTrackingNumber('');
    const normalizedEmail = values.email.trim().toLowerCase();
    try {
      const res = await orderApi.track(values.orderNo.trim(), normalizedEmail, { signal: abortController.signal });
      if (!isCurrentTrackRequest()) {
        return;
      }
      setTrackedEmail(normalizedEmail);
      setOrder(res.data.order);
      setItems(res.data.items || []);
      setDetailsRestricted(res.data.detailsRestricted === true);
      setReturnReason(res.data.order?.returnReason || '');
      setReturnTrackingNumber(res.data.order?.returnTrackingNumber || '');
    } catch (error: unknown) {
      if (!isCurrentTrackRequest()) {
        return;
      }
      if (abortController.signal.aborted) {
        return;
      }
      setTrackedEmail('');
      setOrder(null);
      setItems([]);
      setDetailsRestricted(false);
      const errorMessage = getApiErrorMessage(error, t('pages.orderTracking.notFound'), language);
      setLookupError(errorMessage);
      if (!quiet) {
        announceAccessibleMessage(errorMessage, 'error');
      }
    } finally {
      if (trackAbortRef.current === abortController) {
        trackAbortRef.current = null;
      }
      if (isCurrentTrackRequest()) {
        setLoading(false);
      }
    }
  }, [language, t]);

  const onFinish = (values: { orderNo: string; email: string }) => {
    setPrefillNoticeVisible(false);
    setPaymentReturnEmailGateVisible(false);
    void trackOrder(values);
  };

  useEffect(() => {
    const orderNo = cleanTrackingParam(searchParams.get('orderNo') || searchParams.get('order'), 80);
    const queryContext = normalizeGuestSupportContext({
      orderNo,
      email: searchParams.get('guestEmail') || searchParams.get('email'),
    });
    if (queryContext) {
      saveGuestSupportContext(queryContext);
    }
    if (searchParams.has('email') || searchParams.has('guestEmail')) {
      const sanitized = new URLSearchParams(searchParams);
      sanitized.delete('email');
      sanitized.delete('guestEmail');
      if (sanitized.toString() !== searchParams.toString()) {
        setSearchParams(sanitized, { replace: true });
      }
    }
    const storedContext = queryContext || loadGuestSupportContext();
    const storedEmail = storedContext?.orderNo.toUpperCase() === orderNo.toUpperCase() ? storedContext.email : '';
    const email = storedEmail;
    if (!orderNo) {
      setPrefillNoticeVisible(false);
      return;
    }
    form.setFieldsValue(email ? { orderNo, email } : { orderNo });
    setPrefillNoticeVisible(Boolean(email));
  }, [form, searchParams, setSearchParams]);

  useEffect(() => {
    const isPaymentReturn = paymentReturnStatus === 'success'
      || paymentReturnStatus === 'cancelled'
      || paymentReturnStatus === 'canceled'
      || paymentReturnStatus === 'failed';
    if (!isPaymentReturn || order || loading) {
      return;
    }

    const orderNo = cleanTrackingParam(searchParams.get('orderNo') || searchParams.get('order'), 80);
    if (!orderNo) {
      return;
    }

    const queryContext = normalizeGuestSupportContext({
      orderNo,
      email: searchParams.get('guestEmail') || searchParams.get('email'),
    });
    const storedContext = queryContext || loadGuestSupportContext();
    const email = storedContext && storedContext.orderNo.toUpperCase() === orderNo.toUpperCase()
      ? String(storedContext.email || '').trim().toLowerCase()
      : '';
    if (!email) {
      form.setFieldsValue({ orderNo });
      setPaymentReturnEmailGateVisible(true);
      window.requestAnimationFrame(() => {
        paymentReturnEmailInputRef.current?.focus?.();
      });
      return;
    }

    setPaymentReturnEmailGateVisible(false);
    const autoTrackKey = `${paymentReturnStatus}:${orderNo}:${email}`;
    if (paymentReturnAutoTrackKeyRef.current === autoTrackKey) {
      return;
    }
    paymentReturnAutoTrackKeyRef.current = autoTrackKey;
    form.setFieldsValue({ orderNo, email });
    setPrefillNoticeVisible(false);
    void trackOrder({ orderNo, email }, true);
  }, [form, loading, order, paymentReturnStatus, searchParams, trackOrder]);

  const refreshTrackedOrder = useCallback(async (quiet = false) => {
    if (!order?.orderNo || !trackedEmail) return false;
    if (quiet && refreshAbortRef.current) return false;
    refreshAbortRef.current?.abort();
    const abortController = createApiAbortController();
    refreshAbortRef.current = abortController;
    try {
      const refreshed = await orderApi.track(order.orderNo, trackedEmail, { signal: abortController.signal, bypassCache: true });
      if (!mountedRef.current || abortController.signal.aborted) return false;
      setOrder(refreshed.data.order);
      setItems(refreshed.data.items || []);
      setDetailsRestricted(refreshed.data.detailsRestricted === true);
      setReturnReason(refreshed.data.order?.returnReason || '');
      setReturnTrackingNumber(refreshed.data.order?.returnTrackingNumber || '');
      return true;
    } catch (error: unknown) {
      if (!mountedRef.current || abortController.signal.aborted) return false;
      if (!quiet) {
        announceAccessibleMessage(getApiErrorMessage(error, t('pages.orderTracking.trackingFailed'), language), 'warning');
      }
      return false;
    } finally {
      if (refreshAbortRef.current === abortController) {
        refreshAbortRef.current = null;
      }
    }
  }, [language, order?.orderNo, t, trackedEmail]);

  const autoRefreshEnabled = Boolean(order?.orderNo && trackedEmail && !detailsRestricted && shouldAutoRefreshTrackedOrder(order));

  useEffect(() => {
    if (!autoRefreshEnabled) return;

    const runAutoRefresh = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      void refreshTrackedOrder(true);
    };

    const intervalId = window.setInterval(runAutoRefresh, ORDER_TRACKING_AUTO_REFRESH_MS);
    const handleVisibilityChange = () => {
      if (typeof document === 'undefined' || !document.hidden) {
        runAutoRefresh();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [autoRefreshEnabled, refreshTrackedOrder]);

  const continuePayment = async () => {
    if (!order || order.status !== 'PENDING_PAYMENT' || !canOperateTrackedOrder) return;
    setPaying(true);
    try {
      const paymentsRes = await paymentApi.getByOrder(order.id, canUseGuestActions ? trackedEmail : undefined, canUseGuestActions ? order.orderNo : undefined);
      const payments = paymentsRes.data || [];
      if (payments.some((payment: PaymentCustomer) => String(payment.status || '').trim().toUpperCase() === 'RECONCILE_REQUIRED')) {
        announceAccessibleMessage(t('pages.profile.paymentReturnReconcileRequired'), 'warning');
        return;
      }
      const reusablePayment = payments.find((payment: PaymentCustomer) => payment.status === 'PAID')
        || payments.find((payment: PaymentCustomer) => payment.status === 'PENDING' && !getPaymentRecoveryState(payment).isExpired);
      let payment = reusablePayment;
      if (!payment) {
        const channelsRes = await paymentApi.getChannels();
        const channels = channelsRes.data || [];
        const channel = channels.find((item) => item.code === order.paymentMethod)?.code
          || channels.find((item) => item.recommended)?.code
          || channels[0]?.code;
        if (!channel) {
          announceAccessibleMessage(t('pages.checkout.paymentUnavailable'), 'error');
          return;
        }
        payment = (await paymentApi.create(order.id, channel, canUseGuestActions ? trackedEmail : undefined, canUseGuestActions ? order.orderNo : undefined)).data;
      }
      if (payment.status === 'PAID') {
        announceAccessibleMessage(t('pages.checkout.paidTitle'), 'success');
        await refreshTrackedOrder();
        return;
      }
      announceAccessibleMessage(t('pages.checkout.paymentReady'), 'success');
      if (payment.paymentUrl && !navigateToCommercialPaymentUrl(payment.paymentUrl)) {
        announceAccessibleMessage(t('pages.payment.failed'), 'error');
      }
    } catch (error: unknown) {
      announceAccessibleMessage(getApiErrorMessage(error, t('pages.profile.continuePayFailed'), language), 'error');
    } finally {
      setPaying(false);
    }
  };

  const restoreTrackedItemsToCart = async () => {
    if (hasStoredValue('token')) {
      const results = await Promise.allSettled(items.map((item) => cartApi.addItem(0, item.productId, item.quantity, item.selectedSpecs)));
      const restored = results.filter((result) => result.status === 'fulfilled').length;
      const failed = results.length - restored;
      if (restored > 0) {
        dispatchDomEvent('shop:cart-updated');
      }
      return { restored, failed };
    }
    let restored = 0;
    let failed = 0;
    items.forEach((item) => {
      const added = addGuestCartItem({
        id: item.productId,
        name: orderTrackingItemName(item),
        imageUrl: item.imageUrl,
        price: item.price,
        status: 'ACTIVE',
      }, item.quantity, item.selectedSpecs, item.price);
      if (added) {
        restored += 1;
      } else {
        failed += 1;
      }
    });
    return { restored, failed };
  };

  const cancelPendingPayment = () => {
    if (!order || order.status !== 'PENDING_PAYMENT' || !canOperateTrackedOrder) return;
    setRollbackConfirmOpen(true);
  };

  const handleRollbackConfirm = async () => {
    if (!order || order.status !== 'PENDING_PAYMENT' || !canOperateTrackedOrder) return;
    setCanceling(true);
    try {
      await orderApi.cancel(order.id, canUseGuestActions ? trackedEmail : undefined, canUseGuestActions ? order.orderNo : undefined);
      const restoreResult = await restoreTrackedItemsToCart();
      setOrder({ ...order, status: 'CANCELLED' });
      setRollbackConfirmOpen(false);
      if (restoreResult.failed > 0) {
        announceAccessibleMessage(t('pages.checkout.rollbackPaymentCartRestorePartial', { count: restoreResult.failed }), 'warning');
        return;
      }
      announceAccessibleMessage(t('pages.checkout.rollbackPaymentSuccess'), 'success');
      navigate('/cart');
    } catch (error: unknown) {
      announceAccessibleMessage(getApiErrorMessage(error, t('pages.checkout.rollbackPaymentFailed'), language), 'error');
    } finally {
      setCanceling(false);
    }
  };

  const confirmReceipt = async () => {
    if (!order || order.status !== 'SHIPPED' || !canOperateTrackedOrder) return;
    setConfirmingReceipt(true);
    try {
      await orderApi.confirm(order.id, canUseGuestActions ? trackedEmail : undefined, canUseGuestActions ? order.orderNo : undefined);
      await refreshTrackedOrder();
      setReceiptConfirmOpen(false);
      announceAccessibleMessage(t('pages.profile.receiptConfirmed'), 'success');
    } catch (error: unknown) {
      announceAccessibleMessage(getApiErrorMessage(error, t('pages.profile.confirmFailed'), language), 'error');
    } finally {
      setConfirmingReceipt(false);
    }
  };

  const confirmReceiptWithReview = () => {
    if (!order || order.status !== 'SHIPPED' || !canOperateTrackedOrder) return;
    setReceiptConfirmOpen(true);
  };

  const submitReturnRequest = async () => {
    if (!order?.returnable || !canOperateTrackedOrder) return;
    const cleanedReason = normalizeReturnReason(returnReason);
    if (!isReturnReasonReady(cleanedReason)) {
      announceAccessibleMessage(t('pages.profile.returnReasonRequired'), 'warning');
      return;
    }
    setReturning(true);
    try {
      await orderApi.returnOrder(order.id, cleanedReason, canUseGuestActions ? trackedEmail : undefined, canUseGuestActions ? order.orderNo : undefined);
      await refreshTrackedOrder();
      setReturnRequestOpen(false);
      setReturnReason('');
      announceAccessibleMessage(t('pages.profile.returnRequested'), 'success');
    } catch (error: unknown) {
      announceAccessibleMessage(getApiErrorMessage(error, t('pages.profile.returnFailed'), language), 'error');
    } finally {
      setReturning(false);
    }
  };

  const submitReturnTracking = async () => {
    if (!order || order.status !== 'RETURN_APPROVED' || !canOperateTrackedOrder) return;
    const cleanedTracking = normalizeReturnTrackingNumber(returnTrackingNumber);
    if (!isReturnTrackingReady(cleanedTracking)) {
      announceAccessibleMessage(t('pages.profile.returnTrackingInvalid'), 'error');
      return;
    }
    setReturnShipping(true);
    try {
      await orderApi.submitReturnShipment(order.id, cleanedTracking, canUseGuestActions ? trackedEmail : undefined, canUseGuestActions ? order.orderNo : undefined);
      await refreshTrackedOrder();
      setReturnShipmentOpen(false);
      setReturnTrackingNumber('');
      announceAccessibleMessage(t('pages.profile.returnShipmentSubmitted'), 'success');
    } catch (error: unknown) {
      announceAccessibleMessage(getApiErrorMessage(error, t('pages.profile.returnShipmentFailed'), language), 'error');
    } finally {
      setReturnShipping(false);
    }
  };

  return (
    <div className={`order-tracking-page order-tracking-page--${language}`}>
      {(() => {
        const panelProps: OrderTrackingPanelsProps = {
          t,
          language,
          navigate,
          form,
          formatMoney,
          formatOrderStatusLabel,
          getOrderStatusColor,
          orderTrackingItemName,
          loading,
          paying,
          canceling,
          confirmingReceipt,
          returning,
          returnShipping,
          order,
          items,
          lookupError,
          detailsRestricted,
          canShowFullTrackingDetails,
          canOperateTrackedOrder,
          canUseGuestActions,
          canUseSignedInActions,
          trackedEmail,
          trackingStep,
          nextAction,
          assurancePlan,
          paymentReturnStatus,
          paymentReturnEmailGateVisible,
          paymentReturnEmailInputRef,
          prefillNoticeVisible,
          setPrefillNoticeVisible,
          dateLocale,
          trackActionLabel,
          trackedOrderLabel,
          returnRequestOpen,
          setReturnRequestOpen,
          returnShipmentOpen,
          setReturnShipmentOpen,
          returnReason,
          setReturnReason,
          returnTrackingNumber,
          setReturnTrackingNumber,
          returnReasonInputLabel,
          returnTrackingInputLabel,
          returnRequestActionLabel,
          returnShipmentActionLabel,
          rollbackConfirmOpen,
          setRollbackConfirmOpen,
          receiptConfirmOpen,
          setReceiptConfirmOpen,
          onFinish,
          continuePayment,
          cancelPendingPayment,
          handleRollbackConfirm,
          confirmReceipt,
          confirmReceiptWithReview,
          submitReturnRequest,
          submitReturnTracking,
          restoreTrackedItemsToCart,
          signInForOrder,
          supportOpen,
        };
        return (
          <>
            <OrderTrackingMainPanels {...panelProps} />
            <OrderTrackingDialogs {...panelProps} />
          </>
        );
      })()}
    </div>
  );
};

export default OrderTracking;
