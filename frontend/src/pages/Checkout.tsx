import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { ShopIcon, SI } from '../components/ShopIcon';
import { Form } from 'antd';
import ShopModal from '../components/ShopModal';
import ShopButton from '../components/ShopButton';
import ShopConfirm from '../components/ShopConfirm';
import type { FormInstance } from 'antd/es/form';
import { useNavigate } from 'react-router-dom';
import type { CartItem, CouponQuote, OrderCustomer, PaymentCustomer, PaymentChannel, ProductPublic as Product, UserAddress, UserCoupon } from '../types';
import { useLanguage, type Language } from '../i18n';
import { usePageTitle } from '../hooks/usePageTitle';
import { useCheckoutPaymentLifecycle } from '../hooks/useCheckoutPaymentLifecycle';
import { useCheckoutCartBootstrap } from '../hooks/useCheckoutCartBootstrap';
import { useCheckoutCouponQuote } from '../hooks/useCheckoutCouponQuote';
import { useCheckoutAddressHydrate } from '../hooks/useCheckoutAddressHydrate';
import { useCheckoutGuestDraft } from '../hooks/useCheckoutGuestDraft';
import { useCheckoutPaymentChannels } from '../hooks/useCheckoutPaymentChannels';
import { useCheckoutRegionCascader } from '../hooks/useCheckoutRegionCascader';
import { useCheckoutGiftCelebration } from '../hooks/useCheckoutGiftCelebration';
import { useCheckoutOrderActions } from '../hooks/useCheckoutOrderActions';
import { useCheckoutConversionCoach } from '../hooks/useCheckoutConversionCoach';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { createPaymentMethodDetails } from '../utils/paymentMethods';
import { useMarket } from '../hooks/useMarket';
import { formatSelectedSpecs } from '../utils/selectedSpecs';
import { getGuestCartItems } from '../utils/guestCart';
import { conversionConfig, getDeliveryPromise } from '../utils/conversionConfig';
import { getGiftThreshold, getNearestCartBenefitTarget } from '../utils/cartBenefits';
import { clearCheckoutCartItemIds, hasAuthenticatedCartSession, readCheckoutCartItemIds, syncCheckoutCartItemIds } from '../utils/cartSession';
import { productImageFallback, resolveProductImage } from '../utils/productMedia';
import { getApiErrorMessage } from '../utils/apiError';
import { deriveCartShippingSummary, getCartLineAmount, roundCartMoney } from '../utils/cartUi';
import { dispatchDomEvent } from '../utils/domEvents';
import { saveGuestSupportContext } from '../utils/guestSupportContext';
import { setSessionStorageItem, removeSessionStorageItem } from '../utils/safeStorage';
import ShopBreadcrumb from '../components/ShopBreadcrumb';
import {
  CheckoutCartLoadErrorShell,
  CheckoutEmptyShell,
  CheckoutLoadingShell,
  CheckoutPaymentActiveShell,
  CheckoutPaymentPendingShell,
} from '../components/checkout/CheckoutShellStates';
import {
  CheckoutAddressSection,
  CheckoutCouponAndSummarySection,
  CheckoutExpressPaymentGrid,
  CheckoutGuestContactSection,
  CheckoutItemsCard,
  CheckoutSubmitPaymentSection,
} from '../components/checkout/CheckoutFormSections';
import {
  CheckoutBenefitStrip,
  CheckoutConfirmationBand,
  CheckoutHeroSection,
  CheckoutSummaryStrip,
  CheckoutSupportCoachPanel,
  CheckoutTrustBar,
} from '../components/checkout/CheckoutConversionSections';
import {
  buildCheckoutFieldErrorMap,
  buildCheckoutValidationAnnouncement,
  checkoutGuestDraftFieldNames,
  estimateCouponDiscount,
  findBestCoupon,
  firstCheckoutRegionPath,
  firstFilledCheckoutText,
  getRecommendedPaymentMethod,
  getSavedAddressDetail,
  getSavedAddressPostalCode,
  getSavedAddressRegionPath,
  hasCompleteCheckoutDetailAddress,
  hasCompleteCheckoutRecipientName,
  hasHydratableCheckoutValue,
  isCompleteSavedAddress,
  isLikelyPhone,
  isPurchasable,
  isValidCheckoutPostalCode,
  mergeDefinedCheckoutFields,
  normalizeCheckoutEmail,
  normalizeCheckoutPostalCode,
  normalizeCheckoutText,
  normalizeLikelyCheckoutPhone,
  toSafeMoney,
  readCheckoutGuestDraftFields,
  readCheckoutPendingOrder,
  describeCheckoutCoupon,
  type CheckoutFormFieldName,
  type CheckoutValidationField,
  type CheckoutFormSnapshot,
  type CheckoutFormValues,
  type CheckoutMessageType,
  type CheckoutPendingOrderSnapshot,
} from '../utils/checkoutHelpers';
import './Checkout.css';
import '../styles/mobile-page-contrast.css';
import {
  focusFirstCheckoutValidationError,
  scrollCheckoutFieldIntoMobileView,
} from '../utils/checkoutDom';

export {
  buildCheckoutValidationAnnouncement,
  buildCheckoutFieldErrorMap,
  areSameIds,
  CHECKOUT_GUEST_DRAFT_KEY,
  CHECKOUT_IDEMPOTENCY_KEY,
  CHECKOUT_PENDING_ORDER_KEY,
  checkoutPaymentPollResultKey,
  estimateCouponDiscount,
  findBestCoupon,
  formatCheckoutDateTime,
  getCheckoutCouponErrorMessage,
  getCartItemLowStockCount,
  isCompleteSavedAddress,
  isPurchasable,
  isValidCheckoutPostalCode,
  normalizeCheckoutText,
  parseCartItemSelectedSpecs,
  parseCheckoutPaymentPollResult,
  parseCheckoutPendingOrderSnapshot,
  resolveCheckoutPaymentMethod,
  resolveGuestRestorePrice,
  toSafeMoney,
  createCheckoutIdempotencyKey,
  readCheckoutPendingOrder,
  persistCheckoutPendingOrder,
  readCheckoutGuestDraftFields,
  getOrCreateCheckoutIdempotencyKey,
} from '../utils/checkoutHelpers';

const checkoutImageFallback = productImageFallback;
const resolveCheckoutImage = resolveProductImage;
const readGuestCartSnapshot = () => {
  const items = getGuestCartItems();
  return Array.isArray(items) ? items : [];
};

type CheckoutFormInstance = FormInstance<CheckoutFormValues>;

type CheckoutContentProps = {
  form: CheckoutFormInstance;
};

