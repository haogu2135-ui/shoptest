import { reportNonBlockingError } from './nonBlockingError';
import { getLocalStorageItem, removeLocalStorageItem, setLocalStorageItem } from './safeStorage';

const GUEST_SUPPORT_CONTEXT_KEY = 'shop-guest-support-context';
const GUEST_SUPPORT_CONTEXT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type GuestSupportContext = {
  orderNo: string;
  email: string;
  accessToken?: string;
};

type StoredGuestSupportContext = GuestSupportContext & {
  savedAt: number;
};

const cleanText = (value: unknown, maxLength = 160) => {
  const raw = String(value || '');
  let cleaned = '';
  for (let index = 0; index < raw.length; index += 1) {
    const code = raw.charCodeAt(index);
    cleaned += code <= 31 || code === 127 ? ' ' : raw[index];
  }
  return cleaned.trim().slice(0, maxLength);
};

export const normalizeGuestSupportContext = (value: unknown): GuestSupportContext | null => {
  if (!value || typeof value !== 'object') return null;
  const detail = value as { orderNo?: unknown; email?: unknown; guestOrderNo?: unknown; guestEmail?: unknown; accessToken?: unknown; guestAccessToken?: unknown };
  const orderNo = cleanText(detail.guestOrderNo || detail.orderNo, 100);
  const email = cleanText(detail.guestEmail || detail.email, 180).toLowerCase();
  const accessToken = cleanText(detail.guestAccessToken || detail.accessToken, 2048);
  return orderNo && (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || accessToken)
    ? { orderNo, email, ...(accessToken ? { accessToken } : {}) }
    : null;
};

export const saveGuestSupportContext = (context: GuestSupportContext | null) => {
  if (!context) return false;
  return setLocalStorageItem(GUEST_SUPPORT_CONTEXT_KEY, JSON.stringify({ ...context, savedAt: Date.now() }));
};

export const clearGuestSupportContext = () => removeLocalStorageItem(GUEST_SUPPORT_CONTEXT_KEY);

export const loadGuestSupportContext = (): GuestSupportContext | null => {
  try {
    const parsed = JSON.parse(getLocalStorageItem(GUEST_SUPPORT_CONTEXT_KEY) || 'null') as StoredGuestSupportContext | null;
    const normalized = normalizeGuestSupportContext(parsed);
    const savedAt = Number(parsed?.savedAt);
    if (!normalized || !parsed?.savedAt || !Number.isFinite(savedAt) || Date.now() - savedAt > GUEST_SUPPORT_CONTEXT_TTL_MS) {
      removeLocalStorageItem(GUEST_SUPPORT_CONTEXT_KEY);
      return null;
    }
    return normalized;
  } catch (error) {
    reportNonBlockingError('guestSupportContext.loadGuestSupportContext', error);
    removeLocalStorageItem(GUEST_SUPPORT_CONTEXT_KEY);
    return null;
  }
};
