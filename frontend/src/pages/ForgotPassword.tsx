import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, Form, Input, message } from 'antd';
import type { InputRef } from 'antd/es/input';
import { CheckCircleOutlined, LockOutlined, MailOutlined, SafetyCertificateOutlined, UserOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { userApi } from '../api';
import { useAppConfig } from '../hooks/useAppConfig';
import { useLanguage } from '../i18n';
import {
  STRONG_PASSWORD_MAX_LENGTH,
  STRONG_PASSWORD_MIN_LENGTH,
  hasRequiredPasswordClasses,
  isCommonPassword,
} from '../utils/passwordPolicy';
import './Login.css';

interface ForgotPasswordForm {
  login: string;
  email: string;
  code: string;
  newPassword: string;
  confirmPassword: string;
}

type AuthApiErrorData = {
  code?: unknown;
  retryAfterSeconds?: unknown;
  resendIntervalSeconds?: unknown;
};

type AuthApiErrorLike = {
  response?: {
    data?: AuthApiErrorData;
  };
};

const normalizeEmail = (value: unknown) => String(value || '').trim().toLowerCase();
const normalizeEmailCode = (value: unknown) => String(value || '').replace(/\D+/g, '').slice(0, 6);
const normalizePasswordLogin = (value: unknown) => {
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
const maskEmail = (value: unknown) => {
  const email = normalizeEmail(value);
  const [name, domain] = email.split('@');
  if (!name || !domain) return email;
  return `${name.charAt(0)}***@${domain}`;
};
const asAuthApiError = (error: unknown): AuthApiErrorLike => (
  error && typeof error === 'object' ? error as AuthApiErrorLike : {}
);
const authApiErrorData = (error: unknown) => asAuthApiError(error).response?.data || {};
const authApiErrorCode = (error: unknown) => String(authApiErrorData(error).code || '').toUpperCase();
const isFormValidationError = (error: unknown): error is { errorFields: unknown[] } => (
  Boolean(error) && typeof error === 'object' && Array.isArray((error as { errorFields?: unknown }).errorFields)
);

const ForgotPassword: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [authBannerError, setAuthBannerError] = useState<string | null>(null);
  const [codeSending, setCodeSending] = useState(false);
  const [sendCodeCountdown, setSendCodeCountdown] = useState(0);
  const [codeTtlMinutes, setCodeTtlMinutes] = useState(0);
  const [sentEmailHint, setSentEmailHint] = useState('');
  const [form] = Form.useForm<ForgotPasswordForm>();
  const codeInputRef = useRef<InputRef | null>(null);
  const resetCodeSendingRef = useRef(false);
  const resetSubmittingRef = useRef(false);
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { config: appConfig, loading: appConfigLoading } = useAppConfig();
  const emailCodeEnabled = appConfig.emailCodeEnabled === true;
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
  const resetSubmitActionLabel = `${resetPageLabel}: ${t('pages.auth.resetPassword')}`;
  const validateStrongPassword = (_rule: unknown, value?: string) => {
    if (!value) return Promise.resolve();
    if (isCommonPassword(value)) {
      return Promise.reject(new Error(t('pages.auth.passwordCommon')));
    }
    if (!hasRequiredPasswordClasses(value)) {
      return Promise.reject(new Error(t('pages.auth.passwordPattern')));
    }
    return Promise.resolve();
  };

  useEffect(() => {
    if (sendCodeCountdown <= 0) return;
    const timer = window.setInterval(() => {
      setSendCodeCountdown((value) => Math.max(value - 1, 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [sendCodeCountdown]);

  const getRetryAfterSeconds = (error: unknown, fallback = 0) => {
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

  const sendResetCode = async () => {
    if (resetCodeSendingRef.current) return;
    resetCodeSendingRef.current = true;
    try {
      if (!emailCodeEnabled) {
        message.warning(t('pages.auth.emailCodeUnavailable'));
        return;
      }
      const { email } = await form.validateFields(['email']);
      const normalizedEmail = normalizeEmail(email);
      form.setFieldValue('email', normalizedEmail);
      setCodeSending(true);
      const response = await userApi.sendPasswordResetCode(normalizedEmail);
      const resendIntervalSeconds = Number(response.data?.resendIntervalSeconds);
      const ttlMinutes = Number(response.data?.codeTtlMinutes);
      setSendCodeCountdown(Number.isFinite(resendIntervalSeconds) && resendIntervalSeconds > 0 ? resendIntervalSeconds : 60);
      setCodeTtlMinutes(Number.isFinite(ttlMinutes) && ttlMinutes > 0 ? ttlMinutes : 0);
      form.setFieldValue('code', '');
      form.setFields([{ name: 'code', errors: [] }]);
      setSentEmailHint(maskEmail(normalizedEmail));
      window.setTimeout(() => codeInputRef.current?.focus?.(), 0);
      message.success(t('pages.auth.emailCodeSentTo', { email: maskEmail(normalizedEmail) }));
    } catch (error: unknown) {
      if (!isFormValidationError(error)) {
        const errorCode = authApiErrorCode(error);
        if (errorCode === 'RATE_LIMITED') {
          setSendCodeCountdown(getRetryAfterSeconds(error, 60));
        }
        const errorMessage = errorCode === 'RATE_LIMITED'
          ? t('pages.auth.emailCodeRateLimited')
          : t('pages.auth.emailCodeSendFailed');
        setAuthBannerError(errorMessage);
        message.error(errorMessage);
      }
    } finally {
      resetCodeSendingRef.current = false;
      setCodeSending(false);
    }
  };

  const onFinish = async (values: ForgotPasswordForm) => {
    if (resetSubmittingRef.current) return;
    resetSubmittingRef.current = true;
    setAuthBannerError(null);
    try {
      if (!emailCodeEnabled) {
        const unavailable = t('pages.auth.emailCodeUnavailable');
        setAuthBannerError(unavailable);
        message.warning(unavailable);
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
      setAuthBannerError(null);
      message.success(t('pages.auth.resetSuccess'));
      navigate('/login');
    } catch (error: unknown) {
      const errorCode = authApiErrorCode(error);
      if (errorCode === 'INVALID_CODE' || errorCode === 'TOO_MANY_ATTEMPTS') {
        const msg = errorCode === 'TOO_MANY_ATTEMPTS'
          ? t('pages.auth.emailCodeTooManyAttempts')
          : t('pages.auth.emailCodeInvalid');
        form.setFields([{ name: 'code', errors: [msg] }]);
        setAuthBannerError(msg);
        message.error(msg);
      } else {
        const msg = t('pages.auth.resetFailed');
        setAuthBannerError(msg);
        message.error(msg);
      }
    } finally {
      resetSubmittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <main className="shopee-login-root shopee-login-root--reset">
      <section className="shopee-login-card shopee-login-card--reset">
        <div className="shopee-login-brand">
          <div className="shopee-login-mark">{t('common.brand')}</div>
          <div className="shopee-login-subtitle">{t('pages.auth.resetPasswordTitle')}</div>
        </div>
        <div className="shopee-login-reset-guide" aria-label={t('pages.auth.resetGuideTitle')}>
          <div className="shopee-login-reset-guide__item">
            <MailOutlined />
            <span>{t('pages.auth.resetGuideEmail')}</span>
          </div>
          <div className="shopee-login-reset-guide__item">
            <SafetyCertificateOutlined />
            <span>{t('pages.auth.resetGuideVerify')}</span>
          </div>
          <div className="shopee-login-reset-guide__item">
            <CheckCircleOutlined />
            <span>{t('pages.auth.resetGuideLogin')}</span>
          </div>
        </div>

        {authBannerError ? (
          <Alert
            className="shopee-login-errorBanner"
            type="error"
            showIcon
            closable
            role="alert"
            message={authBannerError}
            onClose={() => setAuthBannerError(null)}
          />
        ) : null}
        <Form form={form} name="forgotPassword" onFinish={onFinish} layout="vertical" className="shopee-login-form">
          {!emailCodeEnabled && !appConfigLoading && (
            <div className="shopee-login-emailHint shopee-login-emailHint--warning" role="status">
              <SafetyCertificateOutlined />
              <span>{t('pages.auth.emailCodeUnavailable')}</span>
            </div>
          )}
          <Form.Item name="login" rules={[{ required: true, message: t('pages.auth.usernameRequired') }]}>
            <Input
              prefix={<UserOutlined />}
              placeholder={t('pages.auth.username')}
              size="large"
              autoComplete="username"
              aria-label={resetLoginInputLabel}
              title={resetLoginInputLabel}
              onBlur={(event) => form.setFieldValue('login', normalizePasswordLogin(event.target.value))}
            />
          </Form.Item>
          <Form.Item
            name="email"
            rules={[
              { required: true, message: t('pages.auth.emailRequired') },
              { type: 'email', message: t('pages.auth.emailInvalid') },
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder={t('pages.auth.email')} size="large" autoComplete="email" disabled={loading || !emailCodeEnabled} aria-label={resetEmailInputLabel} title={resetEmailInputLabel} />
          </Form.Item>
          {sentEmailHint && (
            <div className="shopee-login-emailSent" role="status">
              <SafetyCertificateOutlined />
              <span>
                <strong>{t('pages.auth.emailCodeSentTo', { email: sentEmailHint })}</strong>
                {codeTtlMinutes > 0 && (
                  <small>{t('pages.auth.emailCodeExpiresIn', { minutes: codeTtlMinutes })}</small>
                )}
              </span>
            </div>
          )}
          <Form.Item
            name="code"
            className="shopee-login-form__field shopee-login-form__field--code"
            rules={[
              { required: true, message: t('pages.auth.emailCodeRequired') },
              { len: 6, message: t('pages.auth.emailCodeLength') },
            ]}
          >
            <Input
              ref={codeInputRef}
              className="shopee-login-codeInput"
              prefix={<SafetyCertificateOutlined />}
              placeholder={t('pages.auth.verificationCode')}
              size="large"
              maxLength={6}
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]*"
              disabled={loading || !emailCodeEnabled}
              aria-label={resetCodeInputLabel}
              title={resetCodeInputLabel}
              onChange={(event) => {
                const normalized = normalizeEmailCode(event.target.value);
                if (normalized !== event.target.value) {
                  form.setFieldValue('code', normalized);
                }
              }}
              addonAfter={
                <Button
                  type="link"
                  size="small"
                  className="shopee-login-codeButton"
                  loading={codeSending}
                  disabled={loading || codeSending || sendCodeCountdown > 0 || !emailCodeEnabled}
                  aria-label={resetSendCodeActionLabel}
                  title={resetSendCodeActionLabel}
                  onClick={sendResetCode}
                >
                  {resetCodeActionText}
                </Button>
              }
            />
          </Form.Item>
          <Form.Item
            name="newPassword"
            rules={[
              { required: true, message: t('pages.auth.newPasswordRequired') },
              { min: STRONG_PASSWORD_MIN_LENGTH, max: STRONG_PASSWORD_MAX_LENGTH, message: t('pages.auth.passwordMin') },
              { validator: validateStrongPassword },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder={t('pages.auth.newPassword')} size="large" autoComplete="new-password" maxLength={STRONG_PASSWORD_MAX_LENGTH} aria-label={resetNewPasswordInputLabel} title={resetNewPasswordInputLabel} />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: t('pages.auth.confirmRequired') },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error(t('pages.auth.passwordMismatch')));
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder={t('pages.auth.confirmPassword')} size="large" autoComplete="new-password" aria-label={resetConfirmPasswordInputLabel} title={resetConfirmPasswordInputLabel} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block size="large" loading={loading} disabled={loading || codeSending || !emailCodeEnabled} aria-label={resetSubmitActionLabel} title={resetSubmitActionLabel}>
              {t('pages.auth.resetPassword')}
            </Button>
          </Form.Item>
        </Form>

        <div className="shopee-login-links shopee-login-links--single">
          <Link to="/login">{t('pages.auth.backToLogin')}</Link>
        </div>
      </section>
    </main>
  );
};

export default ForgotPassword;
