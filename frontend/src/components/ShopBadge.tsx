import React from 'react';
import './ShopBadge.css';

export type ShopBadgeProps = {
  count?: number | string;
  overflowCount?: number;
  size?: 'default' | 'small';
  showZero?: boolean;
  className?: string;
  children?: React.ReactNode;
  title?: string;
  offset?: [number, number];
};

const toCountNumber = (count: number | string | undefined): number => {
  if (typeof count === 'number' && Number.isFinite(count)) return Math.max(0, Math.floor(count));
  if (typeof count === 'string' && count.trim() !== '') {
    const parsed = Number(count);
    if (Number.isFinite(parsed)) return Math.max(0, Math.floor(parsed));
  }
  return 0;
};

const ShopBadge: React.FC<ShopBadgeProps> = ({
  count = 0,
  overflowCount = 99,
  size = 'default',
  showZero = false,
  className = '',
  children,
  title,
  offset,
}) => {
  const numeric = toCountNumber(count);
  const showCount = showZero ? true : numeric > 0;
  const display = numeric > overflowCount ? `${overflowCount}+` : String(numeric);
  const style = offset
    ? ({
        ['--shop-badge-offset-x' as string]: `${offset[0]}px`,
        ['--shop-badge-offset-y' as string]: `${offset[1]}px`,
      } as React.CSSProperties)
    : undefined;

  return (
    <span
      className={[
        'shop-badge',
        'ant-badge',
        size === 'small' ? 'shop-badge--small ant-badge-sm' : 'shop-badge--default',
        showCount ? 'shop-badge--hasCount' : '',
        className,
      ].filter(Boolean).join(' ')}
      style={style}
    >
      <span className="shop-badge__body">{children}</span>
      {showCount ? (
        <sup
          className="shop-badge__count ant-badge-count"
          title={title || display}
          aria-hidden="true"
        >
          <bdi>{display}</bdi>
        </sup>
      ) : null}
    </span>
  );
};

export default ShopBadge;
