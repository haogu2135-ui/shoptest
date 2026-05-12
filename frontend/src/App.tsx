import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { Layout, Spin } from 'antd';
import CartDrawer from './components/CartDrawer';
import CustomerSupportWidget from './components/CustomerSupportWidget';
import Navbar from './components/Navbar';
import { useLanguage } from './i18n';
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

const App: React.FC = () => {
  const { t } = useLanguage();

  return (
    <Router>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route
            element={
              <Layout style={{ minHeight: '100vh', background: '#f5f5f5' }}>
                <Navbar />
                <Content style={{ marginTop: 0, padding: 0 }}>
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/products" element={<ProductList />} />
                    <Route path="/pet-finder" element={<PetFinder />} />
                    <Route path="/pet-gallery" element={<PetGallery />} />
                    <Route path="/compare" element={<ProductCompare />} />
                    <Route path="/products/:id" element={<ProductDetail />} />
                    <Route path="/cart" element={<Cart />} />
                    <Route path="/checkout" element={<Checkout />} />
                    <Route path="/coupons" element={<CouponCenter />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/wishlist" element={<Wishlist />} />
                    <Route path="/history" element={<BrowsingHistory />} />
                    <Route path="/stock-alerts" element={<StockAlerts />} />
                    <Route path="/notifications" element={<Notifications />} />
                    <Route path="/track-order" element={<OrderTracking />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/register" element={<Register />} />
                  </Routes>
                </Content>
                <Footer className="shop-footer">
                  <div className="shop-footer__inner">
                    <div className="shop-footer__columns">
                      <div>
                        <h3>{t('footer.customerCare')}</h3>
                        <p>{t('footer.helpCenter')}</p>
                        <p>{t('footer.howToBuy')}</p>
                        <p>{t('footer.returns')}</p>
                      </div>
                      <div>
                        <h3>{t('footer.about')}</h3>
                        <p>{t('footer.dailyDeals')}</p>
                        <p>{t('footer.sellers')}</p>
                        <p>{t('footer.policies')}</p>
                      </div>
                      <div>
                        <h3>{t('footer.payments')}</h3>
                        <p>{t('footer.methods')}</p>
                        <p>{t('footer.shipping')}</p>
                        <p>{t('footer.tracking')}</p>
                      </div>
                    </div>
                    <div className="shop-footer__copy">{t('footer.rights')}</div>
                  </div>
                </Footer>
                <CartDrawer />
                <CustomerSupportWidget />
              </Layout>
            }
          >
            <Route path="*" element={null} />
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
