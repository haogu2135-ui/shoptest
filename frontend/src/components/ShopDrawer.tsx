import React, { useEffect } from 'react';
import { ShopIcon, SI } from './ShopIcon';
import './ShopDrawer.css';

export type ShopDrawerPlacement = 'bottom' | 'right' | 'left';

export type ShopDrawerProps = {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  extra?: React.ReactNode;
  placement?: ShopDrawerPlacement;
  height?: string | number;
  width?: string | number;
  rootClassName?: string;
  className?: string;
  bodyClassName?: string;
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
  bodyClassName = '',
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
  if ((placement === 'right' || placement === 'left') && width != null) {
    panelStyle.width = toCssSize(width);
  }

  const dialogLabel = ariaLabel || (typeof title === 'string' ? title : closeLabel);

  return (
    <div
      className={[
        'shop-drawer',
        `shop-drawer--${placement}`,
        'shop-drawer--open',
        'ant-drawer',
        `ant-drawer-${placement}`,
        'ant-drawer-open',
        rootClassName,
      ].filter(Boolean).join(' ')}
      role="presentation"
    >
      <button
        type="button"
        className="shop-drawer__mask ant-drawer-mask"
        aria-label={closeLabel}
        title={closeLabel}
        onClick={onClose}
      />
      <div
        className={[
          'shop-drawer__panel',
          'ant-drawer-content-wrapper',
          'ant-drawer-content',
          className,
        ].filter(Boolean).join(' ')}
        role="dialog"
        aria-modal="true"
        aria-label={dialogLabel}
        style={panelStyle}
      >
        <div className="shop-drawer__header ant-drawer-header">
          <div className="shop-drawer__title ant-drawer-title">{title}</div>
          {extra ? <div className="shop-drawer__extra">{extra}</div> : null}
          <button
            type="button"
            className="shop-drawer__close ant-drawer-close"
            aria-label={closeLabel}
            title={closeLabel}
            onClick={onClose}
          >
            <ShopIcon path={SI.close} />
          </button>
        </div>
        <div className={['shop-drawer__body', 'ant-drawer-body', bodyClassName].filter(Boolean).join(' ')}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default ShopDrawer;
