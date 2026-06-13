import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { BrowserRouter as Router, Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { Button, Layout, Modal, Space, Spin, Typography, message } from 'antd';
import { CustomerServiceOutlined, GiftOutlined, UserAddOutlined, FileSearchOutlined, CopyOutlined } from '@ant-design/icons';
import Navbar from './components/Navbar';
import ErrorBoundary from './components/ErrorBoundary';
import CustomerSupportWidget from './components/CustomerSupportWidget';
import SkipToContentLink, { MAIN_CONTENT_ID } from './components/SkipToContentLink';
import { useLanguage } from './i18n';
import type { CartItem, UserProfile } from './types';
import { dispatchDomEvent } from './utils/domEvents';
import { addAppScrollListener, getAppScrollMetrics, scrollAppToTop } from './utils/nativeScroll';
import { consumeNativeBack, useNativeBackHandler } from './utils/nativeBack';
import { getLocalStorageItem, hasStoredValue, removeLocalStorageItem, setLocalStorageItem } from './utils/safeStorage';
import { clearGuestSupportContext, loadGuestSupportContext, normalizeGuestSupportContext, saveGuestSupportContext } from './utils/guestSupportContext';
import { clearStoredAuthSession, userApi } from './api';
import { buildLoginUrl, buildLoginUrlFromWindow, getCurrentRelativeUrl } from './utils/authRedirect';
import { AUTH_SESSION_CHANGED_EVENT, AUTH_SESSION_STORAGE_KEYS } from './utils/authEvents';
import { isAuthExpiredError } from './utils/apiError';
import { getEffectiveRole } from './utils/roles';
import { reportNonBlockingError } from './utils/nonBlockingError';
import { subscribeAccessibleMessages, type AccessibleMessageAnnouncement } from './utils/accessibleMessage';
import {
  currentMobileVersionName,
  currentMobileVersionCode,
  currentNativeMobilePlatform,
  fetchLatestMobileRelease,
  isMobileReleaseDownloadAllowed,
  isNativeAndroidApp,
  isNativeMobileApp,
  openMobileReleaseDownload,
  resolveMobileReleaseDownloadUrl,
  type MobileReleaseManifest,
} from './utils/mobileUpdate';
import './App.css';
import './mobile-app.css';
import './styles/admin-table-selection.css';

const { Content, Footer } = Layout;
const { Text } = Typography;
const MOBILE_UPDATE_DISMISSED_KEY_PREFIX = 'shop-mobile-update-dismissed';

declare global {
  interface Window {
    Capacitor?: {
      getPlatform?: () => string;
      isNativePlatform?: () => boolean;
      Plugins?: {
        App?: {
          addListener?: (
            eventName: 'backButton' | 'appStateChange' | 'resume',
            listener: (event?: { canGoBack?: boolean; isActive?: boolean }) => void,
          ) => Promise<{ remove: () => Promise<void> | void }> | { remove: () => Promise<void> | void };
          minimizeApp?: () => Promise<void>;
          exitApp?: () => Promise<void>;
        };
        Browser?: {
          open?: (options: { url: string }) => Promise<void>;
        };
      };
    };
  }
}

const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminLayout = lazy(() => import('./components/AdminLayout'));
const AlertManagement = lazy(() => import('./pages/AlertManagement'));
const AnnouncementManagement = lazy(() => import('./pages/AnnouncementManagement'));
const BrandManagement = lazy(() => import('./pages/BrandManagement'));
const BugManagement = lazy(() => import('./pages/BugManagement'));
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
const PetGalleryManagement = lazy(() => import('./pages/PetGalleryManagement'));
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
const loadAndroidUiFinalGuard = () => import('./utils/androidUiFinalGuard');
const loadMobileContrastGuard = () => import('./utils/mobileContrastGuard');

type GuardCleanup = () => void;

const installAsyncUiGuard = <TModule,>(
  loadModule: () => Promise<TModule>,
  installGuard: (module: TModule) => GuardCleanup | void,
  errorContext: string,
): GuardCleanup => {
  let disposed = false;
  let cleanup: GuardCleanup | void;

  void loadModule()
    .then((module) => {
      if (disposed) {
        return;
      }
      cleanup = installGuard(module);
    })
    .catch((error) => {
      if (!disposed) {
        reportNonBlockingError(errorContext, error);
      }
    });

  return () => {
    disposed = true;
    cleanup?.();
  };
};

const refreshAsyncUiGuard = <TModule,>(
  loadModule: () => Promise<TModule>,
  refreshGuard: (module: TModule) => void,
  errorContext: string,
): GuardCleanup => {
  let disposed = false;
  let frameId: number | undefined;
  const timeoutIds: number[] = [];

  void loadModule()
    .then((module) => {
      if (disposed) {
        return;
      }
      const refresh = () => refreshGuard(module);

      refresh();
      frameId = window.requestAnimationFrame(refresh);
      timeoutIds.push(
        window.setTimeout(refresh, 80),
        window.setTimeout(refresh, 260),
      );
    })
    .catch((error) => {
      if (!disposed) {
        reportNonBlockingError(errorContext, error);
      }
    });

  return () => {
    disposed = true;
    if (frameId !== undefined) {
      window.cancelAnimationFrame(frameId);
    }
    timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
  };
};

type CartDrawerOpenRequest = {
  id: number;
  items?: CartItem[];
};

type SupportOpenRequest = {
  id: number;
  guestOrderNo?: string;
  guestEmail?: string;
  clearGuestContext?: boolean;
};

type SupportOpenDetail = {
  orderNo?: string;
  email?: string;
  guestOrderNo?: string;
  guestEmail?: string;
  clearGuestContext?: boolean;
  clearGuestSupportContext?: boolean;
};

type AdminRouteBoundaryProps = {
  boundaryKey: string;
  children: React.ReactNode;
};

const AdminRouteBoundary: React.FC<AdminRouteBoundaryProps> = ({ boundaryKey, children }) => {
  const { t } = useLanguage();
  return (
    <ErrorBoundary key={boundaryKey} homePath="/admin/dashboard" homeLabel={t('adminLayout.dashboard')}>
      {children}
    </ErrorBoundary>
  );
};

const adminRouteElement = (boundaryKey: string, element: React.ReactElement) => (
  <AdminRouteBoundary boundaryKey={boundaryKey}>
    {element}
  </AdminRouteBoundary>
);

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
  if (detail?.clearGuestContext === true || detail?.clearGuestSupportContext === true) {
    return { clearGuestContext: true };
  }
  const normalized = normalizeGuestSupportContext(detail);
  return normalized ? { guestOrderNo: normalized.orderNo, guestEmail: normalized.email } : null;
};