const CheckoutContent: React.FC<CheckoutContentProps> = ({ form }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [addressLoadFailed, setAddressLoadFailed] = useState(false);
  const [cartLoadError, setCartLoadError] = useState<string | null>(null);
  const [checkoutReloadKey, setCheckoutReloadKey] = useState(0);
  const [selectedAddressId, setSelectedAddressId] = useState<number | 'new'>('new');
  const initialPendingOrderRef = React.useRef<CheckoutPendingOrderSnapshot | null>(null);
  if (initialPendingOrderRef.current === null) {
    initialPendingOrderRef.current = readCheckoutPendingOrder();
  }
  const initialPendingOrder = initialPendingOrderRef.current;
  const [createdOrder, setCreatedOrder] = useState<OrderCustomer | null>(() => initialPendingOrder?.order || null);
  const [payment, setPayment] = useState<PaymentCustomer | null>(null);
  const [guestPaymentEmail, setGuestPaymentEmail] = useState<string | undefined>(() => initialPendingOrder?.guestPaymentEmail);
  const [pendingPaymentMethod, setPendingPaymentMethod] = useState<string>(() => initialPendingOrder?.paymentMethod || 'STRIPE');
  const submittedCartItemsRef = React.useRef<CartItem[]>(initialPendingOrder?.cartItems || []);
  const [paymentCreateError, setPaymentCreateError] = useState<string | null>(null);
  const paymentCreateRequestSeqRef = React.useRef(0);
  // Commercial: never enable in production builds. Opt-in only for local/dev QA.
  const paymentSimulationEnabled = process.env.NODE_ENV !== 'production'
    && process.env.REACT_APP_ENABLE_PAYMENT_SIMULATION === 'true';
  const [simulatingPayment, setSimulatingPayment] = useState(false);
  const [cancelingPayment, setCancelingPayment] = useState(false);
  const [rollbackConfirmOpen, setRollbackConfirmOpen] = useState(false);
  const [paymentChannels, setPaymentChannels] = useState<PaymentChannel[]>([]);
  const [paymentChannelsLoading, setPaymentChannelsLoading] = useState(false);
  const [paymentChannelsError, setPaymentChannelsError] = useState<string | null>(null);
  const [paymentChannelsReloadKey, setPaymentChannelsReloadKey] = useState(0);
  const [, setPaymentChannelsAvailable] = useState(false);
  const paymentChannelsRequestSeqRef = React.useRef(0);
  const [giftCelebrationOpen, setGiftCelebrationOpen] = useState(false);
  const [giftCelebrated, setGiftCelebrated] = useState(false);
  const [couponQuote, setCouponQuote] = useState<CouponQuote | null>(null);
  const [couponQuoteStatus, setCouponQuoteStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [couponQuoteErrorMessage, setCouponQuoteErrorMessage] = useState<string | null>(null);
  const [couponSelectionErrorMessage, setCouponSelectionErrorMessage] = useState<string | null>(null);
  const [selectedUserCouponId, setSelectedUserCouponId] = useState<number | null>(null);
  const [couponManuallyChanged, setCouponManuallyChanged] = useState(false);
  const [supportPanelOpen, setSupportPanelOpen] = useState(false);
  const [checkoutValidationAnnouncement, setCheckoutValidationAnnouncement] = useState('');
  const [checkoutFieldErrors, setCheckoutFieldErrors] = useState<Record<string, string>>({});
  const [checkoutStatusAnnouncement, setCheckoutStatusAnnouncement] = useState<{ id: number; text: string } | null>(null);
  const initialCheckoutDraftRef = React.useRef<CheckoutFormSnapshot | null>(null);
  if (initialCheckoutDraftRef.current === null) {
    initialCheckoutDraftRef.current = readCheckoutGuestDraftFields() || {};
  }
  const [checkoutFormSnapshot, setCheckoutFormSnapshot] = useState<CheckoutFormSnapshot>(() => initialCheckoutDraftRef.current || {});
  const checkoutFormSnapshotRef = React.useRef<CheckoutFormSnapshot>(initialCheckoutDraftRef.current || {});
  const [, setFormHydrationRevision] = useState(0);
  const submittingRef = React.useRef(false);
  const paymentRetryingRef = React.useRef(false);
  const paymentSimulatingRef = React.useRef(false);
  const couponAutoSelectedQuoteRef = React.useRef<{ cartKey: string; couponId: number } | null>(null);
  const checkoutStatusAnnouncementIdRef = React.useRef(0);
  const mountedRef = React.useRef(true);
  const { t, language } = useLanguage();
  usePageTitle(t('pages.checkout.title'));
  useDocumentMeta({
    title: t('pages.checkout.title'),
    description: t('common.siteDescription'),
    path: '/checkout',
    type: 'website',
    noIndex: true,
    siteName: t('common.siteTitle'),
  });
  const checkoutLocalizationRef = React.useRef({ t, language });
  const announceCheckoutStatus = useCallback((messageText: string) => {
    const text = normalizeCheckoutText(messageText, 500);
    if (!text || !mountedRef.current) return;
    checkoutStatusAnnouncementIdRef.current += 1;
    setCheckoutStatusAnnouncement({ id: checkoutStatusAnnouncementIdRef.current, text });
  }, []);
  const showCheckoutMessage = useCallback((type: CheckoutMessageType, messageText: string) => {
    announceCheckoutStatus(messageText);
    announceAccessibleMessage(messageText, type);
  }, [announceCheckoutStatus]);
  const updateCheckoutValidationAnnouncement = useCallback((fields: CheckoutValidationField[]) => {
    setCheckoutValidationAnnouncement(buildCheckoutValidationAnnouncement(fields, t));
    setCheckoutFieldErrors(buildCheckoutFieldErrorMap(fields));
  }, [t]);
  const renderCheckoutFieldErrorExtra = useCallback((fieldName: string) => {
    const message = checkoutFieldErrors[fieldName];
    if (!message) {
      return undefined;
    }
    return (
      <span className="checkout-page__fieldErrorDescription">
        {message}
      </span>
    );
  }, [checkoutFieldErrors]);
  const checkoutCartItemName = (item: Pick<CartItem, 'productId' | 'productName'>) => (
    (item.productName || '').trim() || t('pages.profile.productFallback', { id: item.productId })
  );
  const dateLocale = language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US';
  useEffect(() => {
    checkoutLocalizationRef.current = { t, language };
  }, [language, t]);
  const mergeCheckoutFormSnapshot = useCallback((updates: CheckoutFormSnapshot, preserveHydratedValues = false) => {
    setCheckoutFormSnapshot((current) => {
      const hydrated = preserveHydratedValues
        ? checkoutGuestDraftFieldNames.reduce((next, fieldName) => {
          if (
            Object.prototype.hasOwnProperty.call(updates || {}, fieldName)
            || hasHydratableCheckoutValue(next[fieldName])
          ) {
            return next;
          }
          const hydratedValue = checkoutFormSnapshotRef.current[fieldName]
            ?? initialCheckoutDraftRef.current?.[fieldName];
          return hasHydratableCheckoutValue(hydratedValue)
            ? { ...next, [fieldName]: hydratedValue }
            : next;
        }, { ...current } as CheckoutFormSnapshot)
        : current;
      const next = mergeDefinedCheckoutFields(hydrated, updates);
      checkoutFormSnapshotRef.current = next;
      return next;
    });
  }, []);
  const watchedPaymentMethodRaw = Form.useWatch('paymentMethod', form);
  const watchedPaymentMethod = typeof watchedPaymentMethodRaw === 'string' ? watchedPaymentMethodRaw : undefined;
  const watchedGuestEmail = Form.useWatch('guestEmail', form);
  const watchedRecipientName = Form.useWatch('recipientName', form);
  const watchedPhone = Form.useWatch('phone', form);
  const watchedRegion = Form.useWatch('region', form);
  const watchedShippingAddress = Form.useWatch('shippingAddress', form);
  const watchedPostalCode = Form.useWatch('postalCode', form);
  const { currency, market, formatMoney } = useMarket();
  const paymentMethodDetails = useMemo(
    () => createPaymentMethodDetails(paymentChannels, { currency }),
    [currency, paymentChannels],
  );
  const paymentMethodsAvailable = paymentMethodDetails.length > 0;
  const isGuestCheckout = !hasAuthenticatedCartSession();
  const hasCheckoutItems = cartItems.length > 0;
  const openSupport = useCallback(() => {
    const token = hasAuthenticatedCartSession();
    const guestOrderNo = createdOrder?.orderNo;
    const guestEmail = guestPaymentEmail || normalizeCheckoutEmail(checkoutFormSnapshot.guestEmail ?? watchedGuestEmail);
    if (!token && (!guestOrderNo || !guestEmail)) {
      dispatchDomEvent('shop:open-support');
      return;
    }
    if (!token && guestOrderNo && guestEmail) {
      saveGuestSupportContext({ orderNo: guestOrderNo, email: guestEmail });
    }
    dispatchDomEvent('shop:open-support', token ? undefined : { orderNo: guestOrderNo, email: guestEmail });
  }, [checkoutFormSnapshot.guestEmail, createdOrder?.orderNo, guestPaymentEmail, watchedGuestEmail]);
  const reloadPaymentChannels = useCallback(() => {
    setPaymentChannelsReloadKey((key) => key + 1);
  }, []);
  const paymentUnavailableRecoveryActions = (
    <div className="checkout-page__paymentUnavailableActions" data-checkout-payment-unavailable-recovery="true">
      <ShopButton
        size="small"
        type="primary"
        loading={paymentChannelsLoading}
        aria-label={t('messages.retry')}
        title={t('messages.retry')}
        onClick={reloadPaymentChannels}
      >
        {t('messages.retry')}
      </ShopButton>
      <ShopButton
        size="small"
        icon={<ShopIcon path={SI.support} />}
        aria-label={t('pages.profile.contactSupport')}
        title={t('pages.profile.contactSupport')}
        onClick={openSupport}
      >
        {t('pages.profile.contactSupport')}
      </ShopButton>
      <ShopButton
        size="small"
        icon={<ShopIcon path={SI.cart} />}
        aria-label={t('pages.cart.title')}
        title={t('pages.cart.title')}
        onClick={() => navigate('/cart')}
      >
        {t('pages.cart.title')}
      </ShopButton>
      <ShopButton
        size="small"
        icon={<ShopIcon path={SI.shopping} />}
        aria-label={t('pages.cart.browse')}
        title={t('pages.cart.browse')}
        onClick={() => navigate('/products')}
      >
        {t('pages.cart.browse')}
      </ShopButton>
      <ShopButton
        size="small"
        icon={<ShopIcon path={SI.gift} />}
        aria-label={t('nav.coupons')}
        title={t('nav.coupons')}
        onClick={() => navigate('/coupons')}
      >
        {t('nav.coupons')}
      </ShopButton>
    </div>
  );
  const recommendedPaymentMethod = useMemo(
    () => getRecommendedPaymentMethod(paymentChannels, currency),
    [currency, paymentChannels],
  );
  const selectCheckoutPaymentMethod = useCallback((methodValue: string) => {
    if (!paymentMethodDetails.some((method) => method.value === methodValue)) {
      return;
    }
    form.setFieldsValue({ paymentMethod: methodValue });
    setSessionStorageItem('checkoutPaymentMethod', methodValue);
  }, [form, paymentMethodDetails]);
  const focusCheckoutPaymentMethod = useCallback((methodValue: string) => {
    window.requestAnimationFrame(() => {
      const target = Array.from(document.querySelectorAll<HTMLButtonElement>('.checkout-page__paymentMethod'))
        .find((button) => button.dataset.paymentMethod === methodValue);
      target?.focus();
    });
  }, []);
  const handleCheckoutPhoneBlur = useCallback((event: React.FocusEvent<HTMLInputElement>) => {
    form.setFieldValue('phone', normalizeLikelyCheckoutPhone(event.target.value));
    window.setTimeout(() => {
      form.validateFields(['phone']).catch(() => undefined);
    }, 0);
  }, [form]);
  const {
    checkoutRegionCascaderOpen,
    regionOptions,
    regionOptionsLoading,
    loadCheckoutRegionOptions,
    setCheckoutRegionCascaderVisibility,
    closeCheckoutRegionCascader,
  } = useCheckoutRegionCascader({
    language,
    mountedRef,
    showCheckoutMessage,
    t,
  });

  const handleCheckoutFormFocusCapture = useCallback((event: React.FocusEvent<HTMLElement>) => {
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.ant-cascader')) {
      closeCheckoutRegionCascader();
    }
    // Commercial mobile: keep focused checkout controls visible above the soft keyboard.
    scrollCheckoutFieldIntoMobileView(target, 'checkout-address-card');
  }, [closeCheckoutRegionCascader]);
  const handleCheckoutFormPointerDownCapture = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.ant-cascader')) {
      closeCheckoutRegionCascader();
    }
  }, [closeCheckoutRegionCascader]);
  const handlePaymentMethodKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>, methodValue: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectCheckoutPaymentMethod(methodValue);
      return;
    }

    const directionByKey: Record<string, number> = {
      ArrowRight: 1,
      ArrowDown: 1,
      ArrowLeft: -1,
      ArrowUp: -1,
    };
    const direction = directionByKey[event.key];
    if (!direction || paymentMethodDetails.length === 0) {
      return;
    }

    event.preventDefault();
    const currentIndex = Math.max(0, paymentMethodDetails.findIndex((method) => method.value === methodValue));
    const nextIndex = (currentIndex + direction + paymentMethodDetails.length) % paymentMethodDetails.length;
    const nextValue = paymentMethodDetails[nextIndex].value;
    selectCheckoutPaymentMethod(nextValue);
    focusCheckoutPaymentMethod(nextValue);
  }, [focusCheckoutPaymentMethod, paymentMethodDetails, selectCheckoutPaymentMethod]);

  useEffect(() => {
    mountedRef.current = true;
    document.body.classList.add('checkout-page-active');
    return () => {
      mountedRef.current = false;
      document.body.classList.remove('checkout-page-active');
      document.body.classList.remove('checkout-region-cascader-open');
    };
  }, []);

  useCheckoutPaymentChannels({
    checkoutLocalizationRef,
    currency,
    form,
    hasCheckoutItems,
    mountedRef,
    paymentChannelsReloadKey,
    paymentChannelsRequestSeqRef,
    setPaymentChannels,
    setPaymentChannelsAvailable,
    setPaymentChannelsError,
    setPaymentChannelsLoading,
  });

  useCheckoutCartBootstrap({
    checkoutReloadKey,
    form,
    language,
    mountedRef,
    mergeCheckoutFormSnapshot,
    navigate,
    setCartItems,
    setAddresses,
    setAddressLoadFailed,
    setCartLoadError,
    setLoading,
    setSelectedAddressId,
    setSelectedUserCouponId,
    setCouponQuote,
    setCouponQuoteErrorMessage,
    setCouponSelectionErrorMessage,
    setFormHydrationRevision,
    showCheckoutMessage,
    t,
  });

  useCheckoutAddressHydrate({
    addresses,
    form,
    hasCheckoutItems,
    isGuestCheckout,
    mergeCheckoutFormSnapshot,
    selectedAddressId,
    setFormHydrationRevision,
  });

  useCheckoutGuestDraft({
    checkoutFormSnapshotRef,
    form,
    hasCheckoutItems,
    initialCheckoutDraftRef,
    isGuestCheckout,
    mergeCheckoutFormSnapshot,
    setFormHydrationRevision,
    watchedGuestEmail,
    watchedPhone,
    watchedPostalCode,
    watchedRecipientName,
    watchedRegion,
    watchedShippingAddress,
  });


  const cartTotal = useMemo(() => roundCartMoney(cartItems.reduce((sum, item) => {
    return sum + getCartLineAmount(item);
  }, 0)), [cartItems]);
  const checkoutItemCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems],
  );

  useCheckoutCouponQuote({
    cartItems,
    cartTotal,
    couponManuallyChanged,
    selectedUserCouponId,
    mountedRef,
    couponAutoSelectedQuoteRef,
    checkoutLocalizationRef,
    setCouponQuote,
    setCouponQuoteStatus,
    setCouponQuoteErrorMessage,
    setCouponSelectionErrorMessage,
    setSelectedUserCouponId,
    showCheckoutMessage,
  });

  const estimatedShippingSummary = useMemo(
    () => deriveCartShippingSummary(cartItems, market.freeShippingThreshold, cartTotal),
    [cartItems, cartTotal, market.freeShippingThreshold],
  );
  const guestShippingFee = estimatedShippingSummary.freeShippingUnlocked ? 0 : market.defaultShippingFee;
  const requiresBackendShippingQuote = !isGuestCheckout && cartItems.length > 0;
  const shippingQuoteFailed = requiresBackendShippingQuote && couponQuoteStatus === 'error';
  const shippingQuoteFallbackActive = shippingQuoteFailed && !selectedUserCouponId;
  const shippingQuoteUnavailable = shippingQuoteFailed && !shippingQuoteFallbackActive;
  const shippingQuoteReady = !requiresBackendShippingQuote
    || (couponQuoteStatus === 'ready' && Boolean(couponQuote))
    || shippingQuoteFallbackActive;
  const shippingQuotePending = requiresBackendShippingQuote && !shippingQuoteReady && !shippingQuoteUnavailable;
  const shippingFee = shippingQuoteReady ? toSafeMoney(couponQuote?.shippingFee ?? guestShippingFee) : 0;
  const freeShippingUnlocked = shippingQuoteReady
    ? shippingFee <= 0
    : estimatedShippingSummary.freeShippingUnlocked;
  const payableAmount = shippingQuoteReady
    ? Math.max(0, toSafeMoney(couponQuote?.payableAmount ?? (cartTotal + shippingFee)))
    : cartTotal;
  const discountAmount = Math.min(cartTotal, toSafeMoney(couponQuote?.discountAmount ?? 0));
  const availableCoupons = useMemo(
    () => (couponQuote && Array.isArray(couponQuote.availableCoupons) ? couponQuote.availableCoupons : []),
    [couponQuote],
  );
  const shippingPolicyText = shippingQuotePending
    ? t('pages.checkout.shippingFeeCalculating')
    : shippingQuoteFallbackActive
      ? t('pages.checkout.shippingFeeFallbackApplied', { fee: formatMoney(shippingFee) })
      : shippingQuoteUnavailable
        ? t('pages.checkout.shippingFeeUnavailable')
        : shippingFee <= 0
          ? t('pages.checkout.shippingPolicyFreeApplied')
          : market.freeShippingThreshold > 0
            ? t('pages.checkout.shippingPolicyStandardWithThreshold', {
              fee: formatMoney(market.defaultShippingFee),
              threshold: formatMoney(market.freeShippingThreshold),
            })
            : t('pages.checkout.shippingPolicyStandardOnly', { fee: formatMoney(market.defaultShippingFee) });
  const shippingQuoteAlertDescription = shippingQuoteFallbackActive
    ? (couponQuoteErrorMessage || t('pages.checkout.shippingFeeFallbackDescription'))
    : shippingQuoteUnavailable
      ? (couponQuoteErrorMessage || t('pages.checkout.shippingFeeUnavailableDescription'))
      : t('pages.checkout.shippingFeeCalculatingDescription');
  const shippingFeeText = shippingQuotePending
    ? t('pages.checkout.shippingFeeCalculatingShort')
    : shippingQuoteUnavailable
      ? t('pages.checkout.shippingFeeUnavailableShort')
      : formatMoney(shippingFee);
  const payableAmountText = shippingQuoteReady ? formatMoney(payableAmount) : shippingFeeText;
  const selectedCoupon = useMemo(
    () => availableCoupons.find((coupon) => coupon.id === selectedUserCouponId),
    [availableCoupons, selectedUserCouponId],
  );
  const bestCouponCandidate = useMemo(
    () => findBestCoupon(availableCoupons, cartTotal),
    [availableCoupons, cartTotal],
  );
  const selectedIsBestCoupon = Boolean(
    selectedUserCouponId && bestCouponCandidate?.coupon.id === selectedUserCouponId,
  );
  const freeShippingRemaining = freeShippingUnlocked ? 0 : estimatedShippingSummary.remainingAmount;
  const freeShippingPercent = freeShippingUnlocked ? 100 : estimatedShippingSummary.progressPercent;
  const deliveryPromise = useMemo(
    () => getDeliveryPromise({ currency, locale: market.locale }),
    [currency, market.locale],
  );
  const giftThreshold = getGiftThreshold(currency);
  const giftEligible = conversionConfig.giftAtCheckout.enabled && giftThreshold > 0;
  const giftRemaining = Math.max(0, giftThreshold - cartTotal);
  const giftUnlocked = giftThreshold > 0 && giftRemaining <= 0;
  const giftProgress = giftThreshold > 0 ? Math.min(100, Math.round((cartTotal / giftThreshold) * 100)) : 100;
  const giftName = t(conversionConfig.giftAtCheckout.giftNameKey);
  const giftConfirmActionLabel = `${t('common.confirm')}: ${t('pages.checkout.giftModalTitle')}, ${giftName}`;
  const addOnTarget = useMemo(
    () => getNearestCartBenefitTarget(cartTotal, freeShippingUnlocked ? 0 : market.freeShippingThreshold, currency),
    [cartTotal, currency, freeShippingUnlocked, market.freeShippingThreshold],
  );
  const selectedSavedAddress = selectedAddressId === 'new'
    ? null
    : addresses.find((address) => String(address.id) === String(selectedAddressId)) || null;
  const selectedSavedAddressRegion = getSavedAddressRegionPath(selectedSavedAddress);
  const selectedSavedAddressPostalCode = getSavedAddressPostalCode(selectedSavedAddress);
  const selectedSavedAddressDetail = getSavedAddressDetail(selectedSavedAddress);
  const selectedAddressLabel = selectedSavedAddress
    ? `${selectedSavedAddress.recipientName || t('pages.checkout.address')}: ${selectedSavedAddress.address}`
    : t('pages.checkout.useNewAddress');
  const checkoutAddressGroupLabel = `${t('pages.checkout.address')}: ${selectedAddressLabel}`;
  const checkoutRegionInputLabel = `${t('pages.checkout.region')}: ${t('pages.checkout.regionRequired')}`;
  const getCheckoutTextValue = (fieldName: CheckoutFormFieldName, values?: CheckoutFormValues): string => firstFilledCheckoutText(
    values?.[fieldName],
    form.getFieldValue(fieldName),
    fieldName === 'guestEmail' ? watchedGuestEmail : undefined,
    fieldName === 'recipientName' ? watchedRecipientName : undefined,
    fieldName === 'phone' ? watchedPhone : undefined,
    fieldName === 'shippingAddress' ? watchedShippingAddress : undefined,
    fieldName === 'postalCode' ? watchedPostalCode : undefined,
    checkoutFormSnapshot[fieldName],
    checkoutFormSnapshotRef.current[fieldName],
    initialCheckoutDraftRef.current?.[fieldName],
  );
  const getCheckoutRegionValue = (values?: CheckoutFormValues): string[] | undefined => firstCheckoutRegionPath(
    values?.region,
    form.getFieldValue('region'),
    watchedRegion,
    checkoutFormSnapshot.region,
    checkoutFormSnapshotRef.current.region,
    initialCheckoutDraftRef.current?.region,
  );
  const currentRecipientName = getCheckoutTextValue('recipientName');
  const currentPhone = getCheckoutTextValue('phone');
  const currentRegion = getCheckoutRegionValue();
  const currentShippingAddress = getCheckoutTextValue('shippingAddress');
  const currentPostalCode = normalizeCheckoutPostalCode(getCheckoutTextValue('postalCode'));
  const newAddressReady = Boolean(
    hasCompleteCheckoutRecipientName(currentRecipientName)
      && isLikelyPhone(currentPhone)
      && Array.isArray(currentRegion)
      && currentRegion.length > 0
      && isValidCheckoutPostalCode(currentPostalCode, currentRegion)
      && hasCompleteCheckoutDetailAddress(currentShippingAddress),
  );
  const selectedAddressReady = selectedAddressId === 'new'
    ? newAddressReady
    : isCompleteSavedAddress(selectedSavedAddress);

  const {
    checkoutBlockingAction,
    checkoutCoachActionLabel,
    checkoutCouponOpportunityActionLabel,
    checkoutNextAction,
    checkoutNextActionLabel,
    checkoutReadinessActionLabel,
    checkoutReadinessItems,
    checkoutReadinessScore,
    checkoutSavingsAddOnsActionLabel,
    couponOpportunity,
    handleCheckoutNextAction,
    handleCouponOpportunityAction,
    handleSupportPanelToggle,
    nextCouponUnlock,
    savingsCoachItems,
    scrollToAddOns,
    selectedPaymentDetail,
  } = useCheckoutConversionCoach({
    addOnTarget,
    availableCoupons,
    cartItemCount: cartItems.length,
    cartTotal,
    checkoutItemCount,
    closeCheckoutRegionCascader,
    discountAmount,
    formatMoney,
    freeShippingRemaining,
    freeShippingUnlocked,
    giftCelebrationOpen,
    giftEligible,
    giftName,
    giftRemaining,
    giftUnlocked,
    isGuestCheckout,
    navigate,
    openSupport,
    paymentMethodsAvailable,
    paymentMethodDetails,
    recommendedPaymentMethod,
    selectedAddressReady,
    selectedCoupon,
    selectedIsBestCoupon,
    setSupportPanelOpen,
    supportPanelOpen,
    t,
    watchedPaymentMethod,
  });

  const selectedPaymentMethodLabel = selectedPaymentDetail?.title || t('pages.checkout.paymentConfidenceDefault');
  const checkoutSubmitActionLabel = shippingQuoteReady
    ? `${t('pages.checkout.submitWithAmount', { amount: payableAmountText })}: ${t('pages.checkout.paymentMethod')} ${selectedPaymentMethodLabel}`
    : `${shippingPolicyText}: ${t('pages.checkout.paymentMethod')} ${selectedPaymentMethodLabel}`;
  const checkoutConfirmationActionLabel = checkoutBlockingAction
    ? `${t('pages.checkout.nextActionTitle')}: ${checkoutNextActionLabel}`
    : `${t('pages.checkout.nextActionReadyTitle')}: ${checkoutSubmitActionLabel}`;
  const checkoutCouponSelectLabel = `${t('pages.checkout.coupon')}: ${t('pages.checkout.selectCoupon')}`;

  const renderSubmitWithAmount = () => {
    if (!shippingQuoteReady) {
      return <span className="checkout-page__submitAmountPending">{shippingFeeText}</span>;
    }
    const amountText = payableAmountText;
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
      text: payableAmountText,
    },
    {
      key: 'shipping',
      title: t('pages.checkout.shippingFee'),
      text: !shippingQuoteReady
        ? shippingFeeText
        : freeShippingRemaining > 0
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
      text: payableAmountText,
    },
    {
      key: 'shipping',
      title: !shippingQuoteReady
        ? shippingPolicyText
        : freeShippingRemaining > 0
        ? t('pages.checkout.readinessFreeShippingGap', { amount: formatMoney(freeShippingRemaining) })
        : t('pages.cart.freeShippingUnlocked'),
      text: shippingQuoteReady ? `${freeShippingPercent}%` : shippingFeeText,
    },
    {
      key: 'payment',
      title: t('pages.checkout.paymentMethod'),
      text: selectedPaymentDetail?.title || t('pages.checkout.paymentConfidenceDefault'),
    },
  ];
  const checkoutSubmitDisabled = submitting
    || !hasCheckoutItems
    || cartItems.some((item) => !isPurchasable(item))
    || !selectedAddressReady
    || !shippingQuoteReady
    || !paymentMethodsAvailable
    || !watchedPaymentMethod;
  const checkoutSubmitDisabledReason = submitting
    ? t('common.loading')
    : !hasCheckoutItems
      ? t('pages.checkout.emptyCart')
      : cartItems.some((item) => !isPurchasable(item))
        ? t('pages.checkout.unavailableSelected')
        : !selectedAddressReady
          ? t('pages.checkout.addressRequired')
          : !shippingQuoteReady
            ? (shippingQuoteUnavailable
              ? t('pages.checkout.shippingFeeUnavailableDescription')
              : t('pages.checkout.shippingFeeCalculatingDescription'))
            : !paymentMethodsAvailable
              ? t('pages.checkout.paymentUnavailableDescription')
              : !watchedPaymentMethod
                ? t('pages.checkout.paymentRequired')
                : '';
  const checkoutSubmitTooltip = checkoutSubmitDisabled && checkoutSubmitDisabledReason
    ? checkoutSubmitDisabledReason
    : checkoutSubmitActionLabel;

  useCheckoutGiftCelebration({
    giftCelebrated,
    giftUnlocked,
    setGiftCelebrated,
    setGiftCelebrationOpen,
  });

  const calculateCouponDiscount = (coupon: UserCoupon) => estimateCouponDiscount(coupon, cartTotal);


  const describeCoupon = (coupon: UserCoupon) => describeCheckoutCoupon(coupon, cartTotal, formatMoney, t);
  const checkoutCouponSelectOptions = useMemo(
    () => availableCoupons.map((coupon) => {
      const couponDiscount = calculateCouponDiscount(coupon);
      return {
        value: String(coupon.id),
        label: couponDiscount > 0
          ? `${describeCoupon(coupon)} - ${t('pages.checkout.couponSaveAmount', { amount: formatMoney(couponDiscount) })}${bestCouponCandidate?.coupon.id === coupon.id ? ` - ${t('pages.checkout.bestCoupon')}` : ''}`
          : describeCoupon(coupon),
        disabled: couponDiscount <= 0,
      };
    }),
    [availableCoupons, bestCouponCandidate?.coupon.id, cartTotal, formatMoney, t],
  );


  const {
    addSuggestedProduct,
    handleRollbackConfirm,
    handleSubmit,
    openPaymentUrl,
    openTrackedOrder,
    retryCreatePayment,
    rollbackPendingPayment,
    simulatePayment,
  } = useCheckoutOrderActions({
    addresses,
    cartItems,
    checkoutCartItemName,
    getCheckoutRegionValue,
    getCheckoutTextValue,
    closeCheckoutRegionCascader,
    createdOrder,
    guestPaymentEmail,
    language,
    navigate,
    payment,
    paymentCreateRequestSeqRef,
    paymentMethodsAvailable,
    paymentMethodDetails,
    paymentRetryingRef,
    paymentSimulatingRef,
    pendingPaymentMethod,
    requiresBackendShippingQuote,
    selectedAddressId,
    selectedSavedAddress,
    selectedSavedAddressDetail,
    selectedSavedAddressPostalCode,
    selectedSavedAddressRegion,
    selectedUserCouponId,
    setAddresses,
    setCancelingPayment,
    setCartItems,
    setCouponQuote,
    setCreatedOrder,
    setGuestPaymentEmail,
    setPaying,
    setPayment,
    setPaymentCreateError,
    setPendingPaymentMethod,
    setRollbackConfirmOpen,
    setSelectedAddressId,
    setSelectedUserCouponId,
    setSimulatingPayment,
    setSubmitting,
    setCheckoutValidationAnnouncement,
    shippingQuoteReady,
    shippingQuoteUnavailable,
    showCheckoutMessage,
    submittedCartItemsRef,
    submittingRef,
    t,
    readGuestCartSnapshot,
  });

  const createdOrderId = createdOrder?.id;
  const createdOrderNo = createdOrder?.orderNo;
  const paymentStatus = payment?.status;

  useCheckoutPaymentLifecycle({
    createdOrderId,
    createdOrderNo,
    guestPaymentEmail,
    payment,
    paymentStatus,
    pendingPaymentMethod,
    setPayment,
    setCreatedOrder,
    setPaymentCreateError,
    showCheckoutMessage,
    t,
  });


  const renderCheckoutStatusLiveRegion = () => (
    <div
      className="checkout-page__statusLiveRegion"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label={t('pages.checkout.statusAnnouncementLabel')}
    >
      {checkoutStatusAnnouncement ? (
        <span key={checkoutStatusAnnouncement.id}>{checkoutStatusAnnouncement.text}</span>
      ) : null}
    </div>
  );

  if (loading) {
    return (
      <CheckoutLoadingShell
        form={form}
        language={language}
        t={t}
        statusLiveRegion={renderCheckoutStatusLiveRegion()}
      />
    );
  }

  if (createdOrder && !payment) {
    return (
      <CheckoutPaymentPendingShell
        language={language}
        t={t}
        statusLiveRegion={renderCheckoutStatusLiveRegion()}
        createdOrder={createdOrder}
        formatMoney={formatMoney}
        paying={paying}
        cancelingPayment={cancelingPayment}
        paymentCreateError={paymentCreateError}
        guestPaymentEmail={guestPaymentEmail}
        onRetryPayment={retryCreatePayment}
        onRollbackPayment={rollbackPendingPayment}
        onViewOrder={() => navigate('/profile?tab=orders')}
        onTrackOrder={openTrackedOrder}
        onBackHome={() => navigate('/')}
      />
    );
  }

  if (createdOrder && payment) {
    return (
      <CheckoutPaymentActiveShell
        language={language}
        t={t}
        dateLocale={dateLocale}
        statusLiveRegion={renderCheckoutStatusLiveRegion()}
        createdOrder={createdOrder}
        payment={payment}
        formatMoney={formatMoney}
        paying={paying}
        cancelingPayment={cancelingPayment}
        simulatingPayment={simulatingPayment}
        paymentSimulationEnabled={paymentSimulationEnabled}
        guestPaymentEmail={guestPaymentEmail}
        onOpenPayment={openPaymentUrl}
        onRetryPayment={retryCreatePayment}
        onRollbackPayment={rollbackPendingPayment}
        onViewOrder={() => navigate('/profile?tab=orders')}
        onTrackOrder={openTrackedOrder}
        onBackHome={() => navigate('/')}
        onSimulatePayment={simulatePayment}
        onOpenSupport={openSupport}
        onOpenPaymentInstructions={() => navigate(`/payment/${encodeURIComponent(String(createdOrder.orderNo || createdOrder.id))}${guestPaymentEmail ? `?guestEmail=${encodeURIComponent(guestPaymentEmail)}` : ''}`)}
      />
    );
  }

  if (cartLoadError && !createdOrder) {
    return (
      <CheckoutCartLoadErrorShell
        form={form}
        language={language}
        t={t}
        statusLiveRegion={renderCheckoutStatusLiveRegion()}
        cartLoadError={cartLoadError}
        onRetry={() => setCheckoutReloadKey((key) => key + 1)}
        onCart={() => navigate('/cart')}
        onBrowse={() => navigate('/products')}
        onCoupons={() => navigate('/coupons')}
      />
    );
  }

  if (cartItems.length === 0) {
    return (
      <CheckoutEmptyShell
        form={form}
        language={language}
        t={t}
        statusLiveRegion={renderCheckoutStatusLiveRegion()}
        freeShippingThreshold={market.freeShippingThreshold}
        formatMoney={formatMoney}
        onCart={() => navigate('/cart')}
        onBrowse={() => navigate('/products')}
        onCoupons={() => navigate('/coupons')}
        onPetFinder={() => navigate('/pet-finder')}
        onHistory={() => navigate('/history')}
      />
    );
  }

  return (
    <div className={`checkout-page checkout-page--${language}`}>
      <ShopBreadcrumb
        ariaLabel={t('pages.checkout.title')}
        items={[
          { key: 'home', label: t('nav.ariaHome'), path: '/' },
          { key: 'cart', label: t('pages.cart.title'), path: '/cart' },
          { key: 'checkout', label: t('pages.checkout.title') },
        ]}
      />
      <CheckoutHeroSection t={t} highlights={checkoutHeroHighlights} />
      <CheckoutSummaryStrip cards={checkoutSummaryCards} />

      <CheckoutConfirmationBand
        t={t}
        checkoutBlockingAction={checkoutBlockingAction}
        checkoutNextAction={checkoutNextAction}
        checkoutReadinessScore={checkoutReadinessScore}
        checkoutItemCount={checkoutItemCount}
        payableAmountText={payableAmountText}
        shippingQuoteReady={shippingQuoteReady}
        selectedPaymentTitle={selectedPaymentDetail?.title}
        submitting={submitting}
        checkoutSubmitDisabled={checkoutSubmitDisabled}
        checkoutConfirmationActionLabel={checkoutConfirmationActionLabel}
        checkoutSubmitActionLabel={checkoutSubmitActionLabel}
        checkoutSubmitTooltip={checkoutSubmitTooltip}
        checkoutNextActionLabel={checkoutNextActionLabel}
        shippingFeeText={shippingFeeText}
        onNextAction={handleCheckoutNextAction}
        onSubmit={() => form.submit()}
      />

      <CheckoutTrustBar t={t} />

      <CheckoutExpressPaymentGrid
        t={t}
        paymentMethodsAvailable={paymentMethodsAvailable}
        paymentChannelsError={paymentChannelsError}
        paymentUnavailableRecoveryActions={paymentUnavailableRecoveryActions}
        paymentMethodDetails={paymentMethodDetails}
        watchedPaymentMethod={watchedPaymentMethod}
        recommendedPaymentMethod={recommendedPaymentMethod}
        onSelectMethod={selectCheckoutPaymentMethod}
        onMethodKeyDown={handlePaymentMethodKeyDown}
      />

      <CheckoutBenefitStrip
        t={t}
        freeShippingRemaining={freeShippingRemaining}
        freeShippingPercent={freeShippingPercent}
        formatMoney={formatMoney}
        deliveryPromise={deliveryPromise}
        giftEligible={giftEligible}
        giftUnlocked={giftUnlocked}
        giftRemaining={giftRemaining}
        giftProgress={giftProgress}
        giftName={giftName}
      />

      <ShopModal
        open={giftCelebrationOpen}
        title={t('pages.checkout.giftModalTitle')}
        onClose={() => setGiftCelebrationOpen(false)}
        footer={<ShopButton type="primary" aria-label={giftConfirmActionLabel} title={giftConfirmActionLabel} onClick={() => setGiftCelebrationOpen(false)}>{t('common.confirm')}</ShopButton>}
        className="profile-mobile-safe-modal checkout-page__giftCelebrationModal"
        rootClassName="checkout-page__giftCelebrationModalRoot"
        closeLabel={t('common.close', { defaultValue: 'Close' })}
        ariaLabel={t('pages.checkout.giftModalTitle')}
      >
        <div className="checkout-page__giftModal">
          <span className="checkout-page__giftIcon"><ShopIcon path={SI.gift} /></span>
          <span className="checkout-page__text">{t('pages.checkout.giftModalText', { gift: t(conversionConfig.giftAtCheckout.giftNameKey) })}</span>
        </div>
      </ShopModal>
      <ShopConfirm
        open={rollbackConfirmOpen}
        title={t('pages.checkout.rollbackPaymentTitle')}
        description={t('pages.checkout.rollbackPaymentContent')}
        okText={t('pages.checkout.rollbackPaymentAction')}
        cancelText={t('common.cancel')}
        confirmLoading={cancelingPayment}
        okButtonProps={{
          danger: true,
          'aria-label': createdOrder
            ? `${t('pages.checkout.rollbackPaymentAction')}: ${t('pages.paymentInstructions.orderNo')} ${createdOrder.orderNo || createdOrder.id}, ${formatMoney(createdOrder.totalAmount)}`
            : t('pages.checkout.rollbackPaymentAction'),
          title: createdOrder
            ? `${t('pages.checkout.rollbackPaymentAction')}: ${t('pages.paymentInstructions.orderNo')} ${createdOrder.orderNo || createdOrder.id}, ${formatMoney(createdOrder.totalAmount)}`
            : t('pages.checkout.rollbackPaymentAction'),
        }}
        cancelButtonProps={{
          'aria-label': `${t('common.cancel')}: ${t('pages.checkout.rollbackPaymentAction')}`,
          title: `${t('common.cancel')}: ${t('pages.checkout.rollbackPaymentAction')}`,
        }}
        className="profile-mobile-safe-modal checkout-page__rollbackConfirmModal"
        closeLabel={t('common.close', { defaultValue: 'Close' })}
        onOk={handleRollbackConfirm}
        onCancel={() => { if (!cancelingPayment) setRollbackConfirmOpen(false); }}
      />

      <CheckoutSupportCoachPanel
        t={t}
        supportPanelOpen={supportPanelOpen}
        onSupportPanelToggle={handleSupportPanelToggle}
        checkoutNextAction={checkoutNextAction}
        checkoutReadinessScore={checkoutReadinessScore}
        savingsCoachItems={savingsCoachItems}
        addOnTarget={addOnTarget}
        cartProductIds={cartItems.map((item) => item.productId)}
        savingsAddOnsActionLabel={checkoutSavingsAddOnsActionLabel}
        onScrollToAddOns={scrollToAddOns}
        onAddSuggestedProduct={addSuggestedProduct}
        couponOpportunity={couponOpportunity}
        couponOpportunityActionLabel={checkoutCouponOpportunityActionLabel}
        onCouponOpportunityAction={handleCouponOpportunityAction}
        checkoutReadinessItems={checkoutReadinessItems}
        readinessActionLabel={checkoutReadinessActionLabel}
        coachActionLabel={checkoutCoachActionLabel}
        onNextAction={handleCheckoutNextAction}
      />

      <CheckoutItemsCard
        t={t}
        language={language}
        cartItems={cartItems}
        checkoutItemCount={checkoutItemCount}
        cartTotal={cartTotal}
        formatMoney={formatMoney}
        resolveImage={(imageUrl) => resolveCheckoutImage(imageUrl || undefined)}
        imageFallback={checkoutImageFallback}
        itemName={checkoutCartItemName}
        onOpenProduct={(productId) => navigate(`/products/${productId}`)}
      />

      <Form
        form={form}
        layout="vertical"
        initialValues={checkoutFormSnapshot}
        onFinish={handleSubmit}
        onFinishFailed={(info) => {
          closeCheckoutRegionCascader();
          updateCheckoutValidationAnnouncement(info.errorFields);
          focusFirstCheckoutValidationError(info.errorFields as CheckoutValidationField[]);
        }}
        onFieldsChange={(_, allFields) => updateCheckoutValidationAnnouncement(allFields)}
        onValuesChange={(changedValues) => {
          mergeCheckoutFormSnapshot(changedValues, true);
        }}
        onFocusCapture={handleCheckoutFormFocusCapture}
        onPointerDownCapture={handleCheckoutFormPointerDownCapture}
      >
        {renderCheckoutStatusLiveRegion()}
        <div
          className="checkout-page__validationLiveRegion"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          aria-label={t('pages.checkout.validationErrorAnnouncementLabel')}
        >
          {checkoutValidationAnnouncement}
        </div>
        {isGuestCheckout ? (
          <CheckoutGuestContactSection
            t={t}
            fieldErrorExtra={renderCheckoutFieldErrorExtra}
          />
        ) : null}

        <CheckoutAddressSection
          t={t}
          addresses={addresses}
          addressLoadFailed={addressLoadFailed}
          selectedAddressId={selectedAddressId}
          addressGroupLabel={checkoutAddressGroupLabel}
          regionOptions={regionOptions}
          regionOptionsLoading={regionOptionsLoading}
          regionInputLabel={checkoutRegionInputLabel}
          regionCascaderOpen={checkoutRegionCascaderOpen}
          fieldErrorExtra={renderCheckoutFieldErrorExtra}
          onRetryAddressLoad={() => setCheckoutReloadKey((key) => key + 1)}
          onSelectAddress={setSelectedAddressId}
          onRegionOpenChange={(open) => {
            if (open) void loadCheckoutRegionOptions();
            setCheckoutRegionCascaderVisibility(open);
          }}
          onPhoneBlur={handleCheckoutPhoneBlur}
          onPostalCodeBlur={(event) => form.setFieldValue('postalCode', normalizeCheckoutPostalCode(event.target.value))}
        />

        <CheckoutCouponAndSummarySection
          t={t}
          isGuestCheckout={isGuestCheckout}
          formatMoney={formatMoney}
          cartTotal={cartTotal}
          discountAmount={discountAmount}
          couponSelectLabel={checkoutCouponSelectLabel}
          couponOptions={checkoutCouponSelectOptions}
          selectedUserCouponId={selectedUserCouponId}
          couponSelectionErrorMessage={couponSelectionErrorMessage}
          selectedCouponName={selectedCoupon?.couponName}
          selectedIsBestCoupon={selectedIsBestCoupon}
          showCouponRulesNotMet={Boolean(couponQuote && availableCoupons.length > 0 && !availableCoupons.some((coupon) => calculateCouponDiscount(coupon) > 0))}
          shippingQuoteReady={shippingQuoteReady}
          shippingFeeText={shippingFeeText}
          shippingPolicyText={shippingPolicyText}
          shippingQuotePending={shippingQuotePending}
          shippingQuoteUnavailable={shippingQuoteUnavailable}
          shippingQuoteFallbackActive={shippingQuoteFallbackActive}
          shippingQuoteAlertDescription={shippingQuoteAlertDescription}
          payableAmountText={payableAmountText}
          onSelectCoupon={(value) => {
            couponAutoSelectedQuoteRef.current = null;
            setCouponManuallyChanged(true);
            setCouponQuoteErrorMessage(null);
            setCouponSelectionErrorMessage(null);
            setSelectedUserCouponId(value ? Number(value) : null);
          }}
        />


        <CheckoutSubmitPaymentSection
          t={t}
          paymentMethodsAvailable={paymentMethodsAvailable}
          paymentChannelsError={paymentChannelsError}
          paymentUnavailableRecoveryActions={paymentUnavailableRecoveryActions}
          selectedPaymentTitle={selectedPaymentDetail?.title}
          checkoutItemCount={checkoutItemCount}
          payableAmountText={payableAmountText}
          shippingQuoteReady={shippingQuoteReady}
          submitting={submitting}
          checkoutSubmitDisabled={checkoutSubmitDisabled}
          checkoutSubmitActionLabel={checkoutSubmitActionLabel}
          checkoutSubmitTooltip={checkoutSubmitTooltip}
          submitButtonContent={renderSubmitWithAmount()}
          checkoutBlockingAction={checkoutBlockingAction}
          checkoutNextAction={checkoutNextAction}
          checkoutCoachActionLabel={checkoutCoachActionLabel}
          checkoutNextActionLabel={checkoutNextActionLabel}
          checkoutConfirmationActionLabel={checkoutConfirmationActionLabel}
          paymentChannelsLoading={paymentChannelsLoading}
          onReloadPaymentChannels={reloadPaymentChannels}
          onOpenSupport={openSupport}
          onCart={() => navigate('/cart')}
          onBrowse={() => navigate('/products')}
          onCoupons={() => navigate('/coupons')}
          onNextAction={handleCheckoutNextAction}
        />
      </Form>
    </div>
  );
};

const Checkout: React.FC = () => {
  const [form] = Form.useForm<CheckoutFormValues>();

  return (
    <Form form={form} component={false} validateTrigger={["onChange", "onBlur"]} requiredMark>
      <CheckoutContent form={form} />
    </Form>
  );
};

export default Checkout;
