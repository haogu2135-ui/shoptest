import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Card, Descriptions, Empty, Form, Input, List, Modal, Space, Tag, Typography, message } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, CreditCardOutlined, CustomerServiceOutlined, RollbackOutlined, SearchOutlined, TruckOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { cartApi, orderApi, paymentApi } from '../api';
import type { Order, OrderItem, Payment } from '../types';
import { useLanguage } from '../i18n';
import { useMarket } from '../hooks/useMarket';
import { formatSelectedSpecs } from '../utils/selectedSpecs';
import { paymentMethodLabel } from '../utils/paymentMethods';
import { productImageFallback, resolveProductImage } from '../utils/productMedia';
import { navigateToSafeUrl } from '../utils/safeUrl';
import { getPaymentRecoveryState } from '../utils/paymentRecovery';
import { addGuestCartItem } from '../utils/guestCart';
import { dispatchDomEvent } from '../utils/domEvents';
import { hasStoredValue } from '../utils/safeStorage';
import { saveGuestSupportContext } from '../utils/guestSupportContext';
import { getApiErrorMessage } from '../utils/apiError';
import SeventeenTrackWidget from '../components/SeventeenTrackWidget';
import './OrderTracking.css';

const { Text, Title } = Typography;
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
  RETURNED: 'purple',
};

const getTrackingStep = (status?: string) => {
  if (status === 'COMPLETED') return 3;
  if (status === 'SHIPPED' || status === 'RETURN_SHIPPED') return 2;
  if (status === 'PENDING_SHIPMENT' || status === 'RETURN_APPROVED') return 1;
  return 0;
};

