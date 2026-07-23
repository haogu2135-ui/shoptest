import React, { useId, useState } from 'react';
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

const ShopTooltip: React.FC<ShopTooltipProps> = ({
  title,
  children,
  className = '',
  overlayClassName = '',
  placement = 'top',
}) => {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();
  const enabled = hasTitle(title);

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <span
      className={['shop-tooltip', 'ant-tooltip-open', className].filter(Boolean).join(' ')}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
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
