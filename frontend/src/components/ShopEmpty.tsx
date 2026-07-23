import React from 'react';
import './ShopEmpty.css';

export type ShopEmptyProps = {
  description?: React.ReactNode;
  image?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  'aria-label'?: string;
};

const ShopEmpty: React.FC<ShopEmptyProps> = ({
  description,
  image,
  children,
  className = '',
  style,
  'aria-label': ariaLabel,
}) => (
  <div
    className={['shop-empty', 'ant-empty', className].filter(Boolean).join(' ')}
    style={style}
    role="status"
    aria-live="polite"
    aria-label={ariaLabel || (typeof description === 'string' ? description : undefined)}
  >
    <div className="shop-empty__image ant-empty-image" aria-hidden="true">
      {image ?? <span className="shop-empty__glyph" />}
    </div>
    {description != null && description !== false && description !== '' ? (
      <div className="shop-empty__description ant-empty-description">{description}</div>
    ) : null}
    {children != null && children !== false ? (
      <div className="shop-empty__footer ant-empty-footer">{children}</div>
    ) : null}
  </div>
);

export default ShopEmpty;
