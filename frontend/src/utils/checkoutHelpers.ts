import type { ReactNode } from 'react';
import type { Language } from '../i18n';
import type { CartItem, OrderCustomer, PaymentChannel, PaymentCustomer, ProductPublic as Product, UserAddress, UserCoupon, CouponQuote } from '../types';
import { getApiErrorMessage } from './apiError';
import { isValidRegionalPostalCode, normalizeRegionalPostalCode } from './postalCode';
import { getCouponPayablePercent } from './couponCenter';
import { conversionConfig } from './conversionConfig';
import { filterPaymentChannelsForMarket } from './paymentMethods';
import { isLikelyPhoneNumber, normalizeLikelyPhoneNumber, normalizePhoneNumber } from './phone';
import { getBundleInfo } from './bundle';
import { getLowStockCount } from './conversionConfig';
import { reportNonBlockingError } from './nonBlockingError';
import { getLocalStorageItem, getSessionStorageItem, removeSessionStorageItem, setLocalStorageItem, setSessionStorageItem } from './safeStorage';
import { CHECKOUT_PAYMENT_POLL_LOCK_TTL_MS } from './checkoutPaymentPollLock';

export type CheckoutTranslationFn = (key: string, params?: Record<string, string | number>) => string;

type CheckoutCouponErrorLike = {
  message?: unknown;
  code?: unknown;
  response?: {
    status?: unknown;
    data?: {
      code?: unknown;
      error?: unknown;
      message?: unknown;
    };
  };
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

/** Commercial checkout: normalize payment expiry / status timestamps for storefront copy. */
export const formatCheckoutDateTime = (value: unknown, dateLocale: string) => {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date || typeof value === 'number' || typeof value === 'string'
    ? new Date(value)
    : null;
  if (!date) return null;
  return Number.isFinite(date.getTime()) ? date.toLocaleString(dateLocale) : null;
};

/** Commercial checkout: map provider coupon failures to localized conversion copy. */
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

export const isValidCheckoutPostalCode = isValidRegionalPostalCode;

export const normalizeStatusCode = (status?: string) => String(status || '').trim().toUpperCase();

export const toSafeMoney = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
};

