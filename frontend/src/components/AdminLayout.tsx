import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Layout, Menu, Spin, Button, Typography, message } from 'antd';
import {
  DashboardOutlined, ShopOutlined, AppstoreOutlined,
  ShoppingOutlined, TeamOutlined, StarOutlined, QuestionCircleOutlined,
  ArrowLeftOutlined, LogoutOutlined, CustomerServiceOutlined, GiftOutlined,
  NotificationOutlined, TagsOutlined, TruckOutlined, SoundOutlined,
  SafetyCertificateOutlined, ApiOutlined, SettingOutlined, CloudSyncOutlined, FileTextOutlined, ThunderboltOutlined, AlertOutlined, StopOutlined, CameraOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { adminApi, adminSupportApi, clearStoredAuthSession, userApi } from '../api';
import { useLanguage } from '../i18n';
import { buildLoginUrlFromWindow } from '../utils/authRedirect';
import { getEffectiveRole, isAdminRole, isSuperAdminRole } from '../utils/roles';
import { getLocalStorageItem, setLocalStorageItem } from '../utils/safeStorage';
import ErrorBoundary from './ErrorBoundary';
import SkipToContentLink, { MAIN_CONTENT_ID } from './SkipToContentLink';
import './AdminLayout.css';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [supportUnread, setSupportUnread] = useState(0);
  const [currentRole, setCurrentRole] = useState<string>('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const { t } = useLanguage();
  const isSuperAdmin = isSuperAdminRole(currentRole);

  const canSee = useCallback(
    (permission: string) => isSuperAdmin || permissions.includes(permission),
    [isSuperAdmin, permissions],
  );
  const menuItems = useMemo(() => [
    canSee('dashboard') ? { key: '/admin/dashboard', icon: <DashboardOutlined />, label: t('adminLayout.dashboard') } : null,
    canSee('products') ? { key: '/admin/products', icon: <ShopOutlined />, label: t('adminLayout.products') } : null,
    canSee('brands') ? { key: '/admin/brands', icon: <TagsOutlined />, label: t('adminLayout.brands') } : null,
    canSee('categories') ? { key: '/admin/categories', icon: <AppstoreOutlined />, label: t('adminLayout.categories') } : null,
    canSee('orders') ? { key: '/admin/orders', icon: <ShoppingOutlined />, label: t('adminLayout.orders') } : null,
    canSee('logistics-carriers') ? { key: '/admin/logistics-carriers', icon: <TruckOutlined />, label: t('adminLayout.logisticsCarriers') } : null,
    canSee('users') ? { key: '/admin/users', icon: <TeamOutlined />, label: t('adminLayout.users') } : null,
    ...(canSee('permissions')
      ? [{ key: '/admin/permissions', icon: <SafetyCertificateOutlined />, label: t('adminLayout.permissions') }]
      : []),
    canSee('reviews') ? { key: '/admin/reviews', icon: <StarOutlined />, label: t('adminLayout.reviews') } : null,
    canSee('questions') ? { key: '/admin/questions', icon: <QuestionCircleOutlined />, label: t('adminLayout.questions') } : null,
    canSee('coupons') ? { key: '/admin/coupons', icon: <GiftOutlined />, label: t('adminLayout.coupons') } : null,
    canSee('notifications') ? { key: '/admin/notifications', icon: <NotificationOutlined />, label: t('adminLayout.notifications') } : null,
    canSee('announcements') ? { key: '/admin/announcements', icon: <SoundOutlined />, label: t('adminLayout.announcements') } : null,
    canSee('audit-logs') ? { key: '/admin/audit-logs', icon: <SafetyCertificateOutlined />, label: t('adminLayout.auditLogs') } : null,
    canSee('alerts') ? { key: '/admin/alerts', icon: <AlertOutlined />, label: t('adminLayout.alerts') } : null,
    canSee('ip-blacklist') ? { key: '/admin/ip-blacklist', icon: <StopOutlined />, label: t('adminLayout.ipBlacklist') } : null,
    canSee('logs') ? { key: '/admin/logs', icon: <FileTextOutlined />, label: t('adminLayout.logs') } : null,
    canSee('pet-gallery') ? { key: '/admin/pet-gallery', icon: <CameraOutlined />, label: t('adminLayout.petGallery') } : null,
    canSee('registry') ? { key: '/admin/registry', icon: <ApiOutlined />, label: t('adminLayout.registry') } : null,
    canSee('config-center') ? { key: '/admin/config-center', icon: <CloudSyncOutlined />, label: t('adminLayout.configCenter') } : null,
    canSee('traffic-control') ? { key: '/admin/traffic-control', icon: <ThunderboltOutlined />, label: t('adminLayout.trafficControl') } : null,
    canSee('system') ? { key: '/admin/system', icon: <SettingOutlined />, label: t('adminLayout.system') } : null,
    canSee('support') ? {
      key: '/admin/support',
      icon: <CustomerServiceOutlined />,
      label: (
        <span>
          {t('adminLayout.support')}
          {supportUnread > 0 ? <Badge count={supportUnread} size="small" style={{ marginLeft: 8 }} /> : null}
        </span>
      ),
    } : null,
  ].filter(Boolean) as any[], [canSee, supportUnread, t]);
  const defaultAdminPath = menuItems[0]?.key as string | undefined;
  const canSeeSupport = canSee('support');

  const checkAdmin = useCallback(async (initial = false) => {
    const token = getLocalStorageItem('token');
    if (!token) {
      if (initial) message.warning(t('messages.loginRequired'));
      clearStoredAuthSession();
      navigate(buildLoginUrlFromWindow(), { replace: true });
      return;
    }
    try {
      const res = await userApi.getProfile();
      const effectiveRole = getEffectiveRole(res.data.role, res.data.roleCode);
      if (!isAdminRole(effectiveRole)) {
        message.error(t('adminLayout.noPermission'));
        clearStoredAuthSession();
        navigate('/', { replace: true });
        return;
      }
      setLocalStorageItem('role', effectiveRole);
      setCurrentRole(effectiveRole);
      const permissionsRes = await adminApi.getMyPermissions({ bypassCache: true });
      setPermissions(permissionsRes.data.permissions || []);
      setChecking(false);
    } catch {
      message.error(t('adminLayout.verifyFailed'));
      clearStoredAuthSession();
      navigate(buildLoginUrlFromWindow(), { replace: true });
    }
  }, [navigate, t]);

  useEffect(() => {
    void checkAdmin(checking);
  }, [checkAdmin, checking, location.pathname]);

  useEffect(() => {
    if (checking) return;
    if (!defaultAdminPath) {
      message.error(t('adminLayout.noPermission'));
      navigate('/', { replace: true });
      return;
    }
    setLocalStorageItem('adminDefaultPath', defaultAdminPath);
    if (location.pathname === '/admin' || !menuItems.some((item) => item.key === location.pathname)) {
      navigate(defaultAdminPath, { replace: true });
    }
  }, [checking, defaultAdminPath, location.pathname, menuItems, navigate, t]);

  useEffect(() => {
    if (checking || !canSeeSupport) {
      setSupportUnread(0);
      return;
    }
    let disposed = false;
    const loadUnread = () => {
      adminSupportApi.getUnreadCount()
        .then((res) => {
          if (!disposed) setSupportUnread(res.data.count);
        })
        .catch(() => {
          if (!disposed) setSupportUnread(0);
        });
    };
    loadUnread();
    const timer = window.setInterval(loadUnread, 15000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [checking, canSeeSupport, location.pathname]);

  const handleLogout = () => {
    const refreshToken = getLocalStorageItem('refreshToken');
    userApi.logout(refreshToken).catch(() => undefined);
    clearStoredAuthSession();
    navigate('/login');
  };

  if (checking) {
    return (
      <div className="admin-layout__loading">
        <Spin size="large" tip={t('adminLayout.checking')} />
      </div>
    );
  }

  return (
    <Layout className="admin-layout">
      <SkipToContentLink />
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        breakpoint="lg"
        collapsedWidth={72}
        theme="dark"
        width={200}
        className="admin-layout__sider"
      >
        <div className="admin-layout__brand">
          <Title level={4}>
            {collapsed ? t('adminLayout.titleShort') : t('adminLayout.title')}
          </Title>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          className="admin-layout__menu"
        />
      </Sider>
      <Layout>
        <Header className="admin-layout__header">
          <Link to="/" className="admin-layout__storeLink">
            <ArrowLeftOutlined />
            <span>{t('adminLayout.backStore')}</span>
          </Link>
          <Button icon={<LogoutOutlined />} onClick={handleLogout} type="text" danger>
            {t('adminLayout.logout')}
          </Button>
        </Header>
        <Content id={MAIN_CONTENT_ID} tabIndex={-1} className="admin-layout__content">
          <ErrorBoundary key={location.pathname} homePath="/admin/dashboard" homeLabel={t('adminLayout.dashboard')}>
            <Outlet />
          </ErrorBoundary>
        </Content>
      </Layout>
    </Layout>
  );
};

export default AdminLayout;
