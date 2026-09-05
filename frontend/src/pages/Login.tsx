import React, { useEffect, useMemo, useRef, useState } from 'react';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { Form } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { cartApi, clearStoredAuthCredentials, persistAuthSession, userApi } from '../api';
import { useAppConfig } from '../hooks/useAppConfig';
import { useLanguage } from '../i18n';
import { usePageTitle } from '../hooks/usePageTitle';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useCountdownTicker } from '../hooks/useCountdownTicker';
import { getPostLoginRedirectTarget } from '../utils/authRedirect';
import { getGuestCartItems, replaceGuestCartItems } from '../utils/guestCart';
import { getSessionStorageItem, removeSessionStorageItem } from '../utils/safeStorage';
import { getApiErrorMessage } from '../utils/apiError';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import type { CartItem } from '../types';
import {
  apiErrorCode,
  apiErrorData,
  asApiError,
  buildLoginActionLabels,
  buildLoginPanelProps,
  maskEmail,
  normalizeEmail,
  normalizeEmailCode,
  normalizePasswordLogin,
  readLoginCandidates,
  resolveEmailLoginRecoveryKind,
  resolvePasswordLoginError,
  shouldTryNextLoginCandidate,
  type AuthRecoveryKind,
  type EmailLoginValues,
  type LoginApiResponse,
  type LoginSessionResponse,
  type PasswordLoginValues,
} from './loginHelpers';
import { LoginMainPanels, type LoginPanelsProps } from './loginPanels';
import './Login.css';

export type {
  AuthRecoveryKind,
  EmailLoginValues,
  LoginApiResponse,
  LoginSessionResponse,
  PasswordLoginValues,
  TranslationFunction,
} from './loginHelpers';

export {
  apiErrorCode,
  apiErrorData,
  asApiError,
  authRecoveryNextKey,
  maskEmail,
  normalizeEmail,
  normalizeEmailCode,
  normalizePasswordLogin,
  readLoginCandidates,
  resolveEmailLoginRecoveryKind,
  resolvePasswordLoginError,
  scrollFirstLoginErrorIntoView,
  shouldTryNextLoginCandidate,
  stripControlChars,
} from './loginHelpers';

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
  const mountedRef = useRef(true);
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
  const {
    loginRegisterActionLabel,
    loginTrackOrderActionLabel,
    loginSupportActionLabel,
    passwordLoginActionLabel,
    emailLoginActionLabel,
    passwordLoginUsernameInputLabel,
    passwordLoginPasswordInputLabel,
    passwordVisibilityActionLabel,
    emailLoginEmailInputLabel,
    emailLoginCodeInputLabel,
    sendEmailCodeActionLabel,
  } = buildLoginActionLabels({
    t,
    codeSending,
    sendCodeCountdown,
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      passwordSubmittingRef.current = false;
      emailSubmittingRef.current = false;
      emailCodeSendingRef.current = false;
    };
  }, []);

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

  useCountdownTicker(sendCodeCountdown, setSendCodeCountdown);
  useCountdownTicker(verifyRetryCountdown, setVerifyRetryCountdown);

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
    if (!mountedRef.current || guestItems.length === 0) return;

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
    if (!mountedRef.current) return;
    if (mergedCount > 0 && failedItems.length === 0) {
      announceAccessibleMessage(t('pages.auth.cartMerged', { count: mergedCount }), 'success');
    } else if (mergedCount > 0) {
      announceAccessibleMessage(t('pages.auth.cartMergePartial', { count: mergedCount }), 'warning');
    }
  };

  const completeLogin = async (responseData: LoginSessionResponse) => {
    if (!mountedRef.current) return;
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
    if (!mountedRef.current) return;
    announceAccessibleMessage(t('pages.auth.loginSuccess'), 'success');
    navigate(postLoginRedirectTarget, { replace: true });
  };

  const onFinish = async (values: PasswordLoginValues) => {
    if (!mountedRef.current) return;
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
          if (!mountedRef.current) return;
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
      if (!mountedRef.current) return;
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
      if (mountedRef.current) setLoading(false);
    }
  };

  const sendEmailCode = async () => {
    if (!mountedRef.current) return;
    if (emailCodeSendingRef.current) return;
    emailCodeSendingRef.current = true;
    clearStoredAuthCredentials();
    try {
      if (!emailCodeEnabled) {
        announceAccessibleMessage(t('pages.auth.emailCodeUnavailable'), 'warning');
        return;
      }
      const { email } = await emailForm.validateFields(['email']);
      if (!mountedRef.current) return;
      const normalizedEmail = normalizeEmail(email);
      emailForm.setFieldValue('email', normalizedEmail);
      setCodeSending(true);
      const response = await userApi.sendEmailLoginCode(normalizedEmail);
      if (!mountedRef.current) return;
      const resendIntervalSeconds = Number(response.data?.resendIntervalSeconds);
      const ttlMinutes = Number(response.data?.codeTtlMinutes);
      setSendCodeCountdown(Number.isFinite(resendIntervalSeconds) && resendIntervalSeconds > 0 ? resendIntervalSeconds : 60);
      setCodeTtlMinutes(Number.isFinite(ttlMinutes) && ttlMinutes > 0 ? ttlMinutes : 0);
      emailForm.setFieldValue('code', '');
      emailForm.setFields([{ name: 'code', errors: [] }]);
      setVerifyRetryCountdown(0);
      setSentEmailHint(maskEmail(normalizedEmail));
      window.setTimeout(() => {
        if (mountedRef.current) codeInputRef.current?.focus?.();
      }, 0);
      announceAccessibleMessage(t('pages.auth.emailCodeSentTo', { email: maskEmail(normalizedEmail) }), 'success');
    } catch (error: unknown) {
      if (!mountedRef.current) return;
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
      if (mountedRef.current) setCodeSending(false);
    }
  };

  const onEmailLogin = async (values: EmailLoginValues) => {
    if (!mountedRef.current) return;
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
      if (!mountedRef.current) return;
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
      if (mountedRef.current) setLoading(false);
    }
  };

  const panelProps: LoginPanelsProps = buildLoginPanelProps({
    t,
    navigate,
    guestCartCount,
    authBannerError,
    authRecoveryKind,
    setAuthBannerError,
    setAuthRecoveryKind,
    activeLoginTab,
    setActiveLoginTab,
    passwordForm,
    emailForm,
    loading,
    codeSending,
    sendCodeCountdown,
    verifyRetryCountdown,
    codeTtlMinutes,
    sentEmailHint,
    setSentEmailHint,
    setSendCodeCountdown,
    setVerifyRetryCountdown,
    setCodeTtlMinutes,
    emailCodeLength,
    emailCodeEnabled,
    canSubmitEmailCode,
    appConfigLoading,
    codeInputRef,
    loginRegisterActionLabel,
    loginTrackOrderActionLabel,
    loginSupportActionLabel,
    passwordLoginActionLabel,
    emailLoginActionLabel,
    passwordLoginUsernameInputLabel,
    passwordLoginPasswordInputLabel,
    passwordVisibilityActionLabel,
    emailLoginEmailInputLabel,
    emailLoginCodeInputLabel,
    sendEmailCodeActionLabel,
    onFinish,
    onEmailLogin,
    sendEmailCode,
  });

  return <LoginMainPanels {...panelProps} />;
};

export default Login;
