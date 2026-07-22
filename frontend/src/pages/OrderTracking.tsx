import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { ShopIcon, SI } from '../components/ShopIcon';
import { Alert, Button, Form, Input, Tag } from 'antd';
import ShopModal from '../components/ShopModal';
import ShopConfirm from '../components/ShopConfirm';
import type { InputRef } from 'antd/es/input';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageEmpty from '../components/PageEmpty';
import PageError from '../components/PageError';
import { cartApi, createApiAbortController, orderApi, paymentApi } from '../api';
import type { OrderCustomer, OrderItemCustomer, PaymentCustomer } from '../types';
import { useLanguage } from '../i18n';
import { usePageTitle } from '../hooks/usePageTitle';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useMarket } from '../hooks/useMarket';
import { formatSelectedSpecs } from '../utils/selectedSpecs';
import { paymentMethodLabel } from '../utils/paymentMethods';
import { productImageFallback, resolveProductImage } from '../utils/productMedia';
import {
  isReturnReasonReady,
  isReturnTrackingReady,
  normalizeReturnReason,
  normalizeReturnTrackingNumber,
  RETURN_REASON_PRESET_KEYS,
  returnReasonPresetI18nKey,
  returnFlowStepI18nKeys,
} from '../utils/returnFlow';
import { addGuestCartItem } from '../utils/guestCart';
import { dispatchDomEvent } from '../utils/domEvents';
import { getLocalStorageItem, hasStoredValue } from '../utils/safeStorage';
import { loadGuestSupportContext, normalizeGuestSupportContext, saveGuestSupportContext } from '../utils/guestSupportContext';
import { getApiErrorMessage } from '../utils/apiError';
import { buildLoginUrlFromWindow } from '../utils/authRedirect';
import { isAdminRole } from '../utils/roles';
import SeventeenTrackWidget from '../components/SeventeenTrackWidget';
import './OrderTracking.css';
import '../styles/mobile-page-contrast.css';
import { focusFirstFormError } from '../utils/formValidationFocus';
import { navigateToCommercialPaymentUrl, getPaymentRecoveryState } from '../utils/paymentRecovery';

const orderTrackingImageFallback = productImageFallback;
const resolveOrderTrackingImage = resolveProductImage;

const cleanTrackingParam = (value: string | null, maxLength = 120) =>
  Array.from(String(value || ''), (char) => {
    const code = char.charCodeAt(0);
    return code <= 31 || code === 127 ? ' ' : char;
  }).join('').trim().slice(0, maxLength);

const statusColor: Record<string, string> = {
  PENDING_PAYMENT: 'orange',
  PENDING_SHIPMENT: 'blue',
  SHIPPED: 'cyan',
  COMPLETED: 'green',
  CANCELLED: 'red',
  RETURN_REQUESTED: 'gold',
  RETURN_APPROVED: 'geekblue',
  RETURN_SHIPPED: 'cyan',
  RETURN_REFUNDING: 'magenta',
  RETURNED: 'purple',
};

const ORDER_STATUS_LABEL_KEYS = new Set([
  'PENDING_PAYMENT',
  'PENDING_SHIPMENT',
  'SHIPPED',
  'PENDING_RECEIPT',
  'COMPLETED',
  'CANCELLED',
  'RETURN_REQUESTED',
  'RETURN_APPROVED',
  'RETURN_SHIPPED',
  'RETURN_REFUNDING',
  'RETURNED',
  'REFUNDED',
  'DELIVERED',
]);

const normalizeStatusCode = (status?: string) => String(status || '').trim().toUpperCase();

const getTrackingStep = (status?: string) => {
  if (status === 'COMPLETED' || status === 'RETURN_REFUNDING' || status === 'RETURNED') return 3;
  if (status === 'SHIPPED' || status === 'RETURN_SHIPPED') return 2;
  if (status === 'PENDING_SHIPMENT' || status === 'RETURN_APPROVED') return 1;
  return 0;
};

export const ORDER_TRACKING_AUTO_REFRESH_MS = 30_000;

const ORDER_TRACKING_TERMINAL_STATUSES = new Set([
  'CANCELLED',
  'COMPLETED',
  'DELIVERED',
  'REFUNDED',
  'RETURN_REFUNDING',
  'RETURNED',
]);

export const shouldAutoRefreshTrackedOrder = (order?: Pick<OrderCustomer, 'status'> | null) => {
  if (!order) return false;
  const normalizedStatus = normalizeStatusCode(order.status);
  if (!normalizedStatus) return true;
  return !ORDER_TRACKING_TERMINAL_STATUSES.has(normalizedStatus);
};

