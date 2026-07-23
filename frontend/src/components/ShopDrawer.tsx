import React, { useEffect, useId, useRef } from 'react';
import { ShopIcon, SI } from './ShopIcon';
import { activateFocusTrap } from '../utils/focusTrap';
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
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const hasTitle = Boolean(title);
  const labelledBy = !ariaLabel && hasTitle ? titleId : undefined;
  const resolvedAriaLabel = ariaLabel
    || (!hasTitle ? closeLabel : (typeof title === 'string' ? title : undefined));

  useEffect(() => {
    if (!open) return undefined;
    return activateFocusTrap({
      getPanel: () => panelRef.current,
      getInitialFocus: () => closeRef.current
        || panelRef.current?.querySelector<HTMLElement>('[data-shop-drawer-initial-focus="true"]')
        || null,
      onEscape: onClose,
      excludeClassNames: ['shop-drawer__mask', 'ant-drawer-mask'],
      initialFocusDelayMs: 0,
    });
  }, [open, onClose]);

  if (!open) return null;

  const panelStyle: React.CSSProperties = {};
  if (placement === 'bottom' && height != null) panelStyle.height = toCssSize(height);
  if ((placement === 'right' || placement === 'left') && width != null) {
    panelStyle.width = toCssSize(width);
  }

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
        tabIndex={-1}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className={[
          'shop-drawer__panel',
          'ant-drawer-content-wrapper',
          'ant-drawer-content',
          className,
        ].filter(Boolean).join(' ')}
        role="dialog"
        aria-modal="true"
        aria-label={labelledBy ? undefined : resolvedAriaLabel}
        aria-labelledby={labelledBy}
        tabIndex={-1}
        style={panelStyle}
      >
        <div className="shop-drawer__header ant-drawer-header">
          <div className="shop-drawer__title ant-drawer-title" id={hasTitle ? titleId : undefined}>{title}</div>
          {extra ? <div className="shop-drawer__extra">{extra}</div> : null}
          <button
            ref={closeRef}
            type="button"
            className="shop-drawer__close ant-drawer-close"
            aria-label={closeLabel}
            title={closeLabel}
            data-shop-drawer-initial-focus="true"
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
