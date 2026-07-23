import React from 'react';
import './ShopDivider.css';

export type ShopDividerProps = {
  type?: 'horizontal' | 'vertical';
  dashed?: boolean;
  plain?: boolean;
  orientation?: 'left' | 'right' | 'center';
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'color'>;

const ShopDivider: React.FC<ShopDividerProps> = ({
  type = 'horizontal',
  dashed = false,
  plain = false,
  orientation = 'center',
  className = '',
  style,
  children,
  ...rest
}) => {
  const hasLabel = children != null && children !== false && children !== '';
  return (
    <div
      {...rest}
      role={rest.role || 'separator'}
      className={[
        'shop-divider',
        'ant-divider',
        type === 'vertical' ? 'shop-divider--vertical ant-divider-vertical' : 'shop-divider--horizontal ant-divider-horizontal',
        dashed ? 'shop-divider--dashed ant-divider-dashed' : '',
        plain ? 'shop-divider--plain ant-divider-plain' : '',
        hasLabel ? 'shop-divider--withText ant-divider-with-text' : '',
        hasLabel ? `ant-divider-with-text-${orientation}` : '',
        className,
      ].filter(Boolean).join(' ')}
      style={style}
    >
      {hasLabel ? <span className="shop-divider__inner ant-divider-inner-text">{children}</span> : null}
    </div>
  );
};

export default ShopDivider;
