import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Cascader, Divider, Form, Input, List, message, Modal, Progress, Radio, Result, Select, Space, Spin, Tag, Typography } from 'antd';
import type { FormInstance } from 'antd/es/form';
import { CheckCircleOutlined, CustomerServiceOutlined, GiftOutlined, HistoryOutlined, RollbackOutlined, SafetyCertificateOutlined, ShoppingCartOutlined, ShoppingOutlined, SwapOutlined, TruckOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { addressApi, cartApi, clearStoredAuthSession, couponApi, createApiAbortController, orderApi, paymentApi, productApi } from '../api';
import type { CartItem, CouponQuote, OrderCustomer, PaymentCustomer, PaymentChannel, ProductPublic as Product, UserAddress, UserCoupon } from '../types';
import { loadRegionData, type RegionOption } from '../regionData';
import { useLanguage, type Language } from '../i18n';
import { usePageTitle } from '../hooks/usePageTitle';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { createPaymentMethodDetails, paymentMethodLabel } from '../utils/paymentMethods';
import { useMarket } from '../hooks/useMarket';
import { formatSelectedSpecs } from '../utils/selectedSpecs';
import { addGuestCartItem, getGuestCartItems, removeGuestCartItems } from '../utils/guestCart';
import { navigateToSafeUrl } from '../utils/safeUrl';
import { conversionConfig, getDeliveryPromise, getLowStockCount } from '../utils/conversionConfig';
import { getGiftThreshold, getNearestCartBenefitTarget } from '../utils/cartBenefits';
import { getBundleInfo } from '../utils/bundle';
import { clearCheckoutCartItemIds, hasAuthenticatedCartSession, readCheckoutCartItemIds, syncCheckoutCartItemIds } from '../utils/cartSession';
import { formatPaymentUrlLabel, getPaymentRecoveryState } from '../utils/paymentRecovery';
import { productImageFallback, resolveProductImage } from '../utils/productMedia';
import { getApiErrorMessage, isAuthExpiredError } from '../utils/apiError';
import { deriveCartShippingSummary, getCartLineAmount, roundCartMoney } from '../utils/cartUi';
import { dispatchDomEvent } from '../utils/domEvents';
import { saveGuestSupportContext } from '../utils/guestSupportContext';
import { allSettledWithConcurrency } from '../utils/asyncBatch';
import { getLocalStorageItem, getSessionStorageItem, removeSessionStorageItem, setLocalStorageItem, setSessionStorageItem } from '../utils/safeStorage';
import { useNativeBackHandler } from '../utils/nativeBack';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import { focusFirstFormError } from '../utils/formValidationFocus';
import { buildLoginUrlFromWindow } from '../utils/authRedirect';
import { isLikelyPhoneNumber, normalizeLikelyPhoneNumber, normalizePhoneNumber } from '../utils/phone';
import { isValidRegionalPostalCode, normalizeRegionalPostalCode } from '../utils/postalCode';
import { getCouponPayablePercent } from '../utils/couponCenter';
import { runWithoutAccessibleMessageAnnouncement } from '../utils/accessibleMessage';
import {
  CHECKOUT_PAYMENT_POLL_LOCK_TTL_MS,
  claimCheckoutPaymentPollLock,
  createCheckoutPaymentPollOwnerId,
  releaseCheckoutPaymentPollLock,
  startCheckoutPaymentPollWebLockSession,
  type CheckoutPaymentPollWebLockSession,
} from '../utils/checkoutPaymentPollLock';
import AddOnAssistant from '../components/AddOnAssistant';
import PageError from '../components/PageError';
import ShopBreadcrumb from '../components/ShopBreadcrumb';
import './Checkout.css';
import '../styles/mobile-page-contrast.css';

const { Text, Title } = Typography;
const checkoutImageFallback = productImageFallback;
const resolveCheckoutImage = resolveProductImage;
const mobileCheckoutQuery = '(max-width: 780px)';
const CHECKOUT_IDEMPOTENCY_KEY = 'checkoutIdempotencyKey';
const CHECKOUT_PENDING_ORDER_KEY = 'checkoutPendingOrder';
const CHECKOUT_PAYMENT_POLL_MAX_MS = 30 * 60 * 1000;
const CHECKOUT_PAYMENT_POLL_RESULT_MAX_MS = CHECKOUT_PAYMENT_POLL_MAX_MS + CHECKOUT_PAYMENT_POLL_LOCK_TTL_MS;
const SUPPORT_PANEL_DISMISS_SUPPRESS_MS = 30 * 1000;
const CHECKOUT_GUEST_DRAFT_SAVE_DELAY_MS = 500;

type CheckoutPaymentPollResult = {
  ownerId: string;
  orderId: number;
  orderNo?: string;
  payment: PaymentCustomer;
  order?: OrderCustomer | null;
  updatedAt: number;
};

type CheckoutPendingOrderSnapshot = {
  order: OrderCustomer;
  paymentMethod: string;
  guestPaymentEmail?: string;
  cartItems: CartItem[];
  savedAt: number;
};

const PAYMENT_STATUS_LABEL_KEYS = new Set(['PENDING', 'PAID', 'FAILED', 'EXPIRED', 'REFUNDING', 'REFUNDED', 'RECONCILE_REQUIRED']);
const paymentStatusColors: Record<string, string> = {
  PENDING: 'orange',
  PAID: 'green',
  FAILED: 'red',
  EXPIRED: 'volcano',
  REFUNDING: 'purple',
  REFUNDED: 'purple',
  RECONCILE_REQUIRED: 'magenta',
};

const normalizeStatusCode = (status?: string) => String(status || '').trim().toUpperCase();

const isPurchasable = (item: CartItem) =>
  (item.productStatus || 'ACTIVE') === 'ACTIVE' && (item.stock === undefined || item.stock >= item.quantity);
const readGuestCartSnapshot = () => {
  const items = getGuestCartItems();
  return Array.isArray(items) ? items : [];
};
const getCartItemLowStockCount = (item: CartItem) => getLowStockCount(item.stock, item.quantity);
const areSameIds = (left: number[], right: number[]) => {
  const leftIds = new Set(left);
  const rightIds = new Set(right);
  return leftIds.size === rightIds.size && Array.from(leftIds).every((id) => rightIds.has(id));
};
const scrollCheckoutElementIntoView = (elementId: string, behavior: ScrollBehavior = 'smooth') => {
  if (typeof document === 'undefined') return;
  const element = document.getElementById(elementId);
  if (!element || typeof element.scrollIntoView !== 'function') return;
  const isMobile = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 780px)').matches;
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
      if (typeof field.scrollIntoView === 'function') {
        field.scrollIntoView({ behavior, block: 'center', inline: 'nearest' });
      }
    }, 80);
    return;
  }
  scrollCheckoutElementIntoMobileView(fallbackElementId, behavior);
};
const toSafeMoney = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
};
export const formatCheckoutDateTime = (value: unknown, dateLocale: string) => {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date || typeof value === 'number' || typeof value === 'string'
    ? new Date(value)
    : null;
  if (!date) return null;
  return Number.isFinite(date.getTime()) ? date.toLocaleString(dateLocale) : null;
};

const parseCartItemSelectedSpecs = (value?: string | null): Record<string, string> => {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.entries(parsed).reduce<Record<string, string>>((result, [key, option]) => {
      const normalizedKey = String(key || '').trim();
      if (!normalizedKey || option === undefined || option === null || typeof option === 'object') return result;
      const normalizedOption = String(option).trim();
      if (normalizedOption) result[normalizedKey] = normalizedOption;
      return result;
    }, {});
  } catch (error) {
    reportNonBlockingError('Checkout.parseCartItemSelectedSpecs', error);
    return {};
  }
};

const resolveGuestRestorePrice = (item: CartItem, product?: Product | null) => {
  const selectedSpecs = parseCartItemSelectedSpecs(item.selectedSpecs);
  const bundlePrice = selectedSpecs._purchaseMode === 'bundle' ? toSafeMoney(getBundleInfo(product)?.price) : 0;
  if (bundlePrice > 0) return bundlePrice;

  const selectedOptions = Object.entries(selectedSpecs).filter(([name]) => !name.startsWith('_'));
  const variants = product && Array.isArray(product.variants) ? product.variants : [];
  const skuMatch = selectedSpecs._variantSku
    ? variants.find((variant) => String(variant.sku || '').trim() === selectedSpecs._variantSku)
    : undefined;
  const optionMatch = selectedOptions.length > 0
    ? variants.find((variant) => selectedOptions.every(([name, option]) => variant.options?.[name] === option))
    : undefined;
  const variantPrice = toSafeMoney((skuMatch || optionMatch)?.price);
  if (variantPrice > 0) return variantPrice;

  const productPrice = toSafeMoney(product?.effectivePrice ?? product?.price);
  return productPrice > 0 ? productPrice : toSafeMoney(item.price);
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
  const payablePercent = getCouponPayablePercent(coupon);
  const discount = safeCartTotal * (100 - payablePercent) / 100;
  const maxDiscount = toSafeMoney(coupon.maxDiscountAmount);
  return Math.min(maxDiscount > 0 ? Math.min(discount, maxDiscount) : discount, safeCartTotal);
};

const findBestCoupon = (coupons: UserCoupon[], cartTotal: number) =>
  coupons
    .map((coupon) => ({ coupon, discount: estimateCouponDiscount(coupon, cartTotal) }))
    .filter((item) => Number.isFinite(item.discount) && item.discount > 0)
    .sort((left, right) => right.discount - left.discount || toSafeMoney(left.coupon.thresholdAmount) - toSafeMoney(right.coupon.thresholdAmount))[0] || null;