const isGuestTrackedOrder = (order?: OrderCustomer | null) => Boolean(
  order?.guestOrder || String(order?.shippingAddress || '').startsWith('[Guest]'),
);

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
  const paymentReturnEmailInputRef = useRef<InputRef | null>(null);
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
      <h1 className="order-tracking-page__title">{t('pages.orderTracking.title')}</h1>
      {paymentReturnStatus === 'success' ? (
        <Alert
          className="order-tracking-page__paymentReturn"
          data-order-tracking-payment-return="success"
          type={order && order.status === 'PENDING_PAYMENT' ? 'info' : 'success'}
          showIcon
          role="alert"
          aria-live="assertive"
          message={order && order.status === 'PENDING_PAYMENT'
            ? t('pages.profile.paymentReturnPending')
            : t('pages.checkout.paidTitle')}
          description={order && order.status === 'PENDING_PAYMENT'
            ? t('pages.profile.paymentReturnPending')
            : t('pages.checkout.paymentRecoveryNextPaid')}
        />
      ) : paymentReturnStatus === 'cancelled' || paymentReturnStatus === 'canceled' ? (
        <Alert
          className="order-tracking-page__paymentReturn"
          data-order-tracking-payment-return="cancelled"
          type="warning"
          showIcon
          role="alert"
          aria-live="assertive"
          message={t('pages.checkout.paymentRecoveryPending')}
          description={order
            ? t('pages.checkout.paymentRecoveryNextRetry')
            : t('pages.orderTracking.paymentReturnLookupHint')}
          action={(
            <div className="order-tracking-page__paymentReturnActions" data-order-tracking-payment-return-recovery="true">
              {order && order.status === 'PENDING_PAYMENT' && canOperateTrackedOrder ? (
                <Button
                  size="small"
                  type="primary"
                  icon={<ShopIcon path={SI.creditCard} />}
                  loading={paying}
                  aria-label={trackActionLabel(t('pages.profile.continuePay'))}
                  title={trackActionLabel(t('pages.profile.continuePay'))}
                  onClick={continuePayment}
                >
                  {t('pages.profile.continuePay')}
                </Button>
              ) : null}
              <Button
                size="small"
                icon={<ShopIcon path={SI.shopping} />}
                aria-label={trackActionLabel(t('pages.orderTracking.shopAgain'))}
                title={trackActionLabel(t('pages.orderTracking.shopAgain'))}
                onClick={() => navigate('/products')}
              >
                {t('pages.orderTracking.shopAgain')}
              </Button>
              <Button
                size="small"
                icon={<ShopIcon path={SI.gift} />}
                aria-label={trackActionLabel(t('pages.orderTracking.emptyCoupons'))}
                title={trackActionLabel(t('pages.orderTracking.emptyCoupons'))}
                onClick={() => navigate('/coupons')}
              >
                {t('pages.orderTracking.emptyCoupons')}
              </Button>
              <Button
                size="small"
                icon={<ShopIcon path={SI.support} />}
                aria-label={trackActionLabel(t('pages.profile.contactSupport'))}
                title={trackActionLabel(t('pages.profile.contactSupport'))}
                onClick={supportOpen}
              >
                {t('pages.profile.contactSupport')}
              </Button>
            </div>
          )}
        />
      ) : paymentReturnStatus === 'failed' ? (
        <Alert
          className="order-tracking-page__paymentReturn"
          data-order-tracking-payment-return="failed"
          type="error"
          showIcon
          role="alert"
          aria-live="assertive"
          message={t('pages.orderTracking.paymentFailedTitle')}
          description={order
            ? t('pages.orderTracking.paymentFailedText')
            : t('pages.orderTracking.paymentReturnLookupHint')}
          action={(
            <div className="order-tracking-page__paymentReturnActions" data-order-tracking-payment-return-recovery="true">
              {order && order.status === 'PENDING_PAYMENT' && canOperateTrackedOrder ? (
                <Button
                  size="small"
                  type="primary"
                  icon={<ShopIcon path={SI.creditCard} />}
                  loading={paying}
                  aria-label={trackActionLabel(t('pages.profile.continuePay'))}
                  title={trackActionLabel(t('pages.profile.continuePay'))}
                  onClick={continuePayment}
                >
                  {t('pages.profile.continuePay')}
                </Button>
              ) : null}
              <Button
                size="small"
                icon={<ShopIcon path={SI.shopping} />}
                aria-label={trackActionLabel(t('pages.orderTracking.shopAgain'))}
                title={trackActionLabel(t('pages.orderTracking.shopAgain'))}
                onClick={() => navigate('/products')}
              >
                {t('pages.orderTracking.shopAgain')}
              </Button>
              <Button
                size="small"
                icon={<ShopIcon path={SI.gift} />}
                aria-label={trackActionLabel(t('pages.orderTracking.emptyCoupons'))}
                title={trackActionLabel(t('pages.orderTracking.emptyCoupons'))}
                onClick={() => navigate('/coupons')}
              >
                {t('pages.orderTracking.emptyCoupons')}
              </Button>
              <Button
                size="small"
                icon={<ShopIcon path={SI.support} />}
                aria-label={trackActionLabel(t('pages.profile.contactSupport'))}
                title={trackActionLabel(t('pages.profile.contactSupport'))}
                onClick={supportOpen}
              >
                {t('pages.profile.contactSupport')}
              </Button>
            </div>
          )}
        />
      ) : null}
      <section className="order-tracking-page__lookupCard" aria-label={t('pages.orderTracking.title')}>
        <div className="order-tracking-page__lookupHeader">
          <span className="order-tracking-page__lookupIcon"><ShopIcon path={SI.search} /></span>
          <span>
            <span className="order-tracking-page__text order-tracking-page__text--strong">{t('pages.orderTracking.title')}</span>
            <span className="order-tracking-page__text order-tracking-page__text--secondary">{t('pages.orderTracking.empty')}</span>
          </span>
        </div>
        {paymentReturnEmailGateVisible ? (
          <Alert
            className="order-tracking-page__paymentReturnEmailGate"
            data-order-tracking-payment-return-email-gate="true"
            type="info"
            showIcon
            role="status"
            message={t('pages.orderTracking.paymentReturnEmailRequiredTitle')}
            description={t('pages.orderTracking.paymentReturnEmailRequiredText')}
          />
        ) : null}
        {prefillNoticeVisible ? (
          <Alert
            className="order-tracking-page__prefillNotice"
            type="info"
            showIcon
            message={t('pages.orderTracking.prefillNotice')}
          />
        ) : null}
        <Form
          form={form}
          className="order-tracking-page__lookupForm"
          layout="vertical"
          requiredMark
          validateTrigger={['onChange', 'onBlur']}
          onFinish={onFinish}
          onFinishFailed={() => {
            focusFirstFormError({ rootSelector: '.order-tracking-page__lookupCard' });
          }}
          onValuesChange={() => setPrefillNoticeVisible(false)}
        >
          <Form.Item name="orderNo" label={t('pages.orderTracking.orderNo')} rules={[{ required: true, message: t('pages.orderTracking.orderNoRequired') }]}>
            <Input placeholder={t('pages.orderTracking.orderNoPlaceholder')} autoComplete="off" inputMode="text" maxLength={80} />
          </Form.Item>
          <Form.Item name="email" label={t('pages.orderTracking.email')} rules={[{ required: true, message: t('pages.orderTracking.emailRequired') }, { type: 'email', message: t('pages.auth.emailInvalid') }]}>
            <Input
              ref={paymentReturnEmailInputRef}
              className={paymentReturnEmailGateVisible ? 'order-tracking-page__emailInput--gate' : undefined}
              placeholder={t('pages.orderTracking.emailPlaceholder')}
              autoComplete="email"
              inputMode="email"
              maxLength={120}
              aria-label={t('pages.orderTracking.email')}
              title={t('pages.orderTracking.email')}
            />
          </Form.Item>
          <Button className="order-tracking-page__lookupButton" type="primary" htmlType="submit" loading={loading} icon={<ShopIcon path={SI.search} />} block>
            {t('pages.orderTracking.search')}
          </Button>
        </Form>
      </section>

      {!order ? (
        <section className="order-tracking-page__emptyState">
          {lookupError ? (
            <div data-order-tracking-lookup-recovery="true">
              <PageError
                className="order-tracking-page__lookupErrorState"
                title={lookupError}
                description={t('pages.orderTracking.empty')}
                actions={[
                  {
                    key: 'retry',
                    label: t('pages.orderTracking.search'),
                    onClick: () => { void form.submit(); },
                    type: 'primary',
                  },
                  {
                    key: 'shop',
                    label: t('pages.orderTracking.shopAgain'),
                    onClick: () => navigate('/products'),
                    type: 'default',
                  },
                  {
                    key: 'coupons',
                    label: t('pages.orderTracking.emptyCoupons'),
                    onClick: () => navigate('/coupons'),
                    type: 'default',
                  },
                  {
                    key: 'support',
                    label: t('pages.productList.loadRecoverySupport'),
                    onClick: () => dispatchDomEvent('shop:open-support'),
                    type: 'default',
                  },
                ]}
              />
            </div>
          ) : (
            <PageEmpty
              className="order-tracking-page__emptyPanel"
              description={(
                <div className="order-tracking-page__emptyCopy">
                  <div>{t('pages.orderTracking.empty')}</div>
                  <div className="order-tracking-page__emptyHint">{t('pages.orderTracking.emptyHint')}</div>
                </div>
              )}
              actions={[
                {
                  key: 'shop',
                  label: t('pages.orderTracking.shopAgain'),
                  onClick: () => navigate('/products'),
                },
                {
                  key: 'coupons',
                  label: t('pages.orderTracking.emptyCoupons'),
                  onClick: () => navigate('/coupons'),
                  type: 'default',
                },
                {
                  key: 'orders',
                  label: t('pages.orderTracking.emptyProfileOrders'),
                  onClick: () => navigate('/profile?tab=orders'),
                  type: 'default',
                },
                {
                  key: 'support',
                  label: t('pages.profile.contactSupport'),
                  onClick: supportOpen,
                  icon: <ShopIcon path={SI.support} />,
                  type: 'default',
                },
              ]}
            />
          )}
        </section>
      ) : (
        <div className="order-tracking-page__stack">
          <section className="order-tracking-page__journey" aria-label={t('pages.orderTracking.journeyTitle')}>
            <div className="order-tracking-page__journeyCopy">
              <span className="order-tracking-page__text order-tracking-page__eyebrow">{t('pages.orderTracking.journeyEyebrow')}</span>
              <h4 className="order-tracking-page__title">{t('pages.orderTracking.journeyTitle')}</h4>
              <span className="order-tracking-page__text order-tracking-page__text--secondary">
                {detailsRestricted
                  ? t('pages.orderTracking.accountDetailsText')
                  : order.trackingNumber
                  ? t('pages.orderTracking.journeyWithTracking', { number: order.trackingNumber })
                  : t('pages.orderTracking.journeyNoTracking')}
              </span>
            </div>
            <div className="order-tracking-page__steps" role="list">
              {[
                { step: 0, label: t('pages.orderTracking.stepPaid'), icon: <ShopIcon path={SI.checkCircle} /> },
                { step: 1, label: t('pages.orderTracking.stepPreparing'), icon: <ShopIcon path={SI.clock} /> },
                { step: 2, label: t('pages.orderTracking.stepInTransit'), icon: <ShopIcon path={SI.truck} /> },
                { step: 3, label: t('pages.orderTracking.stepDelivered'), icon: <ShopIcon path={SI.checkCircle} /> },
              ].map((item) => (
                <div
                  key={item.step}
                  className={`order-tracking-page__step ${trackingStep >= item.step ? 'is-active' : ''}`}
                  role="listitem"
                  aria-current={trackingStep === item.step ? 'step' : undefined}
                  aria-label={item.label}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </section>
          {!detailsRestricted ? (
            <section className="order-tracking-page__confidence">
              <div className="order-tracking-page__confidenceCard">
                <ShopIcon path={SI.truck} />
                <span>
                  <span className="order-tracking-page__text order-tracking-page__text--strong">{t('pages.orderTracking.confidenceDeliveryTitle')}</span>
                  <span className="order-tracking-page__text order-tracking-page__text--secondary">
                    {order.trackingNumber
                      ? t('pages.orderTracking.confidenceDeliveryTracked')
                      : t('pages.orderTracking.confidenceDeliveryPreparing')}
                  </span>
                </span>
              </div>
              <div className="order-tracking-page__confidenceCard">
                <ShopIcon path={SI.support} />
                <span>
                  <span className="order-tracking-page__text order-tracking-page__text--strong">{t('pages.orderTracking.confidenceSupportTitle')}</span>
                  <span className="order-tracking-page__text order-tracking-page__text--secondary">{t('pages.orderTracking.confidenceSupportText')}</span>
                </span>
              </div>
            </section>
          ) : null}
          {nextAction ? (
            <section className={`order-tracking-page__nextAction order-tracking-page__nextAction--${nextAction.tone}`}>
              <div>
                <span className="order-tracking-page__text order-tracking-page__text--strong">{nextAction.title}</span>
                <span className="order-tracking-page__text order-tracking-page__text--secondary">{nextAction.text}</span>
              </div>
              {!canOperateTrackedOrder ? (
                <div className="order-tracking-page__nextActionButtons">
                  <Button type="primary" aria-label={trackActionLabel(t('common.login'))} title={trackActionLabel(t('common.login'))} onClick={signInForOrder}>
                    {t('common.login')}
                  </Button>
                  <Button icon={<ShopIcon path={SI.support} />} aria-label={trackActionLabel(t('pages.profile.contactSupport'))} title={trackActionLabel(t('pages.profile.contactSupport'))} onClick={supportOpen}>
                    {t('pages.profile.contactSupport')}
                  </Button>
                </div>
              ) : order.status === 'PENDING_PAYMENT' ? (
                <div className="order-tracking-page__nextActionButtons">
                  <Button type="primary" icon={<ShopIcon path={SI.creditCard} />} loading={paying} aria-label={trackActionLabel(t('pages.profile.continuePay'))} title={trackActionLabel(t('pages.profile.continuePay'))} onClick={continuePayment}>
                    {t('pages.profile.continuePay')}
                  </Button>
                  <Button
                    aria-label={trackActionLabel(t('pages.paymentInstructions.title'))}
                    title={trackActionLabel(t('pages.paymentInstructions.title'))}
                    onClick={() => {
                      const emailQuery = trackedEmail ? `?guestEmail=${encodeURIComponent(trackedEmail)}` : '';
                      navigate(`/payment/${encodeURIComponent(String(order.orderNo || order.id))}${emailQuery}`);
                    }}
                  >
                    {t('pages.paymentInstructions.title')}
                  </Button>
                  <Button danger icon={<ShopIcon path={SI.rollback} />} loading={canceling} aria-label={trackActionLabel(t('pages.profile.cancelOrder'))} title={trackActionLabel(t('pages.profile.cancelOrder'))} onClick={cancelPendingPayment}>
                    {t('pages.profile.cancelOrder')}
                  </Button>
                  <Button icon={<ShopIcon path={SI.support} />} aria-label={trackActionLabel(t('pages.profile.contactSupport'))} title={trackActionLabel(t('pages.profile.contactSupport'))} onClick={supportOpen}>
                    {t('pages.profile.contactSupport')}
                  </Button>
                </div>
              ) : (
                <div className="order-tracking-page__nextActionButtons">
                  {order.status === 'SHIPPED' ? (
                    <Button type="primary" icon={<ShopIcon path={SI.checkCircle} />} loading={confirmingReceipt} aria-label={trackActionLabel(t('pages.profile.confirmReceipt'))} title={trackActionLabel(t('pages.profile.confirmReceipt'))} onClick={confirmReceiptWithReview}>
                      {t('pages.profile.confirmReceipt')}
                    </Button>
                  ) : null}
                  {order.returnable ? (
                    <Button icon={<ShopIcon path={SI.rollback} />} loading={returning} aria-label={returnRequestActionLabel} title={returnRequestActionLabel} onClick={() => setReturnRequestOpen(true)}>
                      {t('pages.profile.returnOrder')}
                    </Button>
                  ) : null}
                  {order.status === 'RETURN_APPROVED' ? (
                    <Button type="primary" icon={<ShopIcon path={SI.truck} />} loading={returnShipping} aria-label={returnShipmentActionLabel} title={returnShipmentActionLabel} onClick={() => setReturnShipmentOpen(true)}>
                      {t('pages.orderTracking.submitReturnTracking')}
                    </Button>
                  ) : null}
                  <Button icon={<ShopIcon path={SI.support} />} aria-label={trackActionLabel(t('pages.profile.contactSupport'))} title={trackActionLabel(t('pages.profile.contactSupport'))} onClick={supportOpen}>
                    {t('pages.profile.contactSupport')}
                  </Button>
                </div>
              )}
            </section>
          ) : null}
          {detailsRestricted ? (
            <Alert
              type="info"
              showIcon
              className="order-tracking-page__restrictedNotice"
              message={t('pages.orderTracking.accountDetailsTitle')}
              description={t('pages.orderTracking.accountDetailsText')}
              action={(
                <Button type="primary" size="small" aria-label={trackActionLabel(t('common.login'))} title={trackActionLabel(t('common.login'))} onClick={signInForOrder}>
                  {t('common.login')}
                </Button>
              )}
            />
          ) : null}
          {assurancePlan ? (
            <section className="order-tracking-page__assurance" aria-label={t('pages.orderTracking.assuranceTitle')}>
              <div>
                <span className="order-tracking-page__text order-tracking-page__eyebrow">{t('pages.orderTracking.assuranceEyebrow')}</span>
                <h4 className="order-tracking-page__title">{assurancePlan.title}</h4>
                <span className="order-tracking-page__text order-tracking-page__text--secondary">{assurancePlan.text}</span>
              </div>
              {!detailsRestricted ? (
                <div className="order-tracking-page__assuranceSignals">
                  <span><ShopIcon path={SI.checkCircle} /> {t('pages.orderTracking.assuranceItems', { count: assurancePlan.itemCount })}</span>
                  <span><ShopIcon path={SI.truck} /> {order.trackingNumber ? t('pages.orderTracking.assuranceTrackingReady') : t('pages.orderTracking.assuranceTrackingPending')}</span>
                  <span><ShopIcon path={SI.support} /> {t('pages.orderTracking.assuranceSupportReady')}</span>
                </div>
              ) : null}
              <div className="order-tracking-page__assuranceActions">
                <Button type="primary" aria-label={trackActionLabel(assurancePlan.primaryLabel)} title={trackActionLabel(assurancePlan.primaryLabel)} onClick={assurancePlan.primaryAction}>
                  {assurancePlan.primaryLabel}
                </Button>
                {order.status === 'COMPLETED' ? (
                  <Button aria-label={trackActionLabel(t('pages.profile.contactSupport'))} title={trackActionLabel(t('pages.profile.contactSupport'))} onClick={supportOpen} icon={<ShopIcon path={SI.support} />}>
                    {t('pages.profile.contactSupport')}
                  </Button>
                ) : null}
              </div>
            </section>
          ) : null}
          <section className="order-tracking-page__summaryCard" aria-label={t('pages.orderTracking.summary')}>
            <dl className="order-tracking-page__descList">
              <div className="order-tracking-page__descRow">
                <dt className="order-tracking-page__descLabel">{t('pages.orderTracking.orderNo')}</dt>
                <dd className="order-tracking-page__descValue">{order.orderNo || order.id}</dd>
              </div>
              {canShowFullTrackingDetails ? (
                <>
                  <div className="order-tracking-page__descRow">
                    <dt className="order-tracking-page__descLabel">{t('common.status')}</dt>
                    <dd className="order-tracking-page__descValue">
                      <Tag color={getOrderStatusColor(order.status)}>{formatOrderStatusLabel(order.status)}</Tag>
                    </dd>
                  </div>
                  <div className="order-tracking-page__descRow">
                    <dt className="order-tracking-page__descLabel">{t('common.amount')}</dt>
                    <dd className="order-tracking-page__descValue">
                      <span className="order-tracking-page__text order-tracking-page__text--strong order-tracking-page__amount commerce-money">{formatMoney(order.totalAmount)}</span>
                    </dd>
                  </div>
                  <div className="order-tracking-page__descRow">
                    <dt className="order-tracking-page__descLabel">{t('pages.checkout.paymentMethod')}</dt>
                    <dd className="order-tracking-page__descValue">
                      {order.paymentMethod ? paymentMethodLabel(order.paymentMethod, t) : '-'}
                    </dd>
                  </div>
                  <div className="order-tracking-page__descRow">
                    <dt className="order-tracking-page__descLabel">{t('pages.checkout.address')}</dt>
                    <dd className="order-tracking-page__descValue">{order.shippingAddress || '-'}</dd>
                  </div>
                </>
              ) : null}
              {canShowFullTrackingDetails ? (
                <>
                  <div className="order-tracking-page__descRow">
                    <dt className="order-tracking-page__descLabel">{t('pages.orderTracking.createdAt')}</dt>
                    <dd className="order-tracking-page__descValue">
                      {order.createdAt ? new Date(order.createdAt).toLocaleString(dateLocale) : '-'}
                    </dd>
                  </div>
                  <div className="order-tracking-page__descRow">
                    <dt className="order-tracking-page__descLabel">{t('pages.orderTracking.trackingNumber')}</dt>
                    <dd className="order-tracking-page__descValue">
                      {order.trackingNumber || t('pages.orderTracking.notShipped')}
                    </dd>
                  </div>
                </>
              ) : null}
              {canShowFullTrackingDetails && order.trackingCarrierName ? (
                <div className="order-tracking-page__descRow">
                  <dt className="order-tracking-page__descLabel">{t('pages.orderTracking.carrier')}</dt>
                  <dd className="order-tracking-page__descValue">{order.trackingCarrierName}</dd>
                </div>
              ) : null}
              {canShowFullTrackingDetails && order.returnDeadline ? (
                <div className="order-tracking-page__descRow">
                  <dt className="order-tracking-page__descLabel">{t('pages.profile.returnDeadline')}</dt>
                  <dd className="order-tracking-page__descValue">{new Date(order.returnDeadline).toLocaleString(dateLocale)}</dd>
                </div>
              ) : null}
              {canShowFullTrackingDetails && order.returnReason ? (
                <div className="order-tracking-page__descRow">
                  <dt className="order-tracking-page__descLabel">{t('pages.profile.returnReason')}</dt>
                  <dd className="order-tracking-page__descValue">{order.returnReason}</dd>
                </div>
              ) : null}
              {canShowFullTrackingDetails && order.returnTrackingNumber ? (
                <div className="order-tracking-page__descRow">
                  <dt className="order-tracking-page__descLabel">{t('pages.profile.returnTracking')}</dt>
                  <dd className="order-tracking-page__descValue">{order.returnTrackingNumber}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          {canShowFullTrackingDetails ? (
            <>
              <section className="order-tracking-page__itemsCard" aria-label={t('pages.profile.orderItems')}>
                {(!items || items.length === 0) ? (
                      <div className="order-tracking-page__itemsEmpty" data-order-tracking-items-empty="true">
                        <div className="order-tracking-page__itemsEmptyCopy">
                          <div>{t('pages.profile.noOrderItems')}</div>
                          <div className="order-tracking-page__itemsEmptyHint">{t('pages.orderTracking.noOrderItemsHint')}</div>
                        </div>
                        <div className="order-tracking-page__itemsEmptyActions" data-order-tracking-items-empty-actions="true">
                          <Button
                            type="primary"
                            icon={<ShopIcon path={SI.shopping} />}
                            aria-label={t('pages.orderTracking.shopAgain')}
                            title={t('pages.orderTracking.shopAgain')}
                            onClick={() => navigate('/products')}
                          >
                            {t('pages.orderTracking.shopAgain')}
                          </Button>
                          <Button
                            icon={<ShopIcon path={SI.gift} />}
                            aria-label={t('pages.orderTracking.emptyCoupons')}
                            title={t('pages.orderTracking.emptyCoupons')}
                            onClick={() => navigate('/coupons')}
                          >
                            {t('pages.orderTracking.emptyCoupons')}
                          </Button>
                          <Button
                            icon={<ShopIcon path={SI.support} />}
                            aria-label={t('pages.productList.loadRecoverySupport')}
                            title={t('pages.productList.loadRecoverySupport')}
                            onClick={() => dispatchDomEvent('shop:open-support')}
                          >
                            {t('pages.productList.loadRecoverySupport')}
                          </Button>
                        </div>
                      </div>
                ) : (
                  <ul className="order-tracking-page__itemList" role="list">
                    {items.map((item, index) => {
                    const itemName = orderTrackingItemName(item);
                    return (
                      <li key={String(item.id || `${item.productId || 'item'}-${index}`)} className="order-tracking-page__item">
                        <div className="order-tracking-page__itemMeta">
                            <img
                              src={resolveOrderTrackingImage(item.imageUrl)}
                              alt={itemName}
                              className="order-tracking-page__image order-tracking-page__itemAvatar"
                              onError={(event) => {
                                if (event.currentTarget.src !== orderTrackingImageFallback) {
                                  event.currentTarget.src = orderTrackingImageFallback;
                                }
                              }}
                            />
                          <div className="order-tracking-page__itemBody">
                            <span className="order-tracking-page__text order-tracking-page__text--strong order-tracking-page__itemTitle">{itemName}</span>
                            <div className="order-tracking-page__stack">
                              {item.selectedSpecs ? <span className="order-tracking-page__text order-tracking-page__text--secondary">{formatSelectedSpecs(item.selectedSpecs, t, language)}</span> : null}
                              <span className="order-tracking-page__text order-tracking-page__text--secondary order-tracking-page__itemUnit commerce-atomic commerce-price-quantity">
                                <span className="commerce-money">{formatMoney(item.price)}</span>
                                <span className="commerce-quantity">x {item.quantity}</span>
                              </span>
                            </div>
                          </div>
                        </div>
                        <span className="order-tracking-page__text order-tracking-page__text--strong order-tracking-page__itemTotal commerce-money">{formatMoney(item.price * item.quantity)}</span>
                      </li>
                    );
                  })}
                  </ul>
                )}
              </section>

              <section className="order-tracking-page__logisticsCard" aria-label={t('pages.orderTracking.logistics')}>
                {order.trackingNumber ? (
                  <SeventeenTrackWidget
                    trackingNumber={order.trackingNumber}
                    carrierCode={order.trackingCarrierCode}
                    orderId={order.id}
                    guestEmail={canUseGuestActions ? trackedEmail : undefined}
                    orderNo={canUseGuestActions ? order.orderNo : undefined}
                  />
                ) : (
                  <div className="order-tracking-page__notShipped" data-order-tracking-not-shipped="true" role="status">
                    <div className="order-tracking-page__emptyPanel">
                      <div className="order-tracking-page__emptyCopy">
                        <div>{t('pages.orderTracking.notShipped')}</div>
                        <div className="order-tracking-page__emptyHint">{t('pages.orderTracking.notShippedHint')}</div>
                      </div>
                      <div className="order-tracking-page__notShippedActions">
                        <Button
                          type="primary"
                          icon={<ShopIcon path={SI.support} />}
                          aria-label={trackActionLabel(t('pages.profile.contactSupport'))}
                          title={trackActionLabel(t('pages.profile.contactSupport'))}
                          onClick={supportOpen}
                        >
                          {t('pages.profile.contactSupport')}
                        </Button>
                        <Button
                          aria-label={trackActionLabel(t('pages.orderTracking.emptyProfileOrders'))}
                          title={trackActionLabel(t('pages.orderTracking.emptyProfileOrders'))}
                          onClick={() => navigate('/profile?tab=orders')}
                        >
                          {t('pages.orderTracking.emptyProfileOrders')}
                        </Button>
                        <Button
                          aria-label={trackActionLabel(t('pages.orderTracking.shopAgain'))}
                          title={trackActionLabel(t('pages.orderTracking.shopAgain'))}
                          onClick={() => navigate('/products')}
                        >
                          {t('pages.orderTracking.shopAgain')}
                        </Button>
                        <Button
                          aria-label={trackActionLabel(t('pages.orderTracking.emptyCoupons'))}
                          title={trackActionLabel(t('pages.orderTracking.emptyCoupons'))}
                          onClick={() => navigate('/coupons')}
                        >
                          {t('pages.orderTracking.emptyCoupons')}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            </>
          ) : null}
        </div>
      )}
      <ShopModal
        title={t('pages.profile.returnOrder')}
        open={returnRequestOpen}
        onOk={submitReturnRequest}
        onClose={() => { setReturnRequestOpen(false); setReturnReason(''); }}
        confirmLoading={returning}
        okText={t('pages.profile.returnOrder')}
        cancelText={t('common.cancel')}
        okButtonProps={{
          'aria-label': returnRequestActionLabel,
          title: returnRequestActionLabel,
          disabled: !isReturnReasonReady(returnReason),
        }}
        cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${returnRequestActionLabel}`, title: `${t('common.cancel')}: ${returnRequestActionLabel}` }}
        className="profile-mobile-safe-modal order-tracking-page__returnModal profile-return-modal"
        closeLabel={t('common.close', { defaultValue: 'Close' })}
      >
        <div className="order-tracking-page__stack">
          {order ? (
            <div
              className="profile-return-modal__summary"
              aria-label={t('pages.profile.returnOrderSummary', {
                orderNo: order.orderNo || order.id,
                amount: formatMoney(order.totalAmount),
              })}
            >
              <span className="order-tracking-page__text order-tracking-page__text--strong">
                {t('pages.profile.returnOrderSummary', {
                  orderNo: order.orderNo || order.id,
                  amount: formatMoney(order.totalAmount),
                })}
              </span>
            </div>
          ) : null}
          <div className="profile-return-modal__timeline" aria-label={t('pages.profile.returnTimelineTitle')}>
            <span className="order-tracking-page__text profile-return-modal__timelineTitle">{t('pages.profile.returnTimelineTitle')}</span>
            <div className="profile-return-modal__steps" role="list">
              {returnFlowStepI18nKeys.map((stepKey) => (
                <span key={stepKey} className="profile-return-modal__step" role="listitem">{t(stepKey)}</span>
              ))}
            </div>
          </div>
          <span className="order-tracking-page__text order-tracking-page__text--secondary">{t('pages.profile.returnReviewHint')}</span>
          {order?.returnDeadline ? (
            <span className="order-tracking-page__text order-tracking-page__text--secondary">
              {t('pages.profile.returnAvailableUntil', { time: new Date(order.returnDeadline).toLocaleString(dateLocale) })}
            </span>
          ) : null}
          <div className="profile-return-modal__presets" role="group" aria-label={t('pages.profile.returnReasonPresetsLabel')}>
            <span className="order-tracking-page__text profile-return-modal__presetsLabel">{t('pages.profile.returnReasonPresetsLabel')}</span>
            <div className="profile-return-modal__presetGrid">
              {RETURN_REASON_PRESET_KEYS.map((preset) => {
                const label = t(returnReasonPresetI18nKey(preset));
                const selected = normalizeReturnReason(returnReason).toLowerCase() === label.toLowerCase();
                return (
                  <Button
                    key={preset}
                    size="small"
                    type={selected ? 'primary' : 'default'}
                    className="profile-return-modal__preset"
                    aria-label={label}
                    title={label}
                    aria-pressed={selected}
                    onClick={() => setReturnReason(label)}
                  >
                    {label}
                  </Button>
                );
              })}
            </div>
          </div>
          <Input.TextArea
            rows={4}
            value={returnReason}
            status={returnReason && !isReturnReasonReady(returnReason) ? 'error' : undefined}
            onChange={(event) => setReturnReason(event.target.value)}
            maxLength={500}
            showCount
            placeholder={t('pages.profile.returnReasonPlaceholder')}
            aria-label={returnReasonInputLabel}
            title={returnReasonInputLabel}
          />
        </div>
      </ShopModal>
      <ShopModal
        title={t('pages.profile.submitReturnShipment')}
        open={returnShipmentOpen}
        onOk={submitReturnTracking}
        onClose={() => { setReturnShipmentOpen(false); setReturnTrackingNumber(''); }}
        confirmLoading={returnShipping}
        okText={t('pages.profile.submitReturnShipment')}
        cancelText={t('common.cancel')}
        okButtonProps={{
          'aria-label': returnShipmentActionLabel,
          title: returnShipmentActionLabel,
          disabled: !isReturnTrackingReady(returnTrackingNumber),
        }}
        cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${returnShipmentActionLabel}`, title: `${t('common.cancel')}: ${returnShipmentActionLabel}` }}
        className="profile-mobile-safe-modal order-tracking-page__returnModal profile-return-modal"
        closeLabel={t('common.close', { defaultValue: 'Close' })}
      >
        <div className="order-tracking-page__stack">
          {order ? (
            <div className="profile-return-modal__summary">
              <span className="order-tracking-page__text order-tracking-page__text--strong">
                {t('pages.profile.returnOrderSummary', {
                  orderNo: order.orderNo || order.id,
                  amount: formatMoney(order.totalAmount),
                })}
              </span>
            </div>
          ) : null}
          <div className="profile-return-modal__timeline" aria-label={t('pages.profile.returnShipmentStepsTitle')}>
            <span className="order-tracking-page__text profile-return-modal__timelineTitle">{t('pages.profile.returnShipmentStepsTitle')}</span>
            <div className="profile-return-modal__steps" role="list">
              {returnFlowStepI18nKeys.map((stepKey) => (
                <span key={stepKey} className="profile-return-modal__step" role="listitem">{t(stepKey)}</span>
              ))}
            </div>
          </div>
          <span className="order-tracking-page__text order-tracking-page__text--secondary">{t('pages.profile.returnShipmentHint')}</span>
          <Input
            value={returnTrackingNumber}
            onChange={(event) => setReturnTrackingNumber(event.target.value)}
            autoComplete="off"
            inputMode="text"
            maxLength={120}
            status={returnTrackingNumber && !isReturnTrackingReady(returnTrackingNumber) ? 'error' : undefined}
            placeholder={t('pages.profile.returnTrackingPlaceholder')}
            aria-label={returnTrackingInputLabel}
            title={returnTrackingInputLabel}
            onBlur={() => setReturnTrackingNumber((value) => normalizeReturnTrackingNumber(value))}
          />
        </div>
      </ShopModal>
      <ShopConfirm
        open={rollbackConfirmOpen}
        title={t('pages.checkout.rollbackPaymentTitle')}
        description={t('pages.checkout.rollbackPaymentContent')}
        okText={t('pages.checkout.rollbackPaymentAction')}
        cancelText={t('common.cancel')}
        confirmLoading={canceling}
        okButtonProps={{
          danger: true,
          'aria-label': order ? `${t('pages.checkout.rollbackPaymentAction')}: ${order.orderNo || `#${order.id}`}` : t('pages.checkout.rollbackPaymentAction'),
          title: order ? `${t('pages.checkout.rollbackPaymentAction')}: ${order.orderNo || `#${order.id}`}` : t('pages.checkout.rollbackPaymentAction'),
        }}
        cancelButtonProps={{
          'aria-label': `${t('common.cancel')}: ${t('pages.checkout.rollbackPaymentAction')}`,
          title: `${t('common.cancel')}: ${t('pages.checkout.rollbackPaymentAction')}`,
        }}
        className="profile-mobile-safe-modal order-tracking-page__rollbackConfirmModal"
        closeLabel={t('common.close', { defaultValue: 'Close' })}
        onOk={handleRollbackConfirm}
        onCancel={() => { if (!canceling) setRollbackConfirmOpen(false); }}
      />
      <ShopConfirm
        open={receiptConfirmOpen}
        title={t('pages.profile.confirmReceiptTitle')}
        description={order ? t('pages.profile.confirmReceiptContent', { orderNo: order.orderNo || order.id }) : t('pages.profile.confirmReceiptTitle')}
        okText={t('pages.profile.confirmReceipt')}
        cancelText={t('common.cancel')}
        confirmLoading={confirmingReceipt}
        okButtonProps={{
          'aria-label': order ? `${t('pages.profile.confirmReceipt')}: ${order.orderNo || `#${order.id}`}` : t('pages.profile.confirmReceipt'),
          title: order ? `${t('pages.profile.confirmReceipt')}: ${order.orderNo || `#${order.id}`}` : t('pages.profile.confirmReceipt'),
        }}
        cancelButtonProps={{
          'aria-label': `${t('common.cancel')}: ${t('pages.profile.confirmReceipt')}`,
          title: `${t('common.cancel')}: ${t('pages.profile.confirmReceipt')}`,
        }}
        className="profile-mobile-safe-modal order-tracking-page__receiptConfirmModal"
        closeLabel={t('common.close', { defaultValue: 'Close' })}
        onOk={confirmReceipt}
        onCancel={() => { if (!confirmingReceipt) setReceiptConfirmOpen(false); }}
      />
    </div>
  );
};

export default OrderTracking;
