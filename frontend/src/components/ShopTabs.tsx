import React, { useCallback, useMemo, useState } from 'react';
import { handleRovingTablistKeyDown } from '../utils/tablistKeyboard';
import './ShopTabs.css';

export type ShopTabItem = {
  key: string;
  label: React.ReactNode;
  children?: React.ReactNode;
  disabled?: boolean;
};

export type ShopTabsProps = {
  items?: ShopTabItem[];
  activeKey?: string;
  defaultActiveKey?: string;
  onChange?: (key: string) => void;
  className?: string;
  style?: React.CSSProperties;
  tabBarGutter?: number;
};

const ShopTabs: React.FC<ShopTabsProps> = ({
  items = [],
  activeKey,
  defaultActiveKey,
  onChange,
  className = '',
  style,
  tabBarGutter = 16,
}) => {
  const firstKey = items[0]?.key;
  const firstEnabledKey = items.find((item) => !item.disabled)?.key || firstKey;
  const normalizedTabBarGutter = Number.isFinite(tabBarGutter)
    ? Math.max(0, Math.min(Math.floor(tabBarGutter), 96))
    : 16;
  const [internalKey, setInternalKey] = useState<string | undefined>(defaultActiveKey || firstEnabledKey);
  const currentKey = activeKey != null ? activeKey : internalKey;
  const enabledKeys = useMemo(() => items.filter((item) => !item.disabled).map((item) => item.key), [items]);
  const activeItem = useMemo(
    () => items.find((item) => item.key === currentKey && !item.disabled)
      || items.find((item) => !item.disabled)
      || items[0],
    [items, currentKey],
  );

  const select = useCallback((key: string, disabled?: boolean) => {
    if (disabled) return;
    if (activeKey == null) setInternalKey(key);
    onChange?.(key);
  }, [activeKey, onChange]);

  return (
    <div className={['shop-tabs', 'ant-tabs', 'ant-tabs-top', className].filter(Boolean).join(' ')} style={style}>
      <div className="shop-tabs__nav ant-tabs-nav" role="tablist" aria-orientation="horizontal">
        <div className="shop-tabs__navWrap ant-tabs-nav-wrap">
          <div className="shop-tabs__navList ant-tabs-nav-list" style={{ gap: normalizedTabBarGutter }}>
            {items.map((item) => {
              const selected = activeItem?.key === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  id={`shop-tab-${item.key}`}
                  aria-selected={selected}
                  aria-controls={`shop-tabpanel-${item.key}`}
                  tabIndex={selected ? 0 : -1}
                  disabled={item.disabled}
                  className={[
                    'shop-tabs__tab',
                    'ant-tabs-tab',
                    selected ? 'shop-tabs__tab--active ant-tabs-tab-active' : '',
                    item.disabled ? 'ant-tabs-tab-disabled' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => select(item.key, item.disabled)}
                  onKeyDown={(event) => {
                    if (item.disabled) return;
                    handleRovingTablistKeyDown(event, {
                      tabKeys: enabledKeys,
                      activeKey: String(activeItem?.key || item.key),
                      onActivate: (key) => select(key),
                      getTabElementId: (key) => `shop-tab-${key}`,
                    });
                  }}
                >
                  <span className="shop-tabs__tabBtn ant-tabs-tab-btn">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="shop-tabs__content ant-tabs-content-holder">
        {activeItem ? (
          <div
            className="shop-tabs__tabpane ant-tabs-tabpane ant-tabs-tabpane-active"
            role="tabpanel"
            id={`shop-tabpanel-${activeItem.key}`}
            aria-labelledby={`shop-tab-${activeItem.key}`}
          >
            {activeItem.children}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default ShopTabs;