const normalizeCouponQuote = (quote?: CouponQuote | null): CouponQuote | null => (
  quote ? { ...quote, availableCoupons: Array.isArray(quote.availableCoupons) ? quote.availableCoupons : [] } : null
);

type CheckoutTranslationFn = (key: string, params?: Record<string, string | number>) => string;

type CheckoutCouponErrorLike = {
  code?: string;
  message?: string;
  response?: {
    status?: number;
    data?: {
      code?: string;
      error?: string;
      message?: string;
    };
  };
};

type CheckoutValidationField = {
  name?: Array<string | number>;
  errors?: React.ReactNode[];
};

const normalizeCheckoutValidationMessage = (message: React.ReactNode): string => {
  if (typeof message === 'string' || typeof message === 'number') {
    return String(message).trim();
  }
  if (Array.isArray(message)) {
    return message.map(normalizeCheckoutValidationMessage).filter(Boolean).join(' ').trim();
  }
  return '';
};

const buildCheckoutValidationAnnouncement = (
  fields: CheckoutValidationField[],
  t: CheckoutTranslationFn,
) => {
  const messages = Array.from(new Set(
    fields.flatMap((field) => (field.errors || []).map(normalizeCheckoutValidationMessage).filter(Boolean)),
  ));
  if (messages.length === 0) {
    return '';
  }
  return `${t('pages.checkout.validationErrorSummary', { count: messages.length })} ${messages.join(' ')}`;
};

const buildCheckoutFieldErrorMap = (fields: CheckoutValidationField[]): Record<string, string> => {
  const next: Record<string, string> = {};
  fields.forEach((field) => {
    const namePath = field.name;
    if (!namePath || namePath.length === 0) {
      return;
    }
    const key = namePath.map(String).join('.');
    const message = (field.errors || [])
      .map(normalizeCheckoutValidationMessage)
      .find(Boolean);
    if (message) {
      next[key] = message;
    }
  });
  return next;
};


const CHECKOUT_VALIDATION_SCROLL_OFFSET = 96;
const focusFirstCheckoutValidationError = (errorFields?: CheckoutValidationField[]) => {
  const firstFieldName = String(errorFields?.[0]?.name?.[0] || '');
  if (firstFieldName === 'paymentMethod') {
    scrollCheckoutElementIntoView('checkout-payment-card');
    const paymentOption = document.querySelector(
      '#checkout-payment-card .checkout-page__paymentMethod, #checkout-payment-card button, #checkout-payment-card [role="radio"]',
    ) as HTMLElement | null;
    if (paymentOption && typeof paymentOption.focus === 'function') {
      try {
        paymentOption.focus({ preventScroll: true });
      } catch {
        paymentOption.focus();
      }
    }
    return;
  }
  if (firstFieldName === 'guestEmail') {
    scrollCheckoutElementIntoView('checkout-contact-card');
  } else if (['recipientName', 'phone', 'region', 'shippingAddress', 'postalCode'].includes(firstFieldName)) {
    scrollCheckoutElementIntoView('checkout-address-card');
  }
  window.requestAnimationFrame(() => {
    focusFirstFormError({
      rootSelector: '.checkout-page',
      scrollOffset: CHECKOUT_VALIDATION_SCROLL_OFFSET,
    });
  });
};

const couponBusinessErrorStatuses = new Set([400, 404, 409, 422]);

const couponErrorMatchers: Array<[RegExp, string]> = [
  [/\b(expired|expire|expiration|outdated)\b/, 'pages.checkout.couponErrorExpired'],
  [/\b(threshold|minimum|min\.?|order\s+amount|amount\s+does\s+not\s+meet|does\s+not\s+meet|not\s+meet|spend\s+more)\b/, 'pages.checkout.couponErrorMinimum'],
  [/\b(already\s+used|has\s+been\s+used|redeemed|used\s+up|usage\s+limit|limit\s+reached)\b/, 'pages.checkout.couponErrorUsed'],
  [/\b(inactive|not\s+active\s+yet|not\s+active|not\s+started|not\s+yet\s+valid)\b/, 'pages.checkout.couponErrorInactive'],
  [/\b(not\s+found|missing|unknown)\b/, 'pages.checkout.couponErrorNotFound'],
  [/\b(out\s+of\s+stock|sold\s+out|no\s+stock|run\s+out|exhausted)\b/, 'pages.checkout.couponErrorOutOfStock'],
  [/\b(not\s+available|unavailable|disabled)\b/, 'pages.checkout.couponErrorUnavailable'],
  [/\b(cannot\s+be\s+used|can't\s+be\s+used|not\s+eligible|ineligible|not\s+applicable|not\s+usable)\b/, 'pages.checkout.couponErrorNotEligible'],
];

export const getCheckoutCouponErrorMessage = (
  error: unknown,
  fallback: string,
  t: CheckoutTranslationFn,
  language: Language,
) => {
  const apiMessage = getApiErrorMessage(error, fallback, language);
  const errorLike = error as CheckoutCouponErrorLike;
  const status = Number(errorLike.response?.status);
  const hasStatus = Number.isFinite(status);
  const responseData = errorLike.response?.data;
  const shouldMapBusinessError = Boolean(responseData) && (!hasStatus || couponBusinessErrorStatuses.has(status));
  if (!shouldMapBusinessError) {
    return apiMessage;
  }

  const signal = [
    responseData?.code,
    responseData?.error,
    responseData?.message,
    errorLike.code,
    errorLike.message,
  ].map((value) => String(value || '').trim().toLowerCase()).filter(Boolean).join(' ');

  if (!signal) {
    return apiMessage;
  }

  const matched = couponErrorMatchers.find(([matcher]) => matcher.test(signal));
  return matched ? t(matched[1]) : apiMessage;
};

const sanitizeCheckoutControlChars = (value: string) =>
  Array.from(value, (char) => {
    const code = char.charCodeAt(0);
    return code <= 31 || code === 127 ? ' ' : char;
  }).join('');
const normalizeCheckoutText = (value: unknown, maxLength: number) =>
  sanitizeCheckoutControlChars(String(value || '')).trim().replace(/\s+/g, ' ').slice(0, maxLength);

const CHECKOUT_RECIPIENT_MIN_LENGTH = 2;
const CHECKOUT_DETAIL_ADDRESS_MIN_LENGTH = 5;
const hasMinimumCheckoutTextLength = (value: unknown, maxLength: number, minLength: number) =>
  normalizeCheckoutText(value, maxLength).length >= minLength;
const hasCompleteCheckoutRecipientName = (value: unknown) =>
  hasMinimumCheckoutTextLength(value, 80, CHECKOUT_RECIPIENT_MIN_LENGTH);
const hasCompleteCheckoutDetailAddress = (value: unknown) =>
  hasMinimumCheckoutTextLength(value, 260, CHECKOUT_DETAIL_ADDRESS_MIN_LENGTH);

const normalizeCheckoutPostalCode = normalizeRegionalPostalCode;
export const isValidCheckoutPostalCode = isValidRegionalPostalCode;

const normalizeCheckoutEmail = (value: unknown) =>
  normalizeCheckoutText(value, 120).replace(/\s+/g, '').toLowerCase();

const checkoutEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isLikelyCheckoutEmail = (value: unknown) => checkoutEmailPattern.test(normalizeCheckoutEmail(value));

const checkoutPhoneOptions = { minDigits: 6, maxDigits: 20, maxInputLength: 40, collapseWhitespace: true };
const isLikelyPhone = (value: unknown) => isLikelyPhoneNumber(value, checkoutPhoneOptions);
const normalizeCheckoutPhone = (value: unknown) => normalizePhoneNumber(value, checkoutPhoneOptions);
const normalizeLikelyCheckoutPhone = (value: unknown) =>
  normalizeLikelyPhoneNumber(value, checkoutPhoneOptions);

type CheckoutErrorResponseLike = {
  response?: {
    status?: unknown;
  };
};

const getCheckoutErrorResponse = (error: unknown) => (
  typeof error === 'object' && error !== null && 'response' in error
    ? (error as CheckoutErrorResponseLike).response
    : undefined
);

const checkoutOrderFinalErrorStatuses = new Set([400, 404, 409, 422]);
const isFinalCheckoutOrderError = (error: unknown) => {
  const status = getCheckoutErrorResponse(error)?.status;
  return typeof status === 'number' && checkoutOrderFinalErrorStatuses.has(status);
};

const clearExpiredCheckoutSession = () => {
  clearStoredAuthSession();
};

const normalizeCheckoutIdempotencyKey = (value: unknown) =>
  normalizeCheckoutText(value, 120).replace(/[^a-z0-9._:-]/gi, '').slice(0, 120);

const createCheckoutIdempotencyKey = () => {
  const cryptoApi = window.crypto as (Crypto & { randomUUID?: () => string }) | undefined;
  if (cryptoApi?.randomUUID) {
    return `checkout-${cryptoApi.randomUUID()}`;
  }
  const randomWords = cryptoApi?.getRandomValues
    ? cryptoApi.getRandomValues(new Uint32Array(4))
    : [];
  const random = Array.from(randomWords)
    .map((value) => value.toString(16).padStart(8, '0'))
    .join('');
  return `checkout-${Date.now().toString(36)}-${random || Math.random().toString(36).slice(2, 12)}`;
};

const getOrCreateCheckoutIdempotencyKey = () => {
  const existing = normalizeCheckoutIdempotencyKey(getSessionStorageItem(CHECKOUT_IDEMPOTENCY_KEY));
  if (existing) return existing;
  const next = normalizeCheckoutIdempotencyKey(createCheckoutIdempotencyKey());
  setSessionStorageItem(CHECKOUT_IDEMPOTENCY_KEY, next);
  return next;
};

const clearCheckoutIdempotencyKey = () => {
  removeSessionStorageItem(CHECKOUT_IDEMPOTENCY_KEY);
};

const parseCheckoutPendingOrderSnapshot = (raw: string | null): CheckoutPendingOrderSnapshot | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown> | null;
    const order = parsed?.order && typeof parsed.order === 'object' ? parsed.order as OrderCustomer : null;
    const orderId = Number(order?.id);
    const paymentMethod = normalizeCheckoutText(parsed?.paymentMethod, 40);
    const guestPaymentEmail = normalizeCheckoutEmail(parsed?.guestPaymentEmail);
    const cartItems = parsed && Array.isArray(parsed.cartItems)
      ? (parsed.cartItems as CartItem[]).filter((item) => Number(item?.productId) > 0 && Number(item?.quantity) > 0)
      : [];
    const savedAt = Number(parsed?.savedAt);
    if (!order || !Number.isSafeInteger(orderId) || orderId <= 0 || !paymentMethod || !Number.isFinite(savedAt)) {
      return null;
    }
    if (Date.now() - savedAt > CHECKOUT_PAYMENT_POLL_MAX_MS) {
      return null;
    }
    return {
      order,
      paymentMethod,
      guestPaymentEmail: guestPaymentEmail || undefined,
      cartItems,
      savedAt,
    };
  } catch (error) {
    reportNonBlockingError('Checkout.parsePendingOrder', error);
    return null;
  }
};

