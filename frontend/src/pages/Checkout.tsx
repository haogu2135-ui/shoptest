import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { ShopIcon, SI } from '../components/ShopIcon';
import { Form } from 'antd';
import ShopInput, { ShopTextArea } from '../components/ShopInput';
import ShopModal from '../components/ShopModal';
import ShopButton from '../components/ShopButton';
import ShopConfirm from '../components/ShopConfirm';
import ShopSelect from '../components/ShopSelect';
import ShopCascader from '../components/ShopCascader';
import type { FormInstance } from 'antd/es/form';
import { Link, useNavigate } from 'react-router-dom';
import { addressApi, cartApi, clearStoredAuthSession, couponApi, orderApi, paymentApi, productApi } from '../api';
import type { CartItem, CouponQuote, OrderCustomer, PaymentCustomer, PaymentChannel, ProductPublic as Product, UserAddress, UserCoupon } from '../types';
import { loadRegionData, type RegionOption } from '../regionData';
import { useLanguage, type Language } from '../i18n';
import { usePageTitle } from '../hooks/usePageTitle';
import { useCheckoutPaymentLifecycle } from '../hooks/useCheckoutPaymentLifecycle';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { createPaymentMethodDetails, paymentMethodLabel } from '../utils/paymentMethods';
import { useMarket } from '../hooks/useMarket';
import { formatSelectedSpecs } from '../utils/selectedSpecs';
import { addGuestCartItem, getGuestCartItems, removeGuestCartItems } from '../utils/guestCart';
import { conversionConfig, getDeliveryPromise } from '../utils/conversionConfig';
import { getGiftThreshold, getNearestCartBenefitTarget } from '../utils/cartBenefits';
import { clearCheckoutCartItemIds, hasAuthenticatedCartSession, readCheckoutCartItemIds, syncCheckoutCartItemIds } from '../utils/cartSession';
import { productImageFallback, resolveProductImage } from '../utils/productMedia';
import { getApiErrorMessage, isAuthExpiredError } from '../utils/apiError';
import { deriveCartShippingSummary, getCartLineAmount, roundCartMoney } from '../utils/cartUi';
import { dispatchDomEvent } from '../utils/domEvents';
import { saveGuestSupportContext } from '../utils/guestSupportContext';
import { allSettledWithConcurrency } from '../utils/asyncBatch';
import { getSessionStorageItem, setSessionStorageItem, removeSessionStorageItem } from '../utils/safeStorage';
import { useNativeBackHandler } from '../utils/nativeBack';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import { buildLoginUrlFromWindow } from '../utils/authRedirect';
import AddOnAssistant from '../components/AddOnAssistant';
import PageError from '../components/PageError';
import ShopBreadcrumb from '../components/ShopBreadcrumb';
import ShopProgress from '../components/ShopProgress';
import ShopTag from '../components/ShopTag';
import ShopAlert from '../components/ShopAlert';
import './Checkout.css';
import '../styles/mobile-page-contrast.css';
import { navigateToCommercialPaymentUrl, formatPaymentUrlLabel, getPaymentRecoveryState } from '../utils/paymentRecovery';
import {
  areSameIds,
  buildCheckoutFieldErrorMap,
  buildCheckoutValidationAnnouncement,
  CHECKOUT_GUEST_DRAFT_KEY,
  CHECKOUT_VALIDATION_SCROLL_OFFSET,
  CHECKOUT_GUEST_DRAFT_SAVE_DELAY_MS,
  CHECKOUT_IDEMPOTENCY_KEY,
  CHECKOUT_PENDING_ORDER_KEY,
  checkoutGuestDraftFieldNames,
  estimateCouponDiscount,
  findBestCoupon,
  firstCheckoutRegionPath,
  firstFilledCheckoutText,
  formatCheckoutDateTime,
  getCheckoutCouponErrorMessage,
  getCartItemLowStockCount,
  getRecommendedPaymentMethod,
  getSavedAddressDetail,
  getSavedAddressPostalCode,
  getSavedAddressRegionPath,
  hasCompleteCheckoutDetailAddress,
  hasCompleteCheckoutRecipientName,
  hasHydratableCheckoutValue,
  isCompleteSavedAddress,
  isFinalCheckoutOrderError,
  isLikelyPhone,
  isPurchasable,
  isValidCheckoutPostalCode,
  mergeDefinedCheckoutFields,
  mergeHydratableCheckoutFields,
  normalizeCheckoutEmail,
  normalizeCheckoutGuestDraftFields,
  normalizeCheckoutPhone,
  normalizeCheckoutPostalCode,
  normalizeCheckoutText,
  normalizeCheckoutValidationMessage,
  normalizeCouponQuote,
  normalizeLikelyCheckoutPhone,
  normalizeStatusCode,
  parseCartItemSelectedSpecs,
  parseCheckoutPendingOrderSnapshot,
  resolveCheckoutPaymentMethod,
  resolveGuestRestorePrice,
  SUPPORT_PANEL_DISMISS_SUPPRESS_MS,
  toSafeMoney,
  clearCheckoutIdempotencyKey,
  clearCheckoutPendingOrder,
  createCheckoutIdempotencyKey,
  getOrCreateCheckoutIdempotencyKey,
  persistCheckoutPendingOrder,
  readCheckoutGuestDraftFields,
  readCheckoutPendingOrder,
  buildCheckoutRecipientPayload,
  buildCheckoutShippingAddressLine,
  describeCheckoutCoupon,
  formatCheckoutPaymentStatusLabel,
  getCheckoutPaymentStatusColor,
  scoreCheckoutReadiness,
  pickCheckoutNextAction,
  findNextCheckoutCouponUnlock,
  buildCheckoutCouponOpportunity,
  resolveCheckoutNextActionLabelKey,
  buildCheckoutOrderActionContext,
  buildCheckoutActionAriaLabel,
  resolveCheckoutContactSubmitGuard,
  resolveCheckoutCartSubmitGuard,
  buildGuestRestoreCartLine,
  buildGuestCheckoutOrderItems,
  type CheckoutFormFieldName,
  type CheckoutValidationField,
  type CheckoutFormSnapshot,
  type CheckoutFormValues,
  type CheckoutMessageType,
  type CheckoutPendingOrderSnapshot,
  type CheckoutTranslationFn,
} from '../utils/checkoutHelpers';
import {
  focusFirstCheckoutValidationError,
  scrollCheckoutElementIntoView,
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
const clearExpiredCheckoutSession = () => {
  clearStoredAuthSession();
};

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
  const [checkoutRegionCascaderOpen, setCheckoutRegionCascaderOpen] = useState(false);
  const [regionOptions, setRegionOptions] = useState<RegionOption[]>([]);
  const [regionOptionsLanguage, setRegionOptionsLanguage] = useState('');
  const [regionOptionsLoading, setRegionOptionsLoading] = useState(false);
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
  const supportPanelDismissedKeyRef = React.useRef<string | null>(null);
  const supportPanelDismissedUntilRef = React.useRef(0);
  const couponQuoteSeqRef = React.useRef(0);
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
  const formatPaymentStatusLabel = useCallback((status?: string) => (
    formatCheckoutPaymentStatusLabel(status, t)
  ), [t]);
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
  const getPaymentStatusColor = useCallback((status?: string) => (
    getCheckoutPaymentStatusColor(status)
  ), []);
  const watchedPaymentMethod = Form.useWatch('paymentMethod', form);
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
  const loadCheckoutRegionOptions = useCallback(async () => {
    if (regionOptions.length > 0 && regionOptionsLanguage === language) {
      return regionOptions;
    }
    setRegionOptionsLoading(true);
    try {
      const options = await loadRegionData(language);
      if (mountedRef.current) {
        setRegionOptions(options);
        setRegionOptionsLanguage(language);
      }
      return options;
    } catch (error) {
      reportNonBlockingError('Checkout.loadRegionData', error);
      if (mountedRef.current) {
        showCheckoutMessage('error', t('pages.checkout.regionLoadFailed'));
      }
      return [];
    } finally {
      if (mountedRef.current) {
        setRegionOptionsLoading(false);
      }
    }
  }, [language, regionOptions, regionOptionsLanguage, showCheckoutMessage, t]);
  const setCheckoutRegionCascaderVisibility = useCallback((open: boolean) => {
    if (open) {
      void loadCheckoutRegionOptions();
    }
    setCheckoutRegionCascaderOpen(open);
    document.body.classList.toggle('checkout-region-cascader-open', open);
    const syncPortalVisibility = () => {
      document.querySelectorAll<HTMLElement>('.ant-cascader-dropdown').forEach((element) => {
        if (open) {
          element.style.removeProperty('display');
          element.style.removeProperty('visibility');
          element.style.removeProperty('opacity');
          element.style.removeProperty('width');
          element.style.removeProperty('height');
          element.style.removeProperty('pointer-events');
          return;
        }
        element.style.setProperty('display', 'none', 'important');
        element.style.setProperty('visibility', 'hidden', 'important');
        element.style.setProperty('opacity', '0', 'important');
        element.style.setProperty('width', '0', 'important');
        element.style.setProperty('height', '0', 'important');
        element.style.setProperty('pointer-events', 'none', 'important');
        element.remove();
      });
    };
    syncPortalVisibility();
    window.requestAnimationFrame(syncPortalVisibility);
  }, [loadCheckoutRegionOptions]);
  const closeCheckoutRegionCascader = useCallback(() => {
    setCheckoutRegionCascaderVisibility(false);
  }, [setCheckoutRegionCascaderVisibility]);
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

  useEffect(() => {
    const scrollContainers = Array.from(document.querySelectorAll<HTMLElement>('.ant-layout-content, .shop-app-shell, .checkout-page'));
    let previousWindowScrollY = window.scrollY;
    let previousDocumentScrollTop = document.scrollingElement?.scrollTop ?? 0;
    let previousContainerScrollTop = scrollContainers.map((element) => element.scrollTop);
    let animationFrame = 0;
    const closeStaleCheckoutCascaderAfterScroll = () => {
      const documentScrollTop = document.scrollingElement?.scrollTop ?? 0;
      const containerMoved = scrollContainers.some((element, index) => Math.abs(element.scrollTop - (previousContainerScrollTop[index] || 0)) > 1);
      const moved = Math.abs(window.scrollY - previousWindowScrollY) > 1
        || Math.abs(documentScrollTop - previousDocumentScrollTop) > 1
        || containerMoved;
      if (moved && document.querySelector('.ant-cascader-dropdown')) {
        setCheckoutRegionCascaderVisibility(false);
      }
      previousWindowScrollY = window.scrollY;
      previousDocumentScrollTop = documentScrollTop;
      previousContainerScrollTop = scrollContainers.map((element) => element.scrollTop);
      animationFrame = window.requestAnimationFrame(closeStaleCheckoutCascaderAfterScroll);
    };
    animationFrame = window.requestAnimationFrame(closeStaleCheckoutCascaderAfterScroll);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [setCheckoutRegionCascaderVisibility]);

  useEffect(() => {
    if (!hasCheckoutItems) {
      paymentChannelsRequestSeqRef.current += 1;
      setPaymentChannels([]);
      setPaymentChannelsLoading(false);
      setPaymentChannelsError(null);
      setPaymentChannelsAvailable(false);
      return;
    }
    let disposed = false;
    const requestSeq = paymentChannelsRequestSeqRef.current + 1;
    paymentChannelsRequestSeqRef.current = requestSeq;
    const isCurrentPaymentChannelsRequest = () => (
      !disposed
      && mountedRef.current
      && paymentChannelsRequestSeqRef.current === requestSeq
    );
    setPaymentChannelsLoading(true);
    setPaymentChannelsError(null);
    paymentApi.getChannels()
      .then((res) => {
        if (!isCurrentPaymentChannelsRequest()) return;
        const channels = res.data;
        setPaymentChannels(channels);
        setPaymentChannelsError(null);
        setPaymentChannelsAvailable(createPaymentMethodDetails(channels, { currency }).length > 0);
        const current = form.getFieldValue('paymentMethod');
        const rememberedMethod = getSessionStorageItem('checkoutPaymentMethod');
        const bootstrapCandidate = rememberedMethod || (current && current !== 'STRIPE' ? current : null);
        const nextMethod = resolveCheckoutPaymentMethod(bootstrapCandidate, channels, currency);
        const allowed = createPaymentMethodDetails(channels, { currency }).some((method) => method.value === current);
        if (nextMethod && (nextMethod !== current || !allowed)) {
          form.setFieldsValue({ paymentMethod: nextMethod });
          setSessionStorageItem('checkoutPaymentMethod', nextMethod);
        } else if (!nextMethod && current) {
          form.setFieldsValue({ paymentMethod: undefined });
          removeSessionStorageItem('checkoutPaymentMethod');
        }
      })
      .catch((error: unknown) => {
        if (!isCurrentPaymentChannelsRequest()) return;
        const { t: latestT, language: latestLanguage } = checkoutLocalizationRef.current;
        setPaymentChannels([]);
        setPaymentChannelsError(getApiErrorMessage(
          error,
          latestT('pages.checkout.paymentUnavailableDescription'),
          latestLanguage,
        ));
        setPaymentChannelsAvailable(false);
        form.setFieldsValue({ paymentMethod: undefined });
      })
      .finally(() => {
        if (!isCurrentPaymentChannelsRequest()) return;
        setPaymentChannelsLoading(false);
      });
    return () => {
      disposed = true;
      if (paymentChannelsRequestSeqRef.current === requestSeq) {
        paymentChannelsRequestSeqRef.current += 1;
      }
    };
  }, [currency, form, hasCheckoutItems, paymentChannelsReloadKey]);

  useEffect(() => {
    if (!checkoutRegionCascaderOpen) return;
    const closeOnViewportMove = () => closeCheckoutRegionCascader();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeCheckoutRegionCascader();
    };
    const initialWindowScrollY = window.scrollY;
    const initialDocumentScrollTop = document.scrollingElement?.scrollTop ?? 0;
    const scrollContainers = Array.from(document.querySelectorAll<HTMLElement>('.ant-layout-content, .shop-app-shell, .checkout-page'));
    const initialContainerScrollTop = scrollContainers.map((element) => element.scrollTop);
    let animationFrame = 0;
    const closeWhenScrollPositionChanges = () => {
      const documentScrollTop = document.scrollingElement?.scrollTop ?? 0;
      const containerMoved = scrollContainers.some((element, index) => Math.abs(element.scrollTop - (initialContainerScrollTop[index] || 0)) > 1);
      if (
        Math.abs(window.scrollY - initialWindowScrollY) > 1
        || Math.abs(documentScrollTop - initialDocumentScrollTop) > 1
        || containerMoved
      ) {
        closeCheckoutRegionCascader();
        return;
      }
      animationFrame = window.requestAnimationFrame(closeWhenScrollPositionChanges);
    };
    const passiveCaptureOptions: AddEventListenerOptions = { capture: true, passive: true };
    animationFrame = window.requestAnimationFrame(closeWhenScrollPositionChanges);
    window.addEventListener('scroll', closeOnViewportMove, true);
    window.addEventListener('resize', closeOnViewportMove);
    document.addEventListener('scroll', closeOnViewportMove, true);
    document.addEventListener('touchmove', closeOnViewportMove, passiveCaptureOptions);
    document.addEventListener('wheel', closeOnViewportMove, passiveCaptureOptions);
    document.addEventListener('keydown', closeOnEscape, true);
    return () => {
      window.removeEventListener('scroll', closeOnViewportMove, true);
      window.removeEventListener('resize', closeOnViewportMove);
      document.removeEventListener('scroll', closeOnViewportMove, true);
      document.removeEventListener('touchmove', closeOnViewportMove, passiveCaptureOptions);
      document.removeEventListener('wheel', closeOnViewportMove, passiveCaptureOptions);
      document.removeEventListener('keydown', closeOnEscape, true);
      window.cancelAnimationFrame(animationFrame);
    };
  }, [checkoutRegionCascaderOpen, closeCheckoutRegionCascader]);

  useEffect(() => {
    const selectedCartItemIds = readCheckoutCartItemIds();
    const hasToken = hasAuthenticatedCartSession();
    let disposed = false;
    if (!hasToken) {
      const guestItems = readGuestCartSnapshot().filter((item) => selectedCartItemIds.length === 0 || selectedCartItemIds.includes(item.id));
      const purchasableItems = guestItems.filter(isPurchasable);
      const purchasableIds = purchasableItems.map((item) => item.id);
      if (purchasableItems.length !== guestItems.length || (selectedCartItemIds.length > 0 && !areSameIds(selectedCartItemIds, purchasableIds))) {
        showCheckoutMessage('warning', t('pages.checkout.unavailableSelected'));
        syncCheckoutCartItemIds(purchasableItems);
      }
      setCartItems(purchasableItems);
      setAddresses([]);
      setAddressLoadFailed(false);
      setCartLoadError(null);
      const draftFields = readCheckoutGuestDraftFields();
      if (draftFields) {
        form.setFieldsValue(draftFields);
        mergeCheckoutFormSnapshot(draftFields);
        setFormHydrationRevision((revision) => revision + 1);
      }
      setLoading(false);
      return;
    }

    const loadCheckout = async () => {
      setLoading(true);
      setAddressLoadFailed(false);
      setCartLoadError(null);
      try {
        const [cartRes, addressRes] = await Promise.all([
          cartApi.getItems(0),
          addressApi.getByUser(0).catch((error) => {
            reportNonBlockingError('Checkout.loadAddresses', error);
            if (!disposed && mountedRef.current) {
              setAddressLoadFailed(true);
              showCheckoutMessage('warning', t('pages.checkout.addressLoadFailed'));
            }
            return { data: [] as UserAddress[] };
          }),
        ]);
        if (disposed || !mountedRef.current) return;
        const selectedItems = selectedCartItemIds.length === 0
          ? cartRes.data
          : cartRes.data.filter((item) => selectedCartItemIds.includes(item.id));
        const purchasableItems = selectedItems.filter(isPurchasable);
        const purchasableIds = purchasableItems.map((item) => item.id);
        if (purchasableItems.length !== selectedItems.length || (selectedCartItemIds.length > 0 && !areSameIds(selectedCartItemIds, purchasableIds))) {
          showCheckoutMessage('warning', t('pages.checkout.unavailableSelected'));
          syncCheckoutCartItemIds(purchasableItems);
        }
        setCartItems(purchasableItems);
        setCartLoadError(null);
        setAddresses(addressRes.data);
        const defaultAddress = addressRes.data.find((address) => address.isDefault) || addressRes.data[0];
        if (defaultAddress) setSelectedAddressId(defaultAddress.id);
      } catch (error: unknown) {
        if (disposed || !mountedRef.current) return;
        if (isAuthExpiredError(error)) {
          clearExpiredCheckoutSession();
          clearCheckoutIdempotencyKey();
          clearCheckoutPendingOrder();
          syncCheckoutCartItemIds([]);
          setCartItems([]);
          setAddresses([]);
          setAddressLoadFailed(false);
          setSelectedAddressId('new');
          setSelectedUserCouponId(null);
          setCouponQuote(null);
          setCouponQuoteErrorMessage(null);
          setCouponSelectionErrorMessage(null);
          showCheckoutMessage('warning', t('pages.checkout.authExpired'));
          navigate(buildLoginUrlFromWindow(), { replace: true });
        } else {
          const errorMessage = getApiErrorMessage(error, t('pages.checkout.loadFailed'), language);
          setCartLoadError(errorMessage);
          // Stable storefront copy for load failures; detailed text stays in cartLoadError state.
          showCheckoutMessage('error', t('pages.checkout.loadFailed'));
        }
      } finally {
        if (!disposed && mountedRef.current) {
          setLoading(false);
        }
      }
    };

    loadCheckout();
    return () => {
      disposed = true;
    };
  }, [checkoutReloadKey, form, language, mergeCheckoutFormSnapshot, navigate, showCheckoutMessage, t]);

  useEffect(() => {
    if (!hasCheckoutItems) return;
    if (selectedAddressId !== 'new') {
      const address = addresses.find((item) => String(item.id) === String(selectedAddressId));
      if (address) {
        const savedRegionPath = getSavedAddressRegionPath(address);
        const savedPostalCode = getSavedAddressPostalCode(address);
        const savedDetail = getSavedAddressDetail(address);
        const savedAddressFields = {
          recipientName: address.recipientName,
          phone: normalizeLikelyCheckoutPhone(address.phone),
          region: savedRegionPath.length > 0 ? savedRegionPath : undefined,
          shippingAddress: savedDetail || undefined,
          postalCode: savedPostalCode || undefined,
        };
        form.setFieldsValue(savedAddressFields);
        mergeCheckoutFormSnapshot(savedAddressFields);
        setFormHydrationRevision((revision) => revision + 1);
      }
    } else if (!isGuestCheckout && addresses.length > 0) {
      const clearedAddressFields = { recipientName: undefined, phone: undefined, region: undefined, shippingAddress: undefined, postalCode: undefined };
      form.setFieldsValue(clearedAddressFields);
      mergeCheckoutFormSnapshot(clearedAddressFields);
      setFormHydrationRevision((revision) => revision + 1);
    }
  }, [addresses, form, hasCheckoutItems, isGuestCheckout, mergeCheckoutFormSnapshot, selectedAddressId]);

  useEffect(() => {
    if (!hasCheckoutItems) return;
    if (!isGuestCheckout) {
      removeSessionStorageItem(CHECKOUT_GUEST_DRAFT_KEY);
      return;
    }
    const rawDraft = getSessionStorageItem(CHECKOUT_GUEST_DRAFT_KEY);
    if (!rawDraft) return;
    try {
      const nextDraftFields = normalizeCheckoutGuestDraftFields(JSON.parse(rawDraft));
      if (nextDraftFields) {
        form.setFieldsValue(nextDraftFields);
        mergeCheckoutFormSnapshot(nextDraftFields);
        setFormHydrationRevision((revision) => revision + 1);
      }
    } catch (error) {
      reportNonBlockingError('Checkout.hydrateGuestDraft', error);
      removeSessionStorageItem(CHECKOUT_GUEST_DRAFT_KEY);
    }
  }, [form, hasCheckoutItems, isGuestCheckout, mergeCheckoutFormSnapshot]);

  useEffect(() => {
    if (!hasCheckoutItems || !isGuestCheckout) return;
    const timer = window.setTimeout(() => {
      const watchedDraft = {
        guestEmail: normalizeCheckoutText(watchedGuestEmail, 120),
        recipientName: normalizeCheckoutText(watchedRecipientName, 80),
        phone: normalizeLikelyCheckoutPhone(watchedPhone),
        region: Array.isArray(watchedRegion) ? watchedRegion : undefined,
        shippingAddress: normalizeCheckoutText(watchedShippingAddress, 260),
        postalCode: normalizeCheckoutPostalCode(watchedPostalCode),
      };
      const existingDraft = readCheckoutGuestDraftFields();
      const draft = mergeHydratableCheckoutFields(
        existingDraft || checkoutFormSnapshotRef.current || initialCheckoutDraftRef.current || {},
        watchedDraft,
      );
      const hasDraft = Object.values(draft).some(hasHydratableCheckoutValue);
      if (hasDraft) {
        setSessionStorageItem(CHECKOUT_GUEST_DRAFT_KEY, JSON.stringify(draft));
        mergeCheckoutFormSnapshot(draft, true);
      } else {
        removeSessionStorageItem(CHECKOUT_GUEST_DRAFT_KEY);
      }
    }, CHECKOUT_GUEST_DRAFT_SAVE_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [hasCheckoutItems, isGuestCheckout, mergeCheckoutFormSnapshot, watchedGuestEmail, watchedPhone, watchedPostalCode, watchedRecipientName, watchedRegion, watchedShippingAddress]);

  const cartTotal = useMemo(() => roundCartMoney(cartItems.reduce((sum, item) => {
    return sum + getCartLineAmount(item);
  }, 0)), [cartItems]);
  const checkoutItemCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems],
  );

  useEffect(() => {
    const hasToken = hasAuthenticatedCartSession();
    const couponQuoteCartKey = `${cartItems.map((item) => item.id).join(',')}|${cartTotal}`;
    if (!hasToken || cartItems.length === 0) {
      couponQuoteSeqRef.current += 1;
      couponAutoSelectedQuoteRef.current = null;
      setCouponQuote(null);
      setCouponQuoteStatus('idle');
      setCouponQuoteErrorMessage(null);
      setCouponSelectionErrorMessage(null);
      return;
    }
    if (
      selectedUserCouponId
      && couponAutoSelectedQuoteRef.current?.cartKey === couponQuoteCartKey
      && couponAutoSelectedQuoteRef.current.couponId === selectedUserCouponId
    ) {
      couponAutoSelectedQuoteRef.current = null;
      setCouponSelectionErrorMessage(null);
      return;
    }
    const requestSeq = couponQuoteSeqRef.current + 1;
    couponQuoteSeqRef.current = requestSeq;
    setCouponQuote(null);
    setCouponQuoteStatus('loading');
    setCouponQuoteErrorMessage(null);
    if (selectedUserCouponId) {
      setCouponSelectionErrorMessage(null);
    }
    let disposed = false;
    couponApi.quote({
      cartItemIds: cartItems.map((item) => item.id),
      userCouponId: selectedUserCouponId,
    })
      .then((res) => {
        if (disposed || !mountedRef.current || couponQuoteSeqRef.current !== requestSeq) return;
        const nextCouponQuote = normalizeCouponQuote(res.data);
        if (!nextCouponQuote) {
          const { t: latestT } = checkoutLocalizationRef.current;
          setCouponQuote(null);
          setCouponQuoteStatus('error');
          setCouponQuoteErrorMessage(latestT('pages.checkout.couponUnavailable'));
          return;
        }
        const nextAvailableCoupons = nextCouponQuote?.availableCoupons || [];
        setCouponQuote(nextCouponQuote);
        setCouponQuoteStatus('ready');
        setCouponQuoteErrorMessage(null);
        if (selectedUserCouponId) {
          setCouponSelectionErrorMessage(null);
        }
        if (!selectedUserCouponId && !couponManuallyChanged) {
          const bestCoupon = conversionConfig.checkout.autoSelectBestCoupon
            ? findBestCoupon(nextAvailableCoupons, cartTotal)?.coupon
            : null;
          const nextCouponId = bestCoupon?.id || nextCouponQuote?.selectedUserCouponId;
          if (nextCouponId) {
            if (nextCouponQuote.selectedUserCouponId === nextCouponId) {
              couponAutoSelectedQuoteRef.current = { cartKey: couponQuoteCartKey, couponId: nextCouponId };
            }
            setSelectedUserCouponId(nextCouponId);
          }
        }
      })
      .catch((error) => {
        if (disposed || !mountedRef.current || couponQuoteSeqRef.current !== requestSeq) return;
        setCouponQuote(null);
        setCouponQuoteStatus('error');
        const { t: latestT, language: latestLanguage } = checkoutLocalizationRef.current;
        const couponErrorMessage = getCheckoutCouponErrorMessage(error, latestT('pages.checkout.couponUnavailable'), latestT, latestLanguage);
        setCouponQuoteErrorMessage(couponErrorMessage);
        if (selectedUserCouponId) {
          setCouponSelectionErrorMessage(couponErrorMessage);
          showCheckoutMessage('error', couponErrorMessage);
          couponAutoSelectedQuoteRef.current = null;
          setSelectedUserCouponId(null);
        }
      });
    return () => {
      disposed = true;
    };
  }, [cartItems, cartTotal, couponManuallyChanged, selectedUserCouponId, showCheckoutMessage]);

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
  const nextCouponUnlock = useMemo(
    () => findNextCheckoutCouponUnlock(availableCoupons, cartTotal),
    [availableCoupons, cartTotal],
  );
  const couponOpportunity = useMemo(() => buildCheckoutCouponOpportunity({
    isGuestCheckout,
    availableCoupons,
    selectedCoupon,
    selectedIsBestCoupon,
    discountAmount,
    nextCouponUnlock,
    formatMoney,
    t,
  }), [availableCoupons, discountAmount, formatMoney, isGuestCheckout, nextCouponUnlock, selectedCoupon, selectedIsBestCoupon, t]);
  const savingsCoachItems = [
    {
      key: 'shipping',
      icon: <ShopIcon path={SI.truck} />,
      ready: freeShippingUnlocked,
      title: t('pages.checkout.savingsFreeShippingTitle'),
      text: freeShippingUnlocked
        ? t('pages.checkout.savingsFreeShippingUnlocked')
        : t('pages.checkout.savingsFreeShippingText', { amount: formatMoney(freeShippingRemaining) }),
    },
    giftEligible ? {
      key: 'gift',
      icon: <ShopIcon path={SI.gift} />,
      ready: giftUnlocked,
      title: t('pages.checkout.savingsGiftTitle'),
      text: giftUnlocked
        ? t('pages.checkout.savingsGiftUnlocked', { gift: t(conversionConfig.giftAtCheckout.giftNameKey) })
        : t('pages.checkout.savingsGiftText', { amount: formatMoney(giftRemaining), gift: t(conversionConfig.giftAtCheckout.giftNameKey) }),
    } : null,
    !isGuestCheckout ? {
      key: 'coupon',
      icon: <ShopIcon path={SI.safety} />,
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
  const selectedSavedAddressRegion = getSavedAddressRegionPath(selectedSavedAddress);
  const selectedSavedAddressPostalCode = getSavedAddressPostalCode(selectedSavedAddress);
  const selectedSavedAddressDetail = getSavedAddressDetail(selectedSavedAddress);
  const selectedAddressLabel = selectedSavedAddress
    ? `${selectedSavedAddress.recipientName || t('pages.checkout.address')}: ${selectedSavedAddress.address}`
    : t('pages.checkout.useNewAddress');
  const checkoutAddressGroupLabel = `${t('pages.checkout.address')}: ${selectedAddressLabel}`;
  const checkoutRegionInputLabel = `${t('pages.checkout.region')}: ${t('pages.checkout.regionRequired')}`;
  const getCheckoutTextValue = (fieldName: CheckoutFormFieldName, values?: CheckoutFormValues) => firstFilledCheckoutText(
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
  const getCheckoutRegionValue = (values?: CheckoutFormValues) => firstCheckoutRegionPath(
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
      ready: paymentMethodsAvailable && Boolean(watchedPaymentMethod || recommendedPaymentMethod),
      label: t('pages.checkout.readinessPayment'),
      text: !paymentMethodsAvailable
        ? t('pages.checkout.paymentUnavailable')
        : selectedPaymentDetail
        ? t('pages.checkout.readinessPaymentSelected', { method: selectedPaymentDetail.title })
        : t('pages.checkout.readinessPaymentNeeded'),
    },
    {
      key: 'savings',
      ready: freeShippingUnlocked || discountAmount > 0 || giftUnlocked,
      label: t('pages.checkout.readinessSavings'),
      text: freeShippingUnlocked
        ? t('pages.checkout.readinessFreeShippingReady')
        : t('pages.checkout.readinessFreeShippingGap', { amount: formatMoney(freeShippingRemaining) }),
    },
  ];
  const checkoutReadinessScore = scoreCheckoutReadiness(checkoutReadinessItems);
  const checkoutNextAction = pickCheckoutNextAction(checkoutReadinessItems);
  // Savings coaching must never block place-order. Only items/address/payment gate submit CTAs.
  const checkoutBlockingAction = pickCheckoutNextAction(checkoutReadinessItems, { blockingOnly: true });
  const needsCheckoutSupport = Boolean(addOnTarget || couponOpportunity || checkoutNextAction);
  const supportPanelAutoOpenKey = useMemo(() => {
    if (!needsCheckoutSupport) return '';
    return [
      checkoutNextAction?.key || 'ready',
      addOnTarget ? `${addOnTarget.reason}:${Math.round(addOnTarget.remainingAmount * 100)}` : 'no-addon',
      couponOpportunity ? `${couponOpportunity.type}:${selectedCoupon?.id || nextCouponUnlock?.coupon?.id || 'coupon'}` : 'no-coupon',
    ].join('|');
  }, [
    addOnTarget,
    checkoutNextAction?.key,
    couponOpportunity,
    needsCheckoutSupport,
    nextCouponUnlock?.coupon?.id,
    selectedCoupon?.id,
  ]);
  useEffect(() => {
    if (!needsCheckoutSupport) {
      supportPanelDismissedKeyRef.current = null;
      return;
    }
    if (needsCheckoutSupport) {
      if (supportPanelDismissedUntilRef.current > Date.now()) {
        return;
      }
      if (supportPanelDismissedKeyRef.current === supportPanelAutoOpenKey) {
        return;
      }
      setSupportPanelOpen(true);
    }
  }, [needsCheckoutSupport, supportPanelAutoOpenKey]);
  const handleSupportPanelToggle = useCallback((event: React.SyntheticEvent<HTMLDetailsElement>) => {
    const nextOpen = event.currentTarget.open;
    setSupportPanelOpen(nextOpen);
    if (nextOpen) {
      supportPanelDismissedKeyRef.current = null;
      supportPanelDismissedUntilRef.current = 0;
      return;
    }
    supportPanelDismissedKeyRef.current = supportPanelAutoOpenKey || null;
    supportPanelDismissedUntilRef.current = Date.now() + SUPPORT_PANEL_DISMISS_SUPPRESS_MS;
  }, [supportPanelAutoOpenKey]);
  const closeSupportPanelForNativeBack = useCallback(() => {
    if (giftCelebrationOpen || !supportPanelOpen) {
      return false;
    }
    supportPanelDismissedKeyRef.current = supportPanelAutoOpenKey || null;
    supportPanelDismissedUntilRef.current = Date.now() + SUPPORT_PANEL_DISMISS_SUPPRESS_MS;
    setSupportPanelOpen(false);
    return true;
  }, [giftCelebrationOpen, supportPanelAutoOpenKey, supportPanelOpen]);
  useNativeBackHandler(supportPanelOpen, closeSupportPanelForNativeBack);
  const scrollToAddOns = useCallback(() => {
    scrollCheckoutElementIntoView('checkout-add-on-assistant');
  }, []);
  const handleCheckoutNextAction = () => {
    const action = checkoutBlockingAction || checkoutNextAction;
    if (!action) {
      openSupport();
      return;
    }
    if (action.key === 'items') {
      navigate('/cart');
      return;
    }
    if (action.key === 'address') {
      scrollCheckoutElementIntoView('checkout-address-card');
      return;
    }
    if (action.key === 'payment') {
      closeCheckoutRegionCascader();
      scrollCheckoutElementIntoView('checkout-payment-card');
      return;
    }
    if (action.key === 'savings') {
      if (addOnTarget) {
        scrollToAddOns();
        return;
      }
      scrollCheckoutElementIntoView('checkout-coupon-card');
    }
  };
  const handleCouponOpportunityAction = () => {
    const couponCard = document.getElementById('checkout-coupon-card');
    if (couponCard && typeof couponCard.scrollIntoView === 'function') {
      couponCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
  const checkoutCoachActionLabel = t(resolveCheckoutNextActionLabelKey(checkoutNextAction?.key));
  const checkoutNextActionLabel = t(resolveCheckoutNextActionLabelKey(checkoutBlockingAction?.key));
  const selectedPaymentMethodLabel = selectedPaymentDetail?.title || t('pages.checkout.paymentConfidenceDefault');
  const checkoutSubmitActionLabel = shippingQuoteReady
    ? `${t('pages.checkout.submitWithAmount', { amount: payableAmountText })}: ${t('pages.checkout.paymentMethod')} ${selectedPaymentMethodLabel}`
    : `${shippingPolicyText}: ${t('pages.checkout.paymentMethod')} ${selectedPaymentMethodLabel}`;
  const checkoutConfirmationActionLabel = checkoutBlockingAction
    ? `${t('pages.checkout.nextActionTitle')}: ${checkoutNextActionLabel}`
    : `${t('pages.checkout.nextActionReadyTitle')}: ${checkoutSubmitActionLabel}`;
  const checkoutReadinessActionLabel = `${t('pages.checkout.readinessTitle')}: ${checkoutCoachActionLabel}`;
  const checkoutCouponSelectLabel = `${t('pages.checkout.coupon')}: ${t('pages.checkout.selectCoupon')}`;
  const checkoutSavingsAddOnsActionLabel = addOnTarget
    ? `${t('pages.checkout.savingsShopAddOns')}: ${t('pages.checkout.savingsCoachTitle')}, ${formatMoney(addOnTarget.remainingAmount)}`
    : `${t('pages.checkout.savingsShopAddOns')}: ${t('pages.checkout.savingsCoachTitle')}`;
  const checkoutCouponOpportunityActionLabel = couponOpportunity
    ? `${couponOpportunity.action}: ${couponOpportunity.title}`
    : `${t('pages.checkout.coupon')}: ${t('pages.checkout.selectCoupon')}`;
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

  useEffect(() => {
    if (!giftUnlocked || giftCelebrated) return;
    setGiftCelebrationOpen(true);
    setGiftCelebrated(true);
  }, [giftCelebrated, giftUnlocked]);

  const calculateCouponDiscount = (coupon: UserCoupon) => estimateCouponDiscount(coupon, cartTotal);

  const describeCoupon = (coupon: UserCoupon) => describeCheckoutCoupon(coupon, cartTotal, formatMoney, t);

  const buildAddress = (values: CheckoutFormValues) => {
    const address = selectedAddressId !== 'new'
      ? addresses.find((item) => String(item.id) === String(selectedAddressId)) || null
      : null;
    return buildCheckoutShippingAddressLine({
      selectedAddressId,
      selectedSavedAddress: address,
      selectedSavedAddressRegion,
      selectedSavedAddressPostalCode,
      selectedSavedAddressDetail,
      recipientName: getCheckoutTextValue('recipientName', values),
      phone: getCheckoutTextValue('phone', values),
      regionPath: getCheckoutRegionValue(values),
      postalCode: getCheckoutTextValue('postalCode', values),
      detailAddress: getCheckoutTextValue('shippingAddress', values),
      addressRequiredMessage: t('pages.checkout.addressRequired'),
    });
  };

  const buildRecipientPayload = (values: CheckoutFormValues) => buildCheckoutRecipientPayload({
    selectedAddressId,
    selectedSavedAddress,
    recipientName: getCheckoutTextValue('recipientName', values),
    phone: getCheckoutTextValue('phone', values),
  });

  const addSuggestedProduct = async (product: Product) => {
    const hasToken = hasAuthenticatedCartSession();
    if (hasToken) {
      try {
        await cartApi.addItem(0, product.id, 1);
        const response = await cartApi.getItems(0);
        const purchasableItems = response.data.filter(isPurchasable);
        setCartItems(purchasableItems);
        syncCheckoutCartItemIds(purchasableItems);
        dispatchDomEvent('shop:cart-updated');
        return;
      } catch (error: unknown) {
        if (!isAuthExpiredError(error)) {
          throw error;
        }
      }
    }
    addGuestCartItem(product, 1);
    const nextItems = readGuestCartSnapshot().filter(isPurchasable);
    setCartItems(nextItems);
    syncCheckoutCartItemIds(nextItems);
  };

  const handleSubmit = async (values: CheckoutFormValues) => {
    closeCheckoutRegionCascader();
    if (submittingRef.current) {
      return;
    }
    submittingRef.current = true;
    try {
      setCheckoutValidationAnnouncement('');
      const hasToken = hasAuthenticatedCartSession();
      const cartSubmitGuard = resolveCheckoutCartSubmitGuard({
        cartItemCount: cartItems.length,
        hasUnavailableSelected: cartItems.some((item) => !isPurchasable(item)),
        paymentMethodsAvailable,
      });
      if (cartSubmitGuard === 'empty_cart') {
        showCheckoutMessage('error', t('pages.checkout.emptyCart'));
        return;
      }
      if (cartSubmitGuard === 'unavailable_selected') {
        showCheckoutMessage('error', t('pages.checkout.unavailableSelected'));
        return;
      }
      if (cartSubmitGuard === 'payment_unavailable') {
        showCheckoutMessage('error', t('pages.checkout.paymentUnavailable'));
        return;
      }
      const normalizedPaymentMethod = normalizeCheckoutText(values.paymentMethod, 40);
      const normalizedGuestEmail = hasToken ? undefined : normalizeCheckoutEmail(values.guestEmail);
      if (!paymentMethodDetails.some((method) => method.value === normalizedPaymentMethod)) {
        showCheckoutMessage('error', t('pages.checkout.paymentRequired'));
        return;
      }
      const contactSubmitGuard = resolveCheckoutContactSubmitGuard({
        hasToken,
        paymentMethod: normalizedPaymentMethod,
        guestEmail: normalizedGuestEmail,
        requiresBackendShippingQuote,
        shippingQuoteReady,
        shippingQuoteUnavailable,
      });
      if (contactSubmitGuard === 'payment_required') {
        showCheckoutMessage('error', t('pages.checkout.paymentRequired'));
        return;
      }
      if (contactSubmitGuard === 'email_invalid') {
        showCheckoutMessage('error', t('pages.checkout.emailInvalid'));
        return;
      }
      if (contactSubmitGuard === 'shipping_unavailable') {
        showCheckoutMessage('error', t('pages.checkout.shippingFeeUnavailable'));
        return;
      }
      if (contactSubmitGuard === 'shipping_calculating') {
        showCheckoutMessage('error', t('pages.checkout.shippingFeeCalculating'));
        return;
      }

      const checkoutIdempotencyKey = getOrCreateCheckoutIdempotencyKey();
      setSubmitting(true);
      try {
        const shippingAddress = buildAddress(values);
        const recipientPayload = buildRecipientPayload(values);
        const orderRes = hasToken
          ? await orderApi.checkout({
              cartItemIds: cartItems.map((item) => item.id),
              shippingAddress,
              recipientName: recipientPayload.recipientName,
              recipientPhone: recipientPayload.recipientPhone,
              paymentMethod: normalizedPaymentMethod,
              userCouponId: selectedUserCouponId,
            }, { idempotencyKey: checkoutIdempotencyKey })
          : await orderApi.guestCheckout({
              guestEmail: normalizedGuestEmail as string,
              guestName: normalizeCheckoutText(values.recipientName, 80),
              guestPhone: normalizeCheckoutPhone(values.phone),
              shippingAddress,
              paymentMethod: normalizedPaymentMethod,
              items: buildGuestCheckoutOrderItems(cartItems),
            }, { idempotencyKey: checkoutIdempotencyKey });
        const submittedCartItems = cartItems.map((item) => ({ ...item }));
        submittedCartItemsRef.current = submittedCartItems;
        persistCheckoutPendingOrder(orderRes.data, normalizedPaymentMethod, normalizedGuestEmail, submittedCartItems);
        setCreatedOrder(orderRes.data);
        setPendingPaymentMethod(normalizedPaymentMethod);
        setGuestPaymentEmail(normalizedGuestEmail);
        if (!hasToken && normalizedGuestEmail && orderRes.data.orderNo) {
          saveGuestSupportContext({ orderNo: orderRes.data.orderNo, email: normalizedGuestEmail });
        }
        clearCheckoutCartItemIds();
        removeSessionStorageItem('checkoutPaymentMethod');
        if (!hasToken) {
          removeGuestCartItems(cartItems.map((item) => item.id));
        } else {
          dispatchDomEvent('shop:cart-updated');
        }
        dispatchDomEvent('shop:coupons-updated');
        setPaymentCreateError(null);
        let paymentRes;
        try {
          paymentRes = await paymentApi.create(
            orderRes.data.id,
            normalizedPaymentMethod,
            normalizedGuestEmail,
            hasToken ? undefined : orderRes.data.orderNo,
          );
        } catch (paymentError: unknown) {
          setPayment(null);
          setPaymentCreateError(getApiErrorMessage(paymentError, t('pages.payment.createFailed'), language));
          showCheckoutMessage('warning', t('pages.checkout.orderCreatedPaymentPending'));
          return;
        }
        setPayment(paymentRes.data);
        clearCheckoutIdempotencyKey();
        clearCheckoutPendingOrder();
        showCheckoutMessage('success', t('pages.checkout.orderCreated'));
        if (paymentRes.data.paymentUrl) {
          if (!navigateToCommercialPaymentUrl(paymentRes.data.paymentUrl)) {
            showCheckoutMessage('error', t('pages.payment.failed'));
          }
        }
      } catch (error: unknown) {
        if (hasToken && isAuthExpiredError(error)) {
          clearExpiredCheckoutSession();
          clearCheckoutIdempotencyKey();
          clearCheckoutPendingOrder();
          setAddresses([]);
          setSelectedAddressId('new');
          setSelectedUserCouponId(null);
          setCouponQuote(null);
          setGuestPaymentEmail(undefined);
          syncCheckoutCartItemIds([]);
          setCartItems([]);
          showCheckoutMessage('warning', t('pages.checkout.authExpired'));
          navigate(buildLoginUrlFromWindow(), { replace: true });
          return;
        }
        if (isFinalCheckoutOrderError(error)) {
          clearCheckoutIdempotencyKey();
          clearCheckoutPendingOrder();
        }
        showCheckoutMessage('error', getApiErrorMessage(error, t('pages.checkout.orderCreateFailed'), language));
      } finally {
        setSubmitting(false);
      }
    } finally {
      submittingRef.current = false;
    }
  };

  const retryCreatePayment = async () => {
    if (!createdOrder || paymentRetryingRef.current) return;
    paymentRetryingRef.current = true;
    const requestSeq = paymentCreateRequestSeqRef.current + 1;
    paymentCreateRequestSeqRef.current = requestSeq;
    setPaying(true);
    try {
      const guestOrderNo = guestPaymentEmail ? createdOrder.orderNo : undefined;
      const paymentRes = await paymentApi.create(createdOrder.id, pendingPaymentMethod, guestPaymentEmail, guestOrderNo);
      if (paymentCreateRequestSeqRef.current !== requestSeq) return;
      setPayment(paymentRes.data);
      clearCheckoutIdempotencyKey();
      clearCheckoutPendingOrder();
      setPaymentCreateError(null);
      showCheckoutMessage('success', t('pages.checkout.paymentReady'));
      if (paymentRes.data.paymentUrl && !navigateToCommercialPaymentUrl(paymentRes.data.paymentUrl)) {
        showCheckoutMessage('error', t('pages.payment.failed'));
      }
    } catch (error: unknown) {
      if (paymentCreateRequestSeqRef.current !== requestSeq) return;
      const localizedError = getApiErrorMessage(error, t('pages.payment.createFailed'), language);
      setPaymentCreateError(localizedError);
      showCheckoutMessage('error', localizedError);
    } finally {
      if (paymentCreateRequestSeqRef.current === requestSeq) {
        setPaying(false);
      }
      paymentRetryingRef.current = false;
    }
  };

  const openPaymentUrl = () => {
    if (payment?.paymentUrl && !navigateToCommercialPaymentUrl(payment.paymentUrl)) {
      showCheckoutMessage('error', t('pages.payment.failed'));
    }
  };

  const openTrackedOrder = () => {
    const orderNo = createdOrder?.orderNo || (createdOrder?.id ? String(createdOrder.id) : '');
    if (guestPaymentEmail && orderNo) {
      saveGuestSupportContext({ orderNo, email: guestPaymentEmail });
      navigate(`/track-order?orderNo=${encodeURIComponent(orderNo)}`);
      return;
    }
    navigate('/track-order');
  };

  const simulatePayment = async () => {
    if (!payment || paymentSimulatingRef.current) return;
    paymentSimulatingRef.current = true;
    setSimulatingPayment(true);
    try {
      const paymentRes = await paymentApi.simulateCallback(payment.id);
      setPayment(paymentRes.data);
      if (createdOrder?.id && hasAuthenticatedCartSession()) {
        const orderRes = await orderApi.getById(createdOrder.id);
        setCreatedOrder(orderRes.data);
      } else if (createdOrder) {
        setCreatedOrder({ ...createdOrder, status: 'PENDING_SHIPMENT' });
      }
    } catch (error: unknown) {
      showCheckoutMessage('error', getApiErrorMessage(error, t('pages.checkout.simulatePaymentFailed'), language));
    } finally {
      setSimulatingPayment(false);
      paymentSimulatingRef.current = false;
    }
  };

  const restoreSubmittedCartItems = async () => {
    const hasToken = hasAuthenticatedCartSession();
    const submittedCartItems = submittedCartItemsRef.current.length > 0 ? submittedCartItemsRef.current : cartItems;
    if (hasToken) {
      const results = await allSettledWithConcurrency(
        submittedCartItems,
        (item) => cartApi.addItem(0, item.productId, item.quantity, item.selectedSpecs),
      );
      const failed = results.find((result) => result.status === 'rejected') as PromiseRejectedResult | undefined;
      if (failed) {
        throw failed.reason;
      }
      dispatchDomEvent('shop:cart-updated');
      return;
    }
    const productIds = Array.from(new Set(submittedCartItems.map((item) => item.productId).filter((id) => Number.isFinite(Number(id)) && Number(id) > 0)));
    let latestProducts = new Map<number, Product>();
    if (productIds.length > 0) {
      try {
        const res = await productApi.getByIds(productIds, { bypassCache: true });
        latestProducts = new Map((Array.isArray(res.data) ? res.data : []).map((product) => [Number(product.id), product]));
      } catch (error) {
        reportNonBlockingError('checkout.restoreSubmittedCartItems product refresh failed', error);
      }
    }
    submittedCartItems.forEach((item) => {
      const latestProduct = latestProducts.get(item.productId);
      const restoreLine = buildGuestRestoreCartLine(item, latestProduct, checkoutCartItemName(item));
      addGuestCartItem(restoreLine.product, restoreLine.quantity, restoreLine.selectedSpecs, restoreLine.restorePrice);
    });
  };

  const rollbackPendingPayment = () => {
    if (!createdOrder || createdOrder.status !== 'PENDING_PAYMENT') return;
    setRollbackConfirmOpen(true);
  };

  const handleRollbackConfirm = async () => {
    if (!createdOrder || createdOrder.status !== 'PENDING_PAYMENT') return;
    setCancelingPayment(true);
    try {
      await orderApi.cancel(createdOrder.id, guestPaymentEmail, guestPaymentEmail ? createdOrder.orderNo : undefined);
      await restoreSubmittedCartItems();
      clearCheckoutIdempotencyKey();
      clearCheckoutPendingOrder();
      setPayment(null);
      setCreatedOrder(null);
      setPaymentCreateError(null);
      setRollbackConfirmOpen(false);
      showCheckoutMessage('success', t('pages.checkout.rollbackPaymentSuccess'));
      navigate('/cart');
    } catch (error: unknown) {
      showCheckoutMessage('error', getApiErrorMessage(error, t('pages.checkout.rollbackPaymentFailed'), language));
    } finally {
      setCancelingPayment(false);
    }
  };

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
      <Form form={form} component={false} validateTrigger={["onChange", "onBlur"]} requiredMark>
        <div
          className={`checkout-page checkout-page--loading checkout-page--${language}`}
          role="status"
          aria-live="polite"
          aria-busy="true"
          aria-label={t('common.loading')}
        >
          {renderCheckoutStatusLiveRegion()}
          <section className="checkout-page__hero">
            <div className="checkout-page__heroContent">
              <span className="checkout-page__heroEyebrow">{t('pages.checkout.readinessEyebrow')}</span>
              <h1 className="checkout-page__title">{t('pages.checkout.title')}</h1>
              <span className="checkout-page__text checkout-page__text--secondary">{t('common.loading')}</span>
            </div>
          </section>
          <div className="checkout-page__loadingShell" aria-hidden="true">
            <div className="checkout-page__loadingHero shimmer" />
            <div className="checkout-page__loadingGrid">
              <div className="checkout-page__loadingCard shimmer" />
              <div className="checkout-page__loadingCard shimmer" />
            </div>
            <div className="checkout-page__loadingSummary shimmer" />
          </div>
          <div className="checkout-page__loadingSpinner" role="status" aria-live="polite" aria-label={t('common.loading')}>
            <span className="checkout-page__spinner" aria-hidden="true" />
          </div>
        </div>
      </Form>
    );
  }

  if (createdOrder && !payment) {
    const orderPaymentContext = buildCheckoutOrderActionContext({
      orderNo: createdOrder.orderNo,
      orderId: createdOrder.id,
      amountText: formatMoney(createdOrder.totalAmount),
      orderNoLabel: t('pages.paymentInstructions.orderNo'),
    });
    const retryPaymentActionLabel = buildCheckoutActionAriaLabel(t('pages.checkout.retryPayment'), orderPaymentContext);
    const rollbackPaymentActionLabel = buildCheckoutActionAriaLabel(t('pages.checkout.rollbackPaymentAction'), orderPaymentContext);
    const viewOrderActionLabel = buildCheckoutActionAriaLabel(t('pages.checkout.viewOrder'), orderPaymentContext);
    const trackOrderActionLabel = buildCheckoutActionAriaLabel(t('pages.orderTracking.title'), orderPaymentContext);
    const backHomeActionLabel = buildCheckoutActionAriaLabel(t('pages.checkout.backHome'), orderPaymentContext);
    return (
      <div className={`checkout-page checkout-page--result checkout-page--${language}`}>
        {renderCheckoutStatusLiveRegion()}
        <section className="checkout-page__result checkout-page__result--warning" role="status" aria-live="polite">
          <div className="checkout-page__resultIcon" aria-hidden="true" />
          <h1 className="checkout-page__resultTitle">{t('pages.checkout.orderCreatedPaymentPending')}</h1>
          <p className="checkout-page__resultSubtitle">{t('pages.checkout.paymentPendingSubtitle', { orderNo: createdOrder.orderNo || createdOrder.id, amount: formatMoney(createdOrder.totalAmount) })}</p>
          <div className="checkout-page__resultExtra">
            <ShopButton type="primary" key="retry" loading={paying} aria-label={retryPaymentActionLabel} title={retryPaymentActionLabel} onClick={retryCreatePayment}>{t('pages.checkout.retryPayment')}</ShopButton>
            <ShopButton danger key="rollback" icon={<ShopIcon path={SI.rollback} />} loading={cancelingPayment} aria-label={rollbackPaymentActionLabel} title={rollbackPaymentActionLabel} onClick={rollbackPendingPayment}>{t('pages.checkout.rollbackPaymentAction')}</ShopButton>
            <ShopButton key="profile" aria-label={viewOrderActionLabel} title={viewOrderActionLabel} onClick={guestPaymentEmail ? openTrackedOrder : () => navigate('/profile?tab=orders')}>{t('pages.checkout.viewOrder')}</ShopButton>
            <ShopButton key="track" aria-label={trackOrderActionLabel} title={trackOrderActionLabel} onClick={openTrackedOrder}>{t('pages.orderTracking.title')}</ShopButton>
            <ShopButton key="home" aria-label={backHomeActionLabel} title={backHomeActionLabel} onClick={() => navigate('/')}>{t('pages.checkout.backHome')}</ShopButton>
          </div>
        </section>
        {paymentCreateError ? (
          <ShopAlert
            className="checkout-page__paymentCreateError"
            type="error"
            showIcon
            message={t('pages.checkout.paymentCreateWarning')}
            description={paymentCreateError}
            action={(
              <ShopButton size="small" type="primary" loading={paying} aria-label={retryPaymentActionLabel} title={retryPaymentActionLabel} onClick={retryCreatePayment}>
                {t('pages.checkout.retryPayment')}
              </ShopButton>
            )}
          />
        ) : null}
      </div>
    );
  }

  if (createdOrder && payment) {
    const paid = payment.status === 'PAID';
    const orderPaymentContext = buildCheckoutOrderActionContext({
      orderNo: createdOrder.orderNo,
      orderId: createdOrder.id,
      amountText: formatMoney(createdOrder.totalAmount),
      orderNoLabel: t('pages.paymentInstructions.orderNo'),
    });
    const openPaymentActionLabel = buildCheckoutActionAriaLabel(t('pages.checkout.openPayment'), orderPaymentContext);
    const retryPaymentActionLabel = buildCheckoutActionAriaLabel(t('pages.checkout.retryPayment'), orderPaymentContext);
    const rollbackPaymentActionLabel = buildCheckoutActionAriaLabel(t('pages.checkout.rollbackPaymentAction'), orderPaymentContext);
    const viewOrderActionLabel = buildCheckoutActionAriaLabel(t('pages.checkout.viewOrder'), orderPaymentContext);
    const trackOrderActionLabel = buildCheckoutActionAriaLabel(t('pages.orderTracking.title'), orderPaymentContext);
    const backHomeActionLabel = buildCheckoutActionAriaLabel(t('pages.checkout.backHome'), orderPaymentContext);
    const supportActionLabel = buildCheckoutActionAriaLabel(t('pages.checkout.nextActionSupport'), orderPaymentContext);
    const simulatePaymentActionLabel = buildCheckoutActionAriaLabel(t('pages.checkout.simulatePay'), orderPaymentContext);
    const paymentExpiresAtText = formatCheckoutDateTime(payment.expiresAt, dateLocale);
    const paymentRecovery = getPaymentRecoveryState(payment);
    const paymentStatusCode = normalizeStatusCode(payment.status);
    const isReconcileRequired = paymentStatusCode === 'RECONCILE_REQUIRED';
    const paymentRecoveryTone = paid
      ? 'success'
      : isReconcileRequired
        ? 'warning'
        : paymentRecovery.isExpired
          ? 'error'
          : paymentRecovery.isExpiringSoon
            ? 'warning'
            : 'processing';
    const paymentRecoveryStatusText = paid
      ? t('pages.checkout.paymentRecoveryPaid')
      : isReconcileRequired
        ? t('pages.checkout.paymentRecoveryReconcileRequired')
        : paymentRecovery.isExpired
          ? t('pages.checkout.paymentRecoveryExpired')
          : t('pages.checkout.paymentRecoveryPending');
    const paymentRecoveryWindowText = isReconcileRequired
      ? t('pages.checkout.paymentRecoveryWindowUnknown')
      : paymentRecovery.minutesLeft === null
        ? t('pages.checkout.paymentRecoveryWindowUnknown')
        : paymentRecovery.isExpired
          ? t('pages.checkout.paymentRecoveryWindowExpired')
          : t('pages.checkout.paymentRecoveryWindowMinutes', { count: paymentRecovery.minutesLeft });
    const paymentRecoveryNextText = paid
      ? t('pages.checkout.paymentRecoveryNextPaid')
      : isReconcileRequired
        ? t('pages.checkout.paymentRecoveryNextReconcileRequired')
        : payment.paymentUrl
          ? t('pages.checkout.paymentRecoveryNextOpen')
          : t('pages.checkout.paymentRecoveryNextRetry');
    return (
      <div className={`checkout-page checkout-page--result checkout-page--${language}`}>
        {renderCheckoutStatusLiveRegion()}
        <section
          className={`checkout-page__result checkout-page__result--${paid ? 'success' : isReconcileRequired ? 'warning' : 'info'}`}
          role="status"
          aria-live="polite"
        >
          <div className="checkout-page__resultIcon" aria-hidden="true" />
          <h1 className="checkout-page__resultTitle">
            {paid
              ? t('pages.checkout.paidTitle')
              : isReconcileRequired
                ? t('pages.checkout.paymentRecoveryReconcileRequired')
                : t('pages.checkout.pendingTitle')}
          </h1>
          <p className="checkout-page__resultSubtitle">
            {isReconcileRequired
              ? t('pages.checkout.paymentRecoveryNextReconcileRequired')
              : t('pages.checkout.resultSubtitle', { orderNo: createdOrder.orderNo || createdOrder.id, amount: formatMoney(createdOrder.totalAmount) })}
          </p>
          <div className="checkout-page__resultExtra">
            {!paid && !isReconcileRequired && payment.paymentUrl ? (
              <ShopButton type="primary" key="pay" loading={paying} aria-label={openPaymentActionLabel} title={openPaymentActionLabel} onClick={openPaymentUrl}>
                {t('pages.checkout.openPayment')}
              </ShopButton>
            ) : null}
            <ShopButton key="profile" aria-label={viewOrderActionLabel} title={viewOrderActionLabel} onClick={guestPaymentEmail ? openTrackedOrder : () => navigate('/profile?tab=orders')}>{t('pages.checkout.viewOrder')}</ShopButton>
            <ShopButton key="track" aria-label={trackOrderActionLabel} title={trackOrderActionLabel} onClick={openTrackedOrder}>{t('pages.orderTracking.title')}</ShopButton>
            <ShopButton key="home" aria-label={backHomeActionLabel} title={backHomeActionLabel} onClick={() => navigate('/')}>{t('pages.checkout.backHome')}</ShopButton>
          </div>
        </section>
        <section className="checkout-page__paymentRecovery" aria-label={t('pages.checkout.paymentRecoveryTitle')}><div className="shop-panel__head"><div className="shop-panel__title">{t('pages.checkout.paymentRecoveryTitle')}</div></div>
          <div className="checkout-page__paymentRecoveryGrid" role="list" aria-label={`${t('pages.checkout.paymentRecoveryTitle')}: ${orderPaymentContext}`}>
            <div role="listitem" aria-label={`${t('pages.checkout.paymentRecoveryStatus')}: ${paymentRecoveryStatusText}`}>
              <span className="checkout-page__text checkout-page__text--strong">{t('pages.checkout.paymentRecoveryStatus')}</span>
              <ShopTag color={paid ? 'green' : isReconcileRequired ? 'magenta' : paymentRecovery.isExpired ? 'red' : paymentRecovery.isExpiringSoon ? 'orange' : 'blue'}>
                {paymentRecoveryStatusText}
              </ShopTag>
            </div>
            <div role="listitem" aria-label={`${t('pages.checkout.paymentRecoveryWindow')}: ${paymentRecoveryWindowText}`}>
              <span className="checkout-page__text checkout-page__text--strong">{t('pages.checkout.paymentRecoveryWindow')}</span>
              <span className={`checkout-page__text ${paymentRecoveryTone === 'error' ? 'checkout-page__text--danger' : paymentRecoveryTone === 'warning' ? 'checkout-page__text--warning' : 'checkout-page__text--secondary'}`}>
                {paymentRecoveryWindowText}
              </span>
            </div>
            <div role="listitem" aria-label={`${t('pages.checkout.paymentRecoveryNext')}: ${paymentRecoveryNextText}`}>
              <span className="checkout-page__text checkout-page__text--strong">{t('pages.checkout.paymentRecoveryNext')}</span>
              <span className="checkout-page__text checkout-page__text--secondary">
                {paymentRecoveryNextText}
              </span>
            </div>
          </div>
          {!paid ? (
            <div className="checkout-page__paymentRecoveryActions">
              {!isReconcileRequired && payment.paymentUrl ? <ShopButton type="primary" aria-label={openPaymentActionLabel} title={openPaymentActionLabel} onClick={openPaymentUrl}>{t('pages.checkout.openPayment')}</ShopButton> : null}
              <ShopButton
                aria-label={`${t('pages.paymentInstructions.title')}: ${orderPaymentContext}`}
                title={t('pages.paymentInstructions.title')}
                onClick={() => navigate(`/payment/${encodeURIComponent(String(createdOrder.orderNo || createdOrder.id))}${guestPaymentEmail ? `?guestEmail=${encodeURIComponent(guestPaymentEmail)}` : ''}`)}
              >
                {t('pages.paymentInstructions.title')}
              </ShopButton>
              {!isReconcileRequired && paymentSimulationEnabled ? (
                <ShopButton loading={simulatingPayment} aria-label={simulatePaymentActionLabel} title={simulatePaymentActionLabel} onClick={simulatePayment}>
                  {t('pages.checkout.simulatePay')}
                </ShopButton>
              ) : null}
              {!isReconcileRequired ? (
                <ShopButton loading={paying} aria-label={retryPaymentActionLabel} title={retryPaymentActionLabel} onClick={retryCreatePayment}>{t('pages.checkout.retryPayment')}</ShopButton>
              ) : null}
              {!isReconcileRequired && createdOrder.status === 'PENDING_PAYMENT' ? (
                <ShopButton danger icon={<ShopIcon path={SI.rollback} />} loading={cancelingPayment} aria-label={rollbackPaymentActionLabel} title={rollbackPaymentActionLabel} onClick={rollbackPendingPayment}>
                  {t('pages.checkout.rollbackPaymentAction')}
                </ShopButton>
              ) : null}
              <ShopButton aria-label={supportActionLabel} title={supportActionLabel} onClick={openSupport}>{t('pages.checkout.nextActionSupport')}</ShopButton>
            </div>
          ) : null}
        </section>
        <section aria-label={t('pages.checkout.paymentCard')}><div className="shop-panel__head"><div className="shop-panel__title">{t('pages.checkout.paymentCard')}</div></div>
          <div className="checkout-page__stack">
            <span className="checkout-page__text">{t('pages.checkout.channel')}: {paymentMethodLabel(payment.channel, t)}</span>
            {createdOrder.originalAmount ? <span className="checkout-page__text">{t('common.subtotal')}: <span className="commerce-money">{formatMoney(createdOrder.originalAmount)}</span></span> : null}
            {createdOrder.discountAmount && createdOrder.discountAmount > 0 ? <span className="checkout-page__text">{t('pages.checkout.coupon')}: <span className="commerce-money">-{formatMoney(createdOrder.discountAmount)}</span> {createdOrder.couponName ? `(${createdOrder.couponName})` : ''}</span> : null}
            <span className="checkout-page__text">{t('pages.checkout.shippingFee')}: <span className="commerce-money">{formatMoney(createdOrder.shippingFee)}</span></span>
            <span className="checkout-page__text">{t('pages.checkout.paymentStatus')}: <ShopTag color={getPaymentStatusColor(payment.status)}>{formatPaymentStatusLabel(payment.status)}</ShopTag></span>
            <span className="checkout-page__text checkout-page__paymentUrl">{t('pages.checkout.paymentLink')}: {formatPaymentUrlLabel(payment.paymentUrl)}</span>
            {paymentExpiresAtText ? <span className="checkout-page__text">{t('pages.checkout.paymentExpiresAt')}: {paymentExpiresAtText}</span> : null}
            {payment.transactionId && <span className="checkout-page__text">{t('pages.checkout.transactionId')}: {payment.transactionId}</span>}
          </div>
        </section>
      </div>
    );
  }

  if (cartLoadError && !createdOrder) {
    return (
      <Form form={form} component={false} validateTrigger={["onChange", "onBlur"]} requiredMark>
        <div className={`checkout-page checkout-page--error checkout-page--${language}`}>
          {renderCheckoutStatusLiveRegion()}
          <ShopBreadcrumb
            ariaLabel={t('pages.checkout.title')}
            items={[
              { key: 'home', label: t('nav.ariaHome'), path: '/' },
              { key: 'cart', label: t('pages.cart.title'), path: '/cart' },
              { key: 'checkout', label: t('pages.checkout.title') },
            ]}
          />
          <section className="checkout-page__hero checkout-page__hero--recovery">
            <div className="checkout-page__heroContent">
              <span className="checkout-page__heroEyebrow">{t('pages.checkout.readinessEyebrow')}</span>
              <h1 className="checkout-page__title">{t('pages.checkout.title')}</h1>
            </div>
          </section>
          <div data-checkout-load-recovery="true">
            <PageError
              className="checkout-page__loadError"
              title={t('pages.checkout.loadFailed')}
              description={cartLoadError}
              actions={[
                {
                  key: 'retry',
                  label: t('messages.retry'),
                  onClick: () => setCheckoutReloadKey((key) => key + 1),
                  type: 'primary',
                },
                {
                  key: 'cart',
                  label: t('pages.cart.title'),
                  onClick: () => navigate('/cart'),
                  type: 'default',
                },
                {
                  key: 'browse',
                  label: t('pages.cart.browse'),
                  onClick: () => navigate('/products'),
                  type: 'default',
                },
                {
                  key: 'coupons',
                  label: t('nav.coupons'),
                  onClick: () => navigate('/coupons'),
                  type: 'default',
                },
                {
                  key: 'support',
                  label: t('pages.productList.loadRecoverySupport'),
                  onClick: () => dispatchDomEvent('shop:open-support'),
                  type: 'default',
                },
              ]}
            />
          </div>
        </div>
      </Form>
    );
  }

  if (cartItems.length === 0) {
    return (
      <Form form={form} component={false} validateTrigger={["onChange", "onBlur"]} requiredMark>
        <div className={`checkout-page checkout-page--empty checkout-page--${language}`}>
        {renderCheckoutStatusLiveRegion()}
        <ShopBreadcrumb
          ariaLabel={t('pages.checkout.title')}
          items={[
            { key: 'home', label: t('nav.ariaHome'), path: '/' },
            { key: 'cart', label: t('pages.cart.title'), path: '/cart' },
            { key: 'checkout', label: t('pages.checkout.title') },
          ]}
        />
        <section className="checkout-page__emptyHero" aria-label={t('pages.checkout.emptySelected')}>
          <span className="checkout-page__emptyIcon">
            <ShopIcon path={SI.cart} />
          </span>
          <div className="checkout-page__emptyCopy">
            <span className="checkout-page__emptyEyebrow">{t('pages.checkout.readinessEyebrow')}</span>
            <h1 className="checkout-page__title">{t('pages.checkout.emptySelected')}</h1>
            <span className="checkout-page__text">{t('pages.checkout.savingsCoachSubtitle')}</span>
          </div>
          <div className="checkout-page__emptyActions" data-checkout-empty-actions="true">
            <ShopButton
              type="primary"
              icon={<ShopIcon path={SI.cart} />}
              onClick={() => navigate('/cart')}
              aria-label={t('pages.checkout.emptyBackCartAction')}
              title={t('pages.checkout.emptyBackCartAction')}
            >
              {t('pages.checkout.backCart')}
            </ShopButton>
            <ShopButton
              icon={<ShopIcon path={SI.shopping} />}
              onClick={() => navigate('/products')}
              aria-label={t('pages.checkout.emptyBrowseAction')}
              title={t('pages.checkout.emptyBrowseAction')}
            >
              {t('pages.cart.browse')}
            </ShopButton>
            <ShopButton
              icon={<ShopIcon path={SI.gift} />}
              onClick={() => navigate('/coupons')}
              aria-label={t('pages.checkout.emptyCouponsAction')}
              title={t('pages.checkout.emptyCouponsAction')}
            >
              {t('nav.coupons')}
            </ShopButton>
            <ShopButton
              icon={<ShopIcon path={SI.shopping} />}
              onClick={() => navigate('/pet-finder')}
              aria-label={`${t('nav.petFinder')}: ${t('pages.checkout.emptySelected')}`}
              title={`${t('nav.petFinder')}: ${t('pages.checkout.emptySelected')}`}
            >
              {t('nav.petFinder')}
            </ShopButton>
            <ShopButton
              icon={<ShopIcon path={SI.history} />}
              onClick={() => navigate('/history')}
              aria-label={t('pages.checkout.emptyHistoryAction')}
              title={t('pages.checkout.emptyHistoryAction')}
            >
              {t('nav.history')}
            </ShopButton>
          </div>
          <div className="checkout-page__emptySignals">
            <span>
              <ShopIcon path={SI.safety} />
              {t('pages.checkout.trustSecureTitle')}
            </span>
            <span>
              <ShopIcon path={SI.truck} />
              {market.freeShippingThreshold > 0
                ? t('pages.cart.freeShippingRemaining', { amount: formatMoney(market.freeShippingThreshold) })
                : t('pages.cart.freeShippingUnlocked')}
            </span>
            <span>
              <ShopIcon path={SI.support} />
              {t('pages.checkout.trustSupportTitle')}
            </span>
          </div>
        </section>
        </div>
      </Form>
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
      <section className="checkout-page__hero">
        <div className="checkout-page__heroContent">
          <span className="checkout-page__heroEyebrow">{t('pages.checkout.readinessEyebrow')}</span>
          <h1 className="checkout-page__title">{t('pages.checkout.title')}</h1>
          <span className="checkout-page__text">{t('pages.checkout.savingsCoachSubtitle')}</span>
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

      <section
        className={
          checkoutBlockingAction
            ? 'checkout-page__confirmationBand checkout-page__confirmationBand--blocked'
            : checkoutNextAction
              ? 'checkout-page__confirmationBand'
              : 'checkout-page__confirmationBand checkout-page__confirmationBand--ready'
        }
        aria-label={t('pages.checkout.readinessTitle')}
        data-checkout-confirmation-state={checkoutBlockingAction ? 'blocked' : checkoutNextAction ? 'coach' : 'ready'}
      >
        <div className="checkout-page__confirmationScore">
          <ShopProgress type="circle" percent={checkoutReadinessScore} size={58} strokeColor="#124734" />
          <span>
            <span className="checkout-page__text checkout-page__text--strong">{checkoutNextAction ? t('pages.checkout.nextActionTitle') : t('pages.checkout.nextActionReadyTitle')}</span>
            <span className="checkout-page__text checkout-page__text--secondary">{checkoutNextAction ? checkoutNextAction.text : t('pages.checkout.nextActionReadyText')}</span>
          </span>
        </div>
        <div className="checkout-page__confirmationFacts">
          <span>
            <span className="checkout-page__text checkout-page__text--secondary">{t('pages.checkout.itemSummary', { count: checkoutItemCount })}</span>
            <span className={`checkout-page__text checkout-page__text--strong ${shippingQuoteReady ? 'commerce-money' : ''}`}>{payableAmountText}</span>
          </span>
          <span>
            <span className="checkout-page__text checkout-page__text--secondary">{t('pages.checkout.paymentMethod')}</span>
            <span className="checkout-page__text checkout-page__text--strong">{selectedPaymentDetail?.title || t('pages.checkout.paymentConfidenceDefault')}</span>
          </span>
        </div>
        <ShopButton
          type="primary"
          className="checkout-page__confirmationButton"
          onClick={checkoutBlockingAction ? handleCheckoutNextAction : () => form.submit()}
          loading={submitting}
          disabled={!checkoutBlockingAction && checkoutSubmitDisabled}
          aria-label={checkoutBlockingAction ? checkoutConfirmationActionLabel : checkoutSubmitActionLabel}
          title={checkoutBlockingAction ? checkoutConfirmationActionLabel : checkoutSubmitTooltip}
        >
          {checkoutBlockingAction ? checkoutNextActionLabel : shippingQuoteReady ? t('pages.checkout.submitWithAmount', { amount: payableAmountText }) : shippingFeeText}
        </ShopButton>
      </section>

      <div className="checkout-page__trustBar" aria-label={t('pages.checkout.trustTitle')}>
        <div className="checkout-page__trustItem">
          <ShopIcon path={SI.safety} />
          <div>
            <span className="checkout-page__text checkout-page__text--strong">{t('pages.checkout.trustSecureTitle')}</span>
            <span className="checkout-page__text checkout-page__text--secondary">{t('pages.checkout.trustSecureText')}</span>
          </div>
        </div>
        <div className="checkout-page__trustItem">
          <ShopIcon path={SI.swap} />
          <div>
            <span className="checkout-page__text checkout-page__text--strong">{t('pages.checkout.trustReturnsTitle')}</span>
            <span className="checkout-page__text checkout-page__text--secondary">{t('pages.checkout.trustReturnsText')}</span>
          </div>
        </div>
        <div className="checkout-page__trustItem">
          <ShopIcon path={SI.support} />
          <div>
            <span className="checkout-page__text checkout-page__text--strong">{t('pages.checkout.trustSupportTitle')}</span>
            <span className="checkout-page__text checkout-page__text--secondary">{t('pages.checkout.trustSupportText')}</span>
          </div>
        </div>
      </div>

      <section className="checkout-page__expressCard" aria-label={t('pages.checkout.expressCheckout')}><div className="shop-panel__head"><div className="shop-panel__title">{t('pages.checkout.expressCheckout')}</div></div>
        <div className="checkout-page__paymentGrid" role="radiogroup" aria-label={t('pages.payment.title')} aria-required="true">
          {!paymentMethodsAvailable ? (
            <ShopAlert
              className="checkout-page__paymentUnavailable"
              data-checkout-payment-unavailable="true"
              type="warning"
              showIcon
              role="alert"
              aria-live="polite"
              message={t('pages.checkout.paymentUnavailable')}
              description={paymentChannelsError || t('pages.checkout.paymentUnavailableDescription')}
              action={paymentUnavailableRecoveryActions}
            />
          ) : null}
          {paymentMethodDetails.map((method, index) => {
            const checked = watchedPaymentMethod === method.value;
            const defaultTabStop = !watchedPaymentMethod
              && method.value === (recommendedPaymentMethod || paymentMethodDetails[0]?.value);
            const methodActionLabel = `${method.title}: ${t(method.descriptionKey)}`;
            return (
              <button
                type="button"
                key={method.value}
                role="radio"
                aria-checked={checked}
                aria-label={methodActionLabel}
                title={methodActionLabel}
                tabIndex={checked || defaultTabStop || (!watchedPaymentMethod && !recommendedPaymentMethod && index === 0) ? 0 : -1}
                data-payment-method={method.value}
                className={`checkout-page__paymentMethod${checked ? ' checkout-page__paymentMethod--selected' : ''}`}
                onClick={() => selectCheckoutPaymentMethod(method.value)}
                onKeyDown={(event) => handlePaymentMethodKeyDown(event, method.value)}
              >
                <span className="checkout-page__paymentMethodTop">
                  <strong className="checkout-page__paymentMethodTitle">{method.title}</strong>
                  <span className="checkout-page__paymentBadges">
                    {recommendedPaymentMethod === method.value ? <ShopTag color="gold">{t('pages.checkout.recommendedPayment')}</ShopTag> : null}
                    <ShopTag color={method.market === 'CN' ? 'red' : method.value === 'OXXO' ? 'orange' : method.value === 'SPEI' ? 'blue' : 'green'}>{t(method.badgeKey)}</ShopTag>
                  </span>
                </span>
                <span className="checkout-page__paymentMethodDescription">{t(method.descriptionKey)}</span>
              </button>
            );
          })}
        </div>
        <span className="checkout-page__text checkout-page__text--secondary checkout-page__expressHint">
          {t('pages.checkout.expressHint')}
        </span>
      </section>

      <section className="checkout-page__benefitStrip">
        <div className="checkout-page__benefitItem">
          <span className="checkout-page__benefitIcon"><ShopIcon path={SI.truck} /></span>
          <div>
            <span className="checkout-page__text checkout-page__text--strong">
              {freeShippingRemaining > 0
                ? t('pages.cart.freeShippingRemaining', { amount: formatMoney(freeShippingRemaining) })
                : t('pages.cart.freeShippingUnlocked')}
            </span>
            <ShopProgress percent={freeShippingPercent} showInfo={false} strokeColor="#124734" trailColor="#edf0ed" />
          </div>
        </div>
        {deliveryPromise.enabled ? (
          <div className="checkout-page__benefitItem">
            <span className="checkout-page__benefitIcon"><ShopIcon path={SI.safety} /></span>
            <div>
              <span className="checkout-page__text checkout-page__text--strong">{t('pages.checkout.deliveryPromise', { window: deliveryPromise.windowText })}</span>
              <span className="checkout-page__text checkout-page__text--secondary">
                {deliveryPromise.shipsToday
                  ? t('pages.checkout.shipsToday', { cutoff: `${deliveryPromise.cutoffHour}:00` })
                  : t('pages.checkout.shipsNextBusinessDay')}
              </span>
            </div>
          </div>
        ) : null}
        {giftEligible ? (
          <div className={giftUnlocked ? 'checkout-page__benefitItem checkout-page__benefitItem--ready' : 'checkout-page__benefitItem'}>
            <span className="checkout-page__benefitIcon">{giftUnlocked ? <ShopIcon path={SI.checkCircle} /> : <ShopIcon path={SI.gift} />}</span>
            <div>
              <span className="checkout-page__text checkout-page__text--strong">
                {giftUnlocked
                  ? t('pages.checkout.giftUnlocked', { gift: t(conversionConfig.giftAtCheckout.giftNameKey) })
                  : t('pages.checkout.giftRemaining', { amount: formatMoney(giftRemaining), gift: t(conversionConfig.giftAtCheckout.giftNameKey) })}
              </span>
              <ShopProgress percent={giftProgress} showInfo={false} strokeColor={giftUnlocked ? '#124734' : '#ffb84d'} trailColor="#edf0ed" />
            </div>
          </div>
        ) : null}
      </section>

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

      <details
        className="checkout-page__supportPanel"
        open={supportPanelOpen}
        onToggle={handleSupportPanelToggle}
      >
        <summary>
          <span>
            <span className="checkout-page__text checkout-page__text--strong">{t('pages.checkout.savingsCoachTitle')}</span>
            <span className="checkout-page__text checkout-page__text--secondary">{t('pages.checkout.savingsCoachSubtitle')}</span>
          </span>
          <ShopTag color={checkoutNextAction ? 'orange' : 'green'}>{checkoutReadinessScore}%</ShopTag>
        </summary>

        <section className="checkout-page__savingsCoach">
          <div className="checkout-page__savingsCoachHeader">
            <div>
              <span className="checkout-page__text checkout-page__text--secondary">{t('pages.checkout.savingsCoachEyebrow')}</span>
              <span className="checkout-page__text checkout-page__text--strong">{t('pages.checkout.savingsCoachTitle')}</span>
              <span className="checkout-page__text checkout-page__text--secondary">{t('pages.checkout.savingsCoachSubtitle')}</span>
            </div>
            {addOnTarget ? (
              <ShopButton
                size="small"
                icon={<ShopIcon path={SI.swap} />}
                className="checkout-page__addOnButton"
                aria-label={checkoutSavingsAddOnsActionLabel}
                title={checkoutSavingsAddOnsActionLabel}
                onClick={scrollToAddOns}
              >
                {t('pages.checkout.savingsShopAddOns')}
              </ShopButton>
            ) : null}
          </div>
          <div className="checkout-page__savingsCoachGrid">
            {savingsCoachItems.map((item) => (
              <div className={item.ready ? 'checkout-page__savingsCoachItem checkout-page__savingsCoachItem--ready' : 'checkout-page__savingsCoachItem'} key={item.key}>
                <span className="checkout-page__savingsCoachIcon">{item.ready ? <ShopIcon path={SI.checkCircle} /> : item.icon}</span>
                <span>
                  <span className="checkout-page__text checkout-page__text--strong">{item.title}</span>
                  <span className="checkout-page__text checkout-page__text--secondary">{item.text}</span>
                </span>
              </div>
            ))}
          </div>
        </section>

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
          <section className={couponOpportunity.type === 'ready' ? 'checkout-page__couponOpportunity checkout-page__couponOpportunity--ready' : 'checkout-page__couponOpportunity'}>
            <div>
              <span className="checkout-page__text checkout-page__text--strong">{couponOpportunity.title}</span>
              <span className="checkout-page__text checkout-page__text--secondary">{couponOpportunity.text}</span>
            </div>
            <ShopButton
              size="small"
              type={couponOpportunity.type === 'ready' ? 'default' : 'primary'}
              className="checkout-page__addOnButton"
              aria-label={checkoutCouponOpportunityActionLabel}
              title={checkoutCouponOpportunityActionLabel}
              onClick={handleCouponOpportunityAction}
            >
              {couponOpportunity.action}
            </ShopButton>
          </section>
        ) : null}

        <section className="checkout-page__readiness">
          <div className="checkout-page__readinessHeader">
            <div>
              <span className="checkout-page__text checkout-page__text--secondary">{t('pages.checkout.readinessEyebrow')}</span>
              <span className="checkout-page__text checkout-page__text--strong">{t('pages.checkout.readinessTitle')}</span>
            </div>
            <ShopProgress type="circle" percent={checkoutReadinessScore} size={64} strokeColor="#124734" />
          </div>
          <div className="checkout-page__readinessGrid">
            {checkoutReadinessItems.map((item) => (
              <div className={item.ready ? 'checkout-page__readinessItem checkout-page__readinessItem--ready' : 'checkout-page__readinessItem'} key={item.key}>
                <ShopIcon path={SI.checkCircle} />
                <span>
                  <span className="checkout-page__text checkout-page__text--strong">{item.label}</span>
                  <span className="checkout-page__text checkout-page__text--secondary">{item.text}</span>
                </span>
              </div>
            ))}
          </div>
          <div className={checkoutNextAction ? 'checkout-page__nextAction' : 'checkout-page__nextAction checkout-page__nextAction--ready'}>
            <span>
              <span className="checkout-page__text checkout-page__text--strong">
                {checkoutNextAction
                  ? t('pages.checkout.nextActionTitle')
                  : t('pages.checkout.nextActionReadyTitle')}
              </span>
              <span className="checkout-page__text checkout-page__text--secondary">
                {checkoutNextAction
                  ? checkoutNextAction.text
                  : t('pages.checkout.nextActionReadyText')}
              </span>
            </span>
            <ShopButton size="small" type={checkoutNextAction ? 'primary' : 'default'} aria-label={checkoutReadinessActionLabel} title={checkoutReadinessActionLabel} onClick={handleCheckoutNextAction}>
              {checkoutCoachActionLabel}
            </ShopButton>
          </div>
        </section>
      </details>

      <section className="checkout-page__itemsCard checkout-page__sectionCard" aria-label={t('pages.checkout.itemList')}><div className="shop-panel__head"><div className="shop-panel__title">{t('pages.checkout.itemList')}</div></div>
        <ul className="checkout-page__itemList" role="list">
          {cartItems.map((item) => {
            const itemName = checkoutCartItemName(item);
            const itemActionLabel = `${t('pages.productList.viewDetails')}: ${itemName}`;
            return (
              <li key={item.id} className="checkout-page__item">
                <div className="checkout-page__itemMeta">
                  <img
                    src={resolveCheckoutImage(item.imageUrl)}
                    alt={itemName}
                    className="checkout-page__itemImage"
                    loading="lazy"
                    decoding="async"
                    onError={(event) => {
                      if (event.currentTarget.src !== checkoutImageFallback) {
                        event.currentTarget.src = checkoutImageFallback;
                      }
                    }}
                  />
                  <div className="checkout-page__itemBody">
                    <button
                      type="button"
                      className="checkout-page__itemLink"
                      aria-label={itemActionLabel}
                      title={itemActionLabel}
                      onClick={() => navigate(`/products/${item.productId}`)}
                    >
                      {itemName}
                    </button>
                    <div className="checkout-page__itemDescription">
                      {item.selectedSpecs ? <span className="checkout-page__text checkout-page__text--secondary">{formatSelectedSpecs(item.selectedSpecs, t, language)}</span> : null}
                      {getCartItemLowStockCount(item) !== null ? (
                        <span className="checkout-page__text checkout-page__text--warning checkout-page__urgency">
                          {t('pages.cart.lowStockLeft', { count: getCartItemLowStockCount(item) ?? 0 })}
                        </span>
                      ) : null}
                      <div className="checkout-page__itemCommerce">
                        <span className="checkout-page__text checkout-page__text--secondary checkout-page__itemUnit commerce-atomic commerce-price-quantity">
                          <span className="commerce-money">{formatMoney(item.price)}</span>
                          <span className="commerce-quantity">x {item.quantity}</span>
                        </span>
                        <span className="checkout-page__text checkout-page__text--strong checkout-page__itemTotal commerce-money">{formatMoney(getCartLineAmount(item))}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <hr className="checkout-page__divider" />
        <div className="checkout-page__summaryLine">
          <span className="checkout-page__text">{t('pages.checkout.itemSummary', { count: checkoutItemCount })}</span>
          <span className="checkout-page__text checkout-page__text--strong checkout-page__summaryTotal commerce-money"> {formatMoney(cartTotal)}</span>
        </div>
      </section>

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
          <section className="checkout-page__sectionCard" id="checkout-contact-card" aria-label={t('pages.checkout.contact')}><div className="shop-panel__head"><div className="shop-panel__title">{t('pages.checkout.contact')}</div></div>
            <Form.Item
              name="guestEmail"
              label={t('pages.checkout.email')}
              rules={[{ required: true, message: t('pages.checkout.emailRequired') }, { type: 'email', message: t('pages.checkout.emailInvalid') }]}
              extra={renderCheckoutFieldErrorExtra('guestEmail')}
            >
              <ShopInput placeholder={t('pages.checkout.guestEmailPlaceholder')} autoComplete="email" inputMode="email" maxLength={120} />
            </Form.Item>
            <span className="checkout-page__text checkout-page__text--secondary">{t('pages.checkout.guestHint')}</span>
          </section>
        ) : null}

        <section className="checkout-page__sectionCard" id="checkout-address-card" aria-label={t('pages.checkout.address')}><div className="shop-panel__head"><div className="shop-panel__title">{t('pages.checkout.address')}</div></div>
          {addressLoadFailed ? (
            <ShopAlert
              type="warning"
              showIcon
              className="checkout-page__addressLoadAlert"
              message={t('pages.checkout.addressLoadFailed')}
              description={t('pages.checkout.addressLoadFailedDescription')}
              action={<ShopButton size="small" onClick={() => setCheckoutReloadKey((key) => key + 1)}>{t('messages.retry')}</ShopButton>}
            />
          ) : null}
          {addresses.length > 0 && (
            <div
              className="checkout-page__addressGroup"
              role="radiogroup"
              aria-label={checkoutAddressGroupLabel}
              title={checkoutAddressGroupLabel}
            >
              {addresses.map((address) => {
                const addressChoiceLabel = [
                  normalizeCheckoutText(address.recipientName, 80),
                  normalizeLikelyCheckoutPhone(address.phone),
                  normalizeCheckoutText(address.address, 260),
                  address.isDefault ? t('pages.checkout.defaultAddress') : null,
                ].filter(Boolean).join(', ');
                const selected = String(selectedAddressId) === String(address.id);
                return (
                  <button
                    key={address.id}
                    type="button"
                    role="radio"
                    className={selected ? 'checkout-page__addressChoice checkout-page__addressChoice--selected' : 'checkout-page__addressChoice'}
                    aria-checked={selected}
                    aria-label={addressChoiceLabel}
                    title={addressChoiceLabel}
                    onClick={() => setSelectedAddressId(address.id)}
                  >
                    <div className="checkout-page__addressHeader">
                      <span className="checkout-page__text checkout-page__text--strong">{address.recipientName}</span>
                      <span className="checkout-page__text checkout-page__text--secondary">{address.phone}</span>
                      {address.isDefault && <ShopTag color="orange">{t('pages.checkout.defaultAddress')}</ShopTag>}
                    </div>
                    <div className="checkout-page__addressText">{address.address}</div>
                  </button>
                );
              })}
              <button
                type="button"
                role="radio"
                className={selectedAddressId === 'new' ? 'checkout-page__addressChoice checkout-page__addressChoice--selected' : 'checkout-page__addressChoice'}
                aria-checked={selectedAddressId === 'new'}
                aria-label={t('pages.checkout.useNewAddress')}
                title={t('pages.checkout.useNewAddress')}
                onClick={() => setSelectedAddressId('new')}
              >
                <span className="checkout-page__text checkout-page__text--strong">{t('pages.checkout.useNewAddress')}</span>
              </button>
            </div>
          )}

          {(selectedAddressId === 'new' || addresses.length === 0) && (
            <>
              <Form.Item
                name="recipientName"
                label={t('pages.checkout.recipient')}
                rules={[
                  { required: true, message: t('pages.checkout.recipientRequired') },
                  {
                    validator: (_, value) => (
                      !value || hasCompleteCheckoutRecipientName(value)
                        ? Promise.resolve()
                        : Promise.reject(new Error(t('pages.checkout.recipientMin')))
                    ),
                  },
                ]}
                extra={renderCheckoutFieldErrorExtra('recipientName')}
              >
                <ShopInput placeholder={t('pages.checkout.recipientRequired')} maxLength={80} autoComplete="name" />
              </Form.Item>
              <Form.Item
                name="phone"
                label={t('pages.profile.phone')}
                rules={[
                  { required: true, message: t('pages.checkout.phoneRequired') },
                  { validator: (_, value) => (!value || isLikelyPhone(value) ? Promise.resolve() : Promise.reject(new Error(t('pages.checkout.phoneInvalid')))) },
                ]}
                extra={renderCheckoutFieldErrorExtra('phone')}
              >
                <ShopInput
                  placeholder={t('pages.checkout.phoneRequired')}
                  maxLength={40}
                  autoComplete="tel"
                  inputMode="tel"
                  onBlur={handleCheckoutPhoneBlur}
                />
              </Form.Item>
              <Form.Item
                name="region"
                label={t('pages.checkout.region')}
                rules={[{ required: true, message: t('pages.checkout.regionRequired') }]}
                extra={renderCheckoutFieldErrorExtra('region')}
              >
                <ShopCascader
                  options={regionOptions}
                  placeholder={regionOptionsLoading ? t('common.loading') : t('pages.checkout.regionPlaceholder')}
                  ariaLabel={checkoutRegionInputLabel}
                  title={checkoutRegionInputLabel}
                  open={checkoutRegionCascaderOpen}
                  onOpenChange={(open) => {
                    if (open) void loadCheckoutRegionOptions();
                    setCheckoutRegionCascaderVisibility(open);
                  }}
                  popupClassName="shop-mobile-popup-layer checkout-region-cascader-popup"
                  popupZIndex={2400}
                />
              </Form.Item>
              <Form.Item
                name="shippingAddress"
                label={t('pages.checkout.detailAddress')}
                rules={[
                  { required: true, message: t('pages.checkout.detailRequired') },
                  {
                    validator: (_, value) => (
                      !value || hasCompleteCheckoutDetailAddress(value)
                        ? Promise.resolve()
                        : Promise.reject(new Error(t('pages.checkout.detailMin')))
                    ),
                  },
                ]}
                extra={renderCheckoutFieldErrorExtra('shippingAddress')}
              >
                <ShopTextArea rows={3} placeholder={t('pages.checkout.detailPlaceholder')} maxLength={260} showCount autoComplete="street-address" />
              </Form.Item>
              <Form.Item
                name="postalCode"
                label={t('pages.checkout.postalCode')}
                dependencies={['region']}
                rules={[
                  { required: true, message: t('pages.checkout.postalCodeRequired') },
                  ({ getFieldValue }) => ({
                    validator: (_, value) => (
                      !value || isValidCheckoutPostalCode(value, getFieldValue('region'))
                        ? Promise.resolve()
                        : Promise.reject(new Error(t('pages.checkout.postalCodeInvalid')))
                    ),
                  }),
                ]}
                extra={renderCheckoutFieldErrorExtra('postalCode')}
              >
                <ShopInput
                  placeholder={t('pages.checkout.postalCodePlaceholder')}
                  maxLength={20}
                  autoComplete="postal-code"
                  inputMode="text"
                  onBlur={(event) => form.setFieldValue('postalCode', normalizeCheckoutPostalCode(event.target.value))}
                />
              </Form.Item>
            </>
          )}
        </section>

        {!isGuestCheckout ? <section className="checkout-page__sectionCard" id="checkout-coupon-card" aria-label={t('pages.checkout.coupon')}><div className="shop-panel__head"><div className="shop-panel__title">{t('pages.checkout.coupon')}</div></div>
          <ShopSelect
            allowClear
            className="checkout-page__couponSelect"
            placeholder={t('pages.checkout.selectCoupon')}
            value={selectedUserCouponId != null ? String(selectedUserCouponId) : undefined}
            popupClassName="shop-mobile-popup-layer"
            popupZIndex={2400}
            ariaLabel={checkoutCouponSelectLabel}
            title={checkoutCouponSelectLabel}
            onChange={(value) => {
              couponAutoSelectedQuoteRef.current = null;
              setCouponManuallyChanged(true);
              setCouponQuoteErrorMessage(null);
              setCouponSelectionErrorMessage(null);
              setSelectedUserCouponId(value ? Number(value) : null);
            }}
            options={availableCoupons.map((coupon) => {
              const couponDiscount = calculateCouponDiscount(coupon);
              return {
                value: String(coupon.id),
                label: couponDiscount > 0
                  ? `${describeCoupon(coupon)} - ${t('pages.checkout.couponSaveAmount', { amount: formatMoney(couponDiscount) })}${bestCouponCandidate?.coupon.id === coupon.id ? ` - ${t('pages.checkout.bestCoupon')}` : ''}`
                  : describeCoupon(coupon),
                disabled: couponDiscount <= 0,
              };
            })}
          />
          {couponSelectionErrorMessage ? (
            <ShopAlert
              type="warning"
              showIcon
              className="checkout-page__couponAlert"
              message={couponSelectionErrorMessage}
            />
          ) : null}
          {selectedCoupon && discountAmount > 0 ? (
            <ShopAlert
              type="success"
              showIcon
              className="checkout-page__couponAlert"
              message={selectedIsBestCoupon
                ? t('pages.checkout.bestCouponApplied', { name: selectedCoupon.couponName })
                : t('pages.checkout.couponAutoApplied', { name: selectedCoupon.couponName })}
              description={t('pages.checkout.couponSavings', { amount: formatMoney(discountAmount) })}
            />
          ) : null}
          {couponQuote && availableCoupons.length > 0 && !availableCoupons.some((coupon) => calculateCouponDiscount(coupon) > 0) ? (
            <div className="checkout-page__couponRules">
              <span className="checkout-page__text checkout-page__text--secondary">{t('pages.checkout.couponRulesNotMet')}</span>
            </div>
          ) : null}
          <div className="checkout-page__couponSummary">
            <div><span className="checkout-page__text">{t('common.subtotal')}: <span className="commerce-money">{formatMoney(cartTotal)}</span></span></div>
            {discountAmount > 0 ? <div><span className="checkout-page__text checkout-page__text--success">{t('pages.checkout.couponDiscount')}: <span className="commerce-money">-{formatMoney(discountAmount)}</span></span></div> : null}
            <div><span className="checkout-page__text">{t('pages.checkout.shippingFee')}: <span className={shippingQuoteReady ? 'commerce-money' : 'checkout-page__pendingAmount'}>{shippingFeeText}</span></span></div>
            <span className="checkout-page__text checkout-page__text--secondary checkout-page__shippingPolicy">{shippingPolicyText}</span>
            {shippingQuotePending || shippingQuoteUnavailable || shippingQuoteFallbackActive ? (
              <ShopAlert
                type={shippingQuoteUnavailable ? 'error' : shippingQuoteFallbackActive ? 'warning' : 'info'}
                showIcon
                message={shippingPolicyText}
                description={shippingQuoteAlertDescription}
              />
            ) : null}
            <div><span className="checkout-page__text checkout-page__text--strong checkout-page__payableTotal">{t('pages.checkout.payable')}: <span className={shippingQuoteReady ? 'commerce-money' : 'checkout-page__pendingAmount'}>{payableAmountText}</span></span></div>
          </div>
        </section> : (
          <section className="checkout-page__sectionCard" id="checkout-coupon-card" aria-label={t('pages.checkout.orderSummary')}><div className="shop-panel__head"><div className="shop-panel__title">{t('pages.checkout.orderSummary')}</div></div>
            <div className="checkout-page__couponSummary">
              <div><span className="checkout-page__text">{t('common.subtotal')}: <span className="commerce-money">{formatMoney(cartTotal)}</span></span></div>
              <div><span className="checkout-page__text">{t('pages.checkout.shippingFee')}: <span className={shippingQuoteReady ? 'commerce-money' : 'checkout-page__pendingAmount'}>{shippingFeeText}</span></span></div>
              <span className="checkout-page__text checkout-page__text--secondary checkout-page__shippingPolicy">{shippingPolicyText}</span>
              {shippingQuotePending || shippingQuoteUnavailable || shippingQuoteFallbackActive ? (
                <ShopAlert
                  type={shippingQuoteUnavailable ? 'error' : shippingQuoteFallbackActive ? 'warning' : 'info'}
                  showIcon
                  message={shippingPolicyText}
                  description={shippingQuoteAlertDescription}
                />
              ) : null}
              <div><span className="checkout-page__text checkout-page__text--strong checkout-page__payableTotal">{t('pages.checkout.payable')}: <span className={shippingQuoteReady ? 'commerce-money' : 'checkout-page__pendingAmount'}>{payableAmountText}</span></span></div>
            </div>
          </section>
        )}

        <section id="checkout-payment-card" aria-label={t('pages.payment.title')}><div className="shop-panel__head"><div className="shop-panel__title">{t('pages.payment.title')}</div></div>
          <div className="checkout-page__paymentConfidence">
            <ShopIcon path={SI.safety} />
            <span>
              <span className="checkout-page__text checkout-page__text--strong">{t('pages.checkout.paymentConfidenceTitle')}</span>
              <span className="checkout-page__text checkout-page__text--secondary">
                {!paymentMethodsAvailable
                  ? t('pages.checkout.paymentUnavailable')
                  : selectedPaymentDetail
                  ? t('pages.checkout.paymentConfidenceSelected', { method: selectedPaymentDetail.title })
                  : t('pages.checkout.paymentConfidenceDefault')}
              </span>
            </span>
          </div>
          {!paymentMethodsAvailable ? (
            <ShopAlert
              className="checkout-page__paymentUnavailable"
              data-checkout-payment-unavailable="true"
              type="warning"
              showIcon
              role="alert"
              aria-live="polite"
              message={t('pages.checkout.paymentUnavailable')}
              description={paymentChannelsError || t('pages.checkout.paymentUnavailableDescription')}
              action={paymentUnavailableRecoveryActions}
            />
          ) : null}
          <Form.Item name="paymentMethod" rules={[{ required: true, message: t('pages.checkout.paymentRequired') }]} hidden>
            <ShopInput />
          </Form.Item>
          <div className="checkout-page__submitReview">
            <div className="checkout-page__submitMetric">
              <span className="checkout-page__text checkout-page__text--secondary">{t('pages.checkout.itemSummary', { count: checkoutItemCount })}</span>
              <span className={`checkout-page__text checkout-page__text--strong ${shippingQuoteReady ? 'commerce-money' : ''}`}>{payableAmountText}</span>
            </div>
            <div className="checkout-page__submitMetric checkout-page__submitMetric--method">
              <span className="checkout-page__text checkout-page__text--secondary">{t('pages.checkout.paymentMethod')}</span>
              <span className="checkout-page__text checkout-page__text--strong">{selectedPaymentDetail?.title || t('pages.checkout.paymentConfidenceDefault')}</span>
            </div>
            <Form.Item className="checkout-page__submitAction">
              <ShopButton className="checkout-page__submitButton" type="primary" htmlType="submit" loading={submitting} disabled={checkoutSubmitDisabled} block size="large" aria-label={checkoutSubmitActionLabel} title={checkoutSubmitTooltip}>
                    {renderSubmitWithAmount()}
                  </ShopButton>
            </Form.Item>
            <p className="checkout-page__legalNotice" role="note">
              {t('pages.checkout.orderAgreementPrefix')}{' '}
              <Link to="/terms">{t('footer.terms')}</Link>
              {' '}{t('pages.checkout.orderAgreementAnd')}{' '}
              <Link to="/privacy">{t('footer.privacy')}</Link>
              {t('pages.checkout.orderAgreementSuffix')}
            </p>
          </div>
          <div
            className={checkoutBlockingAction ? 'checkout-page__mobilePayBar checkout-page__mobilePayBar--coach' : 'checkout-page__mobilePayBar'}
            role="region"
            aria-label={t('pages.checkout.paymentConfidenceTitle')}
            data-checkout-mobile-coach={checkoutBlockingAction ? 'true' : 'false'}
          >
            <span className="checkout-page__mobilePayBarMeta">
              <span className="checkout-page__text checkout-page__text--secondary">{t('pages.checkout.payable')}</span>
              <span className={`checkout-page__text checkout-page__text--strong ${shippingQuoteReady ? 'commerce-money' : ''}`}>{payableAmountText}</span>
              <span className={checkoutBlockingAction
                ? 'checkout-page__text checkout-page__text--secondary checkout-page__mobilePayBarTrust checkout-page__mobilePayBarCoach'
                : 'checkout-page__text checkout-page__text--secondary checkout-page__mobilePayBarTrust'}
              >
                {checkoutBlockingAction
                  ? (checkoutNextAction?.text || checkoutCoachActionLabel)
                  : selectedPaymentDetail?.title
                    ? t('pages.checkout.mobilePayBarTrust', { method: selectedPaymentDetail.title })
                    : t('pages.checkout.mobilePayBarTrustDefault')}
              </span>
            </span>
            {!paymentMethodsAvailable ? (
              <div className="checkout-page__paymentUnavailableActions checkout-page__paymentUnavailableActions--mobile" data-checkout-payment-unavailable-recovery="true">
                <ShopButton
                  type="primary"
                  size="large"
                  loading={paymentChannelsLoading}
                  aria-label={t('messages.retry')}
                  title={t('messages.retry')}
                  onClick={reloadPaymentChannels}
                >
                  {t('messages.retry')}
                </ShopButton>
                <ShopButton
                  size="large"
                  icon={<ShopIcon path={SI.support} />}
                  aria-label={t('pages.profile.contactSupport')}
                  title={t('pages.profile.contactSupport')}
                  onClick={openSupport}
                >
                  {t('pages.profile.contactSupport')}
                </ShopButton>
                <ShopButton
                  size="large"
                  icon={<ShopIcon path={SI.cart} />}
                  aria-label={t('pages.cart.title')}
                  title={t('pages.cart.title')}
                  onClick={() => navigate('/cart')}
                >
                  {t('pages.cart.title')}
                </ShopButton>
                <ShopButton
                  size="large"
                  icon={<ShopIcon path={SI.shopping} />}
                  aria-label={t('pages.cart.browse')}
                  title={t('pages.cart.browse')}
                  onClick={() => navigate('/products')}
                >
                  {t('pages.cart.browse')}
                </ShopButton>
                <ShopButton
                  size="large"
                  icon={<ShopIcon path={SI.gift} />}
                  aria-label={t('nav.coupons')}
                  title={t('nav.coupons')}
                  onClick={() => navigate('/coupons')}
                >
                  {t('nav.coupons')}
                </ShopButton>
              </div>
            ) : (
              <ShopButton
                  type="primary"
                  htmlType={checkoutBlockingAction ? 'button' : 'submit'}
                  onClick={checkoutBlockingAction ? handleCheckoutNextAction : undefined}
                  loading={submitting}
                  disabled={!checkoutBlockingAction && checkoutSubmitDisabled}
                  aria-label={checkoutBlockingAction ? checkoutConfirmationActionLabel : checkoutSubmitActionLabel}
                  title={checkoutBlockingAction ? checkoutConfirmationActionLabel : checkoutSubmitTooltip}
                >
                  {checkoutBlockingAction ? checkoutNextActionLabel : renderSubmitWithAmount()}
                </ShopButton>
            )}
          </div>
        </section>
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
