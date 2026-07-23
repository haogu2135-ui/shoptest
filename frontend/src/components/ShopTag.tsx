import React from 'react';
import './ShopTag.css';

export type ShopTagProps = {
  color?: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
  closable?: boolean;
  onClose?: (event: React.MouseEvent<HTMLElement>) => void;
  onClick?: React.MouseEventHandler<HTMLSpanElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLSpanElement>;
  role?: React.AriaRole;
  tabIndex?: number;
  'aria-label'?: string;
};

const PRESET_COLORS = new Set([
  'default', 'success', 'processing', 'error', 'warning',
  'magenta', 'red', 'volcano', 'orange', 'gold', 'lime', 'green', 'cyan', 'blue', 'geekblue', 'purple',
]);

const ShopTag: React.FC<ShopTagProps> = ({
  color = 'default',
  icon,
  children,
  className = '',
  style,
  title,
  closable = false,
  onClose,
  onClick,
  onKeyDown,
  role,
  tabIndex,
  'aria-label': ariaLabel,
}) => {
  const [closed, setClosed] = React.useState(false);
  if (closed) return null;

  const normalized = String(color || 'default').trim() || 'default';
  const isPreset = PRESET_COLORS.has(normalized);
  const colorClass = isPreset ? `shop-tag--${normalized} ant-tag-${normalized}` : 'shop-tag--custom';
  const customStyle = !isPreset
    ? {
        color: '#fff',
        background: normalized,
        borderColor: 'transparent',
        ...style,
      }
    : style;

  return (
    <span
      className={['shop-tag', 'ant-tag', colorClass, className].filter(Boolean).join(' ')}
      style={customStyle}
      title={title}
      onClick={onClick}
      onKeyDown={onKeyDown}
      role={role}
      tabIndex={tabIndex}
      aria-label={ariaLabel}
    >
      {icon != null && icon !== false ? <span className="shop-tag__icon ant-tag-icon">{icon}</span> : null}
      {children != null && children !== false ? <span className="shop-tag__text">{children}</span> : null}
      {closable ? (
        <button
          type="button"
          className="shop-tag__close ant-tag-close-icon"
          aria-label="Close"
          onClick={(event) => {
            event.stopPropagation();
            onClose?.(event);
            if (!event.defaultPrevented) {
              setClosed(true);
            }
          }}
        >
          ×
        </button>
      ) : null}
    </span>
  );
};

export default ShopTag;
