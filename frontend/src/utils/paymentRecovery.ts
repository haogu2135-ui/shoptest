import type { PaymentCustomer } from '../types';

export type PaymentRecoveryState = {
  isPaid: boolean;
  isExpired: boolean;
  isExpiringSoon: boolean;
  minutesLeft: number | null;
};

export const getPaymentRecoveryState = (payment?: Pick<PaymentCustomer, 'status' | 'expiresAt'> | null): PaymentRecoveryState => {
  const isPaid = String(payment?.status || '').trim().toUpperCase() === 'PAID';
  if (!payment?.expiresAt || isPaid) {
    return {
      isPaid,
      isExpired: false,
      isExpiringSoon: false,
      minutesLeft: null,
    };
  }
  const expiresAt = new Date(payment.expiresAt).getTime();
  const diffMs = expiresAt - Date.now();
  if (!Number.isFinite(expiresAt)) {
    return {
      isPaid,
      isExpired: false,
      isExpiringSoon: false,
      minutesLeft: null,
    };
  }
  const minutesLeft = Math.max(0, Math.ceil(diffMs / 60000));
  return {
    isPaid,
    isExpired: diffMs <= 0,
    isExpiringSoon: diffMs > 0 && minutesLeft <= 10,
    minutesLeft,
  };
};

export const formatPaymentUrlLabel = (value?: string | null) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '-';
  if (!/^https?:\/\//i.test(trimmed)) return '-';
  try {
    const url = new URL(trimmed);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '-';
    const path = url.pathname === '/' ? '' : url.pathname;
    const label = `${url.hostname}${path}`;
    return label.length > 54 ? `${label.slice(0, 51)}...` : label;
  } catch (_error) {
    return '-';
  }
};
