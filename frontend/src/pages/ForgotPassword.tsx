import React, { useEffect, useRef, useState } from 'react';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { Form } from 'antd';
import { useNavigate } from 'react-router-dom';
import { userApi } from '../api';
import { useAppConfig } from '../hooks/useAppConfig';
import { useLanguage } from '../i18n';
import { usePageTitle } from '../hooks/usePageTitle';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useCountdownTicker } from '../hooks/useCountdownTicker';
import {
  authApiErrorCode,
  buildForgotPasswordActionLabels,
  buildForgotPasswordPanelProps,
  createForgotPasswordStrongPasswordValidator,
  getForgotPasswordRetryAfterSeconds,
  isFormValidationError,
  maskEmail,
  normalizeEmail,
  normalizeEmailCode,
  normalizePasswordLogin,
  type ForgotPasswordForm,
} from './forgotPasswordHelpers';
import { ForgotPasswordMainPanels } from './forgotPasswordPanels';
import './Login.css';

const ForgotPassword: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [authBannerError, setAuthBannerError] = useState<string | null>(null);
  const [codeSending, setCodeSending] = useState(false);
  const [sendCodeCountdown, setSendCodeCountdown] = useState(0);
  const [codeTtlMinutes, setCodeTtlMinutes] = useState(0);
  const [sentEmailHint, setSentEmailHint] = useState('');
  const [form] = Form.useForm<ForgotPasswordForm>();
  const codeInputRef = useRef<HTMLInputElement | null>(null);
  const resetCodeSendingRef = useRef(false);
  const resetSubmittingRef = useRef(false);
  const mountedRef = useRef(true);
  const navigate = useNavigate();
  const { t } = useLanguage();
  usePageTitle(t('pages.auth.resetPasswordTitle'));
  useDocumentMeta({
    title: t('pages.auth.resetPasswordTitle'),
    description: t('common.siteDescription'),
    path: '/forgot-password',
    type: 'website',
    noIndex: true,
    siteName: t('common.siteTitle'),
  });
  const { config: appConfig, loading: appConfigLoading } = useAppConfig();
  const emailCodeEnabled = appConfig.emailCodeEnabled === true;
  const resetUnavailable = !emailCodeEnabled && !appConfigLoading;
  const {
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
  } = buildForgotPasswordActionLabels({
    t,
    codeSending,
    sendCodeCountdown,
  });
  const validateStrongPassword = createForgotPasswordStrongPasswordValidator(t);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      resetCodeSendingRef.current = false;
      resetSubmittingRef.current = false;
    };
  }, []);

  useCountdownTicker(sendCodeCountdown, setSendCodeCountdown);

  const sendResetCode = async () => {
    if (!mountedRef.current) return;
    if (resetCodeSendingRef.current) return;
    resetCodeSendingRef.current = true;
    try {
      if (!emailCodeEnabled) {
        announceAccessibleMessage(t('pages.auth.emailCodeUnavailable'), 'warning');
        return;
      }
      const { email } = await form.validateFields(['email']);
      if (!mountedRef.current) return;
      const normalizedEmail = normalizeEmail(email);
      form.setFieldValue('email', normalizedEmail);
      setCodeSending(true);
      const response = await userApi.sendPasswordResetCode(normalizedEmail);
      if (!mountedRef.current) return;
      const resendIntervalSeconds = Number(response.data?.resendIntervalSeconds);
      const ttlMinutes = Number(response.data?.codeTtlMinutes);
      setSendCodeCountdown(Number.isFinite(resendIntervalSeconds) && resendIntervalSeconds > 0 ? resendIntervalSeconds : 60);
      setCodeTtlMinutes(Number.isFinite(ttlMinutes) && ttlMinutes > 0 ? ttlMinutes : 0);
      form.setFieldValue('code', '');
      form.setFields([{ name: 'code', errors: [] }]);
      setSentEmailHint(maskEmail(normalizedEmail));
      window.setTimeout(() => {
        if (mountedRef.current) codeInputRef.current?.focus?.();
      }, 0);
      announceAccessibleMessage(t('pages.auth.emailCodeSentTo', { email: maskEmail(normalizedEmail) }), 'success');
    } catch (error: unknown) {
      if (!mountedRef.current) return;
      if (!isFormValidationError(error)) {
        const errorCode = authApiErrorCode(error);
        if (errorCode === 'RATE_LIMITED') {
          setSendCodeCountdown(getForgotPasswordRetryAfterSeconds(error, 60));
        }
        const errorMessage = errorCode === 'RATE_LIMITED'
          ? t('pages.auth.emailCodeRateLimited')
          : t('pages.auth.emailCodeSendFailed');
        setAuthBannerError(errorMessage);
        announceAccessibleMessage(errorMessage, 'error');
      }
    } finally {
      resetCodeSendingRef.current = false;
      if (mountedRef.current) setCodeSending(false);
    }
  };

  const onFinish = async (values: ForgotPasswordForm) => {
    if (!mountedRef.current) return;
    if (resetSubmittingRef.current) return;
    resetSubmittingRef.current = true;
    setAuthBannerError(null);
    try {
      if (!emailCodeEnabled) {
        const unavailable = t('pages.auth.emailCodeUnavailable');
        setAuthBannerError(unavailable);
        announceAccessibleMessage(unavailable, 'warning');
        return;
      }
      const normalizedCode = normalizeEmailCode(values.code);
      if (normalizedCode.length !== 6) {
        const lengthError = t('pages.auth.emailCodeLength');
        form.setFields([{ name: 'code', errors: [lengthError] }]);
        setAuthBannerError(lengthError);
        return;
      }
      setLoading(true);
      const normalizedEmail = normalizeEmail(values.email);
      const normalizedLogin = normalizePasswordLogin(values.login);
      form.setFieldsValue({ login: normalizedLogin, email: normalizedEmail, code: normalizedCode });
      await userApi.forgotPassword({
        login: normalizedLogin,
        email: normalizedEmail,
        code: normalizedCode,
        newPassword: values.newPassword,
      });
      if (!mountedRef.current) return;
      setAuthBannerError(null);
      announceAccessibleMessage(t('pages.auth.resetSuccess'), 'success');
      navigate('/login');
    } catch (error: unknown) {
      if (!mountedRef.current) return;
      const errorCode = authApiErrorCode(error);
      if (errorCode === 'INVALID_CODE' || errorCode === 'TOO_MANY_ATTEMPTS') {
        const msg = errorCode === 'TOO_MANY_ATTEMPTS'
          ? t('pages.auth.emailCodeTooManyAttempts')
          : t('pages.auth.emailCodeInvalid');
        form.setFields([{ name: 'code', errors: [msg] }]);
        setAuthBannerError(msg);
        announceAccessibleMessage(msg, 'error');
      } else {
        const msg = t('pages.auth.resetFailed');
        setAuthBannerError(msg);
        announceAccessibleMessage(msg, 'error');
      }
    } finally {
      resetSubmittingRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  };

  const panelProps = buildForgotPasswordPanelProps({
    t,
    navigate,
    form,
    loading,
    authBannerError,
    setAuthBannerError,
    codeSending,
    sendCodeCountdown,
    codeTtlMinutes,
    sentEmailHint,
    emailCodeEnabled,
    resetUnavailable,
    codeInputRef,
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
    validateStrongPassword,
    onFinish,
    sendResetCode,
  });

  return <ForgotPasswordMainPanels {...panelProps} />;
};

export default ForgotPassword;