const toSupportOpenDetail = (context: ReturnType<typeof loadGuestSupportContext>): SupportOpenDetail | null =>
  context ? { guestOrderNo: context.orderNo, guestEmail: context.email } : null;

const LoadingFallback = () => {
  const { t } = useLanguage();

  return (
    <div className="app-route-loading">
      <Spin size="large" />
      <span className="app-route-loading__text" role="status" aria-live="polite">
        {t('app.loading')}
      </span>
    </div>
  );
};

export const AccessibleMessageLiveRegion: React.FC = () => {
  const { t } = useLanguage();
  const [announcement, setAnnouncement] = useState<AccessibleMessageAnnouncement | null>(null);

  useEffect(() => subscribeAccessibleMessages(setAnnouncement), []);

  return (
    <div
      className="app-message-live-region"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label={t('app.statusAnnouncementLabel')}
    >
      {announcement ? <span key={announcement.id}>{announcement.text}</span> : null}
    </div>
  );
};

const applyStartupProfile = (profile: UserProfile) => {
  const effectiveRole = getEffectiveRole(profile?.role, profile?.roleCode);
  setLocalStorageItem('userId', String(profile?.id || ''));
  setLocalStorageItem('username', String(profile?.username || profile?.email || profile?.phone || profile?.id || ''));
  if (effectiveRole) {
    setLocalStorageItem('role', effectiveRole);
  } else {
    removeLocalStorageItem('role');
  }
};

const AUTH_REQUIRED_ROUTE_PREFIXES = ['/admin', '/checkout', '/notifications', '/profile', '/wishlist'];

const isAuthRequiredRoutePath = (pathname: string) => (
  AUTH_REQUIRED_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
);

