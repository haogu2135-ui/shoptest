import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Cascader, Divider, Form, Input, List, message, Modal, Progress, Radio, Result, Select, Space, Spin, Tag, Typography } from 'antd';
import { CheckCircleOutlined, CustomerServiceOutlined, GiftOutlined, HistoryOutlined, RollbackOutlined, SafetyCertificateOutlined, ShoppingCartOutlined, ShoppingOutlined, SwapOutlined, TruckOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { addressApi, cartApi, couponApi, orderApi, paymentApi } from '../api';
import type { CartItem, CouponQuote, Order, Payment, PaymentChannel, Product, UserAddress, UserCoupon } from '../types';
import { regionData } from '../regionData';
import { useLanguage } from '../i18n';
import { createPaymentMethodDetails, paymentMethodLabel } from '../utils/paymentMethods';
import { useMarket } from '../hooks/useMarket';
import { formatSelectedSpecs } from '../utils/selectedSpecs';
import { addGuestCartItem, getGuestCartItems, removeGuestCartItems } from '../utils/guestCart';
import { navigateToSafeUrl } from '../utils/safeUrl';
import { conversionConfig, getDeliveryPromise, getLowStockCount } from '../utils/conversionConfig';
import { getGiftThreshold, getNearestCartBenefitTarget } from '../utils/cartBenefits';
import { clearCheckoutCartItemIds, readCheckoutCartItemIds, syncCheckoutCartItemIds } from '../utils/cartSession';
import { formatPaymentUrlLabel, getPaymentRecoveryState } from '../utils/paymentRecovery';
import { productImageFallback, resolveProductImage } from '../utils/productMedia';
import { getApiErrorMessage } from '../utils/apiError';
import { dispatchDomEvent } from '../utils/domEvents';
import { saveGuestSupportContext } from '../utils/guestSupportContext';
import { allSettledWithConcurrency } from '../utils/asyncBatch';
import { isAdminRole } from '../utils/roles';
import { getLocalStorageItem, getSessionStorageItem, removeLocalStorageItem, removeSessionStorageItem, setSessionStorageItem } from '../utils/safeStorage';
import AddOnAssistant from '../components/AddOnAssistant';
import { useAppConfig } from '../hooks/useAppConfig';
import './Checkout.css';

const { Text, Title } = Typography;
const checkoutImageFallback = productImageFallback;
const resolveCheckoutImage = resolveProductImage;
const mobileCheckoutQuery = '(max-width: 780px)';

const isPurchasable = (item: CartItem) =>
  (item.productStatus || 'ACTIVE') === 'ACTIVE' && (item.stock === undefined || item.stock >= item.quantity);
const getCartItemLowStockCount = (item: CartItem) => getLowStockCount(item.stock, item.quantity);
const areSameIds = (left: number[], right: number[]) => {
  const leftIds = new Set(left);
  const rightIds = new Set(right);
  return leftIds.size === rightIds.size && Array.from(leftIds).every((id) => rightIds.has(id));
};
const scrollCheckoutElementIntoView = (elementId: string, behavior: ScrollBehavior = 'smooth') => {
  const element = document.getElementById(elementId);
  if (!element) return;
  const isMobile = window.matchMedia?.(mobileCheckoutQuery).matches;
  element.scrollIntoView({ behavior, block: isMobile ? 'center' : 'start' });
};
const scrollCheckoutElementIntoMobileView = (elementId: string, behavior: ScrollBehavior = 'smooth') => {
  if (!window.matchMedia?.(mobileCheckoutQuery).matches) return;
  scrollCheckoutElementIntoView(elementId, behavior);
};
const scrollCheckoutFieldIntoMobileView = (target: EventTarget | null, fallbackElementId: string, behavior: ScrollBehavior = 'smooth') => {
  if (!window.matchMedia?.(mobileCheckoutQuery).matches) return;
  if (target instanceof HTMLElement) {
    const field = target.closest('.ant-form-item') || target.closest('.checkout-page__addressChoice') || target;
    window.setTimeout(() => {
      field.scrollIntoView({ behavior, block: 'center', inline: 'nearest' });
    }, 80);
    return;
  }
  scrollCheckoutElementIntoMobileView(fallbackElementId, behavior);
};
const toSafeMoney = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
};

const estimateCouponDiscount = (coupon: UserCoupon, cartTotal: number) => {
  const safeCartTotal = toSafeMoney(cartTotal);
  const threshold = toSafeMoney(coupon.thresholdAmount);
  if (safeCartTotal <= 0 || safeCartTotal < threshold) {
    return 0;
  }
  if (coupon.couponType === 'FULL_REDUCTION') {
    return Math.min(toSafeMoney(coupon.reductionAmount), safeCartTotal);
  }
  const rawPercent = Number(coupon.discountPercent ?? 0);
  const percent = Math.max(0, Math.min(Number.isFinite(rawPercent) ? rawPercent : 0, 100));
  const discount = safeCartTotal * percent / 100;
  const maxDiscount = toSafeMoney(coupon.maxDiscountAmount);
  return Math.min(maxDiscount > 0 ? Math.min(discount, maxDiscount) : discount, safeCartTotal);
};

const findBestCoupon = (coupons: UserCoupon[], cartTotal: number) =>
  coupons
    .map((coupon) => ({ coupon, discount: estimateCouponDiscount(coupon, cartTotal) }))
    .filter((item) => Number.isFinite(item.discount) && item.discount > 0)
    .sort((left, right) => right.discount - left.discount || toSafeMoney(left.coupon.thresholdAmount) - toSafeMoney(right.coupon.thresholdAmount))[0] || null;

const sanitizeCheckoutControlChars = (value: string) =>
  Array.from(value, (char) => {
    const code = char.charCodeAt(0);
    return code <= 31 || code === 127 ? ' ' : char;
  }).join('');
const normalizeCheckoutText = (value: unknown, maxLength: number) =>
  sanitizeCheckoutControlChars(String(value || '')).trim().replace(/\s+/g, ' ').slice(0, maxLength);

const normalizeCheckoutEmail = (value: unknown) =>
  normalizeCheckoutText(value, 120).replace(/\s+/g, '').toLowerCase();

const isAuthExpiredError = (error: any) => {
  const status = Number(error?.response?.status);
  return status === 401 || status === 403;
};

const clearExpiredCheckoutSession = () => {
  ['token', 'refreshToken', 'userId', 'username', 'role', 'adminDefaultPath'].forEach(removeLocalStorageItem);
};

const CHECKOUT_GUEST_DRAFT_KEY = 'checkoutGuestDraft';

