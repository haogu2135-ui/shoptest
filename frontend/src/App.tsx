import React from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from 'antd';
import AdminDashboard from './pages/AdminDashboard';
import AdminLayout from './components/AdminLayout';
import BrandManagement from './pages/BrandManagement';
import Cart from './pages/Cart';
import CartDrawer from './components/CartDrawer';
import CategoryManagement from './pages/CategoryManagement';
import Checkout from './pages/Checkout';
import CouponCenter from './pages/CouponCenter';
import CouponManagement from './pages/CouponManagement';
import CustomerSupportWidget from './components/CustomerSupportWidget';
import ForgotPassword from './pages/ForgotPassword';
import Home from './pages/Home';
import Login from './pages/Login';
import LogisticsCarrierManagement from './pages/LogisticsCarrierManagement';
import Navbar from './components/Navbar';
import Notifications from './pages/Notifications';
import NotificationManagement from './pages/NotificationManagement';
import OrderTracking from './pages/OrderTracking';
import OrderManagement from './pages/OrderManagement';
import ProductDetail from './pages/ProductDetail';
import ProductList from './pages/ProductList';
import ProductManagement from './pages/ProductManagement';
import Profile from './pages/Profile';
import Register from './pages/Register';
import ReviewManagement from './pages/ReviewManagement';
import SupportManagement from './pages/SupportManagement';
import UserManagement from './pages/UserManagement';
import Wishlist from './pages/Wishlist';
import { useLanguage } from './i18n';
import './App.css';

const { Content, Footer } = Layout;

const App: React.FC = () => {
  const { t } = useLanguage();

  return (
    <Router>
      <Routes>
        <Route
          element={
            <Layout style={{ minHeight: '100vh', background: '#f5f5f5' }}>
              <Navbar />
              <Content style={{ marginTop: 0, padding: 0 }}>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/products" element={<ProductList />} />
                  <Route path="/products/:id" element={<ProductDetail />} />
                  <Route path="/cart" element={<Cart />} />
                  <Route path="/checkout" element={<Checkout />} />
                  <Route path="/coupons" element={<CouponCenter />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/wishlist" element={<Wishlist />} />
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
        </Route>

        <Route path="/product-management" element={<Navigate to="/admin/products" replace />} />
        <Route path="/category-management" element={<Navigate to="/admin/categories" replace />} />
      </Routes>
    </Router>
  );
};

export default App;
