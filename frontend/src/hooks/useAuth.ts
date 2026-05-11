import React, { createContext, ReactNode, useContext, useState } from 'react';
import { message } from 'antd';
import { userApi } from '../api';
import { User } from '../types';

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

    const login = async (username: string, password: string) => {
        try {
            const response = await userApi.login(username, password);
            const { token, id, username: name, role } = response.data;
            localStorage.setItem('token', token);
            localStorage.setItem('userId', id);
            localStorage.setItem('username', name);
            localStorage.setItem('role', role);
            setUser({ id, username: name, role, email: response.data.email || '' });
            message.success('Logged in successfully');
        } catch (error) {
            message.error('Login failed, please check your username and password');
            throw error;
        }
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
        localStorage.removeItem('username');
        localStorage.removeItem('role');
        message.success('Logged out');
    };

    React.useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            userApi.getProfile()
                .then(response => {
                    setUser(response.data);
                    localStorage.setItem('userId', String(response.data.id));
                    localStorage.setItem('username', response.data.username);
                    localStorage.setItem('role', response.data.role);
                })
                .catch(() => {
                    localStorage.removeItem('token');
                    localStorage.removeItem('userId');
                    localStorage.removeItem('username');
                    localStorage.removeItem('role');
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
