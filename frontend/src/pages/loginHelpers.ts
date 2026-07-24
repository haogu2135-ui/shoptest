import type { Language } from '../i18n';
import { getSessionStorageItem } from '../utils/safeStorage';
import { focusFirstFormError } from '../utils/formValidationFocus';
import { getApiErrorMessage } from '../utils/apiError';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import { persistAuthSession } from '../api';

export type TranslationFunction = (key: string, params?: Record<string, string | number>) => string;
export type PasswordLoginValues = {
  username?: unknown;
  password?: string;
};
export type EmailLoginValues = {
  email?: unknown;
  code?: unknown;
};
export type LoginSessionResponse = Parameters<typeof persistAuthSession>[0] & {
  id?: unknown;
};
export type LoginApiResponse = {
  data: LoginSessionResponse;
};
export type ApiErrorPayload = {
  code?: unknown;
  error?: unknown;
  message?: unknown;
  retryAfterSeconds?: unknown;
  resendIntervalSeconds?: unknown;
};
export type ApiErrorLike = {
  response?: {
    status?: unknown;
    data?: ApiErrorPayload;
  };
  errorFields?: unknown;
};

export const stripControlChars = (value: unknown) => Array.from(String(value || ''), (char) => {
  const code = char.charCodeAt(0);
  return code <= 31 || code === 127 ? ' ' : char;
}).join('');
export const normalizeEmail = (value: unknown) => stripControlChars(value).trim().toLowerCase();
export const normalizeEmailCode = (value: unknown) => String(value || '').replace(/\D+/g, '').slice(0, 6);
export const normalizePasswordLogin = (value: unknown) => {
  const login = stripControlChars(value).replace(/\s+/g, ' ').trim();
  if (login.includes('@')) return login.toLowerCase();
  const compactLogin = login.replace(/\s+/g, '');
  const digitCount = (compactLogin.match(/\d/g) || []).length;
  if (digitCount >= 8 && /^[+\d().\-\s]+$/.test(login)) {
    return compactLogin.startsWith('+') ? `+${compactLogin.slice(1).replace(/\D+/g, '')}` : compactLogin.replace(/\D+/g, '');
  }
  return compactLogin;
};
export const readLoginCandidates = (primary: string) => {
  const candidates = [primary];
  try {
    const parsed = JSON.parse(getSessionStorageItem('loginCandidates') || '[]');
    if (Array.isArray(parsed)) {
      const storedCandidates = parsed.map((value) => normalizePasswordLogin(value)).filter(Boolean);
      if (!storedCandidates.includes(primary)) {
        return candidates;
      }
      storedCandidates.forEach((value) => candidates.push(value));
    }
  } catch (error) {
    reportNonBlockingError('Login.readLoginCandidates', error);
  }
  return Array.from(new Set(candidates.filter(Boolean)));
};
export const maskEmail = (value: unknown) => {
  const email = normalizeEmail(value);
  const [name, domain] = email.split('@');
  if (!name || !domain) return email;
  return `${name.charAt(0)}***@${domain}`;
};

export const asApiError = (error: unknown): ApiErrorLike => (
  error && typeof error === 'object' ? error as ApiErrorLike : {}
);

export const apiErrorData = (error: unknown): ApiErrorPayload => asApiError(error).response?.data || {};

export const apiErrorCode = (error: unknown) => String(apiErrorData(error).code || '').toUpperCase();

export type AuthRecoveryKind = 'rate_limited' | 'locked' | 'unavailable' | null;

export type PasswordLoginErrorResolution = {
  message: string;
  recoveryKind: AuthRecoveryKind;
};

export const resolvePasswordLoginError = (
  error: unknown,
  fallback: string,
  t: TranslationFunction,
  language: Language,
): PasswordLoginErrorResolution => {
  const apiError = asApiError(error);
  const data = apiErrorData(error);
  const status = Number(apiError.response?.status);
  const serverMessage = String(data.error || data.message || '').toLowerCase();
  if (status === 429 || serverMessage.includes('too many') || serverMessage.includes('rate limited')) {
    return { message: t('pages.auth.loginRateLimited'), recoveryKind: 'rate_limited' };
  }
  if (status === 503 || serverMessage.includes('temporarily unavailable') || serverMessage.includes('service unavailable')) {
    return { message: t('pages.auth.loginServiceUnavailable'), recoveryKind: 'unavailable' };
  }
  if (serverMessage.includes('locked')) {
    return { message: t('pages.auth.loginLocked'), recoveryKind: 'locked' };
  }
  return { message: getApiErrorMessage(error, fallback, language), recoveryKind: null };
};

export const resolveEmailLoginRecoveryKind = (error: unknown): AuthRecoveryKind => {
  const apiError = asApiError(error);
  const status = Number(apiError.response?.status);
  const code = String(apiErrorData(error).code || '').toUpperCase();
  if (status === 429 || code === 'RATE_LIMITED' || code === 'TOO_MANY_ATTEMPTS') {
    return 'rate_limited';
  }
  if (status === 503) {
    return 'unavailable';
  }
  return null;
};

export const authRecoveryNextKey = (kind: Exclude<AuthRecoveryKind, null>) => {
  if (kind === 'locked') return 'pages.auth.loginRecoveryNextLocked';
  if (kind === 'unavailable') return 'pages.auth.loginRecoveryNextUnavailable';
  return 'pages.auth.loginRecoveryNextRateLimited';
};

export const shouldTryNextLoginCandidate = (error: unknown) => {
  const apiError = asApiError(error);
  const data = apiErrorData(error);
  const status = Number(apiError.response?.status);
  const code = String(data.code || '').toUpperCase();
  const serverMessage = String(data.error || data.message || '').toLowerCase();
  if ([400, 401, 404].includes(status)) return true;
  return code.includes('INVALID') || code.includes('NOT_FOUND') || serverMessage.includes('invalid') || serverMessage.includes('not found');
};

export const scrollFirstLoginErrorIntoView = () => {
  focusFirstFormError({
    rootSelector: '.shopee-login-card, .shopee-login-root',
    scrollOffset: 120,
  });
};
