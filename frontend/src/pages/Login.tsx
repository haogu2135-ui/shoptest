import React, { useState } from 'react';
import { Form, Input, Button, message } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { userApi } from '../api';
import { useLanguage } from '../i18n';
import './Login.css';

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { t } = useLanguage();

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const response = await userApi.login(values.username, values.password);
      const { token, id, username, role } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('userId', id);
      localStorage.setItem('username', username);
      localStorage.setItem('role', role);
      message.success(t('pages.auth.loginSuccess'));
      navigate('/');
    } catch {
      message.error(t('pages.auth.loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="shopee-login-root">
      <section className="shopee-login-card">
        <div className="shopee-login-brand">
          <div className="shopee-login-mark">ShopMX</div>
          <div className="shopee-login-subtitle">{t('pages.auth.loginTitle')}</div>
        </div>

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

        <div className="shopee-login-links">
          <Link to="/forgot-password">{t('pages.auth.forgotPassword')}</Link>
          <Link to="/register">{t('pages.auth.register')}</Link>
        </div>
      </section>
    </main>
  );
};

export default Login;
