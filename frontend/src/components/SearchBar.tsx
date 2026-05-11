import React from 'react';
import { Input, Space } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useLanguage } from '../i18n';

interface SearchBarProps {
    onSearch: (value: string) => void;
    placeholder?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({ onSearch, placeholder }) => {
    const { t } = useLanguage();

    return (
        <Space style={{ width: '100%', marginBottom: 16 }}>
            <Input
                placeholder={placeholder || t('pages.productList.searchPlaceholder')}
                prefix={<SearchOutlined />}
                onChange={(e) => onSearch(e.target.value)}
                allowClear
                style={{ width: '100%' }}
            />
        </Space>
    );
};
