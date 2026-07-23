import React from 'react';
import './ShopSkeleton.css';

export type ShopSkeletonParagraph = {
  rows?: number;
  width?: number | string | Array<number | string>;
};

export type ShopSkeletonProps = {
  active?: boolean;
  title?: boolean | { width?: number | string };
  paragraph?: boolean | ShopSkeletonParagraph;
  className?: string;
  style?: React.CSSProperties;
  'aria-label'?: string;
};

const ShopSkeleton: React.FC<ShopSkeletonProps> = ({
  active = false,
  title = true,
  paragraph = true,
  className = '',
  style,
  'aria-label': ariaLabel,
}) => {
  const paragraphConfig: ShopSkeletonParagraph =
    paragraph === false ? { rows: 0 } : paragraph === true ? { rows: 3 } : paragraph;
  const rows = Math.max(0, Number(paragraphConfig.rows ?? 3));
  const showTitle = title !== false;

  return (
    <div
      className={[
        'shop-skeleton',
        'ant-skeleton',
        active ? 'shop-skeleton--active ant-skeleton-active' : '',
        className,
      ].filter(Boolean).join(' ')}
      style={style}
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={ariaLabel || 'Loading'}
    >
      <div className="shop-skeleton__content ant-skeleton-content">
        {showTitle ? (
          <div
            className="shop-skeleton__title ant-skeleton-title"
            style={
              typeof title === 'object' && title?.width != null
                ? { width: title.width }
                : undefined
            }
          />
        ) : null}
        {rows > 0 ? (
          <ul className="shop-skeleton__paragraph ant-skeleton-paragraph">
            {Array.from({ length: rows }, (_, index) => (
              <li key={index} className="shop-skeleton__row" />
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
};

export default ShopSkeleton;