export const AuthStartupGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [checking, setChecking] = useState(() => hasStoredValue('token'));
  const navigate = useNavigate();

  const validateStoredSession = useCallback(() => {
    if (!hasStoredValue('token')) {
      setChecking(false);
      return undefined;
    }

    let disposed = false;
    setChecking(true);
    userApi.getProfile({ skipAuthRedirect: true })
      .then((response) => {
        if (disposed) return;
        applyStartupProfile(response.data);
      })
      .catch((error) => {
        if (disposed) return;
        if (isAuthExpiredError(error)) {
          clearStoredAuthSession();
          if (isAuthRequiredRoutePath(window.location.pathname)) {
            navigate(buildLoginUrlFromWindow(), { replace: true });
          }
          return;
        }
        reportNonBlockingError('AuthStartupGate.validateStoredSession', error);
      })
      .finally(() => {
        if (!disposed) {
          setChecking(false);
        }
      });

    return () => {
      disposed = true;
    };
  }, [navigate]);

  useEffect(() => {
    const cleanup = validateStoredSession();
    return cleanup;
  }, [validateStoredSession]);

  useEffect(() => {
    const handleAuthSessionChanged = () => {
      if (!hasStoredValue('token')) {
        setChecking(false);
      }
    };
    const handleStorageChange = (event: StorageEvent) => {
      if (!event.key || AUTH_SESSION_STORAGE_KEYS.includes(event.key)) {
        handleAuthSessionChanged();
      }
    };
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, handleAuthSessionChanged);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, handleAuthSessionChanged);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  if (checking) {
    return <LoadingFallback />;
  }

  return <>{children}</>;
};

const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const location = useLocation();
  if (!hasStoredValue('token')) {
    return <Navigate to={buildLoginUrl(getCurrentRelativeUrl(location))} replace />;
  }
  return children;
};

const protectedRouteElement = (element: React.ReactElement) => (
  <ProtectedRoute>
    {element}
  </ProtectedRoute>
);

const NativeAppClassHost: React.FC = () => {
  useEffect(() => {
    const capacitor = window.Capacitor;
    const platform = currentNativeMobilePlatform() || capacitor?.getPlatform?.();
    const isNative = isNativeMobileApp();
    if (!isNative) return;

    const body = document.body;
    if (!body) return;

    document.documentElement.classList.add('shop-mobile-app-root');
    body.classList.add('shop-mobile-app');
    if (platform) {
      body.classList.add(`shop-mobile-app--${platform}`);
      document.documentElement.dataset.shopPlatform = platform;
    }

    return () => {
      document.documentElement.classList.remove('shop-mobile-app-root');
      body.classList.remove('shop-mobile-app', 'shop-mobile-app--android', 'shop-mobile-app--ios');
      delete document.documentElement.dataset.shopPlatform;
    };
  }, []);

  return null;
};