const readCheckoutPendingOrder = () => {
  const snapshot = parseCheckoutPendingOrderSnapshot(getSessionStorageItem(CHECKOUT_PENDING_ORDER_KEY));
  if (!snapshot) {
    removeSessionStorageItem(CHECKOUT_PENDING_ORDER_KEY);
  }
  return snapshot;
};

const persistCheckoutPendingOrder = (order: OrderCustomer, paymentMethod: string, guestPaymentEmail: string | undefined, cartItems: CartItem[]) => {
  setSessionStorageItem(CHECKOUT_PENDING_ORDER_KEY, JSON.stringify({
    order,
    paymentMethod,
    guestPaymentEmail,
    cartItems,
    savedAt: Date.now(),
  }));
};

const clearCheckoutPendingOrder = () => {
  removeSessionStorageItem(CHECKOUT_PENDING_ORDER_KEY);
};

const checkoutPaymentPollResultKey = (orderId: number) => `checkoutPaymentPollResult:${orderId}`;

const parseCheckoutPaymentPollResult = (raw: string | null): CheckoutPaymentPollResult | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CheckoutPaymentPollResult> | null;
    const ownerId = normalizeCheckoutText(parsed?.ownerId, 120);
    const orderId = Number(parsed?.orderId);
    const updatedAt = Number(parsed?.updatedAt);
    const payment = parsed?.payment && typeof parsed.payment === 'object'
      ? parsed.payment as PaymentCustomer
      : null;
    if (!ownerId || !Number.isSafeInteger(orderId) || orderId <= 0 || !Number.isFinite(updatedAt) || !payment) {
      return null;
    }
    return {
      ownerId,
      orderId,
      orderNo: normalizeCheckoutText(parsed?.orderNo, 80) || undefined,
      payment,
      order: parsed?.order && typeof parsed.order === 'object' ? parsed.order as OrderCustomer : null,
      updatedAt,
    };
  } catch (error) {
    reportNonBlockingError('Checkout.parsePaymentPollResult', error);
    return null;
  }
};

const readCheckoutPaymentPollResult = (orderId: number) => {
  const result = parseCheckoutPaymentPollResult(getLocalStorageItem(checkoutPaymentPollResultKey(orderId)));
  if (!result || result.orderId !== orderId || Date.now() - result.updatedAt > CHECKOUT_PAYMENT_POLL_RESULT_MAX_MS) {
    return null;
  }
  return result;
};

const writeCheckoutPaymentPollResult = (
  orderId: number,
  ownerId: string,
  payment: PaymentCustomer,
  order?: OrderCustomer | null,
) => {
  const result: CheckoutPaymentPollResult = {
    ownerId,
    orderId,
    orderNo: order?.orderNo || payment.orderNo,
    payment,
    order: order || null,
    updatedAt: Date.now(),
  };
  setLocalStorageItem(checkoutPaymentPollResultKey(orderId), JSON.stringify(result));
};

const isCheckoutPaymentPollTerminal = (payment?: PaymentCustomer | null) => {
  const status = normalizeStatusCode(payment?.status);
  return Boolean(status && status !== 'PENDING');
};

const CHECKOUT_GUEST_DRAFT_KEY = 'checkoutGuestDraft';

const normalizeCheckoutGuestDraftFields = (draft: unknown) => {
  if (!draft || typeof draft !== 'object') return null;
  const draftRecord = draft as Record<string, unknown>;
  return {
    guestEmail: normalizeCheckoutText(draftRecord.guestEmail, 120),
    recipientName: normalizeCheckoutText(draftRecord.recipientName, 80),
    phone: normalizeLikelyCheckoutPhone(draftRecord.phone),
    region: Array.isArray(draftRecord.region) ? draftRecord.region : undefined,
    shippingAddress: normalizeCheckoutText(draftRecord.shippingAddress, 260),
    postalCode: normalizeCheckoutPostalCode(draftRecord.postalCode),
  };
};

type CheckoutFormValues = {
  guestEmail?: unknown;
  recipientName?: unknown;
  phone?: unknown;
  region?: unknown;
  shippingAddress?: unknown;
  postalCode?: unknown;
  paymentMethod?: unknown;
};

type CheckoutFormSnapshot = Partial<CheckoutFormValues>;

type CheckoutFormFieldName = keyof CheckoutFormValues;
type CheckoutMessageType = 'error' | 'warning' | 'success' | 'info';

const readCheckoutGuestDraftFields = () => {
  const rawDraft = getSessionStorageItem(CHECKOUT_GUEST_DRAFT_KEY);
  if (!rawDraft) return null;
  try {
    return normalizeCheckoutGuestDraftFields(JSON.parse(rawDraft));
  } catch (error) {
    reportNonBlockingError('Checkout.readGuestDraft', error);
    removeSessionStorageItem(CHECKOUT_GUEST_DRAFT_KEY);
    return null;
  }
};

const checkoutGuestDraftFieldNames: CheckoutFormFieldName[] = [
  'guestEmail',
  'recipientName',
  'phone',
  'region',
  'shippingAddress',
  'postalCode',
];

const hasHydratableCheckoutValue = (value: unknown) => (
  Array.isArray(value) ? value.length > 0 : Boolean(normalizeCheckoutText(value, 500))
);

const getSavedAddressRegionPath = (address?: UserAddress | null) => {
  const region = address?.region;
  return (Array.isArray(region) ? region : [])
    .map((item) => normalizeCheckoutText(item, 120))
    .filter(Boolean);
};

const getSavedAddressPostalCode = (address?: UserAddress | null) =>
  normalizeCheckoutPostalCode(address?.postalCode);

const getSavedAddressDetail = (address?: UserAddress | null) =>
  normalizeCheckoutText(address?.detailAddress, 260);

const isCompleteSavedAddress = (address?: UserAddress | null) => {
  const regionPath = getSavedAddressRegionPath(address);
  const postalCode = getSavedAddressPostalCode(address);
  return Boolean(
    address
      && hasCompleteCheckoutRecipientName(address.recipientName)
      && isLikelyPhone(address.phone)
      && regionPath.length > 0
      && isValidCheckoutPostalCode(postalCode, regionPath)
      && hasCompleteCheckoutDetailAddress(getSavedAddressDetail(address)),
  );
};

const mergeDefinedCheckoutFields = (current: CheckoutFormSnapshot, updates: CheckoutFormSnapshot) => {
  const next = { ...current };
  Object.entries(updates || {}).forEach(([key, value]) => {
    if (value !== undefined) {
      next[key as CheckoutFormFieldName] = value;
    }
  });
  return next;
};

const mergeHydratableCheckoutFields = (current: CheckoutFormSnapshot, updates: CheckoutFormSnapshot) => {
  const next = { ...current };
  Object.entries(updates || {}).forEach(([key, value]) => {
    if (hasHydratableCheckoutValue(value)) {
      next[key as CheckoutFormFieldName] = value;
    }
  });
  return next;
};

const firstFilledCheckoutText = (...values: unknown[]) =>
  values.find((value) => normalizeCheckoutText(value, 500)) ?? '';

