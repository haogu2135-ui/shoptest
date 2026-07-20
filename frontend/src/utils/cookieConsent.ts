import { getLocalStorageItem, setLocalStorageItem } from './safeStorage';

export const COOKIE_CONSENT_STORAGE_KEY = 'shopmx.cookie-consent.v1';
export const COOKIE_CONSENT_VERSION = 1;

export type CookieConsentRecord = {
  version: number;
  acceptedAt: string;
  essentialOnly: boolean;
};

export const readCookieConsent = (): CookieConsentRecord | null => {
  const raw = getLocalStorageItem(COOKIE_CONSENT_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CookieConsentRecord>;
    if (!parsed || typeof parsed !== 'object') return null;
    if (Number(parsed.version) !== COOKIE_CONSENT_VERSION) return null;
    if (!parsed.acceptedAt) return null;
    return {
      version: COOKIE_CONSENT_VERSION,
      acceptedAt: String(parsed.acceptedAt),
      essentialOnly: Boolean(parsed.essentialOnly),
    };
  } catch {
    return null;
  }
};

export const hasCookieConsent = () => Boolean(readCookieConsent());

export const acceptCookieConsent = (options?: { essentialOnly?: boolean }) => {
  const record: CookieConsentRecord = {
    version: COOKIE_CONSENT_VERSION,
    acceptedAt: new Date().toISOString(),
    essentialOnly: Boolean(options?.essentialOnly),
  };
  return setLocalStorageItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(record));
};
