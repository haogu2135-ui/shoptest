import fs from 'fs';
import path from 'path';
import { act, render, screen, waitFor } from '@testing-library/react';
import { clearStoredAuthSession, userApi } from './api';
import { AccessibleMessageLiveRegion, AuthStartupGate } from './App';
import { LanguageProvider } from './i18n';
import enLocale from './locales/en.json';
import esLocale from './locales/es.json';
import zhLocale from './locales/zh.json';
import { getLocalStorageItem, hasStoredValue, removeLocalStorageItem, setLocalStorageItem } from './utils/safeStorage';
import { getEffectiveRole } from './utils/roles';
import { subscribeAccessibleMessages } from './utils/accessibleMessage';
import { reportNonBlockingError } from './utils/nonBlockingError';

jest.mock('./api', () => ({
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
  <LanguageProvider>
    <AuthStartupGate>
      <div>storefront shell</div>
    </AuthStartupGate>
  </LanguageProvider>,
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
    expect(authGateSource).toContain("reportNonBlockingError('AuthStartupGate.validateStoredSession', error);");
    expect(authGateSource.indexOf('clearStoredAuthSession();')).toBeLessThan(
      authGateSource.indexOf("reportNonBlockingError('AuthStartupGate.validateStoredSession', error);"),
    );
    expect(authGateSource).not.toMatch(/\bmessage\./);
    expect(authGateSource).not.toMatch(/\bModal\./);
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