const OrderTracking: React.FC = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [confirmingReceipt, setConfirmingReceipt] = useState(false);
  const [returning, setReturning] = useState(false);
  const [returnShipping, setReturnShipping] = useState(false);
  const [returnRequestOpen, setReturnRequestOpen] = useState(false);
  const [returnShipmentOpen, setReturnShipmentOpen] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [returnTrackingNumber, setReturnTrackingNumber] = useState('');
  const [trackedEmail, setTrackedEmail] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const autoTrackKeyRef = useRef('');
  const { t, language } = useLanguage();
  const { formatMoney } = useMarket();
  const dateLocale = language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US';
  const trackingStep = getTrackingStep(order?.status);
  const paymentReturnStatus = cleanTrackingParam(searchParams.get('payment'), 40).toLowerCase();
  const supportOpen = useCallback(() => {
    if (order?.orderNo && trackedEmail) {
      saveGuestSupportContext({ orderNo: order.orderNo, email: trackedEmail });
      dispatchDomEvent('shop:open-support', { orderNo: order.orderNo, email: trackedEmail });
      return;
    }
    if (!hasStoredValue('token')) {
      dispatchDomEvent('shop:open-support');
      return;
    }
    dispatchDomEvent('shop:open-support');
  }, [order?.orderNo, trackedEmail]);
  const nextAction = useMemo(() => {
    if (!order) return null;
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
  }, [order, t]);
  const assurancePlan = useMemo(() => {
    if (!order) return null;
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
  }, [items, navigate, order, supportOpen, t]);

  const trackOrder = useCallback(async (values: { orderNo: string; email: string }, quiet = false) => {
    setLoading(true);
    const normalizedEmail = values.email.trim().toLowerCase();
    try {
      const res = await orderApi.track(values.orderNo.trim(), normalizedEmail);
      setTrackedEmail(normalizedEmail);
      setOrder(res.data.order);
      setItems(res.data.items || []);
      setReturnReason(res.data.order?.returnReason || '');
      setReturnTrackingNumber(res.data.order?.returnTrackingNumber || '');
    } catch (error: any) {
      setTrackedEmail('');
      setOrder(null);
      setItems([]);
      if (!quiet) {
        message.error(getApiErrorMessage(error, t('pages.orderTracking.notFound'), language));
      }
    } finally {
      setLoading(false);
    }
  }, [language, t]);

  const onFinish = (values: { orderNo: string; email: string }) => trackOrder(values);

  useEffect(() => {
    const orderNo = cleanTrackingParam(searchParams.get('orderNo') || searchParams.get('order'), 80);
    const email = cleanTrackingParam(searchParams.get('email') || searchParams.get('guestEmail'), 120).toLowerCase();
    if (!orderNo || !email) return;
    form.setFieldsValue({ orderNo, email });
    const key = `${orderNo}:${email}`;
    if (autoTrackKeyRef.current === key) return;
    autoTrackKeyRef.current = key;
    void trackOrder({ orderNo, email }, true);
  }, [form, searchParams, trackOrder]);

  const refreshTrackedOrder = async () => {
    if (!order?.orderNo || !trackedEmail) return;
    const refreshed = await orderApi.track(order.orderNo, trackedEmail);
    setOrder(refreshed.data.order);
    setItems(refreshed.data.items || []);
    setReturnReason(refreshed.data.order?.returnReason || '');
    setReturnTrackingNumber(refreshed.data.order?.returnTrackingNumber || '');
  };

  const continuePayment = async () => {
    if (!order || order.status !== 'PENDING_PAYMENT') return;
    setPaying(true);
    try {
      const paymentsRes = await paymentApi.getByOrder(order.id, trackedEmail, order.orderNo);
      const payments = paymentsRes.data || [];
      const reusablePayment = payments.find((payment: Payment) => payment.status === 'PAID')
        || payments.find((payment: Payment) => payment.status === 'PENDING' && !getPaymentRecoveryState(payment).isExpired);
      let payment = reusablePayment;
      if (!payment) {
        const channelsRes = await paymentApi.getChannels();
        const channels = channelsRes.data || [];
        const channel = channels.find((item) => item.code === order.paymentMethod)?.code
          || channels.find((item) => item.recommended)?.code
          || channels[0]?.code;
        if (!channel) {
          message.error(t('pages.checkout.paymentUnavailable'));
          return;
        }
        payment = (await paymentApi.create(order.id, channel, trackedEmail, order.orderNo)).data;
      }
      if (payment.status === 'PAID') {
        message.success(t('pages.checkout.paidTitle'));
        const refreshed = await orderApi.track(order.orderNo || String(order.id), trackedEmail);
        setOrder(refreshed.data.order);
        setItems(refreshed.data.items || []);
        return;
      }
      message.success(t('pages.checkout.paymentReady'));
      if (payment.paymentUrl && !navigateToSafeUrl(payment.paymentUrl)) {
        message.error(t('pages.payment.failed'));
      }
    } catch (error: any) {
      message.error(getApiErrorMessage(error, t('pages.profile.continuePayFailed'), language));
    } finally {
      setPaying(false);
    }
  };

  const restoreTrackedItemsToCart = async () => {
    if (hasStoredValue('token')) {
      const results = await Promise.allSettled(items.map((item) => cartApi.addItem(0, item.productId, item.quantity, item.selectedSpecs)));
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') return;
        const item = items[index];
        addGuestCartItem({
          id: item.productId,
          name: item.productName || t('pages.profile.productFallback', { id: item.productId }),
          imageUrl: item.imageUrl,
          price: item.price,
          status: 'ACTIVE',
        }, item.quantity, item.selectedSpecs, item.price);
      });
      dispatchDomEvent('shop:cart-updated');
      return;
    }
    items.forEach((item) => {
      addGuestCartItem({
        id: item.productId,
        name: item.productName || t('pages.profile.productFallback', { id: item.productId }),
        imageUrl: item.imageUrl,
        price: item.price,
        status: 'ACTIVE',
      }, item.quantity, item.selectedSpecs, item.price);
    });
  };

  const cancelPendingPayment = () => {
    if (!order || order.status !== 'PENDING_PAYMENT') return;
    Modal.confirm({
      title: t('pages.checkout.rollbackPaymentTitle'),
      content: t('pages.checkout.rollbackPaymentContent'),
      okText: t('pages.checkout.rollbackPaymentAction'),
      cancelText: t('common.cancel'),
      okButtonProps: { danger: true },
      async onOk() {
        setCanceling(true);
        try {
          await orderApi.cancel(order.id, trackedEmail, order.orderNo);
          await restoreTrackedItemsToCart();
          message.success(t('pages.checkout.rollbackPaymentSuccess'));
          setOrder({ ...order, status: 'CANCELLED' });
          navigate('/cart');
        } catch (error: any) {
          message.error(getApiErrorMessage(error, t('pages.checkout.rollbackPaymentFailed'), language));
        } finally {
          setCanceling(false);
        }
      },
    });
  };

  const confirmReceipt = async () => {
    if (!order || order.status !== 'SHIPPED' || !trackedEmail) return;
    setConfirmingReceipt(true);
    try {
      await orderApi.confirm(order.id, trackedEmail, order.orderNo);
      await refreshTrackedOrder();
      message.success(t('pages.profile.receiptConfirmed'));
    } catch (error: any) {
      message.error(getApiErrorMessage(error, t('pages.profile.confirmFailed'), language));
    } finally {
      setConfirmingReceipt(false);
    }
  };

  const submitReturnRequest = async () => {
    if (!order?.returnable) return;
    setReturning(true);
    try {
      await orderApi.returnOrder(order.id, returnReason.trim(), trackedEmail, order.orderNo);
      await refreshTrackedOrder();
      setReturnRequestOpen(false);
      message.success(t('pages.profile.returnRequested'));
    } catch (error: any) {
      message.error(getApiErrorMessage(error, t('pages.profile.returnFailed'), language));
    } finally {
      setReturning(false);
    }
  };

  const submitReturnTracking = async () => {
    if (!order || order.status !== 'RETURN_APPROVED') return;
    if (!returnTrackingNumber.trim()) {
      message.error(t('pages.profile.returnTrackingRequired'));
      return;
    }
    setReturnShipping(true);
    try {
      await orderApi.submitReturnShipment(order.id, returnTrackingNumber.trim(), trackedEmail, order.orderNo);
      await refreshTrackedOrder();
      setReturnShipmentOpen(false);
      message.success(t('pages.profile.returnShipmentSubmitted'));
    } catch (error: any) {
      message.error(getApiErrorMessage(error, t('pages.profile.returnShipmentFailed'), language));
    } finally {
      setReturnShipping(false);
    }
  };

  return (
    <div className={`order-tracking-page order-tracking-page--${language}`}>
      <Title level={2} className="order-tracking-page__title">{t('pages.orderTracking.title')}</Title>
      {paymentReturnStatus === 'success' ? (
        <Alert
          className="order-tracking-page__paymentReturn"
          type="success"
          showIcon
          message={t('pages.checkout.paidTitle')}
          description={t('pages.checkout.paymentRecoveryNextPaid')}
        />
      ) : paymentReturnStatus === 'cancelled' ? (
        <Alert
          className="order-tracking-page__paymentReturn"
          type="warning"
          showIcon
          message={t('pages.checkout.paymentRecoveryPending')}
          description={t('pages.checkout.paymentRecoveryNextRetry')}
        />
      ) : null}
      <Card className="order-tracking-page__lookupCard">
        <div className="order-tracking-page__lookupHeader">
          <span className="order-tracking-page__lookupIcon"><SearchOutlined /></span>
          <span>
            <Text strong>{t('pages.orderTracking.title')}</Text>
            <Text type="secondary">{t('pages.orderTracking.empty')}</Text>
          </span>
        </div>
        <Form form={form} className="order-tracking-page__lookupForm" layout="vertical" onFinish={onFinish}>
          <Form.Item name="orderNo" label={t('pages.orderTracking.orderNo')} rules={[{ required: true, message: t('pages.orderTracking.orderNoRequired') }]}>
            <Input placeholder="SO202605..." autoComplete="off" inputMode="text" maxLength={80} />
          </Form.Item>
          <Form.Item name="email" label={t('pages.orderTracking.email')} rules={[{ required: true, message: t('pages.orderTracking.emailRequired') }, { type: 'email', message: t('pages.auth.emailInvalid') }]}>
            <Input placeholder="you@example.com" autoComplete="email" inputMode="email" maxLength={120} />
          </Form.Item>
          <Button className="order-tracking-page__lookupButton" type="primary" htmlType="submit" loading={loading} icon={<SearchOutlined />} block>
            {t('pages.orderTracking.search')}
          </Button>
        </Form>
      </Card>

      {!order ? (
        <section className="order-tracking-page__emptyState">
          <Empty description={t('pages.orderTracking.empty')} />
          <div className="order-tracking-page__emptyActions">
            <Button icon={<CustomerServiceOutlined />} onClick={supportOpen}>
              {t('pages.profile.contactSupport')}
            </Button>
            <Button type="primary" onClick={() => navigate('/products')}>
              {t('pages.orderTracking.shopAgain')}
            </Button>
          </div>
        </section>
      ) : (
        <Space direction="vertical" size="middle" className="order-tracking-page__resultStack">
          <section className="order-tracking-page__journey" aria-label={t('pages.orderTracking.journeyTitle')}>
            <div className="order-tracking-page__journeyCopy">
              <Text className="order-tracking-page__eyebrow">{t('pages.orderTracking.journeyEyebrow')}</Text>
              <Title level={4}>{t('pages.orderTracking.journeyTitle')}</Title>
              <Text type="secondary">
                {order.trackingNumber
                  ? t('pages.orderTracking.journeyWithTracking', { number: order.trackingNumber })
                  : t('pages.orderTracking.journeyNoTracking')}
              </Text>
            </div>
            <div className="order-tracking-page__steps">
              <div className={`order-tracking-page__step ${trackingStep >= 0 ? 'is-active' : ''}`}>
                <CheckCircleOutlined />
                <span>{t('pages.orderTracking.stepPaid')}</span>
              </div>
              <div className={`order-tracking-page__step ${trackingStep >= 1 ? 'is-active' : ''}`}>
                <ClockCircleOutlined />
                <span>{t('pages.orderTracking.stepPreparing')}</span>
              </div>
              <div className={`order-tracking-page__step ${trackingStep >= 2 ? 'is-active' : ''}`}>
                <TruckOutlined />
                <span>{t('pages.orderTracking.stepInTransit')}</span>
              </div>
              <div className={`order-tracking-page__step ${trackingStep >= 3 ? 'is-active' : ''}`}>
                <CheckCircleOutlined />
                <span>{t('pages.orderTracking.stepDelivered')}</span>
              </div>
            </div>
          </section>
          <section className="order-tracking-page__confidence">
            <div className="order-tracking-page__confidenceCard">
              <TruckOutlined />
              <span>
                <Text strong>{t('pages.orderTracking.confidenceDeliveryTitle')}</Text>
                <Text type="secondary">
                  {order.trackingNumber
                    ? t('pages.orderTracking.confidenceDeliveryTracked')
                    : t('pages.orderTracking.confidenceDeliveryPreparing')}
                </Text>
              </span>
            </div>
            <div className="order-tracking-page__confidenceCard">
              <CustomerServiceOutlined />
              <span>
                <Text strong>{t('pages.orderTracking.confidenceSupportTitle')}</Text>
                <Text type="secondary">{t('pages.orderTracking.confidenceSupportText')}</Text>
              </span>
            </div>
          </section>
          {nextAction ? (
            <section className={`order-tracking-page__nextAction order-tracking-page__nextAction--${nextAction.tone}`}>
              <div>
                <Text strong>{nextAction.title}</Text>
                <Text type="secondary">{nextAction.text}</Text>
              </div>
              {order.status === 'PENDING_PAYMENT' ? (
                <Space wrap className="order-tracking-page__nextActionButtons">
                  <Button type="primary" icon={<CreditCardOutlined />} loading={paying} onClick={continuePayment}>
                    {t('pages.profile.continuePay')}
                  </Button>
                  <Button danger icon={<RollbackOutlined />} loading={canceling} onClick={cancelPendingPayment}>
                    {t('pages.profile.cancelOrder')}
                  </Button>
                  <Button icon={<CustomerServiceOutlined />} onClick={supportOpen}>
                    {t('pages.profile.contactSupport')}
                  </Button>
                </Space>
              ) : (
                <Space wrap className="order-tracking-page__nextActionButtons">
                  {order.status === 'SHIPPED' ? (
                    <Button type="primary" icon={<CheckCircleOutlined />} loading={confirmingReceipt} onClick={confirmReceipt}>
                      {t('pages.profile.confirmReceipt')}
                    </Button>
                  ) : null}
                  {order.returnable ? (
                    <Button icon={<RollbackOutlined />} loading={returning} onClick={() => setReturnRequestOpen(true)}>
                      {t('pages.profile.returnOrder')}
                    </Button>
                  ) : null}
                  {order.status === 'RETURN_APPROVED' ? (
                    <Button type="primary" icon={<TruckOutlined />} loading={returnShipping} onClick={() => setReturnShipmentOpen(true)}>
                      {t('pages.orderTracking.submitReturnTracking')}
                    </Button>
                  ) : null}
                  <Button icon={<CustomerServiceOutlined />} onClick={supportOpen}>
                    {t('pages.profile.contactSupport')}
                  </Button>
                </Space>
              )}
            </section>
          ) : null}
          {assurancePlan ? (
            <section className="order-tracking-page__assurance" aria-label={t('pages.orderTracking.assuranceTitle')}>
              <div>
                <Text className="order-tracking-page__eyebrow">{t('pages.orderTracking.assuranceEyebrow')}</Text>
                <Title level={4}>{assurancePlan.title}</Title>
                <Text type="secondary">{assurancePlan.text}</Text>
              </div>
              <div className="order-tracking-page__assuranceSignals">
                <span><CheckCircleOutlined /> {t('pages.orderTracking.assuranceItems', { count: assurancePlan.itemCount })}</span>
                <span><TruckOutlined /> {order.trackingNumber ? t('pages.orderTracking.assuranceTrackingReady') : t('pages.orderTracking.assuranceTrackingPending')}</span>
                <span><CustomerServiceOutlined /> {t('pages.orderTracking.assuranceSupportReady')}</span>
              </div>
              <Space wrap className="order-tracking-page__assuranceActions">
                <Button type="primary" onClick={assurancePlan.primaryAction}>
                  {assurancePlan.primaryLabel}
                </Button>
                {order.status === 'COMPLETED' ? (
                  <Button onClick={supportOpen} icon={<CustomerServiceOutlined />}>
                    {t('pages.profile.contactSupport')}
                  </Button>
                ) : null}
              </Space>
            </section>
          ) : null}
          <Card title={t('pages.orderTracking.summary')}>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label={t('pages.orderTracking.orderNo')}>{order.orderNo || order.id}</Descriptions.Item>
              <Descriptions.Item label={t('common.status')}>
                <Tag color={statusColor[order.status] || 'default'}>{t(`status.${order.status}`)}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('common.amount')}>
                <Text strong className="order-tracking-page__amount commerce-money">{formatMoney(order.totalAmount)}</Text>
              </Descriptions.Item>
              <Descriptions.Item label={t('pages.checkout.paymentMethod')}>
                {order.paymentMethod ? paymentMethodLabel(order.paymentMethod, t) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('pages.checkout.address')}>{order.shippingAddress || '-'}</Descriptions.Item>
              <Descriptions.Item label={t('pages.orderTracking.createdAt')}>
                {order.createdAt ? new Date(order.createdAt).toLocaleString(dateLocale) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('pages.orderTracking.trackingNumber')}>
                {order.trackingNumber || t('pages.orderTracking.notShipped')}
              </Descriptions.Item>
              {order.trackingCarrierName ? (
                <Descriptions.Item label={t('pages.orderTracking.carrier')}>
                  {order.trackingCarrierName}
                </Descriptions.Item>
              ) : null}
              {order.returnDeadline ? (
                <Descriptions.Item label={t('pages.profile.returnDeadline')}>
                  {new Date(order.returnDeadline).toLocaleString(dateLocale)}
                </Descriptions.Item>
              ) : null}
              {order.returnReason ? (
                <Descriptions.Item label={t('pages.profile.returnReason')}>{order.returnReason}</Descriptions.Item>
              ) : null}
              {order.returnTrackingNumber ? (
                <Descriptions.Item label={t('pages.profile.returnTracking')}>{order.returnTrackingNumber}</Descriptions.Item>
              ) : null}
            </Descriptions>
          </Card>

          <Card title={t('pages.profile.orderItems')}>
            <List
              dataSource={items}
              locale={{ emptyText: t('pages.profile.noOrderItems') }}
              renderItem={(item) => (
                <List.Item className="order-tracking-page__item">
                  <List.Item.Meta
                    avatar={
                      <img
                        src={resolveOrderTrackingImage(item.imageUrl)}
                        alt={item.productName}
                        className="order-tracking-page__image"
                        onError={(event) => {
                          if (event.currentTarget.src !== orderTrackingImageFallback) {
                            event.currentTarget.src = orderTrackingImageFallback;
                          }
                        }}
                      />
                    }
                    title={item.productName || t('pages.profile.productFallback', { id: item.productId })}
                    description={
                      <Space direction="vertical" size={0}>
                        {item.selectedSpecs ? <Text type="secondary">{formatSelectedSpecs(item.selectedSpecs, t)}</Text> : null}
                        <Text type="secondary" className="order-tracking-page__itemUnit commerce-atomic commerce-price-quantity">
                          <span className="commerce-money">{formatMoney(item.price)}</span>
                          <span className="commerce-quantity">x {item.quantity}</span>
                        </Text>
                      </Space>
                    }
                  />
                  <Text strong className="order-tracking-page__itemTotal commerce-money">{formatMoney(item.price * item.quantity)}</Text>
                </List.Item>
              )}
            />
          </Card>

          <Card title={t('pages.orderTracking.logistics')}>
            {order.trackingNumber ? (
              <SeventeenTrackWidget trackingNumber={order.trackingNumber} carrierCode={order.trackingCarrierCode} />
            ) : (
              <Empty description={t('pages.orderTracking.notShipped')} />
            )}
          </Card>
        </Space>
      )}
      <Modal
        title={t('pages.profile.returnOrder')}
        open={returnRequestOpen}
        onOk={submitReturnRequest}
        onCancel={() => setReturnRequestOpen(false)}
        confirmLoading={returning}
        okText={t('pages.profile.returnOrder')}
        cancelText={t('common.cancel')}
        className="profile-mobile-safe-modal order-tracking-page__returnModal"
      >
        <Space direction="vertical" className="order-tracking-page__resultStack">
          <Text type="secondary">{t('pages.profile.returnReviewHint')}</Text>
          {order?.returnDeadline ? (
            <Text>{t('pages.profile.returnAvailableUntil', { time: new Date(order.returnDeadline).toLocaleString(dateLocale) })}</Text>
          ) : null}
          <Input.TextArea
            rows={4}
            value={returnReason}
            onChange={(event) => setReturnReason(event.target.value)}
            maxLength={500}
            showCount
            placeholder={t('pages.profile.returnReasonPlaceholder')}
          />
        </Space>
      </Modal>
      <Modal
        title={t('pages.profile.returnTracking')}
        open={returnShipmentOpen}
        onOk={submitReturnTracking}
        onCancel={() => setReturnShipmentOpen(false)}
        confirmLoading={returnShipping}
        okText={t('pages.profile.returnShipmentSubmitted')}
        cancelText={t('common.cancel')}
        className="profile-mobile-safe-modal order-tracking-page__returnModal"
      >
        <Input
          value={returnTrackingNumber}
          onChange={(event) => setReturnTrackingNumber(event.target.value)}
          autoComplete="off"
          inputMode="text"
          maxLength={120}
          placeholder={t('pages.profile.returnTrackingPlaceholder')}
        />
      </Modal>
    </div>
  );
};

export default OrderTracking;
