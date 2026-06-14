import React, { useEffect, useRef, useState } from 'react';
import { Input, Space } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useLanguage } from '../i18n';
import './SearchBar.css';

interface SearchBarProps {
    onSearch: (value: string) => void;
    placeholder?: string;
    debounceMs?: number;
}

export const SearchBar: React.FC<SearchBarProps> = ({ onSearch, placeholder, debounceMs = 300 }) => {
    const { t } = useLanguage();
    const [value, setValue] = useState('');
    const didMountRef = useRef(false);
    const onSearchRef = useRef(onSearch);

    useEffect(() => {
        onSearchRef.current = onSearch;
    }, [onSearch]);

    useEffect(() => {
        if (!didMountRef.current) {
            didMountRef.current = true;
            return;
        }
        const timer = window.setTimeout(() => {
            onSearchRef.current(value);
        }, Math.max(0, debounceMs));
        return () => window.clearTimeout(timer);
    }, [debounceMs, value]);

    return (
        <Space className="shop-search-bar">
            <Input
                className="shop-search-bar__input"
                value={value}
                placeholder={placeholder || t('pages.productList.searchPlaceholder')}
                prefix={<SearchOutlined />}
                onChange={(e) => setValue(e.target.value)}
                onPressEnter={() => onSearchRef.current(value)}
                allowClear
            />
        </Space>
    );
};
