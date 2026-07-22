import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { BrowserRouter as Router, Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate, useNavigationType } from 'react-router-dom';

import ErrorBoundary from './components/ErrorBoundary';
import SkipToContentLink, { MAIN_CONTENT_ID } from './components/SkipToContentLink';
import { AuthProvider } from './hooks/useAuth';
import { useLanguage } from './i18n';
import type { CartItem, UserProfile } from './types';
import { dispatchDomEvent } from './utils/domEvents';
import { addAppScrollListener, getAppScrollMetrics, scrollAppToTop } from './utils/nativeScroll';
import { consumeNativeBack, useNativeBackHandler } from './utils/nativeBack';
import { getLocalStorageItem, hasStoredValue, removeLocalStorageItem, setLocalStorageItem } from './utils/safeStorage';
import { clearGuestSupportContext, loadGuestSupportContext, normalizeGuestSupportContext, saveGuestSupportContext } from './utils/guestSupportContext';
import { buildLoginUrl, buildLoginUrlFromWindow, getCurrentRelativeUrl } from './utils/authRedirect';
import { AUTH_SESSION_CHANGED_EVENT, AUTH_SESSION_STORAGE_KEYS } from './utils/authEvents';
import { isAuthExpiredError } from './utils/apiError';
import { getEffectiveRole } from './utils/roles';
import { reportNonBlockingError } from './utils/nonBlockingError';
import { subscribeAccessibleMessages, type AccessibleMessageAnnouncement } from './utils/accessibleMessage';
import {
  currentNativeMobilePlatform,
  isNativeMobileApp,
} from './utils/mobileUpdate';
import './App.css';


/** Lightweight shell icons — keep ant-design icons package out of the App entry graph. */
const ShellIcon: React.FC<{ path: string }> = ({ path }) => (
  <svg className="shop-shell-icon" viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" focusable="false">
    <path fill="currentColor" d={path} />
  </svg>
);
const SHELL_ICON_SUPPORT = 'M12 2C6.48 2 2 6.04 2 11c0 2.38 1.19 4.51 3.06 6.01L4 22l5.2-1.86C10.1 20.37 11.03 20.5 12 20.5 17.52 20.5 22 16.46 22 11.5S17.52 2 12 2zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z';
const SHELL_ICON_SEARCH = 'M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z';
const SHELL_ICON_GIFT = 'M20 6h-2.18c.11-.31.18-.65.18-1a2.996 2.996 0 0 0-5.5-1.65l-.5.67-.5-.68C10.96 2.54 9.81 2 8.5 2 6.85 2 5.5 3.35 5.5 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM8.5 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM12 12.68 15.93 17H8.07L12 12.68zM12 9.32 8.07 5h7.86L12 9.32z';
const SHELL_ICON_USER_ADD = 'M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z';


const loadAuthCore = () => import(/* webpackChunkName: "api-core" */ './api/core');


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

const loadNavbar = () => import(/* webpackChunkName: "navbar" */ './components/Navbar');
const LazyNavbar = lazy(loadNavbar);
const LazyCookieConsentBanner = lazy(() => import(/* webpackChunkName: "cookie-consent" */ './components/CookieConsentBanner'));
const LazyNativeMobileUpdateGate = lazy(() => import(/* webpackChunkName: "mobile-update-gate" */ './components/NativeMobileUpdateGate'));
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
const LegalPage = lazy(() => import('./pages/LegalPage'));
const loadCartDrawer = () => import(/* webpackChunkName: "cart-drawer" */ './components/CartDrawer');
const LazyCartDrawer = lazy(loadCartDrawer);
const loadCustomerSupportWidget = () => import(/* webpackChunkName: "customer-support-widget" */ './components/CustomerSupportWidget');
const LazyCustomerSupportWidget = lazy(loadCustomerSupportWidget);
const loadAndroidUiFinalGuard = () => import('./utils/androidUiFinalGuard');
const loadMobileContrastGuard = () => import('./utils/mobileContrastGuard');
const loadMobileAppCss = () => import(/* webpackChunkName: "mobile-app-css" */ './mobile-app.css');

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

type FloatingOverlayBoundaryProps = {
  fallback: React.ReactNode;
  reportContext: string;
  resetKey?: number;
  children: React.ReactNode;
};

type FloatingOverlayBoundaryState = {
  hasError: boolean;
};

class FloatingOverlayBoundary extends React.Component<FloatingOverlayBoundaryProps, FloatingOverlayBoundaryState> {
  state: FloatingOverlayBoundaryState = { hasError: false };

  static getDerivedStateFromError(): FloatingOverlayBoundaryState {
    return { hasError: true };
  }

