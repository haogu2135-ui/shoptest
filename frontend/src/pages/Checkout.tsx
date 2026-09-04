import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { ShopIcon, SI } from '../components/ShopIcon';
import { Form } from 'antd';
import ShopButton from '../components/ShopButton';
import type { FormInstance } from 'antd/es/form';
import { useNavigate } from 'react-router-dom';
import type { CartItem, CouponQuote, OrderCustomer, PaymentCustomer, PaymentChannel, ProductPublic as Product, UserAddress } from '../types';
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
import { useCheckoutCartTotals, useCheckoutDerivedTotals } from '../hooks/useCheckoutDerivedTotals';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { createPaymentMethodDetails } from '../utils/paymentMethods';
import { useMarket } from '../hooks/useMarket';
import { formatSelectedSpecs } from '../utils/selectedSpecs';
import { getGuestCartItems } from '../utils/guestCart';
import { clearCheckoutCartItemIds, hasAuthenticatedCartSession, readCheckoutCartItemIds, syncCheckoutCartItemIds } from '../utils/cartSession';
import { getApiErrorMessage } from '../utils/apiError';
import { dispatchDomEvent } from '../utils/domEvents';
import { saveGuestSupportContext } from '../utils/guestSupportContext';
import { setSessionStorageItem, removeSessionStorageItem } from '../utils/safeStorage';
import {
  CheckoutCartLoadErrorShell,
  CheckoutEmptyShell,
  CheckoutLoadingShell,
  CheckoutPaymentActiveShell,
  CheckoutPaymentPendingShell,
} from '../components/checkout/CheckoutShellStates';
import { CheckoutMainShell } from '../components/checkout/CheckoutMainShell';
import {
  buildCheckoutAddressGroupLabel,
  buildCheckoutMainShellProps,
  buildCheckoutLoadingShellProps,
  buildCheckoutPaymentPendingShellProps,
  buildCheckoutPaymentActiveShellProps,
  buildCheckoutCartLoadErrorShellProps,
  buildCheckoutEmptyShellProps,
  buildCheckoutPaymentUnavailableRecoveryDescriptors,
  buildCheckoutConfirmationActionLabel,
  buildCheckoutCouponSelectLabel,
  buildCheckoutFieldErrorMap,
  buildCheckoutHeroHighlights,
  buildCheckoutRegionInputLabel,
  buildCheckoutSelectedAddressLabel,
  buildCheckoutSubmitActionLabel,
  buildCheckoutSubmitTooltip,
  buildCheckoutSummaryCards,
  buildCheckoutValidationAnnouncement,
  checkoutGuestDraftFieldNames,
  firstCheckoutRegionPath,
  firstFilledCheckoutText,
  getRecommendedPaymentMethod,
  getCheckoutAddressChoiceIds,
  getNextCheckoutAddressChoiceId,
  getSavedAddressDetail,
  getSavedAddressPostalCode,
  getSavedAddressRegionPath,
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
  resolveCheckoutNewAddressReady,
  resolveCheckoutSelectedAddressReady,
  resolveCheckoutSubmitState,
  toSafeMoney,
  readCheckoutGuestDraftFields,
  readCheckoutPendingOrder,
  type CheckoutFormFieldName,
  type CheckoutValidationField,
  type CheckoutFormSnapshot,
  type CheckoutFormValues,
  type CheckoutMessageType,
  type CheckoutPendingOrderSnapshot,
} from '../utils/checkoutHelpers';
import {
  focusFirstCheckoutValidationError,
  scrollCheckoutFieldIntoMobileView,
} from '../utils/checkoutDom';
import './Checkout.css';

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
  getCheckoutAddressChoiceIds,
  getNextCheckoutAddressChoiceId,
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

const readGuestCartSnapshot = () => {
  const items = getGuestCartItems();
  return Array.isArray(items) ? items : [];
};

