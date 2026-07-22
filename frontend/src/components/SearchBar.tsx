import React, { useEffect, useRef, useState } from 'react';
import { ShopIcon, SI } from './ShopIcon';
import ShopSearchField from './ShopSearchField';
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
        <div className="shop-search-bar">
            <ShopSearchField
                className="shop-search-bar__field"
                inputClassName="shop-search-bar__input"
                value={value}
                placeholder={placeholder || t('pages.productList.searchPlaceholder')}
                ariaLabel={placeholder || t('pages.productList.searchPlaceholder')}
                prefix={<ShopIcon path={SI.search} />}
                onChange={setValue}
                onSearch={(next) => onSearchRef.current(next)}
                allowClear
                showSubmit={false}
            />
        </div>
    );
};
