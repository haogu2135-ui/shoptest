import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './ShopDropdown.css';

export type ShopDropdownItem = {
  key: string;
  label?: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
  type?: 'divider' | 'item';
  onClick?: () => void;
  children?: ShopDropdownItem[];
  className?: string;
};

export type ShopDropdownProps = {
  items: ShopDropdownItem[];
  children: React.ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  popupClassName?: string;
  popupZIndex?: number;
  disabled?: boolean;
};

const ShopDropdown: React.FC<ShopDropdownProps> = ({
  items,
  children,
  open,
  onOpenChange,
  className = '',
  popupClassName = '',
  popupZIndex = 2400,
  disabled = false,
}) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = typeof open === 'boolean';
  const resolvedOpen = isControlled ? Boolean(open) : uncontrolledOpen;
  const wrapRef = useRef<HTMLSpanElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const menuId = useId();
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  const setOpen = (next: boolean) => {
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
    if (!next) setExpandedKeys([]);
  };

  useEffect(() => {
    if (!resolvedOpen) setExpandedKeys([]);
  }, [resolvedOpen]);

  useEffect(() => {
    if (!resolvedOpen || typeof window === 'undefined') return undefined;
    const updatePosition = () => {
      const rect = (triggerRef.current || wrapRef.current)?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.max(rect.width, 196);
      const estimatedHeight = Math.min(window.innerHeight - 24, 360);
      let left = rect.left;
      let top = rect.bottom + 6;
      if (left + width > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - width - 8);
      }
      if (top + estimatedHeight > window.innerHeight - 8) {
        top = Math.max(8, rect.top - 6 - Math.min(estimatedHeight, 280));
      }
      setPopupStyle({
        position: 'fixed',
        top,
        left,
        minWidth: Math.min(width, window.innerWidth - 16),
        maxWidth: 'calc(100vw - 16px)',
        maxHeight: estimatedHeight,
        zIndex: popupZIndex,
      });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [expandedKeys.length, items.length, popupZIndex, resolvedOpen]);

  useEffect(() => {
    if (!resolvedOpen || typeof document === 'undefined') return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (wrapRef.current?.contains(target)) return;
      const popup = document.getElementById(menuId);
      if (popup?.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [menuId, resolvedOpen]);

  const renderItems = (levelItems: ShopDropdownItem[], depth = 0): React.ReactNode => (
    levelItems.map((item) => {
      if (item.type === 'divider') {
        return <div key={item.key} className="shop-dropdown__divider" role="separator" />;
      }
      const hasChildren = Boolean(item.children?.length);
      const expanded = expandedKeys.includes(item.key);
      const itemDisabled = Boolean(item.disabled || disabled);
      return (
        <React.Fragment key={item.key}>
          <button
            type="button"
            role="menuitem"
            className={`shop-dropdown__item${itemDisabled ? ' shop-dropdown__item--disabled' : ''}${hasChildren ? ' shop-dropdown__item--submenu' : ''}${expanded ? ' shop-dropdown__item--expanded' : ''} ${item.className || ''}`.trim()}
            style={{ paddingLeft: 12 + depth * 12 }}
            disabled={itemDisabled}
            aria-disabled={itemDisabled || undefined}
            aria-haspopup={hasChildren ? 'menu' : undefined}
            aria-expanded={hasChildren ? expanded : undefined}
            onClick={() => {
              if (itemDisabled) return;
              if (hasChildren) {
                setExpandedKeys((current) => (
                  current.includes(item.key)
                    ? current.filter((key) => key !== item.key)
                    : [...current, item.key]
                ));
                return;
              }
              item.onClick?.();
              setOpen(false);
            }}
          >
            {item.icon ? <span className="shop-dropdown__icon" aria-hidden="true">{item.icon}</span> : null}
            <span className="shop-dropdown__label">{item.label}</span>
            {hasChildren ? <span className="shop-dropdown__chevron" aria-hidden="true">{expanded ? '▾' : '›'}</span> : null}
          </button>
          {hasChildren && expanded ? (
            <div className="shop-dropdown__submenu" role="group">
              {renderItems(item.children || [], depth + 1)}
            </div>
          ) : null}
        </React.Fragment>
      );
    })
  );

  const child = React.Children.only(children) as React.ReactElement<any>;
  const trigger = React.cloneElement(child, {
    ref: (node: HTMLElement | null) => {
      triggerRef.current = node;
      const { ref } = child as any;
      if (typeof ref === 'function') ref(node);
      else if (ref && typeof ref === 'object') (ref as React.MutableRefObject<HTMLElement | null>).current = node;
    },
    'aria-haspopup': child.props['aria-haspopup'] || 'menu',
    'aria-expanded': typeof child.props['aria-expanded'] === 'boolean' ? child.props['aria-expanded'] : resolvedOpen,
    'aria-controls': resolvedOpen ? menuId : child.props['aria-controls'],
    onClick: (event: React.MouseEvent) => {
      child.props.onClick?.(event);
      if (disabled || event.defaultPrevented) return;
      setOpen(!resolvedOpen);
    },
  });

  const popup = resolvedOpen && typeof document !== 'undefined'
    ? createPortal(
        <div
          id={menuId}
          className={`shop-dropdown__popup ${popupClassName}`.trim()}
          role="menu"
          style={popupStyle}
        >
          <div className="shop-dropdown__menu">
            {renderItems(items)}
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <span ref={wrapRef} className={`shop-dropdown ${className}`.trim()}>
        {trigger}
      </span>
      {popup}
    </>
  );
};

export default ShopDropdown;
