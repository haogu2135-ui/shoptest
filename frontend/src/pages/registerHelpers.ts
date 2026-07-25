import { focusFirstFormError } from '../utils/formValidationFocus';
import {
  STRONG_PASSWORD_MAX_LENGTH,
  STRONG_PASSWORD_MIN_LENGTH,
  hasRequiredPasswordClasses,
  isCommonPassword,
} from '../utils/passwordPolicy';

export type RegisterTranslate = (key: string, params?: Record<string, string | number>) => string;

export interface RegisterForm {
  username: string;
  password: string;
  confirmPassword: string;
  email: string;
  phone: string;
  emailCode?: string;
}

export type RegisterApiErrorData = {
  code?: unknown;
  error?: unknown;
  message?: unknown;
  emailCodeRequired?: unknown;
  retryAfterSeconds?: unknown;
  resendIntervalSeconds?: unknown;
};

export type RegisterApiErrorLike = {
  response?: {
    status?: unknown;
    data?: RegisterApiErrorData;
  };
};

export type RegisterRecoveryKind = 'rate_limited' | null;

export const phonePattern = /^(?=(?:.*\d){8,20})(\+?[\d\s().-]{8,32})$/;

export const stripControlChars = (value: unknown) => Array.from(String(value || ''), (char) => {
  const code = char.charCodeAt(0);
  return code <= 31 || code === 127 ? ' ' : char;
}).join('');

export const normalizeUsername = (value: unknown) => stripControlChars(value).replace(/\s+/g, '').trim();
export const normalizeEmail = (value: unknown) => stripControlChars(value).trim().toLowerCase();
export const normalizePhone = (value: unknown) => {
  const normalized = stripControlChars(value).trim();
  return normalized.startsWith('+') ? `+${normalized.slice(1).replace(/\D+/g, '')}` : normalized.replace(/\D+/g, '');
};
export const normalizeLikelyPhone = (value: unknown) => (
  phonePattern.test(stripControlChars(value).trim()) ? normalizePhone(value) : stripControlChars(value).trim()
);
export const normalizeEmailCode = (value: unknown) => String(value || '').replace(/\D+/g, '').slice(0, 6);

export const maskEmail = (value: unknown) => {
  const email = normalizeEmail(value);
  const [name, domain] = email.split('@');
  if (!name || !domain) return email;
  return `${name.charAt(0)}***@${domain}`;
};

export const uniqueLoginCandidates = (...values: unknown[]) => Array.from(new Set(
  values
    .map((value) => String(value || '').trim())
    .filter(Boolean),
));

export const asRegisterApiError = (error: unknown): RegisterApiErrorLike => (
  error && typeof error === 'object' ? error as RegisterApiErrorLike : {}
);
export const registerApiErrorData = (error: unknown) => asRegisterApiError(error).response?.data || {};
export const registerApiErrorCode = (error: unknown) => String(registerApiErrorData(error).code || '').toUpperCase();
export const isRegisterEmailCodeRequired = (value: unknown) => value === true || value === 'true';

export const resolveRegisterRecoveryKind = (error: unknown): RegisterRecoveryKind => {
  const status = Number(asRegisterApiError(error).response?.status);
  const code = registerApiErrorCode(error);
  if (status === 429 || code === 'RATE_LIMITED' || code === 'TOO_MANY_ATTEMPTS') {
    return 'rate_limited';
  }
  const message = String(registerApiErrorData(error).error || registerApiErrorData(error).message || '').toLowerCase();
  if (message.includes('too many') || message.includes('rate limited')) {
    return 'rate_limited';
  }
  return null;
};

export const isFormValidationError = (error: unknown): error is { errorFields: unknown[] } => (
  Boolean(error) && typeof error === 'object' && Array.isArray((error as { errorFields?: unknown }).errorFields)
);

export const scrollFirstRegisterErrorIntoView = () => {
  focusFirstFormError({
    rootSelector: '.register-page__card',
    scrollOffset: 176,
    scrollContainerSelector: '.register-page__card',
  });
};

