import React from 'react';
import './ShopBadge.css';

export type ShopBadgeStatus = 'success' | 'processing' | 'default' | 'error' | 'warning';

export type ShopBadgeProps = {
  count?: number | string;
  overflowCount?: number;
  size?: 'default' | 'small';
  showZero?: boolean;
  status?: ShopBadgeStatus;
  text?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
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
  status,
  text,
  className = '',
  style,
  children,
  title,
  offset,
}) => {
  const isStatusMode = Boolean(status) || (text != null && children == null && count === 0 && !showZero);
  const numeric = toCountNumber(count);
  const showCount = showZero ? true : numeric > 0;
  const display = numeric > overflowCount ? `${overflowCount}+` : String(numeric);
  const offsetStyle = offset
    ? ({
        ['--shop-badge-offset-x' as string]: `${offset[0]}px`,
        ['--shop-badge-offset-y' as string]: `${offset[1]}px`,
      } as React.CSSProperties)
    : undefined;
  const mergedStyle = { ...offsetStyle, ...style } as React.CSSProperties | undefined;

  if (isStatusMode && children == null) {
    const statusValue = status || 'default';
    return (
      <span
        className={[
          'shop-badge',
          'shop-badge--status',
          'ant-badge',
          'ant-badge-status',
          `shop-badge--status-${statusValue}`,
          className,
        ].filter(Boolean).join(' ')}
        style={mergedStyle}
        title={title || (typeof text === 'string' ? text : undefined)}
      >
        <span
          className={[
            'shop-badge__statusDot',
            'ant-badge-status-dot',
            `ant-badge-status-${statusValue}`,
          ].filter(Boolean).join(' ')}
          aria-hidden="true"
        />
        {text != null && text !== false && text !== '' ? (
          <span className="shop-badge__statusText ant-badge-status-text">{text}</span>
        ) : null}
      </span>
    );
  }

  return (
    <span
      className={[
        'shop-badge',
        'ant-badge',
        size === 'small' ? 'shop-badge--small ant-badge-sm' : 'shop-badge--default',
        showCount ? 'shop-badge--hasCount' : '',
        className,
      ].filter(Boolean).join(' ')}
      style={mergedStyle}
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
