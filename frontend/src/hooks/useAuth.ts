import React, { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { message } from 'antd';
import { clearStoredAuthSession, persistAuthSession, userApi } from '../api';
import type { UserProfile } from '../types';
import { useLanguage } from '../i18n';
import { AUTH_SESSION_CHANGED_EVENT, AUTH_SESSION_STORAGE_KEYS } from '../utils/authEvents';
import { getEffectiveRole } from '../utils/roles';
import { getLocalStorageItem, setLocalStorageItem } from '../utils/safeStorage';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import { isAuthExpiredError } from '../utils/apiError';

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
    const [token, setToken] = useState(() => getLocalStorageItem('token') || '');
    const [loading, setLoading] = useState(true);
    const { t } = useLanguage();
    // Monotonic sequence invalidates stale profile hydrations from auth/storage events and unmount cleanup.
    const profileRequestSeqRef = React.useRef(0);
    const loginRequestRef = React.useRef<Promise<void> | null>(null);
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
        userApi.getProfile({ skipAuthRedirect: true })
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
        loginRequest = (async () => {
            try {
                const response = await userApi.login(username, password);
                if (!mountedRef.current) return;
                const { id, username: name, role, roleCode } = response.data;
                const effectiveRole = getEffectiveRole(role, roleCode);
                const displayName = String(name || id || '');
                const persistedToken = persistAuthSession(response.data);
                if (!persistedToken) {
                    throw new Error('Invalid auth session');
                }
                setToken(persistedToken);
                setLocalStorageItem('role', effectiveRole);
                setUser({ id, username: displayName, role: effectiveRole, roleCode, email: '' });
                message.success(t('pages.auth.loginSuccess'));
            } catch (error) {
                if (mountedRef.current) {
                    message.error(t('pages.auth.loginFailed'));
                }
                throw error;
            } finally {
                if (loginRequest && loginRequestRef.current === loginRequest) {
                    loginRequestRef.current = null;
                }
            }
        })();
        loginRequestRef.current = loginRequest;
        return loginRequest;
    }, [t]);

    const logout = useCallback(() => {
        const refreshToken = getLocalStorageItem('refreshToken');
        void userApi.logout(refreshToken)
            .then(() => {
                if (mountedRef.current) {
                    message.success(t('pages.auth.logoutSuccess'));
                }
            })
            .catch((error) => {
                reportNonBlockingError('useAuth.logoutRevoke', error);
                // Navbar owns the primary logout entry points; keep both contexts for ops observability.
                reportNonBlockingError('Navbar.logoutRevoke', error);
                if (mountedRef.current) {
                    message.warning(t('messages.logoutPartialFailure'));
                }
            });
        if (mountedRef.current) {
            setToken('');
            setUser(null);
        }
        clearStoredAuthSession();
    }, [t]);

    React.useEffect(() => {
        mountedRef.current = true;
        hydrateStoredProfile(true);
        const handleAuthSessionChanged = () => hydrateStoredProfile(false);
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
            window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, handleAuthSessionChanged);
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [hydrateStoredProfile]);

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
