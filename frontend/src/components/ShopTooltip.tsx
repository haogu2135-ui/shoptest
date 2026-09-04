import React, { useEffect, useId, useRef, useState } from 'react';
import './ShopTooltip.css';

export type ShopTooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

export type ShopTooltipProps = {
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  overlayClassName?: string;
  placement?: ShopTooltipPlacement;
  mouseEnterDelay?: number;
  mouseLeaveDelay?: number;
};

const hasTitle = (title: React.ReactNode | undefined): boolean => {
  if (title == null || title === false) return false;
  if (typeof title === 'string' && title.trim() === '') return false;
  return true;
};

const normalizeDelay = (value: number | undefined) => (
  typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(Math.floor(value), 10_000))
    : 0
);

const ShopTooltip: React.FC<ShopTooltipProps> = ({
  title,
  children,
  className = '',
  overlayClassName = '',
  placement = 'top',
  mouseEnterDelay = 0,
  mouseLeaveDelay = 0,
}) => {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();
  const showTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const enabled = hasTitle(title);
  const enterDelay = normalizeDelay(mouseEnterDelay);
  const leaveDelay = normalizeDelay(mouseLeaveDelay);

  const clearTimers = () => {
    if (showTimerRef.current !== null) window.clearTimeout(showTimerRef.current);
    if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
    showTimerRef.current = null;
    hideTimerRef.current = null;
  };

  const scheduleOpen = () => {
    clearTimers();
    if (enterDelay === 0) setOpen(true);
    else showTimerRef.current = window.setTimeout(() => setOpen(true), enterDelay);
  };

  const scheduleClose = () => {
    clearTimers();
    if (leaveDelay === 0) setOpen(false);
    else hideTimerRef.current = window.setTimeout(() => setOpen(false), leaveDelay);
  };

  useEffect(() => () => clearTimers(), [enabled]);

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <span
      className={['shop-tooltip', 'ant-tooltip-open', className].filter(Boolean).join(' ')}
      onMouseEnter={scheduleOpen}
      onMouseLeave={scheduleClose}
      onFocus={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) scheduleOpen();
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) scheduleClose();
      }}
    >
      <span className="shop-tooltip__trigger" aria-describedby={open ? tooltipId : undefined}>
        {children}
      </span>
      {open ? (
        <span
          id={tooltipId}
          role="tooltip"
          className={[
            'shop-tooltip__overlay',
            'ant-tooltip',
            'ant-tooltip-placement-' + placement,
            overlayClassName,
          ].filter(Boolean).join(' ')}
        >
          <span className="shop-tooltip__content ant-tooltip-content">
            <span className="shop-tooltip__arrow ant-tooltip-arrow" aria-hidden="true" />
            <span className="shop-tooltip__inner ant-tooltip-inner">{title}</span>
          </span>
        </span>
      ) : null}
    </span>
  );
};

export default ShopTooltip;
