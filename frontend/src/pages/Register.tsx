import React, { useEffect, useRef, useState } from 'react';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { ShopIcon, SI } from '../components/ShopIcon';
import { Form } from 'antd';
import ShopInput, { ShopPasswordInput } from '../components/ShopInput';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { userApi } from '../api';
import { useAppConfig } from '../hooks/useAppConfig';
import { useLanguage } from '../i18n';
import { usePageTitle } from '../hooks/usePageTitle';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { setSessionStorageItem } from '../utils/safeStorage';
import { getApiErrorDiagnosticText, getApiErrorMessage } from '../utils/apiError';
import { focusFirstFormError } from '../utils/formValidationFocus';
import { buildLoginUrl, getPostLoginRedirectTarget } from '../utils/authRedirect';
import { dispatchDomEvent } from '../utils/domEvents';
import {
  STRONG_PASSWORD_MAX_LENGTH,
  STRONG_PASSWORD_MIN_LENGTH,
  hasRequiredPasswordClasses,
  isCommonPassword,
} from '../utils/passwordPolicy';
import './Register.css';
import ShopButton from '../components/ShopButton';

import ShopTag from '../components/ShopTag';
import ShopAlert from '../components/ShopAlert';
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
  error?: unknown;
  message?: unknown;
  emailCodeRequired?: unknown;
  retryAfterSeconds?: unknown;
  resendIntervalSeconds?: unknown;
};

