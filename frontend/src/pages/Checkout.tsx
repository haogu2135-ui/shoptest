import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Cascader, Divider, Empty, Form, Input, List, message, Radio, Result, Select, Space, Spin, Tag, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { addressApi, apiBaseUrl, appConfigApi, cartApi, couponApi, orderApi, paymentApi } from '../api';
import type { CartItem, CouponQuote, Order, Payment, UserAddress, UserCoupon } from '../types';
import { regionData } from '../regionData';
import { useLanguage } from '../i18n';
import { createPaymentMethodOptions, mexicoPaymentMethodDetails, paymentMethodLabel, paymentSimulationEnabledFallback } from '../utils/paymentMethods';
import { useMarket } from '../hooks/useMarket';
import { formatSelectedSpecs } from '../utils/selectedSpecs';
import { getGuestCartItems, removeGuestCartItems } from '../utils/guestCart';
import { navigateToSafeUrl } from '../utils/safeUrl';
import './Checkout.css';

const { Text, Title } = Typography;
const checkoutImageFallback = 'https://images.unsplash.com/photo-1601758125946-6ec2ef64daf8?auto=format&fit=crop&w=900&q=80';

const resolveCheckoutImage = (imageUrl?: string) => {
  if (!imageUrl) return checkoutImageFallback;
  if (/^(https?:|data:|blob:)/i.test(imageUrl)) {
    return imageUrl;
  }
  return `${apiBaseUrl}${imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`}`;
};

const isPurchasable = (item: CartItem) =>
  (item.productStatus || 'ACTIVE') === 'ACTIVE' && (item.stock === undefined || item.stock >= item.quantity);

const Checkout: React.FC = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | 'new'>('new');
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [guestPaymentEmail, setGuestPaymentEmail] = useState<string | undefined>();
  const [pendingPaymentMethod, setPendingPaymentMethod] = useState<string>('STRIPE');
  const [paymentCreateError, setPaymentCreateError] = useState<string | null>(null);
  const [paymentSimulationEnabled, setPaymentSimulationEnabled] = useState(paymentSimulationEnabledFallback);
  const [simulatingCallback, setSimulatingCallback] = useState(false);
  const [couponQuote, setCouponQuote] = useState<CouponQuote | null>(null);
  const [selectedUserCouponId, setSelectedUserCouponId] = useState<number | null>(null);
  const { t } = useLanguage();
  const paymentOptions = useMemo(() => createPaymentMethodOptions(t), [t]);
  const { market, formatMoney } = useMarket();
  const isGuestCheckout = !localStorage.getItem('token') || !localStorage.getItem('userId');

  useEffect(() => {
    appConfigApi.get()
      .then((res) => setPaymentSimulationEnabled(Boolean(res.data.paymentSimulationEnabled)))
      .catch(() => setPaymentSimulationEnabled(paymentSimulationEnabledFallback));
  }, []);

  const selectedCartItemIds = useMemo(() => {
    try {
      const raw = sessionStorage.getItem('checkoutCartItemIds');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.map(Number).filter(Boolean) : [];
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    if (!token || !userId) {
      const guestItems = getGuestCartItems().filter((item) => selectedCartItemIds.length === 0 || selectedCartItemIds.includes(item.id));
      const purchasableItems = guestItems.filter(isPurchasable);
      if (purchasableItems.length !== guestItems.length) {
        message.warning(t('pages.checkout.unavailableSelected'));
        sessionStorage.setItem('checkoutCartItemIds', JSON.stringify(purchasableItems.map((item) => item.id)));
      }
      setCartItems(purchasableItems);
      setAddresses([]);
      const preferredPaymentMethod = sessionStorage.getItem('checkoutPaymentMethod');
      if (preferredPaymentMethod) {
        form.setFieldsValue({ paymentMethod: preferredPaymentMethod });
      }
      setLoading(false);
      return;
    }

    const loadCheckout = async () => {
      setLoading(true);
      try {
        const [cartRes, addressRes] = await Promise.all([
          cartApi.getItems(Number(userId)),
          addressApi.getByUser(Number(userId)).catch(() => ({ data: [] as UserAddress[] })),
        ]);
        const selectedItems = selectedCartItemIds.length === 0
          ? cartRes.data
          : cartRes.data.filter((item) => selectedCartItemIds.includes(item.id));
        const purchasableItems = selectedItems.filter(isPurchasable);
        if (purchasableItems.length !== selectedItems.length) {
          message.warning(t('pages.checkout.unavailableSelected'));
          sessionStorage.setItem('checkoutCartItemIds', JSON.stringify(purchasableItems.map((item) => item.id)));
        }
        setCartItems(purchasableItems);
        setAddresses(addressRes.data);
        const defaultAddress = addressRes.data.find((address) => address.isDefault) || addressRes.data[0];
        if (defaultAddress) setSelectedAddressId(defaultAddress.id);
        const preferredPaymentMethod = sessionStorage.getItem('checkoutPaymentMethod');
        if (preferredPaymentMethod) {
          form.setFieldsValue({ paymentMethod: preferredPaymentMethod });
        }
      } catch {
        message.error(t('pages.checkout.loadFailed'));
      } finally {
        setLoading(false);
      }
    };

    loadCheckout();
  }, [form, selectedCartItemIds, t]);

  useEffect(() => {
    if (selectedAddressId !== 'new') {
      const address = addresses.find((item) => item.id === selectedAddressId);
      if (address) {
        form.setFieldsValue({
          recipientName: address.recipientName,
          phone: address.phone,
          shippingAddress: address.address,
        });
      }
    } else {
      form.setFieldsValue({ recipientName: undefined, phone: undefined, region: undefined, shippingAddress: undefined });
    }
  }, [addresses, form, selectedAddressId]);

  const cartTotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userId = Number(localStorage.getItem('userId') || 0);
    if (!token || !userId || cartItems.length === 0) {
      setCouponQuote(null);
      return;
    }
    couponApi.quote({
      userId,
      cartItemIds: cartItems.map((item) => item.id),
      userCouponId: selectedUserCouponId,
    })
      .then((res) => {
        setCouponQuote(res.data);
        if (!selectedUserCouponId && res.data.selectedUserCouponId) {
          setSelectedUserCouponId(res.data.selectedUserCouponId);
        }
      })
      .catch((error) => {
        if (selectedUserCouponId) {
          message.error(error?.response?.data?.error || t('pages.checkout.couponUnavailable'));
          setSelectedUserCouponId(null);
        }
      });
  }, [cartItems, selectedUserCouponId, t]);

  const guestShippingFee = cartTotal >= market.freeShippingThreshold ? 0 : 30;
  const shippingFee = couponQuote?.shippingFee ?? (isGuestCheckout ? guestShippingFee : 0);
  const payableAmount = couponQuote?.payableAmount ?? (cartTotal + shippingFee);
  const discountAmount = couponQuote?.discountAmount ?? 0;
  const selectedCoupon = useMemo(
    () => couponQuote?.availableCoupons.find((coupon) => coupon.id === selectedUserCouponId),
    [couponQuote?.availableCoupons, selectedUserCouponId],
  );
  const freeShippingRemaining = Math.max(0, market.freeShippingThreshold - cartTotal);
  const freeShippingPercent = market.freeShippingThreshold > 0
    ? Math.min(100, Math.round((cartTotal / market.freeShippingThreshold) * 100))
    : 100;

  const calculateCouponDiscount = (coupon: UserCoupon) => {
    if (cartTotal < Number(coupon.thresholdAmount || 0)) {
      return 0;
    }
    if (coupon.couponType === 'FULL_REDUCTION') {
      return Math.min(Number(coupon.reductionAmount || 0), cartTotal);
    }
    const percent = Number(coupon.discountPercent || 100);
    const discount = cartTotal * (100 - percent) / 100;
    const maxDiscount = Number(coupon.maxDiscountAmount || 0);
    return Math.min(maxDiscount > 0 ? Math.min(discount, maxDiscount) : discount, cartTotal);
  };

  const describeCoupon = (coupon: UserCoupon) => {
    const rule = coupon.couponType === 'FULL_REDUCTION'
      ? `${formatMoney(coupon.thresholdAmount)} - ${formatMoney(coupon.reductionAmount)}`
      : t('pages.checkout.discountPayable', { percent: coupon.discountPercent || 100 }) + (coupon.maxDiscountAmount ? `, ${t('pages.checkout.maxDiscount', { amount: formatMoney(coupon.maxDiscountAmount) })}` : '');
    const threshold = Number(coupon.thresholdAmount || 0);
    if (cartTotal < threshold) {
      return `${coupon.couponName}: ${rule} (${t('pages.checkout.needMore', { amount: formatMoney(threshold - cartTotal) })})`;
    }
    return `${coupon.couponName}: ${rule}`;
  };

  const buildAddress = (values: any) => {
    if (selectedAddressId !== 'new') {
      const address = addresses.find((item) => item.id === selectedAddressId);
      if (!address) throw new Error(t('pages.checkout.addressRequired'));
      return `${address.recipientName} / ${address.phone} / ${address.address}`;
    }
    const region = values.region ? values.region.join(' ') : '';
    const detail = values.shippingAddress || '';
    return `${values.recipientName} / ${values.phone} / ${region} ${detail}`.trim();
  };

  const handleSubmit = async (values: any) => {
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    if (cartItems.length === 0) {
      message.error(t('pages.checkout.emptyCart'));
      return;
    }
    if (cartItems.some((item) => !isPurchasable(item))) {
      message.error(t('pages.checkout.unavailableSelected'));
      return;
    }

    setSubmitting(true);
    try {
      const shippingAddress = buildAddress(values);
      const orderRes = token && userId
        ? await orderApi.checkout({
            userId: Number(userId),
            cartItemIds: cartItems.map((item) => item.id),
            shippingAddress,
            paymentMethod: values.paymentMethod,
            userCouponId: selectedUserCouponId,
          })
        : await orderApi.guestCheckout({
            guestEmail: values.guestEmail,
            guestName: values.recipientName,
            guestPhone: values.phone,
            shippingAddress,
            paymentMethod: values.paymentMethod,
            items: cartItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              selectedSpecs: item.selectedSpecs,
            })),
          });
      sessionStorage.removeItem('checkoutCartItemIds');
      sessionStorage.removeItem('checkoutPaymentMethod');
      if (!token || !userId) {
        removeGuestCartItems(cartItems.map((item) => item.id));
      }
      window.dispatchEvent(new Event('shop:cart-updated'));
      window.dispatchEvent(new Event('shop:coupons-updated'));
      setCreatedOrder(orderRes.data);
      setPendingPaymentMethod(values.paymentMethod);
      setGuestPaymentEmail(token && userId ? undefined : values.guestEmail);
      setPaymentCreateError(null);
      let paymentRes;
      try {
        paymentRes = await paymentApi.create(
          orderRes.data.id,
          values.paymentMethod,
          token && userId ? undefined : values.guestEmail,
        );
      } catch (paymentError: any) {
        setPayment(null);
        setPaymentCreateError(paymentError?.response?.data?.error || t('pages.payment.createFailed'));
        message.warning(t('pages.checkout.orderCreatedPaymentPending'));
        return;
      }
      setPayment(paymentRes.data);
      message.success(t('pages.checkout.orderCreated'));
      if (paymentRes.data.paymentUrl) {
        if (!navigateToSafeUrl(paymentRes.data.paymentUrl)) {
          message.error(t('pages.payment.failed'));
        }
      }
    } catch (error: any) {
      message.error(error?.response?.data?.error || t('pages.checkout.orderCreateFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const simulatePay = async () => {
    if (!payment) return;
    setPaying(true);
    try {
      const paidRes = await paymentApi.simulatePaid(payment.id, guestPaymentEmail);
      setPayment(paidRes.data);
      setCreatedOrder((order) => order ? { ...order, status: 'PENDING_SHIPMENT' } : order);
      message.success(t('pages.checkout.paid'));
    } catch (error: any) {
      message.error(error?.response?.data?.error || t('pages.checkout.payFailed'));
    } finally {
      setPaying(false);
    }
  };

  const retryCreatePayment = async () => {
    if (!createdOrder) return;
    setPaying(true);
    try {
      const paymentRes = await paymentApi.create(createdOrder.id, pendingPaymentMethod, guestPaymentEmail);
      setPayment(paymentRes.data);
      setPaymentCreateError(null);
      message.success(t('pages.checkout.paymentReady'));
      if (paymentRes.data.paymentUrl && !navigateToSafeUrl(paymentRes.data.paymentUrl)) {
        message.error(t('pages.payment.failed'));
      }
    } catch (error: any) {
      setPaymentCreateError(error?.response?.data?.error || t('pages.payment.createFailed'));
      message.error(error?.response?.data?.error || t('pages.payment.createFailed'));
    } finally {
      setPaying(false);
    }
  };

  const openPaymentUrl = () => {
    if (payment?.paymentUrl && !navigateToSafeUrl(payment.paymentUrl)) {
      message.error(t('pages.payment.failed'));
    }
  };

  const simulateCallback = async () => {
    if (!payment) return;
    setSimulatingCallback(true);
    try {
      const callbackRes = await paymentApi.simulateCallback(payment.id, guestPaymentEmail);
      setPayment(callbackRes.data);
      setCreatedOrder((order) => order ? { ...order, status: 'PENDING_SHIPMENT' } : order);
      message.success(t('pages.checkout.paid'));
    } catch (error: any) {
      message.error(error?.response?.data?.error || t('pages.checkout.payFailed'));
    } finally {
      setSimulatingCallback(false);
    }
  };

  if (loading) {
    return <div className="checkout-page checkout-page--loading"><Spin size="large" /></div>;
  }

  if (createdOrder && !payment) {
    return (
      <div className="checkout-page checkout-page--result">
        <Result
          status="warning"
          title={t('pages.checkout.orderCreatedPaymentPending')}
          subTitle={t('pages.checkout.paymentPendingSubtitle', { orderNo: createdOrder.orderNo || createdOrder.id, amount: formatMoney(createdOrder.totalAmount) })}
          extra={[
            <Button type="primary" key="retry" loading={paying} onClick={retryCreatePayment}>{t('pages.checkout.retryPayment')}</Button>,
            <Button key="profile" onClick={() => navigate('/profile?tab=orders')}>{t('pages.checkout.viewOrder')}</Button>,
            <Button key="track" onClick={() => navigate('/track-order')}>{t('pages.orderTracking.title')}</Button>,
            <Button key="home" onClick={() => navigate('/')}>{t('pages.checkout.backHome')}</Button>,
          ]}
        />
        {paymentCreateError ? (
          <Alert type="warning" showIcon message={t('pages.checkout.paymentCreateWarning')} description={paymentCreateError} />
        ) : null}
      </div>
    );
  }

  if (createdOrder && payment) {
    const paid = payment.status === 'PAID';
    return (
      <div className="checkout-page checkout-page--result">
        <Result
          status={paid ? 'success' : 'info'}
          title={paid ? t('pages.checkout.paidTitle') : t('pages.checkout.pendingTitle')}
          subTitle={t('pages.checkout.resultSubtitle', { orderNo: createdOrder.orderNo || createdOrder.id, amount: formatMoney(createdOrder.totalAmount) })}
          extra={[
            !paid && (payment.paymentUrl || paymentSimulationEnabled) && (
              <Button type="primary" key="pay" loading={paying} onClick={payment.paymentUrl ? openPaymentUrl : simulatePay}>
                {payment.paymentUrl ? t('pages.checkout.openPayment') : t('pages.checkout.simulatePay')}
              </Button>
            ),
            !paid && paymentSimulationEnabled && (
              <Button key="callback" loading={simulatingCallback} onClick={simulateCallback}>
                {t('pages.checkout.simulateCallback')}
              </Button>
            ),
            <Button key="profile" onClick={() => navigate('/profile?tab=orders')}>{t('pages.checkout.viewOrder')}</Button>,
            <Button key="track" onClick={() => navigate('/track-order')}>{t('pages.orderTracking.title')}</Button>,
            <Button key="home" onClick={() => navigate('/')}>{t('pages.checkout.backHome')}</Button>,
          ].filter(Boolean)}
        />
        <Card title={t('pages.checkout.paymentCard')}>
          <Space direction="vertical">
            <Text>{t('pages.checkout.channel')}: {paymentMethodLabel(payment.channel, t)}</Text>
            {createdOrder.originalAmount ? <Text>{t('common.subtotal')}: {formatMoney(createdOrder.originalAmount)}</Text> : null}
            {createdOrder.discountAmount && createdOrder.discountAmount > 0 ? <Text>{t('pages.checkout.coupon')}: -{formatMoney(createdOrder.discountAmount)} {createdOrder.couponName ? `(${createdOrder.couponName})` : ''}</Text> : null}
            <Text>{t('pages.checkout.shippingFee')}: {formatMoney(createdOrder.shippingFee)}</Text>
            <Text>{t('pages.checkout.paymentStatus')}: <Tag color={paid ? 'green' : 'orange'}>{t(`status.${payment.status}`)}</Tag></Text>
            <Text className="checkout-page__paymentUrl">{t('pages.checkout.paymentLink')}: {payment.paymentUrl || '-'}</Text>
            {payment.expiresAt && <Text>{t('pages.checkout.paymentExpiresAt')}: {new Date(payment.expiresAt).toLocaleString()}</Text>}
            {payment.transactionId && <Text>{t('pages.checkout.transactionId')}: {payment.transactionId}</Text>}
          </Space>
        </Card>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="checkout-page checkout-page--empty">
        <Empty description={t('pages.checkout.emptySelected')} />
        <Button type="primary" style={{ marginTop: 16 }} onClick={() => navigate('/cart')}>{t('pages.checkout.backCart')}</Button>
      </div>
    );
  }

  return (
    <div className="checkout-page">
      <Title level={2}>{t('pages.checkout.title')}</Title>

      <Card title={t('pages.checkout.expressCheckout')} style={{ marginBottom: 16 }}>
        <div className="checkout-page__paymentGrid">
          {mexicoPaymentMethodDetails.map((method) => (
            <button
              type="button"
              key={method.value}
              className="checkout-page__paymentMethod"
              onClick={() => form.setFieldsValue({ paymentMethod: method.value })}
            >
              <span className="checkout-page__paymentMethodTop">
                <strong>{method.title}</strong>
                <Tag color={method.value === 'OXXO' ? 'orange' : method.value === 'SPEI' ? 'blue' : 'green'}>{t(method.badgeKey)}</Tag>
              </span>
              <span>{t(method.descriptionKey)}</span>
            </button>
          ))}
        </div>
        <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
          {t('pages.checkout.expressHint')}
        </Text>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <Text strong>
          {freeShippingRemaining > 0
            ? t('pages.cart.freeShippingRemaining', { amount: formatMoney(freeShippingRemaining) })
            : t('pages.cart.freeShippingUnlocked')}
        </Text>
        <div style={{ marginTop: 8 }}>
          <Spin spinning={false}>
            <div style={{ height: 8, background: '#edf0ed', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${freeShippingPercent}%`, height: '100%', background: '#124734' }} />
            </div>
          </Spin>
        </div>
      </Card>

      <Card title={t('pages.checkout.itemList')} style={{ marginBottom: 16 }} className="checkout-page__itemsCard">
        <List
          dataSource={cartItems}
          renderItem={(item) => (
            <List.Item className="checkout-page__item">
              <List.Item.Meta
                avatar={
                  <img
                    src={resolveCheckoutImage(item.imageUrl)}
                    alt={item.productName}
                    className="checkout-page__itemImage"
                    onError={(event) => {
                      if (event.currentTarget.src !== checkoutImageFallback) {
                        event.currentTarget.src = checkoutImageFallback;
                      }
                    }}
                  />
                }
                title={item.productName}
                description={
                  <Space direction="vertical" size={0}>
                    {item.selectedSpecs ? <Text type="secondary">{formatSelectedSpecs(item.selectedSpecs, t)}</Text> : null}
                    <Text type="secondary">{formatMoney(item.price)} x {item.quantity}</Text>
                  </Space>
                }
              />
              <Text strong className="checkout-page__itemTotal">{formatMoney(item.price * item.quantity)}</Text>
            </List.Item>
          )}
        />
        <Divider />
        <div className="checkout-page__summaryLine">
          <Text>{t('pages.checkout.itemSummary', { count: cartItems.reduce((sum, item) => sum + item.quantity, 0) })}</Text>
          <Text strong className="checkout-page__summaryTotal"> {formatMoney(cartTotal)}</Text>
        </div>
      </Card>

      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        {isGuestCheckout ? (
          <Card title={t('pages.checkout.contact')} style={{ marginBottom: 16 }}>
            <Form.Item name="guestEmail" label={t('pages.checkout.email')} rules={[{ required: true, message: t('pages.checkout.emailRequired') }, { type: 'email', message: t('pages.checkout.emailInvalid') }]}>
              <Input placeholder="you@example.com" autoComplete="email" />
            </Form.Item>
            <Text type="secondary">{t('pages.checkout.guestHint')}</Text>
          </Card>
        ) : null}

        <Card title={t('pages.checkout.address')} style={{ marginBottom: 16 }}>
          {addresses.length > 0 && (
            <Radio.Group value={selectedAddressId} onChange={(e) => setSelectedAddressId(e.target.value)} style={{ width: '100%', marginBottom: 16 }}>
              {addresses.map((address) => (
                <Radio key={address.id} value={address.id} style={{ display: 'block', marginBottom: 8, padding: '8px 12px', border: selectedAddressId === address.id ? '2px solid #ee4d2d' : '1px solid #f0f0f0', borderRadius: 6, width: '100%' }}>
                  <Space>
                    <Text strong>{address.recipientName}</Text>
                    <Text type="secondary">{address.phone}</Text>
                    {address.isDefault && <Tag color="orange">{t('pages.checkout.defaultAddress')}</Tag>}
                  </Space>
                  <div style={{ marginTop: 4, color: '#666' }}>{address.address}</div>
                </Radio>
              ))}
              <Radio value="new" style={{ display: 'block', padding: '8px 12px', border: selectedAddressId === 'new' ? '2px solid #ee4d2d' : '1px solid #f0f0f0', borderRadius: 6, width: '100%' }}>
                <Text strong>{t('pages.checkout.useNewAddress')}</Text>
              </Radio>
            </Radio.Group>
          )}

          {(selectedAddressId === 'new' || addresses.length === 0) && (
            <>
              <Form.Item name="recipientName" label={t('pages.checkout.recipient')} rules={[{ required: true, message: t('pages.checkout.recipientRequired') }]}>
                <Input placeholder={t('pages.checkout.recipientRequired')} />
              </Form.Item>
              <Form.Item name="phone" label={t('pages.profile.phone')} rules={[{ required: true, message: t('pages.checkout.phoneRequired') }]}>
                <Input placeholder={t('pages.checkout.phoneRequired')} />
              </Form.Item>
              <Form.Item name="region" label={t('pages.checkout.region')} rules={[{ required: true, message: t('pages.checkout.regionRequired') }]}>
                <Cascader options={regionData} placeholder={t('pages.checkout.regionPlaceholder')} showSearch />
              </Form.Item>
              <Form.Item name="shippingAddress" label={t('pages.checkout.detailAddress')} rules={[{ required: true, message: t('pages.checkout.detailRequired') }]}>
                <Input.TextArea rows={2} placeholder={t('pages.checkout.detailPlaceholder')} />
              </Form.Item>
            </>
          )}
        </Card>

        {!isGuestCheckout ? <Card title={t('pages.checkout.coupon')} style={{ marginBottom: 16 }}>
          <Select
            allowClear
            style={{ width: '100%' }}
            placeholder={t('pages.checkout.selectCoupon')}
            value={selectedUserCouponId ?? undefined}
            onChange={(value) => setSelectedUserCouponId(value ?? null)}
            options={(couponQuote?.availableCoupons || []).map((coupon) => {
              const couponDiscount = calculateCouponDiscount(coupon);
              return {
                value: coupon.id,
                label: couponDiscount > 0
                  ? `${describeCoupon(coupon)} - ${t('pages.checkout.couponSaveAmount', { amount: formatMoney(couponDiscount) })}`
                  : describeCoupon(coupon),
                disabled: couponDiscount <= 0,
              };
            })}
            notFoundContent={t('pages.checkout.noValidCoupons')}
          />
          {selectedCoupon && discountAmount > 0 ? (
            <Alert
              type="success"
              showIcon
              style={{ marginTop: 12 }}
              message={t('pages.checkout.couponAutoApplied', { name: selectedCoupon.couponName })}
              description={t('pages.checkout.couponSavings', { amount: formatMoney(discountAmount) })}
            />
          ) : null}
          {couponQuote && couponQuote.availableCoupons.length > 0 && !couponQuote.availableCoupons.some((coupon) => calculateCouponDiscount(coupon) > 0) ? (
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">{t('pages.checkout.couponRulesNotMet')}</Text>
            </div>
          ) : null}
          <div style={{ marginTop: 12, textAlign: 'right' }}>
            <div><Text>{t('common.subtotal')}: {formatMoney(cartTotal)}</Text></div>
            {discountAmount > 0 ? <div><Text type="success">{t('pages.checkout.couponDiscount')}: -{formatMoney(discountAmount)}</Text></div> : null}
            <div><Text>{t('pages.checkout.shippingFee')}: {formatMoney(shippingFee)}</Text></div>
            <div><Text strong style={{ color: '#ee4d2d', fontSize: 22 }}>{t('pages.checkout.payable')}: {formatMoney(payableAmount)}</Text></div>
          </div>
        </Card> : (
          <Card title={t('pages.checkout.orderSummary')} style={{ marginBottom: 16 }}>
            <div style={{ textAlign: 'right' }}>
              <div><Text>{t('common.subtotal')}: {formatMoney(cartTotal)}</Text></div>
              <div><Text>{t('pages.checkout.shippingFee')}: {formatMoney(shippingFee)}</Text></div>
              <div><Text strong style={{ color: '#ee4d2d', fontSize: 22 }}>{t('pages.checkout.payable')}: {formatMoney(payableAmount)}</Text></div>
            </div>
          </Card>
        )}

        <Card title={t('pages.payment.title')}>
          <Form.Item name="paymentMethod" label={t('pages.checkout.paymentMethod')} initialValue="STRIPE" rules={[{ required: true, message: t('pages.checkout.paymentRequired') }]}>
            <Select options={paymentOptions} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={submitting} block size="large">
              {t('pages.checkout.submit')}
            </Button>
          </Form.Item>
        </Card>
      </Form>
    </div>
  );
};

export default Checkout;
