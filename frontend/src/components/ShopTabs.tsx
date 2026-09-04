import React, { useCallback, useId, useMemo, useState } from 'react';
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
  const tabsId = useId();
  const normalizedItems = useMemo(() => {
    const seen = new Set<string>();
    return items.filter((item) => {
      if (seen.has(item.key)) return false;
      seen.add(item.key);
      return true;
    });
  }, [items]);
  const firstKey = normalizedItems[0]?.key;
  const firstEnabledKey = normalizedItems.find((item) => !item.disabled)?.key || firstKey;
  const normalizedTabBarGutter = Number.isFinite(tabBarGutter)
    ? Math.max(0, Math.min(Math.floor(tabBarGutter), 96))
    : 16;
  const [internalKey, setInternalKey] = useState<string | undefined>(defaultActiveKey || firstEnabledKey);
  const currentKey = activeKey != null ? activeKey : internalKey;
  const enabledKeys = useMemo(() => normalizedItems.filter((item) => !item.disabled).map((item) => item.key), [normalizedItems]);
  const activeItem = useMemo(
    () => normalizedItems.find((item) => item.key === currentKey && !item.disabled)
      || normalizedItems.find((item) => !item.disabled)
      || normalizedItems[0],
    [normalizedItems, currentKey],
  );
  const tabId = (key: string) => `${tabsId}-tab-${key}`;
  const tabPanelId = (key: string) => `${tabsId}-tabpanel-${key}`;

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
            {normalizedItems.map((item) => {
              const selected = activeItem?.key === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  id={tabId(item.key)}
                  aria-selected={selected}
                  aria-controls={tabPanelId(item.key)}
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
                      getTabElementId: (key) => tabId(key),
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
            id={tabPanelId(activeItem.key)}
            aria-labelledby={tabId(activeItem.key)}
          >
            {activeItem.children}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default ShopTabs;
