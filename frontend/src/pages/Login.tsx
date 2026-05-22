import React, { useEffect, useRef, useState } from 'react';
import { Form, Input, Button, Typography, message, Tabs } from 'antd';
import { CompassOutlined, LockOutlined, MailOutlined, SafetyCertificateOutlined, ShoppingCartOutlined, TruckOutlined, UserOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { cartApi, userApi } from '../api';
import { useLanguage } from '../i18n';
import { getGuestCartItems, replaceGuestCartItems } from '../utils/guestCart';
import { getEffectiveRole } from '../utils/roles';
import { removeLocalStorageItem, setLocalStorageItem } from '../utils/safeStorage';
import './Login.css';

const { Text, Title } = Typography;

const normalizeEmail = (value: unknown) => String(value || '').trim().toLowerCase();
const normalizeEmailCode = (value: unknown) => String(value || '').replace(/\D+/g, '').slice(0, 6);
const maskEmail = (value: unknown) => {
  const email = normalizeEmail(value);
  const [name, domain] = email.split('@');
  if (!name || !domain) return email;
  return `${name.charAt(0)}***@${domain}`;
};

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [codeSending, setCodeSending] = useState(false);
  const [sendCodeCountdown, setSendCodeCountdown] = useState(0);
  const [verifyRetryCountdown, setVerifyRetryCountdown] = useState(0);
  const [codeTtlMinutes, setCodeTtlMinutes] = useState(0);
  const [sentEmailHint, setSentEmailHint] = useState('');
  const [activeLoginTab, setActiveLoginTab] = useState('password');
  const [emailForm] = Form.useForm();
  const watchedEmailCode = Form.useWatch('code', emailForm);
  const codeInputRef = useRef<any>(null);
  const navigate = useNavigate();
  const { t } = useLanguage();
  const guestCartCount = getGuestCartItems().reduce((sum, item) => sum + item.quantity, 0);
  const emailCodeLength = normalizeEmailCode(watchedEmailCode).length;
  const canSubmitEmailCode = emailCodeLength === 6 && verifyRetryCountdown <= 0;

  useEffect(() => {
    if (sendCodeCountdown <= 0) return undefined;
    const timer = window.setInterval(() => {
      setSendCodeCountdown((value) => Math.max(value - 1, 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [sendCodeCountdown]);

  useEffect(() => {
    if (verifyRetryCountdown <= 0) return undefined;
    const timer = window.setInterval(() => {
      setVerifyRetryCountdown((value) => Math.max(value - 1, 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [verifyRetryCountdown]);

  const getRetryAfterSeconds = (error: any, fallback = 0) => {
    const retryAfterSeconds = Number(error?.response?.data?.retryAfterSeconds);
    if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
      return Math.ceil(retryAfterSeconds);
    }
    const resendIntervalSeconds = Number(error?.response?.data?.resendIntervalSeconds);
    if (Number.isFinite(resendIntervalSeconds) && resendIntervalSeconds > 0) {
      return Math.ceil(resendIntervalSeconds);
    }
    return fallback;
  };

  const mergeGuestCart = async (userId: number) => {
    const guestItems = getGuestCartItems();
    if (guestItems.length === 0) return;

    const failedItems = [];
    let mergedCount = 0;
    for (const item of guestItems) {
      try {
        await cartApi.addItem(userId, item.productId, item.quantity, item.selectedSpecs);
        mergedCount += item.quantity;
      } catch {
        failedItems.push(item);
      }
    }
    replaceGuestCartItems(failedItems);
    if (mergedCount > 0 && failedItems.length === 0) {
      message.success(t('pages.auth.cartMerged', { count: mergedCount }));
    } else if (mergedCount > 0) {
      message.warning(t('pages.auth.cartMergePartial', { count: mergedCount }));
    }
  };

  const completeLogin = async (responseData: any) => {
    const { token, id, username, role, roleCode } = responseData;
    setLocalStorageItem('token', token);
    setLocalStorageItem('userId', String(id));
    setLocalStorageItem('username', username);
    setLocalStorageItem('role', getEffectiveRole(role, roleCode));
    removeLocalStorageItem('adminDefaultPath');
    await mergeGuestCart(Number(id));
    message.success(t('pages.auth.loginSuccess'));
    navigate('/');
  };

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const response = await userApi.login(values.username, values.password);
      await completeLogin(response.data);
    } catch {
      message.error(t('pages.auth.loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  const sendEmailCode = async () => {
    try {
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
      message.success(t('pages.auth.emailCodeSentTo', { email: maskEmail(normalizedEmail) }));
    } catch (error: any) {
      if (!error?.errorFields) {
        const errorCode = error?.response?.data?.code;
        if (errorCode === 'RATE_LIMITED') {
          setSendCodeCountdown(getRetryAfterSeconds(error, 60));
        }
        message.error(errorCode === 'RATE_LIMITED'
          ? t('pages.auth.emailCodeRateLimited')
          : t('pages.auth.emailCodeSendFailed'));
      }
    } finally {
      setCodeSending(false);
    }
  };

  const onEmailLogin = async (values: any) => {
    const normalizedCode = normalizeEmailCode(values.code);
    if (normalizedCode.length !== 6) {
      emailForm.setFields([{ name: 'code', errors: [t('pages.auth.emailCodeLength')] }]);
      return;
    }
    setLoading(true);
    try {
      const normalizedEmail = normalizeEmail(values.email);
      emailForm.setFieldsValue({ email: normalizedEmail, code: normalizedCode });
      const response = await userApi.emailLogin(normalizedEmail, normalizedCode);
      await completeLogin(response.data);
    } catch (error: any) {
      const errorCode = error?.response?.data?.code;
      if (errorCode === 'TOO_MANY_ATTEMPTS') {
        const retryAfterSeconds = getRetryAfterSeconds(error, 60);
        setVerifyRetryCountdown(retryAfterSeconds);
        const errorMessage = t('pages.auth.emailCodeTooManyAttempts');
        emailForm.setFields([{ name: 'code', errors: [errorMessage] }]);
        message.error(errorMessage);
      } else if (errorCode === 'INVALID_CODE') {
        const errorMessage = t('pages.auth.emailCodeInvalid');
        emailForm.setFields([{ name: 'code', errors: [errorMessage] }]);
        message.error(errorMessage);
      } else {
        message.error(t('pages.auth.emailLoginFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="shopee-login-root">
      <section className="shopee-login-shell">
        <aside className="shopee-login-panel">
          <Text className="shopee-login-panel__eyebrow">{t('pages.auth.loginTitle')}</Text>
          <Title level={1}>{t('pages.auth.loginTrustTitle')}</Title>
          <Text className="shopee-login-panel__subtitle">
            {guestCartCount > 0
              ? t('pages.auth.loginGuestCartHint', { count: guestCartCount })
              : t('pages.auth.loginHeroSubtitle')}
          </Text>
          <div className="shopee-login-panel__featureList" aria-label={t('pages.auth.loginTrustTitle')}>
            <div className="shopee-login-panel__feature">
              <ShoppingCartOutlined />
              <span>{t('pages.auth.loginTrustCart')}</span>
            </div>
            <div className="shopee-login-panel__feature">
              <TruckOutlined />
              <span>{t('pages.auth.loginTrustTracking')}</span>
            </div>
            <div className="shopee-login-panel__feature">
              <SafetyCertificateOutlined />
              <span>{t('pages.auth.loginTrustSecure')}</span>
            </div>
          </div>
          <div className="shopee-login-panel__spotlight">
            <div className="shopee-login-panel__spotlightCard">
              <strong>{guestCartCount}</strong>
              <span>{t('pages.auth.loginTrustCart')}</span>
            </div>
            <div className="shopee-login-panel__spotlightCard">
              <strong>24/7</strong>
              <span>{t('nav.trackOrder')}</span>
            </div>
            <div className="shopee-login-panel__spotlightCard">
              <strong>SSL</strong>
              <span>{t('pages.auth.loginTrustSecure')}</span>
            </div>
          </div>
          <div className="shopee-login-panel__actions">
            <Button type="primary" size="large" onClick={() => navigate('/register')}>
              {t('pages.auth.register')}
            </Button>
            <Button ghost size="large" onClick={() => navigate('/track-order')}>
              {t('nav.trackOrder')}
            </Button>
          </div>
        </aside>

        <section className="shopee-login-card">
          <div className="shopee-login-card__header">
            <div className="shopee-login-brand">
              <div className="shopee-login-mark">ShopMX</div>
              <div className="shopee-login-subtitle">{t('pages.auth.loginTitle')}</div>
            </div>
            <Text className="shopee-login-card__intro">
              {guestCartCount > 0
                ? t('pages.auth.loginGuestCartHint', { count: guestCartCount })
                : t('pages.auth.loginHeroSubtitle')}
            </Text>
          </div>
          <div className="shopee-login-card__stats" aria-label={t('pages.auth.loginTrustTitle')}>
            <div className="shopee-login-card__stat">
              <strong>{guestCartCount}</strong>
              <span>{t('pages.auth.loginTrustCart')}</span>
            </div>
            <div className="shopee-login-card__stat">
              <strong>24/7</strong>
              <span>{t('pages.auth.loginTrustTracking')}</span>
            </div>
            <div className="shopee-login-card__stat">
              <strong>SSL</strong>
              <span>{t('pages.auth.loginTrustSecure')}</span>
            </div>
          </div>
          <div className="shopee-login-trust" aria-label={t('pages.auth.loginTrustTitle')}>
            <div className="shopee-login-trust__item">
              <ShoppingCartOutlined />
              <span>{t('pages.auth.loginTrustCart')}</span>
            </div>
            <div className="shopee-login-trust__item">
              <TruckOutlined />
              <span>{t('pages.auth.loginTrustTracking')}</span>
            </div>
            <div className="shopee-login-trust__item">
              <SafetyCertificateOutlined />
              <span>{t('pages.auth.loginTrustSecure')}</span>
            </div>
          </div>

          <Tabs
            activeKey={activeLoginTab}
            onChange={setActiveLoginTab}
            className={`shopee-login-tabs shopee-login-tabs--${activeLoginTab}`}
            centered
            items={[
              {
                key: 'password',
                label: t('pages.auth.passwordLogin'),
                children: (
                  <Form name="login" onFinish={onFinish} layout="vertical" className="shopee-login-form">
                    <Form.Item name="username" rules={[{ required: true, message: t('pages.auth.usernameRequired') }]}>
                      <Input prefix={<UserOutlined />} placeholder={t('pages.auth.username')} size="large" autoComplete="username" />
                    </Form.Item>
                    <Form.Item name="password" rules={[{ required: true, message: t('pages.auth.passwordRequired') }]}>
                      <Input.Password prefix={<LockOutlined />} placeholder={t('pages.auth.password')} size="large" autoComplete="current-password" />
                    </Form.Item>
                    <Form.Item>
                      <Button type="primary" htmlType="submit" block size="large" loading={loading}>
                        {t('pages.auth.login')}
                      </Button>
                    </Form.Item>
                  </Form>
                ),
              },
              {
                key: 'email',
                label: t('pages.auth.emailLogin'),
                children: (
                  <Form
                    form={emailForm}
                    name="email-login"
                    onFinish={onEmailLogin}
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
                      <MailOutlined />
                      <span>{t('pages.auth.emailLoginHint')}</span>
                    </div>
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
                      name="email"
                      className="shopee-login-form__field"
                      rules={[
                        { required: true, message: t('pages.auth.emailRequired') },
                        { type: 'email', message: t('pages.auth.emailInvalid') },
                      ]}
                    >
                      <Input
                        prefix={<MailOutlined />}
                        placeholder={t('pages.auth.email')}
                        size="large"
                        autoComplete="email"
                        allowClear
                        disabled={loading}
                        aria-label={t('pages.auth.email')}
                      />
                    </Form.Item>
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
                        maxLength={12}
                        autoComplete="one-time-code"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        enterKeyHint="done"
                        disabled={loading}
                        aria-label={t('pages.auth.verificationCode')}
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
                            disabled={loading || codeSending || sendCodeCountdown > 0}
                            onClick={sendEmailCode}
                            aria-label={codeSending
                              ? t('pages.auth.emailCodeSending')
                              : sendCodeCountdown > 0
                              ? t('pages.auth.resendIn', { seconds: sendCodeCountdown })
                              : t('pages.auth.sendCode')}
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
                        <SafetyCertificateOutlined />
                        {t('pages.auth.emailCodePrivacy')}
                      </span>
                      <span>
                        <MailOutlined />
                        {t('pages.auth.emailCodeFast')}
                      </span>
                    </div>
                    <Form.Item>
                      <Button className="shopee-login-emailSubmit" type="primary" htmlType="submit" block size="large" loading={loading} disabled={loading || codeSending || !canSubmitEmailCode}>
                        {verifyRetryCountdown > 0
                          ? t('pages.auth.emailCodeRetryIn', { seconds: verifyRetryCountdown })
                          : t('pages.auth.emailLogin')}
                      </Button>
                    </Form.Item>
                  </Form>
                ),
              },
            ]}
          />

          <div className="shopee-login-quickLinks">
            <button type="button" onClick={() => navigate('/track-order')}>
              <TruckOutlined />
              <span>{t('nav.trackOrder')}</span>
            </button>
            <Link to="/register">
              <CompassOutlined />
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
