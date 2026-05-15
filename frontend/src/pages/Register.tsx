import React from 'react';
import { Form, Input, Button, Card, Typography, message, Space, Tag } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, PhoneOutlined, SafetyCertificateOutlined, GiftOutlined, TruckOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { userApi } from '../api';
import { useLanguage } from '../i18n';
import './Register.css';

const { Text, Title } = Typography;

interface RegisterForm {
  username: string;
  password: string;
  confirmPassword: string;
  email: string;
  phone: string;
}

const phonePattern = /^(\+?\d[\d\s().-]{7,20})$/;

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const onFinish = async (values: RegisterForm) => {
    try {
      await userApi.register({
        username: values.username,
        password: values.password,
        email: values.email,
        phone: values.phone,
        role: 'USER'
      });
      message.success(t('pages.auth.registerSuccess'));
      navigate('/login');
    } catch (error: any) {
      const msg = error.response?.data?.error || t('pages.auth.registerFailed');
      message.error(msg);
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
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              { required: true, message: t('pages.auth.passwordRequired') },
              { min: 6, message: t('pages.auth.passwordMin') }
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder={t('pages.auth.password')}
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
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block>
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
