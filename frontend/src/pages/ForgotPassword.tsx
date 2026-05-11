import React, { useState } from 'react';
import { Button, Form, Input, message } from 'antd';
import { LockOutlined, MailOutlined, UserOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { userApi } from '../api';
import { useLanguage } from '../i18n';
import './Login.css';

interface ForgotPasswordForm {
  login: string;
  email: string;
  newPassword: string;
  confirmPassword: string;
}

const ForgotPassword: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { t } = useLanguage();

  const onFinish = async (values: ForgotPasswordForm) => {
    setLoading(true);
    try {
      await userApi.forgotPassword({
        login: values.login,
        email: values.email,
        newPassword: values.newPassword,
      });
      message.success(t('pages.auth.resetSuccess'));
      navigate('/login');
    } catch (error: any) {
      const msg = error.response?.data?.error || t('pages.auth.resetFailed');
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="shopee-login-root">
      <section className="shopee-login-card">
        <div className="shopee-login-brand">
          <div className="shopee-login-mark">ShopMX</div>
          <div className="shopee-login-subtitle">{t('pages.auth.resetPasswordTitle')}</div>
        </div>

        <Form name="forgotPassword" onFinish={onFinish} layout="vertical" className="shopee-login-form">
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
            <Input prefix={<MailOutlined />} placeholder={t('pages.auth.email')} size="large" autoComplete="email" />
          </Form.Item>
          <Form.Item
            name="newPassword"
            rules={[
              { required: true, message: t('pages.auth.newPasswordRequired') },
              { min: 6, message: t('pages.auth.passwordMin') },
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
            <Button type="primary" htmlType="submit" block size="large" loading={loading}>
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
