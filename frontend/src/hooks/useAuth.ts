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
    login: (username: string, password: string) => Promise<void>;
    logout: () => void;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }): JSX.Element => {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const { t } = useLanguage();
    // Monotonic sequence invalidates stale profile hydrations from auth/storage events and unmount cleanup.
    const profileRequestSeqRef = React.useRef(0);
    const loginRequestRef = React.useRef<Promise<void> | null>(null);

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
            setUser(null);
            setLoading(false);
            return;
        }
        if (setBusy) {
            setLoading(true);
        }
        userApi.getProfile({ skipAuthRedirect: true })
            .then(response => {
                if (profileRequestSeqRef.current !== requestSeq) return;
                applyProfile(response.data);
            })
            .catch((error) => {
                if (profileRequestSeqRef.current !== requestSeq) return;
                reportNonBlockingError('useAuth.hydrateStoredProfile', error);
                if (isAuthExpiredError(error)) {
                    setUser(null);
                    clearStoredAuthSession();
                }
            })
            .finally(() => {
                if (profileRequestSeqRef.current === requestSeq) {
                    setLoading(false);
                }
            });
    }, [applyProfile]);

    const login = useCallback((username: string, password: string) => {
        if (loginRequestRef.current) return loginRequestRef.current;
        let loginRequest: Promise<void>;
        loginRequest = (async () => {
            try {
                const response = await userApi.login(username, password);
                const { id, username: name, email, phone, role, roleCode } = response.data;
                const effectiveRole = getEffectiveRole(role, roleCode);
                const displayName = String(name || email || phone || id || '');
                if (!persistAuthSession(response.data)) {
                    throw new Error('Invalid auth session');
                }
                setLocalStorageItem('role', effectiveRole);
                setUser({ id, username: displayName, role: effectiveRole, roleCode, email: email || '', phone });
                message.success(t('pages.auth.loginSuccess'));
            } catch (error) {
                message.error(t('pages.auth.loginFailed'));
                throw error;
            } finally {
                if (loginRequestRef.current === loginRequest) {
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
                message.success(t('pages.auth.logoutSuccess'));
            })
            .catch((error) => {
                reportNonBlockingError('useAuth.logoutRevoke', error);
                message.warning(t('messages.logoutPartialFailure'));
        });
        setUser(null);
        clearStoredAuthSession();
    }, [t]);

    React.useEffect(() => {
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
            profileRequestSeqRef.current += 1;
            window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, handleAuthSessionChanged);
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [hydrateStoredProfile]);

    const authContextValue = useMemo(
        () => ({ user, login, logout, loading }),
        [loading, login, logout, user],
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
