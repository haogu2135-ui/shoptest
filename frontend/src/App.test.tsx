import fs from 'fs';
import path from 'path';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { clearStoredAuthSession, userApi } from './api/core';
import { AccessibleMessageLiveRegion, AuthStartupGate } from './App';
import { LanguageProvider } from './i18n';
import enLocale from './locales/en.json';
import esLocale from './locales/es.json';
import zhLocale from './locales/zh.json';
import { getLocalStorageItem, hasStoredValue, removeLocalStorageItem, setLocalStorageItem } from './utils/safeStorage';
import { getEffectiveRole } from './utils/roles';
import { subscribeAccessibleMessages } from './utils/accessibleMessage';
import { reportNonBlockingError } from './utils/nonBlockingError';

jest.mock('./api/core', () => ({
  clearStoredAuthSession: jest.fn(),
  userApi: {
    getProfile: jest.fn(),
  },
}));

jest.mock('./utils/roles', () => ({
  getEffectiveRole: jest.fn(() => 'SUPER_ADMIN'),
}));

jest.mock('./utils/safeStorage', () => ({
  getLocalStorageItem: jest.fn(() => null),
  hasStoredValue: jest.fn(),
  removeLocalStorageItem: jest.fn(),
  setLocalStorageItem: jest.fn(),
}));

jest.mock('./utils/androidUiFinalGuard', () => ({
  installAndroidUiFinalGuard: jest.fn(),
  refreshAndroidUiFinalGuard: jest.fn(),
}));

jest.mock('./utils/mobileContrastGuard', () => ({
  installMobileContrastGuard: jest.fn(),
  refreshMobileContrastGuard: jest.fn(),
}));

jest.mock('./utils/accessibleMessage', () => ({
  subscribeAccessibleMessages: jest.fn(),
}));

jest.mock('./utils/nonBlockingError', () => ({
  reportNonBlockingError: jest.fn(),
}));

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

type TestAccessibleAnnouncement = {
  id: number;
  text: string;
  type?: string;
};

type TestAccessibleMessageListener = (announcement: TestAccessibleAnnouncement) => void;

const createDeferred = <T,>(): Deferred<T> => {
  let resolve: Deferred<T>['resolve'] = () => undefined;
  let reject: Deferred<T>['reject'] = () => undefined;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
};

const readAppSource = () => fs.readFileSync(path.resolve(__dirname, 'App.tsx'), 'utf8');

const renderGate = () => render(
  <MemoryRouter>
    <LanguageProvider>
      <AuthStartupGate>
        <div>storefront shell</div>
      </AuthStartupGate>
    </LanguageProvider>
  </MemoryRouter>,
);

