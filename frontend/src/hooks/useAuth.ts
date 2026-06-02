import React, { createContext, ReactNode, useContext, useState } from 'react';
import { message } from 'antd';
import { clearStoredAuthSession, persistAuthSession, userApi } from '../api';
import type { UserProfile } from '../types';
import { useLanguage } from '../i18n';
import { getEffectiveRole } from '../utils/roles';
import { getLocalStorageItem, setLocalStorageItem } from '../utils/safeStorage';

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

    const login = async (username: string, password: string) => {
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
        }
    };

    const logout = () => {
        const refreshToken = getLocalStorageItem('refreshToken');
        userApi.logout(refreshToken).catch(() => undefined);
        setUser(null);
        clearStoredAuthSession();
        message.success(t('pages.auth.logoutSuccess'));
    };

    React.useEffect(() => {
        const token = getLocalStorageItem('token');
        if (token) {
            userApi.getProfile()
                .then(response => {
                    const effectiveRole = getEffectiveRole(response.data.role, response.data.roleCode);
                    setUser({ ...response.data, role: effectiveRole });
                    setLocalStorageItem('userId', String(response.data.id));
                    setLocalStorageItem('username', String(response.data.username || response.data.email || response.data.phone || response.data.id || ''));
                    setLocalStorageItem('role', effectiveRole);
                })
                .catch(() => {
                    clearStoredAuthSession();
                })
                .finally(() => {
                    setLoading(false);
                });
        } else {
            setLoading(false);
        }
    }, []);

    return React.createElement(
        AuthContext.Provider,
        { value: { user, login, logout, loading } },
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
