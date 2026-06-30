import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Badge, Button, Drawer, Layout, Menu, Space, Spin, Tooltip, Typography, message } from 'antd';
import {
  DashboardOutlined, ShopOutlined, AppstoreOutlined,
  ShoppingOutlined, TeamOutlined, StarOutlined, QuestionCircleOutlined,
  ArrowLeftOutlined, LogoutOutlined, CustomerServiceOutlined, GiftOutlined,
  NotificationOutlined, TagsOutlined, TruckOutlined, SoundOutlined,
  SafetyCertificateOutlined, ApiOutlined, SettingOutlined, CloudSyncOutlined, FileTextOutlined, ThunderboltOutlined, AlertOutlined, StopOutlined, CameraOutlined,
  BugOutlined, MenuOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { adminApi, adminSupportApi, clearStoredAuthSession, userApi } from '../api';
import { useLanguage } from '../i18n';
import { buildLoginUrlFromWindow } from '../utils/authRedirect';
import {
  BUGS_ACCESS_PERMISSIONS,
  BUGS_WRITE_PERMISSION,
  getEffectiveRole,
  isAdminRole,
  isSuperAdminRole,
} from '../utils/roles';
import { getLocalStorageItem, setLocalStorageItem } from '../utils/safeStorage';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import { isAuthExpiredError } from '../utils/apiError';
import ErrorBoundary from './ErrorBoundary';
import SkipToContentLink, { MAIN_CONTENT_ID } from './SkipToContentLink';
import './AdminLayout.css';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

const isAdminMenuRouteMatch = (pathname: string, menuKey?: string) => (
  Boolean(menuKey) && (pathname === menuKey || pathname.startsWith(`${menuKey}/`))
);

type AdminMenuItem = {
  key: string;
  icon: React.ReactNode;
  label: React.ReactNode;
};

const isAdminMenuItem = (item: AdminMenuItem | null): item is AdminMenuItem => item !== null;
const adminDocumentIsVisible = () => document.visibilityState !== 'hidden';
const ADMIN_SIDER_COLLAPSED_KEY = 'shop-admin-sider-collapsed';

const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [collapsed, setCollapsed] = useState(() => getLocalStorageItem(ADMIN_SIDER_COLLAPSED_KEY) === 'true');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [supportUnread, setSupportUnread] = useState(0);
  const [currentRole, setCurrentRole] = useState<string>('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [verifyUnavailable, setVerifyUnavailable] = useState(false);
  const adminCheckRequestRef = useRef(0);
  const adminCheckAbortRef = useRef<AbortController | null>(null);
  const hasStartedAdminCheckRef = useRef(false);
  const { t } = useLanguage();
  const isSuperAdmin = isSuperAdminRole(currentRole);

  const canSee = useCallback(
    (permission: string) => isSuperAdmin || permissions.includes(permission),
    [isSuperAdmin, permissions],
  );
  const canSeeBugs = useMemo(
    () => BUGS_ACCESS_PERMISSIONS.some((permission) => canSee(permission)),
    [canSee],
  );
  const canSubmitBugs = canSee(BUGS_WRITE_PERMISSION);
  const menuItems = useMemo<AdminMenuItem[]>(() => {
    const items: Array<AdminMenuItem | null> = [
      canSee('dashboard') ? { key: '/admin/dashboard', icon: <DashboardOutlined />, label: t('adminLayout.dashboard') } : null,
      canSee('products') ? { key: '/admin/products', icon: <ShopOutlined />, label: t('adminLayout.products') } : null,
      canSee('brands') ? { key: '/admin/brands', icon: <TagsOutlined />, label: t('adminLayout.brands') } : null,
      canSee('categories') ? { key: '/admin/categories', icon: <AppstoreOutlined />, label: t('adminLayout.categories') } : null,
      canSee('orders') ? { key: '/admin/orders', icon: <ShoppingOutlined />, label: t('adminLayout.orders') } : null,
      canSee('logistics-carriers') ? { key: '/admin/logistics-carriers', icon: <TruckOutlined />, label: t('adminLayout.logisticsCarriers') } : null,
      canSee('users') ? { key: '/admin/users', icon: <TeamOutlined />, label: t('adminLayout.users') } : null,
      canSee('permissions') ? { key: '/admin/permissions', icon: <SafetyCertificateOutlined />, label: t('adminLayout.permissions') } : null,
      canSee('reviews') ? { key: '/admin/reviews', icon: <StarOutlined />, label: t('adminLayout.reviews') } : null,
      canSee('questions') ? { key: '/admin/questions', icon: <QuestionCircleOutlined />, label: t('adminLayout.questions') } : null,
      canSee('coupons') ? { key: '/admin/coupons', icon: <GiftOutlined />, label: t('adminLayout.coupons') } : null,
      canSee('notifications') ? { key: '/admin/notifications', icon: <NotificationOutlined />, label: t('adminLayout.notifications') } : null,
      canSee('announcements') ? { key: '/admin/announcements', icon: <SoundOutlined />, label: t('adminLayout.announcements') } : null,
      canSee('audit-logs') ? { key: '/admin/audit-logs', icon: <SafetyCertificateOutlined />, label: t('adminLayout.auditLogs') } : null,
      canSee('alerts') ? { key: '/admin/alerts', icon: <AlertOutlined />, label: t('adminLayout.alerts') } : null,
      canSeeBugs ? { key: '/admin/bugs', icon: <BugOutlined />, label: t('adminLayout.bugs') } : null,
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
    ];
    return items.filter(isAdminMenuItem);
  }, [canSee, canSeeBugs, supportUnread, t]);
  const defaultAdminPath = menuItems[0]?.key;
  const selectedAdminPath = useMemo(() => {
    const matches = menuItems
      .map((item) => String(item.key))
      .filter((key) => isAdminMenuRouteMatch(location.pathname, key))
      .sort((left, right) => right.length - left.length);
    return matches[0] || '';
  }, [location.pathname, menuItems]);
  const currentAdminRouteAllowed = location.pathname === '/admin' || Boolean(selectedAdminPath);
  const canSeeSupport = canSee('support');
  const supportRouteActive = isAdminMenuRouteMatch(location.pathname, '/admin/support');
  const handleSiderCollapse = useCallback((nextCollapsed: boolean, collapseType?: 'clickTrigger' | 'responsive') => {
    setCollapsed(nextCollapsed);
    if (collapseType !== 'responsive') {
      setLocalStorageItem(ADMIN_SIDER_COLLAPSED_KEY, nextCollapsed ? 'true' : 'false');
    }
  }, []);

  const checkAdmin = useCallback(async (initial = false) => {
    const requestId = adminCheckRequestRef.current + 1;
    adminCheckRequestRef.current = requestId;
    adminCheckAbortRef.current?.abort();
    const controller = new AbortController();
    adminCheckAbortRef.current = controller;
    const token = getLocalStorageItem('token');
    if (!token) {
      setVerifyUnavailable(false);
      if (initial) message.warning(t('messages.loginRequired'));
      clearStoredAuthSession();
      if (requestId === adminCheckRequestRef.current) {
        setChecking(false);
        adminCheckAbortRef.current = null;
      }
      navigate(buildLoginUrlFromWindow(), { replace: true });
      return;
    }
    try {
      const res = await userApi.getProfile({ signal: controller.signal });
      if (controller.signal.aborted || requestId !== adminCheckRequestRef.current) return;
      setVerifyUnavailable(false);
      const effectiveRole = getEffectiveRole(res.data.role, res.data.roleCode);
      if (!isAdminRole(effectiveRole)) {
        message.error(t('adminLayout.noPermission'));
        clearStoredAuthSession();
        setChecking(false);
        navigate('/', { replace: true });
        return;
      }
      setLocalStorageItem('role', effectiveRole);
      setCurrentRole(effectiveRole);
      const permissionsRes = await adminApi.getMyPermissions({ bypassCache: true, signal: controller.signal });
      if (controller.signal.aborted || requestId !== adminCheckRequestRef.current) return;
      setVerifyUnavailable(false);
      setPermissions(permissionsRes.data.permissions || []);
      setChecking(false);
    } catch (error) {
      if (controller.signal.aborted || requestId !== adminCheckRequestRef.current) return;
      reportNonBlockingError('AdminLayout.checkAdmin', error);
      if (isAuthExpiredError(error)) {
        setVerifyUnavailable(false);
        message.error(t('adminLayout.verifyFailed'));
        clearStoredAuthSession();
        setChecking(false);
        navigate(buildLoginUrlFromWindow(), { replace: true });
        return;
      }
      setVerifyUnavailable(true);
      message.warning(t('adminLayout.verifyUnavailable'));
      setChecking(false);
    } finally {
      if (requestId === adminCheckRequestRef.current && adminCheckAbortRef.current === controller) {
        adminCheckAbortRef.current = null;
      }
    }
  }, [navigate, t]);

  useEffect(() => {
    const initial = !hasStartedAdminCheckRef.current;
    hasStartedAdminCheckRef.current = true;
    void checkAdmin(initial);
  }, [checkAdmin]);

  useEffect(() => () => {
    adminCheckRequestRef.current += 1;
    adminCheckAbortRef.current?.abort();
    adminCheckAbortRef.current = null;
  }, []);

  useEffect(() => {
    const refreshPermissions = () => {
      void checkAdmin(false);
    };
    const refreshVisiblePermissions = () => {
      if (document.visibilityState === 'visible') {
        void checkAdmin(false);
      }
    };
    window.addEventListener('shop:admin-permissions-updated', refreshPermissions);
    document.addEventListener('visibilitychange', refreshVisiblePermissions);
    return () => {
      window.removeEventListener('shop:admin-permissions-updated', refreshPermissions);
      document.removeEventListener('visibilitychange', refreshVisiblePermissions);
    };
  }, [checkAdmin]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (checking) return;
    if (verifyUnavailable) return;
    if (!defaultAdminPath) {
      message.error(t('adminLayout.noPermission'));
      navigate('/', { replace: true });
      return;
    }
    setLocalStorageItem('adminDefaultPath', defaultAdminPath);
    if (location.pathname === '/admin' || !currentAdminRouteAllowed) {
      navigate(defaultAdminPath, { replace: true });
    }
  }, [checking, currentAdminRouteAllowed, defaultAdminPath, location.pathname, navigate, t, verifyUnavailable]);

  useEffect(() => {
    if (checking || !canSeeSupport) {
      setSupportUnread(0);
      return;
    }
    let disposed = false;
    const loadUnread = () => {
      if (!adminDocumentIsVisible()) return;
      adminSupportApi.getUnreadCount()
        .then((res) => {
          if (!disposed) setSupportUnread(res.data.count);
        })
        .catch((error) => {
          if (!disposed) setSupportUnread(0);
          if (!disposed) reportNonBlockingError('AdminLayout.loadSupportUnread', error);
        });
    };
    const refreshUnreadWhenVisible = () => {
      if (adminDocumentIsVisible()) {
        loadUnread();
      }
    };
    loadUnread();
    if (!supportRouteActive) {
      return () => {
        disposed = true;
      };
    }
    const timer = window.setInterval(loadUnread, 15000);
    document.addEventListener('visibilitychange', refreshUnreadWhenVisible);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', refreshUnreadWhenVisible);
      window.clearInterval(timer);
    };
  }, [checking, canSeeSupport, supportRouteActive]);

  const handleLogout = () => {
    const refreshToken = getLocalStorageItem('refreshToken');
    void userApi.logout(refreshToken).catch((error) => {
      reportNonBlockingError('Admin logout token revoke failed', error);
      message.warning(t('messages.logoutPartialFailure'));
    });
    clearStoredAuthSession();
    navigate(buildLoginUrlFromWindow(), { replace: true });
  };

  if (checking) {
    return (
      <div
        className="admin-layout__loading"
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={t('adminLayout.checking')}
      >
        <Spin size="large" tip={t('adminLayout.checking')} />
      </div>
    );
  }

  if (verifyUnavailable) {
    return (
      <div className="admin-layout__loading admin-layout__loading--recoverable">
        <Alert
          type="warning"
          showIcon
          message={t('adminLayout.verifyUnavailable')}
          description={t('adminLayout.verifyUnavailableDescription')}
          action={(
            <Button
              type="primary"
              onClick={() => {
                setChecking(true);
                setVerifyUnavailable(false);
                void checkAdmin(true);
              }}
            >
              {t('common.retry')}
            </Button>
          )}
        />
      </div>
    );
  }

  if (!defaultAdminPath || !currentAdminRouteAllowed) {
    return (
      <div
        className="admin-layout__loading"
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={t('adminLayout.checking')}
      >
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
        onCollapse={handleSiderCollapse}
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
        <ErrorBoundary homePath="/admin/dashboard" homeLabel={t('adminLayout.dashboard')}>
          <nav className="admin-layout__navigation" aria-label={t('adminLayout.navigation')}>
            <Menu
              theme="dark"
              mode="inline"
              selectedKeys={selectedAdminPath ? [selectedAdminPath] : []}
              items={menuItems}
              onClick={({ key }) => navigate(key)}
              className="admin-layout__menu"
            />
          </nav>
        </ErrorBoundary>
      </Sider>
      <Drawer
        placement="left"
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        width={288}
        className="admin-layout__mobileDrawer"
        classNames={{ body: 'admin-layout__mobileDrawerBody' }}
        title={t('adminLayout.title')}
      >
        <ErrorBoundary homePath="/admin/dashboard" homeLabel={t('adminLayout.dashboard')}>
          <nav className="admin-layout__mobileNavigation" aria-label={t('adminLayout.navigation')}>
            <Menu
              mode="inline"
              selectedKeys={selectedAdminPath ? [selectedAdminPath] : []}
              items={menuItems}
              onClick={({ key }) => {
                setMobileNavOpen(false);
                navigate(key);
              }}
              className="admin-layout__drawerMenu"
            />
          </nav>
        </ErrorBoundary>
      </Drawer>
      <Layout>
        <ErrorBoundary homePath="/admin/dashboard" homeLabel={t('adminLayout.dashboard')}>
          <Header className="admin-layout__header">
            <Button
              icon={<MenuOutlined />}
              onClick={() => setMobileNavOpen(true)}
              type="text"
              className="admin-layout__mobileMenuButton"
              aria-label={t('adminLayout.openMenu')}
              title={t('adminLayout.openMenu')}
            />
            <Link to="/" className="admin-layout__storeLink">
              <ArrowLeftOutlined />
              <span>{t('adminLayout.backStore')}</span>
            </Link>
            <Space className="admin-layout__headerActions" size={8} wrap>
              {canSeeBugs ? (
                <Tooltip title={canSubmitBugs ? undefined : t('adminLayout.noPermission')}>
                  <span className="admin-layout__submitBugWrap">
                    <Button
                      icon={<BugOutlined />}
                      onClick={() => navigate('/admin/bugs?new=1')}
                      type="primary"
                      className="admin-layout__submitBug"
                      disabled={!canSubmitBugs}
                    >
                      {t('adminLayout.submitBug')}
                    </Button>
                  </span>
                </Tooltip>
              ) : null}
              <Button icon={<LogoutOutlined />} onClick={handleLogout} type="text" danger>
                {t('adminLayout.logout')}
              </Button>
            </Space>
          </Header>
        </ErrorBoundary>
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
