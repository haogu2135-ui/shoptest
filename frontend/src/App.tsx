import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Link, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { Layout, Spin } from 'antd';
import { GiftOutlined, UserAddOutlined, FileSearchOutlined } from '@ant-design/icons';
import CartDrawer from './components/CartDrawer';
import CustomerSupportWidget from './components/CustomerSupportWidget';
import Navbar from './components/Navbar';
import { useLanguage } from './i18n';
import { dispatchDomEvent } from './utils/domEvents';
import { hasStoredValue } from './utils/safeStorage';
import './App.css';

const { Content, Footer } = Layout;

const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminLayout = lazy(() => import('./components/AdminLayout'));
const BrandManagement = lazy(() => import('./pages/BrandManagement'));
const BrowsingHistory = lazy(() => import('./pages/BrowsingHistory'));
const Cart = lazy(() => import('./pages/Cart'));
const CategoryManagement = lazy(() => import('./pages/CategoryManagement'));
const Checkout = lazy(() => import('./pages/Checkout'));
const CouponCenter = lazy(() => import('./pages/CouponCenter'));
const CouponManagement = lazy(() => import('./pages/CouponManagement'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const LogisticsCarrierManagement = lazy(() => import('./pages/LogisticsCarrierManagement'));
const Notifications = lazy(() => import('./pages/Notifications'));
const NotificationManagement = lazy(() => import('./pages/NotificationManagement'));
const OrderManagement = lazy(() => import('./pages/OrderManagement'));
const OrderTracking = lazy(() => import('./pages/OrderTracking'));
const PetFinder = lazy(() => import('./pages/PetFinder'));
const PetGallery = lazy(() => import('./pages/PetGallery'));
const PermissionManagement = lazy(() => import('./pages/PermissionManagement'));
const ProductCompare = lazy(() => import('./pages/ProductCompare'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const ProductList = lazy(() => import('./pages/ProductList'));
const ProductManagement = lazy(() => import('./pages/ProductManagement'));
const Profile = lazy(() => import('./pages/Profile'));
const Register = lazy(() => import('./pages/Register'));
const ReviewManagement = lazy(() => import('./pages/ReviewManagement'));
const SecurityAuditLogManagement = lazy(() => import('./pages/SecurityAuditLogManagement'));
const StockAlerts = lazy(() => import('./pages/StockAlerts'));
const SupportManagement = lazy(() => import('./pages/SupportManagement'));
const UserManagement = lazy(() => import('./pages/UserManagement'));
const Wishlist = lazy(() => import('./pages/Wishlist'));

const LoadingFallback = () => (
  <div className="app-route-loading">
    <Spin size="large" />
  </div>
);

const RouteScrollReset: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  useEffect(() => {
    if (location.hash) return;

    const resetScroll = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    resetScroll();
    const frameId = window.requestAnimationFrame(resetScroll);
    const timeoutId = window.setTimeout(resetScroll, 120);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [location.pathname, location.search, location.hash]);

  return null;
};

const StorefrontLayout: React.FC = () => {
  const { t } = useLanguage();
  const isAuthenticated = hasStoredValue('token');
  const footerActionCards = [
    {
      key: 'track',
      to: '/track-order',
      icon: <FileSearchOutlined />,
      title: t('nav.trackOrder'),
      text: t('pages.auth.loginTrustTracking'),
    },
    {
      key: 'coupons',
      to: '/coupons',
      icon: <GiftOutlined />,
      title: t('home.couponsExtra'),
      text: t('nav.download'),
    },
    isAuthenticated
      ? {
        key: 'orders',
        to: '/profile?tab=orders',
        icon: <FileSearchOutlined />,
        title: t('pages.profile.allOrders'),
        text: t('pages.auth.loginTrustSecure'),
      }
      : {
        key: 'register',
        to: '/register',
        icon: <UserAddOutlined />,
        title: t('nav.register'),
        text: t('pages.auth.registerTrustPerks'),
      },
  ];

  return (
    <Layout className="shop-app-shell" style={{ minHeight: '100vh' }}>
      <Navbar />
      <Content style={{ marginTop: 0, padding: 0 }}>
        <Outlet />
      </Content>
      <Footer className="shop-footer">
        <div className="shop-footer__inner">
          <div className="shop-footer__ctaStrip">
            {footerActionCards.map((card) => (
              <Link key={card.key} to={card.to} className="shop-footer__ctaCard">
                <span className={`shop-footer__ctaIcon shop-footer__ctaIcon--${card.key}`}>{card.icon}</span>
                <span className="shop-footer__ctaCopy">
                  <strong>{card.title}</strong>
                  <span>{card.text}</span>
                </span>
              </Link>
            ))}
          </div>
          <div className="shop-footer__columns">
            <div>
              <h3>{t('footer.customerCare')}</h3>
              <Link to="/track-order">{t('footer.tracking')}</Link>
              <Link to="/products">{t('footer.howToBuy')}</Link>
              <button type="button" onClick={() => dispatchDomEvent('shop:open-support')}>{t('footer.helpCenter')}</button>
            </div>
            <div>
              <h3>{t('footer.about')}</h3>
              <Link to="/products?keyword=deal">{t('footer.dailyDeals')}</Link>
              <Link to="/pet-finder">{t('nav.petFinder')}</Link>
              <Link to="/pet-gallery">{t('nav.petGallery')}</Link>
            </div>
            <div>
              <h3>{t('footer.payments')}</h3>
              <Link to="/coupons">{t('nav.download')}</Link>
              <Link to="/track-order">{t('footer.shipping')}</Link>
              <Link to="/profile?tab=orders">{t('footer.returns')}</Link>
            </div>
          </div>
          <div className="shop-footer__copy">{t('footer.rights')}</div>
        </div>
      </Footer>
      <CartDrawer />
      <CustomerSupportWidget />
    </Layout>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <RouteScrollReset />
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<StorefrontLayout />}>
            <Route index element={<Home />} />
            <Route path="products" element={<ProductList />} />
            <Route path="pet-finder" element={<PetFinder />} />
            <Route path="pet-gallery" element={<PetGallery />} />
            <Route path="compare" element={<ProductCompare />} />
            <Route path="products/:id" element={<ProductDetail />} />
            <Route path="cart" element={<Cart />} />
            <Route path="checkout" element={<Checkout />} />
            <Route path="coupons" element={<CouponCenter />} />
            <Route path="profile" element={<Profile />} />
            <Route path="wishlist" element={<Wishlist />} />
            <Route path="history" element={<BrowsingHistory />} />
            <Route path="stock-alerts" element={<StockAlerts />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="track-order" element={<OrderTracking />} />
            <Route path="login" element={<Login />} />
            <Route path="forgot-password" element={<ForgotPassword />} />
            <Route path="register" element={<Register />} />
          </Route>

          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="products" element={<ProductManagement />} />
            <Route path="brands" element={<BrandManagement />} />
            <Route path="categories" element={<CategoryManagement />} />
            <Route path="orders" element={<OrderManagement />} />
            <Route path="logistics-carriers" element={<LogisticsCarrierManagement />} />
            <Route path="coupons" element={<CouponManagement />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="permissions" element={<PermissionManagement />} />
            <Route path="reviews" element={<ReviewManagement />} />
            <Route path="notifications" element={<NotificationManagement />} />
            <Route path="support" element={<SupportManagement />} />
            <Route path="audit-logs" element={<SecurityAuditLogManagement />} />
          </Route>

          <Route path="/product-management" element={<Navigate to="/admin/products" replace />} />
          <Route path="/category-management" element={<Navigate to="/admin/categories" replace />} />
        </Routes>
      </Suspense>
    </Router>
  );
};

export default App;
