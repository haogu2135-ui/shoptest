import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { BrowserRouter as Router, Link, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { Layout, Spin } from 'antd';
import { CustomerServiceOutlined, GiftOutlined, UserAddOutlined, FileSearchOutlined } from '@ant-design/icons';
import Navbar from './components/Navbar';
import ErrorBoundary from './components/ErrorBoundary';
import CustomerSupportWidget from './components/CustomerSupportWidget';
import { useLanguage } from './i18n';
import type { CartItem } from './types';
import { dispatchDomEvent } from './utils/domEvents';
import { hasStoredValue } from './utils/safeStorage';
import { loadGuestSupportContext, normalizeGuestSupportContext, saveGuestSupportContext } from './utils/guestSupportContext';
import './App.css';

const { Content, Footer } = Layout;

const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminLayout = lazy(() => import('./components/AdminLayout'));
const AlertManagement = lazy(() => import('./pages/AlertManagement'));
const AnnouncementManagement = lazy(() => import('./pages/AnnouncementManagement'));
const BrandManagement = lazy(() => import('./pages/BrandManagement'));
const BrowsingHistory = lazy(() => import('./pages/BrowsingHistory'));
const Cart = lazy(() => import('./pages/Cart'));
const CategoryManagement = lazy(() => import('./pages/CategoryManagement'));
const Checkout = lazy(() => import('./pages/Checkout'));
const ConfigCenter = lazy(() => import('./pages/ConfigCenter'));
const CouponCenter = lazy(() => import('./pages/CouponCenter'));
const CouponManagement = lazy(() => import('./pages/CouponManagement'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const IpBlacklistManagement = lazy(() => import('./pages/IpBlacklistManagement'));
const LogisticsCarrierManagement = lazy(() => import('./pages/LogisticsCarrierManagement'));
const LogManagement = lazy(() => import('./pages/LogManagement'));
const Notifications = lazy(() => import('./pages/Notifications'));
const NotificationManagement = lazy(() => import('./pages/NotificationManagement'));
const OrderManagement = lazy(() => import('./pages/OrderManagement'));
const OrderTracking = lazy(() => import('./pages/OrderTracking'));
const PaymentInstructions = lazy(() => import('./pages/PaymentInstructions'));
const PetFinder = lazy(() => import('./pages/PetFinder'));
const PetGallery = lazy(() => import('./pages/PetGallery'));
const PermissionManagement = lazy(() => import('./pages/PermissionManagement'));
const ProductCompare = lazy(() => import('./pages/ProductCompare'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const ProductList = lazy(() => import('./pages/ProductList'));
const ProductManagement = lazy(() => import('./pages/ProductManagement'));
const ProductQuestionManagement = lazy(() => import('./pages/ProductQuestionManagement'));
const Profile = lazy(() => import('./pages/Profile'));
const Register = lazy(() => import('./pages/Register'));
const RegistryManagement = lazy(() => import('./pages/RegistryManagement'));
const ReviewManagement = lazy(() => import('./pages/ReviewManagement'));
const SecurityAuditLogManagement = lazy(() => import('./pages/SecurityAuditLogManagement'));
const StockAlerts = lazy(() => import('./pages/StockAlerts'));
const SupportManagement = lazy(() => import('./pages/SupportManagement'));
const SystemMonitor = lazy(() => import('./pages/SystemMonitor'));
const TrafficControl = lazy(() => import('./pages/TrafficControl'));
const UserManagement = lazy(() => import('./pages/UserManagement'));
const Wishlist = lazy(() => import('./pages/Wishlist'));
const NotFound = lazy(() => import('./pages/NotFound'));
const loadCartDrawer = () => import('./components/CartDrawer');
const LazyCartDrawer = lazy(loadCartDrawer);

type CartDrawerOpenRequest = {
  id: number;
  items?: CartItem[];
};

type SupportOpenRequest = {
  id: number;
  guestOrderNo?: string;
  guestEmail?: string;
};

type SupportOpenDetail = {
  orderNo?: string;
  email?: string;
  guestOrderNo?: string;
  guestEmail?: string;
};

type SupportWidgetBoundaryProps = {
  fallback: React.ReactNode;
  resetKey?: number;
  children: React.ReactNode;
};

type SupportWidgetBoundaryState = {
  hasError: boolean;
};

class SupportWidgetBoundary extends React.Component<SupportWidgetBoundaryProps, SupportWidgetBoundaryState> {
  state: SupportWidgetBoundaryState = { hasError: false };

  static getDerivedStateFromError(): SupportWidgetBoundaryState {
    return { hasError: true };
  }

  componentDidUpdate(previousProps: SupportWidgetBoundaryProps) {
    if (this.state.hasError && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  componentDidCatch(error: Error) {
    console.error('Support widget failed to load:', error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

const getSupportOpenDetail = (event?: Event): SupportOpenDetail | null => {
  const detail = event && 'detail' in event ? (event as CustomEvent<SupportOpenDetail>).detail : null;
  const normalized = normalizeGuestSupportContext(detail);
  return normalized ? { guestOrderNo: normalized.orderNo, guestEmail: normalized.email } : null;
};

const toSupportOpenDetail = (context: ReturnType<typeof loadGuestSupportContext>): SupportOpenDetail | null =>
  context ? { guestOrderNo: context.orderNo, guestEmail: context.email } : null;

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

const LazyCartDrawerHost: React.FC = () => {
  const [loaded, setLoaded] = useState(false);
  const [drawerReady, setDrawerReady] = useState(false);
  const [openRequest, setOpenRequest] = useState<CartDrawerOpenRequest | null>(null);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    if (drawerReady) return undefined;
    const handleOpenCart = (event: Event) => {
      const detailItems = (event as CustomEvent<{ items?: CartItem[] }>).detail?.items;
      requestSeqRef.current += 1;
      setOpenRequest({
        id: requestSeqRef.current,
        items: Array.isArray(detailItems) ? detailItems : undefined,
      });
      setLoaded(true);
    };
    const preloadCart = () => {
      setLoaded(true);
      void loadCartDrawer();
    };
    window.addEventListener('shop:open-cart', handleOpenCart);
    window.addEventListener('shop:cart-updated', preloadCart);
    return () => {
      window.removeEventListener('shop:open-cart', handleOpenCart);
      window.removeEventListener('shop:cart-updated', preloadCart);
    };
  }, [drawerReady]);

  const handleDrawerReady = useCallback(() => setDrawerReady(true), []);

  if (!loaded) return null;

  return (
    <Suspense fallback={null}>
      <LazyCartDrawer
        initialOpenRequest={openRequest}
        onReady={handleDrawerReady}
      />
    </Suspense>
  );
};

const SupportLauncherButton: React.FC<{ loading?: boolean; onOpen: () => void; onPreload?: () => void }> = ({ loading = false, onOpen, onPreload }) => {
  const { t } = useLanguage();

  return (
    <button
      type="button"
      className={`app-support-launcher${loading ? ' app-support-launcher--loading' : ''}`}
      onClick={onOpen}
      onFocus={onPreload}
      onPointerEnter={onPreload}
      aria-label={t('pages.support.title')}
      aria-busy={loading}
    >
      <CustomerServiceOutlined />
    </button>
  );
};

const LazySupportWidgetHost: React.FC = () => {
  const [loaded, setLoaded] = useState(false);
  const [widgetReady, setWidgetReady] = useState(false);
  const [openRequest, setOpenRequest] = useState<SupportOpenRequest | null>(null);
  const requestSeqRef = useRef(0);

  const openSupport = useCallback((event?: Event) => {
    const guestDetail = getSupportOpenDetail(event) || toSupportOpenDetail(loadGuestSupportContext());
    if (guestDetail) {
      saveGuestSupportContext({ orderNo: guestDetail.guestOrderNo || '', email: guestDetail.guestEmail || '' });
    }
    requestSeqRef.current += 1;
    setOpenRequest({ id: requestSeqRef.current, ...(guestDetail || {}) });
    setLoaded(true);
  }, []);

  const preloadSupport = useCallback(() => undefined, []);

  useEffect(() => {
    if (widgetReady) return undefined;
    window.addEventListener('shop:open-support', openSupport);
    return () => window.removeEventListener('shop:open-support', openSupport);
  }, [openSupport, widgetReady]);

  const handleWidgetReady = useCallback(() => setWidgetReady(true), []);

  if (!loaded) {
    return <SupportLauncherButton onOpen={openSupport} onPreload={preloadSupport} />;
  }

  return (
    <>
      {!widgetReady ? <SupportLauncherButton loading onOpen={openSupport} onPreload={preloadSupport} /> : null}
      <SupportWidgetBoundary
        resetKey={openRequest?.id}
        fallback={<SupportLauncherButton onOpen={openSupport} onPreload={preloadSupport} />}
      >
        <CustomerSupportWidget
          initialOpenRequest={openRequest}
          onReady={handleWidgetReady}
        />
      </SupportWidgetBoundary>
    </>
  );
};

const StorefrontLayout: React.FC = () => {
  const { t } = useLanguage();
  const location = useLocation();
  const isAuthenticated = hasStoredValue('token');
  const openSupport = useCallback(() => {
    const guestDetail = toSupportOpenDetail(loadGuestSupportContext());
    dispatchDomEvent('shop:open-support', guestDetail || undefined);
  }, []);
  const shellClassName = [
    'shop-app-shell',
    location.pathname === '/products' ? 'shop-app-shell--product-list' : '',
    location.pathname === '/products' || location.pathname.startsWith('/products/') ? 'shop-app-shell--product-area' : '',
    location.pathname.startsWith('/products/') ? 'shop-app-shell--product-detail' : '',
    location.pathname === '/cart' ? 'shop-app-shell--cart' : '',
    location.pathname === '/checkout' ? 'shop-app-shell--checkout' : '',
    location.pathname === '/history' ? 'shop-app-shell--history' : '',
    location.pathname === '/cart' || location.pathname === '/checkout' ? 'shop-app-shell--checkout-flow' : '',
    ['/login', '/register', '/forgot-password'].includes(location.pathname) ? 'shop-app-shell--auth-flow' : '',
  ].filter(Boolean).join(' ');
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
    <Layout className={shellClassName} style={{ minHeight: '100vh' }}>
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
              <button type="button" onClick={openSupport}>{t('footer.helpCenter')}</button>
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
      <LazyCartDrawerHost />
      <LazySupportWidgetHost />
    </Layout>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <RouteScrollReset />
      <ErrorBoundary>
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
              <Route path="payment/:orderNo" element={<PaymentInstructions />} />
              <Route path="login" element={<Login />} />
              <Route path="forgot-password" element={<ForgotPassword />} />
              <Route path="register" element={<Register />} />
              <Route path="*" element={<NotFound />} />
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
              <Route path="questions" element={<ProductQuestionManagement />} />
              <Route path="notifications" element={<NotificationManagement />} />
              <Route path="announcements" element={<AnnouncementManagement />} />
              <Route path="support" element={<SupportManagement />} />
              <Route path="audit-logs" element={<SecurityAuditLogManagement />} />
              <Route path="alerts" element={<AlertManagement />} />
              <Route path="ip-blacklist" element={<IpBlacklistManagement />} />
              <Route path="logs" element={<LogManagement />} />
              <Route path="registry" element={<RegistryManagement />} />
              <Route path="config-center" element={<ConfigCenter />} />
              <Route path="traffic-control" element={<TrafficControl />} />
              <Route path="system" element={<SystemMonitor />} />
              <Route path="*" element={<NotFound />} />
            </Route>

            <Route path="/product-management" element={<Navigate to="/admin/products" replace />} />
            <Route path="/category-management" element={<Navigate to="/admin/categories" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </Router>
  );
};

export default App;
