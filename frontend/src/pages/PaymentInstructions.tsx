import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { createApiAbortController, orderApi, paymentApi } from '../api';
import { useLanguage } from '../i18n';
import { usePageTitle } from '../hooks/usePageTitle';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import type { OrderCustomer, PaymentChannel, PaymentCustomer } from '../types';
import { dispatchDomEvent } from '../utils/domEvents';
import { loadGuestSupportContext, normalizeGuestSupportContext, saveGuestSupportContext } from '../utils/guestSupportContext';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import { getLocalStorageItem } from '../utils/safeStorage';
import ShopBreadcrumb from '../components/ShopBreadcrumb';
import { getPaymentRecoveryState, navigateToCommercialPaymentUrl } from '../utils/paymentRecovery';
import { PaymentInstructionsPanels } from './paymentInstructionsPanels';
import { PaymentInstructionsStickyBars } from './paymentInstructionsStickyBars';
import './PaymentInstructions.css';

const PAYMENT_STATUS_POLL_MS = 12000;

const cleanParam = (value: string | null, maxLength = 120) =>
  Array.from(String(value || ''), (char) => {
    const code = char.charCodeAt(0);
    return code <= 31 || code === 127 ? ' ' : char;
  }).join('').trim().slice(0, maxLength);

const normalizeCurrencyCode = (value?: string | null) => {
  const currency = String(value || '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : 'MXN';
};

const currencyLocale = (currency: string, language: string) => {
  if (currency === 'CNY') return 'zh-CN';
  if (currency === 'MXN') return 'es-MX';
  return language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US';
};

const formatPaymentAmount = (amount: number, currency: string, language: string) => {
  const normalizedCurrency = normalizeCurrencyCode(currency);
  try {
    return new Intl.NumberFormat(currencyLocale(normalizedCurrency, language), {
      style: 'currency',
      currency: normalizedCurrency,
    }).format(amount);
  } catch (error) {
    reportNonBlockingError('PaymentInstructions.formatPaymentAmount', error);
    return new Intl.NumberFormat(currencyLocale('MXN', language), {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  }
};

const normalizePaymentStatus = (value?: string | null) => String(value || '').trim().toUpperCase();

const PaymentInstructions: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { orderNo = '' } = useParams();
  const [searchParams] = useSearchParams();
  const { t, language } = useLanguage();
  usePageTitle(t('pages.paymentInstructions.title'));
  useDocumentMeta({
    title: t('pages.paymentInstructions.title'),
    description: t('common.siteDescription'),
    path: location.pathname,
    type: 'website',
    noIndex: true,
    siteName: t('common.siteTitle'),
  });
  const [order, setOrder] = useState<OrderCustomer | null>(null);
  const [payment, setPayment] = useState<PaymentCustomer | null>(null);
  const [paymentChannels, setPaymentChannels] = useState<PaymentChannel[]>([]);
  const [verifying, setVerifying] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);
  const verifyRequestSeqRef = useRef(0);
  const refreshRequestSeqRef = useRef(0);
  const mountedRef = useRef(true);
  const channelAbortRef = useRef<AbortController | null>(null);
  const verifyAbortRef = useRef<AbortController | null>(null);
  const refreshAbortRef = useRef<AbortController | null>(null);
  const normalizedOrderNo = cleanParam(orderNo, 80);
  const searchQuery = searchParams.toString();
  const guestEmailFromQuery = searchParams.get('guestEmail') || searchParams.get('email') || '';
  const queryGuestContext = useMemo(
    () => normalizeGuestSupportContext({
      orderNo: normalizedOrderNo,
      email: guestEmailFromQuery,
    }),
    [normalizedOrderNo, guestEmailFromQuery],
  );
  const storedGuestContext = useMemo(() => {
    if (queryGuestContext) return queryGuestContext;
    const context = loadGuestSupportContext();
    if (!context || !normalizedOrderNo) return null;
    return context.orderNo.toUpperCase() === normalizedOrderNo.toUpperCase() ? context : null;
  }, [normalizedOrderNo, queryGuestContext]);
  const [manualGuestEmail, setManualGuestEmail] = useState('');
  const [guestEmailInput, setGuestEmailInput] = useState('');
  const guestEmail = storedGuestContext?.email || manualGuestEmail;
  const isAuthenticated = Boolean(getLocalStorageItem('token'));
  const canVerify = Boolean(normalizedOrderNo && (guestEmail || isAuthenticated));
  const normalizeGuestEmailInput = (value: unknown) => cleanParam(String(value || '').toLowerCase(), 120);
  const applyGuestEmailForVerify = () => {
    const email = normalizeGuestEmailInput(guestEmailInput);
    if (!email || !email.includes('@') || email.startsWith('@') || email.endsWith('@')) {
      announceAccessibleMessage(t('pages.paymentInstructions.guestEmailInvalid'), 'warning');
      return;
    }
    if (normalizedOrderNo) {
      saveGuestSupportContext({ orderNo: normalizedOrderNo, email });
    }
    setManualGuestEmail(email);
    setGuestEmailInput(email);
    setVerifyError('');
    setReloadToken((value) => value + 1);
  };
  useEffect(() => {
    if (guestEmail && !guestEmailInput) {
      setGuestEmailInput(guestEmail);
    }
  }, [guestEmail, guestEmailInput]);

  const dateLocale = language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US';

  useEffect(() => () => {
    mountedRef.current = false;
    channelAbortRef.current?.abort();
    verifyAbortRef.current?.abort();
    refreshRequestSeqRef.current += 1;
    refreshAbortRef.current?.abort();
  }, []);

  const openTrackOrder = () => {
    if (normalizedOrderNo) {
      if (guestEmail) {
        saveGuestSupportContext({ orderNo: normalizedOrderNo, email: guestEmail });
      }
      navigate(`/track-order?orderNo=${encodeURIComponent(normalizedOrderNo)}`);
      return;
    }
    navigate('/track-order');
  };

  const openSupport = () => {
    if (normalizedOrderNo && guestEmail) {
      saveGuestSupportContext({ orderNo: normalizedOrderNo, email: guestEmail });
      dispatchDomEvent('shop:open-support', { orderNo: normalizedOrderNo, email: guestEmail });
      return;
    }
    dispatchDomEvent('shop:open-support');
  };

  const openOrders = () => {
    if (isAuthenticated) {
      navigate('/profile?tab=orders');
      return;
    }
    openTrackOrder();
  };

  useEffect(() => {
    if (!searchQuery) return;
    const sanitized = new URLSearchParams(searchQuery);
    const hadGuestEmail = sanitized.has('guestEmail') || sanitized.has('email');
    if (!hadGuestEmail) return;
    const nextGuestContext = normalizeGuestSupportContext({
      orderNo: normalizedOrderNo,
      email: sanitized.get('guestEmail') || sanitized.get('email'),
    });
    if (nextGuestContext) {
      saveGuestSupportContext(nextGuestContext);
    }
    sanitized.delete('guestEmail');
    sanitized.delete('email');
    const nextQuery = sanitized.toString();
    navigate(`${location.pathname}${nextQuery ? `?${nextQuery}` : ''}`, { replace: true });
  }, [location.pathname, navigate, normalizedOrderNo, searchQuery]);

  useEffect(() => {
    const abortController = createApiAbortController();
    channelAbortRef.current?.abort();
    channelAbortRef.current = abortController;
    let disposed = false;
    paymentApi.getChannels({ signal: abortController.signal })
      .then((response) => {
        if (!disposed) setPaymentChannels(response.data || []);
      })
      .catch((error) => {
        if (abortController.signal.aborted) return;
        reportNonBlockingError('PaymentInstructions.loadChannels', error);
      });
    return () => {
      disposed = true;
      abortController.abort();
      if (channelAbortRef.current === abortController) channelAbortRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!normalizedOrderNo || (!guestEmail && !isAuthenticated)) {
      setOrder(null);
      setPayment(null);
      setVerifyError('');
      setVerifying(false);
      return;
    }
    let disposed = false;
    const abortController = createApiAbortController();
    verifyAbortRef.current?.abort();
    verifyAbortRef.current = abortController;
    const requestSeq = verifyRequestSeqRef.current + 1;
    verifyRequestSeqRef.current = requestSeq;
    const verifyPaymentDetails = async () => {
      setVerifying(true);
      setVerifyError('');
      try {
        let nextOrder: OrderCustomer | null = null;
        if (guestEmail) {
          const response = await orderApi.track(normalizedOrderNo, guestEmail, { signal: abortController.signal });
          nextOrder = response.data.order;
        } else {
          const response = await orderApi.getMine();
          nextOrder = (response.data || []).find((item) => String(item.orderNo || '').toUpperCase() === normalizedOrderNo.toUpperCase()) || null;
          if (!nextOrder) {
            throw new Error('Order not found');
          }
        }
        if (disposed || verifyRequestSeqRef.current !== requestSeq) return;
        setOrder(nextOrder);
        if (!nextOrder?.id) {
          setPayment(null);
          return;
        }
        if (disposed || verifyRequestSeqRef.current !== requestSeq) return;
        let nextPayment: PaymentCustomer | null = null;
        try {
          const paymentResponse = await paymentApi.getLatestByOrder(nextOrder.id, guestEmail || undefined, nextOrder.orderNo || normalizedOrderNo, { signal: abortController.signal });
          nextPayment = paymentResponse.data;
        } catch (error) {
          const responseStatus = Number((error as { response?: { status?: number } })?.response?.status);
          const paymentMethod = String(nextOrder.paymentMethod || '').trim();
          const canCreatePendingPayment = responseStatus === 404
            && nextOrder.status === 'PENDING_PAYMENT'
            && Boolean(paymentMethod);
          if (canCreatePendingPayment) {
            try {
              const createdPayment = await paymentApi.create(
                nextOrder.id,
                paymentMethod,
                guestEmail || undefined,
                nextOrder.orderNo || normalizedOrderNo,
                { signal: abortController.signal },
              );
              nextPayment = createdPayment.data;
            } catch (createError) {
              reportNonBlockingError('PaymentInstructions.createPendingPayment', createError);
            }
          } else {
            reportNonBlockingError('PaymentInstructions.loadLatestPayment', error);
          }
        }
        if (!disposed && verifyRequestSeqRef.current === requestSeq) setPayment(nextPayment);
      } catch (error) {
        if (abortController.signal.aborted) return;
        reportNonBlockingError('PaymentInstructions.verifyPaymentDetails', error);
        if (disposed || verifyRequestSeqRef.current !== requestSeq) return;
        setOrder(null);
        setPayment(null);
        setVerifyError(t('pages.paymentInstructions.verifyFailed'));
      } finally {
        if (!disposed && verifyRequestSeqRef.current === requestSeq) setVerifying(false);
      }
    };
    void verifyPaymentDetails();
    return () => {
      disposed = true;
      abortController.abort();
      refreshRequestSeqRef.current += 1;
      refreshAbortRef.current?.abort();
      if (verifyAbortRef.current === abortController) verifyAbortRef.current = null;
    };
  }, [guestEmail, isAuthenticated, normalizedOrderNo, reloadToken, t]);

  const refreshPaymentStatus = useCallback(async () => {
    if (!order?.id) {
      setReloadToken((value) => value + 1);
      return;
    }
    refreshAbortRef.current?.abort();
    const abortController = createApiAbortController();
    refreshAbortRef.current = abortController;
    const requestSeq = refreshRequestSeqRef.current + 1;
    refreshRequestSeqRef.current = requestSeq;
    const isCurrentRequest = () => mountedRef.current
      && refreshAbortRef.current === abortController
      && refreshRequestSeqRef.current === requestSeq
      && !abortController.signal.aborted;
    setRefreshing(true);
    try {
      if (payment?.id) {
        const response = await paymentApi.sync(payment.id, guestEmail || undefined, order.orderNo || normalizedOrderNo, { signal: abortController.signal });
        if (!isCurrentRequest()) return;
        setPayment(response.data);
        if (normalizePaymentStatus(response.data?.status) === 'PAID') {
          announceAccessibleMessage(t('pages.paymentInstructions.paidTitle'), 'success');
        }
      } else {
        const paymentResponse = await paymentApi.getLatestByOrder(order.id, guestEmail || undefined, order.orderNo || normalizedOrderNo, { signal: abortController.signal });
        if (!isCurrentRequest()) return;
        setPayment(paymentResponse.data);
      }
      if (!isCurrentRequest()) return;
      setVerifyError('');
    } catch (error) {
      if (!isCurrentRequest()) return;
      reportNonBlockingError('PaymentInstructions.refreshPaymentStatus', error);
      announceAccessibleMessage(t('pages.paymentInstructions.verifyFailed'), 'warning');
    } finally {
      if (isCurrentRequest()) setRefreshing(false);
      if (refreshAbortRef.current === abortController) refreshAbortRef.current = null;
    }
  }, [guestEmail, normalizedOrderNo, order, payment?.id, t]);

  const channel = payment?.channel || order?.paymentMethod || t('pages.paymentInstructions.manualChannel');
  const normalizedChannel = String(payment?.channel || order?.paymentMethod || '').trim().toUpperCase();
  const channelCurrency = paymentChannels.find((item) => item.code === normalizedChannel)?.currency;
  const currency = normalizeCurrencyCode(payment?.currency || order?.currency || channelCurrency);
  const verifiedAmount = Number(payment?.amount ?? order?.totalAmount);
  const amountText = order && Number.isFinite(verifiedAmount) ? formatPaymentAmount(verifiedAmount, currency, language) : '-';
  const expiresAt = payment?.expiresAt || '';
  const paymentStatus = normalizePaymentStatus(payment?.status || (order?.status === 'PENDING_PAYMENT' ? 'PENDING' : order?.status));
  const recovery = getPaymentRecoveryState(payment);
  const orderStatusCode = String(order?.status || '').trim().toUpperCase();
  const isRefunded = paymentStatus === 'REFUNDED' || orderStatusCode === 'REFUNDED' || orderStatusCode === 'RETURNED';
  const isRefunding = paymentStatus === 'REFUNDING' || orderStatusCode === 'RETURN_REFUNDING';
  const isReconcileRequired = paymentStatus === 'RECONCILE_REQUIRED';
  const isFailed = paymentStatus === 'FAILED';
  const isExpiredOrFailed = recovery.isExpired || isFailed;
  const fulfilledOrderStatuses = new Set(['PENDING_SHIPMENT', 'SHIPPED', 'COMPLETED', 'RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURN_SHIPPED']);
  const isPaid = !isRefunded && !isRefunding && !isReconcileRequired && !isFailed && (
    recovery.isPaid
    || paymentStatus === 'PAID'
    || fulfilledOrderStatuses.has(orderStatusCode)
  );
  const paymentContextLabel = `${t('pages.paymentInstructions.orderNo')}: ${normalizedOrderNo || '-'} · ${t('pages.paymentInstructions.amount')}: ${amountText}`;
  const trackOrderActionLabel = `${t('nav.trackOrder')}: ${paymentContextLabel}`;
  const supportActionLabel = `${t('pages.profile.contactSupport')}: ${paymentContextLabel}`;
  const openPaymentActionLabel = `${t('pages.paymentInstructions.openPayment')}: ${paymentContextLabel}`;
  const refreshStatusActionLabel = `${t('pages.paymentInstructions.refreshStatus')}: ${paymentContextLabel}`;
  const retryVerifyActionLabel = `${t('pages.paymentInstructions.retryVerify')}: ${paymentContextLabel}`;
  const paymentSteps = [
    t('pages.paymentInstructions.stepOne'),
    t('pages.paymentInstructions.stepTwo'),
    t('pages.paymentInstructions.stepThree'),
  ];
  const expiresText = useMemo(() => {
    if (!expiresAt) return t('pages.paymentInstructions.expiryFallback');
    const parsed = new Date(expiresAt);
    if (Number.isNaN(parsed.getTime())) return expiresAt;
    return parsed.toLocaleString(dateLocale);
  }, [dateLocale, expiresAt, t]);

  useEffect(() => {
    if (!canVerify || !order?.id || isPaid || isRefunded || isRefunding || isReconcileRequired || isFailed || recovery.isExpired || verifying) return;
    if (process.env.NODE_ENV === 'test') return;
    const timer = window.setInterval(() => {
      void refreshPaymentStatus();
    }, PAYMENT_STATUS_POLL_MS);
    return () => window.clearInterval(timer);
  }, [canVerify, isFailed, isPaid, isRefunded, isRefunding, isReconcileRequired, order?.id, recovery.isExpired, refreshPaymentStatus, verifying]);

  const refundedAtLabel = payment?.refundedAt
    ? new Date(payment.refundedAt).toLocaleString(dateLocale)
    : '';
  const statusTone = isRefunded
    ? 'success'
    : isRefunding
      ? 'warning'
      : isReconcileRequired
        ? 'warning'
        : isPaid
          ? 'success'
          : isExpiredOrFailed
            ? 'error'
            : recovery.isExpiringSoon
              ? 'warning'
              : 'pending';
  const statusTitle = isRefunded
    ? t('pages.profile.paymentRefundedTitle')
    : isRefunding
      ? t('pages.profile.paymentRefundingTitle')
      : isReconcileRequired
        ? t('pages.checkout.paymentRecoveryReconcileRequired')
        : isPaid
          ? t('pages.paymentInstructions.paidTitle')
          : isFailed
            ? t('pages.paymentInstructions.failedTitle')
            : recovery.isExpired
              ? t('pages.paymentInstructions.expiredTitle')
              : recovery.isExpiringSoon
                ? t('pages.paymentInstructions.expiringSoonTitle')
                : t('pages.paymentInstructions.pendingTitle');
  const statusText = isRefunded
    ? (refundedAtLabel
      ? t('pages.profile.paymentRefundedText', { date: refundedAtLabel })
      : t('pages.profile.paymentRefundedNext'))
    : isRefunding
      ? t('pages.profile.paymentRefundingText')
      : isReconcileRequired
        ? t('pages.checkout.paymentRecoveryNextReconcileRequired')
        : isPaid
          ? t('pages.paymentInstructions.paidText')
          : isFailed
            ? t('pages.paymentInstructions.failedText')
            : recovery.isExpired
              ? t('pages.paymentInstructions.expiredText')
              : recovery.isExpiringSoon && recovery.minutesLeft != null
                ? t('pages.paymentInstructions.expiringSoonText', { minutes: recovery.minutesLeft })
                : t('pages.paymentInstructions.pendingText');
  const statusTagColor = isRefunded
    ? 'purple'
    : isRefunding
      ? 'magenta'
      : isReconcileRequired
        ? 'magenta'
        : isPaid
          ? 'green'
          : isExpiredOrFailed
            ? 'red'
            : recovery.isExpiringSoon
              ? 'orange'
              : 'gold';

  const openContinueShopping = () => {
    navigate('/products');
  };

  const openPaymentUrl = () => {
    if (isReconcileRequired) {
      announceAccessibleMessage(t('pages.profile.paymentReturnReconcileRequired'), 'warning');
      return;
    }
    if (!payment?.paymentUrl) {
      announceAccessibleMessage(t('pages.paymentInstructions.verifyFailed'), 'info');
      return;
    }
    if (!navigateToCommercialPaymentUrl(payment.paymentUrl)) {
      announceAccessibleMessage(t('pages.paymentInstructions.verifyFailed'), 'error');
    }
  };

  return (
    <main className="payment-instructions-page">
      <ShopBreadcrumb
        ariaLabel={t('pages.paymentInstructions.title')}
        items={[
          { key: 'home', label: t('nav.ariaHome'), path: '/' },
          { key: 'orders', label: t('pages.paymentInstructions.backToOrders'), path: isAuthenticated ? '/profile?tab=orders' : '/track-order' },
          { key: 'payment', label: t('pages.paymentInstructions.title') },
        ]}
      />
      <PaymentInstructionsPanels
        amountText={amountText}
        applyGuestEmailForVerify={applyGuestEmailForVerify}
        canVerify={canVerify}
        channel={channel}
        expiresText={expiresText}
        guestEmail={guestEmail}
        guestEmailInput={guestEmailInput}
        isAuthenticated={isAuthenticated}
        isExpiredOrFailed={isExpiredOrFailed}
        isFailed={isFailed}
        isPaid={isPaid}
        isReconcileRequired={isReconcileRequired}
        isRefunded={isRefunded}
        isRefunding={isRefunding}
        navigate={navigate}
        normalizeGuestEmailInput={normalizeGuestEmailInput}
        normalizedOrderNo={normalizedOrderNo}
        openOrders={openOrders}
        openPaymentActionLabel={openPaymentActionLabel}
        openPaymentUrl={openPaymentUrl}
        openSupport={openSupport}
        openTrackOrder={openTrackOrder}
        payment={payment}
        paymentContextLabel={paymentContextLabel}
        paymentStatus={paymentStatus}
        paymentSteps={paymentSteps}
        recoveryIsExpired={Boolean(recovery.isExpired)}
        refreshStatusActionLabel={refreshStatusActionLabel}
        refreshing={refreshing}
        refreshPaymentStatus={refreshPaymentStatus}
        retryVerifyActionLabel={retryVerifyActionLabel}
        setGuestEmailInput={setGuestEmailInput}
        setReloadToken={setReloadToken}
        statusTagColor={statusTagColor}
        statusText={statusText}
        statusTitle={statusTitle}
        statusTone={statusTone}
        supportActionLabel={supportActionLabel}
        t={t}
        trackOrderActionLabel={trackOrderActionLabel}
        verifying={verifying}
        verifyError={verifyError}
      />
      <PaymentInstructionsStickyBars
        amountText={amountText}
        canVerify={canVerify}
        channel={channel}
        isExpiredOrFailed={isExpiredOrFailed}
        isFailed={isFailed}
        isPaid={isPaid}
        isReconcileRequired={isReconcileRequired}
        isRefunded={isRefunded}
        isRefunding={isRefunding}
        navigate={navigate}
        openContinueShopping={openContinueShopping}
        openPaymentActionLabel={openPaymentActionLabel}
        openPaymentUrl={openPaymentUrl}
        openSupport={openSupport}
        openTrackOrder={openTrackOrder}
        payment={payment}
        paymentContextLabel={paymentContextLabel}
        recoveryIsExpired={Boolean(recovery.isExpired)}
        refreshStatusActionLabel={refreshStatusActionLabel}
        refreshing={refreshing}
        refreshPaymentStatus={refreshPaymentStatus}
        statusTitle={statusTitle}
        supportActionLabel={supportActionLabel}
        t={t}
        trackOrderActionLabel={trackOrderActionLabel}
        verifying={verifying}
      />
    </main>

  );
};

export default PaymentInstructions;