export const estimateCouponDiscount = (coupon: UserCoupon, cartTotal: number) => {
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

export const findBestCoupon = (coupons: UserCoupon[], cartTotal: number) =>
  coupons
    .map((coupon) => ({ coupon, discount: estimateCouponDiscount(coupon, cartTotal) }))
    .filter((item) => Number.isFinite(item.discount) && item.discount > 0)
    .sort((left, right) => right.discount - left.discount || toSafeMoney(left.coupon.thresholdAmount) - toSafeMoney(right.coupon.thresholdAmount))[0] || null;

export const normalizeCouponQuote = (quote?: CouponQuote | null): CouponQuote | null => (
  quote ? { ...quote, availableCoupons: Array.isArray(quote.availableCoupons) ? quote.availableCoupons : [] } : null
);

export const sanitizeCheckoutControlChars = (value: string) =>
  Array.from(value, (char) => {
    const code = char.charCodeAt(0);
    return code <= 31 || code === 127 ? ' ' : char;
  }).join('');

export const normalizeCheckoutText = (value: unknown, maxLength: number) =>
  sanitizeCheckoutControlChars(String(value || '')).trim().replace(/\s+/g, ' ').slice(0, maxLength);

export const CHECKOUT_RECIPIENT_MIN_LENGTH = 2;
export const CHECKOUT_DETAIL_ADDRESS_MIN_LENGTH = 5;

export const hasMinimumCheckoutTextLength = (value: unknown, maxLength: number, minLength: number) =>
  normalizeCheckoutText(value, maxLength).length >= minLength;

export const hasCompleteCheckoutRecipientName = (value: unknown) =>
  hasMinimumCheckoutTextLength(value, 80, CHECKOUT_RECIPIENT_MIN_LENGTH);

export const hasCompleteCheckoutDetailAddress = (value: unknown) =>
  hasMinimumCheckoutTextLength(value, 260, CHECKOUT_DETAIL_ADDRESS_MIN_LENGTH);

export const normalizeCheckoutEmail = (value: unknown) =>
  normalizeCheckoutText(value, 120).replace(/\s+/g, '').toLowerCase();

const checkoutEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isLikelyCheckoutEmail = (value: unknown) => checkoutEmailPattern.test(normalizeCheckoutEmail(value));

export const checkoutPhoneOptions = { minDigits: 6, maxDigits: 20, maxInputLength: 40, collapseWhitespace: true };
export const isLikelyPhone = (value: unknown) => isLikelyPhoneNumber(value, checkoutPhoneOptions);
export const normalizeCheckoutPhone = (value: unknown) => normalizePhoneNumber(value, checkoutPhoneOptions);
export const normalizeLikelyCheckoutPhone = (value: unknown) =>
  normalizeLikelyPhoneNumber(value, checkoutPhoneOptions);

export const getRecommendedPaymentMethod = (channels: PaymentChannel[], currency: string) => {
  // Always recommend within market-filtered rails so MXN never lands on CN methods.
  const marketChannels = filterPaymentChannelsForMarket(channels, { currency });
  const backendRecommended = marketChannels.find((channel) => channel.recommended)?.code;
  if (backendRecommended) {
    return backendRecommended;
  }
  if (!conversionConfig.paymentRecommendation.enabled) return null;
  const preferredCodes = conversionConfig.paymentRecommendation.byCurrency[
    currency as keyof typeof conversionConfig.paymentRecommendation.byCurrency
  ] || conversionConfig.paymentRecommendation.fallback;
  return preferredCodes.find((code) => marketChannels.some((channel) => channel.code === code))
    || marketChannels[0]?.code
    || null;
};

export const resolveCheckoutPaymentMethod = (
  candidate: string | null | undefined,
  channels: PaymentChannel[],
  currency: string,
) => {
  const marketChannels = filterPaymentChannelsForMarket(channels, { currency });
  if (candidate && marketChannels.some((channel) => channel.code === candidate)) {
    return candidate;
  }
  return getRecommendedPaymentMethod(channels, currency) || marketChannels[0]?.code || '';
};

export const areSameIds = (left: number[], right: number[]) => {
  const leftIds = new Set(left);
  const rightIds = new Set(right);
  return leftIds.size === rightIds.size && Array.from(leftIds).every((id) => rightIds.has(id));
};


export const isPurchasable = (item: CartItem) =>
  (item.productStatus || 'ACTIVE') === 'ACTIVE' && (item.stock === undefined || item.stock >= item.quantity);

type CheckoutErrorResponseLike = {
  response?: {
    status?: unknown;
  };
};

export const getCheckoutErrorResponse = (error: unknown) => (
  typeof error === 'object' && error !== null && 'response' in error
    ? (error as CheckoutErrorResponseLike).response
    : undefined
);

const checkoutOrderFinalErrorStatuses = new Set([400, 404, 409, 422]);

export const isFinalCheckoutOrderError = (error: unknown) => {
  const status = getCheckoutErrorResponse(error)?.status;
  return typeof status === 'number' && checkoutOrderFinalErrorStatuses.has(status);
};

export const isCheckoutPaymentPollTerminal = (payment?: PaymentCustomer | null) => {
  const status = normalizeStatusCode(payment?.status);
  return Boolean(status && status !== 'PENDING');
};

export const normalizeCheckoutPostalCode = normalizeRegionalPostalCode;

export const hasHydratableCheckoutValue = (value: unknown) => (
  Array.isArray(value) ? value.length > 0 : Boolean(normalizeCheckoutText(value, 500))
);

export const getSavedAddressRegionPath = (address?: UserAddress | null) => {
  const region = address?.region;
  return (Array.isArray(region) ? region : [])
    .map((item) => normalizeCheckoutText(item, 120))
    .filter(Boolean);
};

export const getSavedAddressPostalCode = (address?: UserAddress | null) =>
  normalizeCheckoutPostalCode(address?.postalCode);

export const getSavedAddressDetail = (address?: UserAddress | null) =>
  normalizeCheckoutText(address?.detailAddress, 260);

export const isCompleteSavedAddress = (address?: UserAddress | null) => {
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

export type CheckoutFormValues = {
  guestEmail?: unknown;
  recipientName?: unknown;
  phone?: unknown;
  region?: unknown;
  shippingAddress?: unknown;
  postalCode?: unknown;
  paymentMethod?: unknown;
};

export type CheckoutFormSnapshot = Partial<CheckoutFormValues>;
export type CheckoutFormFieldName = keyof CheckoutFormValues;
export type CheckoutMessageType = 'error' | 'warning' | 'success' | 'info';

export const mergeDefinedCheckoutFields = (current: CheckoutFormSnapshot, updates: CheckoutFormSnapshot) => {
  const next = { ...current };
  Object.entries(updates || {}).forEach(([key, value]) => {
    if (value !== undefined) {
      next[key as CheckoutFormFieldName] = value;
    }
  });
  return next;
};

export const mergeHydratableCheckoutFields = (current: CheckoutFormSnapshot, updates: CheckoutFormSnapshot) => {
  const next = { ...current };
  Object.entries(updates || {}).forEach(([key, value]) => {
    if (hasHydratableCheckoutValue(value)) {
      next[key as CheckoutFormFieldName] = value;
    }
  });
  return next;
};

export const firstFilledCheckoutText = (...values: unknown[]): string => {
  for (const value of values) {
    const normalized = normalizeCheckoutText(value, 500);
    if (normalized) {
      return normalized;
    }
  }
  return '';
};

export const firstCheckoutRegionPath = (...values: unknown[]): string[] | undefined => {
  const matched = values.find((value): value is unknown[] => Array.isArray(value) && value.length > 0);
  return matched ? matched.map((part) => String(part)) : undefined;
};

export const normalizeCheckoutIdempotencyKey = (value: unknown) =>
  normalizeCheckoutText(value, 120).replace(/[^a-z0-9._:-]/gi, '').slice(0, 120);

export const normalizeCheckoutGuestDraftFields = (draft: unknown) => {
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

export const PAYMENT_STATUS_LABEL_KEYS = new Set(['PENDING', 'PAID', 'FAILED', 'EXPIRED', 'REFUNDING', 'REFUNDED', 'RECONCILE_REQUIRED']);

export const paymentStatusColors: Record<string, string> = {
  PENDING: 'orange',
  PAID: 'green',
  FAILED: 'red',
  EXPIRED: 'volcano',
  REFUNDING: 'purple',
  REFUNDED: 'purple',
  RECONCILE_REQUIRED: 'magenta',
};

export const CHECKOUT_IDEMPOTENCY_KEY = 'checkoutIdempotencyKey';
export const CHECKOUT_PENDING_ORDER_KEY = 'checkoutPendingOrder';
export const CHECKOUT_GUEST_DRAFT_KEY = 'checkoutGuestDraft';
export const CHECKOUT_PAYMENT_POLL_MAX_MS = 30 * 60 * 1000;
export const SUPPORT_PANEL_DISMISS_SUPPRESS_MS = 30 * 1000;
export const CHECKOUT_GUEST_DRAFT_SAVE_DELAY_MS = 500;

export type CheckoutPaymentPollResult = {
  ownerId: string;
  orderId: number;
  orderNo?: string;
  payment: PaymentCustomer;
  order?: OrderCustomer | null;
  updatedAt: number;
};

export type CheckoutPendingOrderSnapshot = {
  order: OrderCustomer;
  paymentMethod: string;
  guestPaymentEmail?: string;
  cartItems: CartItem[];
  savedAt: number;
};

export const getCartItemLowStockCount = (item: CartItem) => getLowStockCount(item.stock, item.quantity);

export const parseCartItemSelectedSpecs = (value?: string | null): Record<string, string> => {
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

export const resolveGuestRestorePrice = (item: CartItem, product?: Product | null) => {
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

export const checkoutPaymentPollResultKey = (orderId: number) => `checkoutPaymentPollResult:${orderId}`;

export const parseCheckoutPaymentPollResult = (raw: string | null): CheckoutPaymentPollResult | null => {
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

export const parseCheckoutPendingOrderSnapshot = (
  raw: string | null,
  maxAgeMs: number = CHECKOUT_PAYMENT_POLL_MAX_MS,
): CheckoutPendingOrderSnapshot | null => {
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
    if (Date.now() - savedAt > maxAgeMs) {
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

export const checkoutGuestDraftFieldNames: CheckoutFormFieldName[] = [
  'guestEmail',
  'recipientName',
  'phone',
  'region',
  'shippingAddress',
  'postalCode',
];

export type CheckoutValidationField = {
  name?: Array<string | number>;
  errors?: ReactNode[];
};

export const CHECKOUT_VALIDATION_SCROLL_OFFSET = 96;

export const normalizeCheckoutValidationMessage = (message: ReactNode): string => {
  if (typeof message === 'string' || typeof message === 'number') {
    return String(message).trim();
  }
  if (Array.isArray(message)) {
    return message.map(normalizeCheckoutValidationMessage).filter(Boolean).join(' ').trim();
  }
  return '';
};

export const buildCheckoutValidationAnnouncement = (
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

export const buildCheckoutFieldErrorMap = (fields: CheckoutValidationField[]): Record<string, string> => {
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

export const CHECKOUT_PAYMENT_POLL_RESULT_MAX_MS = CHECKOUT_PAYMENT_POLL_MAX_MS + CHECKOUT_PAYMENT_POLL_LOCK_TTL_MS;

export const createCheckoutIdempotencyKey = () => {
  const cryptoApi = typeof window !== 'undefined'
    ? (window.crypto as (Crypto & { randomUUID?: () => string }) | undefined)
    : undefined;
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

export const getOrCreateCheckoutIdempotencyKey = () => {
  const existing = normalizeCheckoutIdempotencyKey(getSessionStorageItem(CHECKOUT_IDEMPOTENCY_KEY));
  if (existing) return existing;
  const next = normalizeCheckoutIdempotencyKey(createCheckoutIdempotencyKey());
  setSessionStorageItem(CHECKOUT_IDEMPOTENCY_KEY, next);
  return next;
};

export const clearCheckoutIdempotencyKey = () => {
  removeSessionStorageItem(CHECKOUT_IDEMPOTENCY_KEY);
};

export const readCheckoutPendingOrder = () => {
  const snapshot = parseCheckoutPendingOrderSnapshot(getSessionStorageItem(CHECKOUT_PENDING_ORDER_KEY));
  if (!snapshot) {
    removeSessionStorageItem(CHECKOUT_PENDING_ORDER_KEY);
  }
  return snapshot;
};

export const persistCheckoutPendingOrder = (
  order: OrderCustomer,
  paymentMethod: string,
  guestPaymentEmail: string | undefined,
  cartItems: CartItem[],
) => {
  setSessionStorageItem(CHECKOUT_PENDING_ORDER_KEY, JSON.stringify({
    order,
    paymentMethod,
    guestPaymentEmail,
    cartItems,
    savedAt: Date.now(),
  }));
};

export const clearCheckoutPendingOrder = () => {
  removeSessionStorageItem(CHECKOUT_PENDING_ORDER_KEY);
};

export const readCheckoutPaymentPollResult = (orderId: number) => {
  const result = parseCheckoutPaymentPollResult(getLocalStorageItem(checkoutPaymentPollResultKey(orderId)));
  if (!result || result.orderId !== orderId || Date.now() - result.updatedAt > CHECKOUT_PAYMENT_POLL_RESULT_MAX_MS) {
    return null;
  }
  return result;
};

export const writeCheckoutPaymentPollResult = (
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

export const readCheckoutGuestDraftFields = () => {
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

export type CheckoutMoneyFormatter = (value: number | null | undefined) => string;

export const describeCheckoutCoupon = (
  coupon: UserCoupon,
  cartTotal: number,
  formatMoney: CheckoutMoneyFormatter,
  t: CheckoutTranslationFn,
) => {
  const payablePercent = getCouponPayablePercent(coupon);
  const discountPercent = Math.max(0, 100 - payablePercent);
  const rule = coupon.couponType === 'FULL_REDUCTION'
    ? `${formatMoney(coupon.thresholdAmount)} - ${formatMoney(coupon.reductionAmount)}`
    : t('pages.checkout.discountPayable', { percent: discountPercent }) + (coupon.maxDiscountAmount ? `, ${t('pages.checkout.maxDiscount', { amount: formatMoney(coupon.maxDiscountAmount) })}` : '');
  const threshold = Number(coupon.thresholdAmount || 0);
  if (toSafeMoney(cartTotal) < threshold) {
    return `${coupon.couponName}: ${rule} (${t('pages.checkout.needMore', { amount: formatMoney(threshold - toSafeMoney(cartTotal)) })})`;
  }
  return `${coupon.couponName}: ${rule}`;
};

export type CheckoutRecipientPayload = {
  recipientName: string;
  recipientPhone: string;
};

export const buildCheckoutRecipientPayload = (params: {
  selectedAddressId: number | 'new';
  selectedSavedAddress?: UserAddress | null;
  recipientName: unknown;
  phone: unknown;
}): CheckoutRecipientPayload => {
  const { selectedAddressId, selectedSavedAddress, recipientName, phone } = params;
  if (selectedAddressId !== 'new' && selectedSavedAddress) {
    return {
      recipientName: normalizeCheckoutText(selectedSavedAddress.recipientName, 80),
      recipientPhone: normalizeCheckoutPhone(selectedSavedAddress.phone),
    };
  }
  return {
    recipientName: normalizeCheckoutText(recipientName, 80),
    recipientPhone: normalizeCheckoutPhone(phone),
  };
};

export const buildCheckoutShippingAddressLine = (params: {
  selectedAddressId: number | 'new';
  selectedSavedAddress?: UserAddress | null;
  selectedSavedAddressRegion: string[];
  selectedSavedAddressPostalCode: string;
  selectedSavedAddressDetail: string;
  recipientName: unknown;
  phone: unknown;
  regionPath: unknown;
  postalCode: unknown;
  detailAddress: unknown;
  addressRequiredMessage: string;
}): string => {
  const {
    selectedAddressId,
    selectedSavedAddress,
    selectedSavedAddressRegion,
    selectedSavedAddressPostalCode,
    selectedSavedAddressDetail,
    recipientName,
    phone,
    regionPath,
    postalCode,
    detailAddress,
    addressRequiredMessage,
  } = params;

  if (selectedAddressId !== 'new') {
    if (!selectedSavedAddress) {
      throw new Error(addressRequiredMessage);
    }
    const region = selectedSavedAddressRegion.join(' ');
    const addressParts = [region, selectedSavedAddressPostalCode, selectedSavedAddressDetail].filter(Boolean).join(' ');
    if (!isCompleteSavedAddress(selectedSavedAddress) || !addressParts) {
      throw new Error(addressRequiredMessage);
    }
    return normalizeCheckoutText(
      `${selectedSavedAddress.recipientName} / ${normalizeCheckoutPhone(selectedSavedAddress.phone)} / ${addressParts}`,
      500,
    );
  }

  const nextRecipientName = normalizeCheckoutText(recipientName, 80);
  const nextPhone = normalizeCheckoutPhone(phone);
  const region = Array.isArray(regionPath) ? regionPath.join(' ') : '';
  const nextPostalCode = normalizeCheckoutPostalCode(postalCode);
  const detail = normalizeCheckoutText(detailAddress, 260);
  const addressParts = [region, nextPostalCode, detail].filter(Boolean).join(' ');
  return normalizeCheckoutText(`${nextRecipientName} / ${nextPhone} / ${addressParts}`, 500);
};

export const formatCheckoutPaymentStatusLabel = (
  status: unknown,
  t: CheckoutTranslationFn,
  unknownKey: string = 'common.unknown',
) => {
  const rawStatus = String(status || '').trim();
  const normalizedStatus = normalizeStatusCode(rawStatus);
  if (!normalizedStatus) return t(unknownKey);
  if (PAYMENT_STATUS_LABEL_KEYS.has(normalizedStatus)) {
    return t(`status.${normalizedStatus}`);
  }
  return rawStatus;
};

export const getCheckoutPaymentStatusColor = (status?: string) => {
  const normalizedStatus = normalizeStatusCode(status);
  if (!PAYMENT_STATUS_LABEL_KEYS.has(normalizedStatus)) return 'default';
  return paymentStatusColors[normalizedStatus] || 'default';
};

export const scoreCheckoutReadiness = (items: Array<{ ready: boolean }>) => {
  if (!items.length) return 0;
  return Math.round((items.filter((item) => item.ready).length / items.length) * 100);
};

export const pickCheckoutNextAction = <T extends { ready: boolean; key: string }>(
  items: T[],
  options?: { blockingOnly?: boolean },
) => {
  if (options?.blockingOnly) {
    return items.find((item) => !item.ready && item.key !== 'savings') || null;
  }
  return items.find((item) => !item.ready) || null;
};

export type CheckoutCouponUnlock = {
  coupon: UserCoupon;
  gap: number;
  estimatedValue: number;
};

export const estimateCheckoutCouponUnlockValue = (coupon: UserCoupon) => {
  const threshold = toSafeMoney(coupon.thresholdAmount);
  if (coupon.couponType === 'FULL_REDUCTION') {
    return toSafeMoney(coupon.reductionAmount);
  }
  return Math.min(
    toSafeMoney(coupon.maxDiscountAmount) || threshold,
    threshold * (100 - getCouponPayablePercent(coupon)) / 100,
  );
};

export const findNextCheckoutCouponUnlock = (
  coupons: UserCoupon[],
  cartTotal: number,
): CheckoutCouponUnlock | null => {
  if (!coupons.length) return null;
  const safeCartTotal = toSafeMoney(cartTotal);
  return coupons
    .map((coupon) => {
      const threshold = toSafeMoney(coupon.thresholdAmount);
      const gap = Math.max(0, threshold - safeCartTotal);
      const estimatedValue = estimateCheckoutCouponUnlockValue(coupon);
      return { coupon, gap, estimatedValue };
    })
    .filter((item) => item.gap > 0 && item.estimatedValue > 0)
    .sort((left, right) => left.gap - right.gap || right.estimatedValue - left.estimatedValue)[0] || null;
};

export type CheckoutCouponOpportunity = {
  type: 'ready' | 'build';
  title: string;
  text: string;
  action: string;
};

export const buildCheckoutCouponOpportunity = (params: {
  isGuestCheckout: boolean;
  availableCoupons: UserCoupon[];
  selectedCoupon?: UserCoupon | null;
  selectedIsBestCoupon: boolean;
  discountAmount: number;
  nextCouponUnlock?: CheckoutCouponUnlock | null;
  formatMoney: CheckoutMoneyFormatter;
  t: CheckoutTranslationFn;
}): CheckoutCouponOpportunity | null => {
  const {
    isGuestCheckout,
    availableCoupons,
    selectedCoupon,
    selectedIsBestCoupon,
    discountAmount,
    nextCouponUnlock,
    formatMoney,
    t,
  } = params;
  if (isGuestCheckout || !availableCoupons.length) return null;
  if (selectedCoupon && toSafeMoney(discountAmount) > 0) {
    return {
      type: 'ready',
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
      type: 'build',
      title: t('pages.checkout.couponOpportunityBuildTitle'),
      text: t('pages.checkout.couponOpportunityBuildText', {
        amount: formatMoney(nextCouponUnlock.gap),
        value: formatMoney(nextCouponUnlock.estimatedValue),
      }),
      action: t('pages.checkout.couponOpportunityReview'),
    };
  }
  return null;
};


export const resolveCheckoutNextActionLabelKey = (actionKey?: string | null) => {
  switch (actionKey) {
    case 'items':
      return 'pages.checkout.nextActionReviewCart';
    case 'address':
      return 'pages.checkout.nextActionAddress';
    case 'payment':
      return 'pages.checkout.nextActionPayment';
    case 'savings':
      return 'pages.checkout.nextActionSavings';
    default:
      return 'pages.checkout.nextActionSupport';
  }
};

/** Commercial a11y: compose order-scoped action labels for post-submit recovery CTAs. */
export const buildCheckoutOrderActionContext = (params: {
  orderNo?: string | number | null;
  orderId?: number | null;
  amountText: string;
  orderNoLabel: string;
}) => {
  const orderDisplayNo = params.orderNo || (params.orderId != null ? String(params.orderId) : '');
  return `${params.orderNoLabel}: ${orderDisplayNo} · ${params.amountText}`;
};

export const buildCheckoutActionAriaLabel = (actionLabel: string, context: string) => (
  `${actionLabel}: ${context}`
);


/** Commercial checkout: guest order line payload for create-order. */
export const buildGuestCheckoutOrderItems = (cartItems: CartItem[]) => (
  cartItems.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    selectedSpecs: item.selectedSpecs,
  }))
);

/** Commercial checkout: rebuild guest cart line after payment rollback using latest catalog snapshot. */
export const buildGuestRestoreCartLine = (
  item: CartItem,
  latestProduct: Product | null | undefined,
  fallbackName: string,
) => {
  const restorePrice = resolveGuestRestorePrice(item, latestProduct || null);
  return {
    product: {
      id: item.productId,
      name: (latestProduct?.name || fallbackName || '').trim() || fallbackName,
      imageUrl: latestProduct?.imageUrl || item.imageUrl,
      price: restorePrice,
      effectivePrice: restorePrice,
      stock: latestProduct?.stock ?? item.stock,
      status: latestProduct?.status || item.productStatus || 'ACTIVE',
      freeShipping: latestProduct?.freeShipping ?? item.freeShipping,
      freeShippingThreshold: latestProduct?.freeShippingThreshold ?? item.freeShippingThreshold,
    },
    quantity: item.quantity,
    selectedSpecs: item.selectedSpecs,
    restorePrice,
  };
};

export type CheckoutSubmitGuardCode =
  | 'empty_cart'
  | 'unavailable_selected'
  | 'payment_unavailable'
  | 'payment_required'
  | 'email_invalid'
  | 'shipping_unavailable'
  | 'shipping_calculating';

const checkoutSubmitGuardMessageKeys: Record<CheckoutSubmitGuardCode, string> = {
  empty_cart: 'pages.checkout.emptyCart',
  unavailable_selected: 'pages.checkout.unavailableSelected',
  payment_unavailable: 'pages.checkout.paymentUnavailable',
  payment_required: 'pages.checkout.paymentRequired',
  email_invalid: 'pages.checkout.emailInvalid',
  shipping_unavailable: 'pages.checkout.shippingFeeUnavailable',
  shipping_calculating: 'pages.checkout.shippingFeeCalculating',
};

export const checkoutSubmitGuardMessageKey = (code: CheckoutSubmitGuardCode) => (
  checkoutSubmitGuardMessageKeys[code]
);

/**
 * Commercial pre-submit cart/payment channel guards.
 * Payment method membership (allowed channel list) stays page-side so market-filter rails remain explicit.
 */
export const resolveCheckoutCartSubmitGuard = (params: {
  cartItemCount: number;
  hasUnavailableSelected: boolean;
  paymentMethodsAvailable: boolean;
}): CheckoutSubmitGuardCode | null => {
  if (params.cartItemCount <= 0) return 'empty_cart';
  if (params.hasUnavailableSelected) return 'unavailable_selected';
  if (!params.paymentMethodsAvailable) return 'payment_unavailable';
  return null;
};

export const resolveCheckoutContactSubmitGuard = (params: {
  hasToken: boolean;
  paymentMethod: string;
  guestEmail?: string;
  requiresBackendShippingQuote: boolean;
  shippingQuoteReady: boolean;
  shippingQuoteUnavailable: boolean;
}): CheckoutSubmitGuardCode | null => {
  if (!params.paymentMethod) return 'payment_required';
  if (!params.hasToken && !isLikelyCheckoutEmail(params.guestEmail)) return 'email_invalid';
  if (params.requiresBackendShippingQuote && !params.shippingQuoteReady) {
    return params.shippingQuoteUnavailable ? 'shipping_unavailable' : 'shipping_calculating';
  }
  return null;
};


export type CheckoutPaymentRecoveryTone = 'success' | 'warning' | 'error' | 'processing';

export type CheckoutPaymentRecoveryLike = {
  isExpired: boolean;
  isExpiringSoon: boolean;
  minutesLeft: number | null;
};

/** Commercial checkout: localize payment recovery coach copy after order submit. */
export const buildCheckoutPaymentRecoveryCopy = (params: {
  paid: boolean;
  isReconcileRequired: boolean;
  paymentRecovery: CheckoutPaymentRecoveryLike;
  hasPaymentUrl: boolean;
  t: CheckoutTranslationFn;
}) => {
  const { paid, isReconcileRequired, paymentRecovery, hasPaymentUrl, t } = params;
  const tone: CheckoutPaymentRecoveryTone = paid
    ? 'success'
    : isReconcileRequired
      ? 'warning'
      : paymentRecovery.isExpired
        ? 'error'
        : paymentRecovery.isExpiringSoon
          ? 'warning'
          : 'processing';
  const statusText = paid
    ? t('pages.checkout.paymentRecoveryPaid')
    : isReconcileRequired
      ? t('pages.checkout.paymentRecoveryReconcileRequired')
      : paymentRecovery.isExpired
        ? t('pages.checkout.paymentRecoveryExpired')
        : t('pages.checkout.paymentRecoveryPending');
  const windowText = isReconcileRequired
    ? t('pages.checkout.paymentRecoveryWindowUnknown')
    : paymentRecovery.minutesLeft === null
      ? t('pages.checkout.paymentRecoveryWindowUnknown')
      : paymentRecovery.isExpired
        ? t('pages.checkout.paymentRecoveryWindowExpired')
        : t('pages.checkout.paymentRecoveryWindowMinutes', { count: paymentRecovery.minutesLeft });
  const nextText = paid
    ? t('pages.checkout.paymentRecoveryNextPaid')
    : isReconcileRequired
      ? t('pages.checkout.paymentRecoveryNextReconcileRequired')
      : hasPaymentUrl
        ? t('pages.checkout.paymentRecoveryNextOpen')
        : t('pages.checkout.paymentRecoveryNextRetry');
  return { tone, statusText, windowText, nextText };
};

