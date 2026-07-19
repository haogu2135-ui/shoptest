import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Card, Descriptions, Space, Spin, Tag, Typography, message } from 'antd';
import { CreditCardOutlined, CustomerServiceOutlined, FileSearchOutlined, LockOutlined, ReloadOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { orderApi, paymentApi } from '../api';
import { useLanguage } from '../i18n';
import { usePageTitle } from '../hooks/usePageTitle';
import type { OrderCustomer, PaymentChannel, PaymentCustomer } from '../types';
import { dispatchDomEvent } from '../utils/domEvents';
import { loadGuestSupportContext, normalizeGuestSupportContext, saveGuestSupportContext } from '../utils/guestSupportContext';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import { getLocalStorageItem } from '../utils/safeStorage';
import { formatPaymentUrlLabel, getPaymentRecoveryState } from '../utils/paymentRecovery';
import { navigateToSafeUrl } from '../utils/safeUrl';
import ShopBreadcrumb from '../components/ShopBreadcrumb';
import './PaymentInstructions.css';

const { Text, Title } = Typography;

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
  const guestEmail = storedGuestContext?.email || '';
  const isAuthenticated = Boolean(getLocalStorageItem('token'));
  const canVerify = Boolean(normalizedOrderNo && (guestEmail || isAuthenticated));
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
          message.success(t('pages.paymentInstructions.paidTitle'));
        }
      } else {
        const paymentResponse = await paymentApi.getLatestByOrder(order.id, guestEmail || undefined, order.orderNo || normalizedOrderNo);
        setPayment(paymentResponse.data);
      }
      setVerifyError('');
    } catch (error) {
      reportNonBlockingError('PaymentInstructions.refreshPaymentStatus', error);
      message.warning(t('pages.paymentInstructions.verifyFailed'));
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
  const paidOrderStatuses = new Set(['PENDING_SHIPMENT', 'SHIPPED', 'COMPLETED', 'RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURN_SHIPPED', 'REFUNDED']);
  const isPaid = recovery.isPaid || paymentStatus === 'PAID' || paidOrderStatuses.has(String(order?.status || '').trim().toUpperCase());
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
    if (!canVerify || !order?.id || isPaid || recovery.isExpired || verifying) return;
    const timer = window.setInterval(() => {
      void refreshPaymentStatus();
    }, PAYMENT_STATUS_POLL_MS);
    return () => window.clearInterval(timer);
  }, [canVerify, isPaid, order?.id, recovery.isExpired, refreshPaymentStatus, verifying]);

  const statusTone = isPaid ? 'success' : recovery.isExpired ? 'error' : recovery.isExpiringSoon ? 'warning' : 'pending';
  const statusTitle = isPaid
    ? t('pages.paymentInstructions.paidTitle')
    : recovery.isExpired
      ? t('pages.paymentInstructions.expiredTitle')
      : recovery.isExpiringSoon
        ? t('pages.paymentInstructions.expiringSoonTitle')
        : t('pages.paymentInstructions.pendingTitle');
  const statusText = isPaid
    ? t('pages.paymentInstructions.paidText')
    : recovery.isExpired
      ? t('pages.paymentInstructions.expiredText')
      : recovery.isExpiringSoon && recovery.minutesLeft != null
        ? t('pages.paymentInstructions.expiringSoonText', { minutes: recovery.minutesLeft })
        : t('pages.paymentInstructions.pendingText');
  const statusTagColor = isPaid ? 'green' : recovery.isExpired ? 'red' : recovery.isExpiringSoon ? 'orange' : 'gold';

  const openPaymentUrl = () => {
    if (!payment?.paymentUrl) {
      message.info(t('pages.paymentInstructions.verifyFailed'));
      return;
    }
    if (!navigateToSafeUrl(payment.paymentUrl)) {
      message.error(t('pages.paymentInstructions.verifyFailed'));
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
        <Text className="payment-instructions-page__eyebrow">{t('pages.payment.secureEyebrow')}</Text>
        <Title level={1}>{t('pages.paymentInstructions.title')}</Title>
        <Text className="payment-instructions-page__subtitle">{t('pages.paymentInstructions.subtitle')}</Text>
      </section>

      {!normalizedOrderNo ? (
        <Alert
          className="payment-instructions-page__banner"
          type="warning"
          showIcon
          message={t('pages.paymentInstructions.missingOrder')}
          description={t('pages.paymentInstructions.missingOrderText')}
          action={(
            <Button size="small" type="primary" onClick={openTrackOrder}>
              {t('nav.trackOrder')}
            </Button>
          )}
        />
      ) : null}

      <div className="payment-instructions-page__grid">
        <Card className="payment-instructions-page__card">
          <div
            role="status"
            aria-live="polite"
            aria-busy={verifying}
            aria-label={verifying ? t('common.loading') : undefined}
          >
            <Spin spinning={verifying}>
              <Space direction="vertical" size="middle" className="payment-instructions-page__stack">
                {verifyError ? (
                  <Alert
                    type="error"
                    showIcon
                    message={verifyError}
                    action={(
                      <Button
                        size="small"
                        type="primary"
                        icon={<ReloadOutlined />}
                        loading={verifying}
                        aria-label={retryVerifyActionLabel}
                        title={retryVerifyActionLabel}
                        onClick={() => setReloadToken((value) => value + 1)}
                      >
                        {t('pages.paymentInstructions.retryVerify')}
                      </Button>
                    )}
                  />
                ) : !guestEmail && !isAuthenticated ? (
                  <Alert type="info" showIcon message={t('pages.paymentInstructions.verifyWithTrackOrder')} />
                ) : null}

                <div
                  className={`payment-instructions-page__status payment-instructions-page__status--${statusTone}`}
                  aria-label={`${statusTitle}: ${paymentContextLabel}`}
                >
                  {isPaid ? <SafetyCertificateOutlined /> : <CreditCardOutlined />}
                  <span>
                    <Text strong>{statusTitle}</Text>
                    <Text type="secondary">{statusText}</Text>
                  </span>
                  <Tag color={statusTagColor}>{channel}</Tag>
                </div>

                <Descriptions column={1} size="small" bordered>
                  <Descriptions.Item label={t('pages.paymentInstructions.orderNo')}>{normalizedOrderNo || '-'}</Descriptions.Item>
                  <Descriptions.Item label={t('pages.paymentInstructions.amount')}>
                    <span className="payment-instructions-page__amount commerce-money">{amountText}</span>
                  </Descriptions.Item>
                  <Descriptions.Item label={t('pages.paymentInstructions.channel')}>{channel}</Descriptions.Item>
                  <Descriptions.Item label={t('pages.paymentInstructions.statusLabel')}>
                    <Tag color={statusTagColor}>{paymentStatus || t('pages.paymentInstructions.pendingTitle')}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label={t('pages.paymentInstructions.expiresAt')}>{expiresText}</Descriptions.Item>
                  {payment?.paymentUrl ? (
                    <Descriptions.Item label={t('pages.paymentInstructions.paymentLink')}>
                      <span className="payment-instructions-page__paymentUrl">{formatPaymentUrlLabel(payment.paymentUrl)}</span>
                    </Descriptions.Item>
                  ) : null}
                </Descriptions>

                <div className="payment-instructions-page__notice">
                  <LockOutlined />
                  <Text>{t('pages.paymentInstructions.notice')}</Text>
                </div>

                <Space wrap className="payment-instructions-page__primaryActions">
                  {!isPaid && payment?.paymentUrl && !recovery.isExpired ? (
                    <Button
                      type="primary"
                      size="large"
                      icon={<CreditCardOutlined />}
                      aria-label={openPaymentActionLabel}
                      title={openPaymentActionLabel}
                      onClick={openPaymentUrl}
                    >
                      {t('pages.paymentInstructions.openPayment')}
                    </Button>
                  ) : null}
                  {canVerify ? (
                    <Button
                      icon={<ReloadOutlined />}
                      loading={refreshing || verifying}
                      aria-label={refreshStatusActionLabel}
                      title={refreshStatusActionLabel}
                      onClick={() => { void refreshPaymentStatus(); }}
                    >
                      {t('pages.paymentInstructions.refreshStatus')}
                    </Button>
                  ) : null}
                </Space>
              </Space>
            </Spin>
          </div>
        </Card>

        <Card className="payment-instructions-page__card">
          <Space direction="vertical" size="middle" className="payment-instructions-page__stack">
            <div>
              <Text className="payment-instructions-page__recoveryEyebrow">{t('pages.paymentInstructions.recoveryEyebrow')}</Text>
              <Title level={3}>{t('pages.paymentInstructions.nextTitle')}</Title>
            </div>
            <div className="payment-instructions-page__steps" role="list" aria-label={`${t('pages.paymentInstructions.nextTitle')}: ${paymentContextLabel}`}>
              {paymentSteps.map((step, index) => (
                <div className="payment-instructions-page__step" role="listitem" aria-label={`${index + 1}. ${step}`} key={step}>
                  <span className="payment-instructions-page__stepNumber" aria-hidden="true">{index + 1}</span>
                  <Text>{step}</Text>
                </div>
              ))}
            </div>
            <Space wrap className="payment-instructions-page__actions">
              <Button type="primary" icon={<FileSearchOutlined />} aria-label={trackOrderActionLabel} title={trackOrderActionLabel} onClick={openTrackOrder}>
                {t('nav.trackOrder')}
              </Button>
              <Button aria-label={`${t('pages.paymentInstructions.backToOrders')}: ${paymentContextLabel}`} title={t('pages.paymentInstructions.backToOrders')} onClick={openOrders}>
                {t('pages.paymentInstructions.backToOrders')}
              </Button>
              <Button icon={<CustomerServiceOutlined />} aria-label={supportActionLabel} title={supportActionLabel} onClick={openSupport}>
                {t('pages.profile.contactSupport')}
              </Button>
            </Space>
          </Space>
        </Card>
      </div>
    </main>
  );
};

export default PaymentInstructions;
