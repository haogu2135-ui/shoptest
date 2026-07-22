import React, { useEffect, useMemo, useRef, useState } from 'react';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { ShopIcon, SI } from '../components/ShopIcon';
import { Alert, Form, Button } from 'antd';
import ShopInput, { ShopPasswordInput } from '../components/ShopInput';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cartApi, clearStoredAuthCredentials, persistAuthSession, userApi } from '../api';
import { useAppConfig } from '../hooks/useAppConfig';
import { useLanguage } from '../i18n';
import { usePageTitle } from '../hooks/usePageTitle';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import type { Language } from '../i18n';
import { getPostLoginRedirectTarget } from '../utils/authRedirect';
import { getGuestCartItems, replaceGuestCartItems } from '../utils/guestCart';
import { getSessionStorageItem, removeSessionStorageItem } from '../utils/safeStorage';
import { focusFirstFormError } from '../utils/formValidationFocus';
import { getApiErrorMessage } from '../utils/apiError';
import { dispatchDomEvent } from '../utils/domEvents';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import type { CartItem } from '../types';
import './Login.css';


type TranslationFunction = (key: string, params?: Record<string, string | number>) => string;
type PasswordLoginValues = {
  username?: unknown;
  password?: string;
};
type EmailLoginValues = {
  email?: unknown;
  code?: unknown;
};
type LoginSessionResponse = Parameters<typeof persistAuthSession>[0] & {
  id?: unknown;
};
type LoginApiResponse = {
  data: LoginSessionResponse;
};
type ApiErrorPayload = {
  code?: unknown;
  error?: unknown;
  message?: unknown;
  retryAfterSeconds?: unknown;
  resendIntervalSeconds?: unknown;
};
type ApiErrorLike = {
  response?: {
    status?: unknown;
    data?: ApiErrorPayload;
  };
  errorFields?: unknown;
};

