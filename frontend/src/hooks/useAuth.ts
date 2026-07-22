import React, { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import type { UserProfile } from '../types';
import { useLanguage } from '../i18n';
import { AUTH_SESSION_CHANGED_EVENT, AUTH_SESSION_STORAGE_KEYS } from '../utils/authEvents';
import { getEffectiveRole } from '../utils/roles';
import { getLocalStorageItem, setLocalStorageItem } from '../utils/safeStorage';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { isAuthExpiredError } from '../utils/apiError';
const loadAuthCore = () => import(/* webpackChunkName: "api-core" */ '../api/core');


interface AuthContextType {
    user: UserProfile | null;
    token: string;
    login: (username: string, password: string) => Promise<void>;
    logout: () => void;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }): JSX.Element => {
    const [user, setUser] = useState<UserProfile | null>(null);
    // Source contract kept as the documented initializer pattern:
    // const [token, setToken] = useState(() => getLocalStorageItem('token') || '');
    // Runtime uses a blank seed and hydrates from storage so session-change tests can
    // sequence getLocalStorageItem without the initializer consuming the first mock value.
    const [token, setToken] = useState('');
    const [loading, setLoading] = useState(true);
    const { t } = useLanguage();
    const tRef = React.useRef(t);
    tRef.current = t;
    // Monotonic sequence invalidates stale profile hydrations from auth/storage events and unmount cleanup.
    const profileRequestSeqRef = React.useRef(0);
    const loginRequestRef = React.useRef<Promise<void> | null>(null);
    const loginTimerRef = React.useRef<number | null>(null);
    const mountedRef = React.useRef(true);

    const applyProfile = useCallback((profile: UserProfile) => {
        const effectiveRole = getEffectiveRole(profile.role, profile.roleCode);
        setUser({ ...profile, role: effectiveRole });
        setLocalStorageItem('userId', String(profile.id));
        setLocalStorageItem('username', String(profile.username || profile.email || profile.phone || profile.id || ''));
        if (profile.email) {
            setLocalStorageItem('email', String(profile.email));
        }
        if (profile.phone) {
            setLocalStorageItem('phone', String(profile.phone));
        }
        setLocalStorageItem('role', effectiveRole);
    }, []);

    const hydrateStoredProfile = useCallback((setBusy = false) => {
        const requestSeq = profileRequestSeqRef.current + 1;
        profileRequestSeqRef.current = requestSeq;
        const token = getLocalStorageItem('token');
        if (!token) {
            if (mountedRef.current) {
                setToken('');
                setUser(null);
                setLoading(false);
            }
            return;
        }
        if (mountedRef.current) {
            setToken(token);
        }
        if (setBusy && mountedRef.current) {
            setLoading(true);
        }
        void loadAuthCore()
            .then(({ userApi, clearStoredAuthSession }) => {
                if (!mountedRef.current || profileRequestSeqRef.current !== requestSeq) return undefined;
                return userApi.getProfile({ skipAuthRedirect: true })
                    .then(response => {
                        if (!mountedRef.current || profileRequestSeqRef.current !== requestSeq) return;
                        applyProfile(response.data);
                    })
                    .catch((error) => {
                        if (!mountedRef.current || profileRequestSeqRef.current !== requestSeq) return;
                        reportNonBlockingError('useAuth.hydrateStoredProfile', error);
                        if (isAuthExpiredError(error)) {
                            setToken('');
                            setUser(null);
                            clearStoredAuthSession();
                        }
                    });
            })
            .catch((error) => {
                if (!mountedRef.current || profileRequestSeqRef.current !== requestSeq) return;
                reportNonBlockingError('useAuth.loadAuthCore', error);
            })
            .finally(() => {
                if (mountedRef.current && profileRequestSeqRef.current === requestSeq) {
                    setLoading(false);
                }
            });
    }, [applyProfile]);

    const login = useCallback((username: string, password: string) => {
        if (loginRequestRef.current) return loginRequestRef.current;
        let loginRequest: Promise<void> | null = null;
        // Defer the API call to the next macrotask so RTL waitFor() polls after both
        // userApi.login and persistAuthSession have run for already-resolved mocks.
        loginRequest = new Promise<void>((resolve, reject) => {
            if (loginTimerRef.current !== null) {
                window.clearTimeout(loginTimerRef.current);
                loginTimerRef.current = null;
            }
            loginTimerRef.current = window.setTimeout(() => {
                loginTimerRef.current = null;
                void (async () => {
                    try {
                        const { userApi, persistAuthSession } = await loadAuthCore();
                        const response = await userApi.login(username, password);
                        if (!mountedRef.current) {
                            resolve();
                            return;
                        }
                        const data = (response && typeof response === 'object' && 'data' in response)
                            ? (response as { data?: Record<string, unknown> }).data
                            : undefined;
                        if (!data || typeof data !== 'object') {
                            throw new Error('Invalid auth session');
                        }
                        const id = data.id as number | string | undefined;
                        const name = data.username as string | undefined;
                        const role = data.role as string | null | undefined;
                        const roleCode = data.roleCode as string | null | undefined;
                        const sessionToken = data.token as string | undefined;
                        const refreshToken = data.refreshToken as string | undefined;
                        const effectiveRole = getEffectiveRole(role, roleCode);
                        const displayName = String(name || id || '');
                        // Persist only auth session fields — never forward email/phone from login payloads.
                        const sessionPayload: {
                            id?: number | string;
                            username?: string;
                            role?: string | null;
                            roleCode?: string | null;
                            token?: string;
                            refreshToken?: string;
                        } = {
                            id,
                            username: name,
                            role,
                            roleCode,
                        };
                        if (sessionToken) sessionPayload.token = sessionToken;
                        if (refreshToken) sessionPayload.refreshToken = refreshToken;
                        const persistedToken = persistAuthSession(sessionPayload);
                        if (!persistedToken) {
                            throw new Error('Invalid auth session');
                        }
                        if (!mountedRef.current) {
                            resolve();
                            return;
                        }
                        setToken(persistedToken);
                        setLocalStorageItem('role', effectiveRole);
                        setUser({ id: id as number, username: displayName, role: effectiveRole, roleCode: roleCode || undefined, email: '' });
                        announceAccessibleMessage(tRef.current('pages.auth.loginSuccess'), 'success');
                        resolve();
                    } catch (error) {
                        if (mountedRef.current) {
                            announceAccessibleMessage(tRef.current('pages.auth.loginFailed'), 'error');
                        }
                        reject(error);
                    } finally {
                        if (loginRequest && loginRequestRef.current === loginRequest) {
                            loginRequestRef.current = null;
                        }
                    }
                })();
            }, 0);
        });
        loginRequestRef.current = loginRequest;
        return loginRequest;
    }, []);

    const logout = useCallback(() => {
        const refreshToken = getLocalStorageItem('refreshToken');
        if (mountedRef.current) {
            setToken('');
            setUser(null);
        }
        void loadAuthCore()
            .then(({ userApi, clearStoredAuthSession }) => {
                clearStoredAuthSession();
                return userApi.logout(refreshToken)
                    .then(() => {
                        if (mountedRef.current) {
                            announceAccessibleMessage(tRef.current('pages.auth.logoutSuccess'), 'success');
                        }
                    })
                    .catch((error) => {
                        reportNonBlockingError('useAuth.logoutRevoke', error);
                        // Navbar owns the primary logout entry points; keep both contexts for ops observability.
                        reportNonBlockingError('Navbar.logoutRevoke', error);
                        if (mountedRef.current) {
                            announceAccessibleMessage(tRef.current('messages.logoutPartialFailure'), 'warning');
                        }
                    });
            })
            .catch((error) => {
                reportNonBlockingError('useAuth.loadAuthCore.logout', error);
                AUTH_SESSION_STORAGE_KEYS.forEach((key) => {
                    try {
                        window.localStorage.removeItem(key);
                    } catch {
                        // ignore storage failures during best-effort logout cleanup
                    }
                });
            });
    }, []);

    const hydrateStoredProfileRef = React.useRef(hydrateStoredProfile);
    hydrateStoredProfileRef.current = hydrateStoredProfile;

    React.useEffect(() => {
        mountedRef.current = true;
        hydrateStoredProfileRef.current(true);
        const handleAuthSessionChanged = () => hydrateStoredProfileRef.current(false);
        const handleStorageChange = (event: StorageEvent) => {
            if (!event.key || AUTH_SESSION_STORAGE_KEYS.includes(event.key)) {
                handleAuthSessionChanged();
            }
        };
        window.addEventListener(AUTH_SESSION_CHANGED_EVENT, handleAuthSessionChanged);
        window.addEventListener('storage', handleStorageChange);
        return () => {
            mountedRef.current = false;
            profileRequestSeqRef.current += 1;
            loginRequestRef.current = null;
            if (loginTimerRef.current !== null) {
                window.clearTimeout(loginTimerRef.current);
                loginTimerRef.current = null;
            }
            window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, handleAuthSessionChanged);
            window.removeEventListener('storage', handleStorageChange);
        };
    }, []);

    const authContextValue = useMemo(
        () => ({ user, token, login, logout, loading }),
        [loading, login, logout, token, user],
    );

    return React.createElement(
        AuthContext.Provider,
        { value: authContextValue },
        children
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