const NativeMobileUpdateGate: React.FC = () => {
  const { t } = useLanguage();
  const [release, setRelease] = useState<MobileReleaseManifest | null>(null);
  const [openingDownload, setOpeningDownload] = useState(false);
  const [downloadFailed, setDownloadFailed] = useState(false);
  const installedVersionCode = currentMobileVersionCode();
  const latestVersionCode = release?.versionCode || 0;
  const updateRequired = Boolean(release && (release.mandatory || (release.minSupportedVersionCode || 0) > installedVersionCode));
  const downloadUrl = resolveMobileReleaseDownloadUrl(release);

  useEffect(() => {
    if (!isNativeAndroidApp()) return;

    let disposed = false;
    let checking = false;
    let retryTimer: number | null = null;
    const listenerRemovers: Array<() => Promise<void> | void> = [];

    const clearRetryTimer = () => {
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
        retryTimer = null;
      }
    };

    const checkLatestRelease = async () => {
      if (disposed || checking) return;
      checking = true;
      try {
        const latestRelease = await fetchLatestMobileRelease();
        if (disposed) return;
        const latestReleaseVersionCode = latestRelease?.versionCode || 0;
        if (
          !latestRelease
          || latestReleaseVersionCode <= installedVersionCode
          || !isMobileReleaseDownloadAllowed(latestRelease)
        ) {
          return;
        }
        const required = latestRelease.mandatory || (latestRelease.minSupportedVersionCode || 0) > installedVersionCode;
        const dismissed = getLocalStorageItem(`${MOBILE_UPDATE_DISMISSED_KEY_PREFIX}:${latestReleaseVersionCode}`) === '1';
        if (!required && dismissed) {
          return;
        }
        setDownloadFailed(false);
        setRelease(latestRelease);
      } finally {
        checking = false;
      }
    };

    const scheduleReleaseCheck = () => {
      if (disposed) return;
      clearRetryTimer();
      retryTimer = window.setTimeout(() => {
        retryTimer = null;
        void checkLatestRelease();
      }, 300);
    };

    void checkLatestRelease();
    window.addEventListener('online', scheduleReleaseCheck);
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        scheduleReleaseCheck();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const appPlugin = window.Capacitor?.Plugins?.App;
    if (appPlugin && typeof appPlugin.addListener === 'function') {
      const addNativeListener = (
        eventName: 'appStateChange' | 'resume',
        listener: (event?: { isActive?: boolean }) => void,
      ) => {
        try {
          const registration = appPlugin.addListener?.(eventName, listener);
          Promise.resolve(registration).then((handle) => {
            if (!handle || typeof handle.remove !== 'function') return;
            if (disposed) {
              void handle.remove();
              return;
            }
            listenerRemovers.push(() => handle.remove());
          });
        } catch (error) {
          reportNonBlockingError('App.addNativeReleaseCheckListener', error);
        }
      };

      addNativeListener('appStateChange', (event) => {
        if (event?.isActive !== false) {
          scheduleReleaseCheck();
        }
      });
      addNativeListener('resume', scheduleReleaseCheck);
    }

    return () => {
      disposed = true;
      clearRetryTimer();
      window.removeEventListener('online', scheduleReleaseCheck);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      listenerRemovers.forEach((remove) => {
        void remove();
      });
    };
  }, [installedVersionCode]);

  const handleDismiss = useCallback(() => {
    if (!release || updateRequired) return;
    setLocalStorageItem(`${MOBILE_UPDATE_DISMISSED_KEY_PREFIX}:${release.versionCode}`, '1');
    setDownloadFailed(false);
    setRelease(null);
  }, [release, updateRequired]);

  const handleNativeBack = useCallback(() => {
    if (updateRequired) {
      return true;
    }
    handleDismiss();
    return true;
  }, [handleDismiss, updateRequired]);

  useNativeBackHandler(Boolean(release), handleNativeBack);

  const handleDownload = async () => {
    if (!release) return;
    setOpeningDownload(true);
    setDownloadFailed(false);
    try {
      const opened = await openMobileReleaseDownload(release);
      setDownloadFailed(!opened);
    } catch (error) {
      reportNonBlockingError('App.mobileUpdateDownload', error);
      setDownloadFailed(true);
    } finally {
      setOpeningDownload(false);
    }
  };

  const handleCopyDownloadLink = async () => {
    if (!downloadUrl) return;
    try {
      await navigator.clipboard.writeText(downloadUrl);
      message.success(t('appUpdate.copyDownloadLinkSuccess'));
    } catch (error) {
      reportNonBlockingError('App.copyDownloadLink', error);
      message.error(t('appUpdate.copyDownloadLinkFailed'));
    }
  };

  if (!release) return null;

  const releaseNotes = release.releaseNotes || [];
  const currentVersionLabel = currentMobileVersionName();
  const latestVersionLabel = release.versionName || String(latestVersionCode);
  const updateTargetLabel = `${latestVersionLabel} (${currentVersionLabel} -> ${latestVersionLabel})`;
  const updateLaterActionLabel = `${t('appUpdate.later')}: ${updateTargetLabel}`;
  const updateDownloadActionLabel = `${t('appUpdate.download')}: ${updateTargetLabel}`;
  const copyDownloadActionLabel = `${t('appUpdate.copyDownloadLink')}: ${latestVersionLabel}`;

  return (
    <Modal
      open
      centered
      closable={!updateRequired}
      maskClosable={!updateRequired}
      onCancel={handleDismiss}
      title={t(updateRequired ? 'appUpdate.requiredTitle' : 'appUpdate.title')}
      rootClassName="shop-mobile-update-modal-root"
      className="profile-mobile-safe-modal shop-mobile-update-modal"
      maskStyle={{
        background: 'rgba(15, 30, 22, 0.48)',
        backdropFilter: 'none',
        WebkitBackdropFilter: 'none',
        filter: 'none',
      }}
      footer={(
        <Space wrap>
          {!updateRequired ? (
            <Button aria-label={updateLaterActionLabel} title={updateLaterActionLabel} onClick={handleDismiss}>{t('appUpdate.later')}</Button>
          ) : null}
          <Button type="primary" loading={openingDownload} aria-label={updateDownloadActionLabel} title={updateDownloadActionLabel} onClick={handleDownload}>
            {t('appUpdate.download')}
          </Button>
        </Space>
      )}
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Text>{t('appUpdate.description')}</Text>
        <Text type="secondary">
          {t('appUpdate.versionSummary', { current: currentVersionLabel, latest: latestVersionLabel })}
        </Text>
        {downloadFailed ? (
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <Text type="danger">{t('appUpdate.downloadFailed')}</Text>
            <Button
              icon={<CopyOutlined />}
              aria-label={copyDownloadActionLabel}
              title={copyDownloadActionLabel}
              onClick={handleCopyDownloadLink}
              disabled={!downloadUrl}
              block
            >
              {t('appUpdate.copyDownloadLink')}
            </Button>
            {downloadUrl ? (
              <Text code copyable={{ text: downloadUrl }} style={{ maxWidth: '100%', whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
                {downloadUrl}
              </Text>
            ) : null}
          </Space>
        ) : null}
        {releaseNotes.length ? (
          <div>
            <Text strong>{t('appUpdate.releaseNotes')}</Text>
            <ul>
              {releaseNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </Space>
    </Modal>
  );
};

const NativeMobileContrastGuard: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    if (!isNativeMobileApp() && !document.body?.classList.contains('shop-mobile-app')) {
      return;
    }
    return installAsyncUiGuard(
      loadMobileContrastGuard,
      ({ installMobileContrastGuard }) => installMobileContrastGuard(),
      'App.loadMobileContrastGuard.install',
    );
  }, []);

  useEffect(() => {
    if (!isNativeMobileApp() && !document.body?.classList.contains('shop-mobile-app')) {
      return;
    }

    return refreshAsyncUiGuard(
      loadMobileContrastGuard,
      ({ refreshMobileContrastGuard }) => refreshMobileContrastGuard(),
      'App.loadMobileContrastGuard.refresh',
    );
  }, [location.pathname, location.search, location.hash]);

  return null;
};

const AndroidUiFinalGuard: React.FC = () => {
  const location = useLocation();

  useEffect(() => installAsyncUiGuard(
    loadAndroidUiFinalGuard,
    ({ installAndroidUiFinalGuard }) => installAndroidUiFinalGuard(),
    'App.loadAndroidUiFinalGuard.install',
  ), []);

  useEffect(() => {
    return refreshAsyncUiGuard(
      loadAndroidUiFinalGuard,
      ({ refreshAndroidUiFinalGuard }) => refreshAndroidUiFinalGuard(),
      'App.loadAndroidUiFinalGuard.refresh',
    );
  }, [location.pathname, location.search, location.hash]);

  return null;
};

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
      scrollAppToTop('auto');
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

const NativeBackNavigation: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const routeStackRef = useRef<string[]>([]);
  const currentRouteKey = `${location.pathname}${location.search}${location.hash}`;

  useEffect(() => {
    const stack = routeStackRef.current;
    if (stack.length === 0) {
      routeStackRef.current = [currentRouteKey];
      return;
    }

    if (navigationType === 'REPLACE') {
      stack[stack.length - 1] = currentRouteKey;
      return;
    }

    if (navigationType === 'POP') {
      const existingIndex = stack.lastIndexOf(currentRouteKey);
      routeStackRef.current = existingIndex >= 0 ? stack.slice(0, existingIndex + 1) : [currentRouteKey];
      return;
    }

    if (stack[stack.length - 1] !== currentRouteKey) {
      stack.push(currentRouteKey);
    }
  }, [currentRouteKey, navigationType]);

  useEffect(() => {
    if (!isNativeMobileApp()) return;
    const appPlugin = window.Capacitor?.Plugins?.App;
    if (!appPlugin || typeof appPlugin.addListener !== 'function') return;

    let disposed = false;
    let removeListener: (() => Promise<void> | void) | null = null;

    const handleNativeBack = () => {
      if (consumeNativeBack()) {
        return;
      }
      const stack = routeStackRef.current;
      if (stack.length > 1) {
        navigate(-1);
        return;
      }
      if (window.location.pathname !== '/') {
        navigate('/', { replace: true });
        return;
      }
      if (typeof appPlugin.minimizeApp === 'function') {
        void appPlugin.minimizeApp();
        return;
      }
      if (typeof appPlugin.exitApp === 'function') {
        void appPlugin.exitApp();
      }
    };

    Promise.resolve(appPlugin.addListener('backButton', handleNativeBack))
      .then((listener) => {
        if (disposed) {
          void listener?.remove?.();
          return;
        }
        removeListener = listener?.remove ? () => listener.remove() : null;
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      if (removeListener) {
        void removeListener();
      }
    };
  }, [navigate]);

  return null;
};

const LazyCartDrawerHost: React.FC = () => {
  const [loaded, setLoaded] = useState(false);
  const [drawerReady, setDrawerReady] = useState(false);
  const [openRequest, setOpenRequest] = useState<CartDrawerOpenRequest | null>(null);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    if (drawerReady) return;
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
    const eventDetail = getSupportOpenDetail(event);
    const clearGuestContext = eventDetail?.clearGuestContext === true;
    if (clearGuestContext) {
      clearGuestSupportContext();
    }
    const guestDetail = clearGuestContext ? eventDetail : eventDetail || toSupportOpenDetail(loadGuestSupportContext());
    if (guestDetail && !clearGuestContext) {
      saveGuestSupportContext({ orderNo: guestDetail.guestOrderNo || '', email: guestDetail.guestEmail || '' });
    }
    requestSeqRef.current += 1;
    setOpenRequest({ id: requestSeqRef.current, ...(guestDetail || {}) });
    setLoaded(true);
  }, []);

  const preloadSupport = useCallback(() => undefined, []);

  useEffect(() => {
    if (widgetReady) return;
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
  const [appScrolled, setAppScrolled] = useState(false);
  const [bottomRailConflict, setBottomRailConflict] = useState(false);
  const openSupport = useCallback(() => {
    const guestDetail = toSupportOpenDetail(loadGuestSupportContext());
    dispatchDomEvent('shop:open-support', guestDetail || undefined);
  }, []);

  useEffect(() => {
    if (!isNativeMobileApp() && !document.body?.classList.contains('shop-mobile-app')) {
      setAppScrolled(false);
      setBottomRailConflict(false);
      return;
    }

    const updateScrolledState = () => {
      const metrics = getAppScrollMetrics();
      const nextScrolled = metrics.scrollTop > 24;
      setAppScrolled((current) => (current === nextScrolled ? current : nextScrolled));

      const mainContent = document.getElementById(MAIN_CONTENT_ID);
      const possibleBottomRailTop = window.innerHeight - 76 - Math.max(0, Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-bottom') || '0'));
      const interactiveSelector = [
        'button',
        'a[href]',
        'input',
        'textarea',
        '[role="button"]',
        '.ant-select-selector',
        '.ant-checkbox-wrapper',
        '.ant-radio-wrapper',
        '.ant-pagination-item',
      ].join(',');
      const nextBottomRailConflict = Boolean(mainContent && Array.from(mainContent.querySelectorAll<HTMLElement>(interactiveSelector)).some((element) => {
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || 1) === 0) return false;
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0 || rect.top >= window.innerHeight) return false;
        return Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, possibleBottomRailTop) > 0.5;
      }));
      setBottomRailConflict((current) => (current === nextBottomRailConflict ? current : nextBottomRailConflict));
    };

    updateScrolledState();
    const removeScrollListener = addAppScrollListener(updateScrolledState, { passive: true });
    const frameId = window.requestAnimationFrame(updateScrolledState);
    const timeoutId = window.setTimeout(updateScrolledState, 160);

    return () => {
      removeScrollListener();
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [location.pathname, location.search, location.hash]);

  const shellClassName = [
    'shop-app-shell',
    location.pathname === '/' ? 'shop-app-shell--home' : '',
    appScrolled ? 'shop-app-shell--scrolled' : '',
    bottomRailConflict ? 'shop-app-shell--bottom-rail-conflict' : '',
    location.pathname === '/products' ? 'shop-app-shell--product-list' : '',
    location.pathname === '/products' || location.pathname.startsWith('/products/') ? 'shop-app-shell--product-area' : '',
    location.pathname.startsWith('/products/') ? 'shop-app-shell--product-detail' : '',
    location.pathname === '/cart' ? 'shop-app-shell--cart' : '',
    location.pathname === '/coupons' ? 'shop-app-shell--coupon-center' : '',
    location.pathname === '/checkout' ? 'shop-app-shell--checkout' : '',
    location.pathname === '/profile' ? 'shop-app-shell--profile-flow' : '',
    location.pathname === '/history' ? 'shop-app-shell--history' : '',
    location.pathname === '/track-order' ? 'shop-app-shell--order-tracking-flow' : '',
    location.pathname.startsWith('/payment/') ? 'shop-app-shell--payment-instructions' : '',
    location.pathname === '/pet-finder' ? 'shop-app-shell--pet-finder' : '',
    location.pathname === '/pet-gallery' ? 'shop-app-shell--pet-gallery' : '',
    location.pathname === '/checkout' ? 'shop-app-shell--checkout-flow' : '',
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
      <SkipToContentLink />
      <Navbar />
      <Content id={MAIN_CONTENT_ID} tabIndex={-1} style={{ marginTop: 0, padding: 0 }}>
        <ErrorBoundary key={location.pathname}>
          <Outlet />
        </ErrorBoundary>
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
      <AccessibleMessageLiveRegion />
      <NativeAppClassHost />
      <NativeMobileUpdateGate />
      <AndroidUiFinalGuard />
      <NativeMobileContrastGuard />
      <NativeBackNavigation />
      <AuthStartupGate>
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
                <Route path="profile" element={protectedRouteElement(<Profile />)} />
                <Route path="wishlist" element={protectedRouteElement(<Wishlist />)} />
                <Route path="history" element={<BrowsingHistory />} />
                <Route path="stock-alerts" element={<StockAlerts />} />
                <Route path="notifications" element={protectedRouteElement(<Notifications />)} />
                <Route path="track-order" element={<OrderTracking />} />
                <Route path="payment/:orderNo" element={<PaymentInstructions />} />
                <Route path="login" element={<Login />} />
                <Route path="forgot-password" element={<ForgotPassword />} />
                <Route path="register" element={<Register />} />
                <Route path="*" element={<NotFound />} />
              </Route>

              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="dashboard" element={adminRouteElement('admin-dashboard', <AdminDashboard />)} />
                <Route path="products" element={adminRouteElement('admin-products', <ProductManagement />)} />
                <Route path="brands" element={adminRouteElement('admin-brands', <BrandManagement />)} />
                <Route path="categories" element={adminRouteElement('admin-categories', <CategoryManagement />)} />
                <Route path="orders" element={adminRouteElement('admin-orders', <OrderManagement />)} />
                <Route path="logistics-carriers" element={adminRouteElement('admin-logistics-carriers', <LogisticsCarrierManagement />)} />
                <Route path="coupons" element={adminRouteElement('admin-coupons', <CouponManagement />)} />
                <Route path="users" element={adminRouteElement('admin-users', <UserManagement />)} />
                <Route path="permissions" element={adminRouteElement('admin-permissions', <PermissionManagement />)} />
                <Route path="reviews" element={adminRouteElement('admin-reviews', <ReviewManagement />)} />
                <Route path="questions" element={adminRouteElement('admin-questions', <ProductQuestionManagement />)} />
                <Route path="notifications" element={adminRouteElement('admin-notifications', <NotificationManagement />)} />
                <Route path="announcements" element={adminRouteElement('admin-announcements', <AnnouncementManagement />)} />
                <Route path="support" element={adminRouteElement('admin-support', <SupportManagement />)} />
                <Route path="audit-logs" element={adminRouteElement('admin-audit-logs', <SecurityAuditLogManagement />)} />
                <Route path="alerts" element={adminRouteElement('admin-alerts', <AlertManagement />)} />
                <Route path="bugs" element={adminRouteElement('admin-bugs', <BugManagement />)} />
                <Route path="ip-blacklist" element={adminRouteElement('admin-ip-blacklist', <IpBlacklistManagement />)} />
                <Route path="logs" element={adminRouteElement('admin-logs', <LogManagement />)} />
                <Route path="pet-gallery" element={adminRouteElement('admin-pet-gallery', <PetGalleryManagement />)} />
                <Route path="registry" element={adminRouteElement('admin-registry', <RegistryManagement />)} />
                <Route path="config-center" element={adminRouteElement('admin-config-center', <ConfigCenter />)} />
                <Route path="traffic-control" element={adminRouteElement('admin-traffic-control', <TrafficControl />)} />
                <Route path="system" element={adminRouteElement('admin-system', <SystemMonitor />)} />
                <Route path="*" element={adminRouteElement('admin-not-found', <NotFound />)} />
              </Route>

              <Route path="/product-management" element={<Navigate to="/admin/products" replace />} />
              <Route path="/category-management" element={<Navigate to="/admin/categories" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </AuthStartupGate>
    </Router>
  );
};

export default App;