export const getRegisterRetryAfterSeconds = (error: unknown, fallback = 0) => {
  const data = registerApiErrorData(error);
  const retryAfterSeconds = Number(data.retryAfterSeconds);
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) return Math.ceil(retryAfterSeconds);
  const resendIntervalSeconds = Number(data.resendIntervalSeconds);
  if (Number.isFinite(resendIntervalSeconds) && resendIntervalSeconds > 0) return Math.ceil(resendIntervalSeconds);
  return fallback;
};

export const createRegisterStrongPasswordValidator = (t: RegisterTranslate) => (_rule: unknown, value?: string) => {
  if (!value) return Promise.resolve();
  if (isCommonPassword(value)) {
    return Promise.reject(new Error(t('pages.auth.passwordCommon')));
  }
  if (!hasRequiredPasswordClasses(value)) {
    return Promise.reject(new Error(t('pages.auth.passwordPattern')));
  }
  return Promise.resolve();
};

/** Build a11y / CTA labels for Register residual modularization. */
export const buildRegisterActionLabels = (params: {
  t: RegisterTranslate;
  codeSending: boolean;
  sendCodeCountdown: number;
}) => {
  const { t, codeSending, sendCodeCountdown } = params;
  const registerPageLabel = t('pages.auth.registerTitle');
  const registerLoginActionLabel = `${t('pages.auth.loginNow')}: ${registerPageLabel}`;
  const registerTrackOrderActionLabel = `${t('nav.trackOrder')}: ${registerPageLabel}`;
  const usernameInputLabel = `${registerPageLabel}: ${t('pages.auth.usernameShort')}`;
  const passwordInputLabel = `${registerPageLabel}: ${t('pages.auth.password')}`;
  const confirmPasswordInputLabel = `${registerPageLabel}: ${t('pages.auth.confirmPassword')}`;
  const passwordVisibilityActionLabel = (visible: boolean) => (
    `${passwordInputLabel}: ${visible ? t('pages.auth.hidePassword') : t('pages.auth.showPassword')}`
  );
  const confirmPasswordVisibilityActionLabel = (visible: boolean) => (
    `${confirmPasswordInputLabel}: ${visible ? t('pages.auth.hidePassword') : t('pages.auth.showPassword')}`
  );
  const emailInputLabel = `${registerPageLabel}: ${t('pages.auth.email')}`;
  const emailCodeInputLabel = `${registerPageLabel}: ${t('pages.auth.verificationCode')}`;
  const phoneInputLabel = `${registerPageLabel}: ${t('pages.auth.phone')}`;
  const registerCodeActionText = codeSending
    ? t('pages.auth.emailCodeSending')
    : sendCodeCountdown > 0
      ? t('pages.auth.resendIn', { seconds: sendCodeCountdown })
      : t('pages.auth.sendCode');
  const registerSendCodeActionLabel = `${registerPageLabel}: ${registerCodeActionText}`;
  const registerSubmitActionLabel = `${registerPageLabel}: ${t('pages.auth.register')}`;

  return {
    registerPageLabel,
    registerLoginActionLabel,
    registerTrackOrderActionLabel,
    usernameInputLabel,
    passwordInputLabel,
    confirmPasswordInputLabel,
    passwordVisibilityActionLabel,
    confirmPasswordVisibilityActionLabel,
    emailInputLabel,
    emailCodeInputLabel,
    phoneInputLabel,
    registerCodeActionText,
    registerSendCodeActionLabel,
    registerSubmitActionLabel,
  };
};

/** Assemble Register panel prop bag in one pure surface for residual modularization. */
export const buildRegisterPanelProps = <T extends Record<string, unknown>>(props: T): T => props;

// Re-export password policy constants for page form rules that still need min/max lengths.
export {
  STRONG_PASSWORD_MAX_LENGTH,
  STRONG_PASSWORD_MIN_LENGTH,
};
