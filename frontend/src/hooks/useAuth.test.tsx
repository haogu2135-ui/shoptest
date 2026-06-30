import React from 'react';
import fs from 'fs';
import path from 'path';
import { act, render, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './useAuth';
import { clearStoredAuthSession, persistAuthSession, userApi } from '../api';
import { AUTH_SESSION_CHANGED_EVENT } from '../utils/authEvents';
import { getLocalStorageItem, setLocalStorageItem } from '../utils/safeStorage';
import { reportNonBlockingError } from '../utils/nonBlockingError';

const useAuthSource = fs.readFileSync(path.resolve(__dirname, 'useAuth.ts'), 'utf8');

jest.mock('../api', () => ({
  clearStoredAuthSession: jest.fn(),
  persistAuthSession: jest.fn(),
  userApi: {
    getProfile: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
  },
}));

jest.mock('../utils/safeStorage', () => ({
  getLocalStorageItem: jest.fn(),
  setLocalStorageItem: jest.fn(),
}));

jest.mock('../utils/nonBlockingError', () => ({
  reportNonBlockingError: jest.fn(),
}));

jest.mock('../i18n', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

type Deferred<T> = {
  promise: Promise<T>;
  reject: (reason?: unknown) => void;
  resolve: (value: T) => void;
};

const createDeferred = <T,>(): Deferred<T> => {
  let reject: Deferred<T>['reject'] = () => undefined;
  let resolve: Deferred<T>['resolve'] = () => undefined;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
};

const profileResponse = {
  data: {
    id: 7,
    username: 'jane',
    email: 'jane@example.com',
    phone: '15555550123',
    role: 'ADMIN',
    roleCode: 'SUPER_ADMIN',
  },
};

const secondProfileResponse = {
  data: {
    id: 8,
    username: 'sol',
    email: 'sol@example.com',
    phone: '15555550124',
    role: 'USER',
    roleCode: '',
  },
};

const AuthStateProbe = () => {
  const { user, loading } = useAuth();
  return (
    <div>
      <span data-testid="loading">{loading ? 'loading' : 'ready'}</span>
      <span data-testid="username">{user?.username || 'guest'}</span>
    </div>
  );
};

const AutoLoginProbe = () => {
  const { login } = useAuth();
  React.useEffect(() => {
    void login('jane', 'secret').catch(() => undefined);
  }, [login]);
  return <div>login probe</div>;
};

const LoginStateProbe = () => {
  const { login, user } = useAuth();
  React.useEffect(() => {
    void login('jane', 'secret').catch(() => undefined);
  }, [login]);
  return (
    <div>
      <span data-testid="login-username">{user?.username || 'guest'}</span>
      <span data-testid="login-phone">{user?.phone || 'no-phone'}</span>
    </div>
  );
};

describe('AuthProvider initial profile cleanup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getLocalStorageItem as jest.Mock).mockReturnValue('token-1');
  });

  it('hydrates profile storage while still mounted', async () => {
    (userApi.getProfile as jest.Mock).mockResolvedValue(profileResponse);

    render(<AuthProvider><div>child</div></AuthProvider>);

    await waitFor(() => expect(setLocalStorageItem).toHaveBeenCalledWith('userId', '7'));
    expect(setLocalStorageItem).toHaveBeenCalledWith('username', 'jane');
    expect(setLocalStorageItem).toHaveBeenCalledWith('email', 'jane@example.com');
    expect(setLocalStorageItem).toHaveBeenCalledWith('phone', '15555550123');
    expect(setLocalStorageItem).toHaveBeenCalledWith('role', 'SUPER_ADMIN');
  });

  it('ignores profile responses after unmount', async () => {
    const profileRequest = createDeferred<unknown>();
    (userApi.getProfile as jest.Mock).mockReturnValue(profileRequest.promise);

    const { unmount } = render(<AuthProvider><div>child</div></AuthProvider>);

    await waitFor(() => expect(userApi.getProfile).toHaveBeenCalledTimes(1));
    unmount();

    await act(async () => {
      profileRequest.resolve(profileResponse);
      await Promise.resolve();
    });

    expect(setLocalStorageItem).not.toHaveBeenCalled();
  });

  it('ignores profile failures after unmount', async () => {
    const profileRequest = createDeferred<unknown>();
    (userApi.getProfile as jest.Mock).mockReturnValue(profileRequest.promise);

    const { unmount } = render(<AuthProvider><div>child</div></AuthProvider>);

    await waitFor(() => expect(userApi.getProfile).toHaveBeenCalledTimes(1));
    unmount();

    await act(async () => {
      profileRequest.reject(new Error('profile failed'));
      await Promise.resolve();
    });

    expect(clearStoredAuthSession).not.toHaveBeenCalled();
  });

  it('clears in-memory user when a profile refresh fails', async () => {
    const profileError = { response: { status: 401 } };
    (userApi.getProfile as jest.Mock)
      .mockResolvedValueOnce(profileResponse)
      .mockRejectedValueOnce(profileError);

    const { getByTestId } = render(<AuthProvider><AuthStateProbe /></AuthProvider>);

    await waitFor(() => expect(getByTestId('username').textContent).toBe('jane'));

    act(() => {
      window.dispatchEvent(new CustomEvent(AUTH_SESSION_CHANGED_EVENT));
    });

    await waitFor(() => expect(clearStoredAuthSession).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(getByTestId('username').textContent).toBe('guest'));
    expect(reportNonBlockingError).toHaveBeenCalledWith('useAuth.hydrateStoredProfile', profileError);
  });

  it('clears in-memory user when auth storage is cleared elsewhere', async () => {
    (getLocalStorageItem as jest.Mock)
      .mockReturnValueOnce('token-1')
      .mockReturnValueOnce(null);
    (userApi.getProfile as jest.Mock).mockResolvedValueOnce(profileResponse);

    const { getByTestId } = render(<AuthProvider><AuthStateProbe /></AuthProvider>);

    await waitFor(() => expect(getByTestId('username').textContent).toBe('jane'));

    act(() => {
      window.dispatchEvent(new CustomEvent(AUTH_SESSION_CHANGED_EVENT));
    });

    await waitFor(() => expect(getByTestId('username').textContent).toBe('guest'));
    expect(clearStoredAuthSession).not.toHaveBeenCalled();
  });

  it('ignores stale profile responses when a newer auth refresh starts', async () => {
    const firstProfileRequest = createDeferred<typeof profileResponse>();
    const secondProfileRequest = createDeferred<typeof secondProfileResponse>();
    (userApi.getProfile as jest.Mock)
      .mockReturnValueOnce(firstProfileRequest.promise)
      .mockReturnValueOnce(secondProfileRequest.promise);

    const { getByTestId } = render(<AuthProvider><AuthStateProbe /></AuthProvider>);

    await waitFor(() => expect(userApi.getProfile).toHaveBeenCalledTimes(1));

    act(() => {
      window.dispatchEvent(new CustomEvent(AUTH_SESSION_CHANGED_EVENT));
    });

    await waitFor(() => expect(userApi.getProfile).toHaveBeenCalledTimes(2));

    await act(async () => {
      secondProfileRequest.resolve(secondProfileResponse);
      await Promise.resolve();
    });

    await waitFor(() => expect(getByTestId('username').textContent).toBe('sol'));

    await act(async () => {
      firstProfileRequest.resolve(profileResponse);
      await Promise.resolve();
    });

    expect(getByTestId('username').textContent).toBe('sol');
    expect(setLocalStorageItem).not.toHaveBeenCalledWith('userId', '7');
    expect(setLocalStorageItem).toHaveBeenCalledWith('userId', '8');
  });

  it('ignores login responses after unmount', async () => {
    const loginRequest = createDeferred<typeof profileResponse>();
    (getLocalStorageItem as jest.Mock).mockReturnValue(null);
    (userApi.login as jest.Mock).mockReturnValue(loginRequest.promise);

    const { unmount } = render(<AuthProvider><AutoLoginProbe /></AuthProvider>);

    await waitFor(() => expect(userApi.login).toHaveBeenCalledTimes(1));
    unmount();

    await act(async () => {
      loginRequest.resolve(profileResponse);
      await Promise.resolve();
    });

    expect(persistAuthSession).not.toHaveBeenCalled();
    expect(setLocalStorageItem).not.toHaveBeenCalled();
  });

  it('guards concurrent login calls with a shared in-flight request ref', () => {
    const loginStart = useAuthSource.indexOf('const login = useCallback((username: string, password: string) => {');
    const loginSource = useAuthSource.slice(loginStart, useAuthSource.indexOf('const logout = useCallback', loginStart));

    expect(useAuthSource).toContain('const loginRequestRef = React.useRef<Promise<void> | null>(null);');
    expect(loginStart).toBeGreaterThan(-1);
    expect(loginSource).toContain('if (loginRequestRef.current) return loginRequestRef.current;');
    expect(loginSource.indexOf('if (loginRequestRef.current) return loginRequestRef.current;')).toBeLessThan(loginSource.indexOf('const response = await userApi.login(username, password);'));
    expect(loginSource).toContain('loginRequestRef.current = loginRequest;');
    expect(loginSource).toContain('if (loginRequest && loginRequestRef.current === loginRequest) {');
    expect(loginSource).toContain('loginRequestRef.current = null;');
  });

  it('exposes the canonical session token through the auth context', () => {
    expect(useAuthSource).toContain('token: string;');
    expect(useAuthSource).toContain("const [token, setToken] = useState(() => getLocalStorageItem('token') || '');");
    expect(useAuthSource).toContain("setToken('');");
    expect(useAuthSource).toContain('setToken(token);');
    expect(useAuthSource).toContain('setToken(persistedToken);');
    expect(useAuthSource).toContain('() => ({ user, token, login, logout, loading })');
  });

  it('logs in without relying on phone being present in the auth session response', async () => {
    (getLocalStorageItem as jest.Mock).mockReturnValue(null);
    (userApi.login as jest.Mock).mockResolvedValue({
      data: {
        id: 7,
        username: 'jane',
        role: 'ADMIN',
        roleCode: 'SUPER_ADMIN',
      },
    });
    (persistAuthSession as jest.Mock).mockReturnValue('token-1');

    const { getByTestId } = render(<AuthProvider><LoginStateProbe /></AuthProvider>);

    await waitFor(() => expect(userApi.login).toHaveBeenCalledTimes(1));

    expect(persistAuthSession).toHaveBeenCalledWith(expect.not.objectContaining({ email: expect.anything(), phone: expect.anything() }));
    await waitFor(() => expect(getByTestId('login-username').textContent).toBe('jane'));
    expect(getByTestId('login-phone').textContent).toBe('no-phone');
    expect(setLocalStorageItem).not.toHaveBeenCalledWith('phone', expect.anything());
  });
});
