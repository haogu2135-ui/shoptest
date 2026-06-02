import React, { useEffect, useRef, useState } from 'react';
import { Button, Form, Input, message } from 'antd';
import { CheckCircleOutlined, LockOutlined, MailOutlined, SafetyCertificateOutlined, UserOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { userApi } from '../api';
import { useAppConfig } from '../hooks/useAppConfig';
import { useLanguage } from '../i18n';
import './Login.css';

interface ForgotPasswordForm {
  login: string;
  email: string;
  code: string;
  newPassword: string;
  confirmPassword: string;
}

const normalizeEmail = (value: unknown) => String(value || '').trim().toLowerCase();
const normalizeEmailCode = (value: unknown) => String(value || '').replace(/\D+/g, '').slice(0, 6);
const maskEmail = (value: unknown) => {
  const email = normalizeEmail(value);
  const [name, domain] = email.split('@');
  if (!name || !domain) return email;
  return `${name.charAt(0)}***@${domain}`;
};

const ForgotPassword: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [codeSending, setCodeSending] = useState(false);
  const [sendCodeCountdown, setSendCodeCountdown] = useState(0);
  const [codeTtlMinutes, setCodeTtlMinutes] = useState(0);
  const [sentEmailHint, setSentEmailHint] = useState('');
  const [form] = Form.useForm<ForgotPasswordForm>();
  const codeInputRef = useRef<any>(null);
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { config: appConfig, loading: appConfigLoading } = useAppConfig();
  const emailCodeEnabled = appConfig.emailCodeEnabled === true;

  useEffect(() => {
    if (sendCodeCountdown <= 0) return undefined;
    const timer = window.setInterval(() => {
      setSendCodeCountdown((value) => Math.max(value - 1, 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [sendCodeCountdown]);

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

  const sendResetCode = async () => {
    if (!emailCodeEnabled) {
      message.warning(t('pages.auth.emailCodeUnavailable'));
      return;
    }
    try {
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

  const onFinish = async (values: ForgotPasswordForm) => {
    if (!emailCodeEnabled) {
      message.warning(t('pages.auth.emailCodeUnavailable'));
      return;
    }
    const normalizedCode = normalizeEmailCode(values.code);
    if (normalizedCode.length !== 6) {
      form.setFields([{ name: 'code', errors: [t('pages.auth.emailCodeLength')] }]);
      return;
    }
    setLoading(true);
    try {
      const normalizedEmail = normalizeEmail(values.email);
      form.setFieldsValue({ email: normalizedEmail, code: normalizedCode });
      await userApi.forgotPassword({
        login: values.login,
        email: normalizedEmail,
        code: normalizedCode,
        newPassword: values.newPassword,
      });
      message.success(t('pages.auth.resetSuccess'));
      navigate('/login');
    } catch (error: any) {
      const errorCode = error.response?.data?.code;
      if (errorCode === 'INVALID_CODE' || errorCode === 'TOO_MANY_ATTEMPTS') {
        const msg = errorCode === 'TOO_MANY_ATTEMPTS'
          ? t('pages.auth.emailCodeTooManyAttempts')
          : t('pages.auth.emailCodeInvalid');
        form.setFields([{ name: 'code', errors: [msg] }]);
        message.error(msg);
      } else {
        const msg = t('pages.auth.resetFailed');
        message.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="shopee-login-root shopee-login-root--reset">
      <section className="shopee-login-card shopee-login-card--reset">
        <div className="shopee-login-brand">
          <div className="shopee-login-mark">ShopMX</div>
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

        <Form form={form} name="forgotPassword" onFinish={onFinish} layout="vertical" className="shopee-login-form">
          {!emailCodeEnabled && !appConfigLoading && (
            <div className="shopee-login-emailHint shopee-login-emailHint--warning" role="status">
              <SafetyCertificateOutlined />
              <span>{t('pages.auth.emailCodeUnavailable')}</span>
            </div>
          )}
          <Form.Item name="login" rules={[{ required: true, message: t('pages.auth.usernameRequired') }]}>
            <Input prefix={<UserOutlined />} placeholder={t('pages.auth.username')} size="large" autoComplete="username" />
          </Form.Item>
          <Form.Item
            name="email"
            rules={[
              { required: true, message: t('pages.auth.emailRequired') },
              { type: 'email', message: t('pages.auth.emailInvalid') },
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder={t('pages.auth.email')} size="large" autoComplete="email" disabled={loading || !emailCodeEnabled} />
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
              disabled={loading || !emailCodeEnabled}
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
                  onClick={sendResetCode}
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
          <Form.Item
            name="newPassword"
            rules={[
              { required: true, message: t('pages.auth.newPasswordRequired') },
              { min: 8, max: 128, message: t('pages.auth.passwordMin') },
              { pattern: /^(?=.*[A-Za-z])(?=.*\d).+$/, message: t('pages.auth.passwordPattern') },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder={t('pages.auth.newPassword')} size="large" autoComplete="new-password" />
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
            <Input.Password prefix={<LockOutlined />} placeholder={t('pages.auth.confirmPassword')} size="large" autoComplete="new-password" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block size="large" loading={loading} disabled={codeSending || !emailCodeEnabled}>
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
