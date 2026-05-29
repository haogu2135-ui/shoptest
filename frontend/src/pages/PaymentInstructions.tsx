import React, { useMemo } from 'react';
import { Button, Card, Descriptions, Space, Tag, Typography } from 'antd';
import { CreditCardOutlined, CustomerServiceOutlined, FileSearchOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../i18n';
import { isCurrencyCode, markets } from '../utils/market';
import { dispatchDomEvent } from '../utils/domEvents';
import { saveGuestSupportContext } from '../utils/guestSupportContext';
import './PaymentInstructions.css';

const { Text, Title } = Typography;

const cleanParam = (value: string | null, maxLength = 120) =>
  Array.from(String(value || ''), (char) => {
    const code = char.charCodeAt(0);
    return code <= 31 || code === 127 ? ' ' : char;
  }).join('').trim().slice(0, maxLength);

const normalizeAmount = (value: string | null) => {
  const cleaned = cleanParam(value, 40).replace(/[^0-9.,-]/g, '').replace(/,/g, '');
  const amount = Number(cleaned);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
};

const formatPaymentAmount = (amount: number, currency: keyof typeof markets) => {
  const market = markets[currency] || markets.MXN;
  return new Intl.NumberFormat(market.locale, {
    style: 'currency',
    currency: market.currency,
  }).format(amount);
};

const PaymentInstructions: React.FC = () => {
  const navigate = useNavigate();
  const { orderNo = '' } = useParams();
  const [searchParams] = useSearchParams();
  const { t } = useLanguage();
  const normalizedOrderNo = cleanParam(orderNo, 80);
  const guestEmail = cleanParam(searchParams.get('guestEmail') || searchParams.get('email'), 120).toLowerCase();
  const openTrackOrder = () => {
    if (normalizedOrderNo && guestEmail) {
      navigate(`/track-order?orderNo=${encodeURIComponent(normalizedOrderNo)}&email=${encodeURIComponent(guestEmail)}`);
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
  const channel = cleanParam(searchParams.get('channel'), 40) || t('pages.paymentInstructions.manualChannel');
  const currencyParam = cleanParam(searchParams.get('currency'), 12).toUpperCase();
  const currency = isCurrencyCode(currencyParam) ? currencyParam : 'MXN';
  const amount = normalizeAmount(searchParams.get('amount'));
  const amountText = amount == null ? '-' : formatPaymentAmount(amount, currency);
  const expiresAt = cleanParam(searchParams.get('expiresAt'), 40);
  const expiresText = useMemo(() => {
    if (!expiresAt) return t('pages.paymentInstructions.expiryFallback');
    const parsed = new Date(expiresAt);
    if (Number.isNaN(parsed.getTime())) return expiresAt;
    return parsed.toLocaleString();
  }, [expiresAt, t]);

  return (
    <main className="payment-instructions-page">
      <section className="payment-instructions-page__hero">
        <Text className="payment-instructions-page__eyebrow">{t('pages.payment.secureEyebrow')}</Text>
        <Title level={1}>{t('pages.paymentInstructions.title')}</Title>
        <Text className="payment-instructions-page__subtitle">{t('pages.paymentInstructions.subtitle')}</Text>
      </section>

      <div className="payment-instructions-page__grid">
        <Card className="payment-instructions-page__card">
          <Space direction="vertical" size="middle" className="payment-instructions-page__stack">
            <div className="payment-instructions-page__status">
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
        </Card>

        <Card className="payment-instructions-page__card">
          <Space direction="vertical" size="middle" className="payment-instructions-page__stack">
            <Title level={3}>{t('pages.paymentInstructions.nextTitle')}</Title>
            <div className="payment-instructions-page__steps">
              <span>1</span><Text>{t('pages.paymentInstructions.stepOne')}</Text>
              <span>2</span><Text>{t('pages.paymentInstructions.stepTwo')}</Text>
              <span>3</span><Text>{t('pages.paymentInstructions.stepThree')}</Text>
            </div>
            <Space wrap className="payment-instructions-page__actions">
              <Button type="primary" icon={<FileSearchOutlined />} onClick={openTrackOrder}>
                {t('nav.trackOrder')}
              </Button>
              <Button icon={<CustomerServiceOutlined />} onClick={openSupport}>
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
