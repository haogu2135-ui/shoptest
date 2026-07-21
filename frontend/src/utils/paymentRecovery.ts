import type { PaymentCustomer } from '../types';
import { isSafeHttpUrl, navigateToSafeUrl, normalizeSafeHttpUrl } from './safeUrl';

export type PaymentRecoveryState = {
  isPaid: boolean;
  isExpired: boolean;
  isExpiringSoon: boolean;
  minutesLeft: number | null;
};

/** Hosts that serve the ShopMX SPA payment instructions page. */
const KNOWN_STOREFRONT_PAYMENT_HOSTS = new Set([
  'pet.686888666.xyz',
  'localhost',
  '127.0.0.1',
]);

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
  if (!Number.isFinite(expiresAt)) {
    return {
      isPaid,
      isExpired: false,
      isExpiringSoon: false,
      minutesLeft: null,
    };
  }
  const diffMs = expiresAt - Date.now();
  const minutesLeft = Math.max(0, Math.ceil(diffMs / 60000));
  return {
    isPaid,
    isExpired: diffMs <= 0,
    isExpiringSoon: diffMs > 0 && minutesLeft <= 10,
    minutesLeft,
  };
};

export const isStorefrontPaymentPath = (pathname?: string | null) => {
  const path = String(pathname || '').trim();
  return /^\/payment(?:\/|$)/i.test(path);
};

/**
 * Commercial multi-host conversion: storefront payment instruction links
 * (e.g. https://pet.686888666.xyz/payment/SO...) must stay on the host the shopper
 * is currently using (local UI, origin edge, or temporary public tunnel). External
 * provider checkout URLs (Mercado/Stripe/etc.) remain absolute.
 */
export const resolveCommercialPaymentNavigationUrl = (
  paymentUrl?: string | null,
  currentOrigin?: string | null,
): string | null => {
  const allowInsecureHttp = { allowInsecureHttp: true as const };
  if (!isSafeHttpUrl(paymentUrl, allowInsecureHttp)) {
    return null;
  }
  try {
    const url = new URL(String(paymentUrl).trim());
    if (!isStorefrontPaymentPath(url.pathname)) {
      return normalizeSafeHttpUrl(paymentUrl, allowInsecureHttp);
    }

    const originHint = String(
      currentOrigin
        || (typeof window !== 'undefined' && window.location ? window.location.origin : '')
        || '',
    ).trim();
    if (!originHint) {
      return normalizeSafeHttpUrl(paymentUrl, allowInsecureHttp);
    }

    const current = new URL(originHint);
    const paymentHost = url.hostname.toLowerCase();
    const currentHost = current.hostname.toLowerCase();
    const isKnownStorefrontHost = KNOWN_STOREFRONT_PAYMENT_HOSTS.has(paymentHost)
      || paymentHost === currentHost
      || paymentHost.endsWith('.trycloudflare.com');

    if (!isKnownStorefrontHost) {
      return normalizeSafeHttpUrl(paymentUrl, allowInsecureHttp);
    }

    // Preserve path/query/hash; swap only origin so conversion survives CDN outages.
    return `${current.origin}${url.pathname}${url.search}${url.hash}`;
  } catch (_error) {
    return null;
  }
};

export const formatPaymentUrlLabel = (
  value?: string | null,
  currentOrigin?: string | null,
) => {
  // Prefer the commercial navigation URL so storefront payment links display the
  // host the shopper is actually on (local/tunnel/origin) instead of a dead CDN host.
  const displayValue = resolveCommercialPaymentNavigationUrl(value, currentOrigin) || value;
  const trimmed = String(displayValue || '').trim();
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

export const navigateToCommercialPaymentUrl = (
  paymentUrl?: string | null,
  navigate?: (url: string) => void,
  options?: { allowInsecureHttp?: boolean; currentOrigin?: string | null },
) => {
  const resolved = resolveCommercialPaymentNavigationUrl(
    paymentUrl,
    options?.currentOrigin,
  );
  if (!resolved) return false;
  return navigateToSafeUrl(resolved, navigate, {
    allowInsecureHttp: options?.allowInsecureHttp ?? true,
  });
};
