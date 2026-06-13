import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Descriptions, Space, Spin, Tag, Typography } from 'antd';
import { CreditCardOutlined, CustomerServiceOutlined, FileSearchOutlined, LockOutlined } from '@ant-design/icons';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { orderApi, paymentApi } from '../api';
import { useLanguage } from '../i18n';
import type { OrderCustomer, PaymentCustomer } from '../types';
import { markets } from '../utils/market';
import { dispatchDomEvent } from '../utils/domEvents';
import { loadGuestSupportContext, normalizeGuestSupportContext, saveGuestSupportContext } from '../utils/guestSupportContext';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import { getLocalStorageItem } from '../utils/safeStorage';
import './PaymentInstructions.css';

const { Text, Title } = Typography;

const cleanParam = (value: string | null, maxLength = 120) =>
  Array.from(String(value || ''), (char) => {
    const code = char.charCodeAt(0);
    return code <= 31 || code === 127 ? ' ' : char;
  }).join('').trim().slice(0, maxLength);

const formatPaymentAmount = (amount: number, currency: keyof typeof markets) => {
  const market = markets[currency] || markets.MXN;
  return new Intl.NumberFormat(market.locale, {
    style: 'currency',
    currency: market.currency,
  }).format(amount);
};

const PaymentInstructions: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { orderNo = '' } = useParams();
  const [searchParams] = useSearchParams();
  const { t, language } = useLanguage();
  const [order, setOrder] = useState<OrderCustomer | null>(null);
  const [payment, setPayment] = useState<PaymentCustomer | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const normalizedOrderNo = cleanParam(orderNo, 80);
  const searchQuery = searchParams.toString();
  const queryGuestContext = useMemo(
    () => normalizeGuestSupportContext({
      orderNo: normalizedOrderNo,
      email: searchParams.get('guestEmail') || searchParams.get('email'),
    }),
    [normalizedOrderNo, searchQuery, searchParams],
  );
  const storedGuestContext = useMemo(() => {
    if (queryGuestContext) return queryGuestContext;
    const context = loadGuestSupportContext();
    if (!context || !normalizedOrderNo) return null;
    return context.orderNo.toUpperCase() === normalizedOrderNo.toUpperCase() ? context : null;
  }, [normalizedOrderNo, queryGuestContext]);
  const guestEmail = storedGuestContext?.email || '';
  const isAuthenticated = Boolean(getLocalStorageItem('token'));
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
    if (!normalizedOrderNo || (!guestEmail && !isAuthenticated)) {
      setOrder(null);
      setPayment(null);
      setVerifyError('');
      return;
    }
    let disposed = false;
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
        if (disposed) return;
        setOrder(nextOrder);
        if (!nextOrder?.id) {
          setPayment(null);
          return;
        }
        if (disposed) return;
        try {
          const paymentResponse = await paymentApi.getLatestByOrder(nextOrder.id, guestEmail || undefined, nextOrder.orderNo || normalizedOrderNo);
          if (!disposed) setPayment(paymentResponse.data);
        } catch (error) {
          reportNonBlockingError('PaymentInstructions.loadLatestPayment', error);
          if (!disposed) setPayment(null);
        }
      } catch (error) {
        reportNonBlockingError('PaymentInstructions.verifyPaymentDetails', error);
        if (disposed) return;
        setOrder(null);
        setPayment(null);
        setVerifyError(t('pages.paymentInstructions.verifyFailed'));
      } finally {
        if (!disposed) setVerifying(false);
      }
    };
    void verifyPaymentDetails();
    return () => {
      disposed = true;
    };
  }, [guestEmail, isAuthenticated, normalizedOrderNo, t]);

  const channel = payment?.channel || order?.paymentMethod || t('pages.paymentInstructions.manualChannel');
  const currency: keyof typeof markets = 'MXN';
  const verifiedAmount = Number(payment?.amount ?? order?.totalAmount);
  const amountText = order && Number.isFinite(verifiedAmount) ? formatPaymentAmount(verifiedAmount, currency) : '-';
  const expiresAt = payment?.expiresAt || '';
  const paymentContextLabel = `${t('pages.paymentInstructions.orderNo')}: ${normalizedOrderNo || '-'} · ${t('pages.paymentInstructions.amount')}: ${amountText}`;
  const trackOrderActionLabel = `${t('nav.trackOrder')}: ${paymentContextLabel}`;
  const supportActionLabel = `${t('pages.profile.contactSupport')}: ${paymentContextLabel}`;
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

  return (
    <main className="payment-instructions-page">
      <section className="payment-instructions-page__hero">
        <Text className="payment-instructions-page__eyebrow">{t('pages.payment.secureEyebrow')}</Text>
        <Title level={1}>{t('pages.paymentInstructions.title')}</Title>
        <Text className="payment-instructions-page__subtitle">{t('pages.paymentInstructions.subtitle')}</Text>
      </section>

      <div className="payment-instructions-page__grid">
        <Card className="payment-instructions-page__card">
          <Spin spinning={verifying}>
            <Space direction="vertical" size="middle" className="payment-instructions-page__stack">
            {verifyError ? (
              <Alert type="warning" showIcon message={verifyError} />
            ) : !guestEmail && !isAuthenticated ? (
              <Alert type="info" showIcon message={t('pages.paymentInstructions.verifyWithTrackOrder')} />
            ) : null}
            <div className="payment-instructions-page__status" aria-label={`${t('pages.paymentInstructions.pendingTitle')}: ${paymentContextLabel}`}>
              <CreditCardOutlined />
              <span>
                <Text strong>{t('pages.paymentInstructions.pendingTitle')}</Text>
                <Text type="secondary">{t('pages.paymentInstructions.pendingText')}</Text>
              </span>
              <Tag color="orange">{channel}</Tag>
            </div>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label={t('pages.paymentInstructions.orderNo')}>{normalizedOrderNo || '-'}</Descriptions.Item>
              <Descriptions.Item label={t('pages.paymentInstructions.amount')}>
                <span className="payment-instructions-page__amount commerce-money">{amountText}</span>
              </Descriptions.Item>
              <Descriptions.Item label={t('pages.paymentInstructions.channel')}>{channel}</Descriptions.Item>
              <Descriptions.Item label={t('pages.paymentInstructions.expiresAt')}>{expiresText}</Descriptions.Item>
            </Descriptions>
            <div className="payment-instructions-page__notice">
              <LockOutlined />
              <Text>{t('pages.paymentInstructions.notice')}</Text>
            </div>
            </Space>
          </Spin>
        </Card>

        <Card className="payment-instructions-page__card">
          <Space direction="vertical" size="middle" className="payment-instructions-page__stack">
            <Title level={3}>{t('pages.paymentInstructions.nextTitle')}</Title>
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
