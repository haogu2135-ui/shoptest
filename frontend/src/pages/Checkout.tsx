import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Cascader, Divider, Empty, Form, Input, List, message, Modal, Progress, Radio, Result, Select, Space, Spin, Tag, Typography } from 'antd';
import { CheckCircleOutlined, CustomerServiceOutlined, GiftOutlined, SafetyCertificateOutlined, SwapOutlined, TruckOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { addressApi, apiBaseUrl, appConfigApi, cartApi, couponApi, orderApi, paymentApi } from '../api';
import type { CartItem, CouponQuote, Order, Payment, PaymentChannel, Product, UserAddress, UserCoupon } from '../types';
import { regionData } from '../regionData';
import { useLanguage } from '../i18n';
import { createPaymentMethodDetails, createPaymentMethodOptions, fallbackPaymentChannels, paymentMethodLabel, paymentSimulationEnabledFallback } from '../utils/paymentMethods';
import { useMarket } from '../hooks/useMarket';
import { formatSelectedSpecs } from '../utils/selectedSpecs';
import { addGuestCartItem, getGuestCartItems, removeGuestCartItems } from '../utils/guestCart';
import { navigateToSafeUrl } from '../utils/safeUrl';
import { conversionConfig, getDeliveryPromise, getLowStockCount } from '../utils/conversionConfig';
import { getGiftThreshold, getNearestCartBenefitTarget } from '../utils/cartBenefits';
import { clearCheckoutCartItemIds, readCheckoutCartItemIds, syncCheckoutCartItemIds } from '../utils/cartSession';
import AddOnAssistant from '../components/AddOnAssistant';
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
const getCartItemLowStockCount = (item: CartItem) => getLowStockCount(item.stock, item.quantity);
const areSameIds = (left: number[], right: number[]) =>
  left.length === right.length && left.every((id, index) => id === right[index]);
const estimateCouponDiscount = (coupon: UserCoupon, cartTotal: number) => {
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

const findBestCoupon = (coupons: UserCoupon[], cartTotal: number) =>
  coupons
    .map((coupon) => ({ coupon, discount: estimateCouponDiscount(coupon, cartTotal) }))
    .filter((item) => item.discount > 0)
    .sort((left, right) => right.discount - left.discount || Number(left.coupon.thresholdAmount || 0) - Number(right.coupon.thresholdAmount || 0))[0] || null;

const getRecommendedPaymentMethod = (channels: PaymentChannel[], currency: string) => {
  const backendRecommended = channels.find((channel) => channel.recommended)?.code;
  if (backendRecommended) {
    return backendRecommended;
  }
  if (!conversionConfig.paymentRecommendation.enabled) return null;
  const preferredCodes = conversionConfig.paymentRecommendation.byCurrency[
    currency as keyof typeof conversionConfig.paymentRecommendation.byCurrency
  ] || conversionConfig.paymentRecommendation.fallback;
  return preferredCodes.find((code) => channels.some((channel) => channel.code === code)) || channels[0]?.code || null;
};

const resolveCheckoutPaymentMethod = (
  candidate: string | null | undefined,
  channels: PaymentChannel[],
  currency: string,
) => {
  if (candidate && channels.some((channel) => channel.code === candidate)) {
    return candidate;
  }
  return getRecommendedPaymentMethod(channels, currency) || channels[0]?.code || 'STRIPE';
};

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
  const [paymentChannels, setPaymentChannels] = useState<PaymentChannel[]>(fallbackPaymentChannels);
  const [giftCelebrationOpen, setGiftCelebrationOpen] = useState(false);
  const [giftCelebrated, setGiftCelebrated] = useState(false);
  const [simulatingCallback, setSimulatingCallback] = useState(false);
  const [couponQuote, setCouponQuote] = useState<CouponQuote | null>(null);
  const [selectedUserCouponId, setSelectedUserCouponId] = useState<number | null>(null);
  const [couponManuallyChanged, setCouponManuallyChanged] = useState(false);
  const [supportPanelOpen, setSupportPanelOpen] = useState(false);
  const { t } = useLanguage();
  const watchedPaymentMethod = Form.useWatch('paymentMethod', form);
  const watchedRecipientName = Form.useWatch('recipientName', form);
  const watchedPhone = Form.useWatch('phone', form);
  const watchedShippingAddress = Form.useWatch('shippingAddress', form);
  const paymentOptions = useMemo(() => createPaymentMethodOptions(t, paymentChannels), [paymentChannels, t]);
  const paymentMethodDetails = useMemo(() => createPaymentMethodDetails(paymentChannels), [paymentChannels]);
  const { currency, market, formatMoney } = useMarket();
  const isGuestCheckout = !localStorage.getItem('token') || !localStorage.getItem('userId');
  const recommendedPaymentMethod = useMemo(
    () => getRecommendedPaymentMethod(paymentChannels, currency),
    [currency, paymentChannels],
  );

  useEffect(() => {
    Promise.all([
      appConfigApi.get().then((res) => setPaymentSimulationEnabled(Boolean(res.data.paymentSimulationEnabled))),
      paymentApi.getChannels().then((res) => {
        const channels = res.data.length > 0 ? res.data : fallbackPaymentChannels;
        setPaymentChannels(channels);
        const current = form.getFieldValue('paymentMethod');
        const rememberedMethod = sessionStorage.getItem('checkoutPaymentMethod');
        const bootstrapCandidate = rememberedMethod || (current && current !== 'STRIPE' ? current : null);
        const nextMethod = resolveCheckoutPaymentMethod(bootstrapCandidate, channels, currency);
        if (nextMethod && nextMethod !== current) {
          form.setFieldsValue({ paymentMethod: nextMethod });
        }
      }),
    ]).catch(() => {
      setPaymentSimulationEnabled(paymentSimulationEnabledFallback);
      setPaymentChannels(fallbackPaymentChannels);
      const current = form.getFieldValue('paymentMethod');
      const nextMethod = resolveCheckoutPaymentMethod(sessionStorage.getItem('checkoutPaymentMethod'), fallbackPaymentChannels, currency);
      if (nextMethod && nextMethod !== current) {
        form.setFieldsValue({ paymentMethod: nextMethod });
      }
    });
  }, [currency, form]);

  const selectedCartItemIds = useMemo(() => {
    return readCheckoutCartItemIds();
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    if (!token || !userId) {
      const guestItems = getGuestCartItems().filter((item) => selectedCartItemIds.length === 0 || selectedCartItemIds.includes(item.id));
      const purchasableItems = guestItems.filter(isPurchasable);
      const purchasableIds = purchasableItems.map((item) => item.id);
      if (purchasableItems.length !== guestItems.length || (selectedCartItemIds.length > 0 && !areSameIds(selectedCartItemIds, purchasableIds))) {
        message.warning(t('pages.checkout.unavailableSelected'));
        syncCheckoutCartItemIds(purchasableItems);
      }
      setCartItems(purchasableItems);
      setAddresses([]);
      const preferredPaymentMethod = sessionStorage.getItem('checkoutPaymentMethod');
      if (preferredPaymentMethod) {
        form.setFieldsValue({ paymentMethod: resolveCheckoutPaymentMethod(preferredPaymentMethod, paymentChannels, currency) });
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
        const purchasableIds = purchasableItems.map((item) => item.id);
        if (purchasableItems.length !== selectedItems.length || (selectedCartItemIds.length > 0 && !areSameIds(selectedCartItemIds, purchasableIds))) {
          message.warning(t('pages.checkout.unavailableSelected'));
          syncCheckoutCartItemIds(purchasableItems);
        }
        setCartItems(purchasableItems);
        setAddresses(addressRes.data);
        const defaultAddress = addressRes.data.find((address) => address.isDefault) || addressRes.data[0];
        if (defaultAddress) setSelectedAddressId(defaultAddress.id);
        const preferredPaymentMethod = sessionStorage.getItem('checkoutPaymentMethod');
        if (preferredPaymentMethod) {
          form.setFieldsValue({ paymentMethod: resolveCheckoutPaymentMethod(preferredPaymentMethod, paymentChannels, currency) });
        }
      } catch {
        message.error(t('pages.checkout.loadFailed'));
      } finally {
        setLoading(false);
      }
    };

    loadCheckout();
  }, [currency, form, paymentChannels, selectedCartItemIds, t]);

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
        if (!selectedUserCouponId && !couponManuallyChanged) {
          const bestCoupon = conversionConfig.checkout.autoSelectBestCoupon
            ? findBestCoupon(res.data.availableCoupons || [], cartTotal)?.coupon
            : null;
          const nextCouponId = bestCoupon?.id || res.data.selectedUserCouponId;
          if (nextCouponId) {
            setSelectedUserCouponId(nextCouponId);
          }
        }
      })
      .catch((error) => {
        if (selectedUserCouponId) {
          message.error(error?.response?.data?.error || t('pages.checkout.couponUnavailable'));
          setSelectedUserCouponId(null);
        }
      });
  }, [cartItems, cartTotal, couponManuallyChanged, selectedUserCouponId, t]);

  const guestShippingFee = cartTotal >= market.freeShippingThreshold ? 0 : 30;
  const shippingFee = couponQuote?.shippingFee ?? (isGuestCheckout ? guestShippingFee : 0);
  const payableAmount = couponQuote?.payableAmount ?? (cartTotal + shippingFee);
  const discountAmount = couponQuote?.discountAmount ?? 0;
  const selectedCoupon = useMemo(
    () => couponQuote?.availableCoupons.find((coupon) => coupon.id === selectedUserCouponId),
    [couponQuote?.availableCoupons, selectedUserCouponId],
  );
  const bestCouponCandidate = useMemo(
    () => findBestCoupon(couponQuote?.availableCoupons || [], cartTotal),
    [cartTotal, couponQuote?.availableCoupons],
  );
  const selectedIsBestCoupon = Boolean(
    selectedUserCouponId && bestCouponCandidate?.coupon.id === selectedUserCouponId,
  );
  const freeShippingRemaining = Math.max(0, market.freeShippingThreshold - cartTotal);
  const freeShippingPercent = market.freeShippingThreshold > 0
    ? Math.min(100, Math.round((cartTotal / market.freeShippingThreshold) * 100))
    : 100;
  const deliveryPromise = useMemo(
    () => getDeliveryPromise({ currency, locale: market.locale }),
    [currency, market.locale],
  );
  const giftThreshold = getGiftThreshold(currency);
  const giftRemaining = Math.max(0, giftThreshold - cartTotal);
  const giftUnlocked = giftThreshold > 0 && giftRemaining <= 0;
  const giftProgress = giftThreshold > 0 ? Math.min(100, Math.round((cartTotal / giftThreshold) * 100)) : 100;
  const addOnTarget = useMemo(
    () => getNearestCartBenefitTarget(cartTotal, market.freeShippingThreshold, currency),
    [cartTotal, currency, market.freeShippingThreshold],
  );
  const nextCouponUnlock = useMemo(() => {
    if (!couponQuote?.availableCoupons?.length) return null;
    return couponQuote.availableCoupons
      .map((coupon) => {
        const threshold = Number(coupon.thresholdAmount || 0);
        const gap = Math.max(0, threshold - cartTotal);
        const estimatedValue = coupon.couponType === 'FULL_REDUCTION'
          ? Number(coupon.reductionAmount || 0)
          : Math.min(
            Number(coupon.maxDiscountAmount || 0) || threshold,
            threshold * (100 - Number(coupon.discountPercent || 100)) / 100,
          );
        return { coupon, gap, estimatedValue };
      })
      .filter((item) => item.gap > 0 && item.estimatedValue > 0)
      .sort((left, right) => left.gap - right.gap || right.estimatedValue - left.estimatedValue)[0] || null;
  }, [cartTotal, couponQuote?.availableCoupons]);
  const couponOpportunity = useMemo(() => {
    if (isGuestCheckout || !couponQuote?.availableCoupons?.length) return null;
    if (selectedCoupon && discountAmount > 0) {
      return {
        type: 'ready' as const,
        title: selectedIsBestCoupon
          ? t('pages.checkout.couponOpportunityBestTitle')
          : t('pages.checkout.couponOpportunityAppliedTitle'),
        text: t('pages.checkout.couponOpportunityAppliedText', {
          name: selectedCoupon.couponName,
          amount: formatMoney(discountAmount),
        }),
        action: t('pages.checkout.couponOpportunityReview'),
      };
    }
    if (nextCouponUnlock) {
      return {
        type: 'build' as const,
        title: t('pages.checkout.couponOpportunityBuildTitle'),
        text: t('pages.checkout.couponOpportunityBuildText', {
          amount: formatMoney(nextCouponUnlock.gap),
          value: formatMoney(nextCouponUnlock.estimatedValue),
        }),
        action: addOnTarget
          ? t('pages.checkout.savingsShopAddOns')
          : t('pages.checkout.couponOpportunityReview'),
      };
    }
    return null;
  }, [addOnTarget, couponQuote?.availableCoupons?.length, discountAmount, formatMoney, isGuestCheckout, nextCouponUnlock, selectedCoupon, selectedIsBestCoupon, t]);
  const savingsCoachItems = [
    {
      key: 'shipping',
      icon: <TruckOutlined />,
      ready: freeShippingRemaining <= 0,
      title: t('pages.checkout.savingsFreeShippingTitle'),
      text: freeShippingRemaining <= 0
        ? t('pages.checkout.savingsFreeShippingUnlocked')
        : t('pages.checkout.savingsFreeShippingText', { amount: formatMoney(freeShippingRemaining) }),
    },
    conversionConfig.giftAtCheckout.enabled ? {
      key: 'gift',
      icon: <GiftOutlined />,
      ready: giftUnlocked,
      title: t('pages.checkout.savingsGiftTitle'),
      text: giftUnlocked
        ? t('pages.checkout.savingsGiftUnlocked', { gift: t(conversionConfig.giftAtCheckout.giftNameKey) })
        : t('pages.checkout.savingsGiftText', { amount: formatMoney(giftRemaining), gift: t(conversionConfig.giftAtCheckout.giftNameKey) }),
    } : null,
    !isGuestCheckout ? {
      key: 'coupon',
      icon: <SafetyCertificateOutlined />,
      ready: discountAmount > 0,
      title: t('pages.checkout.savingsCouponTitle'),
      text: discountAmount > 0
        ? t('pages.checkout.savingsCouponReady', { amount: formatMoney(discountAmount) })
        : nextCouponUnlock
          ? t('pages.checkout.savingsCouponGap', {
            amount: formatMoney(nextCouponUnlock.gap),
            value: formatMoney(nextCouponUnlock.estimatedValue),
          })
          : t('pages.checkout.savingsCouponEmpty'),
    } : null,
  ].filter(Boolean) as Array<{ key: string; icon: React.ReactNode; ready: boolean; title: string; text: string }>;
  const selectedAddress = selectedAddressId === 'new' ? null : addresses.find((address) => address.id === selectedAddressId) || null;
  const newAddressReady = Boolean(watchedRecipientName && watchedPhone && watchedShippingAddress);
  const selectedAddressReady = selectedAddressId === 'new'
    ? newAddressReady
    : Boolean(selectedAddress?.recipientName && selectedAddress?.phone && selectedAddress?.address);
  const selectedPaymentDetail = paymentMethodDetails.find((method) => method.value === watchedPaymentMethod);
  const checkoutReadinessItems = [
    {
      key: 'items',
      ready: cartItems.length > 0,
      label: t('pages.checkout.readinessItems'),
      text: t('pages.checkout.readinessItemsText', { count: cartItems.reduce((sum, item) => sum + item.quantity, 0) }),
    },
    {
      key: 'address',
      ready: selectedAddressReady,
      label: t('pages.checkout.readinessAddress'),
      text: selectedAddressReady
        ? t('pages.checkout.readinessAddressReady')
        : t('pages.checkout.readinessAddressNeeded'),
    },
    {
      key: 'payment',
      ready: Boolean(watchedPaymentMethod || recommendedPaymentMethod),
      label: t('pages.checkout.readinessPayment'),
      text: selectedPaymentDetail
        ? t('pages.checkout.readinessPaymentSelected', { method: selectedPaymentDetail.title })
        : t('pages.checkout.readinessPaymentNeeded'),
    },
    {
      key: 'savings',
      ready: freeShippingRemaining <= 0 || discountAmount > 0 || giftUnlocked,
      label: t('pages.checkout.readinessSavings'),
      text: freeShippingRemaining <= 0
        ? t('pages.checkout.readinessFreeShippingReady')
        : t('pages.checkout.readinessFreeShippingGap', { amount: formatMoney(freeShippingRemaining) }),
    },
  ];
  const checkoutReadinessScore = Math.round((checkoutReadinessItems.filter((item) => item.ready).length / checkoutReadinessItems.length) * 100);
  const checkoutNextAction = checkoutReadinessItems.find((item) => !item.ready) || null;
  const needsCheckoutSupport = Boolean(addOnTarget || couponOpportunity || checkoutNextAction);
  useEffect(() => {
    if (needsCheckoutSupport) {
      setSupportPanelOpen(true);
    }
  }, [needsCheckoutSupport]);
  const scrollToAddOns = useCallback(() => {
    document.getElementById('checkout-add-on-assistant')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);
  const handleCheckoutNextAction = () => {
    if (!checkoutNextAction) {
      window.dispatchEvent(new Event('shop:open-support'));
      return;
    }
    if (checkoutNextAction.key === 'items') {
      navigate('/cart');
      return;
    }
    if (checkoutNextAction.key === 'address') {
      document.getElementById('checkout-address-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (checkoutNextAction.key === 'payment') {
      document.getElementById('checkout-payment-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (checkoutNextAction.key === 'savings') {
      if (addOnTarget) {
        scrollToAddOns();
        return;
      }
      document.getElementById('checkout-coupon-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
  const handleCouponOpportunityAction = () => {
    if (couponOpportunity?.type === 'build' && addOnTarget) {
      scrollToAddOns();
      return;
    }
    document.getElementById('checkout-coupon-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const checkoutNextActionLabel = !checkoutNextAction
    ? t('pages.checkout.nextActionSupport')
    : checkoutNextAction.key === 'items'
      ? t('pages.checkout.nextActionReviewCart')
      : checkoutNextAction.key === 'address'
        ? t('pages.checkout.nextActionAddress')
        : checkoutNextAction.key === 'payment'
          ? t('pages.checkout.nextActionPayment')
          : t('pages.checkout.nextActionSavings');

  useEffect(() => {
    if (!giftUnlocked || giftCelebrated) return;
    setGiftCelebrationOpen(true);
    setGiftCelebrated(true);
  }, [giftCelebrated, giftUnlocked]);

  const calculateCouponDiscount = (coupon: UserCoupon) => {
    return estimateCouponDiscount(coupon, cartTotal);
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

  const addSuggestedProduct = async (product: Product) => {
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    if (token && userId) {
      await cartApi.addItem(Number(userId), product.id, 1);
      const response = await cartApi.getItems(Number(userId));
      const purchasableItems = response.data.filter(isPurchasable);
      setCartItems(purchasableItems);
      syncCheckoutCartItemIds(purchasableItems);
      window.dispatchEvent(new Event('shop:cart-updated'));
      return;
    }
    addGuestCartItem(product, 1);
    const nextItems = getGuestCartItems().filter(isPurchasable);
    setCartItems(nextItems);
    syncCheckoutCartItemIds(nextItems);
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
      clearCheckoutCartItemIds();
      sessionStorage.removeItem('checkoutPaymentMethod');
      if (!token || !userId) {
        removeGuestCartItems(cartItems.map((item) => item.id));
      } else {
        window.dispatchEvent(new Event('shop:cart-updated'));
      }
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

      <div className="checkout-page__trustBar" aria-label={t('pages.checkout.trustTitle')}>
        <div className="checkout-page__trustItem">
          <SafetyCertificateOutlined />
          <div>
            <Text strong>{t('pages.checkout.trustSecureTitle')}</Text>
            <Text type="secondary">{t('pages.checkout.trustSecureText')}</Text>
          </div>
        </div>
        <div className="checkout-page__trustItem">
          <SwapOutlined />
          <div>
            <Text strong>{t('pages.checkout.trustReturnsTitle')}</Text>
            <Text type="secondary">{t('pages.checkout.trustReturnsText')}</Text>
          </div>
        </div>
        <div className="checkout-page__trustItem">
          <CustomerServiceOutlined />
          <div>
            <Text strong>{t('pages.checkout.trustSupportTitle')}</Text>
            <Text type="secondary">{t('pages.checkout.trustSupportText')}</Text>
          </div>
        </div>
      </div>

      <Card title={t('pages.checkout.expressCheckout')} style={{ marginBottom: 16 }}>
        <Form form={form} component={false}>
          <Form.Item noStyle shouldUpdate={(prev, next) => prev.paymentMethod !== next.paymentMethod}>
            {({ getFieldValue }) => {
              const selectedPaymentMethod = getFieldValue('paymentMethod');
              return (
        <div className="checkout-page__paymentGrid">
          {paymentMethodDetails.map((method) => (
            <button
              type="button"
              key={method.value}
              className={`checkout-page__paymentMethod${selectedPaymentMethod === method.value ? ' checkout-page__paymentMethod--selected' : ''}`}
              onClick={() => form.setFieldsValue({ paymentMethod: method.value })}
            >
              <span className="checkout-page__paymentMethodTop">
                <strong>{method.title}</strong>
                <span className="checkout-page__paymentBadges">
                  {recommendedPaymentMethod === method.value ? <Tag color="gold">{t('pages.checkout.recommendedPayment')}</Tag> : null}
                  <Tag color={method.market === 'CN' ? 'red' : method.value === 'OXXO' ? 'orange' : method.value === 'SPEI' ? 'blue' : 'green'}>{t(method.badgeKey)}</Tag>
                </span>
              </span>
              <span>{t(method.descriptionKey)}</span>
            </button>
          ))}
        </div>
              );
            }}
          </Form.Item>
        </Form>
        <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
          {t('pages.checkout.expressHint')}
        </Text>
      </Card>

      <Card className="checkout-page__benefitStrip">
        <div className="checkout-page__benefitItem">
          <span className="checkout-page__benefitIcon"><TruckOutlined /></span>
          <div>
            <Text strong>
              {freeShippingRemaining > 0
                ? t('pages.cart.freeShippingRemaining', { amount: formatMoney(freeShippingRemaining) })
                : t('pages.cart.freeShippingUnlocked')}
            </Text>
            <Progress percent={freeShippingPercent} showInfo={false} strokeColor="#124734" trailColor="#edf0ed" />
          </div>
        </div>
        {deliveryPromise.enabled ? (
          <div className="checkout-page__benefitItem">
            <span className="checkout-page__benefitIcon"><SafetyCertificateOutlined /></span>
            <div>
              <Text strong>{t('pages.checkout.deliveryPromise', { window: deliveryPromise.windowText })}</Text>
              <Text type="secondary">
                {deliveryPromise.shipsToday
                  ? t('pages.checkout.shipsToday', { cutoff: `${deliveryPromise.cutoffHour}:00` })
                  : t('pages.checkout.shipsNextBusinessDay')}
              </Text>
            </div>
          </div>
        ) : null}
        {conversionConfig.giftAtCheckout.enabled ? (
          <div className={giftUnlocked ? 'checkout-page__benefitItem checkout-page__benefitItem--ready' : 'checkout-page__benefitItem'}>
            <span className="checkout-page__benefitIcon">{giftUnlocked ? <CheckCircleOutlined /> : <GiftOutlined />}</span>
            <div>
              <Text strong>
                {giftUnlocked
                  ? t('pages.checkout.giftUnlocked', { gift: t(conversionConfig.giftAtCheckout.giftNameKey) })
                  : t('pages.checkout.giftRemaining', { amount: formatMoney(giftRemaining), gift: t(conversionConfig.giftAtCheckout.giftNameKey) })}
              </Text>
              <Progress percent={giftProgress} showInfo={false} strokeColor={giftUnlocked ? '#124734' : '#ffb84d'} trailColor="#edf0ed" />
            </div>
          </div>
        ) : null}
      </Card>

      <Modal
        open={giftCelebrationOpen}
        title={t('pages.checkout.giftModalTitle')}
        onCancel={() => setGiftCelebrationOpen(false)}
        footer={<Button type="primary" onClick={() => setGiftCelebrationOpen(false)}>{t('common.confirm')}</Button>}
      >
        <Space align="start" className="checkout-page__giftModal">
          <span className="checkout-page__giftIcon"><GiftOutlined /></span>
          <Text>{t('pages.checkout.giftModalText', { gift: t(conversionConfig.giftAtCheckout.giftNameKey) })}</Text>
        </Space>
      </Modal>

      <details
        className="checkout-page__supportPanel"
        open={supportPanelOpen}
        onToggle={(event) => setSupportPanelOpen(event.currentTarget.open)}
      >
        <summary>
          <span>
            <Text strong>{t('pages.checkout.savingsCoachTitle')}</Text>
            <Text type="secondary">{t('pages.checkout.savingsCoachSubtitle')}</Text>
          </span>
          <Tag color={checkoutNextAction ? 'orange' : 'green'}>{checkoutReadinessScore}%</Tag>
        </summary>

        {addOnTarget ? (
          <div id="checkout-add-on-assistant">
            <AddOnAssistant
              cartProductIds={cartItems.map((item) => item.productId)}
              remainingAmount={addOnTarget.remainingAmount}
              reason={addOnTarget.reason}
              onAdd={addSuggestedProduct}
            />
          </div>
        ) : null}

        <Card className="checkout-page__savingsCoach">
          <div className="checkout-page__savingsCoachHeader">
            <div>
              <Text type="secondary">{t('pages.checkout.savingsCoachEyebrow')}</Text>
              <Text strong>{t('pages.checkout.savingsCoachTitle')}</Text>
              <Text type="secondary">{t('pages.checkout.savingsCoachSubtitle')}</Text>
            </div>
            {addOnTarget ? (
              <Button size="small" onClick={scrollToAddOns}>
                {t('pages.checkout.savingsShopAddOns')}
              </Button>
            ) : null}
          </div>
          <div className="checkout-page__savingsCoachGrid">
            {savingsCoachItems.map((item) => (
              <div className={item.ready ? 'checkout-page__savingsCoachItem checkout-page__savingsCoachItem--ready' : 'checkout-page__savingsCoachItem'} key={item.key}>
                <span className="checkout-page__savingsCoachIcon">{item.ready ? <CheckCircleOutlined /> : item.icon}</span>
                <span>
                  <Text strong>{item.title}</Text>
                  <Text type="secondary">{item.text}</Text>
                </span>
              </div>
            ))}
          </div>
        </Card>

        {couponOpportunity ? (
          <Card className={couponOpportunity.type === 'ready' ? 'checkout-page__couponOpportunity checkout-page__couponOpportunity--ready' : 'checkout-page__couponOpportunity'}>
            <div>
              <Text strong>{couponOpportunity.title}</Text>
              <Text type="secondary">{couponOpportunity.text}</Text>
            </div>
            <Button size="small" type={couponOpportunity.type === 'ready' ? 'default' : 'primary'} onClick={handleCouponOpportunityAction}>
              {couponOpportunity.action}
            </Button>
          </Card>
        ) : null}

        <Card className="checkout-page__readiness">
          <div className="checkout-page__readinessHeader">
            <div>
              <Text type="secondary">{t('pages.checkout.readinessEyebrow')}</Text>
              <Text strong>{t('pages.checkout.readinessTitle')}</Text>
            </div>
            <Progress type="circle" percent={checkoutReadinessScore} size={64} strokeColor="#124734" />
          </div>
          <div className="checkout-page__readinessGrid">
            {checkoutReadinessItems.map((item) => (
              <div className={item.ready ? 'checkout-page__readinessItem checkout-page__readinessItem--ready' : 'checkout-page__readinessItem'} key={item.key}>
                <CheckCircleOutlined />
                <span>
                  <Text strong>{item.label}</Text>
                  <Text type="secondary">{item.text}</Text>
                </span>
              </div>
            ))}
          </div>
          <div className={checkoutNextAction ? 'checkout-page__nextAction' : 'checkout-page__nextAction checkout-page__nextAction--ready'}>
            <span>
              <Text strong>
                {checkoutNextAction
                  ? t('pages.checkout.nextActionTitle')
                  : t('pages.checkout.nextActionReadyTitle')}
              </Text>
              <Text type="secondary">
                {checkoutNextAction
                  ? checkoutNextAction.text
                  : t('pages.checkout.nextActionReadyText')}
              </Text>
            </span>
            <Button size="small" type={checkoutNextAction ? 'primary' : 'default'} onClick={handleCheckoutNextAction}>
              {checkoutNextActionLabel}
            </Button>
          </div>
        </Card>
      </details>

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
                    {getCartItemLowStockCount(item) !== null ? (
                      <Text type="warning" className="checkout-page__urgency">
                        {t('pages.cart.lowStockLeft', { count: getCartItemLowStockCount(item) ?? 0 })}
                      </Text>
                    ) : null}
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

        <Card id="checkout-address-card" title={t('pages.checkout.address')} style={{ marginBottom: 16 }}>
          {addresses.length > 0 && (
            <Radio.Group value={selectedAddressId} onChange={(e) => setSelectedAddressId(e.target.value)} style={{ width: '100%', marginBottom: 16 }}>
              {addresses.map((address) => (
                <Radio
                  key={address.id}
                  value={address.id}
                  className={selectedAddressId === address.id ? 'checkout-page__addressChoice checkout-page__addressChoice--selected' : 'checkout-page__addressChoice'}
                >
                  <Space>
                    <Text strong>{address.recipientName}</Text>
                    <Text type="secondary">{address.phone}</Text>
                    {address.isDefault && <Tag color="orange">{t('pages.checkout.defaultAddress')}</Tag>}
                  </Space>
                  <div className="checkout-page__addressText">{address.address}</div>
                </Radio>
              ))}
              <Radio
                value="new"
                className={selectedAddressId === 'new' ? 'checkout-page__addressChoice checkout-page__addressChoice--selected' : 'checkout-page__addressChoice'}
              >
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

        {!isGuestCheckout ? <Card id="checkout-coupon-card" title={t('pages.checkout.coupon')} style={{ marginBottom: 16 }}>
          <Select
            allowClear
            style={{ width: '100%' }}
            placeholder={t('pages.checkout.selectCoupon')}
            value={selectedUserCouponId ?? undefined}
            onChange={(value) => {
              setCouponManuallyChanged(true);
              setSelectedUserCouponId(value ?? null);
            }}
            options={(couponQuote?.availableCoupons || []).map((coupon) => {
              const couponDiscount = calculateCouponDiscount(coupon);
              return {
                value: coupon.id,
                label: couponDiscount > 0
                  ? `${describeCoupon(coupon)} - ${t('pages.checkout.couponSaveAmount', { amount: formatMoney(couponDiscount) })}${bestCouponCandidate?.coupon.id === coupon.id ? ` - ${t('pages.checkout.bestCoupon')}` : ''}`
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
              message={selectedIsBestCoupon
                ? t('pages.checkout.bestCouponApplied', { name: selectedCoupon.couponName })
                : t('pages.checkout.couponAutoApplied', { name: selectedCoupon.couponName })}
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
          <Card id="checkout-coupon-card" title={t('pages.checkout.orderSummary')} style={{ marginBottom: 16 }}>
            <div style={{ textAlign: 'right' }}>
              <div><Text>{t('common.subtotal')}: {formatMoney(cartTotal)}</Text></div>
              <div><Text>{t('pages.checkout.shippingFee')}: {formatMoney(shippingFee)}</Text></div>
              <div><Text strong style={{ color: '#ee4d2d', fontSize: 22 }}>{t('pages.checkout.payable')}: {formatMoney(payableAmount)}</Text></div>
            </div>
          </Card>
        )}

        <Card id="checkout-payment-card" title={t('pages.payment.title')}>
          <div className="checkout-page__paymentConfidence">
            <SafetyCertificateOutlined />
            <span>
              <Text strong>{t('pages.checkout.paymentConfidenceTitle')}</Text>
              <Text type="secondary">
                {selectedPaymentDetail
                  ? t('pages.checkout.paymentConfidenceSelected', { method: selectedPaymentDetail.title })
                  : t('pages.checkout.paymentConfidenceDefault')}
              </Text>
            </span>
          </div>
          <Form.Item name="paymentMethod" label={t('pages.checkout.paymentMethod')} rules={[{ required: true, message: t('pages.checkout.paymentRequired') }]}>
            <Select options={paymentOptions} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={submitting} block size="large">
              {t('pages.checkout.submitWithAmount', { amount: formatMoney(payableAmount) })}
            </Button>
          </Form.Item>
        </Card>
      </Form>
    </div>
  );
};

export default Checkout;
