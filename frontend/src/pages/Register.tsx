import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, message, Space, Tag } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, PhoneOutlined, SafetyCertificateOutlined, GiftOutlined, TruckOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { userApi } from '../api';
import { useLanguage } from '../i18n';
import { setSessionStorageItem } from '../utils/safeStorage';
import { getApiErrorMessage } from '../utils/apiError';
import './Register.css';

const { Text, Title } = Typography;

interface RegisterForm {
  username: string;
  password: string;
  confirmPassword: string;
  email: string;
  phone: string;
}

const phonePattern = /^(?=(?:.*\d){8,20})(\+?[\d\s().-]{8,32})$/;
const stripControlChars = (value: unknown) => String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ');
const normalizeUsername = (value: unknown) => stripControlChars(value).replace(/\s+/g, '').trim();
const normalizeEmail = (value: unknown) => stripControlChars(value).trim().toLowerCase();
const normalizePhone = (value: unknown) => {
  const normalized = stripControlChars(value).trim();
  return normalized.startsWith('+') ? `+${normalized.slice(1).replace(/\D+/g, '')}` : normalized.replace(/\D+/g, '');
};
const uniqueLoginCandidates = (...values: unknown[]) => Array.from(new Set(
  values
    .map((value) => String(value || '').trim())
    .filter(Boolean),
));

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [form] = Form.useForm<RegisterForm>();
  const [registering, setRegistering] = useState(false);

  const onFinish = async (values: RegisterForm) => {
    if (registering) return;
    setRegistering(true);
    try {
      const username = normalizeUsername(values.username);
      const email = normalizeEmail(values.email);
      const phone = normalizePhone(values.phone);
      form.setFieldsValue({ username, email, phone });
      const response = await userApi.register({
        username,
        password: values.password,
        email,
        phone,
        role: 'USER'
      });
      const responseUsername = normalizeUsername(response.data?.username);
      const responseEmail = normalizeEmail(response.data?.email);
      const responsePhone = normalizePhone(response.data?.phone);
      const loginCandidates = uniqueLoginCandidates(responseUsername, username, responseEmail, email, responsePhone, phone);
      const registeredLogin = loginCandidates[0] || username || email || phone;
      setSessionStorageItem('loginPrefill', registeredLogin);
      setSessionStorageItem('loginCandidates', JSON.stringify(loginCandidates));
      message.success(t('pages.auth.registerSuccess'));
      navigate('/login');
    } catch (error: any) {
      const rawMessage = String(error.response?.data?.error || '').trim();
      const normalizedMessage = rawMessage.toLowerCase();
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
      message.error(msg);
    } finally {
      setRegistering(false);
    }
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
            <Button type="primary" size="large" onClick={() => navigate('/login')}>
              {t('pages.auth.loginNow')}
            </Button>
            <Button ghost size="large" onClick={() => navigate('/track-order')}>
              {t('nav.trackOrder')}
            </Button>
          </div>
        </div>
      </section>
      <Card className="register-page__card">
        <div className="register-page__cardHeader">
          <div className="register-page__brand">ShopMX</div>
          <Text className="register-page__cardHint">{t('pages.auth.registerPrivacyHint')}</Text>
        </div>
        <Title level={2} className="register-page__title">
          {t('pages.auth.registerTitle')}
        </Title>
        <Form
          form={form}
          name="register"
          onFinish={onFinish}
          size="large"
        >
          <Form.Item
            name="username"
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
              onBlur={(event) => form.setFieldValue('username', normalizeUsername(event.target.value))}
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              { required: true, message: t('pages.auth.passwordRequired') },
              { min: 8, max: 128, message: t('pages.auth.passwordMin') },
              { pattern: /^(?=.*[A-Za-z])(?=.*\d).+$/, message: t('pages.auth.passwordPattern') }
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder={t('pages.auth.password')}
              autoComplete="new-password"
              maxLength={128}
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
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
            />
          </Form.Item>

          <Form.Item
            name="email"
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
              onBlur={(event) => form.setFieldValue('email', normalizeEmail(event.target.value))}
            />
          </Form.Item>

          <Form.Item
            name="phone"
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
              onBlur={(event) => form.setFieldValue('phone', normalizePhone(event.target.value))}
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={registering} disabled={registering}>
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
