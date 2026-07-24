import type React from 'react';
import type { OrderCustomer, OrderItemCustomer, PaymentChannel, UserAddress } from '../types';
import { focusFirstFormError } from './formValidationFocus';
import { getCurrency } from './market';
import { filterPaymentChannelsForMarket } from './paymentMethods';
import { isLikelyPhoneNumber, normalizeLikelyPhoneNumber, normalizePhoneNumber } from './phone';
import { isValidRegionalPostalCode, normalizeRegionalPostalCode } from './postalCode';
import { productImageFallback, resolveProductImage } from './productMedia';

export const orderImageFallback = productImageFallback;
export const resolveOrderImage = resolveProductImage;
export const PROFILE_ORDER_ITEM_PREVIEW_LIMIT = 30;
export type FormValidationError = { errorFields: unknown[] };
export type OrderItemsPreviewResult = { orderId: number; items: OrderItemCustomer[]; failed: boolean };

export const isFormValidationError = (error: unknown): error is FormValidationError => {
  if (!error || typeof error !== 'object') return false;
  return Array.isArray((error as { errorFields?: unknown }).errorFields);
};

export const focusProfileModalFormError = (rootSelector: string) => {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      focusFirstFormError({
        rootSelector,
        scrollOffset: 80,
        scrollContainerSelector: `${rootSelector} .shop-modal__body, ${rootSelector} .ant-modal-body`,
      });
    });
  });
};

export const getProfileApiErrorData = (error: unknown): Record<string, unknown> => {
  if (!error || typeof error !== 'object') return {};
  const response = (error as { response?: unknown }).response;
  if (!response || typeof response !== 'object') return {};
  const data = (response as { data?: unknown }).data;
  return data && typeof data === 'object' ? data as Record<string, unknown> : {};
};

export const getProfileApiErrorCode = (error: unknown) => {
  const code = getProfileApiErrorData(error).code;
  return typeof code === 'string' ? code : '';
};

export const getPreferredPaymentChannel = (
  channels: PaymentChannel[],
  preferred?: string | null,
  currency: string = getCurrency(),
) => {
  const normalizedPreferred = String(preferred || '').trim();
  const marketChannels = filterPaymentChannelsForMarket(channels, { currency });
  if (normalizedPreferred) {
    if (marketChannels.some((channel) => channel.code === normalizedPreferred)) {
      return normalizedPreferred;
    }
    // Preserve historical order channel so continue-pay can finish an existing charge.
    if (channels.some((channel) => channel.code === normalizedPreferred)) {
      return normalizedPreferred;
    }
  }
  return marketChannels.find((channel) => channel.recommended)?.code || marketChannels[0]?.code || '';
};

export const useImageFallback = (event: React.SyntheticEvent<HTMLImageElement>) => {
  if (event.currentTarget.src !== orderImageFallback) {
    event.currentTarget.src = orderImageFallback;
  }
};

export const statusColors: Record<string, string> = {
  PENDING_PAYMENT: 'orange',
  PENDING_SHIPMENT: 'blue',
  SHIPPED: 'cyan',
  COMPLETED: 'green',
  CANCELLED: 'red',
  RETURN_REQUESTED: 'gold',
  RETURN_APPROVED: 'geekblue',
  RETURN_SHIPPED: 'cyan',
  RETURN_REFUNDING: 'magenta',
  RETURNED: 'purple',
  PENDING: 'orange',
  PAID: 'blue',
  REFUNDED: 'purple',
  FAILED: 'red',
  EXPIRED: 'volcano',
  RECONCILE_REQUIRED: 'magenta',
  DELIVERED: 'green',
};

