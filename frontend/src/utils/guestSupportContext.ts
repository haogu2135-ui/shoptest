import { getLocalStorageItem, removeLocalStorageItem, setLocalStorageItem } from './safeStorage';

const GUEST_SUPPORT_CONTEXT_KEY = 'shop-guest-support-context';
const GUEST_SUPPORT_CONTEXT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type GuestSupportContext = {
  orderNo: string;
  email: string;
};

type StoredGuestSupportContext = GuestSupportContext & {
  savedAt: number;
};

const cleanText = (value: unknown, maxLength = 160) =>
  Array.from(String(value || ''), (char) => {
    const code = char.charCodeAt(0);
    return code <= 31 || code === 127 ? ' ' : char;
  }).join('').trim().slice(0, maxLength);

export const normalizeGuestSupportContext = (value: unknown): GuestSupportContext | null => {
  if (!value || typeof value !== 'object') return null;
  const detail = value as { orderNo?: unknown; email?: unknown; guestOrderNo?: unknown; guestEmail?: unknown };
  const orderNo = cleanText(detail.guestOrderNo || detail.orderNo, 100);
  const email = cleanText(detail.guestEmail || detail.email, 180).toLowerCase();
  return orderNo && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? { orderNo, email } : null;
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
    if (!normalized || !parsed?.savedAt || Date.now() - Number(parsed.savedAt) > GUEST_SUPPORT_CONTEXT_TTL_MS) {
      removeLocalStorageItem(GUEST_SUPPORT_CONTEXT_KEY);
      return null;
    }
    return normalized;
  } catch {
    removeLocalStorageItem(GUEST_SUPPORT_CONTEXT_KEY);
    return null;
  }
};
