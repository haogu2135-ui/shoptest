import React, { useState } from 'react';
import { Form, Input, Button, Typography, message } from 'antd';
import { CompassOutlined, LockOutlined, SafetyCertificateOutlined, ShoppingCartOutlined, TruckOutlined, UserOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { cartApi, userApi } from '../api';
import { useLanguage } from '../i18n';
import { getGuestCartItems, replaceGuestCartItems } from '../utils/guestCart';
import { getEffectiveRole } from '../utils/roles';
import './Login.css';

const { Text, Title } = Typography;

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { t } = useLanguage();
  const guestCartCount = getGuestCartItems().reduce((sum, item) => sum + item.quantity, 0);

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

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const response = await userApi.login(values.username, values.password);
      const { token, id, username, role, roleCode } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('userId', id);
      localStorage.setItem('username', username);
      localStorage.setItem('role', getEffectiveRole(role, roleCode));
      localStorage.removeItem('adminDefaultPath');
      await mergeGuestCart(Number(id));
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