const isLikelyPhone = (value: unknown) =>
  /^[+\d][\d\s().-]{5,38}$/.test(String(value || '').trim());

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
  return getRecommendedPaymentMethod(channels, currency) || channels[0]?.code || '';
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
  const [paymentSimulationEnabled, setPaymentSimulationEnabled] = useState(false);
  const [simulatingPayment, setSimulatingPayment] = useState(false);
  const [cancelingPayment, setCancelingPayment] = useState(false);
  const [paymentChannels, setPaymentChannels] = useState<PaymentChannel[]>([]);
  const [paymentChannelsAvailable, setPaymentChannelsAvailable] = useState(false);
  const [giftCelebrationOpen, setGiftCelebrationOpen] = useState(false);
  const [giftCelebrated, setGiftCelebrated] = useState(false);
  const [couponQuote, setCouponQuote] = useState<CouponQuote | null>(null);
  const [selectedUserCouponId, setSelectedUserCouponId] = useState<number | null>(null);
  const [couponManuallyChanged, setCouponManuallyChanged] = useState(false);
  const [supportPanelOpen, setSupportPanelOpen] = useState(false);
  const couponQuoteSeqRef = React.useRef(0);
  const { t, language } = useLanguage();
  const dateLocale = language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US';
  const watchedPaymentMethod = Form.useWatch('paymentMethod', form);
  const watchedGuestEmail = Form.useWatch('guestEmail', form);
  const watchedRecipientName = Form.useWatch('recipientName', form);
  const watchedPhone = Form.useWatch('phone', form);
  const watchedRegion = Form.useWatch('region', form);
  const watchedShippingAddress = Form.useWatch('shippingAddress', form);
  const paymentMethodDetails = useMemo(() => createPaymentMethodDetails(paymentChannels), [paymentChannels]);
  const { currency, market, formatMoney } = useMarket();
  const { config: appConfig } = useAppConfig();
  const isGuestCheckout = !getLocalStorageItem('token');
  const openSupport = useCallback(() => {
    const token = getLocalStorageItem('token');
    const guestOrderNo = createdOrder?.orderNo;
    const guestEmail = guestPaymentEmail || normalizeCheckoutText(form.getFieldValue('guestEmail'), 120).toLowerCase();
    if (!token && (!guestOrderNo || !guestEmail)) {
      dispatchDomEvent('shop:open-support');
      return;
    }
    if (!token && guestOrderNo && guestEmail) {
      saveGuestSupportContext({ orderNo: guestOrderNo, email: guestEmail });
    }
    dispatchDomEvent('shop:open-support', token ? undefined : { orderNo: guestOrderNo, email: guestEmail });
  }, [createdOrder?.orderNo, form, guestPaymentEmail]);
  const recommendedPaymentMethod = useMemo(
    () => getRecommendedPaymentMethod(paymentChannels, currency),
    [currency, paymentChannels],
  );

  useEffect(() => {
    const runtimeMode = String(appConfig.runtimeMode || '').trim().toLowerCase();
    const productionMode = runtimeMode === 'production' || runtimeMode === 'prod';
    setPaymentSimulationEnabled(Boolean(appConfig.paymentSimulationEnabled) && !productionMode && isAdminRole(getLocalStorageItem('role')));
  }, [appConfig.paymentSimulationEnabled, appConfig.runtimeMode]);

  useEffect(() => {
    paymentApi.getChannels()
      .then((res) => {
        const channels = res.data;
        setPaymentChannels(channels);
        setPaymentChannelsAvailable(channels.length > 0);
        const current = form.getFieldValue('paymentMethod');
        const rememberedMethod = getSessionStorageItem('checkoutPaymentMethod');
        const bootstrapCandidate = rememberedMethod || (current && current !== 'STRIPE' ? current : null);
        const nextMethod = resolveCheckoutPaymentMethod(bootstrapCandidate, channels, currency);
        if (nextMethod && nextMethod !== current) {
          form.setFieldsValue({ paymentMethod: nextMethod });
        } else if (!nextMethod && current) {
          form.setFieldsValue({ paymentMethod: undefined });
        }
      })
      .catch(() => {
        setPaymentChannels([]);
        setPaymentChannelsAvailable(false);
        form.setFieldsValue({ paymentMethod: undefined });
      });
  }, [currency, form]);

  const selectedCartItemIds = useMemo(() => {
    return readCheckoutCartItemIds();
  }, []);

  useEffect(() => {
    const token = getLocalStorageItem('token');
    if (!token) {
      const guestItems = getGuestCartItems().filter((item) => selectedCartItemIds.length === 0 || selectedCartItemIds.includes(item.id));
      const purchasableItems = guestItems.filter(isPurchasable);
      const purchasableIds = purchasableItems.map((item) => item.id);
      if (purchasableItems.length !== guestItems.length || (selectedCartItemIds.length > 0 && !areSameIds(selectedCartItemIds, purchasableIds))) {
        message.warning(t('pages.checkout.unavailableSelected'));
        syncCheckoutCartItemIds(purchasableItems);
      }
      setCartItems(purchasableItems);
      setAddresses([]);
      const preferredPaymentMethod = getSessionStorageItem('checkoutPaymentMethod');
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
          cartApi.getItems(0),
          addressApi.getByUser(0).catch(() => ({ data: [] as UserAddress[] })),
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
        const preferredPaymentMethod = getSessionStorageItem('checkoutPaymentMethod');
        if (preferredPaymentMethod) {
          form.setFieldsValue({ paymentMethod: resolveCheckoutPaymentMethod(preferredPaymentMethod, paymentChannels, currency) });
        }
      } catch (error: any) {
        if (isAuthExpiredError(error)) {
          clearExpiredCheckoutSession();
          const guestItems = getGuestCartItems().filter(isPurchasable);
          const guestIds = guestItems.map((item) => item.id);
          if (guestItems.length > 0) {
            syncCheckoutCartItemIds(guestItems);
          } else if (selectedCartItemIds.length > 0) {
            syncCheckoutCartItemIds([]);
          }
          setCartItems(guestItems);
          setAddresses([]);
          setSelectedAddressId('new');
          setSelectedUserCouponId(null);
          setCouponQuote(null);
          if (guestItems.length > 0 && selectedCartItemIds.length > 0 && !areSameIds(selectedCartItemIds, guestIds)) {
            message.warning(t('pages.checkout.unavailableSelected'));
          }
        } else {
          message.error(t('pages.checkout.loadFailed'));
        }
      } finally {
        setLoading(false);
      }
    };

    loadCheckout();
  }, [currency, form, paymentChannels, selectedCartItemIds, t]);

  useEffect(() => {
    if (selectedAddressId !== 'new') {
      const address = addresses.find((item) => String(item.id) === String(selectedAddressId));
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

  useEffect(() => {
    if (!isGuestCheckout) {
      removeSessionStorageItem(CHECKOUT_GUEST_DRAFT_KEY);
      return;
    }
    const rawDraft = getSessionStorageItem(CHECKOUT_GUEST_DRAFT_KEY);
    if (!rawDraft) return;
    try {
      const draft = JSON.parse(rawDraft);
      if (draft && typeof draft === 'object') {
        form.setFieldsValue({
          guestEmail: normalizeCheckoutText(draft.guestEmail, 120),
          recipientName: normalizeCheckoutText(draft.recipientName, 80),
          phone: normalizeCheckoutText(draft.phone, 40),
          region: Array.isArray(draft.region) ? draft.region : undefined,
          shippingAddress: normalizeCheckoutText(draft.shippingAddress, 260),
        });
      }
    } catch {
      removeSessionStorageItem(CHECKOUT_GUEST_DRAFT_KEY);
    }
  }, [form, isGuestCheckout]);

  useEffect(() => {
    if (!isGuestCheckout) return;
    const draft = {
      guestEmail: normalizeCheckoutText(watchedGuestEmail, 120),
      recipientName: normalizeCheckoutText(watchedRecipientName, 80),
      phone: normalizeCheckoutText(watchedPhone, 40),
      region: Array.isArray(watchedRegion) ? watchedRegion : undefined,
      shippingAddress: normalizeCheckoutText(watchedShippingAddress, 260),
    };
    const hasDraft = Object.values(draft).some((value) => Array.isArray(value) ? value.length > 0 : Boolean(value));
    if (hasDraft) {
      setSessionStorageItem(CHECKOUT_GUEST_DRAFT_KEY, JSON.stringify(draft));
    } else {
      removeSessionStorageItem(CHECKOUT_GUEST_DRAFT_KEY);
    }
  }, [isGuestCheckout, watchedGuestEmail, watchedPhone, watchedRecipientName, watchedRegion, watchedShippingAddress]);

  const cartTotal = cartItems.reduce((sum, item) => {
    const quantity = Number(item.quantity);
    return sum + toSafeMoney(item.price) * (Number.isFinite(quantity) ? Math.max(1, Math.floor(quantity)) : 1);
  }, 0);
  const checkoutItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    const token = getLocalStorageItem('token');
    if (!token || cartItems.length === 0) {
      setCouponQuote(null);
      return;
    }
    const requestSeq = couponQuoteSeqRef.current + 1;
    couponQuoteSeqRef.current = requestSeq;
    couponApi.quote({
      cartItemIds: cartItems.map((item) => item.id),
      userCouponId: selectedUserCouponId,
    })
      .then((res) => {
        if (couponQuoteSeqRef.current !== requestSeq) return;
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
        if (couponQuoteSeqRef.current !== requestSeq) return;
        if (selectedUserCouponId) {
          message.error(getApiErrorMessage(error, t('pages.checkout.couponUnavailable'), language));
          setSelectedUserCouponId(null);
        }
      });
  }, [cartItems, cartTotal, couponManuallyChanged, language, selectedUserCouponId, t]);

  const guestShippingFee = market.freeShippingThreshold > 0 && cartTotal >= market.freeShippingThreshold ? 0 : market.defaultShippingFee;
  const shippingFee = toSafeMoney(couponQuote?.shippingFee ?? (isGuestCheckout ? guestShippingFee : 0));
  const payableAmount = Math.max(0, toSafeMoney(couponQuote?.payableAmount ?? (cartTotal + shippingFee)));
  const discountAmount = Math.min(cartTotal, toSafeMoney(couponQuote?.discountAmount ?? 0));
  const shippingPolicyText = shippingFee <= 0
    ? t('pages.checkout.shippingPolicyFreeApplied')
    : market.freeShippingThreshold > 0
      ? t('pages.checkout.shippingPolicyStandardWithThreshold', {
        fee: formatMoney(market.defaultShippingFee),
        threshold: formatMoney(market.freeShippingThreshold),
      })
      : t('pages.checkout.shippingPolicyStandardOnly', { fee: formatMoney(market.defaultShippingFee) });
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
            threshold * Math.max(0, Math.min(Number(coupon.discountPercent || 0), 100)) / 100,
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
  const selectedSavedAddress = selectedAddressId === 'new'
    ? null
    : addresses.find((address) => String(address.id) === String(selectedAddressId)) || null;
  const newAddressReady = Boolean(
    normalizeCheckoutText(watchedRecipientName, 80)
      && isLikelyPhone(watchedPhone)
      && Array.isArray(watchedRegion)
      && watchedRegion.length > 0
      && normalizeCheckoutText(watchedShippingAddress, 260),
  );
  const selectedAddressReady = selectedAddressId === 'new'
    ? newAddressReady
    : Boolean(
      selectedSavedAddress
        && normalizeCheckoutText(selectedSavedAddress.recipientName, 80)
        && normalizeCheckoutText(selectedSavedAddress.address, 260),
    );
  const selectedPaymentDetail = paymentMethodDetails.find((method) => method.value === watchedPaymentMethod);
  const checkoutReadinessItems = [
    {
      key: 'items',
      ready: cartItems.length > 0,
      label: t('pages.checkout.readinessItems'),
      text: t('pages.checkout.readinessItemsText', { count: checkoutItemCount }),
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
      ready: paymentChannelsAvailable && Boolean(watchedPaymentMethod || recommendedPaymentMethod),
      label: t('pages.checkout.readinessPayment'),
      text: !paymentChannelsAvailable
        ? t('pages.checkout.paymentUnavailable')
        : selectedPaymentDetail
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
    scrollCheckoutElementIntoView('checkout-add-on-assistant');
  }, []);
  const handleCheckoutNextAction = () => {
    if (!checkoutNextAction) {
      openSupport();
      return;
    }
    if (checkoutNextAction.key === 'items') {
      navigate('/cart');
      return;
    }
    if (checkoutNextAction.key === 'address') {
      scrollCheckoutElementIntoView('checkout-address-card');
      return;
    }
    if (checkoutNextAction.key === 'payment') {
      scrollCheckoutElementIntoView('checkout-payment-card');
      return;
    }
    if (checkoutNextAction.key === 'savings') {
      if (addOnTarget) {
        scrollToAddOns();
        return;
      }
      scrollCheckoutElementIntoView('checkout-coupon-card');
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
  const renderSubmitWithAmount = () => {
    const amountText = formatMoney(payableAmount);
    const label = t('pages.checkout.submitWithAmount', { amount: amountText });
    const parts = label.split(amountText);
    if (parts.length <= 1) {
      return label;
    }
    return (
      <span className="checkout-page__submitAmountLabel">
        {parts.map((part, index) => (
          <React.Fragment key={`${part}-${index}`}>
            {part}
            {index < parts.length - 1 ? <span className="commerce-money">{amountText}</span> : null}
          </React.Fragment>
        ))}
      </span>
    );
  };
  const checkoutHeroHighlights = [
    {
      key: 'payable',
      title: t('pages.checkout.payable'),
      text: formatMoney(payableAmount),
    },
    {
      key: 'shipping',
      title: t('pages.checkout.shippingFee'),
      text: freeShippingRemaining > 0
        ? t('pages.checkout.savingsFreeShippingText', { amount: formatMoney(freeShippingRemaining) })
        : t('pages.checkout.savingsFreeShippingUnlocked'),
    },
    {
      key: 'payment',
      title: t('pages.checkout.paymentMethod'),
      text: selectedPaymentDetail?.title || t('pages.checkout.paymentConfidenceDefault'),
    },
  ];
  const checkoutSummaryCards = [
    {
      key: 'payable',
      title: t('pages.checkout.payable'),
      text: formatMoney(payableAmount),
    },
    {
      key: 'shipping',
      title: freeShippingRemaining > 0
        ? t('pages.checkout.readinessFreeShippingGap', { amount: formatMoney(freeShippingRemaining) })
        : t('pages.cart.freeShippingUnlocked'),
      text: `${freeShippingPercent}%`,
    },
    {
      key: 'payment',
      title: t('pages.checkout.paymentMethod'),
      text: selectedPaymentDetail?.title || t('pages.checkout.paymentConfidenceDefault'),
    },
  ];
  const checkoutSubmitDisabled = submitting
    || cartItems.length === 0
    || cartItems.some((item) => !isPurchasable(item))
    || !selectedAddressReady
    || !paymentChannelsAvailable
    || !watchedPaymentMethod;

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
      : t('pages.checkout.discountPayable', { percent: coupon.discountPercent || 0 }) + (coupon.maxDiscountAmount ? `, ${t('pages.checkout.maxDiscount', { amount: formatMoney(coupon.maxDiscountAmount) })}` : '');
    const threshold = Number(coupon.thresholdAmount || 0);
    if (cartTotal < threshold) {
      return `${coupon.couponName}: ${rule} (${t('pages.checkout.needMore', { amount: formatMoney(threshold - cartTotal) })})`;
    }
    return `${coupon.couponName}: ${rule}`;
  };

  const buildAddress = (values: any) => {
    if (selectedAddressId !== 'new') {
      const address = addresses.find((item) => String(item.id) === String(selectedAddressId));
      if (!address) throw new Error(t('pages.checkout.addressRequired'));
      return normalizeCheckoutText(`${address.recipientName} / ${address.phone} / ${address.address}`, 500);
    }
    const recipientName = normalizeCheckoutText(values.recipientName, 80);
    const phone = normalizeCheckoutText(values.phone, 40);
    const region = values.region ? values.region.join(' ') : '';
    const postalCode = normalizeCheckoutText(values.postalCode, 20);
    const detail = normalizeCheckoutText(values.shippingAddress, 260);
    const addressParts = [region, postalCode, detail].filter(Boolean).join(' ');
    return normalizeCheckoutText(`${recipientName} / ${phone} / ${addressParts}`, 500);
  };

  const addSuggestedProduct = async (product: Product) => {
    const token = getLocalStorageItem('token');
    if (token) {
      try {
        await cartApi.addItem(0, product.id, 1);
        const response = await cartApi.getItems(0);
        const purchasableItems = response.data.filter(isPurchasable);
        setCartItems(purchasableItems);
        syncCheckoutCartItemIds(purchasableItems);
        dispatchDomEvent('shop:cart-updated');
        return;
      } catch (error: any) {
        if (!isAuthExpiredError(error)) {
          throw error;
        }
      }
    }
    addGuestCartItem(product, 1);
    const nextItems = getGuestCartItems().filter(isPurchasable);
    setCartItems(nextItems);
    syncCheckoutCartItemIds(nextItems);
  };

  const handleSubmit = async (values: any) => {
    const token = getLocalStorageItem('token');
    if (cartItems.length === 0) {
      message.error(t('pages.checkout.emptyCart'));
      return;
    }
    if (cartItems.some((item) => !isPurchasable(item))) {
      message.error(t('pages.checkout.unavailableSelected'));
      return;
    }
    if (!paymentChannelsAvailable) {
      message.error(t('pages.checkout.paymentUnavailable'));
      return;
    }
    const normalizedPaymentMethod = normalizeCheckoutText(values.paymentMethod, 40);
    const normalizedGuestEmail = token ? undefined : normalizeCheckoutEmail(values.guestEmail);
    if (!normalizedPaymentMethod) {
      message.error(t('pages.checkout.paymentRequired'));
      return;
    }

    setSubmitting(true);
    try {
      const shippingAddress = buildAddress(values);
      const orderRes = token
        ? await orderApi.checkout({
            cartItemIds: cartItems.map((item) => item.id),
            shippingAddress,
            paymentMethod: normalizedPaymentMethod,
            userCouponId: selectedUserCouponId,
          })
        : await orderApi.guestCheckout({
            guestEmail: normalizedGuestEmail || '',
            guestName: normalizeCheckoutText(values.recipientName, 80),
            guestPhone: normalizeCheckoutText(values.phone, 40),
            shippingAddress,
            paymentMethod: normalizedPaymentMethod,
            items: cartItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              selectedSpecs: item.selectedSpecs,
            })),
          });
      clearCheckoutCartItemIds();
      removeSessionStorageItem('checkoutPaymentMethod');
      removeSessionStorageItem(CHECKOUT_GUEST_DRAFT_KEY);
      if (!token) {
        removeGuestCartItems(cartItems.map((item) => item.id));
      } else {
        dispatchDomEvent('shop:cart-updated');
      }
      dispatchDomEvent('shop:coupons-updated');
      setCreatedOrder(orderRes.data);
      setPendingPaymentMethod(normalizedPaymentMethod);
      setGuestPaymentEmail(normalizedGuestEmail);
      if (!token && normalizedGuestEmail && orderRes.data.orderNo) {
        saveGuestSupportContext({ orderNo: orderRes.data.orderNo, email: normalizedGuestEmail });
      }
      setPaymentCreateError(null);
      let paymentRes;
      try {
        paymentRes = await paymentApi.create(
          orderRes.data.id,
          normalizedPaymentMethod,
          normalizedGuestEmail,
          token ? undefined : orderRes.data.orderNo,
        );
      } catch (paymentError: any) {
        setPayment(null);
        setPaymentCreateError(getApiErrorMessage(paymentError, t('pages.payment.createFailed'), language));
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
      if (token && isAuthExpiredError(error)) {
        clearExpiredCheckoutSession();
        setAddresses([]);
        setSelectedAddressId('new');
        setSelectedUserCouponId(null);
        setCouponQuote(null);
        setGuestPaymentEmail(undefined);
        syncCheckoutCartItemIds(cartItems);
        window.setTimeout(() => {
          scrollCheckoutElementIntoView('checkout-address-card');
        }, 0);
        message.warning(t('pages.checkout.guestHint'));
        return;
      }
      message.error(getApiErrorMessage(error, t('pages.checkout.orderCreateFailed'), language));
    } finally {
      setSubmitting(false);
    }
  };

  const retryCreatePayment = async () => {
    if (!createdOrder) return;
    setPaying(true);
    try {
      const guestOrderNo = guestPaymentEmail ? createdOrder.orderNo : undefined;
      const paymentRes = await paymentApi.create(createdOrder.id, pendingPaymentMethod, guestPaymentEmail, guestOrderNo);
      setPayment(paymentRes.data);
      setPaymentCreateError(null);
      message.success(t('pages.checkout.paymentReady'));
      if (paymentRes.data.paymentUrl && !navigateToSafeUrl(paymentRes.data.paymentUrl)) {
        message.error(t('pages.payment.failed'));
      }
    } catch (error: any) {
      const localizedError = getApiErrorMessage(error, t('pages.payment.createFailed'), language);
      setPaymentCreateError(localizedError);
      message.error(localizedError);
    } finally {
      setPaying(false);
    }
  };

  const openPaymentUrl = () => {
    if (payment?.paymentUrl && !navigateToSafeUrl(payment.paymentUrl)) {
      message.error(t('pages.payment.failed'));
    }
  };

  const openTrackedOrder = () => {
    const orderNo = createdOrder?.orderNo || (createdOrder?.id ? String(createdOrder.id) : '');
    if (guestPaymentEmail && orderNo) {
      navigate(`/track-order?orderNo=${encodeURIComponent(orderNo)}&email=${encodeURIComponent(guestPaymentEmail)}`);
      return;
    }
    navigate('/track-order');
  };

  const simulatePayment = async () => {
    if (!payment) return;
    setSimulatingPayment(true);
    try {
      const paymentRes = await paymentApi.simulateCallback(payment.id);
      setPayment(paymentRes.data);
      if (createdOrder?.id && getLocalStorageItem('token')) {
        const orderRes = await orderApi.getById(createdOrder.id);
        setCreatedOrder(orderRes.data);
      } else if (createdOrder) {
        setCreatedOrder({ ...createdOrder, status: 'PENDING_SHIPMENT' });
      }
    } catch (error: any) {
      message.error(getApiErrorMessage(error, t('pages.checkout.simulatePaymentFailed'), language));
    } finally {
      setSimulatingPayment(false);
    }
  };

  const restoreSubmittedCartItems = async () => {
    const token = getLocalStorageItem('token');
    if (token) {
      const results = await allSettledWithConcurrency(
        cartItems,
        (item) => cartApi.addItem(0, item.productId, item.quantity, item.selectedSpecs),
      );
      const failed = results.find((result) => result.status === 'rejected') as PromiseRejectedResult | undefined;
      if (failed) {
        throw failed.reason;
      }
      dispatchDomEvent('shop:cart-updated');
      return;
    }
    cartItems.forEach((item) => {
      addGuestCartItem({
        id: item.productId,
        name: item.productName,
        imageUrl: item.imageUrl,
        price: item.price,
        stock: item.stock,
        status: item.productStatus || 'ACTIVE',
      }, item.quantity, item.selectedSpecs, item.price);
    });
  };

  const rollbackPendingPayment = () => {
    if (!createdOrder || createdOrder.status !== 'PENDING_PAYMENT') return;
    Modal.confirm({
      title: t('pages.checkout.rollbackPaymentTitle'),
      content: t('pages.checkout.rollbackPaymentContent'),
      okText: t('pages.checkout.rollbackPaymentAction'),
      cancelText: t('common.cancel'),
      okButtonProps: { danger: true },
      async onOk() {
        setCancelingPayment(true);
        try {
          await orderApi.cancel(createdOrder.id, guestPaymentEmail, guestPaymentEmail ? createdOrder.orderNo : undefined);
          await restoreSubmittedCartItems();
          setPayment(null);
          setCreatedOrder(null);
          setPaymentCreateError(null);
          message.success(t('pages.checkout.rollbackPaymentSuccess'));
          navigate('/cart');
        } catch (error: any) {
          message.error(getApiErrorMessage(error, t('pages.checkout.rollbackPaymentFailed'), language));
        } finally {
          setCancelingPayment(false);
        }
      },
    });
  };

  const createdOrderId = createdOrder?.id;
  const createdOrderNo = createdOrder?.orderNo;
  const paymentStatus = payment?.status;

  useEffect(() => {
    if (!createdOrderId || payment || !pendingPaymentMethod) return undefined;
    let disposed = false;
    const timer = window.setTimeout(async () => {
      try {
        const hasToken = Boolean(getLocalStorageItem('token'));
        const guestOrderNo = !hasToken && guestPaymentEmail ? createdOrderNo : undefined;
        const paymentRes = await paymentApi.getLatestByOrder(createdOrderId, hasToken ? undefined : guestPaymentEmail, guestOrderNo);
        if (!disposed) {
          setPayment(paymentRes.data);
          setPaymentCreateError(null);
        }
      } catch {
        // Keep the submitted-order screen stable; explicit retry remains available.
      }
    }, 1500);
    return () => {
      disposed = true;
      window.clearTimeout(timer);
    };
  }, [createdOrderId, createdOrderNo, guestPaymentEmail, payment, pendingPaymentMethod]);

  useEffect(() => {
    if (!createdOrderId || paymentStatus !== 'PENDING') return undefined;
    const shouldRefreshOrder = Boolean(getLocalStorageItem('token'));
    const guestOrderNo = !shouldRefreshOrder && guestPaymentEmail ? createdOrderNo : undefined;
    let disposed = false;
    let polling = false;
    const timer = window.setInterval(async () => {
      if (polling) return;
      polling = true;
      try {
        const paymentRes = await paymentApi.getLatestByOrder(createdOrderId, shouldRefreshOrder ? undefined : guestPaymentEmail, guestOrderNo);
        if (disposed) return;
        setPayment(paymentRes.data);
        if (shouldRefreshOrder) {
          const orderRes = await orderApi.getById(createdOrderId);
          if (disposed) return;
          setCreatedOrder(orderRes.data);
        } else if (guestPaymentEmail && guestOrderNo) {
          const orderRes = await orderApi.getById(createdOrderId, guestPaymentEmail, guestOrderNo);
          if (disposed) return;
          setCreatedOrder(orderRes.data);
        }
      } catch {
        // Keep the submitted-order screen stable while the gateway is still redirecting or polling.
      } finally {
        polling = false;
      }
    }, 5000);
    return () => {
      disposed = true;
      polling = false;
      window.clearInterval(timer);
    };
  }, [createdOrderId, createdOrderNo, guestPaymentEmail, paymentStatus]);

  if (loading) {
    return <div className={`checkout-page checkout-page--loading checkout-page--${language}`}><Spin size="large" /></div>;
  }

  if (createdOrder && !payment) {
    return (
      <div className={`checkout-page checkout-page--result checkout-page--${language}`}>
        <Result
          status="warning"
          title={t('pages.checkout.orderCreatedPaymentPending')}
          subTitle={t('pages.checkout.paymentPendingSubtitle', { orderNo: createdOrder.orderNo || createdOrder.id, amount: formatMoney(createdOrder.totalAmount) })}
          extra={[
            <Button type="primary" key="retry" loading={paying} onClick={retryCreatePayment}>{t('pages.checkout.retryPayment')}</Button>,
            <Button danger key="rollback" icon={<RollbackOutlined />} loading={cancelingPayment} onClick={rollbackPendingPayment}>{t('pages.checkout.rollbackPaymentAction')}</Button>,
            <Button key="profile" onClick={guestPaymentEmail ? openTrackedOrder : () => navigate('/profile?tab=orders')}>{t('pages.checkout.viewOrder')}</Button>,
            <Button key="track" onClick={openTrackedOrder}>{t('pages.orderTracking.title')}</Button>,
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
    const paymentRecovery = getPaymentRecoveryState(payment);
    const paymentRecoveryTone = paid
      ? 'success'
      : paymentRecovery.isExpired
        ? 'error'
        : paymentRecovery.isExpiringSoon
          ? 'warning'
          : 'processing';
    return (
      <div className={`checkout-page checkout-page--result checkout-page--${language}`}>
        <Result
          status={paid ? 'success' : 'info'}
          title={paid ? t('pages.checkout.paidTitle') : t('pages.checkout.pendingTitle')}
          subTitle={t('pages.checkout.resultSubtitle', { orderNo: createdOrder.orderNo || createdOrder.id, amount: formatMoney(createdOrder.totalAmount) })}
          extra={[
            !paid && payment.paymentUrl && (
              <Button type="primary" key="pay" loading={paying} onClick={openPaymentUrl}>
                {t('pages.checkout.openPayment')}
              </Button>
            ),
            <Button key="profile" onClick={guestPaymentEmail ? openTrackedOrder : () => navigate('/profile?tab=orders')}>{t('pages.checkout.viewOrder')}</Button>,
            <Button key="track" onClick={openTrackedOrder}>{t('pages.orderTracking.title')}</Button>,
            <Button key="home" onClick={() => navigate('/')}>{t('pages.checkout.backHome')}</Button>,
          ].filter(Boolean)}
        />
        <Card className="checkout-page__paymentRecovery" title={t('pages.checkout.paymentRecoveryTitle')}>
          <div className="checkout-page__paymentRecoveryGrid">
            <div>
              <Text strong>{t('pages.checkout.paymentRecoveryStatus')}</Text>
              <Tag color={paid ? 'green' : paymentRecovery.isExpired ? 'red' : paymentRecovery.isExpiringSoon ? 'orange' : 'blue'}>
                {paid ? t('pages.checkout.paymentRecoveryPaid') : paymentRecovery.isExpired ? t('pages.checkout.paymentRecoveryExpired') : t('pages.checkout.paymentRecoveryPending')}
              </Tag>
            </div>
            <div>
              <Text strong>{t('pages.checkout.paymentRecoveryWindow')}</Text>
              <Text type={paymentRecoveryTone === 'error' ? 'danger' : paymentRecoveryTone === 'warning' ? 'warning' : 'secondary'}>
                {paymentRecovery.minutesLeft === null
                  ? t('pages.checkout.paymentRecoveryWindowUnknown')
                  : paymentRecovery.isExpired
                    ? t('pages.checkout.paymentRecoveryWindowExpired')
                    : t('pages.checkout.paymentRecoveryWindowMinutes', { count: paymentRecovery.minutesLeft })}
              </Text>
            </div>
            <div>
              <Text strong>{t('pages.checkout.paymentRecoveryNext')}</Text>
              <Text type="secondary">
                {paid
                  ? t('pages.checkout.paymentRecoveryNextPaid')
                  : payment.paymentUrl
                    ? t('pages.checkout.paymentRecoveryNextOpen')
                    : t('pages.checkout.paymentRecoveryNextRetry')}
              </Text>
            </div>
          </div>
          {!paid ? (
            <Space wrap className="checkout-page__paymentRecoveryActions">
              {payment.paymentUrl ? <Button type="primary" onClick={openPaymentUrl}>{t('pages.checkout.openPayment')}</Button> : null}
              {paymentSimulationEnabled ? (
                <Button loading={simulatingPayment} onClick={simulatePayment}>
                  {t('pages.checkout.simulatePay')}
                </Button>
              ) : null}
              <Button loading={paying} onClick={retryCreatePayment}>{t('pages.checkout.retryPayment')}</Button>
              {createdOrder.status === 'PENDING_PAYMENT' ? (
                <Button danger icon={<RollbackOutlined />} loading={cancelingPayment} onClick={rollbackPendingPayment}>
                  {t('pages.checkout.rollbackPaymentAction')}
                </Button>
              ) : null}
              <Button onClick={openSupport}>{t('pages.checkout.nextActionSupport')}</Button>
            </Space>
          ) : null}
        </Card>
        <Card title={t('pages.checkout.paymentCard')}>
          <Space direction="vertical">
            <Text>{t('pages.checkout.channel')}: {paymentMethodLabel(payment.channel, t)}</Text>
            {createdOrder.originalAmount ? <Text>{t('common.subtotal')}: <span className="commerce-money">{formatMoney(createdOrder.originalAmount)}</span></Text> : null}
            {createdOrder.discountAmount && createdOrder.discountAmount > 0 ? <Text>{t('pages.checkout.coupon')}: <span className="commerce-money">-{formatMoney(createdOrder.discountAmount)}</span> {createdOrder.couponName ? `(${createdOrder.couponName})` : ''}</Text> : null}
            <Text>{t('pages.checkout.shippingFee')}: <span className="commerce-money">{formatMoney(createdOrder.shippingFee)}</span></Text>
            <Text>{t('pages.checkout.paymentStatus')}: <Tag color={paid ? 'green' : 'orange'}>{t(`status.${payment.status}`)}</Tag></Text>
            <Text className="checkout-page__paymentUrl">{t('pages.checkout.paymentLink')}: {formatPaymentUrlLabel(payment.paymentUrl)}</Text>
            {payment.expiresAt && <Text>{t('pages.checkout.paymentExpiresAt')}: {new Date(payment.expiresAt).toLocaleString(dateLocale)}</Text>}
            {payment.transactionId && <Text>{t('pages.checkout.transactionId')}: {payment.transactionId}</Text>}
          </Space>
        </Card>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className={`checkout-page checkout-page--empty checkout-page--${language}`}>
        <section className="checkout-page__emptyHero" aria-label={t('pages.checkout.emptySelected')}>
          <span className="checkout-page__emptyIcon">
            <ShoppingCartOutlined />
          </span>
          <div className="checkout-page__emptyCopy">
            <span className="checkout-page__emptyEyebrow">{t('pages.checkout.readinessEyebrow')}</span>
            <Title level={2}>{t('pages.checkout.emptySelected')}</Title>
            <Text>{t('pages.checkout.savingsCoachSubtitle')}</Text>
          </div>
          <div className="checkout-page__emptyActions">
            <Button type="primary" icon={<ShoppingCartOutlined />} onClick={() => navigate('/cart')}>
              {t('pages.checkout.backCart')}
            </Button>
            <Button icon={<ShoppingOutlined />} onClick={() => navigate('/products')}>
              {t('pages.cart.browse')}
            </Button>
            <Button icon={<GiftOutlined />} onClick={() => navigate('/coupons')}>
              {t('nav.coupons')}
            </Button>
            <Button icon={<HistoryOutlined />} onClick={() => navigate('/history')}>
              {t('nav.history')}
            </Button>
          </div>
          <div className="checkout-page__emptySignals">
            <span>
              <SafetyCertificateOutlined />
              {t('pages.checkout.trustSecureTitle')}
            </span>
            <span>
              <TruckOutlined />
              {market.freeShippingThreshold > 0
                ? t('pages.cart.freeShippingRemaining', { amount: formatMoney(market.freeShippingThreshold) })
                : t('pages.cart.freeShippingUnlocked')}
            </span>
            <span>
              <CustomerServiceOutlined />
              {t('pages.checkout.trustSupportTitle')}
            </span>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={`checkout-page checkout-page--${language}`}>
      <section className="checkout-page__hero">
        <div className="checkout-page__heroContent">
          <span className="checkout-page__heroEyebrow">{t('pages.checkout.readinessEyebrow')}</span>
          <Title level={2}>{t('pages.checkout.title')}</Title>
          <Text>{t('pages.checkout.savingsCoachSubtitle')}</Text>
        </div>
        <div className="checkout-page__heroStats">
          {checkoutHeroHighlights.map((item) => (
            <article key={item.key} className="checkout-page__heroStat">
              <strong>{item.title}</strong>
              <span>{item.text}</span>
            </article>
          ))}
        </div>
      </section>
      <section className="checkout-page__summaryStrip">
        {checkoutSummaryCards.map((item) => (
          <article key={item.key} className="checkout-page__summaryStripCard">
            <strong>{item.title}</strong>
            <span>{item.text}</span>
          </article>
        ))}
      </section>

      <section className={checkoutNextAction ? 'checkout-page__confirmationBand' : 'checkout-page__confirmationBand checkout-page__confirmationBand--ready'} aria-label={t('pages.checkout.readinessTitle')}>
        <div className="checkout-page__confirmationScore">
          <Progress type="circle" percent={checkoutReadinessScore} size={58} strokeColor="#124734" />
          <span>
            <Text strong>{checkoutNextAction ? t('pages.checkout.nextActionTitle') : t('pages.checkout.nextActionReadyTitle')}</Text>
            <Text type="secondary">{checkoutNextAction ? checkoutNextAction.text : t('pages.checkout.nextActionReadyText')}</Text>
          </span>
        </div>
        <div className="checkout-page__confirmationFacts">
          <span>
            <Text type="secondary">{t('pages.checkout.itemSummary', { count: checkoutItemCount })}</Text>
            <Text strong className="commerce-money">{formatMoney(payableAmount)}</Text>
          </span>
          <span>
            <Text type="secondary">{t('pages.checkout.paymentMethod')}</Text>
            <Text strong>{selectedPaymentDetail?.title || t('pages.checkout.paymentConfidenceDefault')}</Text>
          </span>
        </div>
        <Button
          type="primary"
          className="checkout-page__confirmationButton"
          onClick={checkoutNextAction ? handleCheckoutNextAction : () => form.submit()}
          loading={submitting}
          disabled={!checkoutNextAction && checkoutSubmitDisabled}
        >
          {checkoutNextAction ? checkoutNextActionLabel : t('pages.checkout.submitWithAmount', { amount: formatMoney(payableAmount) })}
        </Button>
      </section>

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

      <Card title={t('pages.checkout.expressCheckout')} className="checkout-page__expressCard">
        <Form form={form} component={false}>
          <Form.Item noStyle shouldUpdate={(prev, next) => prev.paymentMethod !== next.paymentMethod}>
            {({ getFieldValue }) => {
              const selectedPaymentMethod = getFieldValue('paymentMethod');
              return (
        <div className="checkout-page__paymentGrid">
          {!paymentChannelsAvailable ? (
            <Alert type="warning" showIcon message={t('pages.checkout.paymentUnavailable')} description={t('pages.checkout.paymentUnavailableDescription')} />
          ) : null}
          {paymentMethodDetails.map((method) => (
            <button
              type="button"
              key={method.value}
              className={`checkout-page__paymentMethod${selectedPaymentMethod === method.value ? ' checkout-page__paymentMethod--selected' : ''}`}
              onClick={() => form.setFieldsValue({ paymentMethod: method.value })}
            >
              <span className="checkout-page__paymentMethodTop">
                <strong className="checkout-page__paymentMethodTitle">{method.title}</strong>
                <span className="checkout-page__paymentBadges">
                  {recommendedPaymentMethod === method.value ? <Tag color="gold">{t('pages.checkout.recommendedPayment')}</Tag> : null}
                  <Tag color={method.market === 'CN' ? 'red' : method.value === 'OXXO' ? 'orange' : method.value === 'SPEI' ? 'blue' : 'green'}>{t(method.badgeKey)}</Tag>
                </span>
              </span>
              <span className="checkout-page__paymentMethodDescription">{t(method.descriptionKey)}</span>
            </button>
          ))}
        </div>
              );
            }}
          </Form.Item>
        </Form>
        <Text type="secondary" className="checkout-page__expressHint">
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
        className="profile-mobile-safe-modal checkout-page__giftCelebrationModal"
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

        <Card className="checkout-page__savingsCoach">
          <div className="checkout-page__savingsCoachHeader">
            <div>
              <Text type="secondary">{t('pages.checkout.savingsCoachEyebrow')}</Text>
              <Text strong>{t('pages.checkout.savingsCoachTitle')}</Text>
              <Text type="secondary">{t('pages.checkout.savingsCoachSubtitle')}</Text>
            </div>
            {addOnTarget ? (
              <Button size="small" icon={<SwapOutlined />} className="checkout-page__addOnButton" onClick={scrollToAddOns}>
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

        {addOnTarget ? (
          <div id="checkout-add-on-assistant" className="checkout-page__addOnDock">
            <AddOnAssistant
              cartProductIds={cartItems.map((item) => item.productId)}
              remainingAmount={addOnTarget.remainingAmount}
              reason={addOnTarget.reason}
              onAdd={addSuggestedProduct}
            />
          </div>
        ) : null}

        {couponOpportunity ? (
          <Card className={couponOpportunity.type === 'ready' ? 'checkout-page__couponOpportunity checkout-page__couponOpportunity--ready' : 'checkout-page__couponOpportunity'}>
            <div>
              <Text strong>{couponOpportunity.title}</Text>
              <Text type="secondary">{couponOpportunity.text}</Text>
            </div>
            <Button
              size="small"
              type={couponOpportunity.type === 'ready' ? 'default' : 'primary'}
              icon={couponOpportunity.type === 'build' && addOnTarget ? <SwapOutlined /> : undefined}
              className="checkout-page__addOnButton"
              onClick={handleCouponOpportunityAction}
            >
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

      <Card title={t('pages.checkout.itemList')} className="checkout-page__itemsCard checkout-page__sectionCard">
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
                    loading="lazy"
                    decoding="async"
                    onError={(event) => {
                      if (event.currentTarget.src !== checkoutImageFallback) {
                        event.currentTarget.src = checkoutImageFallback;
                      }
                    }}
                  />
                }
                title={<button type="button" className="checkout-page__itemLink" onClick={() => navigate(`/products/${item.productId}`)}>{item.productName}</button>}
                description={
                  <div className="checkout-page__itemDescription">
                    {item.selectedSpecs ? <Text type="secondary">{formatSelectedSpecs(item.selectedSpecs, t)}</Text> : null}
                    {getCartItemLowStockCount(item) !== null ? (
                      <Text type="warning" className="checkout-page__urgency">
                        {t('pages.cart.lowStockLeft', { count: getCartItemLowStockCount(item) ?? 0 })}
                      </Text>
                    ) : null}
                    <div className="checkout-page__itemCommerce">
                      <Text type="secondary" className="checkout-page__itemUnit commerce-atomic commerce-price-quantity">
                        <span className="commerce-money">{formatMoney(item.price)}</span>
                        <span className="commerce-quantity">x {item.quantity}</span>
                      </Text>
                      <Text strong className="checkout-page__itemTotal commerce-money">{formatMoney(item.price * item.quantity)}</Text>
                    </div>
                  </div>
                }
              />
            </List.Item>
          )}
        />
        <Divider />
        <div className="checkout-page__summaryLine">
          <Text>{t('pages.checkout.itemSummary', { count: checkoutItemCount })}</Text>
          <Text strong className="checkout-page__summaryTotal commerce-money"> {formatMoney(cartTotal)}</Text>
        </div>
      </Card>

      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        {isGuestCheckout ? (
          <Card title={t('pages.checkout.contact')} className="checkout-page__sectionCard">
            <Form.Item name="guestEmail" label={t('pages.checkout.email')} rules={[{ required: true, message: t('pages.checkout.emailRequired') }, { type: 'email', message: t('pages.checkout.emailInvalid') }]}>
              <Input placeholder="you@example.com" autoComplete="email" inputMode="email" maxLength={120} />
            </Form.Item>
            <Text type="secondary">{t('pages.checkout.guestHint')}</Text>
          </Card>
        ) : null}

        <Card
          id="checkout-address-card"
          title={t('pages.checkout.address')}
          className="checkout-page__sectionCard"
          onFocusCapture={(event) => scrollCheckoutFieldIntoMobileView(event.target, 'checkout-address-card', 'auto')}
        >
          {addresses.length > 0 && (
            <Radio.Group value={selectedAddressId} onChange={(e) => setSelectedAddressId(e.target.value)} className="checkout-page__addressGroup">
              {addresses.map((address) => (
                <Radio
                  key={address.id}
                  value={address.id}
                  className={String(selectedAddressId) === String(address.id) ? 'checkout-page__addressChoice checkout-page__addressChoice--selected' : 'checkout-page__addressChoice'}
                >
                  <Space className="checkout-page__addressHeader">
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
                <Input placeholder={t('pages.checkout.recipientRequired')} maxLength={80} autoComplete="name" />
              </Form.Item>
              <Form.Item
                name="phone"
                label={t('pages.profile.phone')}
                rules={[
                  { required: true, message: t('pages.checkout.phoneRequired') },
                  { validator: (_, value) => (!value || isLikelyPhone(value) ? Promise.resolve() : Promise.reject(new Error(t('pages.checkout.phoneRequired')))) },
                ]}
              >
                <Input placeholder={t('pages.checkout.phoneRequired')} maxLength={40} autoComplete="tel" inputMode="tel" />
              </Form.Item>
              <Form.Item name="region" label={t('pages.checkout.region')} rules={[{ required: true, message: t('pages.checkout.regionRequired') }]}>
                <Cascader
                  options={regionData}
                  placeholder={t('pages.checkout.regionPlaceholder')}
                  showSearch
                  popupClassName="shop-mobile-popup-layer"
                  getPopupContainer={() => document.body}
                />
              </Form.Item>
              <Form.Item name="shippingAddress" label={t('pages.checkout.detailAddress')} rules={[{ required: true, message: t('pages.checkout.detailRequired') }]}>
                <Input.TextArea rows={3} placeholder={t('pages.checkout.detailPlaceholder')} maxLength={260} showCount autoComplete="street-address" />
              </Form.Item>
              <Form.Item name="postalCode" label={t('pages.checkout.postalCode')} rules={[{ required: true, message: t('pages.checkout.postalCodeRequired') }]}>
                <Input placeholder={t('pages.checkout.postalCodePlaceholder')} maxLength={20} autoComplete="postal-code" inputMode="text" />
              </Form.Item>
            </>
          )}
        </Card>

        {!isGuestCheckout ? <Card id="checkout-coupon-card" title={t('pages.checkout.coupon')} className="checkout-page__sectionCard">
          <Select
            allowClear
            className="checkout-page__couponSelect"
            placeholder={t('pages.checkout.selectCoupon')}
            value={selectedUserCouponId ?? undefined}
            popupClassName="shop-mobile-popup-layer"
            getPopupContainer={() => document.body}
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
              className="checkout-page__couponAlert"
              message={selectedIsBestCoupon
                ? t('pages.checkout.bestCouponApplied', { name: selectedCoupon.couponName })
                : t('pages.checkout.couponAutoApplied', { name: selectedCoupon.couponName })}
              description={t('pages.checkout.couponSavings', { amount: formatMoney(discountAmount) })}
            />
          ) : null}
          {couponQuote && couponQuote.availableCoupons.length > 0 && !couponQuote.availableCoupons.some((coupon) => calculateCouponDiscount(coupon) > 0) ? (
            <div className="checkout-page__couponRules">
              <Text type="secondary">{t('pages.checkout.couponRulesNotMet')}</Text>
            </div>
          ) : null}
          <div className="checkout-page__couponSummary">
            <div><Text>{t('common.subtotal')}: <span className="commerce-money">{formatMoney(cartTotal)}</span></Text></div>
            {discountAmount > 0 ? <div><Text type="success">{t('pages.checkout.couponDiscount')}: <span className="commerce-money">-{formatMoney(discountAmount)}</span></Text></div> : null}
            <div><Text>{t('pages.checkout.shippingFee')}: <span className="commerce-money">{formatMoney(shippingFee)}</span></Text></div>
            <Text type="secondary" className="checkout-page__shippingPolicy">{shippingPolicyText}</Text>
            <div><Text strong className="checkout-page__payableTotal">{t('pages.checkout.payable')}: <span className="commerce-money">{formatMoney(payableAmount)}</span></Text></div>
          </div>
        </Card> : (
          <Card id="checkout-coupon-card" title={t('pages.checkout.orderSummary')} className="checkout-page__sectionCard">
            <div className="checkout-page__couponSummary">
              <div><Text>{t('common.subtotal')}: <span className="commerce-money">{formatMoney(cartTotal)}</span></Text></div>
              <div><Text>{t('pages.checkout.shippingFee')}: <span className="commerce-money">{formatMoney(shippingFee)}</span></Text></div>
              <Text type="secondary" className="checkout-page__shippingPolicy">{shippingPolicyText}</Text>
              <div><Text strong className="checkout-page__payableTotal">{t('pages.checkout.payable')}: <span className="commerce-money">{formatMoney(payableAmount)}</span></Text></div>
            </div>
          </Card>
        )}

        <Card id="checkout-payment-card" title={t('pages.payment.title')}>
          <div className="checkout-page__paymentConfidence">
            <SafetyCertificateOutlined />
            <span>
              <Text strong>{t('pages.checkout.paymentConfidenceTitle')}</Text>
              <Text type="secondary">
                {!paymentChannelsAvailable
                  ? t('pages.checkout.paymentUnavailable')
                  : selectedPaymentDetail
                  ? t('pages.checkout.paymentConfidenceSelected', { method: selectedPaymentDetail.title })
                  : t('pages.checkout.paymentConfidenceDefault')}
              </Text>
            </span>
          </div>
          {!paymentChannelsAvailable ? (
            <Alert type="warning" showIcon message={t('pages.checkout.paymentUnavailable')} description={t('pages.checkout.paymentUnavailableDescription')} />
          ) : null}
          <Form.Item name="paymentMethod" rules={[{ required: true, message: t('pages.checkout.paymentRequired') }]} hidden>
            <Input />
          </Form.Item>
          <div className="checkout-page__submitReview">
            <div className="checkout-page__submitMetric">
              <Text type="secondary">{t('pages.checkout.itemSummary', { count: checkoutItemCount })}</Text>
              <Text strong className="commerce-money">{formatMoney(payableAmount)}</Text>
            </div>
            <div className="checkout-page__submitMetric checkout-page__submitMetric--method">
              <Text type="secondary">{t('pages.checkout.paymentMethod')}</Text>
              <Text strong>{selectedPaymentDetail?.title || t('pages.checkout.paymentConfidenceDefault')}</Text>
            </div>
            <Form.Item className="checkout-page__submitAction">
              <Button className="checkout-page__submitButton" type="primary" htmlType="submit" loading={submitting} disabled={checkoutSubmitDisabled} block size="large">
                {renderSubmitWithAmount()}
              </Button>
            </Form.Item>
          </div>
          <div className="checkout-page__mobilePayBar" aria-label={t('pages.checkout.paymentConfidenceTitle')}>
            <span>
              <Text type="secondary">{t('pages.checkout.payable')}</Text>
              <Text strong className="commerce-money">{formatMoney(payableAmount)}</Text>
            </span>
            <Button type="primary" htmlType="submit" loading={submitting} disabled={checkoutSubmitDisabled}>
              {renderSubmitWithAmount()}
            </Button>
          </div>
        </Card>
      </Form>
    </div>
  );
};

export default Checkout;
