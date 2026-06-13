import type { OrderCustomer } from '../types';
import { reportNonBlockingError } from './nonBlockingError';

export const SUPPORT_ORDER_MESSAGE_PREFIX = '[ORDER]';

export type SupportOrderContext = Pick<OrderCustomer, 'id' | 'orderNo' | 'status' | 'totalAmount' | 'paymentMethod' | 'createdAt'>;

const normalizeText = (value: unknown, maxLength: number) => {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  return text ? text.slice(0, maxLength) : undefined;
};

export const normalizeSupportOrderContext = (value: unknown): SupportOrderContext | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const id = Number(item.id);
  const status = normalizeText(item.status, 40);
  if (!Number.isSafeInteger(id) || id <= 0 || !status) return null;

  const totalAmount = Number(item.totalAmount);
  return {
    id,
    orderNo: normalizeText(item.orderNo, 80),
    status,
    totalAmount: Number.isFinite(totalAmount) ? totalAmount : 0,
    paymentMethod: normalizeText(item.paymentMethod, 60),
    createdAt: normalizeText(item.createdAt, 80),
  };
};

export const encodeSupportOrderMessage = (order: OrderCustomer) => `${SUPPORT_ORDER_MESSAGE_PREFIX}${JSON.stringify({
  id: order.id,
  orderNo: order.orderNo,
  status: order.status,
  totalAmount: order.totalAmount,
  originalAmount: order.originalAmount,
  discountAmount: order.discountAmount,
  paymentMethod: order.paymentMethod,
  createdAt: order.createdAt,
})}`;

export const decodeSupportOrderMessage = (text?: string | null): SupportOrderContext | null => {
  if (!text?.startsWith(SUPPORT_ORDER_MESSAGE_PREFIX)) return null;
  try {
    return normalizeSupportOrderContext(JSON.parse(text.slice(SUPPORT_ORDER_MESSAGE_PREFIX.length)));
  } catch (error) {
    reportNonBlockingError('supportOrderMessage.decodeSupportOrderMessage', error);
    return null;
  }
};