type RegisterApiErrorLike = {
  response?: {
    status?: unknown;
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

type RegisterRecoveryKind = 'rate_limited' | null;

const resolveRegisterRecoveryKind = (error: unknown): RegisterRecoveryKind => {
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

const isFormValidationError = (error: unknown): error is { errorFields: unknown[] } => (
  Boolean(error) && typeof error === 'object' && Array.isArray((error as { errorFields?: unknown }).errorFields)
);
const scrollFirstRegisterErrorIntoView = () => {
  focusFirstFormError({
    rootSelector: '.register-page__card',
    scrollOffset: 176,
    scrollContainerSelector: '.register-page__card',
  });
};

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
  const [authBannerError, setAuthBannerError] = useState<string | null>(null);
  const [authRecoveryKind, setAuthRecoveryKind] = useState<RegisterRecoveryKind>(null);
  const [registering, setRegistering] = useState(false);
  const [codeSending, setCodeSending] = useState(false);
  const [sendCodeCountdown, setSendCodeCountdown] = useState(0);
  const [codeTtlMinutes, setCodeTtlMinutes] = useState(0);
  const [sentEmailHint, setSentEmailHint] = useState('');
  const [emailCodeRequired, setEmailCodeRequired] = useState(false);
  const codeInputRef = useRef<HTMLInputElement | null>(null);
  const registeringRef = useRef(false);
  const registerCodeSendingRef = useRef(false);
  const emailCodeEnabled = appConfig.emailCodeEnabled === true;
  const registerPageLabel = t('pages.auth.registerTitle');
  const registerLoginActionLabel = `${t('pages.auth.loginNow')}: ${registerPageLabel}`;
  const registerTrackOrderActionLabel = `${t('nav.trackOrder')}: ${registerPageLabel}`;
  const usernameInputLabel = `${registerPageLabel}: ${t('pages.auth.usernameShort')}`;
  const passwordInputLabel = `${registerPageLabel}: ${t('pages.auth.password')}`;
  const confirmPasswordInputLabel = `${registerPageLabel}: ${t('pages.auth.confirmPassword')}`;
  const passwordVisibilityActionLabel = (visible: boolean) => `${passwordInputLabel}: ${visible ? t('pages.auth.hidePassword') : t('pages.auth.showPassword')}`;
  const confirmPasswordVisibilityActionLabel = (visible: boolean) => `${confirmPasswordInputLabel}: ${visible ? t('pages.auth.hidePassword') : t('pages.auth.showPassword')}`;
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
          setSendCodeCountdown(getRetryAfterSeconds(error, 60));
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

  return (
    <div className="register-page">
      <section className="register-page__panel">
        <div className="register-page__copy">
          <p className="register-page__eyebrow">{t('pages.auth.registerEyebrow')}</p>
          <h1 className="register-page__heroTitle">{t('pages.auth.registerHeroTitle')}</h1>
          <p className="register-page__heroSubtitle">{t('pages.auth.registerHeroSubtitle')}</p>
          <div className="register-page__trustGrid">
            <ShopTag icon={<ShopIcon path={SI.safety} />} color="green">{t('pages.auth.registerTrustSecure')}</ShopTag>
            <ShopTag icon={<ShopIcon path={SI.gift} />} color="orange">{t('pages.auth.registerTrustPerks')}</ShopTag>
            <ShopTag icon={<ShopIcon path={SI.truck} />} color="blue">{t('pages.auth.registerTrustTracking')}</ShopTag>
          </div>
          <div className="register-page__featureCards">
            <div className="register-page__featureCard">
              <ShopIcon path={SI.safety} />
              <div>
                <strong>{t('pages.auth.registerTrustSecure')}</strong>
                <span>{t('pages.auth.registerPrivacyHint')}</span>
              </div>
            </div>
            <div className="register-page__featureCard">
              <ShopIcon path={SI.gift} />
              <div>
                <strong>{t('pages.auth.registerTrustPerks')}</strong>
                <span>{t('pages.auth.registerHeroSubtitle')}</span>
              </div>
            </div>
            <div className="register-page__featureCard">
              <ShopIcon path={SI.truck} />
              <div>
                <strong>{t('pages.auth.registerTrustTracking')}</strong>
                <span>{t('nav.trackOrder')}</span>
              </div>
            </div>
          </div>
          <div className="register-page__actions">
            <ShopButton type="primary" size="large" aria-label={registerLoginActionLabel} title={registerLoginActionLabel} onClick={() => navigate('/login')}>
              {t('pages.auth.loginNow')}
            </ShopButton>
            <ShopButton ghost size="large" aria-label={registerTrackOrderActionLabel} title={registerTrackOrderActionLabel} onClick={() => navigate('/track-order')}>
              {t('nav.trackOrder')}
            </ShopButton>
          </div>
        </div>
      </section>
      <section className="register-page__card">
        <div className="register-page__cardHeader">
          <div className="register-page__brand">{t('common.brand')}</div>
          <p className="register-page__cardHint">{t('pages.auth.registerPrivacyHint')}</p>
        </div>
        <h2 className="register-page__title">
          {t('pages.auth.registerTitle')}
        </h2>
        {authBannerError ? (
          <div
            className="register-page__errorRecovery"
            data-register-error-recovery="true"
            data-register-error-kind={authRecoveryKind || 'generic'}
          >
            <ShopAlert
              className="register-page__errorBanner"
              type="error"
              showIcon
              closable
              role="alert"
              message={authBannerError}
              description={authRecoveryKind === 'rate_limited' ? t('pages.auth.registerRecoveryNextRateLimited') : undefined}
              onClose={() => {
                setAuthBannerError(null);
                setAuthRecoveryKind(null);
              }}
            />
            {authRecoveryKind === 'rate_limited' ? (
              <div className="register-page__errorRecovery__actions" data-register-recovery-actions="true">
                <ShopButton
                  type="primary"
                  block
                  size="large"
                  onClick={() => navigate('/login')}
                  aria-label={t('pages.auth.loginNow')}
                  title={t('pages.auth.loginNow')}
                >
                  {t('pages.auth.loginNow')}
                </ShopButton>
                <ShopButton
                  block
                  size="large"
                  onClick={() => navigate('/track-order')}
                  aria-label={t('nav.trackOrder')}
                  title={t('nav.trackOrder')}
                >
                  {t('nav.trackOrder')}
                </ShopButton>
                <ShopButton
                  block
                  size="large"
                  onClick={() => dispatchDomEvent('shop:open-support')}
                  aria-label={t('nav.support')}
                  title={t('nav.support')}
                >
                  {t('nav.support')}
                </ShopButton>
              </div>
            ) : null}
          </div>
        ) : null}
        <Form
          form={form}
          name="register"
          onFinish={onFinish}
          onFinishFailed={onFinishFailed}
          size="large"
          validateTrigger={['onChange', 'onBlur']}
          requiredMark
        >
          <Form.Item
            name="username"
            label={t('pages.auth.usernameShort')}
            rules={[
              { required: true, message: t('pages.auth.usernameRequired') },
              { min: 3, message: t('pages.auth.usernameMin') }
            ]}
          >
            <ShopInput
              prefix={<ShopIcon path={SI.user} />}
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
            <ShopPasswordInput
              prefix={<ShopIcon path={SI.lock} />}
              placeholder={t('pages.auth.password')}
              autoComplete="new-password"
              maxLength={STRONG_PASSWORD_MAX_LENGTH}
              aria-label={passwordInputLabel}
              title={passwordInputLabel}
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
            <ShopPasswordInput
              prefix={<ShopIcon path={SI.lock} />}
              placeholder={t('pages.auth.confirmPassword')}
              autoComplete="new-password"
              maxLength={128}
              aria-label={confirmPasswordInputLabel}
              title={confirmPasswordInputLabel}
              iconRender={(visible) => (
                <button
                  type="button"
                  aria-label={confirmPasswordVisibilityActionLabel(visible)}
                  aria-pressed={visible}
                  title={confirmPasswordVisibilityActionLabel(visible)}
                  style={{ border: 0, padding: 0, background: 'transparent', color: 'inherit', lineHeight: 0, cursor: 'pointer' }}
                >
                  {visible ? <ShopIcon path={SI.eye} /> : <ShopIcon path={SI.eyeOff} />}
                </button>
              )}
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
            <ShopInput
              prefix={<ShopIcon path={SI.mail} />}
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
                <p className="register-page__codeHint register-page__codeHint--secondary">
                  {t('pages.auth.emailCodeSentTo', { email: sentEmailHint })}
                  {codeTtlMinutes > 0 ? ` · ${t('pages.auth.emailCodeExpiresIn', { minutes: codeTtlMinutes })}` : ''}
                </p>
              )}
              {emailCodeRequired && !emailCodeEnabled && !appConfigLoading && (
                <p className="register-page__codeHint register-page__codeHint--warning">
                  {t('pages.auth.emailCodeUnavailable')}
                </p>
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
                <ShopInput
                  ref={codeInputRef}
                  prefix={<ShopIcon path={SI.safety} />}
                  placeholder={t('pages.auth.emailCodeRequired')}
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={6}
                  disabled={!emailCodeRequired}
                  aria-label={emailCodeInputLabel}
                  title={emailCodeInputLabel}
                  addonAfter={
                    <ShopButton
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
                    </ShopButton>
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
            <ShopInput
              prefix={<ShopIcon path={SI.phone} />}
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
            <ShopButton type="primary" htmlType="submit" block loading={registering} disabled={registering} aria-label={registerSubmitActionLabel} title={registerSubmitActionLabel}>
              {t('pages.auth.register')}
            </ShopButton>
          </Form.Item>
          <p className="register-page__legalNotice" role="note">
            {t('pages.auth.registerAgreementPrefix')}{' '}
            <Link to="/terms">{t('footer.terms')}</Link>
            {' '}{t('pages.auth.registerAgreementAnd')}{' '}
            <Link to="/privacy">{t('footer.privacy')}</Link>
            {t('pages.auth.registerAgreementSuffix')}
          </p>

          <div className="register-page__footer">
            <p className="register-page__footerHint">{t('pages.auth.registerPrivacyHint')}</p>
            <div>
              {t('pages.auth.alreadyAccount')}<Link to="/login">{t('pages.auth.loginNow')}</Link>
            </div>
          </div>
        </Form>
      </section>
    </div>
  );
};

export default Register;