const areCheckoutFieldErrorMapsEqual = (current: Record<string, string>, next: Record<string, string>) => {
  const currentKeys = Object.keys(current);
  const nextKeys = Object.keys(next);
  return currentKeys.length === nextKeys.length
    && currentKeys.every((key) => current[key] === next[key]);
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
  const [checkoutValidationAnnouncement, setCheckoutValidationAnnouncementState] = useState('');
  const [checkoutFieldErrors, setCheckoutFieldErrorsState] = useState<Record<string, string>>({});
  const checkoutValidationAnnouncementRef = React.useRef('');
  const checkoutFieldErrorsRef = React.useRef<Record<string, string>>({});
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
  const setCheckoutValidationAnnouncement = useCallback((next: React.SetStateAction<string>) => {
    const resolved = typeof next === 'function'
      ? (next as (current: string) => string)(checkoutValidationAnnouncementRef.current)
      : next;
    if (checkoutValidationAnnouncementRef.current === resolved) return;
    checkoutValidationAnnouncementRef.current = resolved;
    setCheckoutValidationAnnouncementState(resolved);
  }, []);
  const updateCheckoutValidationAnnouncement = useCallback((fields: CheckoutValidationField[]) => {
    const nextAnnouncement = buildCheckoutValidationAnnouncement(fields, t);
    const nextFieldErrors = buildCheckoutFieldErrorMap(fields);
    if (checkoutValidationAnnouncementRef.current !== nextAnnouncement) {
      checkoutValidationAnnouncementRef.current = nextAnnouncement;
      setCheckoutValidationAnnouncementState(nextAnnouncement);
    }
    if (!areCheckoutFieldErrorMapsEqual(checkoutFieldErrorsRef.current, nextFieldErrors)) {
      checkoutFieldErrorsRef.current = nextFieldErrors;
      setCheckoutFieldErrorsState(nextFieldErrors);
    }
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
      {buildCheckoutPaymentUnavailableRecoveryDescriptors({ t }).map((item) => {
        const iconPath = item.iconKey === 'support'
          ? SI.support
          : item.iconKey === 'cart'
            ? SI.cart
            : item.iconKey === 'shopping'
              ? SI.shopping
              : item.iconKey === 'gift'
                ? SI.gift
                : undefined;
        const onClick = () => {
          if (item.intent === 'retry') {
            reloadPaymentChannels();
            return;
          }
          if (item.intent === 'support') {
            openSupport();
            return;
          }
          if (item.intent === 'cart') {
            navigate('/cart');
            return;
          }
          if (item.intent === 'browse') {
            navigate('/products');
            return;
          }
          navigate('/coupons');
        };
        return (
          <ShopButton
            key={item.key}
            size="small"
            type={item.primary ? 'primary' : undefined}
            loading={item.intent === 'retry' ? paymentChannelsLoading : undefined}
            icon={iconPath ? <ShopIcon path={iconPath} /> : undefined}
            aria-label={item.label}
            title={item.label}
            onClick={onClick}
          >
            {item.label}
          </ShopButton>
        );
      })}
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
  const focusCheckoutAddressChoice = useCallback((addressId: number | 'new') => {
    window.requestAnimationFrame(() => {
      const target = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-checkout-address-choice]'))
        .find((button) => button.dataset.checkoutAddressChoice === String(addressId));
      target?.focus();
    });
  }, []);
  const handleCheckoutAddressKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>, addressId: number | 'new') => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setSelectedAddressId(addressId);
      return;
    }

    const nextAddressId = getNextCheckoutAddressChoiceId(
      getCheckoutAddressChoiceIds(addresses),
      addressId,
      event.key,
    );
    if (nextAddressId === null) return;

    event.preventDefault();
    setSelectedAddressId(nextAddressId);
    focusCheckoutAddressChoice(nextAddressId);
  }, [addresses, focusCheckoutAddressChoice]);
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


  const { cartTotal, checkoutItemCount } = useCheckoutCartTotals(cartItems);

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

  const {
    requiresBackendShippingQuote,
    shippingQuoteFallbackActive,
    shippingQuoteUnavailable,
    shippingQuoteReady,
    shippingQuotePending,
    freeShippingUnlocked,
    discountAmount,
    freeShippingRemaining,
    freeShippingPercent,
    availableCoupons,
    shippingPolicyText,
    shippingQuoteAlertDescription,
    shippingFeeText,
    payableAmountText,
    selectedCoupon,
    selectedIsBestCoupon,
    deliveryPromise,
    giftEligible,
    giftRemaining,
    giftUnlocked,
    giftProgress,
    giftName,
    giftConfirmActionLabel,
    addOnTarget,
    calculateCouponDiscount,
    checkoutCouponSelectOptions,
  } = useCheckoutDerivedTotals({
    cartItems,
    cartTotal,
    market,
    currency,
    isGuestCheckout,
    couponQuote,
    couponQuoteStatus,
    selectedUserCouponId,
    couponQuoteErrorMessage,
    formatMoney,
    t,
  });

  const selectedSavedAddress = selectedAddressId === 'new'
    ? null
    : addresses.find((address) => String(address.id) === String(selectedAddressId)) || null;
  const selectedSavedAddressRegion = getSavedAddressRegionPath(selectedSavedAddress);
  const selectedSavedAddressPostalCode = getSavedAddressPostalCode(selectedSavedAddress);
  const selectedSavedAddressDetail = getSavedAddressDetail(selectedSavedAddress);
  const selectedAddressLabel = buildCheckoutSelectedAddressLabel({ t, selectedSavedAddress });
  const checkoutAddressGroupLabel = buildCheckoutAddressGroupLabel({ t, selectedAddressLabel });
  const checkoutRegionInputLabel = buildCheckoutRegionInputLabel(t);
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
  const newAddressReady = resolveCheckoutNewAddressReady({
    recipientName: currentRecipientName,
    phone: currentPhone,
    region: currentRegion,
    postalCode: currentPostalCode,
    shippingAddress: currentShippingAddress,
  });
  const selectedAddressReady = resolveCheckoutSelectedAddressReady({
    selectedAddressId,
    newAddressReady,
    selectedSavedAddress,
  });

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
  const checkoutSubmitActionLabel = buildCheckoutSubmitActionLabel({
    t,
    shippingQuoteReady,
    payableAmountText,
    shippingPolicyText,
    selectedPaymentMethodLabel,
  });
  const checkoutConfirmationActionLabel = buildCheckoutConfirmationActionLabel({
    t,
    checkoutBlockingAction,
    checkoutNextActionLabel,
    checkoutSubmitActionLabel,
  });
  const checkoutCouponSelectLabel = buildCheckoutCouponSelectLabel(t);

  const checkoutHeroHighlights = buildCheckoutHeroHighlights({
    t,
    formatMoney,
    payableAmountText,
    shippingQuoteReady,
    shippingFeeText,
    freeShippingRemaining,
    selectedPaymentTitle: selectedPaymentDetail?.title,
  });
  const checkoutSummaryCards = buildCheckoutSummaryCards({
    t,
    formatMoney,
    payableAmountText,
    shippingQuoteReady,
    shippingPolicyText,
    freeShippingRemaining,
    freeShippingPercent,
    shippingFeeText,
    selectedPaymentTitle: selectedPaymentDetail?.title,
  });
  const {
    checkoutSubmitDisabled,
    checkoutSubmitDisabledReason,
  } = resolveCheckoutSubmitState({
    t,
    submitting,
    hasCheckoutItems,
    cartItems,
    selectedAddressReady,
    shippingQuoteReady,
    shippingQuoteUnavailable,
    paymentMethodsAvailable,
    watchedPaymentMethod,
  });
  const checkoutSubmitTooltip = buildCheckoutSubmitTooltip({
    checkoutSubmitDisabled,
    checkoutSubmitDisabledReason,
    checkoutSubmitActionLabel,
  });

  useCheckoutGiftCelebration({
    giftCelebrated,
    giftUnlocked,
    setGiftCelebrated,
    setGiftCelebrationOpen,
  });

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
    mountedRef,
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
        {...buildCheckoutLoadingShellProps({
          form,
          language,
          t,
          statusLiveRegion: renderCheckoutStatusLiveRegion(),
        })}
      />
    );
  }

  if (createdOrder && !payment) {
    return (
      <CheckoutPaymentPendingShell
        {...buildCheckoutPaymentPendingShellProps({
          language,
          t,
          statusLiveRegion: renderCheckoutStatusLiveRegion(),
          createdOrder,
          formatMoney,
          paying,
          cancelingPayment,
          paymentCreateError,
          guestPaymentEmail,
          onRetryPayment: retryCreatePayment,
          onRollbackPayment: rollbackPendingPayment,
          onViewOrder: () => navigate('/profile?tab=orders'),
          onTrackOrder: openTrackedOrder,
          onBackHome: () => navigate('/'),
        })}
      />
    );
  }

  if (createdOrder && payment) {
    return (
      <CheckoutPaymentActiveShell
        {...buildCheckoutPaymentActiveShellProps({
          language,
          t,
          dateLocale,
          statusLiveRegion: renderCheckoutStatusLiveRegion(),
          createdOrder,
          payment,
          formatMoney,
          paying,
          cancelingPayment,
          simulatingPayment,
          paymentSimulationEnabled,
          guestPaymentEmail,
          onOpenPayment: openPaymentUrl,
          onRetryPayment: retryCreatePayment,
          onRollbackPayment: rollbackPendingPayment,
          onViewOrder: () => navigate('/profile?tab=orders'),
          onTrackOrder: openTrackedOrder,
          onBackHome: () => navigate('/'),
          onSimulatePayment: simulatePayment,
          onOpenSupport: openSupport,
          onOpenPaymentInstructions: () => navigate(`/payment/${encodeURIComponent(String(createdOrder.orderNo || createdOrder.id))}`),
        })}
      />
    );
  }

  if (cartLoadError && !createdOrder) {
    return (
      <CheckoutCartLoadErrorShell
        {...buildCheckoutCartLoadErrorShellProps({
          form,
          language,
          t,
          statusLiveRegion: renderCheckoutStatusLiveRegion(),
          cartLoadError,
          onRetry: () => setCheckoutReloadKey((key) => key + 1),
          onCart: () => navigate('/cart'),
          onBrowse: () => navigate('/products'),
          onCoupons: () => navigate('/coupons'),
        })}
      />
    );
  }

  if (cartItems.length === 0) {
    return (
      <CheckoutEmptyShell
        {...buildCheckoutEmptyShellProps({
          form,
          language,
          t,
          statusLiveRegion: renderCheckoutStatusLiveRegion(),
          freeShippingThreshold: market.freeShippingThreshold,
          formatMoney,
          onCart: () => navigate('/cart'),
          onBrowse: () => navigate('/products'),
          onCoupons: () => navigate('/coupons'),
          onPetFinder: () => navigate('/pet-finder'),
          onHistory: () => navigate('/history'),
        })}
      />
    );
  }

  const shellProps = buildCheckoutMainShellProps({
    language,
    t,
    checkoutHeroHighlights,
    checkoutSummaryCards,
    checkoutBlockingAction,
    checkoutNextAction,
    checkoutReadinessScore,
    checkoutItemCount,
    payableAmountText,
    shippingQuoteReady,
    selectedPaymentDetail,
    submitting,
    checkoutSubmitDisabled,
    checkoutConfirmationActionLabel,
    checkoutSubmitActionLabel,
    checkoutSubmitTooltip,
    checkoutNextActionLabel,
    shippingFeeText,
    handleCheckoutNextAction,
    form,
    paymentMethodsAvailable,
    paymentChannelsError,
    paymentUnavailableRecoveryActions,
    paymentMethodDetails,
    watchedPaymentMethod,
    recommendedPaymentMethod,
    selectCheckoutPaymentMethod,
    handlePaymentMethodKeyDown,
    freeShippingRemaining,
    freeShippingPercent,
    formatMoney,
    deliveryPromise,
    giftEligible,
    giftUnlocked,
    giftRemaining,
    giftProgress,
    giftName,
    giftCelebrationOpen,
    setGiftCelebrationOpen,
    giftConfirmActionLabel,
    rollbackConfirmOpen,
    cancelingPayment,
    createdOrder,
    handleRollbackConfirm,
    setRollbackConfirmOpen,
    supportPanelOpen,
    handleSupportPanelToggle,
    savingsCoachItems,
    addOnTarget,
    cartItems,
    checkoutSavingsAddOnsActionLabel,
    scrollToAddOns,
    addSuggestedProduct,
    couponOpportunity,
    couponOpportunityActionLabel: checkoutCouponOpportunityActionLabel,
    handleCouponOpportunityAction,
    checkoutReadinessItems,
    checkoutReadinessActionLabel,
    checkoutCoachActionLabel,
    checkoutCartItemName,
    navigate,
    checkoutFormSnapshot,
    handleSubmit,
    closeCheckoutRegionCascader,
    updateCheckoutValidationAnnouncement,
    focusFirstCheckoutValidationError,
    mergeCheckoutFormSnapshot,
    handleCheckoutFormFocusCapture,
    handleCheckoutFormPointerDownCapture,
    checkoutStatusAnnouncement,
    checkoutValidationAnnouncement,
    isGuestCheckout,
    renderCheckoutFieldErrorExtra,
    addresses,
    addressLoadFailed,
    selectedAddressId,
    checkoutAddressGroupLabel,
    regionOptions,
    regionOptionsLoading,
    checkoutRegionInputLabel,
    checkoutRegionCascaderOpen,
    setCheckoutReloadKey,
    setSelectedAddressId,
    handleCheckoutAddressKeyDown,
    loadCheckoutRegionOptions,
    setCheckoutRegionCascaderVisibility,
    handleCheckoutPhoneBlur,
    cartTotal,
    discountAmount,
    checkoutCouponSelectLabel,
    checkoutCouponSelectOptions,
    selectedUserCouponId,
    couponSelectionErrorMessage,
    selectedCoupon,
    selectedIsBestCoupon,
    couponQuote,
    availableCoupons,
    calculateCouponDiscount,
    shippingPolicyText,
    shippingQuotePending,
    shippingQuoteUnavailable,
    shippingQuoteFallbackActive,
    shippingQuoteAlertDescription,
    couponAutoSelectedQuoteRef,
    setCouponManuallyChanged,
    setCouponQuoteErrorMessage,
    setCouponSelectionErrorMessage,
    setSelectedUserCouponId,
    paymentChannelsLoading,
    reloadPaymentChannels,
    openSupport,
  });

  return <CheckoutMainShell {...shellProps} />;
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