const stripControlChars = (value: unknown) => Array.from(String(value || ''), (char) => {
  const code = char.charCodeAt(0);
  return code <= 31 || code === 127 ? ' ' : char;
}).join('');
const normalizeEmail = (value: unknown) => stripControlChars(value).trim().toLowerCase();
const normalizeEmailCode = (value: unknown) => String(value || '').replace(/\D+/g, '').slice(0, 6);
const normalizePasswordLogin = (value: unknown) => {
  const login = stripControlChars(value).replace(/\s+/g, ' ').trim();
  if (login.includes('@')) return login.toLowerCase();
  const compactLogin = login.replace(/\s+/g, '');
  const digitCount = (compactLogin.match(/\d/g) || []).length;
  if (digitCount >= 8 && /^[+\d().\-\s]+$/.test(login)) {
    return compactLogin.startsWith('+') ? `+${compactLogin.slice(1).replace(/\D+/g, '')}` : compactLogin.replace(/\D+/g, '');
  }
  return compactLogin;
};
const readLoginCandidates = (primary: string) => {
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
const maskEmail = (value: unknown) => {
  const email = normalizeEmail(value);
  const [name, domain] = email.split('@');
  if (!name || !domain) return email;
  return `${name.charAt(0)}***@${domain}`;
};

const asApiError = (error: unknown): ApiErrorLike => (
  error && typeof error === 'object' ? error as ApiErrorLike : {}
);

const apiErrorData = (error: unknown): ApiErrorPayload => asApiError(error).response?.data || {};

const apiErrorCode = (error: unknown) => String(apiErrorData(error).code || '').toUpperCase();

type AuthRecoveryKind = 'rate_limited' | 'locked' | 'unavailable' | null;

type PasswordLoginErrorResolution = {
  message: string;
  recoveryKind: AuthRecoveryKind;
};

const resolvePasswordLoginError = (
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

const resolveEmailLoginRecoveryKind = (error: unknown): AuthRecoveryKind => {
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

const authRecoveryNextKey = (kind: Exclude<AuthRecoveryKind, null>) => {
  if (kind === 'locked') return 'pages.auth.loginRecoveryNextLocked';
  if (kind === 'unavailable') return 'pages.auth.loginRecoveryNextUnavailable';
  return 'pages.auth.loginRecoveryNextRateLimited';
};

const shouldTryNextLoginCandidate = (error: unknown) => {
  const apiError = asApiError(error);
  const data = apiErrorData(error);
  const status = Number(apiError.response?.status);
  const code = String(data.code || '').toUpperCase();
  const serverMessage = String(data.error || data.message || '').toLowerCase();
  if ([400, 401, 404].includes(status)) return true;
  return code.includes('INVALID') || code.includes('NOT_FOUND') || serverMessage.includes('invalid') || serverMessage.includes('not found');
};


const scrollFirstLoginErrorIntoView = () => {
  focusFirstFormError({
    rootSelector: '.shopee-login-card, .shopee-login-root',
    scrollOffset: 120,
  });
};


const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [authBannerError, setAuthBannerError] = useState<string | null>(null);
  const [authRecoveryKind, setAuthRecoveryKind] = useState<AuthRecoveryKind>(null);
  const [codeSending, setCodeSending] = useState(false);
  const [sendCodeCountdown, setSendCodeCountdown] = useState(0);
  const [verifyRetryCountdown, setVerifyRetryCountdown] = useState(0);
  const [codeTtlMinutes, setCodeTtlMinutes] = useState(0);
  const [sentEmailHint, setSentEmailHint] = useState('');
  const [activeLoginTab, setActiveLoginTab] = useState('password');
  const [passwordForm] = Form.useForm();
  const [emailForm] = Form.useForm();
  const watchedEmailCode = Form.useWatch('code', emailForm);
  const codeInputRef = useRef<HTMLInputElement | null>(null);
  const passwordSubmittingRef = useRef(false);
  const emailSubmittingRef = useRef(false);
  const emailCodeSendingRef = useRef(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { t, language } = useLanguage();
  usePageTitle(t('pages.auth.login'));
  useDocumentMeta({
    title: t('pages.auth.login'),
    description: t('common.siteDescription'),
    path: '/login',
    type: 'website',
    noIndex: true,
    siteName: t('common.siteTitle'),
  });
  const { config: appConfig, loading: appConfigLoading } = useAppConfig();
  const guestCartItemsSnapshot = useMemo(() => getGuestCartItems(), []);
  const guestCartCount = guestCartItemsSnapshot.reduce((sum, item) => sum + item.quantity, 0);
  const emailCodeLength = normalizeEmailCode(watchedEmailCode).length;
  const emailCodeEnabled = appConfig.emailCodeEnabled === true;
  const canSubmitEmailCode = emailCodeEnabled && emailCodeLength === 6 && verifyRetryCountdown <= 0;
  const postLoginRedirectTarget = getPostLoginRedirectTarget(location.search);
  const loginPageLabel = t('pages.auth.loginTitle');
  const loginRegisterActionLabel = `${t('pages.auth.register')}: ${loginPageLabel}`;
  const loginTrackOrderActionLabel = `${t('nav.trackOrder')}: ${loginPageLabel}`;
  const loginSupportActionLabel = `${t('nav.help')}: ${t('pages.auth.mobileQuickActions')}`;
  const passwordLoginActionLabel = `${t('pages.auth.passwordLogin')}: ${loginPageLabel}`;
  const emailLoginActionLabel = `${t('pages.auth.emailLogin')}: ${loginPageLabel}`;
  const passwordLoginUsernameInputLabel = `${passwordLoginActionLabel}: ${t('pages.auth.username')}`;
  const passwordLoginPasswordInputLabel = `${passwordLoginActionLabel}: ${t('pages.auth.password')}`;
  const passwordVisibilityActionLabel = (visible: boolean) => `${passwordLoginPasswordInputLabel}: ${visible ? t('pages.auth.hidePassword') : t('pages.auth.showPassword')}`;
  const emailLoginEmailInputLabel = `${emailLoginActionLabel}: ${t('pages.auth.email')}`;
  const emailLoginCodeInputLabel = `${emailLoginActionLabel}: ${t('pages.auth.verificationCode')}`;
  const sendEmailCodeActionLabel = codeSending
    ? `${emailLoginActionLabel}: ${t('pages.auth.emailCodeSending')}`
    : sendCodeCountdown > 0
    ? `${emailLoginActionLabel}: ${t('pages.auth.resendIn', { seconds: sendCodeCountdown })}`
    : `${emailLoginActionLabel}: ${t('pages.auth.sendCode')}`;

  useEffect(() => {
    clearStoredAuthCredentials();
  }, []);

  useEffect(() => {
    const prefill = normalizePasswordLogin(getSessionStorageItem('loginPrefill'));
    if (!prefill) return;
    setActiveLoginTab('password');
    passwordForm.setFieldValue('username', prefill);
    removeSessionStorageItem('loginPrefill');
  }, [passwordForm]);

  useEffect(() => {
    if (sendCodeCountdown <= 0) return;
    const timer = window.setInterval(() => {
      setSendCodeCountdown((value) => Math.max(value - 1, 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [sendCodeCountdown]);

  useEffect(() => {
    if (verifyRetryCountdown <= 0) return;
    const timer = window.setInterval(() => {
      setVerifyRetryCountdown((value) => Math.max(value - 1, 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [verifyRetryCountdown]);

  const getRetryAfterSeconds = (error: unknown, fallback = 0) => {
    const data = apiErrorData(error);
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

  const mergeGuestCart = async (userId: number, guestItems: CartItem[]) => {
    if (guestItems.length === 0) return;

    const mergeResults = await Promise.all(guestItems.map(async (item) => {
      try {
        await cartApi.addItem(userId, item.productId, item.quantity, item.selectedSpecs);
        return { item, mergedQuantity: item.quantity, failed: false };
      } catch (error) {
        reportNonBlockingError('Login.mergeGuestCartItem', error);
        return { item, mergedQuantity: 0, failed: true };
      }
    }));
    const failedItems = mergeResults.filter(({ failed }) => failed).map(({ item }) => item);
    const mergedCount = mergeResults.reduce((sum, result) => sum + result.mergedQuantity, 0);
    replaceGuestCartItems(failedItems);
    if (mergedCount > 0 && failedItems.length === 0) {
      announceAccessibleMessage(t('pages.auth.cartMerged', { count: mergedCount }), 'success');
    } else if (mergedCount > 0) {
      announceAccessibleMessage(t('pages.auth.cartMergePartial', { count: mergedCount }), 'warning');
    }
  };

  const completeLogin = async (responseData: LoginSessionResponse) => {
    setAuthBannerError(null);
    setAuthRecoveryKind(null);
    const { id } = responseData || {};
    if (!id) {
      throw new Error(t('pages.auth.loginFailed'));
    }
    const token = persistAuthSession(responseData);
    if (!token) {
      throw new Error(t('pages.auth.loginFailed'));
    }
    await mergeGuestCart(Number(id), guestCartItemsSnapshot);
    announceAccessibleMessage(t('pages.auth.loginSuccess'), 'success');
    navigate(postLoginRedirectTarget, { replace: true });
  };

  const onFinish = async (values: PasswordLoginValues) => {
    if (passwordSubmittingRef.current) return;
    passwordSubmittingRef.current = true;
    clearStoredAuthCredentials();
    const normalizedLogin = normalizePasswordLogin(values.username);
    passwordForm.setFieldValue('username', normalizedLogin);
    setLoading(true);
    setAuthBannerError(null);
    setAuthRecoveryKind(null);
    passwordForm.setFields([
      { name: 'username', errors: [] },
      { name: 'password', errors: [] },
    ]);
    let lastError: unknown = null;
    try {
      const loginCandidates = readLoginCandidates(normalizedLogin);
      let response: LoginApiResponse | null = null;
      for (const candidate of loginCandidates) {
        try {
          response = await userApi.login(candidate, String(values.password || '')) as LoginApiResponse;
          if (candidate !== normalizedLogin) {
            passwordForm.setFieldValue('username', candidate);
          }
          removeSessionStorageItem('loginCandidates');
          break;
        } catch (candidateError: unknown) {
          lastError = candidateError;
          if (!shouldTryNextLoginCandidate(candidateError)) {
            break;
          }
        }
      }
      if (!response) {
        throw lastError || new Error(t('pages.auth.loginFailed'));
      }
      await completeLogin(response.data);
    } catch (error: unknown) {
      const loginError = resolvePasswordLoginError(error, t('pages.auth.loginFailed'), t, language);
      passwordForm.setFields([
        { name: 'username', errors: [loginError.message] },
        { name: 'password', errors: [loginError.message] },
      ]);
      setAuthBannerError(loginError.message);
      setAuthRecoveryKind(loginError.recoveryKind);
      announceAccessibleMessage(loginError.message, 'error');
    } finally {
      passwordSubmittingRef.current = false;
      setLoading(false);
    }
  };

  const sendEmailCode = async () => {
    if (emailCodeSendingRef.current) return;
    emailCodeSendingRef.current = true;
    clearStoredAuthCredentials();
    try {
      if (!emailCodeEnabled) {
        announceAccessibleMessage(t('pages.auth.emailCodeUnavailable'), 'warning');
        return;
      }
      const { email } = await emailForm.validateFields(['email']);
      const normalizedEmail = normalizeEmail(email);
      emailForm.setFieldValue('email', normalizedEmail);
      setCodeSending(true);
      const response = await userApi.sendEmailLoginCode(normalizedEmail);
      const resendIntervalSeconds = Number(response.data?.resendIntervalSeconds);
      const ttlMinutes = Number(response.data?.codeTtlMinutes);
      setSendCodeCountdown(Number.isFinite(resendIntervalSeconds) && resendIntervalSeconds > 0 ? resendIntervalSeconds : 60);
      setCodeTtlMinutes(Number.isFinite(ttlMinutes) && ttlMinutes > 0 ? ttlMinutes : 0);
      emailForm.setFieldValue('code', '');
      emailForm.setFields([{ name: 'code', errors: [] }]);
      setVerifyRetryCountdown(0);
      setSentEmailHint(maskEmail(normalizedEmail));
      window.setTimeout(() => codeInputRef.current?.focus?.(), 0);
      announceAccessibleMessage(t('pages.auth.emailCodeSentTo', { email: maskEmail(normalizedEmail) }), 'success');
    } catch (error: unknown) {
      if (!asApiError(error).errorFields) {
        const errorCode = apiErrorCode(error);
        if (errorCode === 'RATE_LIMITED') {
          setSendCodeCountdown(getRetryAfterSeconds(error, 60));
        }
        const errorMessage = errorCode === 'RATE_LIMITED'
          ? t('pages.auth.emailCodeRateLimited')
          : t('pages.auth.emailCodeSendFailed');
        setAuthBannerError(errorMessage);
        setAuthRecoveryKind(errorCode === 'RATE_LIMITED' ? 'rate_limited' : null);
        announceAccessibleMessage(errorMessage, 'error');
      }
    } finally {
      emailCodeSendingRef.current = false;
      setCodeSending(false);
    }
  };

  const onEmailLogin = async (values: EmailLoginValues) => {
    if (emailSubmittingRef.current) return;
    clearStoredAuthCredentials();
    const normalizedCode = normalizeEmailCode(values.code);
    if (normalizedCode.length !== 6) {
      emailForm.setFields([{ name: 'code', errors: [t('pages.auth.emailCodeLength')] }]);
      return;
    }
    emailSubmittingRef.current = true;
    setLoading(true);
    setAuthBannerError(null);
    setAuthRecoveryKind(null);
    try {
      const normalizedEmail = normalizeEmail(values.email);
      emailForm.setFieldsValue({ email: normalizedEmail, code: normalizedCode });
      const response = await userApi.emailLogin(normalizedEmail, normalizedCode) as LoginApiResponse;
      await completeLogin(response.data);
    } catch (error: unknown) {
      const errorCode = apiErrorCode(error);
      const recoveryKind = resolveEmailLoginRecoveryKind(error);
      if (errorCode === 'TOO_MANY_ATTEMPTS') {
        const retryAfterSeconds = getRetryAfterSeconds(error, 60);
        setVerifyRetryCountdown(retryAfterSeconds);
        const errorMessage = t('pages.auth.emailCodeTooManyAttempts');
        emailForm.setFields([{ name: 'code', errors: [errorMessage] }]);
        setAuthBannerError(errorMessage);
        setAuthRecoveryKind(recoveryKind || 'rate_limited');
        announceAccessibleMessage(errorMessage, 'error');
      } else if (errorCode === 'INVALID_CODE') {
        const errorMessage = t('pages.auth.emailCodeInvalid');
        emailForm.setFields([{ name: 'code', errors: [errorMessage] }]);
        setAuthBannerError(errorMessage);
        setAuthRecoveryKind(null);
        announceAccessibleMessage(errorMessage, 'error');
      } else {
        const errorMessage = getApiErrorMessage(error, t('pages.auth.emailLoginFailed'), language);
        emailForm.setFields([{ name: 'code', errors: [errorMessage] }]);
        setAuthBannerError(errorMessage);
        setAuthRecoveryKind(recoveryKind);
        announceAccessibleMessage(errorMessage, 'error');
      }
    } finally {
      emailSubmittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <main className="shopee-login-root">
      <section className="shopee-login-shell">
        <aside className="shopee-login-panel">
          <p className="shopee-login-panel__eyebrow">{t('pages.auth.loginTrustTitle')}</p>
          <h1 className="shopee-login-panel__title">{t('pages.auth.loginTitle')}</h1>
          <p className="shopee-login-panel__subtitle">
            {guestCartCount > 0
              ? t('pages.auth.loginGuestCartHint', { count: guestCartCount })
              : t('pages.auth.loginHeroSubtitle')}
          </p>
          <div className="shopee-login-panel__featureList" aria-label={t('pages.auth.loginTrustTitle')}>
            <div className="shopee-login-panel__feature">
              <ShopIcon path={SI.cart} />
              <span>{t('pages.auth.loginTrustCart')}</span>
            </div>
            <div className="shopee-login-panel__feature">
              <ShopIcon path={SI.truck} />
              <span>{t('pages.auth.loginTrustTracking')}</span>
            </div>
            <div className="shopee-login-panel__feature">
              <ShopIcon path={SI.safety} />
              <span>{t('pages.auth.loginTrustSecure')}</span>
            </div>
          </div>
          <div className="shopee-login-panel__spotlight">
            <div className="shopee-login-panel__spotlightCard">
              <strong>{guestCartCount}</strong>
              <span>{t('pages.auth.loginTrustCart')}</span>
            </div>
            <div className="shopee-login-panel__spotlightCard">
              <strong>{t('pages.auth.loginStatTrackingValue')}</strong>
              <span>{t('nav.trackOrder')}</span>
            </div>
            <div className="shopee-login-panel__spotlightCard">
              <strong>{t('pages.auth.loginStatSecureValue')}</strong>
              <span>{t('pages.auth.loginTrustSecure')}</span>
            </div>
          </div>
          <div className="shopee-login-panel__actions">
            <Button type="primary" size="large" aria-label={loginRegisterActionLabel} title={loginRegisterActionLabel} onClick={() => navigate('/register')}>
              {t('pages.auth.register')}
            </Button>
            <Button ghost size="large" aria-label={loginTrackOrderActionLabel} title={loginTrackOrderActionLabel} onClick={() => navigate('/track-order')}>
              {t('nav.trackOrder')}
            </Button>
          </div>
        </aside>

        <section className="shopee-login-card">
          <div className="shopee-login-appHeader" aria-label={t('pages.auth.mobileLoginTitle')}>
            <span className="shopee-login-appHeader__icon">
              <ShopIcon path={SI.phone} />
            </span>
            <span className="shopee-login-appHeader__copy">
              <strong>{t('pages.auth.mobileAppLabel')}</strong>
              <span>{t('pages.auth.mobileLoginTitle')}</span>
            </span>
            <span className="shopee-login-appHeader__status">
              <ShopIcon path={SI.safety} />
              {t('pages.auth.mobileSecure')}
            </span>
          </div>
          <div className="shopee-login-appActions" aria-label={t('pages.auth.mobileQuickActions')}>
            <button type="button" aria-label={loginTrackOrderActionLabel} title={loginTrackOrderActionLabel} onClick={() => navigate('/track-order')}>
              <ShopIcon path={SI.truck} />
              <span>{t('nav.trackOrder')}</span>
            </button>
            <button type="button" aria-label={loginSupportActionLabel} title={loginSupportActionLabel} onClick={() => dispatchDomEvent('shop:open-support')}>
              <ShopIcon path={SI.support} />
              <span>{t('nav.help')}</span>
            </button>
          </div>
          <div className="shopee-login-card__header">
            <div className="shopee-login-brand">
              <div className="shopee-login-mark">{t('common.brand')}</div>
              <div className="shopee-login-subtitle">{t('pages.auth.loginTitle')}</div>
            </div>
            <p className="shopee-login-card__intro">
              {guestCartCount > 0
                ? t('pages.auth.loginGuestCartHint', { count: guestCartCount })
                : t('pages.auth.loginHeroSubtitle')}
            </p>
          </div>
          <div className="shopee-login-card__stats" aria-label={t('pages.auth.loginTrustTitle')}>
            <div className="shopee-login-card__stat">
              <strong>{guestCartCount}</strong>
              <span>{t('pages.auth.loginTrustCart')}</span>
            </div>
            <div className="shopee-login-card__stat">
              <strong>{t('pages.auth.loginStatTrackingValue')}</strong>
              <span>{t('pages.auth.loginTrustTracking')}</span>
            </div>
            <div className="shopee-login-card__stat">
              <strong>{t('pages.auth.loginStatSecureValue')}</strong>
              <span>{t('pages.auth.loginTrustSecure')}</span>
            </div>
          </div>
          <div className="shopee-login-trust" aria-label={t('pages.auth.loginTrustTitle')}>
            <div className="shopee-login-trust__item">
              <ShopIcon path={SI.cart} />
              <span>{t('pages.auth.loginTrustCart')}</span>
            </div>
            <div className="shopee-login-trust__item">
              <ShopIcon path={SI.truck} />
              <span>{t('pages.auth.loginTrustTracking')}</span>
            </div>
            <div className="shopee-login-trust__item">
              <ShopIcon path={SI.safety} />
              <span>{t('pages.auth.loginTrustSecure')}</span>
            </div>
          </div>


          {authBannerError ? (
            <div
              className="shopee-login-errorRecovery"
              data-login-error-recovery="true"
              data-login-error-kind={authRecoveryKind || 'generic'}
            >
              <Alert
                className="shopee-login-errorBanner"
                type="error"
                showIcon
                closable
                role="alert"
                message={authBannerError}
                description={authRecoveryKind ? t(authRecoveryNextKey(authRecoveryKind)) : undefined}
                onClose={() => {
                  setAuthBannerError(null);
                  setAuthRecoveryKind(null);
                }}
              />
              {authRecoveryKind ? (
                <div className="shopee-login-errorRecovery__actions" data-login-recovery-actions="true">
                  <Button
                    type="primary"
                    block
                    size="large"
                    onClick={() => navigate('/forgot-password')}
                    aria-label={t('pages.auth.forgotPassword')}
                    title={t('pages.auth.forgotPassword')}
                  >
                    {t('pages.auth.forgotPassword')}
                  </Button>
                  <Button
                    block
                    size="large"
                    onClick={() => navigate('/track-order')}
                    aria-label={t('nav.trackOrder')}
                    title={t('nav.trackOrder')}
                  >
                    {t('nav.trackOrder')}
                  </Button>
                  <Button
                    block
                    size="large"
                    onClick={() => dispatchDomEvent('shop:open-support')}
                    aria-label={t('nav.support')}
                    title={t('nav.support')}
                  >
                    {t('nav.support')}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
          <div className={`shopee-login-tabs shopee-login-tabs--${activeLoginTab}`}>
            <div
              className="shopee-login-tabs__nav"
              role="tablist"
              aria-label={t('pages.auth.login')}
            >
              <button
                type="button"
                role="tab"
                id="login-tab-password"
                className={`shopee-login-tabs__tab${activeLoginTab === 'password' ? ' shopee-login-tabs__tab--active' : ''}`}
                aria-selected={activeLoginTab === 'password'}
                aria-controls="login-panel-password"
                tabIndex={activeLoginTab === 'password' ? 0 : -1}
                onClick={() => {
                  setAuthBannerError(null);
                  setAuthRecoveryKind(null);
                  setActiveLoginTab('password');
                }}
              >
                <span className="shopee-login-tabs__tabLabel">{t('pages.auth.passwordLogin')}</span>
              </button>
              <button
                type="button"
                role="tab"
                id="login-tab-email"
                className={`shopee-login-tabs__tab${activeLoginTab === 'email' ? ' shopee-login-tabs__tab--active' : ''}`}
                aria-selected={activeLoginTab === 'email'}
                aria-controls="login-panel-email"
                tabIndex={activeLoginTab === 'email' ? 0 : -1}
                onClick={() => {
                  setAuthBannerError(null);
                  setAuthRecoveryKind(null);
                  setActiveLoginTab('email');
                }}
              >
                <span className="shopee-login-tabs__tabLabel">{t('pages.auth.emailLogin')}</span>
              </button>
            </div>
            <div
              className="shopee-login-tabs__panel"
              role="tabpanel"
              id="login-panel-password"
              aria-labelledby="login-tab-password"
              hidden={activeLoginTab !== 'password'}
            >
<Form form={passwordForm} name="login" onFinish={onFinish} onFinishFailed={() => { window.requestAnimationFrame(() => window.requestAnimationFrame(scrollFirstLoginErrorIntoView)); }} layout="vertical" className="shopee-login-form" validateTrigger={["onChange", "onBlur"]} requiredMark>
                    <Form.Item name="username" label={t('pages.auth.username')} rules={[
                      { required: true, message: t('pages.auth.usernameRequired') },
                      { min: 3, message: t('pages.auth.usernameMinLength') },
                    ]}>
                      <ShopInput
                        prefix={<ShopIcon path={SI.user} />}
                        placeholder={t('pages.auth.username')}
                        size="large"
                        autoComplete="username"
                        aria-label={passwordLoginUsernameInputLabel}
                        title={passwordLoginUsernameInputLabel}
                        onBlur={(event) => passwordForm.setFieldValue('username', normalizePasswordLogin(event.target.value))}
                      />
                    </Form.Item>
                    <Form.Item name="password" label={t('pages.auth.password')} rules={[
                      { required: true, message: t('pages.auth.passwordRequired') },
                      { min: 8, message: t('pages.auth.passwordMinLength') },
                    ]}>
                      <ShopPasswordInput
                        prefix={<ShopIcon path={SI.lock} />}
                        placeholder={t('pages.auth.password')}
                        size="large"
                        autoComplete="current-password"
                        aria-label={passwordLoginPasswordInputLabel}
                        title={passwordLoginPasswordInputLabel}
                        iconRender={(visible) => (
                          <button
                            type="button"
                            aria-label={passwordVisibilityActionLabel(visible)}
                            aria-pressed={visible}
                            title={passwordVisibilityActionLabel(visible)}
                            style={{ border: 0, padding: 0, background: 'transparent', color: 'inherit', lineHeight: 0, cursor: 'pointer' }}
                          >
                            {visible ? <ShopIcon path={SI.eye} /> : <ShopIcon path={SI.eyeOff} />}
                          </button>
                        )}
                      />
                    </Form.Item>
                    <Form.Item>
                      <Button type="primary" htmlType="submit" block size="large" loading={loading} disabled={loading} aria-label={passwordLoginActionLabel} title={passwordLoginActionLabel}>
                        {t('pages.auth.login')}
                      </Button>
                    </Form.Item>
                    <p className="shopee-login-legalNotice" role="note">
                      {t('pages.auth.loginAgreementPrefix')}{' '}
                      <Link to="/terms">{t('footer.terms')}</Link>
                      {' '}{t('pages.auth.loginAgreementAnd')}{' '}
                      <Link to="/privacy">{t('footer.privacy')}</Link>
                      {t('pages.auth.loginAgreementSuffix')}
                    </p>
                  </Form>
            </div>
            <div
              className="shopee-login-tabs__panel"
              role="tabpanel"
              id="login-panel-email"
              aria-labelledby="login-tab-email"
              hidden={activeLoginTab !== 'email'}
            >
<Form
                    form={emailForm}
                    name="email-login"
                    onFinish={onEmailLogin}
                    onFinishFailed={() => { window.requestAnimationFrame(() => window.requestAnimationFrame(scrollFirstLoginErrorIntoView)); }}
                    validateTrigger={['onChange', 'onBlur']}
                    requiredMark
                    onValuesChange={(changedValues) => {
                      if (Object.prototype.hasOwnProperty.call(changedValues, 'email')) {
                        setSentEmailHint('');
                        setSendCodeCountdown(0);
                        setVerifyRetryCountdown(0);
                        setCodeTtlMinutes(0);
                        emailForm.setFieldValue('code', '');
                      }
                    }}
                    layout="vertical"
                    className="shopee-login-form shopee-login-form--email"
                  >
                    <div className="shopee-login-emailHint">
                      <ShopIcon path={SI.mail} />
                      <span>{appConfigLoading ? t('common.loading') : t('pages.auth.emailLoginHint')}</span>
                    </div>
                    {!emailCodeEnabled && !appConfigLoading && (
                      <div className="shopee-login-emailHint shopee-login-emailHint--warning" role="status">
                        <ShopIcon path={SI.safety} />
                        <span>{t('pages.auth.emailCodeUnavailable')}</span>
                      </div>
                    )}
                    {sentEmailHint && (
                      <div className="shopee-login-emailSent" role="status">
                        <ShopIcon path={SI.safety} />
                        <span>
                          <strong>{t('pages.auth.emailCodeSentTo', { email: sentEmailHint })}</strong>
                          {codeTtlMinutes > 0 && (
                            <small>{t('pages.auth.emailCodeExpiresIn', { minutes: codeTtlMinutes })}</small>
                          )}
                        </span>
                      </div>
                    )}
                    <Form.Item
                      name="email"
                      label={t('pages.auth.email')}
                      className="shopee-login-form__field"
                      rules={[
                        { required: true, message: t('pages.auth.emailRequired') },
                        { type: 'email', message: t('pages.auth.emailInvalid') },
                      ]}
                    >
                      <ShopInput
                        prefix={<ShopIcon path={SI.mail} />}
                        placeholder={t('pages.auth.email')}
                        size="large"
                        autoComplete="email"
                        allowClear
                        disabled={loading || !emailCodeEnabled}
                        aria-label={emailLoginEmailInputLabel}
                        title={emailLoginEmailInputLabel}
                      />
                    </Form.Item>
                    <Form.Item
                      name="code"
                      label={t('pages.auth.verificationCode')}
                      className="shopee-login-form__field shopee-login-form__field--code"
                      rules={[
                        { required: true, message: t('pages.auth.emailCodeRequired') },
                        { len: 6, message: t('pages.auth.emailCodeLength') },
                      ]}
                    >
                      <ShopInput
                        ref={codeInputRef}
                        className="shopee-login-codeInput"
                        prefix={<ShopIcon path={SI.safety} />}
                        placeholder={t('pages.auth.verificationCode')}
                        size="large"
                        maxLength={6}
                        autoComplete="one-time-code"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        enterKeyHint="done"
                        disabled={loading || !emailCodeEnabled}
                        aria-label={emailLoginCodeInputLabel}
                        title={emailLoginCodeInputLabel}
                        onChange={(event) => {
                          const normalized = normalizeEmailCode(event.target.value);
                          if (normalized !== event.target.value) {
                            emailForm.setFieldValue('code', normalized);
                          }
                        }}
                        addonAfter={
                          <Button
                            type="link"
                            size="small"
                            className="shopee-login-codeButton"
                            loading={codeSending}
                            disabled={loading || codeSending || sendCodeCountdown > 0 || !emailCodeEnabled}
                            onClick={sendEmailCode}
                            aria-label={sendEmailCodeActionLabel}
                            title={sendEmailCodeActionLabel}
                          >
                            {codeSending
                              ? t('pages.auth.emailCodeSending')
                              : sendCodeCountdown > 0
                              ? t('pages.auth.resendIn', { seconds: sendCodeCountdown })
                              : t('pages.auth.sendCode')}
                          </Button>
                        }
                      />
                    </Form.Item>
                    <div className="shopee-login-codeProgress" aria-live="polite">
                      {verifyRetryCountdown > 0
                        ? t('pages.auth.emailCodeRetryIn', { seconds: verifyRetryCountdown })
                        : t('pages.auth.emailCodeProgress', { count: emailCodeLength })}
                    </div>
                    <div className="shopee-login-emailMeta" aria-label={t('pages.auth.emailLoginTrust')}>
                      <span>
                        <ShopIcon path={SI.safety} />
                        {t('pages.auth.emailCodePrivacy')}
                      </span>
                      <span>
                        <ShopIcon path={SI.mail} />
                        {t('pages.auth.emailCodeFast')}
                      </span>
                    </div>
                    <Form.Item>
                      <Button className="shopee-login-emailSubmit" type="primary" htmlType="submit" block size="large" loading={loading} disabled={loading || codeSending || !canSubmitEmailCode} aria-label={emailLoginActionLabel} title={emailLoginActionLabel}>
                        {verifyRetryCountdown > 0
                          ? t('pages.auth.emailCodeRetryIn', { seconds: verifyRetryCountdown })
                          : t('pages.auth.emailLogin')}
                      </Button>
                    </Form.Item>
                    <p className="shopee-login-legalNotice" role="note">
                      {t('pages.auth.loginAgreementPrefix')}{' '}
                      <Link to="/terms">{t('footer.terms')}</Link>
                      {' '}{t('pages.auth.loginAgreementAnd')}{' '}
                      <Link to="/privacy">{t('footer.privacy')}</Link>
                      {t('pages.auth.loginAgreementSuffix')}
                    </p>
                  </Form>
            </div>
          </div>

          <div className="shopee-login-quickLinks">
            <button type="button" aria-label={loginTrackOrderActionLabel} title={loginTrackOrderActionLabel} onClick={() => navigate('/track-order')}>
              <ShopIcon path={SI.truck} />
              <span>{t('nav.trackOrder')}</span>
            </button>
            <Link to="/register">
              <ShopIcon path={SI.compass} />
              <span>{t('pages.auth.register')}</span>
            </Link>
          </div>

          <div className="shopee-login-links">
            <Link to="/forgot-password">{t('pages.auth.forgotPassword')}</Link>
            <Link to="/register">{t('pages.auth.register')}</Link>
          </div>
        </section>
      </section>
    </main>
  );
};

export default Login;
