import React from 'react';
import './ShopCard.css';

export type ShopCardProps = {
  title?: React.ReactNode;
  extra?: React.ReactNode;
  loading?: boolean;
  hoverable?: boolean;
  bordered?: boolean;
  size?: 'default' | 'small';
  className?: string;
  style?: React.CSSProperties;
  bodyStyle?: React.CSSProperties;
  headStyle?: React.CSSProperties;
  children?: React.ReactNode;
  cover?: React.ReactNode;
  actions?: React.ReactNode[];
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'title' | 'color'>;

const ShopCard: React.FC<ShopCardProps> = ({
  title,
  extra,
  loading = false,
  hoverable = false,
  bordered = true,
  size = 'default',
  className = '',
  style,
  bodyStyle,
  headStyle,
  children,
  cover,
  actions,
  ...rest
}) => {
  const hasHead = (title != null && title !== false && title !== '') || (extra != null && extra !== false);
  return (
    <div
      {...rest}
      className={[
        'shop-card',
        'ant-card',
        bordered ? 'ant-card-bordered' : 'shop-card--borderless',
        hoverable ? 'shop-card--hoverable ant-card-hoverable' : '',
        loading ? 'shop-card--loading ant-card-loading' : '',
        size === 'small' ? 'shop-card--small ant-card-small' : '',
        className,
      ].filter(Boolean).join(' ')}
      style={style}
      aria-busy={loading || rest['aria-busy']}
    >
      {cover != null && cover !== false ? (
        <div className="shop-card__cover ant-card-cover">{cover}</div>
      ) : null}
      {hasHead ? (
        <div className="shop-card__head ant-card-head" style={headStyle}>
          <div className="shop-card__headWrapper ant-card-head-wrapper">
            {title != null && title !== false && title !== '' ? (
              <div className="shop-card__headTitle ant-card-head-title">{title}</div>
            ) : null}
            {extra != null && extra !== false ? (
              <div className="shop-card__extra ant-card-extra">{extra}</div>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="shop-card__body ant-card-body" style={bodyStyle}>
        {loading ? (
          <div className="shop-card__skeleton ant-card-loading-content" aria-hidden="true">
            <span className="shop-card__skeletonBar" />
            <span className="shop-card__skeletonBar" />
            <span className="shop-card__skeletonBar shop-card__skeletonBar--short" />
          </div>
        ) : (
          children
        )}
      </div>
      {actions && actions.length > 0 ? (
        <ul className="shop-card__actions ant-card-actions">
          {actions.map((action, index) => (
            <li key={index} className="shop-card__action">
              {action}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};

export default ShopCard;