const firstCheckoutRegionPath = (...values: unknown[]) =>
  values.find((value) => Array.isArray(value) && value.length > 0);

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
  const paymentPollStartedAtRef = React.useRef<number | null>(null);
  const paymentPollOwnerIdRef = React.useRef<string | null>(null);
  if (!paymentPollOwnerIdRef.current) {
    paymentPollOwnerIdRef.current = createCheckoutPaymentPollOwnerId();
  }
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
    runWithoutAccessibleMessageAnnouncement(() => message[type](messageText));
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
  const formatPaymentStatusLabel = useCallback((status?: string) => {
    const rawStatus = String(status || '').trim();
    const normalizedStatus = normalizeStatusCode(rawStatus);
    if (!normalizedStatus) return t('common.unknown');
    if (PAYMENT_STATUS_LABEL_KEYS.has(normalizedStatus)) return t(`status.${normalizedStatus}`);
    return rawStatus;
  }, [t]);
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
  const getPaymentStatusColor = useCallback((status?: string) => {
    const normalizedStatus = normalizeStatusCode(status);
    if (!PAYMENT_STATUS_LABEL_KEYS.has(normalizedStatus)) return 'default';
    return paymentStatusColors[normalizedStatus] || 'default';
  }, []);
  const watchedPaymentMethod = Form.useWatch('paymentMethod', form);
  const watchedGuestEmail = Form.useWatch('guestEmail', form);
  const watchedRecipientName = Form.useWatch('recipientName', form);
  const watchedPhone = Form.useWatch('phone', form);
  const watchedRegion = Form.useWatch('region', form);
  const watchedShippingAddress = Form.useWatch('shippingAddress', form);
  const watchedPostalCode = Form.useWatch('postalCode', form);
  const paymentMethodDetails = useMemo(() => createPaymentMethodDetails(paymentChannels), [paymentChannels]);
  const paymentMethodsAvailable = paymentMethodDetails.length > 0;
  const { currency, market, formatMoney } = useMarket();
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
        setPaymentChannelsAvailable(createPaymentMethodDetails(channels).length > 0);
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
  const nextCouponUnlock = useMemo(() => {
    if (!availableCoupons.length) return null;
    return availableCoupons
      .map((coupon) => {
        const threshold = Number(coupon.thresholdAmount || 0);
        const gap = Math.max(0, threshold - cartTotal);
        const estimatedValue = coupon.couponType === 'FULL_REDUCTION'
          ? Number(coupon.reductionAmount || 0)
          : Math.min(
            Number(coupon.maxDiscountAmount || 0) || threshold,
            threshold * (100 - getCouponPayablePercent(coupon)) / 100,
          );
        return { coupon, gap, estimatedValue };
      })
      .filter((item) => item.gap > 0 && item.estimatedValue > 0)
      .sort((left, right) => left.gap - right.gap || right.estimatedValue - left.estimatedValue)[0] || null;
  }, [availableCoupons, cartTotal]);
  const couponOpportunity = useMemo(() => {
    if (isGuestCheckout || !availableCoupons.length) return null;
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
        action: t('pages.checkout.couponOpportunityReview'),
      };
    }
    return null;
  }, [availableCoupons.length, discountAmount, formatMoney, isGuestCheckout, nextCouponUnlock, selectedCoupon, selectedIsBestCoupon, t]);
  const savingsCoachItems = [
    {
      key: 'shipping',
      icon: <TruckOutlined />,
      ready: freeShippingUnlocked,
      title: t('pages.checkout.savingsFreeShippingTitle'),
      text: freeShippingUnlocked
        ? t('pages.checkout.savingsFreeShippingUnlocked')
        : t('pages.checkout.savingsFreeShippingText', { amount: formatMoney(freeShippingRemaining) }),
    },
    giftEligible ? {
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
  const checkoutReadinessScore = Math.round((checkoutReadinessItems.filter((item) => item.ready).length / checkoutReadinessItems.length) * 100);
  const checkoutNextAction = checkoutReadinessItems.find((item) => !item.ready) || null;
  // Savings coaching must never block place-order. Only items/address/payment gate submit CTAs.
  const checkoutBlockingAction = checkoutReadinessItems.find((item) => !item.ready && item.key !== 'savings') || null;
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
  const checkoutCoachActionLabel = !checkoutNextAction
    ? t('pages.checkout.nextActionSupport')
    : checkoutNextAction.key === 'items'
      ? t('pages.checkout.nextActionReviewCart')
      : checkoutNextAction.key === 'address'
        ? t('pages.checkout.nextActionAddress')
        : checkoutNextAction.key === 'payment'
          ? t('pages.checkout.nextActionPayment')
          : t('pages.checkout.nextActionSavings');
  const checkoutNextActionLabel = !checkoutBlockingAction
    ? t('pages.checkout.nextActionSupport')
    : checkoutBlockingAction.key === 'items'
      ? t('pages.checkout.nextActionReviewCart')
      : checkoutBlockingAction.key === 'address'
        ? t('pages.checkout.nextActionAddress')
        : checkoutBlockingAction.key === 'payment'
          ? t('pages.checkout.nextActionPayment')
          : t('pages.checkout.nextActionSavings');
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

  const calculateCouponDiscount = (coupon: UserCoupon) => {
    return estimateCouponDiscount(coupon, cartTotal);
  };

  const describeCoupon = (coupon: UserCoupon) => {
    const payablePercent = getCouponPayablePercent(coupon);
    const discountPercent = Math.max(0, 100 - payablePercent);
    const rule = coupon.couponType === 'FULL_REDUCTION'
      ? `${formatMoney(coupon.thresholdAmount)} - ${formatMoney(coupon.reductionAmount)}`
      : t('pages.checkout.discountPayable', { percent: discountPercent }) + (coupon.maxDiscountAmount ? `, ${t('pages.checkout.maxDiscount', { amount: formatMoney(coupon.maxDiscountAmount) })}` : '');
    const threshold = Number(coupon.thresholdAmount || 0);
    if (cartTotal < threshold) {
      return `${coupon.couponName}: ${rule} (${t('pages.checkout.needMore', { amount: formatMoney(threshold - cartTotal) })})`;
    }
    return `${coupon.couponName}: ${rule}`;
  };

  const buildAddress = (values: CheckoutFormValues) => {
    if (selectedAddressId !== 'new') {
      const address = addresses.find((item) => String(item.id) === String(selectedAddressId));
      if (!address) throw new Error(t('pages.checkout.addressRequired'));
      const region = selectedSavedAddressRegion.join(' ');
      const addressParts = [region, selectedSavedAddressPostalCode, selectedSavedAddressDetail].filter(Boolean).join(' ');
      if (!isCompleteSavedAddress(address) || !addressParts) {
        throw new Error(t('pages.checkout.addressRequired'));
      }
      return normalizeCheckoutText(`${address.recipientName} / ${normalizeCheckoutPhone(address.phone)} / ${addressParts}`, 500);
    }
    const recipientName = normalizeCheckoutText(getCheckoutTextValue('recipientName', values), 80);
    const phone = normalizeCheckoutPhone(getCheckoutTextValue('phone', values));
    const regionPath = getCheckoutRegionValue(values);
    const region = Array.isArray(regionPath) ? regionPath.join(' ') : '';
    const postalCode = normalizeCheckoutPostalCode(getCheckoutTextValue('postalCode', values));
    const detail = normalizeCheckoutText(getCheckoutTextValue('shippingAddress', values), 260);
    const addressParts = [region, postalCode, detail].filter(Boolean).join(' ');
    return normalizeCheckoutText(`${recipientName} / ${phone} / ${addressParts}`, 500);
  };

  const buildRecipientPayload = (values: CheckoutFormValues) => {
    if (selectedAddressId !== 'new' && selectedSavedAddress) {
      return {
        recipientName: normalizeCheckoutText(selectedSavedAddress.recipientName, 80),
        recipientPhone: normalizeCheckoutPhone(selectedSavedAddress.phone),
      };
    }
    return {
      recipientName: normalizeCheckoutText(getCheckoutTextValue('recipientName', values), 80),
      recipientPhone: normalizeCheckoutPhone(getCheckoutTextValue('phone', values)),
    };
  };

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
      if (cartItems.length === 0) {
        showCheckoutMessage('error', t('pages.checkout.emptyCart'));
        return;
      }
      if (cartItems.some((item) => !isPurchasable(item))) {
        showCheckoutMessage('error', t('pages.checkout.unavailableSelected'));
        return;
      }
      if (!paymentMethodsAvailable) {
        showCheckoutMessage('error', t('pages.checkout.paymentUnavailable'));
        return;
      }
      const normalizedPaymentMethod = normalizeCheckoutText(values.paymentMethod, 40);
      const normalizedGuestEmail = hasToken ? undefined : normalizeCheckoutEmail(values.guestEmail);
      if (!normalizedPaymentMethod) {
        showCheckoutMessage('error', t('pages.checkout.paymentRequired'));
        return;
      }
      if (!hasToken && !isLikelyCheckoutEmail(normalizedGuestEmail)) {
        showCheckoutMessage('error', t('pages.checkout.emailInvalid'));
        return;
      }
      if (requiresBackendShippingQuote && !shippingQuoteReady) {
        showCheckoutMessage('error', shippingQuoteUnavailable ? t('pages.checkout.shippingFeeUnavailable') : t('pages.checkout.shippingFeeCalculating'));
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
              items: cartItems.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                selectedSpecs: item.selectedSpecs,
              })),
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
          if (!navigateToSafeUrl(paymentRes.data.paymentUrl)) {
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
      if (paymentRes.data.paymentUrl && !navigateToSafeUrl(paymentRes.data.paymentUrl)) {
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
    if (payment?.paymentUrl && !navigateToSafeUrl(payment.paymentUrl)) {
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
      const restorePrice = resolveGuestRestorePrice(item, latestProduct);
      addGuestCartItem({
        id: item.productId,
        name: latestProduct?.name || checkoutCartItemName(item),
        imageUrl: latestProduct?.imageUrl || item.imageUrl,
        price: restorePrice,
        effectivePrice: restorePrice,
        stock: latestProduct?.stock ?? item.stock,
        status: latestProduct?.status || item.productStatus || 'ACTIVE',
        freeShipping: latestProduct?.freeShipping ?? item.freeShipping,
        freeShippingThreshold: latestProduct?.freeShippingThreshold ?? item.freeShippingThreshold,
      }, item.quantity, item.selectedSpecs, restorePrice);
    });
  };

  const rollbackPendingPayment = () => {
    if (!createdOrder || createdOrder.status !== 'PENDING_PAYMENT') return;
    const orderDisplayNo = createdOrder.orderNo || String(createdOrder.id);
    const rollbackActionLabel = `${t('pages.checkout.rollbackPaymentAction')}: ${t('pages.paymentInstructions.orderNo')} ${orderDisplayNo}, ${formatMoney(createdOrder.totalAmount)}`;
    Modal.confirm({
      title: t('pages.checkout.rollbackPaymentTitle'),
      content: t('pages.checkout.rollbackPaymentContent'),
      okText: t('pages.checkout.rollbackPaymentAction'),
      cancelText: t('common.cancel'),
      okButtonProps: { danger: true, 'aria-label': rollbackActionLabel, title: rollbackActionLabel },
      cancelButtonProps: { 'aria-label': `${t('common.cancel')}: ${rollbackActionLabel}`, title: `${t('common.cancel')}: ${rollbackActionLabel}` },
      className: 'profile-mobile-safe-modal checkout-page__rollbackConfirmModal',
      async onOk() {
        setCancelingPayment(true);
        try {
          await orderApi.cancel(createdOrder.id, guestPaymentEmail, guestPaymentEmail ? createdOrder.orderNo : undefined);
          await restoreSubmittedCartItems();
          clearCheckoutIdempotencyKey();
          clearCheckoutPendingOrder();
          setPayment(null);
          setCreatedOrder(null);
          setPaymentCreateError(null);
          showCheckoutMessage('success', t('pages.checkout.rollbackPaymentSuccess'));
          navigate('/cart');
        } catch (error: unknown) {
          showCheckoutMessage('error', getApiErrorMessage(error, t('pages.checkout.rollbackPaymentFailed'), language));
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
    if (!payment?.id) return;
    clearCheckoutIdempotencyKey();
    clearCheckoutPendingOrder();
  }, [payment?.id]);

  useEffect(() => {
    if (guestPaymentEmail && normalizeStatusCode(paymentStatus) === 'PAID') {
      removeSessionStorageItem(CHECKOUT_GUEST_DRAFT_KEY);
    }
  }, [guestPaymentEmail, paymentStatus]);

  useEffect(() => {
    if (!createdOrderId || paymentStatus !== 'PENDING') {
      paymentPollStartedAtRef.current = null;
    }
  }, [createdOrderId, paymentStatus]);

  useEffect(() => {
    if (!createdOrderId || payment || !pendingPaymentMethod) return;
    let disposed = false;
    const abortController = createApiAbortController();
    const timer = window.setTimeout(async () => {
      if (disposed || abortController.signal.aborted) return;
      try {
        const hasToken = hasAuthenticatedCartSession();
        const guestOrderNo = !hasToken && guestPaymentEmail ? createdOrderNo : undefined;
        const paymentRes = await paymentApi.getLatestByOrder(
          createdOrderId,
          hasToken ? undefined : guestPaymentEmail,
          guestOrderNo,
          { signal: abortController.signal },
        );
        if (!disposed && !abortController.signal.aborted) {
          setPayment(paymentRes.data);
          setPaymentCreateError(null);
        }
      } catch (error) {
        if (disposed || abortController.signal.aborted) return;
        reportNonBlockingError('Checkout.refreshSubmittedPayment', error);
      }
    }, 1500);
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      abortController.abort();
    };
  }, [createdOrderId, createdOrderNo, guestPaymentEmail, payment, pendingPaymentMethod]);

  useEffect(() => {
    if (!createdOrderId || paymentStatus !== 'PENDING') return;
    if (process.env.NODE_ENV === 'test') return;
    const ownerId = paymentPollOwnerIdRef.current || createCheckoutPaymentPollOwnerId();
    paymentPollOwnerIdRef.current = ownerId;
    const shouldRefreshOrder = hasAuthenticatedCartSession();
    const guestOrderNo = !shouldRefreshOrder && guestPaymentEmail ? createdOrderNo : undefined;
    const pollStartedAt = paymentPollStartedAtRef.current || Date.now();
    paymentPollStartedAtRef.current = pollStartedAt;
    let disposed = false;
    let polling = false;
    let pollAbortController: AbortController | null = null;
    let ownsLock = false;
    let webLockUnavailable = false;
    let webLockSession: CheckoutPaymentPollWebLockSession | null = null;
    let webLockAttempt: Promise<CheckoutPaymentPollWebLockSession | null> | null = null;
    const releaseWebLockSession = () => {
      webLockSession?.release();
      webLockSession = null;
    };
    const abortActivePollRequest = () => {
      pollAbortController?.abort();
      pollAbortController = null;
    };
    const getWebLockSession = async () => {
      if (webLockUnavailable) return null;
      if (webLockSession?.acquired) return webLockSession;
      if (!webLockAttempt) {
        webLockAttempt = startCheckoutPaymentPollWebLockSession(createdOrderId)
          .then((session) => {
            if (session?.acquired) {
              webLockSession = session;
              session.done.catch((error) => {
                reportNonBlockingError('Checkout.pollPendingPaymentWebLock', error);
              });
            }
            return session;
          })
          .catch((error) => {
            webLockUnavailable = true;
            reportNonBlockingError('Checkout.pollPendingPaymentWebLock', error);
            return null;
          })
          .finally(() => {
            webLockAttempt = null;
          });
      }
      return webLockAttempt;
    };
    const applySharedPollResult = (result: CheckoutPaymentPollResult | null) => {
      if (disposed || !result || result.ownerId === ownerId || result.orderId !== createdOrderId) return false;
      setPayment(result.payment);
      if (result.order) {
        setCreatedOrder(result.order);
      }
      return true;
    };
    applySharedPollResult(readCheckoutPaymentPollResult(createdOrderId));
    const handlePaymentPollStorage = (event: StorageEvent) => {
      if (event.key !== checkoutPaymentPollResultKey(createdOrderId) || !event.newValue || disposed) return;
      applySharedPollResult(parseCheckoutPaymentPollResult(event.newValue));
    };
    window.addEventListener('storage', handlePaymentPollStorage);
    const timer = window.setInterval(async () => {
      if (disposed) return;
      if (Date.now() - pollStartedAt >= CHECKOUT_PAYMENT_POLL_MAX_MS) {
        disposed = true;
        polling = false;
        window.clearInterval(timer);
        if (ownsLock) {
          releaseCheckoutPaymentPollLock(createdOrderId, ownerId);
          ownsLock = false;
        }
        releaseWebLockSession();
        showCheckoutMessage('warning', t('pages.checkout.paymentPollingTimeout'));
        return;
      }
      if (disposed || polling) return;
      const sharedResult = readCheckoutPaymentPollResult(createdOrderId);
      if (applySharedPollResult(sharedResult) && isCheckoutPaymentPollTerminal(sharedResult?.payment)) {
        return;
      }
      polling = true;
      let ownsThisPoll = false;
      let ownsStorageLockForPoll = false;
      try {
        const activeWebLockSession = await getWebLockSession();
        if (disposed) {
          activeWebLockSession?.release();
          return;
        }
        if (activeWebLockSession) {
          if (!activeWebLockSession.acquired) return;
          ownsThisPoll = true;
        } else {
          ownsStorageLockForPoll = true;
          ownsThisPoll = await claimCheckoutPaymentPollLock(createdOrderId, createdOrderNo, ownerId);
          ownsLock = ownsLock || ownsThisPoll;
        }
        if (disposed || !ownsThisPoll) return;
        const abortController = createApiAbortController();
        pollAbortController = abortController;
        const paymentRes = await paymentApi.getLatestByOrder(
          createdOrderId,
          shouldRefreshOrder ? undefined : guestPaymentEmail,
          guestOrderNo,
          { signal: abortController.signal },
        );
        if (pollAbortController === abortController) {
          pollAbortController = null;
        }
        if (disposed || abortController.signal.aborted) return;
        const latestPayment = paymentRes.data;
        setPayment(latestPayment);
        writeCheckoutPaymentPollResult(createdOrderId, ownerId, latestPayment);
        if (shouldRefreshOrder) {
          const orderRes = await orderApi.getById(createdOrderId);
          if (disposed) return;
          setCreatedOrder(orderRes.data);
          writeCheckoutPaymentPollResult(createdOrderId, ownerId, latestPayment, orderRes.data);
        } else if (guestPaymentEmail && guestOrderNo) {
          const orderRes = await orderApi.getById(createdOrderId, guestPaymentEmail, guestOrderNo);
          if (disposed) return;
          setCreatedOrder(orderRes.data);
          writeCheckoutPaymentPollResult(createdOrderId, ownerId, latestPayment, orderRes.data);
        }
      } catch (error) {
        if (disposed || pollAbortController?.signal.aborted) return;
        reportNonBlockingError('Checkout.pollPendingPayment', error);
      } finally {
        pollAbortController = null;
        polling = false;
        if (disposed && ownsStorageLockForPoll && ownsThisPoll) {
          releaseCheckoutPaymentPollLock(createdOrderId, ownerId);
          ownsLock = false;
        }
        if (disposed) {
          releaseWebLockSession();
        }
      }
    }, 5000);
    return () => {
      const shouldReleaseLock = ownsLock && !polling;
      const shouldReleaseWebLock = !polling;
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener('storage', handlePaymentPollStorage);
      abortActivePollRequest();
      if (shouldReleaseLock) {
        releaseCheckoutPaymentPollLock(createdOrderId, ownerId);
      }
      if (shouldReleaseWebLock) {
        releaseWebLockSession();
      }
      webLockAttempt?.then((session) => {
        if (!polling) {
          session?.release();
        }
      }).catch(() => undefined);
    };
  }, [createdOrderId, createdOrderNo, guestPaymentEmail, paymentStatus, showCheckoutMessage, t]);

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
          <div className="checkout-page__loadingShell" aria-hidden="true">
            <div className="checkout-page__loadingHero shimmer" />
            <div className="checkout-page__loadingGrid">
              <div className="checkout-page__loadingCard shimmer" />
              <div className="checkout-page__loadingCard shimmer" />
            </div>
            <div className="checkout-page__loadingSummary shimmer" />
          </div>
          <div className="checkout-page__loadingSpinner">
            <Spin size="large" />
          </div>
        </div>
      </Form>
    );
  }

  if (createdOrder && !payment) {
    const orderDisplayNo = createdOrder.orderNo || String(createdOrder.id);
    const orderPaymentContext = `${t('pages.paymentInstructions.orderNo')}: ${orderDisplayNo} · ${formatMoney(createdOrder.totalAmount)}`;
    const retryPaymentActionLabel = `${t('pages.checkout.retryPayment')}: ${orderPaymentContext}`;
    const rollbackPaymentActionLabel = `${t('pages.checkout.rollbackPaymentAction')}: ${orderPaymentContext}`;
    const viewOrderActionLabel = `${t('pages.checkout.viewOrder')}: ${orderPaymentContext}`;
    const trackOrderActionLabel = `${t('pages.orderTracking.title')}: ${orderPaymentContext}`;
    const backHomeActionLabel = `${t('pages.checkout.backHome')}: ${orderPaymentContext}`;
    return (
      <div className={`checkout-page checkout-page--result checkout-page--${language}`}>
        {renderCheckoutStatusLiveRegion()}
        <Result
          status="warning"
          title={t('pages.checkout.orderCreatedPaymentPending')}
          subTitle={t('pages.checkout.paymentPendingSubtitle', { orderNo: createdOrder.orderNo || createdOrder.id, amount: formatMoney(createdOrder.totalAmount) })}
          extra={[
            <Button type="primary" key="retry" loading={paying} aria-label={retryPaymentActionLabel} title={retryPaymentActionLabel} onClick={retryCreatePayment}>{t('pages.checkout.retryPayment')}</Button>,
            <Button danger key="rollback" icon={<RollbackOutlined />} loading={cancelingPayment} aria-label={rollbackPaymentActionLabel} title={rollbackPaymentActionLabel} onClick={rollbackPendingPayment}>{t('pages.checkout.rollbackPaymentAction')}</Button>,
            <Button key="profile" aria-label={viewOrderActionLabel} title={viewOrderActionLabel} onClick={guestPaymentEmail ? openTrackedOrder : () => navigate('/profile?tab=orders')}>{t('pages.checkout.viewOrder')}</Button>,
            <Button key="track" aria-label={trackOrderActionLabel} title={trackOrderActionLabel} onClick={openTrackedOrder}>{t('pages.orderTracking.title')}</Button>,
            <Button key="home" aria-label={backHomeActionLabel} title={backHomeActionLabel} onClick={() => navigate('/')}>{t('pages.checkout.backHome')}</Button>,
          ]}
        />
        {paymentCreateError ? (
          <Alert
            className="checkout-page__paymentCreateError"
            type="error"
            showIcon
            message={t('pages.checkout.paymentCreateWarning')}
            description={paymentCreateError}
            action={(
              <Button size="small" type="primary" loading={paying} aria-label={retryPaymentActionLabel} title={retryPaymentActionLabel} onClick={retryCreatePayment}>
                {t('pages.checkout.retryPayment')}
              </Button>
            )}
          />
        ) : null}
      </div>
    );
  }

  if (createdOrder && payment) {
    const paid = payment.status === 'PAID';
    const orderDisplayNo = createdOrder.orderNo || String(createdOrder.id);
    const orderPaymentContext = `${t('pages.paymentInstructions.orderNo')}: ${orderDisplayNo} · ${formatMoney(createdOrder.totalAmount)}`;
    const openPaymentActionLabel = `${t('pages.checkout.openPayment')}: ${orderPaymentContext}`;
    const retryPaymentActionLabel = `${t('pages.checkout.retryPayment')}: ${orderPaymentContext}`;
    const rollbackPaymentActionLabel = `${t('pages.checkout.rollbackPaymentAction')}: ${orderPaymentContext}`;
    const viewOrderActionLabel = `${t('pages.checkout.viewOrder')}: ${orderPaymentContext}`;
    const trackOrderActionLabel = `${t('pages.orderTracking.title')}: ${orderPaymentContext}`;
    const backHomeActionLabel = `${t('pages.checkout.backHome')}: ${orderPaymentContext}`;
    const supportActionLabel = `${t('pages.checkout.nextActionSupport')}: ${orderPaymentContext}`;
    const simulatePaymentActionLabel = `${t('pages.checkout.simulatePay')}: ${orderPaymentContext}`;
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
        <Result
          status={paid ? 'success' : isReconcileRequired ? 'warning' : 'info'}
          title={paid
            ? t('pages.checkout.paidTitle')
            : isReconcileRequired
              ? t('pages.checkout.paymentRecoveryReconcileRequired')
              : t('pages.checkout.pendingTitle')}
          subTitle={isReconcileRequired
            ? t('pages.checkout.paymentRecoveryNextReconcileRequired')
            : t('pages.checkout.resultSubtitle', { orderNo: createdOrder.orderNo || createdOrder.id, amount: formatMoney(createdOrder.totalAmount) })}
          extra={[
            !paid && !isReconcileRequired && payment.paymentUrl && (
              <Button type="primary" key="pay" loading={paying} aria-label={openPaymentActionLabel} title={openPaymentActionLabel} onClick={openPaymentUrl}>
                {t('pages.checkout.openPayment')}
              </Button>
            ),
            <Button key="profile" aria-label={viewOrderActionLabel} title={viewOrderActionLabel} onClick={guestPaymentEmail ? openTrackedOrder : () => navigate('/profile?tab=orders')}>{t('pages.checkout.viewOrder')}</Button>,
            <Button key="track" aria-label={trackOrderActionLabel} title={trackOrderActionLabel} onClick={openTrackedOrder}>{t('pages.orderTracking.title')}</Button>,
            <Button key="home" aria-label={backHomeActionLabel} title={backHomeActionLabel} onClick={() => navigate('/')}>{t('pages.checkout.backHome')}</Button>,
          ].filter(Boolean)}
        />
        <Card className="checkout-page__paymentRecovery" title={t('pages.checkout.paymentRecoveryTitle')}>
          <div className="checkout-page__paymentRecoveryGrid" role="list" aria-label={`${t('pages.checkout.paymentRecoveryTitle')}: ${orderPaymentContext}`}>
            <div role="listitem" aria-label={`${t('pages.checkout.paymentRecoveryStatus')}: ${paymentRecoveryStatusText}`}>
              <Text strong>{t('pages.checkout.paymentRecoveryStatus')}</Text>
              <Tag color={paid ? 'green' : isReconcileRequired ? 'magenta' : paymentRecovery.isExpired ? 'red' : paymentRecovery.isExpiringSoon ? 'orange' : 'blue'}>
                {paymentRecoveryStatusText}
              </Tag>
            </div>
            <div role="listitem" aria-label={`${t('pages.checkout.paymentRecoveryWindow')}: ${paymentRecoveryWindowText}`}>
              <Text strong>{t('pages.checkout.paymentRecoveryWindow')}</Text>
              <Text type={paymentRecoveryTone === 'error' ? 'danger' : paymentRecoveryTone === 'warning' ? 'warning' : 'secondary'}>
                {paymentRecoveryWindowText}
              </Text>
            </div>
            <div role="listitem" aria-label={`${t('pages.checkout.paymentRecoveryNext')}: ${paymentRecoveryNextText}`}>
              <Text strong>{t('pages.checkout.paymentRecoveryNext')}</Text>
              <Text type="secondary">
                {paymentRecoveryNextText}
              </Text>
            </div>
          </div>
          {!paid ? (
            <Space wrap className="checkout-page__paymentRecoveryActions">
              {!isReconcileRequired && payment.paymentUrl ? <Button type="primary" aria-label={openPaymentActionLabel} title={openPaymentActionLabel} onClick={openPaymentUrl}>{t('pages.checkout.openPayment')}</Button> : null}
              <Button
                aria-label={`${t('pages.paymentInstructions.title')}: ${orderPaymentContext}`}
                title={t('pages.paymentInstructions.title')}
                onClick={() => navigate(`/payment/${encodeURIComponent(String(createdOrder.orderNo || createdOrder.id))}${guestPaymentEmail ? `?guestEmail=${encodeURIComponent(guestPaymentEmail)}` : ''}`)}
              >
                {t('pages.paymentInstructions.title')}
              </Button>
              {!isReconcileRequired && paymentSimulationEnabled ? (
                <Button loading={simulatingPayment} aria-label={simulatePaymentActionLabel} title={simulatePaymentActionLabel} onClick={simulatePayment}>
                  {t('pages.checkout.simulatePay')}
                </Button>
              ) : null}
              {!isReconcileRequired ? (
                <Button loading={paying} aria-label={retryPaymentActionLabel} title={retryPaymentActionLabel} onClick={retryCreatePayment}>{t('pages.checkout.retryPayment')}</Button>
              ) : null}
              {!isReconcileRequired && createdOrder.status === 'PENDING_PAYMENT' ? (
                <Button danger icon={<RollbackOutlined />} loading={cancelingPayment} aria-label={rollbackPaymentActionLabel} title={rollbackPaymentActionLabel} onClick={rollbackPendingPayment}>
                  {t('pages.checkout.rollbackPaymentAction')}
                </Button>
              ) : null}
              <Button aria-label={supportActionLabel} title={supportActionLabel} onClick={openSupport}>{t('pages.checkout.nextActionSupport')}</Button>
            </Space>
          ) : null}
        </Card>
        <Card title={t('pages.checkout.paymentCard')}>
          <Space direction="vertical">
            <Text>{t('pages.checkout.channel')}: {paymentMethodLabel(payment.channel, t)}</Text>
            {createdOrder.originalAmount ? <Text>{t('common.subtotal')}: <span className="commerce-money">{formatMoney(createdOrder.originalAmount)}</span></Text> : null}
            {createdOrder.discountAmount && createdOrder.discountAmount > 0 ? <Text>{t('pages.checkout.coupon')}: <span className="commerce-money">-{formatMoney(createdOrder.discountAmount)}</span> {createdOrder.couponName ? `(${createdOrder.couponName})` : ''}</Text> : null}
            <Text>{t('pages.checkout.shippingFee')}: <span className="commerce-money">{formatMoney(createdOrder.shippingFee)}</span></Text>
            <Text>{t('pages.checkout.paymentStatus')}: <Tag color={getPaymentStatusColor(payment.status)}>{formatPaymentStatusLabel(payment.status)}</Tag></Text>
            <Text className="checkout-page__paymentUrl">{t('pages.checkout.paymentLink')}: {formatPaymentUrlLabel(payment.paymentUrl)}</Text>
            {paymentExpiresAtText ? <Text>{t('pages.checkout.paymentExpiresAt')}: {paymentExpiresAtText}</Text> : null}
            {payment.transactionId && <Text>{t('pages.checkout.transactionId')}: {payment.transactionId}</Text>}
          </Space>
        </Card>
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
          <PageError
            className="checkout-page__loadError"
            title={t('pages.checkout.loadFailed')}
            description={cartLoadError}
            retryLabel={t('messages.retry')}
            onRetry={() => setCheckoutReloadKey((key) => key + 1)}
            homeLabel={t('pages.cart.title')}
            onHome={() => navigate('/cart')}
          />
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
            <ShoppingCartOutlined />
          </span>
          <div className="checkout-page__emptyCopy">
            <span className="checkout-page__emptyEyebrow">{t('pages.checkout.readinessEyebrow')}</span>
            <Title level={2}>{t('pages.checkout.emptySelected')}</Title>
            <Text>{t('pages.checkout.savingsCoachSubtitle')}</Text>
          </div>
          <div className="checkout-page__emptyActions">
            <Button
              type="primary"
              icon={<ShoppingCartOutlined />}
              onClick={() => navigate('/cart')}
              aria-label={t('pages.checkout.emptyBackCartAction')}
              title={t('pages.checkout.emptyBackCartAction')}
            >
              {t('pages.checkout.backCart')}
            </Button>
            <Button
              icon={<ShoppingOutlined />}
              onClick={() => navigate('/products')}
              aria-label={t('pages.checkout.emptyBrowseAction')}
              title={t('pages.checkout.emptyBrowseAction')}
            >
              {t('pages.cart.browse')}
            </Button>
            <Button
              icon={<GiftOutlined />}
              onClick={() => navigate('/coupons')}
              aria-label={t('pages.checkout.emptyCouponsAction')}
              title={t('pages.checkout.emptyCouponsAction')}
            >
              {t('nav.coupons')}
            </Button>
            <Button
              icon={<HistoryOutlined />}
              onClick={() => navigate('/history')}
              aria-label={t('pages.checkout.emptyHistoryAction')}
              title={t('pages.checkout.emptyHistoryAction')}
            >
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
            <Text strong className={shippingQuoteReady ? 'commerce-money' : undefined}>{payableAmountText}</Text>
          </span>
          <span>
            <Text type="secondary">{t('pages.checkout.paymentMethod')}</Text>
            <Text strong>{selectedPaymentDetail?.title || t('pages.checkout.paymentConfidenceDefault')}</Text>
          </span>
        </div>
        <Button
          type="primary"
          className="checkout-page__confirmationButton"
          onClick={checkoutBlockingAction ? handleCheckoutNextAction : () => form.submit()}
          loading={submitting}
          disabled={!checkoutBlockingAction && checkoutSubmitDisabled}
          aria-label={checkoutBlockingAction ? checkoutConfirmationActionLabel : checkoutSubmitActionLabel}
          title={checkoutBlockingAction ? checkoutConfirmationActionLabel : checkoutSubmitTooltip}
        >
          {checkoutBlockingAction ? checkoutNextActionLabel : shippingQuoteReady ? t('pages.checkout.submitWithAmount', { amount: payableAmountText }) : shippingFeeText}
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
        <div className="checkout-page__paymentGrid" role="radiogroup" aria-label={t('pages.payment.title')} aria-required="true">
          {!paymentMethodsAvailable ? (
            <Alert
              type="warning"
              showIcon
              role="alert"
              aria-live="polite"
              message={t('pages.checkout.paymentUnavailable')}
              description={paymentChannelsError || t('pages.checkout.paymentUnavailableDescription')}
              action={(
                <Button
                  size="small"
                  onClick={() => setPaymentChannelsReloadKey((key) => key + 1)}
                  loading={paymentChannelsLoading}
                >
                  {t('messages.retry')}
                </Button>
              )}
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
                    {recommendedPaymentMethod === method.value ? <Tag color="gold">{t('pages.checkout.recommendedPayment')}</Tag> : null}
                    <Tag color={method.market === 'CN' ? 'red' : method.value === 'OXXO' ? 'orange' : method.value === 'SPEI' ? 'blue' : 'green'}>{t(method.badgeKey)}</Tag>
                  </span>
                </span>
                <span className="checkout-page__paymentMethodDescription">{t(method.descriptionKey)}</span>
              </button>
            );
          })}
        </div>
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
        {giftEligible ? (
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
        footer={<Button type="primary" aria-label={giftConfirmActionLabel} title={giftConfirmActionLabel} onClick={() => setGiftCelebrationOpen(false)}>{t('common.confirm')}</Button>}
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
        onToggle={handleSupportPanelToggle}
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
              <Button
                size="small"
                icon={<SwapOutlined />}
                className="checkout-page__addOnButton"
                aria-label={checkoutSavingsAddOnsActionLabel}
                title={checkoutSavingsAddOnsActionLabel}
                onClick={scrollToAddOns}
              >
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
              className="checkout-page__addOnButton"
              aria-label={checkoutCouponOpportunityActionLabel}
              title={checkoutCouponOpportunityActionLabel}
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
            <Button size="small" type={checkoutNextAction ? 'primary' : 'default'} aria-label={checkoutReadinessActionLabel} title={checkoutReadinessActionLabel} onClick={handleCheckoutNextAction}>
              {checkoutCoachActionLabel}
            </Button>
          </div>
        </Card>
      </details>

      <Card title={t('pages.checkout.itemList')} className="checkout-page__itemsCard checkout-page__sectionCard">
        <List
          dataSource={cartItems}
          rowKey={(item) => item.id}
          renderItem={(item) => {
            const itemName = checkoutCartItemName(item);
            const itemActionLabel = `${t('pages.productList.viewDetails')}: ${itemName}`;
            return (
              <List.Item className="checkout-page__item">
                <List.Item.Meta
                  avatar={
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
                  }
                  title={
                    <button
                      type="button"
                      className="checkout-page__itemLink"
                      aria-label={itemActionLabel}
                      title={itemActionLabel}
                      onClick={() => navigate(`/products/${item.productId}`)}
                    >
                      {itemName}
                    </button>
                  }
                  description={
                    <div className="checkout-page__itemDescription">
                      {item.selectedSpecs ? <Text type="secondary">{formatSelectedSpecs(item.selectedSpecs, t, language)}</Text> : null}
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
                        <Text strong className="checkout-page__itemTotal commerce-money">{formatMoney(getCartLineAmount(item))}</Text>
                      </div>
                    </div>
                  }
                />
              </List.Item>
            );
          }}
        />
        <Divider />
        <div className="checkout-page__summaryLine">
          <Text>{t('pages.checkout.itemSummary', { count: checkoutItemCount })}</Text>
          <Text strong className="checkout-page__summaryTotal commerce-money"> {formatMoney(cartTotal)}</Text>
        </div>
      </Card>

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
          <Card id="checkout-contact-card" title={t('pages.checkout.contact')} className="checkout-page__sectionCard">
            <Form.Item
              name="guestEmail"
              label={t('pages.checkout.email')}
              rules={[{ required: true, message: t('pages.checkout.emailRequired') }, { type: 'email', message: t('pages.checkout.emailInvalid') }]}
              extra={renderCheckoutFieldErrorExtra('guestEmail')}
            >
              <Input placeholder={t('pages.checkout.guestEmailPlaceholder')} autoComplete="email" inputMode="email" maxLength={120} />
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
          {addressLoadFailed ? (
            <Alert
              type="warning"
              showIcon
              className="checkout-page__addressLoadAlert"
              message={t('pages.checkout.addressLoadFailed')}
              description={t('pages.checkout.addressLoadFailedDescription')}
              action={<Button size="small" onClick={() => setCheckoutReloadKey((key) => key + 1)}>{t('messages.retry')}</Button>}
            />
          ) : null}
          {addresses.length > 0 && (
            <div role="group" aria-label={checkoutAddressGroupLabel} title={checkoutAddressGroupLabel}>
              <Radio.Group value={selectedAddressId} onChange={(e) => setSelectedAddressId(e.target.value)} className="checkout-page__addressGroup" aria-label={checkoutAddressGroupLabel}>
                {addresses.map((address) => {
                  const addressChoiceLabel = [
                    normalizeCheckoutText(address.recipientName, 80),
                    normalizeLikelyCheckoutPhone(address.phone),
                    normalizeCheckoutText(address.address, 260),
                    address.isDefault ? t('pages.checkout.defaultAddress') : null,
                  ].filter(Boolean).join(', ');
                  return (
                    <Radio
                      key={address.id}
                      value={address.id}
                      className={String(selectedAddressId) === String(address.id) ? 'checkout-page__addressChoice checkout-page__addressChoice--selected' : 'checkout-page__addressChoice'}
                      aria-label={addressChoiceLabel}
                      title={addressChoiceLabel}
                    >
                      <Space className="checkout-page__addressHeader">
                        <Text strong>{address.recipientName}</Text>
                        <Text type="secondary">{address.phone}</Text>
                        {address.isDefault && <Tag color="orange">{t('pages.checkout.defaultAddress')}</Tag>}
                      </Space>
                      <div className="checkout-page__addressText">{address.address}</div>
                    </Radio>
                  );
                })}
                <Radio
                  value="new"
                  className={selectedAddressId === 'new' ? 'checkout-page__addressChoice checkout-page__addressChoice--selected' : 'checkout-page__addressChoice'}
                  aria-label={t('pages.checkout.useNewAddress')}
                  title={t('pages.checkout.useNewAddress')}
                >
                  <Text strong>{t('pages.checkout.useNewAddress')}</Text>
                </Radio>
              </Radio.Group>
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
                <Input placeholder={t('pages.checkout.recipientRequired')} maxLength={80} autoComplete="name" />
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
                <Input
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
                <Cascader
                  options={regionOptions}
                  placeholder={regionOptionsLoading ? t('common.loading') : t('pages.checkout.regionPlaceholder')}
                  showSearch
                  aria-label={checkoutRegionInputLabel}
                  title={checkoutRegionInputLabel}
                  open={checkoutRegionCascaderOpen}
                  onOpenChange={setCheckoutRegionCascaderVisibility}
                  onClick={() => {
                    void loadCheckoutRegionOptions();
                    setCheckoutRegionCascaderVisibility(true);
                  }}
                  onFocus={() => {
                    void loadCheckoutRegionOptions();
                    setCheckoutRegionCascaderVisibility(true);
                  }}
                  onBlur={closeCheckoutRegionCascader}
                  classNames={{ popup: { root: 'shop-mobile-popup-layer checkout-region-cascader-popup' } }}
                  getPopupContainer={() => document.body}
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
                <Input.TextArea rows={3} placeholder={t('pages.checkout.detailPlaceholder')} maxLength={260} showCount autoComplete="street-address" />
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
                <Input
                  placeholder={t('pages.checkout.postalCodePlaceholder')}
                  maxLength={20}
                  autoComplete="postal-code"
                  inputMode="text"
                  onBlur={(event) => form.setFieldValue('postalCode', normalizeCheckoutPostalCode(event.target.value))}
                />
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
            classNames={{ popup: { root: 'shop-mobile-popup-layer' } }}
            getPopupContainer={() => document.body}
            aria-label={checkoutCouponSelectLabel}
            title={checkoutCouponSelectLabel}
            onChange={(value) => {
              couponAutoSelectedQuoteRef.current = null;
              setCouponManuallyChanged(true);
              setCouponQuoteErrorMessage(null);
              setCouponSelectionErrorMessage(null);
              setSelectedUserCouponId(value ?? null);
            }}
            options={availableCoupons.map((coupon) => {
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
          {couponSelectionErrorMessage ? (
            <Alert
              type="warning"
              showIcon
              className="checkout-page__couponAlert"
              message={couponSelectionErrorMessage}
            />
          ) : null}
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
          {couponQuote && availableCoupons.length > 0 && !availableCoupons.some((coupon) => calculateCouponDiscount(coupon) > 0) ? (
            <div className="checkout-page__couponRules">
              <Text type="secondary">{t('pages.checkout.couponRulesNotMet')}</Text>
            </div>
          ) : null}
          <div className="checkout-page__couponSummary">
            <div><Text>{t('common.subtotal')}: <span className="commerce-money">{formatMoney(cartTotal)}</span></Text></div>
            {discountAmount > 0 ? <div><Text type="success">{t('pages.checkout.couponDiscount')}: <span className="commerce-money">-{formatMoney(discountAmount)}</span></Text></div> : null}
            <div><Text>{t('pages.checkout.shippingFee')}: <span className={shippingQuoteReady ? 'commerce-money' : 'checkout-page__pendingAmount'}>{shippingFeeText}</span></Text></div>
            <Text type="secondary" className="checkout-page__shippingPolicy">{shippingPolicyText}</Text>
            {shippingQuotePending || shippingQuoteUnavailable || shippingQuoteFallbackActive ? (
              <Alert
                type={shippingQuoteUnavailable ? 'error' : shippingQuoteFallbackActive ? 'warning' : 'info'}
                showIcon
                message={shippingPolicyText}
                description={shippingQuoteAlertDescription}
              />
            ) : null}
            <div><Text strong className="checkout-page__payableTotal">{t('pages.checkout.payable')}: <span className={shippingQuoteReady ? 'commerce-money' : 'checkout-page__pendingAmount'}>{payableAmountText}</span></Text></div>
          </div>
        </Card> : (
          <Card id="checkout-coupon-card" title={t('pages.checkout.orderSummary')} className="checkout-page__sectionCard">
            <div className="checkout-page__couponSummary">
              <div><Text>{t('common.subtotal')}: <span className="commerce-money">{formatMoney(cartTotal)}</span></Text></div>
              <div><Text>{t('pages.checkout.shippingFee')}: <span className={shippingQuoteReady ? 'commerce-money' : 'checkout-page__pendingAmount'}>{shippingFeeText}</span></Text></div>
              <Text type="secondary" className="checkout-page__shippingPolicy">{shippingPolicyText}</Text>
              {shippingQuotePending || shippingQuoteUnavailable || shippingQuoteFallbackActive ? (
                <Alert
                  type={shippingQuoteUnavailable ? 'error' : shippingQuoteFallbackActive ? 'warning' : 'info'}
                  showIcon
                  message={shippingPolicyText}
                  description={shippingQuoteAlertDescription}
                />
              ) : null}
              <div><Text strong className="checkout-page__payableTotal">{t('pages.checkout.payable')}: <span className={shippingQuoteReady ? 'commerce-money' : 'checkout-page__pendingAmount'}>{payableAmountText}</span></Text></div>
            </div>
          </Card>
        )}

        <Card id="checkout-payment-card" title={t('pages.payment.title')}>
          <div className="checkout-page__paymentConfidence">
            <SafetyCertificateOutlined />
            <span>
              <Text strong>{t('pages.checkout.paymentConfidenceTitle')}</Text>
              <Text type="secondary">
                {!paymentMethodsAvailable
                  ? t('pages.checkout.paymentUnavailable')
                  : selectedPaymentDetail
                  ? t('pages.checkout.paymentConfidenceSelected', { method: selectedPaymentDetail.title })
                  : t('pages.checkout.paymentConfidenceDefault')}
              </Text>
            </span>
          </div>
          {!paymentMethodsAvailable ? (
            <Alert
              type="warning"
              showIcon
              role="alert"
              aria-live="polite"
              message={t('pages.checkout.paymentUnavailable')}
              description={paymentChannelsError || t('pages.checkout.paymentUnavailableDescription')}
              action={(
                <Button
                  size="small"
                  onClick={() => setPaymentChannelsReloadKey((key) => key + 1)}
                  loading={paymentChannelsLoading}
                >
                  {t('messages.retry')}
                </Button>
              )}
            />
          ) : null}
          <Form.Item name="paymentMethod" rules={[{ required: true, message: t('pages.checkout.paymentRequired') }]} hidden>
            <Input />
          </Form.Item>
          <div className="checkout-page__submitReview">
            <div className="checkout-page__submitMetric">
              <Text type="secondary">{t('pages.checkout.itemSummary', { count: checkoutItemCount })}</Text>
              <Text strong className={shippingQuoteReady ? 'commerce-money' : undefined}>{payableAmountText}</Text>
            </div>
            <div className="checkout-page__submitMetric checkout-page__submitMetric--method">
              <Text type="secondary">{t('pages.checkout.paymentMethod')}</Text>
              <Text strong>{selectedPaymentDetail?.title || t('pages.checkout.paymentConfidenceDefault')}</Text>
            </div>
            <Form.Item className="checkout-page__submitAction">
              <Button className="checkout-page__submitButton" type="primary" htmlType="submit" loading={submitting} disabled={checkoutSubmitDisabled} block size="large" aria-label={checkoutSubmitActionLabel} title={checkoutSubmitTooltip}>
                    {renderSubmitWithAmount()}
                  </Button>
            </Form.Item>
          </div>
          <div
            className="checkout-page__mobilePayBar"
            role="region"
            aria-label={t('pages.checkout.paymentConfidenceTitle')}
          >
            <span className="checkout-page__mobilePayBarMeta">
              <Text type="secondary">{t('pages.checkout.payable')}</Text>
              <Text strong className={shippingQuoteReady ? 'commerce-money' : undefined}>{payableAmountText}</Text>
              <Text type="secondary" className="checkout-page__mobilePayBarTrust">
                {selectedPaymentDetail?.title
                  ? t('pages.checkout.mobilePayBarTrust', { method: selectedPaymentDetail.title })
                  : t('pages.checkout.mobilePayBarTrustDefault')}
              </Text>
            </span>
            <Button
                  type="primary"
                  htmlType={checkoutBlockingAction ? 'button' : 'submit'}
                  onClick={checkoutBlockingAction ? handleCheckoutNextAction : undefined}
                  loading={submitting}
                  disabled={!checkoutBlockingAction && checkoutSubmitDisabled}
                  aria-label={checkoutBlockingAction ? checkoutConfirmationActionLabel : checkoutSubmitActionLabel}
                  title={checkoutBlockingAction ? checkoutConfirmationActionLabel : checkoutSubmitTooltip}
                >
                  {checkoutBlockingAction ? checkoutNextActionLabel : renderSubmitWithAmount()}
                </Button>
          </div>
        </Card>
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