describe('AuthStartupGate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getEffectiveRole as jest.Mock).mockReturnValue('SUPER_ADMIN');
    (getLocalStorageItem as jest.Mock).mockImplementation((key: string) => (key === 'shop-language' ? 'en' : null));
  });

  it('renders immediately when no token is stored', () => {
    (hasStoredValue as jest.Mock).mockReturnValue(false);

    renderGate();

    expect(screen.getByText('storefront shell')).toBeInTheDocument();
    expect(userApi.getProfile).not.toHaveBeenCalled();
  });

  it('validates a stored token before rendering the storefront shell', async () => {
    const profileRequest = createDeferred<{ data: any }>();
    (hasStoredValue as jest.Mock).mockReturnValue(true);
    (userApi.getProfile as jest.Mock).mockReturnValue(profileRequest.promise);

    renderGate();

    expect(screen.queryByText('storefront shell')).not.toBeInTheDocument();
    const loadingStatus = screen.getByRole('status');
    expect(loadingStatus).toHaveClass('app-route-loading__text');
    expect(loadingStatus).toHaveTextContent('Loading app…');
    expect(userApi.getProfile).toHaveBeenCalledWith({ skipAuthRedirect: true });

    profileRequest.resolve({
      data: {
        id: 9,
        username: 'Admin Mia',
        role: 'ADMIN',
        roleCode: 'SUPER_ADMIN',
      },
    });

    await waitFor(() => expect(screen.getByText('storefront shell')).toBeInTheDocument());
    expect(setLocalStorageItem).toHaveBeenCalledWith('userId', '9');
    expect(setLocalStorageItem).toHaveBeenCalledWith('username', 'Admin Mia');
    expect(setLocalStorageItem).toHaveBeenCalledWith('role', 'SUPER_ADMIN');
    expect(removeLocalStorageItem).not.toHaveBeenCalledWith('role');
  });

  it('defines the startup loading copy for every storefront language', () => {
    expect(enLocale.app.loading).toBe('Loading app…');
    expect(zhLocale.app.loading).toBe('App 加载中…');
    expect(esLocale.app.loading).toBe('Cargando app…');
    expect(enLocale.app.statusAnnouncementLabel).toBe('App status updates');
    expect(zhLocale.app.statusAnnouncementLabel).toBe('App 状态更新');
    expect(esLocale.app.statusAnnouncementLabel).toBe('Actualizaciones de estado de la app');
  });

  it('clears an invalid stored token before rendering logged-out UI', async () => {
    (hasStoredValue as jest.Mock).mockReturnValue(true);
    (userApi.getProfile as jest.Mock).mockRejectedValue({ response: { status: 401 } });

    renderGate();

    expect(screen.queryByText('storefront shell')).not.toBeInTheDocument();

    await waitFor(() => expect(screen.getByText('storefront shell')).toBeInTheDocument());
    expect(clearStoredAuthSession).toHaveBeenCalledTimes(1);
  });

  it('keeps a stored token for transient startup profile failures', async () => {
    const profileError = { response: { status: 503 } };
    (hasStoredValue as jest.Mock).mockReturnValue(true);
    (userApi.getProfile as jest.Mock).mockRejectedValue(profileError);

    renderGate();

    await waitFor(() => expect(screen.getByText('storefront shell')).toBeInTheDocument());
    expect(clearStoredAuthSession).not.toHaveBeenCalled();
    expect(reportNonBlockingError).toHaveBeenCalledWith('AuthStartupGate.validateStoredSession', profileError);
  });

  it('reports non-auth startup profile failures without clearing the stored session', () => {
    const source = readAppSource();
    const authGateSource = source.slice(
      source.indexOf('export const AuthStartupGate'),
      source.indexOf('const NativeAppClassHost'),
    );

    expect(authGateSource).toContain('userApi.getProfile({ skipAuthRedirect: true })');
    expect(authGateSource).toContain('if (isAuthExpiredError(error))');
    expect(authGateSource).toContain('clearStoredAuthSession();');
    expect(source).toContain("const AUTH_REQUIRED_ROUTE_PREFIXES = ['/admin', '/checkout', '/notifications', '/profile', '/wishlist'];");
    expect(authGateSource).toContain('if (isAuthRequiredRoutePath(window.location.pathname)) {');
    expect(authGateSource).toContain('navigate(buildLoginUrlFromWindow(), { replace: true });');
    expect(authGateSource).toContain("reportNonBlockingError('AuthStartupGate.validateStoredSession', error);");
    expect(authGateSource.indexOf('clearStoredAuthSession();')).toBeLessThan(
      authGateSource.indexOf("reportNonBlockingError('AuthStartupGate.validateStoredSession', error);"),
    );
    expect(authGateSource).not.toContain('window.location.href');
    expect(authGateSource).not.toMatch(/\bmessage\./);
    expect(authGateSource).not.toMatch(/\bModal\./);
  });

  it('keeps storefront routes inside the shared auth provider', () => {
    const source = readAppSource();
    const appSource = source.slice(source.indexOf('const App: React.FC'));

    expect(source).toContain("import { AuthProvider } from './hooks/useAuth';");
    expect(source).toContain('const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {');
    expect(source).toContain('return <Navigate to={buildLoginUrl(getCurrentRelativeUrl(location))} replace />;');
    expect(source).toContain('const protectedRouteElement = (element: React.ReactElement) => (');
    expect(appSource).toContain('<AuthProvider>');
    expect(appSource).toContain('<AuthStartupGate>');
    expect(appSource).toContain('<Route path="profile" element={protectedRouteElement(<Profile />)} />');
    expect(appSource).toContain('<Route path="wishlist" element={protectedRouteElement(<Wishlist />)} />');
    expect(appSource).toContain('<Route path="notifications" element={protectedRouteElement(<Notifications />)} />');
    expect(appSource).toContain('<Route path="checkout" element={<Checkout />} />');
    expect(appSource.indexOf('<AuthProvider>')).toBeLessThan(appSource.indexOf('<AuthStartupGate>'));
    expect(appSource.indexOf('</AuthStartupGate>')).toBeLessThan(appSource.indexOf('</AuthProvider>'));
  });

  it('routes floating overlay boundary failures through non-blocking diagnostics', () => {
    const source = readAppSource();
    const boundarySource = source.slice(
      source.indexOf('class FloatingOverlayBoundary'),
      source.indexOf('const getSupportOpenDetail'),
    );

    expect(boundarySource).toContain('reportNonBlockingError(this.props.reportContext, error);');
    expect(boundarySource).not.toMatch(/\bconsole\.(error|warn)\b/);
  });

  it('keeps cart and support floating overlays inside their own recoverable boundary', () => {
    const source = readAppSource();
    const cartHostSource = source.slice(
      source.indexOf('const LazyCartDrawerHost'),
      source.indexOf('type SupportOpenDetail'),
    );
    const supportHostSource = source.slice(
      source.indexOf('const LazySupportWidgetHost'),
      source.indexOf('const StorefrontLayout'),
    );

    expect(cartHostSource).toContain('<FloatingOverlayBoundary');
    expect(cartHostSource).toContain('reportContext="FloatingOverlayBoundary.cartDrawer.componentDidCatch"');
    expect(cartHostSource).toContain('<LazyCartDrawer');
    expect(cartHostSource.indexOf('<FloatingOverlayBoundary')).toBeLessThan(cartHostSource.indexOf('<LazyCartDrawer'));
    expect(cartHostSource.indexOf('</FloatingOverlayBoundary>')).toBeGreaterThan(cartHostSource.indexOf('<LazyCartDrawer'));

    expect(supportHostSource).toContain('<FloatingOverlayBoundary');
    expect(supportHostSource).toContain('reportContext="FloatingOverlayBoundary.supportWidget.componentDidCatch"');
    expect(supportHostSource).toContain('<LazyCustomerSupportWidget');
    expect(supportHostSource).toContain('<Suspense fallback={null}>');
    expect(supportHostSource).toContain('void loadCustomerSupportWidget()');
    expect(supportHostSource.indexOf('<FloatingOverlayBoundary')).toBeLessThan(supportHostSource.indexOf('<LazyCustomerSupportWidget'));
    expect(supportHostSource.indexOf('</FloatingOverlayBoundary>')).toBeGreaterThan(supportHostSource.indexOf('<LazyCustomerSupportWidget'));
  });
});

