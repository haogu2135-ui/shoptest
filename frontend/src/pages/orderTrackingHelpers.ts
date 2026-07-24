import type { OrderCustomer } from '../types';
import { productImageFallback, resolveProductImage } from '../utils/productMedia';

export const orderTrackingImageFallback = productImageFallback;
export const resolveOrderTrackingImage = resolveProductImage;

export const cleanTrackingParam = (value: string | null, maxLength = 120) =>
  Array.from(String(value || ''), (char) => {
    const code = char.charCodeAt(0);
    return code <= 31 || code === 127 ? ' ' : char;
  }).join('').trim().slice(0, maxLength);

export const statusColor: Record<string, string> = {
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

export const normalizeStatusCode = (status?: string) => String(status || '').trim().toUpperCase();

export const getTrackingStep = (status?: string) => {
  if (status === 'COMPLETED' || status === 'RETURN_REFUNDING' || status === 'RETURNED') return 3;
  if (status === 'SHIPPED' || status === 'RETURN_SHIPPED') return 2;
  if (status === 'PENDING_SHIPMENT' || status === 'RETURN_APPROVED') return 1;
  return 0;
};

export const ORDER_TRACKING_AUTO_REFRESH_MS = 30_000;

export const ORDER_TRACKING_TERMINAL_STATUSES = new Set([
  'CANCELLED',
  'COMPLETED',
  'DELIVERED',
  'REFUNDED',
  'RETURN_REFUNDING',
  'RETURNED',
]);

export const shouldAutoRefreshTrackedOrder = (order?: Pick<OrderCustomer, 'status'> | null) => {
  if (!order) return false;
  const normalizedStatus = normalizeStatusCode(order.status);
  if (!normalizedStatus) return true;
  return !ORDER_TRACKING_TERMINAL_STATUSES.has(normalizedStatus);
};

export const isGuestTrackedOrder = (order?: OrderCustomer | null) => Boolean(
  order?.guestOrder || String(order?.shippingAddress || '').startsWith('[Guest]'),
);
