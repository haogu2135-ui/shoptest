import { focusFirstFormError } from '../utils/formValidationFocus';
import {
  STRONG_PASSWORD_MAX_LENGTH,
  STRONG_PASSWORD_MIN_LENGTH,
  hasRequiredPasswordClasses,
  isCommonPassword,
} from '../utils/passwordPolicy';

export type ForgotPasswordTranslate = (key: string, params?: Record<string, string | number>) => string;

export interface ForgotPasswordForm {
  login: string;
  email: string;
  code: string;
  newPassword: string;
  confirmPassword: string;
}

export type AuthApiErrorData = {
  code?: unknown;
  retryAfterSeconds?: unknown;
  resendIntervalSeconds?: unknown;
};

export type AuthApiErrorLike = {
  response?: {
    data?: AuthApiErrorData;
  };
};

export const normalizeEmail = (value: unknown) => String(value || '').trim().toLowerCase();
export const normalizeEmailCode = (value: unknown) => String(value || '').replace(/\D+/g, '').slice(0, 6);
export const normalizePasswordLogin = (value: unknown) => {
  const text = Array.from(String(value || ''))
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code > 31 && code !== 127;
    })
    .join('')
    .trim();
  if (text.includes('@')) return text.toLowerCase();
  return text;
};

export const maskEmail = (value: unknown) => {
  const email = normalizeEmail(value);
  const [name, domain] = email.split('@');
  if (!name || !domain) return email;
  return `${name.charAt(0)}***@${domain}`;
};

export const asAuthApiError = (error: unknown): AuthApiErrorLike => (
  error && typeof error === 'object' ? error as AuthApiErrorLike : {}
);
export const authApiErrorData = (error: unknown) => asAuthApiError(error).response?.data || {};
export const authApiErrorCode = (error: unknown) => String(authApiErrorData(error).code || '').toUpperCase();
export const isFormValidationError = (error: unknown): error is { errorFields: unknown[] } => (
  Boolean(error) && typeof error === 'object' && Array.isArray((error as { errorFields?: unknown }).errorFields)
);

export const scrollFirstForgotPasswordErrorIntoView = () => {
  focusFirstFormError({
    rootSelector: '.shopee-login-card, .shopee-login-root, .forgot-password-page',
    scrollOffset: 120,
  });
};

export const getForgotPasswordRetryAfterSeconds = (error: unknown, fallback = 0) => {
  const data = authApiErrorData(error);
  const retryAfterSeconds = Number(data.retryAfterSeconds);
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return Math.ceil(retryAfterSeconds);
  }
  const resendIntervalSeconds = Number(data.resendIntervalSeconds);
  if (Number.isFinite(resendIntervalSeconds) && resendIntervalSeconds > 0) {
    return Math.ceil(resendIntervalSeconds);
  }
  return fallback;
};

export const createForgotPasswordStrongPasswordValidator = (t: ForgotPasswordTranslate) => (
  _rule: unknown,
  value?: string,
) => {
  if (!value) return Promise.resolve();
  if (isCommonPassword(value)) {
    return Promise.reject(new Error(t('pages.auth.passwordCommon')));
  }
  if (!hasRequiredPasswordClasses(value)) {
    return Promise.reject(new Error(t('pages.auth.passwordPattern')));
  }
  return Promise.resolve();
};

/** Build a11y / CTA labels for ForgotPassword residual modularization. */
export const buildForgotPasswordActionLabels = (params: {
  t: ForgotPasswordTranslate;
  codeSending: boolean;
  sendCodeCountdown: number;
}) => {
  const { t, codeSending, sendCodeCountdown } = params;
  const resetPageLabel = t('pages.auth.resetPasswordTitle');
  const resetLoginInputLabel = `${resetPageLabel}: ${t('pages.auth.username')}`;
  const resetEmailInputLabel = `${resetPageLabel}: ${t('pages.auth.email')}`;
  const resetCodeInputLabel = `${resetPageLabel}: ${t('pages.auth.verificationCode')}`;
  const resetCodeActionText = codeSending
    ? t('pages.auth.emailCodeSending')
    : sendCodeCountdown > 0
      ? t('pages.auth.resendIn', { seconds: sendCodeCountdown })
      : t('pages.auth.sendCode');
  const resetSendCodeActionLabel = `${resetPageLabel}: ${resetCodeActionText}`;
  const resetNewPasswordInputLabel = `${resetPageLabel}: ${t('pages.auth.newPassword')}`;
  const resetConfirmPasswordInputLabel = `${resetPageLabel}: ${t('pages.auth.confirmPassword')}`;
  const passwordVisibilityActionLabel = (visible: boolean) => (
    `${resetNewPasswordInputLabel}: ${visible ? t('pages.auth.hidePassword') : t('pages.auth.showPassword')}`
  );
  const confirmPasswordVisibilityActionLabel = (visible: boolean) => (
    `${resetConfirmPasswordInputLabel}: ${visible ? t('pages.auth.hidePassword') : t('pages.auth.showPassword')}`
  );
  const resetSubmitActionLabel = `${resetPageLabel}: ${t('pages.auth.resetPassword')}`;

  return {
    resetPageLabel,
    resetLoginInputLabel,
    resetEmailInputLabel,
    resetCodeInputLabel,
    resetCodeActionText,
    resetSendCodeActionLabel,
    resetNewPasswordInputLabel,
    resetConfirmPasswordInputLabel,
    passwordVisibilityActionLabel,
    confirmPasswordVisibilityActionLabel,
    resetSubmitActionLabel,
  };
};

/** Assemble ForgotPassword panel prop bag in one pure surface for residual modularization. */
export const buildForgotPasswordPanelProps = <T extends Record<string, unknown>>(props: T): T => props;

export {
  STRONG_PASSWORD_MAX_LENGTH,
  STRONG_PASSWORD_MIN_LENGTH,
};