describe('App chunking contracts', () => {
  it('lazy loads native UI guard utilities outside the main App imports', () => {
    const source = readAppSource();

    expect(source).not.toContain("from './utils/mobileContrastGuard'");
    expect(source).not.toContain("from './utils/androidUiFinalGuard'");
    expect(source).toContain("const loadMobileContrastGuard = () => import('./utils/mobileContrastGuard');");
    expect(source).toContain("const loadAndroidUiFinalGuard = () => import('./utils/androidUiFinalGuard');");
    expect(source).toContain('installAsyncUiGuard(');
    expect(source).toContain('refreshAsyncUiGuard(');
    expect(source).not.toMatch(/^import '\.\/mobile-app\.css';/m);
    expect(source).toContain("import(/* webpackChunkName: \"mobile-app-css\" */ './mobile-app.css')");
    expect(source).toContain('loadMobileAppCss()');
    expect(source).not.toMatch(/^import CustomerSupportWidget from '\.\/components\/CustomerSupportWidget';/m);
    expect(source).toContain('loadCustomerSupportWidget');
    expect(source).toContain('LazyCustomerSupportWidget');

  });

  it('keeps storefront and admin page routes lazy loaded behind the route Suspense boundary', () => {
    const source = readAppSource();
    const routePageChunks = [
      ['AdminDashboard', './pages/AdminDashboard'],
      ['AlertManagement', './pages/AlertManagement'],
      ['AnnouncementManagement', './pages/AnnouncementManagement'],
      ['BrandManagement', './pages/BrandManagement'],
      ['BugManagement', './pages/BugManagement'],
      ['BrowsingHistory', './pages/BrowsingHistory'],
      ['Cart', './pages/Cart'],
      ['CategoryManagement', './pages/CategoryManagement'],
      ['Checkout', './pages/Checkout'],
      ['ConfigCenter', './pages/ConfigCenter'],
      ['CouponCenter', './pages/CouponCenter'],
      ['CouponManagement', './pages/CouponManagement'],
      ['ForgotPassword', './pages/ForgotPassword'],
      ['Home', './pages/Home'],
      ['Login', './pages/Login'],
      ['IpBlacklistManagement', './pages/IpBlacklistManagement'],
      ['LogisticsCarrierManagement', './pages/LogisticsCarrierManagement'],
      ['LogManagement', './pages/LogManagement'],
      ['Notifications', './pages/Notifications'],
      ['NotificationManagement', './pages/NotificationManagement'],
      ['OrderManagement', './pages/OrderManagement'],
      ['OrderTracking', './pages/OrderTracking'],
      ['PaymentInstructions', './pages/PaymentInstructions'],
      ['PetFinder', './pages/PetFinder'],
      ['PetGallery', './pages/PetGallery'],
      ['PetGalleryManagement', './pages/PetGalleryManagement'],
      ['PermissionManagement', './pages/PermissionManagement'],
      ['ProductCompare', './pages/ProductCompare'],
      ['ProductDetail', './pages/ProductDetail'],
      ['ProductList', './pages/ProductList'],
      ['ProductManagement', './pages/ProductManagement'],
      ['ProductQuestionManagement', './pages/ProductQuestionManagement'],
      ['Profile', './pages/Profile'],
      ['Register', './pages/Register'],
      ['RegistryManagement', './pages/RegistryManagement'],
      ['ReviewManagement', './pages/ReviewManagement'],
      ['SecurityAuditLogManagement', './pages/SecurityAuditLogManagement'],
      ['StockAlerts', './pages/StockAlerts'],
      ['SupportManagement', './pages/SupportManagement'],
      ['SystemMonitor', './pages/SystemMonitor'],
      ['TrafficControl', './pages/TrafficControl'],
      ['UserManagement', './pages/UserManagement'],
      ['Wishlist', './pages/Wishlist'],
      ['NotFound', './pages/NotFound'],
    ];
    const directPageImports = source
      .split('\n')
      .filter((line) => /^import\s+/.test(line) && /from ['"]\.\/pages\//.test(line));
    const routesIndex = source.indexOf('<Routes>');
    const routeSuspenseStart = source.lastIndexOf('<Suspense fallback={<LoadingFallback />}>', routesIndex);
    const routeSuspenseEnd = source.indexOf('</Suspense>', routesIndex);

    expect(source).toContain('import React, { Suspense, lazy');
    expect(directPageImports).toEqual([]);
    routePageChunks.forEach(([componentName, importPath]) => {
      expect(source).toContain(`const ${componentName} = lazy(() => import('${importPath}'));`);
    });
    expect(routeSuspenseStart).toBeGreaterThan(-1);
    expect(routesIndex).toBeGreaterThan(routeSuspenseStart);
    expect(routeSuspenseEnd).toBeGreaterThan(routesIndex);
  });
});

describe('App route error boundary contracts', () => {
  it('keeps storefront route content behind a pathname-keyed ErrorBoundary', () => {
    const source = readAppSource();
    const storefrontLayoutSource = source.slice(
      source.indexOf('const StorefrontLayout'),
      source.indexOf('const App: React.FC'),
    );

    expect(storefrontLayoutSource).toContain('<ErrorBoundary key={location.pathname}>');
    expect(storefrontLayoutSource).toContain('<Outlet />');
    expect(storefrontLayoutSource.indexOf('<ErrorBoundary key={location.pathname}>')).toBeLessThan(
      storefrontLayoutSource.indexOf('<Outlet />'),
    );
    expect(storefrontLayoutSource.indexOf('<Outlet />')).toBeLessThan(
      storefrontLayoutSource.indexOf('</ErrorBoundary>', storefrontLayoutSource.indexOf('<Outlet />')),
    );
  });

  it('wraps concrete admin child routes in admin-scoped route boundaries', () => {
    const source = readAppSource();
    const adminRoutesSource = source.slice(
      source.indexOf('<Route path="/admin" element={<AdminLayout />}>'),
      source.indexOf('<Route path="/product-management"'),
    );
    const concreteAdminRouteLines = adminRoutesSource
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('<Route path="') && !line.startsWith('<Route path="/admin"'));

    expect(source).toContain('const AdminRouteBoundary');
    expect(source).toContain('homePath="/admin/dashboard"');
    expect(concreteAdminRouteLines.length).toBeGreaterThan(10);
    concreteAdminRouteLines.forEach((line) => {
      expect(line).toContain('element={adminRouteElement(');
    });
  });
});

describe('AccessibleMessageLiveRegion', () => {
  const accessibleMessageListeners: TestAccessibleMessageListener[] = [];

  beforeEach(() => {
    jest.clearAllMocks();
    accessibleMessageListeners.length = 0;
    (subscribeAccessibleMessages as jest.Mock).mockImplementation((listener: TestAccessibleMessageListener) => {
      accessibleMessageListeners.push(listener);
      return () => {
        const index = accessibleMessageListeners.indexOf(listener);
        if (index >= 0) {
          accessibleMessageListeners.splice(index, 1);
        }
      };
    });
    (getLocalStorageItem as jest.Mock).mockImplementation((key: string) => (key === 'shop-language' ? 'en' : null));
  });

  it('mirrors AntD message announcements into a global aria-live region', () => {
    render(
      <LanguageProvider>
        <AccessibleMessageLiveRegion />
      </LanguageProvider>,
    );

    const liveRegion = screen.getByRole('status', { name: 'App status updates' });
    expect(liveRegion).toHaveAttribute('aria-live', 'polite');
    expect(liveRegion).toHaveAttribute('aria-atomic', 'true');
    expect(subscribeAccessibleMessages).toHaveBeenCalledTimes(1);

    act(() => {
      accessibleMessageListeners[0]({ id: 1, text: 'Saved changes', type: 'success' });
    });

    expect(liveRegion).toHaveTextContent('Saved changes');
  });
});