export const ORDER_STATUS_LABEL_KEYS = new Set([
  'PENDING_PAYMENT',
  'PENDING_SHIPMENT',
  'SHIPPED',
  'PENDING_RECEIPT',
  'COMPLETED',
  'CANCELLED',
  'RETURN_REQUESTED',
  'RETURN_APPROVED',
  'RETURN_SHIPPED',
  'RETURN_REFUNDING',
  'RETURNED',
  'REFUNDED',
  'DELIVERED',
]);
export const PAYMENT_STATUS_LABEL_KEYS = new Set(['PENDING', 'PAID', 'FAILED', 'EXPIRED', 'REFUNDING', 'REFUNDED', 'RECONCILE_REQUIRED']);

export const normalizeStatusCode = (status?: string) => String(status || '').trim().toUpperCase();

export const getOrderSortTime = (order: OrderCustomer) => {
  const createdAt = order.createdAt ? new Date(order.createdAt).getTime() : 0;
  return Number.isNaN(createdAt) ? 0 : createdAt;
};

export const profileOrderLabel = (order: Pick<OrderCustomer, 'id' | 'orderNo'>) => order.orderNo || `#${order.id}`;

export const sortOrdersNewestFirst = (items: OrderCustomer[]) =>
  [...items].sort((left, right) => getOrderSortTime(right) - getOrderSortTime(left) || right.id - left.id);

export const PROFILE_TAB_KEYS = ['info', 'addresses', 'orders', 'pets'] as const;
export const PROFILE_MOBILE_ENTRY_TAB_KEYS = ['orders', 'addresses', 'info', 'pets'] as const;
export const normalizeProfileTab = (value: string | null) =>
  value === 'info' || value === 'addresses' || value === 'orders' || value === 'pets' ? value : null;

export const normalizeProfileOrderNo = (value: unknown) => String(value || '').trim().toUpperCase();
export const normalizeProfileEmail = (value: unknown) => String(value || '').trim().toLowerCase();
export const profilePhoneOptions = { minDigits: 6, maxDigits: 20, maxInputLength: 40 };
export const normalizeProfilePhone = (value: unknown) => normalizePhoneNumber(value, profilePhoneOptions);
export const isLikelyProfilePhone = (value: unknown) => isLikelyPhoneNumber(value, profilePhoneOptions);
export const normalizeLikelyProfilePhone = (value: unknown) =>
  normalizeLikelyPhoneNumber(value, profilePhoneOptions);
export const normalizeProfileAddressText = (value: unknown, maxLength: number) =>
  String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
export const getProfileSavedAddressRegionPath = (address?: UserAddress | null) => {
  const region = address?.region;
  return (Array.isArray(region) ? region : [])
    .map((item) => normalizeProfileAddressText(item, 120))
    .filter(Boolean);
};
export const getProfileSavedAddressPostalCode = (address?: UserAddress | null) =>
  normalizeRegionalPostalCode(address?.postalCode);
export const getProfileSavedAddressDetail = (address?: UserAddress | null) =>
  normalizeProfileAddressText(address?.detailAddress, 260);
export const isCompleteProfileAddress = (address?: UserAddress | null) => {
  const regionPath = getProfileSavedAddressRegionPath(address);
  const postalCode = getProfileSavedAddressPostalCode(address);
  return Boolean(
    address
      && normalizeProfileAddressText(address.recipientName, 80)
      && isLikelyProfilePhone(address.phone)
      && regionPath.length > 0
      && isValidRegionalPostalCode(postalCode, regionPath)
      && getProfileSavedAddressDetail(address),
  );
};
export const normalizeEmailCode = (value: unknown) => String(value || '').replace(/\D+/g, '').slice(0, 6);
export const scrollProfileAddressFieldIntoMobileView = (target: EventTarget | null) => {
  if (typeof window === 'undefined' || window.innerWidth > 780 || !(target instanceof HTMLElement)) return;
  const field = target.closest('.ant-form-item') || target;
  window.setTimeout(() => {
    field.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
  }, 80);
};

export type OrderActionHintTone = 'pay' | 'wait' | 'ship' | 'return' | 'done' | 'neutral';

export type OrderActionHint = {
  tone: OrderActionHintTone;
  title: string;
  text: string;
};

