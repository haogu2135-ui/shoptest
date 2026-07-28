import React, { useEffect, useRef, useState } from 'react';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { Form } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { userApi } from '../api';
import { useAppConfig } from '../hooks/useAppConfig';
import { useLanguage } from '../i18n';
import { usePageTitle } from '../hooks/usePageTitle';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { setSessionStorageItem } from '../utils/safeStorage';
import { getApiErrorDiagnosticText, getApiErrorMessage } from '../utils/apiError';
import { buildLoginUrl, getPostLoginRedirectTarget } from '../utils/authRedirect';
import {
  buildRegisterActionLabels,
  buildRegisterPanelProps,
  createRegisterStrongPasswordValidator,
  getRegisterRetryAfterSeconds,
  isFormValidationError,
  isRegisterEmailCodeRequired,
  maskEmail,
  normalizeEmail,
  normalizeEmailCode,
  normalizePhone,
  normalizeUsername,
  registerApiErrorCode,
  registerApiErrorData,
  resolveRegisterRecoveryKind,
  scrollFirstRegisterErrorIntoView,
  uniqueLoginCandidates,
  type RegisterForm,
  type RegisterRecoveryKind,
} from './registerHelpers';
import { RegisterMainPanels } from './registerPanels';
import './Register.css';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const postRegisterRedirect = getPostLoginRedirectTarget(location.search, '');
  const { t, language } = useLanguage();
  usePageTitle(t('pages.auth.register'));
  useDocumentMeta({
    title: t('pages.auth.register'),
    description: t('common.siteDescription'),
    path: '/register',
    type: 'website',
    noIndex: true,
    siteName: t('common.siteTitle'),
  });
  const { config: appConfig, loading: appConfigLoading } = useAppConfig();
  const [form] = Form.useForm<RegisterForm>();
  const [registering, setRegistering] = useState(false);
  const [authBannerError, setAuthBannerError] = useState<string | null>(null);
  const [authRecoveryKind, setAuthRecoveryKind] = useState<RegisterRecoveryKind>(null);
  const [codeSending, setCodeSending] = useState(false);
  const [sendCodeCountdown, setSendCodeCountdown] = useState(0);
  const [codeTtlMinutes, setCodeTtlMinutes] = useState(0);
  const [sentEmailHint, setSentEmailHint] = useState('');
  const [emailCodeRequired, setEmailCodeRequired] = useState(false);
  const codeInputRef = useRef<HTMLInputElement | null>(null);
  const registeringRef = useRef(false);
  const registerCodeSendingRef = useRef(false);
  const emailCodeEnabled = appConfig.emailCodeEnabled === true;
  const {
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
    registerSendCodeActionLabel,
    registerSubmitActionLabel,
  } = buildRegisterActionLabels({
    t,
    codeSending,
    sendCodeCountdown,
  });
  const validateStrongPassword = createRegisterStrongPasswordValidator(t);

  useEffect(() => {
    if (sendCodeCountdown <= 0) return;
    const timer = window.setInterval(() => {
      setSendCodeCountdown((value) => Math.max(value - 1, 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [sendCodeCountdown]);

  const sendRegisterCode = async () => {
    if (registerCodeSendingRef.current) return;
    registerCodeSendingRef.current = true;
    try {
      if (!emailCodeEnabled) {
        announceAccessibleMessage(t('pages.auth.emailCodeUnavailable'), 'warning');
        return;
      }
      const { email } = await form.validateFields(['email']);
      const normalizedEmail = normalizeEmail(email);
      form.setFieldValue('email', normalizedEmail);
      setCodeSending(true);
      const response = await userApi.sendEmailLoginCode(normalizedEmail);
      const resendIntervalSeconds = Number(response.data?.resendIntervalSeconds);
      const ttlMinutes = Number(response.data?.codeTtlMinutes);
      setSendCodeCountdown(Number.isFinite(resendIntervalSeconds) && resendIntervalSeconds > 0 ? resendIntervalSeconds : 60);
      setCodeTtlMinutes(Number.isFinite(ttlMinutes) && ttlMinutes > 0 ? ttlMinutes : 0);
      setSentEmailHint(maskEmail(normalizedEmail));
      setEmailCodeRequired(true);
      form.setFieldValue('emailCode', '');
      form.setFields([{ name: 'emailCode', errors: [] }]);
      window.setTimeout(() => codeInputRef.current?.focus?.(), 0);
      announceAccessibleMessage(t('pages.auth.emailCodeSentTo', { email: maskEmail(normalizedEmail) }), 'success');
    } catch (error: unknown) {
      if (!isFormValidationError(error)) {
        const errorCode = registerApiErrorCode(error);
        if (errorCode === 'RATE_LIMITED') {
          setSendCodeCountdown(getRegisterRetryAfterSeconds(error, 60));
        }
        const errorMessage = errorCode === 'RATE_LIMITED'
          ? t('pages.auth.emailCodeRateLimited')
          : t('pages.auth.emailCodeSendFailed');
        setAuthBannerError(errorMessage);
        setAuthRecoveryKind(errorCode === 'RATE_LIMITED' ? 'rate_limited' : null);
        announceAccessibleMessage(errorMessage, 'error');
      }
    } finally {
      registerCodeSendingRef.current = false;
      setCodeSending(false);
    }
  };

  const onFinish = async (values: RegisterForm) => {
    if (registeringRef.current) return;
    registeringRef.current = true;
    setRegistering(true);
    setAuthBannerError(null);
    setAuthRecoveryKind(null);
    try {
      const username = normalizeUsername(values.username);
      const email = normalizeEmail(values.email);
      const phone = normalizePhone(values.phone);
      const emailCode = normalizeEmailCode(values.emailCode);
      if (emailCodeRequired && emailCode.length !== 6) {
        const lengthError = t('pages.auth.emailCodeLength');
        form.setFields([{ name: 'emailCode', errors: [lengthError] }]);
        setAuthBannerError(lengthError);
        setAuthRecoveryKind(null);
        return;
      }
      form.setFieldsValue({ username, email, phone });
      const response = await userApi.register({
        username,
        password: values.password,
        email,
        phone,
        emailCode,
        role: 'USER'
      });
      const responseUsername = normalizeUsername(response.data?.username);
      const loginCandidates = uniqueLoginCandidates(responseUsername, username, email, phone);
      const registeredLogin = loginCandidates[0] || username || email || phone;
      setSessionStorageItem('loginPrefill', registeredLogin);
      setSessionStorageItem('loginCandidates', JSON.stringify(loginCandidates));
      setAuthBannerError(null);
      setAuthRecoveryKind(null);
      announceAccessibleMessage(t('pages.auth.registerSuccess'), 'success');
      navigate(postRegisterRedirect ? buildLoginUrl(postRegisterRedirect) : '/login');
    } catch (error: unknown) {
      const responseData = registerApiErrorData(error);
      const serverCode = registerApiErrorCode(error);
      const needsEmailCode = isRegisterEmailCodeRequired(responseData.emailCodeRequired);
      const rawMessage = getApiErrorDiagnosticText(error);
      const normalizedMessage = rawMessage.toLowerCase();
      if (needsEmailCode || serverCode === 'INVALID_CODE' || serverCode === 'TOO_MANY_ATTEMPTS') {
        setEmailCodeRequired(true);
        const msg = serverCode === 'TOO_MANY_ATTEMPTS'
          ? t('pages.auth.emailCodeTooManyAttempts')
          : serverCode === 'INVALID_CODE'
          ? t('pages.auth.emailCodeInvalid')
          : t('pages.auth.emailCodeRequired');
        if (serverCode === 'TOO_MANY_ATTEMPTS') {
          setSendCodeCountdown(getRegisterRetryAfterSeconds(error, 60));
        }
        form.setFields([{ name: 'emailCode', errors: [msg] }]);
        setAuthBannerError(msg);
        setAuthRecoveryKind(serverCode === 'TOO_MANY_ATTEMPTS' ? 'rate_limited' : null);
        announceAccessibleMessage(msg, 'error');
        window.setTimeout(() => codeInputRef.current?.focus?.(), 0);
        return;
      }
      const fieldError = normalizedMessage.includes('phone number already registered')
        ? { name: 'phone' as const, message: t('pages.auth.phoneAlreadyRegistered') }
        : normalizedMessage.includes('email already registered')
        ? { name: 'email' as const, message: t('pages.auth.emailAlreadyRegistered') }
        : normalizedMessage.includes('username already registered')
        ? { name: 'username' as const, message: t('pages.auth.usernameAlreadyRegistered') }
        : null;
      const recoveryKind = resolveRegisterRecoveryKind(error);
      const msg = fieldError?.message
        || (recoveryKind === 'rate_limited'
          ? t('pages.auth.registerRateLimited')
          : getApiErrorMessage(error, t('pages.auth.registerFailed'), language));
      if (fieldError) {
        form.setFields([{ name: fieldError.name, errors: [fieldError.message] }]);
      }
      setAuthBannerError(msg);
      setAuthRecoveryKind(fieldError ? null : recoveryKind);
      announceAccessibleMessage(msg, 'error');
    } finally {
      registeringRef.current = false;
      setRegistering(false);
    }
  };

  const onFinishFailed = () => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(scrollFirstRegisterErrorIntoView);
    });
  };

  const panelProps = buildRegisterPanelProps({
    t,
    navigate,
    form,
    authBannerError,
    authRecoveryKind,
    setAuthBannerError,
    setAuthRecoveryKind,
    registering,
    codeSending,
    sendCodeCountdown,
    codeTtlMinutes,
    sentEmailHint,
    emailCodeRequired,
    emailCodeEnabled,
    appConfigLoading,
    codeInputRef,
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
    registerSendCodeActionLabel,
    registerSubmitActionLabel,
    validateStrongPassword,
    onFinish,
    onFinishFailed,
    sendRegisterCode,
  });

  return <RegisterMainPanels {...panelProps} />;
};

export default Register;
