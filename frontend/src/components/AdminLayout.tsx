import React, { useEffect, useState } from 'react';
import { Badge, Layout, Menu, Spin, Button, Typography, message } from 'antd';
import {
  DashboardOutlined, ShopOutlined, AppstoreOutlined,
  ShoppingOutlined, TeamOutlined, StarOutlined,
  ArrowLeftOutlined, LogoutOutlined, CustomerServiceOutlined, GiftOutlined,
  NotificationOutlined, TagsOutlined, TruckOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { adminSupportApi, userApi } from '../api';
import { useLanguage } from '../i18n';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [supportUnread, setSupportUnread] = useState(0);
  const { t } = useLanguage();

  const menuItems = [
    { key: '/admin/dashboard', icon: <DashboardOutlined />, label: t('adminLayout.dashboard') },
    { key: '/admin/products', icon: <ShopOutlined />, label: t('adminLayout.products') },
    { key: '/admin/brands', icon: <TagsOutlined />, label: t('adminLayout.brands') },
    { key: '/admin/categories', icon: <AppstoreOutlined />, label: t('adminLayout.categories') },
    { key: '/admin/orders', icon: <ShoppingOutlined />, label: t('adminLayout.orders') },
    { key: '/admin/logistics-carriers', icon: <TruckOutlined />, label: t('adminLayout.logisticsCarriers') },
    { key: '/admin/users', icon: <TeamOutlined />, label: t('adminLayout.users') },
    { key: '/admin/reviews', icon: <StarOutlined />, label: t('adminLayout.reviews') },
    { key: '/admin/coupons', icon: <GiftOutlined />, label: t('adminLayout.coupons') },
    { key: '/admin/notifications', icon: <NotificationOutlined />, label: t('adminLayout.notifications') },
    { key: '/admin/audit-logs', icon: <SafetyCertificateOutlined />, label: t('adminLayout.auditLogs') },
    {
      key: '/admin/support',
      icon: <CustomerServiceOutlined />,
      label: (
        <span>
          {t('adminLayout.support')}
          {supportUnread > 0 ? <Badge count={supportUnread} size="small" style={{ marginLeft: 8 }} /> : null}
        </span>
      ),
    },
  ];

  useEffect(() => {
    const checkAdmin = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        message.warning(t('messages.loginRequired'));
        navigate('/login');
        return;
      }
      try {
        const res = await userApi.getProfile();
        if (res.data.role !== 'ADMIN') {
          message.error(t('adminLayout.noPermission'));
          navigate('/');
          return;
        }
        setChecking(false);
      } catch {
        message.error(t('adminLayout.verifyFailed'));
        navigate('/login');
      }
    };
    checkAdmin();
  }, [navigate, t]);

  useEffect(() => {
    if (checking) return;
    const loadUnread = () => {
      adminSupportApi.getUnreadCount()
        .then((res) => setSupportUnread(res.data.count))
        .catch(() => setSupportUnread(0));
    };
    loadUnread();
    const timer = window.setInterval(loadUnread, 15000);
    return () => window.clearInterval(timer);
  }, [checking, location.pathname]);

  const handleLogout = () => {
    userApi.logout().catch(() => undefined);
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    navigate('/login');
  };

  if (checking) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip={t('adminLayout.checking')} />
      </div>
    );
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="dark"
        width={200}
      >
        <div style={{ height: 48, margin: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Title level={4} style={{ color: '#fff', margin: 0, whiteSpace: 'nowrap' }}>
            {collapsed ? t('adminLayout.titleShort') : t('adminLayout.title')}
          </Title>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{
          background: '#fff',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 1px 4px rgba(0,0,0,.08)',
        }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ArrowLeftOutlined />
            <span>{t('adminLayout.backStore')}</span>
          </Link>
          <Button icon={<LogoutOutlined />} onClick={handleLogout} type="text" danger>
            {t('adminLayout.logout')}
          </Button>
        </Header>
        <Content style={{ margin: 24, padding: 24, background: '#f5f5f5', minHeight: 280 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default AdminLayout;
