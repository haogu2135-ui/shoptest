import React from 'react';
import { Input, Space } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useLanguage } from '../i18n';
import './SearchBar.css';

interface SearchBarProps {
    onSearch: (value: string) => void;
    placeholder?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({ onSearch, placeholder }) => {
    const { t } = useLanguage();

    return (
        <Space className="shop-search-bar">
            <Input
                className="shop-search-bar__input"
                placeholder={placeholder || t('pages.productList.searchPlaceholder')}
                prefix={<SearchOutlined />}
                onChange={(e) => onSearch(e.target.value)}
                allowClear
            />
        </Space>
    );
};
