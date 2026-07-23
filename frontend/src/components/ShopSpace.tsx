import React from 'react';
import './ShopSpace.css';

export type ShopSpaceSize = number | 'small' | 'middle' | 'large' | [number, number];

export type ShopSpaceProps = {
  size?: ShopSpaceSize;
  direction?: 'horizontal' | 'vertical';
  wrap?: boolean;
  align?: 'start' | 'end' | 'center' | 'baseline';
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'color'>;

const PRESET: Record<string, number> = {
  small: 8,
  middle: 16,
  large: 24,
};

const resolveGap = (size: ShopSpaceSize | undefined): string => {
  if (size == null) return '8px';
  if (Array.isArray(size)) {
    const [row, col] = size;
    return `${Number(row) || 0}px ${Number(col) || 0}px`;
  }
  if (typeof size === 'number' && Number.isFinite(size)) return `${size}px`;
  const preset = PRESET[String(size)];
  return preset != null ? `${preset}px` : '8px';
};

const ShopSpace: React.FC<ShopSpaceProps> = ({
  size = 'small',
  direction = 'horizontal',
  wrap = false,
  align,
  className = '',
  style,
  children,
  ...rest
}) => {
  const gap = resolveGap(size);
  const mergedStyle: React.CSSProperties = {
    gap,
    ...style,
  };

  return (
    <div
      {...rest}
      className={[
        'shop-space',
        'ant-space',
        direction === 'vertical' ? 'shop-space--vertical ant-space-vertical' : 'shop-space--horizontal ant-space-horizontal',
        wrap ? 'shop-space--wrap ant-space-align-start' : '',
        align ? `shop-space--align-${align}` : '',
        className,
      ].filter(Boolean).join(' ')}
      style={mergedStyle}
    >
      {React.Children.map(children, (child, index) => {
        if (child == null || child === false) return null;
        return (
          <div className="shop-space__item ant-space-item" key={index}>
            {child}
          </div>
        );
      })}
    </div>
  );
};

export type ShopSpaceCompactProps = {
  block?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'color'>;

const ShopSpaceCompact: React.FC<ShopSpaceCompactProps> = ({
  block = false,
  className = '',
  style,
  children,
  ...rest
}) => (
  <div
    {...rest}
    className={[
      'shop-space-compact',
      'ant-space-compact',
      block ? 'shop-space-compact--block ant-space-compact-block' : '',
      className,
    ].filter(Boolean).join(' ')}
    style={style}
  >
    {children}
  </div>
);

type ShopSpaceComponent = React.FC<ShopSpaceProps> & {
  Compact: typeof ShopSpaceCompact;
};

const ShopSpaceWithCompact = ShopSpace as ShopSpaceComponent;
ShopSpaceWithCompact.Compact = ShopSpaceCompact;

export default ShopSpaceWithCompact;
