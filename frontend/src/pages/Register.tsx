import React, { useEffect, useRef, useState } from 'react';
import { Alert, Form, Input, Button, Card, Typography, message, Space, Tag } from 'antd';
import type { InputRef } from 'antd/es/input';
import { UserOutlined, LockOutlined, MailOutlined, PhoneOutlined, SafetyCertificateOutlined, GiftOutlined, TruckOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { userApi } from '../api';
import { useAppConfig } from '../hooks/useAppConfig';
import { useLanguage } from '../i18n';
import { usePageTitle } from '../hooks/usePageTitle';
import { setSessionStorageItem } from '../utils/safeStorage';
import { getApiErrorDiagnosticText, getApiErrorMessage } from '../utils/apiError';
import {
  STRONG_PASSWORD_MAX_LENGTH,
  STRONG_PASSWORD_MIN_LENGTH,
  hasRequiredPasswordClasses,
  isCommonPassword,
} from '../utils/passwordPolicy';
import './Register.css';

const { Text, Title } = Typography;

interface RegisterForm {
  username: string;
  password: string;
  confirmPassword: string;
  email: string;
  phone: string;
  emailCode?: string;
}

type RegisterApiErrorData = {
  code?: unknown;
  emailCodeRequired?: unknown;
  retryAfterSeconds?: unknown;
  resendIntervalSeconds?: unknown;
};

type RegisterApiErrorLike = {
  response?: {
    data?: RegisterApiErrorData;
  };
};

const phonePattern = /^(?=(?:.*\d){8,20})(\+?[\d\s().-]{8,32})$/;
const stripControlChars = (value: unknown) => Array.from(String(value || ''), (char) => {
  const code = char.charCodeAt(0);
  return code <= 31 || code === 127 ? ' ' : char;
}).join('');
const normalizeUsername = (value: unknown) => stripControlChars(value).replace(/\s+/g, '').trim();
const normalizeEmail = (value: unknown) => stripControlChars(value).trim().toLowerCase();
const normalizePhone = (value: unknown) => {
  const normalized = stripControlChars(value).trim();
  return normalized.startsWith('+') ? `+${normalized.slice(1).replace(/\D+/g, '')}` : normalized.replace(/\D+/g, '');
};
const normalizeLikelyPhone = (value: unknown) => (
  phonePattern.test(stripControlChars(value).trim()) ? normalizePhone(value) : stripControlChars(value).trim()
);
const normalizeEmailCode = (value: unknown) => String(value || '').replace(/\D+/g, '').slice(0, 6);
const maskEmail = (value: unknown) => {
  const email = normalizeEmail(value);
  const [name, domain] = email.split('@');
  if (!name || !domain) return email;
  return `${name.charAt(0)}***@${domain}`;
};
const uniqueLoginCandidates = (...values: unknown[]) => Array.from(new Set(
  values
    .map((value) => String(value || '').trim())
    .filter(Boolean),
));
const asRegisterApiError = (error: unknown): RegisterApiErrorLike => (
  error && typeof error === 'object' ? error as RegisterApiErrorLike : {}
);
const registerApiErrorData = (error: unknown) => asRegisterApiError(error).response?.data || {};
const registerApiErrorCode = (error: unknown) => String(registerApiErrorData(error).code || '').toUpperCase();
const isRegisterEmailCodeRequired = (value: unknown) => value === true || value === 'true';
const isFormValidationError = (error: unknown): error is { errorFields: unknown[] } => (
  Boolean(error) && typeof error === 'object' && Array.isArray((error as { errorFields?: unknown }).errorFields)
);
const REGISTER_VALIDATION_SCROLL_OFFSET = 176;

const scrollFirstRegisterErrorIntoView = () => {
  const firstInvalidItem = document.querySelector('.register-page__card .ant-form-item-has-error') as HTMLElement | null;
  if (!firstInvalidItem) return;

  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  const behavior: ScrollBehavior = prefersReducedMotion ? 'auto' : 'smooth';
  const card = firstInvalidItem.closest('.register-page__card') as HTMLElement | null;

  if (card && card.scrollHeight > card.clientHeight + 1) {
    const cardRect = card.getBoundingClientRect();
    const fieldRect = firstInvalidItem.getBoundingClientRect();
    card.scrollTo({
      top: Math.max(0, card.scrollTop + fieldRect.top - cardRect.top - 16),
      behavior,
    });
  }

  const fieldTop = firstInvalidItem.getBoundingClientRect().top + window.scrollY;
  window.scrollTo({
    top: Math.max(0, fieldTop - REGISTER_VALIDATION_SCROLL_OFFSET),
    behavior,
  });

  const firstControl = firstInvalidItem.querySelector('input, textarea, button, .ant-select-selector') as HTMLElement | null;
  firstControl?.focus?.({ preventScroll: true });
};

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  usePageTitle(t('pages.auth.register'));
  const { config: appConfig, loading: appConfigLoading } = useAppConfig();
  const [form] = Form.useForm<RegisterForm>();
  const [authBannerError, setAuthBannerError] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [codeSending, setCodeSending] = useState(false);
  const [sendCodeCountdown, setSendCodeCountdown] = useState(0);
  const [codeTtlMinutes, setCodeTtlMinutes] = useState(0);
  const [sentEmailHint, setSentEmailHint] = useState('');
  const [emailCodeRequired, setEmailCodeRequired] = useState(false);
  const codeInputRef = useRef<InputRef | null>(null);
  const registeringRef = useRef(false);
  const registerCodeSendingRef = useRef(false);
  const emailCodeEnabled = appConfig.emailCodeEnabled === true;
  const registerPageLabel = t('pages.auth.registerTitle');
  const registerLoginActionLabel = `${t('pages.auth.loginNow')}: ${registerPageLabel}`;
  const registerTrackOrderActionLabel = `${t('nav.trackOrder')}: ${registerPageLabel}`;
  const usernameInputLabel = `${registerPageLabel}: ${t('pages.auth.usernameShort')}`;
  const passwordInputLabel = `${registerPageLabel}: ${t('pages.auth.password')}`;
  const confirmPasswordInputLabel = `${registerPageLabel}: ${t('pages.auth.confirmPassword')}`;
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
    const data = registerApiErrorData(error);
    const retryAfterSeconds = Number(data.retryAfterSeconds);
    if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) return Math.ceil(retryAfterSeconds);
    const resendIntervalSeconds = Number(data.resendIntervalSeconds);
    if (Number.isFinite(resendIntervalSeconds) && resendIntervalSeconds > 0) return Math.ceil(resendIntervalSeconds);
    return fallback;
  };

  const sendRegisterCode = async () => {
    if (registerCodeSendingRef.current) return;
    registerCodeSendingRef.current = true;
    try {
      if (!emailCodeEnabled) {
        message.warning(t('pages.auth.emailCodeUnavailable'));
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
      message.success(t('pages.auth.emailCodeSentTo', { email: maskEmail(normalizedEmail) }));
    } catch (error: unknown) {
      if (!isFormValidationError(error)) {
        const errorCode = registerApiErrorCode(error);
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
      registerCodeSendingRef.current = false;
      setCodeSending(false);
    }
  };

  const onFinish = async (values: RegisterForm) => {
    if (registeringRef.current) return;
    registeringRef.current = true;
    setRegistering(true);
    setAuthBannerError(null);
    try {
      const username = normalizeUsername(values.username);
      const email = normalizeEmail(values.email);
      const phone = normalizePhone(values.phone);
      const emailCode = normalizeEmailCode(values.emailCode);
      if (emailCodeRequired && emailCode.length !== 6) {
        const lengthError = t('pages.auth.emailCodeLength');
        form.setFields([{ name: 'emailCode', errors: [lengthError] }]);
        setAuthBannerError(lengthError);
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
      message.success(t('pages.auth.registerSuccess'));
      navigate('/login');
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
          setSendCodeCountdown(getRetryAfterSeconds(error, 60));
        }
        form.setFields([{ name: 'emailCode', errors: [msg] }]);
        setAuthBannerError(msg);
        message.error(msg);
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
      const msg = fieldError?.message || getApiErrorMessage(error, t('pages.auth.registerFailed'), language);
      if (fieldError) {
        form.setFields([{ name: fieldError.name, errors: [fieldError.message] }]);
      }
      setAuthBannerError(msg);
      message.error(msg);
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

  return (
    <div className="register-page">
      <section className="register-page__panel">
        <div className="register-page__copy">
          <Text className="register-page__eyebrow">{t('pages.auth.registerEyebrow')}</Text>
          <Title level={1}>{t('pages.auth.registerHeroTitle')}</Title>
          <Text>{t('pages.auth.registerHeroSubtitle')}</Text>
          <div className="register-page__trustGrid">
            <Tag icon={<SafetyCertificateOutlined />} color="green">{t('pages.auth.registerTrustSecure')}</Tag>
            <Tag icon={<GiftOutlined />} color="orange">{t('pages.auth.registerTrustPerks')}</Tag>
            <Tag icon={<TruckOutlined />} color="blue">{t('pages.auth.registerTrustTracking')}</Tag>
          </div>
          <div className="register-page__featureCards">
            <div className="register-page__featureCard">
              <SafetyCertificateOutlined />
              <div>
                <strong>{t('pages.auth.registerTrustSecure')}</strong>
                <span>{t('pages.auth.registerPrivacyHint')}</span>
              </div>
            </div>
            <div className="register-page__featureCard">
              <GiftOutlined />
              <div>
                <strong>{t('pages.auth.registerTrustPerks')}</strong>
                <span>{t('pages.auth.registerHeroSubtitle')}</span>
              </div>
            </div>
            <div className="register-page__featureCard">
              <TruckOutlined />
              <div>
                <strong>{t('pages.auth.registerTrustTracking')}</strong>
                <span>{t('nav.trackOrder')}</span>
              </div>
            </div>
          </div>
          <div className="register-page__actions">
            <Button type="primary" size="large" aria-label={registerLoginActionLabel} title={registerLoginActionLabel} onClick={() => navigate('/login')}>
              {t('pages.auth.loginNow')}
            </Button>
            <Button ghost size="large" aria-label={registerTrackOrderActionLabel} title={registerTrackOrderActionLabel} onClick={() => navigate('/track-order')}>
              {t('nav.trackOrder')}
            </Button>
          </div>
        </div>
      </section>
      <Card className="register-page__card">
        <div className="register-page__cardHeader">
          <div className="register-page__brand">{t('common.brand')}</div>
          <Text className="register-page__cardHint">{t('pages.auth.registerPrivacyHint')}</Text>
        </div>
        <Title level={2} className="register-page__title">
          {t('pages.auth.registerTitle')}
        </Title>
        {authBannerError ? (
          <Alert
            className="register-page__errorBanner"
            type="error"
            showIcon
            closable
            role="alert"
            message={authBannerError}
            onClose={() => setAuthBannerError(null)}
          />
        ) : null}
        <Form
          form={form}
          name="register"
          onFinish={onFinish}
          onFinishFailed={onFinishFailed}
          size="large"
        >
          <Form.Item
            name="username"
            label={t('pages.auth.usernameShort')}
            rules={[
              { required: true, message: t('pages.auth.usernameRequired') },
              { min: 3, message: t('pages.auth.usernameMin') }
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder={t('pages.auth.usernameShort')}
              autoComplete="username"
              inputMode="text"
              maxLength={50}
              aria-label={usernameInputLabel}
              title={usernameInputLabel}
              onBlur={(event) => form.setFieldValue('username', normalizeUsername(event.target.value))}
            />
          </Form.Item>

          <Form.Item
            name="password"
            label={t('pages.auth.password')}
            rules={[
              { required: true, message: t('pages.auth.passwordRequired') },
              { min: STRONG_PASSWORD_MIN_LENGTH, max: STRONG_PASSWORD_MAX_LENGTH, message: t('pages.auth.passwordMin') },
              { validator: validateStrongPassword }
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder={t('pages.auth.password')}
              autoComplete="new-password"
              maxLength={STRONG_PASSWORD_MAX_LENGTH}
              aria-label={passwordInputLabel}
              title={passwordInputLabel}
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label={t('pages.auth.confirmPassword')}
            dependencies={['password']}
            rules={[
              { required: true, message: t('pages.auth.confirmRequired') },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error(t('pages.auth.passwordMismatch')));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder={t('pages.auth.confirmPassword')}
              autoComplete="new-password"
              maxLength={128}
              aria-label={confirmPasswordInputLabel}
              title={confirmPasswordInputLabel}
            />
          </Form.Item>

          <Form.Item
            name="email"
            label={t('pages.auth.email')}
            rules={[
              { required: true, message: t('pages.auth.emailRequired') },
              { type: 'email', message: t('pages.auth.emailInvalid') }
            ]}
          >
            <Input
              prefix={<MailOutlined />}
              placeholder={t('pages.auth.email')}
              autoComplete="email"
              inputMode="email"
              maxLength={100}
              aria-label={emailInputLabel}
              title={emailInputLabel}
              onBlur={(event) => form.setFieldValue('email', normalizeEmail(event.target.value))}
            />
          </Form.Item>

          {emailCodeRequired && (
            <>
              {emailCodeRequired && sentEmailHint && (
                <Text type="secondary" className="register-page__codeHint">
                  {t('pages.auth.emailCodeSentTo', { email: sentEmailHint })}
                  {codeTtlMinutes > 0 ? ` · ${t('pages.auth.emailCodeExpiresIn', { minutes: codeTtlMinutes })}` : ''}
                </Text>
              )}
              {emailCodeRequired && !emailCodeEnabled && !appConfigLoading && (
                <Text type="warning" className="register-page__codeHint">
                  {t('pages.auth.emailCodeUnavailable')}
                </Text>
              )}
              <Form.Item
                name="emailCode"
                className="register-page__codeField"
                label={t('pages.auth.verificationCode')}
                rules={emailCodeRequired ? [
                  { required: true, message: t('pages.auth.emailCodeRequired') },
                  { len: 6, message: t('pages.auth.emailCodeLength') },
                ] : []}
              >
                <Input
                  ref={codeInputRef}
                  prefix={<SafetyCertificateOutlined />}
                  placeholder={t('pages.auth.emailCodeRequired')}
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={6}
                  disabled={!emailCodeRequired}
                  aria-label={emailCodeInputLabel}
                  title={emailCodeInputLabel}
                  addonAfter={
                    <Button
                      type="link"
                      size="small"
                      loading={codeSending}
                      disabled={registering || codeSending || sendCodeCountdown > 0 || !emailCodeEnabled}
                      aria-label={registerSendCodeActionLabel}
                      title={registerSendCodeActionLabel}
                      onClick={sendRegisterCode}
                    >
                      {codeSending
                        ? t('pages.auth.emailCodeSending')
                        : sendCodeCountdown > 0
                        ? t('pages.auth.resendIn', { seconds: sendCodeCountdown })
                        : t('pages.auth.sendCode')}
                    </Button>
                  }
                  onChange={(event) => form.setFieldValue('emailCode', normalizeEmailCode(event.target.value))}
                />
              </Form.Item>
            </>
          )}

          <Form.Item
            name="phone"
            label={t('pages.auth.phone')}
            rules={[
              { required: true, message: t('pages.auth.phoneRequired') },
              { pattern: phonePattern, message: t('pages.auth.phoneInvalid') }
            ]}
          >
            <Input
              prefix={<PhoneOutlined />}
              placeholder={t('pages.auth.phonePlaceholder')}
              autoComplete="tel"
              inputMode="tel"
              maxLength={20}
              aria-label={phoneInputLabel}
              title={phoneInputLabel}
              onBlur={(event) => form.setFieldValue('phone', normalizeLikelyPhone(event.target.value))}
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={registering} disabled={registering} aria-label={registerSubmitActionLabel} title={registerSubmitActionLabel}>
              {t('pages.auth.register')}
            </Button>
          </Form.Item>

          <Space direction="vertical" className="register-page__footer">
            <Text type="secondary">{t('pages.auth.registerPrivacyHint')}</Text>
            <div>
              {t('pages.auth.alreadyAccount')}<Link to="/login">{t('pages.auth.loginNow')}</Link>
            </div>
          </Space>
        </Form>
      </Card>
    </div>
  );
};

export default Register;
