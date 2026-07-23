import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { ShopIcon, SI } from '../components/ShopIcon';
import ShopInput from '../components/ShopInput';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { orderApi, paymentApi } from '../api';
import { useLanguage } from '../i18n';
import { usePageTitle } from '../hooks/usePageTitle';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import type { OrderCustomer, PaymentChannel, PaymentCustomer } from '../types';
import { dispatchDomEvent } from '../utils/domEvents';
import { loadGuestSupportContext, normalizeGuestSupportContext, saveGuestSupportContext } from '../utils/guestSupportContext';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import { getLocalStorageItem } from '../utils/safeStorage';
import ShopBreadcrumb from '../components/ShopBreadcrumb';
import './PaymentInstructions.css';
import { formatPaymentUrlLabel, getPaymentRecoveryState, navigateToCommercialPaymentUrl } from '../utils/paymentRecovery';
import ShopButton from '../components/ShopButton';

import ShopTag from '../components/ShopTag';
import ShopAlert from '../components/ShopAlert';
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
    let disposed = false;
    paymentApi.getChannels()
      .then((response) => {
        if (!disposed) setPaymentChannels(response.data || []);
      })
      .catch((error) => {
        reportNonBlockingError('PaymentInstructions.loadChannels', error);
      });
    return () => {
      disposed = true;
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
    const requestSeq = verifyRequestSeqRef.current + 1;
    verifyRequestSeqRef.current = requestSeq;
    const verifyPaymentDetails = async () => {
      setVerifying(true);
      setVerifyError('');
      try {
        let nextOrder: OrderCustomer | null = null;
        if (guestEmail) {
          const response = await orderApi.track(normalizedOrderNo, guestEmail);
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
        try {
          const paymentResponse = await paymentApi.getLatestByOrder(nextOrder.id, guestEmail || undefined, nextOrder.orderNo || normalizedOrderNo);
          if (!disposed && verifyRequestSeqRef.current === requestSeq) setPayment(paymentResponse.data);
        } catch (error) {
          reportNonBlockingError('PaymentInstructions.loadLatestPayment', error);
          if (!disposed && verifyRequestSeqRef.current === requestSeq) setPayment(null);
        }
      } catch (error) {
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
    };
  }, [guestEmail, isAuthenticated, normalizedOrderNo, reloadToken, t]);

  const refreshPaymentStatus = useCallback(async () => {
    if (!order?.id) {
      setReloadToken((value) => value + 1);
      return;
    }
    setRefreshing(true);
    try {
      if (payment?.id) {
        const response = await paymentApi.sync(payment.id, guestEmail || undefined, order.orderNo || normalizedOrderNo);
        setPayment(response.data);
        if (normalizePaymentStatus(response.data?.status) === 'PAID') {
          announceAccessibleMessage(t('pages.paymentInstructions.paidTitle'), 'success');
        }
      } else {
        const paymentResponse = await paymentApi.getLatestByOrder(order.id, guestEmail || undefined, order.orderNo || normalizedOrderNo);
        setPayment(paymentResponse.data);
      }
      setVerifyError('');
    } catch (error) {
      reportNonBlockingError('PaymentInstructions.refreshPaymentStatus', error);
      announceAccessibleMessage(t('pages.paymentInstructions.verifyFailed'), 'warning');
    } finally {
      setRefreshing(false);
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

      <section className="payment-instructions-page__hero">
        <span className="payment-instructions-page__text payment-instructions-page__eyebrow">{t('pages.payment.secureEyebrow')}</span>
        <h1 className="payment-instructions-page__title">
          {isPaid
            ? t('pages.paymentInstructions.paidTitle')
            : isRefunded
              ? t('pages.profile.paymentRefundedTitle')
              : isReconcileRequired
                ? t('pages.checkout.paymentRecoveryReconcileRequired')
                : isFailed
                  ? t('pages.paymentInstructions.failedTitle')
                  : recovery.isExpired
                    ? t('pages.paymentInstructions.expiredTitle')
                    : t('pages.paymentInstructions.title')}
        </h1>
        <span className="payment-instructions-page__text payment-instructions-page__subtitle">
          {isPaid
            ? t('pages.paymentInstructions.paidText')
            : isRefunded
              ? t('pages.profile.paymentRefundedNext')
              : isReconcileRequired
                ? t('pages.checkout.paymentRecoveryNextReconcileRequired')
                : isFailed
                  ? t('pages.paymentInstructions.failedText')
                  : recovery.isExpired
                    ? t('pages.paymentInstructions.expiredText')
                    : t('pages.paymentInstructions.subtitle')}
        </span>
      </section>

      {!normalizedOrderNo ? (
        <ShopAlert
          className="payment-instructions-page__banner"
          type="warning"
          showIcon
          role="alert"
          aria-live="assertive"
          message={t('pages.paymentInstructions.missingOrder')}
          description={t('pages.paymentInstructions.missingOrderText')}
          action={(
            <ShopButton size="small" type="primary" onClick={openTrackOrder}>
              {t('nav.trackOrder')}
            </ShopButton>
          )}
        />
      ) : null}

      <div className="payment-instructions-page__grid">
        <section className="payment-instructions-page__card">
          <div
            className="payment-instructions-page__verifyPanel"
            role="status"
            aria-live="polite"
            aria-busy={verifying}
            aria-label={verifying ? t('common.loading') : undefined}
          >
            {verifying ? (
              <div className="payment-instructions-page__spinnerOverlay" role="status" aria-live="polite">
                <span className="payment-instructions-page__spinner" aria-hidden="true" />
              </div>
            ) : null}
            <div className="payment-instructions-page__stack">
                {verifyError ? (
                  <ShopAlert
                    type="error"
                    showIcon
                    role="alert"
                    aria-live="assertive"
                    message={verifyError}
                    action={(
                      <ShopButton
                        size="small"
                        type="primary"
                        icon={<ShopIcon path={SI.reload} />}
                        loading={verifying}
                        aria-label={retryVerifyActionLabel}
                        title={retryVerifyActionLabel}
                        onClick={() => setReloadToken((value) => value + 1)}
                      >
                        {t('pages.paymentInstructions.retryVerify')}
                      </ShopButton>
                    )}
                  />
                ) : !guestEmail && !isAuthenticated ? (
                  <div className="payment-instructions-page__guestEmailGate" data-payment-guest-email-gate="true">
                    <ShopAlert
                      type="info"
                      showIcon
                      message={t('pages.paymentInstructions.guestEmailRequiredTitle')}
                      description={t('pages.paymentInstructions.guestEmailRequiredText')}
                    />
                    <div className="payment-instructions-page__guestEmailForm">
                      <ShopInput
                        prefix={<ShopIcon path={SI.mail} />}
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        maxLength={120}
                        value={guestEmailInput}
                        onChange={(event) => setGuestEmailInput(normalizeGuestEmailInput(event.target.value))}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            applyGuestEmailForVerify();
                          }
                        }}
                        placeholder={t('pages.checkout.guestEmailPlaceholder')}
                        aria-label={t('pages.paymentInstructions.guestEmailLabel')}
                        title={t('pages.paymentInstructions.guestEmailLabel')}
                      />
                      <ShopButton
                        type="primary"
                        onClick={applyGuestEmailForVerify}
                        aria-label={t('pages.paymentInstructions.guestEmailSubmit')}
                        title={t('pages.paymentInstructions.guestEmailSubmit')}
                      >
                        {t('pages.paymentInstructions.guestEmailSubmit')}
                      </ShopButton>
                    </div>
                    <div className="payment-instructions-page__guestEmailRecovery" data-payment-guest-email-recovery="true">
                      <ShopButton type="link" onClick={openTrackOrder} aria-label={t('nav.trackOrder')} title={t('nav.trackOrder')}>
                        {t('pages.paymentInstructions.verifyWithTrackOrder')}
                      </ShopButton>
                      <ShopButton type="link" onClick={() => navigate('/products')} aria-label={t('pages.cart.browse')} title={t('pages.cart.browse')}>
                        {t('pages.cart.browse')}
                      </ShopButton>
                      <ShopButton type="link" onClick={() => navigate('/coupons')} aria-label={t('nav.coupons')} title={t('nav.coupons')}>
                        {t('nav.coupons')}
                      </ShopButton>
                      <ShopButton type="link" onClick={openSupport} aria-label={t('pages.profile.contactSupport')} title={t('pages.profile.contactSupport')}>
                        {t('pages.profile.contactSupport')}
                      </ShopButton>
                    </div>
                  </div>
                ) : null}

                <div
                  className={`payment-instructions-page__status payment-instructions-page__status--${statusTone}`}
                  aria-label={`${statusTitle}: ${paymentContextLabel}`}
                >
                  {(isPaid || isRefunded) ? <ShopIcon path={SI.safety} /> : <ShopIcon path={SI.creditCard} />}
                  <span>
                    <span className="payment-instructions-page__text payment-instructions-page__text--strong">{statusTitle}</span>
                    <span className="payment-instructions-page__text payment-instructions-page__text--secondary">{statusText}</span>
                  </span>
                  <ShopTag color={statusTagColor}>{channel}</ShopTag>
                </div>

                <dl className="payment-instructions-page__descList">
                  <div className="payment-instructions-page__descRow">
                    <dt className="payment-instructions-page__descLabel">{t('pages.paymentInstructions.orderNo')}</dt>
                    <dd className="payment-instructions-page__descValue">{normalizedOrderNo || '-'}</dd>
                  </div>
                  <div className="payment-instructions-page__descRow">
                    <dt className="payment-instructions-page__descLabel">{t('pages.paymentInstructions.amount')}</dt>
                    <dd className="payment-instructions-page__descValue">
                      <span className="payment-instructions-page__amount commerce-money">{amountText}</span>
                    </dd>
                  </div>
                  <div className="payment-instructions-page__descRow">
                    <dt className="payment-instructions-page__descLabel">{t('pages.paymentInstructions.channel')}</dt>
                    <dd className="payment-instructions-page__descValue">{channel}</dd>
                  </div>
                  <div className="payment-instructions-page__descRow">
                    <dt className="payment-instructions-page__descLabel">{t('pages.paymentInstructions.statusLabel')}</dt>
                    <dd className="payment-instructions-page__descValue">
                      <ShopTag color={statusTagColor}>{paymentStatus || t('pages.paymentInstructions.pendingTitle')}</ShopTag>
                    </dd>
                  </div>
                  <div className="payment-instructions-page__descRow">
                    <dt className="payment-instructions-page__descLabel">{t('pages.paymentInstructions.expiresAt')}</dt>
                    <dd className="payment-instructions-page__descValue">{expiresText}</dd>
                  </div>
                  {payment?.paymentUrl && !isReconcileRequired && !isExpiredOrFailed ? (
                    <div className="payment-instructions-page__descRow">
                      <dt className="payment-instructions-page__descLabel">{t('pages.paymentInstructions.paymentLink')}</dt>
                      <dd className="payment-instructions-page__descValue">
                        <span className="payment-instructions-page__paymentUrl">{formatPaymentUrlLabel(payment.paymentUrl)}</span>
                      </dd>
                    </div>
                  ) : null}
                </dl>

                <div className="payment-instructions-page__notice">
                  <ShopIcon path={SI.lock} />
                  <span className="payment-instructions-page__text">{t('pages.paymentInstructions.notice')}</span>
                </div>

                <div className="payment-instructions-page__primaryActions">
                  {!isPaid && !isRefunded && !isRefunding && !isReconcileRequired && !isFailed && payment?.paymentUrl && !recovery.isExpired ? (
                    <ShopButton
                      type="primary"
                      size="large"
                      icon={<ShopIcon path={SI.creditCard} />}
                      aria-label={openPaymentActionLabel}
                      title={openPaymentActionLabel}
                      onClick={openPaymentUrl}
                    >
                      {t('pages.paymentInstructions.openPayment')}
                    </ShopButton>
                  ) : null}
                  {canVerify ? (
                    <ShopButton
                      icon={<ShopIcon path={SI.reload} />}
                      loading={refreshing || verifying}
                      aria-label={refreshStatusActionLabel}
                      title={refreshStatusActionLabel}
                      onClick={() => { void refreshPaymentStatus(); }}
                    >
                      {t('pages.paymentInstructions.refreshStatus')}
                    </ShopButton>
                  ) : null}
                </div>
              </div>
          </div>
        </section>

        <section className="payment-instructions-page__card">
          <div className="payment-instructions-page__stack">
            <div>
              <span className="payment-instructions-page__text payment-instructions-page__recoveryEyebrow">{t('pages.paymentInstructions.recoveryEyebrow')}</span>
              <h3 className="payment-instructions-page__title">{t('pages.paymentInstructions.nextTitle')}</h3>
            </div>
            <div className="payment-instructions-page__steps" role="list" aria-label={`${t('pages.paymentInstructions.nextTitle')}: ${paymentContextLabel}`}>
              {paymentSteps.map((step, index) => (
                <div className="payment-instructions-page__step" role="listitem" aria-label={`${index + 1}. ${step}`} key={step}>
                  <span className="payment-instructions-page__stepNumber" aria-hidden="true">{index + 1}</span>
                  <span className="payment-instructions-page__text">{step}</span>
                </div>
              ))}
            </div>
            <div className="payment-instructions-page__actions">
              <ShopButton type="primary" icon={<ShopIcon path={SI.fileSearch} />} aria-label={trackOrderActionLabel} title={trackOrderActionLabel} onClick={openTrackOrder}>
                {t('nav.trackOrder')}
              </ShopButton>
              <ShopButton aria-label={`${t('pages.paymentInstructions.backToOrders')}: ${paymentContextLabel}`} title={t('pages.paymentInstructions.backToOrders')} onClick={openOrders}>
                {t('pages.paymentInstructions.backToOrders')}
              </ShopButton>
              <ShopButton icon={<ShopIcon path={SI.support} />} aria-label={supportActionLabel} title={supportActionLabel} onClick={openSupport}>
                {t('pages.profile.contactSupport')}
              </ShopButton>
            </div>
          </div>
        </section>
      </div>

      <div className="payment-instructions-page__trustBar" aria-label={t('pages.paymentInstructions.trustTitle')}>
        <div className="payment-instructions-page__trustItem">
          <ShopIcon path={SI.lock} aria-hidden="true" />
          <div>
            <span className="payment-instructions-page__text payment-instructions-page__text--strong">{t('pages.paymentInstructions.trustSecureTitle')}</span>
            <span className="payment-instructions-page__text payment-instructions-page__text--secondary">{t('pages.paymentInstructions.trustSecureText')}</span>
          </div>
        </div>
        <div className="payment-instructions-page__trustItem">
          <ShopIcon path={SI.fileSearch} aria-hidden="true" />
          <div>
            <span className="payment-instructions-page__text payment-instructions-page__text--strong">{t('pages.paymentInstructions.trustTrackTitle')}</span>
            <span className="payment-instructions-page__text payment-instructions-page__text--secondary">{t('pages.paymentInstructions.trustTrackText')}</span>
          </div>
        </div>
        <div className="payment-instructions-page__trustItem">
          <ShopIcon path={SI.support} aria-hidden="true" />
          <div>
            <span className="payment-instructions-page__text payment-instructions-page__text--strong">{t('pages.paymentInstructions.trustSupportTitle')}</span>
            <span className="payment-instructions-page__text payment-instructions-page__text--secondary">{t('pages.paymentInstructions.trustSupportText')}</span>
          </div>
        </div>
      </div>

      {!isPaid && !isRefunded && !isRefunding && !isReconcileRequired && !isFailed && payment?.paymentUrl && !recovery.isExpired ? (
        <div className="payment-instructions-page__stickyBar" role="region" aria-label={t('pages.paymentInstructions.stickyOpenPayment')}>
          <div className="payment-instructions-page__stickyMeta">
            <span className="payment-instructions-page__text payment-instructions-page__text--strong commerce-money">{amountText}</span>
            <span className="payment-instructions-page__text payment-instructions-page__text--secondary">{channel}</span>
          </div>
          <div className="payment-instructions-page__stickyActions">
            {canVerify ? (
              <ShopButton
                icon={<ShopIcon path={SI.reload} />}
                loading={refreshing || verifying}
                aria-label={refreshStatusActionLabel}
                title={refreshStatusActionLabel}
                onClick={() => { void refreshPaymentStatus(); }}
              >
                {t('pages.paymentInstructions.stickyRefresh')}
              </ShopButton>
            ) : null}
            <ShopButton
              type="primary"
              size="large"
              icon={<ShopIcon path={SI.creditCard} />}
              aria-label={openPaymentActionLabel}
              title={openPaymentActionLabel}
              onClick={openPaymentUrl}
            >
              {t('pages.paymentInstructions.stickyOpenPayment')}
            </ShopButton>
          </div>
        </div>
      ) : null}

      {isExpiredOrFailed && !isPaid && !isRefunded && !isRefunding && !isReconcileRequired ? (
        <div
          className="payment-instructions-page__stickyBar payment-instructions-page__stickyBar--recovery"
          role="region"
          aria-label={t('pages.paymentInstructions.stickyRecovery')}
          data-payment-recovery-sticky="true"
        >
          <div className="payment-instructions-page__stickyMeta">
            <span className="payment-instructions-page__text payment-instructions-page__text--strong">{statusTitle}</span>
            <span className="payment-instructions-page__text payment-instructions-page__text--secondary">{paymentContextLabel}</span>
          </div>
          <div className="payment-instructions-page__stickyActions" data-payment-recovery-actions="true">
            <ShopButton
              icon={<ShopIcon path={SI.shopping} />}
              aria-label={t('pages.paymentInstructions.stickyContinueShopping')}
              title={t('pages.paymentInstructions.stickyContinueShopping')}
              onClick={openContinueShopping}
            >
              {t('pages.paymentInstructions.stickyContinueShopping')}
            </ShopButton>
            <ShopButton
              icon={<ShopIcon path={SI.gift} />}
              aria-label={t('nav.coupons')}
              title={t('nav.coupons')}
              onClick={() => navigate('/coupons')}
            >
              {t('nav.coupons')}
            </ShopButton>
            <ShopButton
              icon={<ShopIcon path={SI.support} />}
              aria-label={supportActionLabel}
              title={supportActionLabel}
              onClick={openSupport}
            >
              {t('pages.profile.contactSupport')}
            </ShopButton>
            <ShopButton
              type="primary"
              size="large"
              icon={<ShopIcon path={SI.fileSearch} />}
              aria-label={trackOrderActionLabel}
              title={trackOrderActionLabel}
              onClick={openTrackOrder}
            >
              {t('pages.paymentInstructions.stickyTrackOrder')}
            </ShopButton>
          </div>
        </div>
      ) : null}

      {isPaid ? (
        <div
          className="payment-instructions-page__stickyBar payment-instructions-page__stickyBar--paid"
          role="region"
          aria-label={t('pages.paymentInstructions.stickyTrackOrder')}
          data-payment-paid-sticky="true"
        >
          <div className="payment-instructions-page__stickyMeta">
            <span className="payment-instructions-page__text payment-instructions-page__text--strong">{t('pages.paymentInstructions.paidTitle')}</span>
            <span className="payment-instructions-page__text payment-instructions-page__text--secondary">{paymentContextLabel}</span>
          </div>
          <div className="payment-instructions-page__stickyActions" data-payment-paid-actions="true">
            <ShopButton
              icon={<ShopIcon path={SI.shopping} />}
              aria-label={t('pages.paymentInstructions.stickyContinueShopping')}
              title={t('pages.paymentInstructions.stickyContinueShopping')}
              onClick={openContinueShopping}
            >
              {t('pages.paymentInstructions.stickyContinueShopping')}
            </ShopButton>
            <ShopButton
              icon={<ShopIcon path={SI.gift} />}
              aria-label={t('nav.coupons')}
              title={t('nav.coupons')}
              onClick={() => navigate('/coupons')}
            >
              {t('nav.coupons')}
            </ShopButton>
            <ShopButton
              icon={<ShopIcon path={SI.fileSearch} />}
              aria-label={t('pages.orderTracking.emptyProfileOrders')}
              title={t('pages.orderTracking.emptyProfileOrders')}
              onClick={() => navigate('/profile?tab=orders')}
            >
              {t('pages.orderTracking.emptyProfileOrders')}
            </ShopButton>
            <ShopButton
              type="primary"
              size="large"
              icon={<ShopIcon path={SI.fileSearch} />}
              aria-label={trackOrderActionLabel}
              title={trackOrderActionLabel}
              onClick={openTrackOrder}
            >
              {t('pages.paymentInstructions.stickyTrackOrder')}
            </ShopButton>
          </div>
        </div>
      ) : null}
    </main>
  );
};

export default PaymentInstructions;
