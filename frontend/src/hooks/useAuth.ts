import React, { createContext, ReactNode, useContext, useState } from 'react';
import { message } from 'antd';
import { userApi } from '../api';
import { User } from '../types';
import { useLanguage } from '../i18n';
import { getEffectiveRole } from '../utils/roles';
import { getLocalStorageItem, removeLocalStorageItem, setLocalStorageItem } from '../utils/safeStorage';

interface AuthContextType {
    user: User | null;
    login: (username: string, password: string) => Promise<void>;
    logout: () => void;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }): JSX.Element => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const { t } = useLanguage();

    const login = async (username: string, password: string) => {
        try {
            const response = await userApi.login(username, password);
            const { token, id, username: name, role, roleCode } = response.data;
            const effectiveRole = getEffectiveRole(role, roleCode);
            setLocalStorageItem('token', token);
            setLocalStorageItem('userId', String(id));
            setLocalStorageItem('username', name);
            setLocalStorageItem('role', effectiveRole);
            setUser({ id, username: name, role, roleCode, email: response.data.email || '' });
            message.success(t('pages.auth.loginSuccess'));
        } catch (error) {
            message.error(t('pages.auth.loginFailed'));
            throw error;
        }
    };

    const logout = () => {
        userApi.logout().catch(() => undefined);
        setUser(null);
        removeLocalStorageItem('token');
        removeLocalStorageItem('userId');
        removeLocalStorageItem('username');
        removeLocalStorageItem('role');
        message.success(t('pages.auth.logoutSuccess'));
    };

    React.useEffect(() => {
        const token = getLocalStorageItem('token');
        if (token) {
            userApi.getProfile()
                .then(response => {
                    const effectiveRole = getEffectiveRole(response.data.role, response.data.roleCode);
                    setUser(response.data);
                    setLocalStorageItem('userId', String(response.data.id));
                    setLocalStorageItem('username', response.data.username);
                    setLocalStorageItem('role', effectiveRole);
                })
                .catch(() => {
                    removeLocalStorageItem('token');
                    removeLocalStorageItem('userId');
                    removeLocalStorageItem('username');
                    removeLocalStorageItem('role');
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