  componentDidUpdate(previousProps: FloatingOverlayBoundaryProps) {
    if (this.state.hasError && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  componentDidCatch(error: Error) {
    reportNonBlockingError(this.props.reportContext, error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

const LoadingFallback = () => {
  const { t } = useLanguage();
  const location = useLocation();
  const path = location.pathname || '/';
  // Keep conversion shells on a commercial h1 while lazy route chunks hydrate.
  let routeTitle: string | null = null;
  if (path === '/cart' || path.startsWith('/cart/')) {
    routeTitle = t('pages.cart.title');
  } else if (path === '/checkout' || path.startsWith('/checkout/')) {
    routeTitle = t('pages.checkout.title');
  } else if (path === '/track-order' || path.startsWith('/track-order')) {
    routeTitle = t('pages.orderTracking.title');
  } else if (path === '/coupons' || path.startsWith('/coupons/')) {
    routeTitle = t('pages.coupons.title');
  } else if (path === '/wishlist' || path.startsWith('/wishlist/')) {
    routeTitle = t('pages.wishlist.pageTitle');
  } else if (path === '/profile' || path.startsWith('/profile')) {
    routeTitle = t('pages.profile.title');
  } else if (path === '/notifications' || path.startsWith('/notifications')) {
    routeTitle = t('pages.notifications.title');
  } else if (path === '/pet-finder' || path.startsWith('/pet-finder')) {
    routeTitle = t('pages.petFinder.title');
  } else if (path === '/compare' || path.startsWith('/compare')) {
    routeTitle = t('pages.compare.title');
  } else if (path === '/stock-alerts' || path.startsWith('/stock-alerts')) {
    routeTitle = t('pages.stockAlerts.title');
  } else if (path === '/history' || path.startsWith('/history')) {
    routeTitle = t('pages.browsingHistory.title');
  } else if (path === '/forgot-password' || path.startsWith('/forgot-password')) {
    routeTitle = t('pages.auth.resetPasswordTitle');
  } else if (/^\/products\/[^/]+/.test(path)) {
    routeTitle = t('pages.productDetail.product');
  }

  return (
    <div className="app-route-loading" role="status" aria-live="polite" aria-busy="true" aria-label={t('app.loading')}>
      {routeTitle ? <h1 className="app-route-loading__title">{routeTitle}</h1> : null}
      <span className="app-route-loading__spinner" aria-hidden="true" />
      <span className="app-route-loading__text">
        {t('app.loading')}
      </span>
    </div>
  );
};

export const AccessibleMessageLiveRegion: React.FC = () => {
  const { t } = useLanguage();
  const [announcement, setAnnouncement] = useState<AccessibleMessageAnnouncement | null>(null);

  useEffect(() => subscribeAccessibleMessages(setAnnouncement), []);

  useEffect(() => {
    if (!announcement) return undefined;
    const timer = window.setTimeout(() => {
      setAnnouncement((current) => (current && current.id === announcement.id ? null : current));
    }, 4200);
    return () => window.clearTimeout(timer);
  }, [announcement]);

  const tone = announcement?.type === 'error'
    ? 'error'
    : announcement?.type === 'warning'
      ? 'warning'
      : announcement?.type === 'success'
        ? 'success'
        : 'info';

  return (
    <>
      <div
        className="app-message-live-region"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-label={t('app.statusAnnouncementLabel')}
      >
        {announcement ? <span key={announcement.id}>{announcement.text}</span> : null}
      </div>
      {announcement?.shellToast ? (
        <div
          key={`toast-${announcement.id}`}
          className={`app-shell-toast app-shell-toast--${tone}`}
          role="status"
          aria-live="polite"
          data-shell-toast={tone}
        >
          {announcement.text}
        </div>
      ) : null}
    </>
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
    void loadAuthCore()
      .then(({ userApi, clearStoredAuthSession }) => {
        if (disposed) return undefined;
        return userApi.getProfile({ skipAuthRedirect: true })
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
          });
      })
      .catch((error) => {
        if (!disposed) {
          reportNonBlockingError('AuthStartupGate.loadAuthCore', error);
        }
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
    let disposed = false;

    // Commercial web performance: keep the 500KB+ native shell CSS out of desktop main CSS.
    // Apply classes after stylesheet resolves to avoid unstyled native chrome flash.
    loadMobileAppCss()
      .catch((error) => {
        reportNonBlockingError('App.loadMobileAppCss', error);
      })
      .finally(() => {
        if (disposed || !document.body) return;
        document.documentElement.classList.add('shop-mobile-app-root');
        document.body.classList.add('shop-mobile-app');
        if (platform) {
          document.body.classList.add(`shop-mobile-app--${platform}`);
          document.documentElement.dataset.shopPlatform = platform;
        }
      });

    return () => {
      disposed = true;
      document.documentElement.classList.remove('shop-mobile-app-root');
      document.body?.classList.remove('shop-mobile-app', 'shop-mobile-app--android', 'shop-mobile-app--ios');
      delete document.documentElement.dataset.shopPlatform;
    };
  }, []);

  return null;
};

const NativeMobileContrastGuard: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    if (process.env.NODE_ENV === 'test') return;
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
    if (process.env.NODE_ENV === 'test') return;
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

  useEffect(() => {
    if (process.env.NODE_ENV === 'test') return;
    return installAsyncUiGuard(
      loadAndroidUiFinalGuard,
      ({ installAndroidUiFinalGuard }) => installAndroidUiFinalGuard(),
      'App.loadAndroidUiFinalGuard.install',
    );
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV === 'test') return;
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

const RouteFocusManager: React.FC = () => {
  const location = useLocation();
  const isFirstRouteRef = useRef(true);

  useEffect(() => {
    if (location.hash) return;
    if (isFirstRouteRef.current) {
      isFirstRouteRef.current = false;
      return;
    }
    // Commercial SPA a11y: move keyboard focus to main content after navigation.
    const mainContent = document.getElementById(MAIN_CONTENT_ID);
    if (!mainContent || typeof mainContent.focus !== 'function') return;
    const frameId = window.requestAnimationFrame(() => {
      try {
        mainContent.focus({ preventScroll: true });
      } catch (error) {
        reportNonBlockingError('App.RouteFocusManager.focus', error);
        mainContent.focus();
      }
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [location.pathname, location.search]);

  return null;
};

const ConnectivityBanner: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [showRestored, setShowRestored] = useState(false);
  const restoredTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const clearRestoredTimer = () => {
      if (restoredTimerRef.current !== null) {
        window.clearTimeout(restoredTimerRef.current);
        restoredTimerRef.current = null;
      }
    };
    const handleOnline = () => {
      setOnline(true);
      setShowRestored(true);
      clearRestoredTimer();
      restoredTimerRef.current = window.setTimeout(() => {
        setShowRestored(false);
        restoredTimerRef.current = null;
      }, 3200);
    };
    const handleOffline = () => {
      clearRestoredTimer();
      setShowRestored(false);
      setOnline(false);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      clearRestoredTimer();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (online && !showRestored) {
    return null;
  }

  const title = online ? t('common.onlineRestoredTitle') : t('common.offlineTitle');
  const text = online ? t('common.onlineRestoredText') : t('common.offlineText');

  return (
    <div
      className={online ? 'shop-connectivity-banner shop-connectivity-banner--online' : 'shop-connectivity-banner shop-connectivity-banner--offline'}
      role="status"
      aria-live="assertive"
      aria-atomic="true"
      data-connectivity-banner={online ? 'online' : 'offline'}
    >
      <div className="shop-connectivity-banner__copy">
        <strong>{title}</strong>
        <span>{text}</span>
      </div>
      {!online ? (
        <div className="shop-connectivity-banner__actions" data-connectivity-offline-recovery="true">
          <button
            type="button"
            className="shop-shell-btn shop-shell-btn--primary shop-shell-btn--small"
            aria-label={t('messages.retry')}
            title={t('messages.retry')}
            onClick={() => window.location.reload()}
          >
            {t('messages.retry')}
          </button>
          <button
            type="button"
            className="shop-shell-btn shop-shell-btn--small"
            aria-label={t('pages.cart.title')}
            title={t('pages.cart.title')}
            onClick={() => navigate('/cart')}
          >
            {t('pages.cart.title')}
          </button>
          <button
            type="button"
            className="shop-shell-btn shop-shell-btn--small"
            aria-label={t('nav.history')}
            title={t('nav.history')}
            onClick={() => navigate('/history')}
          >
            {t('nav.history')}
          </button>
          <button
            type="button"
            className="shop-shell-btn shop-shell-btn--small"
            aria-label={t('pages.cart.browse')}
            title={t('pages.cart.browse')}
            onClick={() => navigate('/products')}
          >
            {t('pages.cart.browse')}
          </button>
        </div>
      ) : (
        <div className="shop-connectivity-banner__actions" data-connectivity-online-recovery="true">
          <button
            type="button"
            className="shop-shell-btn shop-shell-btn--primary shop-shell-btn--small"
            aria-label={t('pages.cart.browse')}
            title={t('pages.cart.browse')}
            onClick={() => navigate('/products')}
          >
            {t('pages.cart.browse')}
          </button>
          <button
            type="button"
            className="shop-shell-btn shop-shell-btn--small"
            aria-label={t('pages.cart.title')}
            title={t('pages.cart.title')}
            onClick={() => navigate('/cart')}
          >
            {t('pages.cart.title')}
          </button>
        </div>
      )}
    </div>
  );
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

  // Commercial conversion: idle-preload mini-cart so first open is not blocked on chunk download.
  useEffect(() => {
    let cancelled = false;
    let idleHandle: number | null = null;
    let timeoutHandle: ReturnType<typeof globalThis.setTimeout> | null = null;
    const preloadCart = () => {
      if (cancelled) return;
      setLoaded(true);
      void loadCartDrawer();
    };
    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (typeof win.requestIdleCallback === 'function') {
      idleHandle = win.requestIdleCallback(() => preloadCart(), { timeout: 2500 });
    } else {
      timeoutHandle = globalThis.setTimeout(preloadCart, 1200);
    }
    return () => {
      cancelled = true;
      if (idleHandle != null && typeof win.cancelIdleCallback === 'function') {
        win.cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle != null) {
        globalThis.clearTimeout(timeoutHandle);
      }
    };
  }, []);

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
    <FloatingOverlayBoundary
      resetKey={openRequest?.id}
      fallback={null}
      reportContext="FloatingOverlayBoundary.cartDrawer.componentDidCatch"
    >
      <Suspense fallback={null}>
        <LazyCartDrawer
          initialOpenRequest={openRequest}
          onReady={handleDrawerReady}
        />
      </Suspense>
    </FloatingOverlayBoundary>
  );
};

type SupportOpenDetail = {
  orderNo?: string;
  email?: string;
  guestOrderNo?: string;
  guestEmail?: string;
  clearGuestContext?: boolean;
  clearGuestSupportContext?: boolean;
};

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
      <ShellIcon path={SHELL_ICON_SUPPORT} />
    </button>
  );
};

const LazySupportWidgetHost: React.FC = () => {
  const [loaded, setLoaded] = useState(false);
  const [widgetReady, setWidgetReady] = useState(false);
  const [openRequest, setOpenRequest] = useState<SupportOpenRequest | null>(null);
  const requestSeqRef = useRef(0);

  // Commercial conversion: idle-preload support widget so first open is not blocked on chunk download.
  useEffect(() => {
    let cancelled = false;
    let idleHandle: number | null = null;
    let timeoutHandle: ReturnType<typeof globalThis.setTimeout> | null = null;
    const preloadSupportIdle = () => {
      if (cancelled) return;
      setLoaded(true);
      void loadCustomerSupportWidget();
    };
    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (typeof win.requestIdleCallback === 'function') {
      idleHandle = win.requestIdleCallback(() => preloadSupportIdle(), { timeout: 2800 });
    } else {
      timeoutHandle = globalThis.setTimeout(preloadSupportIdle, 1400);
    }
    return () => {
      cancelled = true;
      if (idleHandle != null && typeof win.cancelIdleCallback === 'function') {
        win.cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle != null) {
        globalThis.clearTimeout(timeoutHandle);
      }
    };
  }, []);

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
    void loadCustomerSupportWidget();
  }, []);

  const preloadSupport = useCallback(() => {
    setLoaded(true);
    void loadCustomerSupportWidget();
  }, []);

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
      <FloatingOverlayBoundary
        resetKey={openRequest?.id}
        fallback={<SupportLauncherButton onOpen={openSupport} onPreload={preloadSupport} />}
        reportContext="FloatingOverlayBoundary.supportWidget.componentDidCatch"
      >
        <Suspense fallback={null}>
          <LazyCustomerSupportWidget
            initialOpenRequest={openRequest}
            onReady={handleWidgetReady}
          />
        </Suspense>
      </FloatingOverlayBoundary>
    </>
  );
};


type ShopApiErrorDetail = {
  status?: number;
  method?: string;
  path?: string;
  retryCount?: number;
  transient?: boolean;
  message?: string;
};

const ApiErrorBanner: React.FC = () => {
  const { t } = useLanguage();
  const [errorDetail, setErrorDetail] = useState<ShopApiErrorDetail | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const clearHideTimer = () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };

    const onApiError = (event: Event) => {
      const custom = event as CustomEvent<ShopApiErrorDetail>;
      const detail = custom?.detail || {};
      const status = Number(detail.status || 0);
      // Auth redirects already own 401 UX; keep the banner for operational failures.
      if (status === 401) {
        return;
      }
      clearHideTimer();
      setErrorDetail({
        status: Number.isFinite(status) && status > 0 ? status : undefined,
        method: detail.method,
        path: detail.path,
        retryCount: detail.retryCount,
        transient: detail.transient,
        message: String(detail.message || '').trim() || t('common.apiErrorTitle'),
      });
      // Auto-dismiss softer failures; keep rate-limit/server/network until dismissed.
      const sticky = status === 429 || status >= 500 || !status;
      if (!sticky) {
        hideTimerRef.current = window.setTimeout(() => {
          setErrorDetail(null);
          hideTimerRef.current = null;
        }, 7000);
      }
    };

    window.addEventListener('shop:api-error', onApiError as EventListener);
    return () => {
      clearHideTimer();
      window.removeEventListener('shop:api-error', onApiError as EventListener);
    };
  }, [t]);

  if (!errorDetail) {
    return null;
  }

  const status = Number(errorDetail.status || 0);
  const title = status === 429
    ? t('common.apiErrorRateLimitedTitle')
    : status >= 500
      ? t('common.apiErrorServerTitle')
      : !status
        ? t('common.apiErrorNetworkTitle')
        : t('common.apiErrorTitle');
  const tone = status === 429 || status >= 500 || !status ? 'critical' : 'warning';

  return (
    <div
      className={`shop-api-error-banner shop-api-error-banner--${tone}`}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div className="shop-api-error-banner__copy">
        <strong>{title}</strong>
        <span>{errorDetail.message}</span>
        <span className="shop-api-error-banner__hint">{t('common.apiErrorRetryHint')}</span>
      </div>
      <button
        type="button"
        className="shop-api-error-banner__dismiss"
        aria-label={t('common.apiErrorDismiss')}
        title={t('common.apiErrorDismiss')}
        onClick={() => setErrorDetail(null)}
      >
        {t('common.apiErrorDismiss')}
      </button>
    </div>
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
      icon: <ShellIcon path={SHELL_ICON_SEARCH} />,
      title: t('nav.trackOrder'),
      text: t('pages.auth.loginTrustTracking'),
    },
    {
      key: 'coupons',
      to: '/coupons',
      icon: <ShellIcon path={SHELL_ICON_GIFT} />,
      title: t('home.couponsExtra'),
      text: t('nav.download'),
    },
    isAuthenticated
      ? {
        key: 'orders',
        to: '/profile?tab=orders',
        icon: <ShellIcon path={SHELL_ICON_SEARCH} />,
        title: t('pages.profile.allOrders'),
        text: t('pages.auth.loginTrustSecure'),
      }
      : {
        key: 'register',
        to: '/register',
        icon: <ShellIcon path={SHELL_ICON_USER_ADD} />,
        title: t('nav.register'),
        text: t('pages.auth.registerTrustPerks'),
      },
  ];

  return (
    <div className={shellClassName} style={{ minHeight: '100vh' }}>
      <SkipToContentLink />
      <ConnectivityBanner />
      <Suspense fallback={null}>
        <LazyCookieConsentBanner />
      </Suspense>
      <ApiErrorBanner />
      <Suspense fallback={<header className="app-navbar-skeleton" aria-hidden="true" style={{ minHeight: 56 }} />}>
        <LazyNavbar />
      </Suspense>
      <main id={MAIN_CONTENT_ID} tabIndex={-1} style={{ marginTop: 0, padding: 0 }}>
        <ErrorBoundary key={location.pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
      <footer className="shop-footer">
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
              <Link to="/privacy">{t('footer.privacy')}</Link>
              <Link to="/terms">{t('footer.terms')}</Link>
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
      </footer>
      <LazyCartDrawerHost />
      <LazySupportWidgetHost />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <AccessibleMessageLiveRegion />
      <NativeAppClassHost />
      <Suspense fallback={null}>
        <LazyNativeMobileUpdateGate />
      </Suspense>
      <AndroidUiFinalGuard />
      <NativeMobileContrastGuard />
      <NativeBackNavigation />
      <AuthProvider>
        <AuthStartupGate>
          <RouteScrollReset />
          <RouteFocusManager />
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
                <Route path="orders" element={<Navigate to="/profile?tab=orders" replace />} />
                <Route path="payment/:orderNo" element={<PaymentInstructions />} />
                <Route path="login" element={<Login />} />
                <Route path="forgot-password" element={<ForgotPassword />} />
                <Route path="register" element={<Register />} />
                <Route path="privacy" element={<LegalPage />} />
                <Route path="terms" element={<LegalPage />} />
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
      </AuthProvider>
    </Router>
  );
};

export default App;
