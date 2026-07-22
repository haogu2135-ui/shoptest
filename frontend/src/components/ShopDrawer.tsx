import React, { useEffect } from 'react';
import { ShopIcon, SI } from './ShopIcon';
import './ShopDrawer.css';

export type ShopDrawerProps = {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  extra?: React.ReactNode;
  placement?: 'bottom' | 'right';
  height?: string | number;
  width?: string | number;
  rootClassName?: string;
  className?: string;
  children?: React.ReactNode;
  ariaLabel?: string;
  closeLabel?: string;
};

const toCssSize = (value?: string | number) => {
  if (value == null) return undefined;
  return typeof value === 'number' ? `${value}px` : value;
};

const ShopDrawer: React.FC<ShopDrawerProps> = ({
  open,
  onClose,
  title,
  extra,
  placement = 'bottom',
  height,
  width,
  rootClassName = '',
  className = '',
  children,
  ariaLabel,
  closeLabel = 'Close',
}) => {
  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;
    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const panelStyle: React.CSSProperties = {};
  if (placement === 'bottom' && height != null) panelStyle.height = toCssSize(height);
  if (placement === 'right' && width != null) panelStyle.width = toCssSize(width);

  return (
    <div
      className={`shop-drawer shop-drawer--${placement} shop-drawer--open ${rootClassName}`.trim()}
      role="presentation"
    >
      <button
        type="button"
        className="shop-drawer__mask"
        aria-label={closeLabel}
        title={closeLabel}
        onClick={onClose}
      />
      <div
        className={`shop-drawer__panel ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel || (typeof title === 'string' ? title : closeLabel)}
        style={panelStyle}
      >
        <div className="shop-drawer__header">
          <div className="shop-drawer__title">{title}</div>
          {extra ? <div className="shop-drawer__extra">{extra}</div> : null}
          <button
            type="button"
            className="shop-drawer__close"
            aria-label={closeLabel}
            title={closeLabel}
            onClick={onClose}
          >
            <ShopIcon path={SI.close} />
          </button>
        </div>
        <div className="shop-drawer__body">{children}</div>
      </div>
    </div>
  );
};

export default ShopDrawer;
