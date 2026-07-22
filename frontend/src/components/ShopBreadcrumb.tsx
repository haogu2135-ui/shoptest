import React from 'react';
import { useNavigate } from 'react-router-dom';
import './ShopBreadcrumb.css';

export type ShopBreadcrumbItem = {
  key: string;
  label: React.ReactNode;
  path?: string;
  ariaLabel?: string;
};

export type ShopBreadcrumbProps = {
  items: ShopBreadcrumbItem[];
  className?: string;
  ariaLabel?: string;
};

const ShopBreadcrumb: React.FC<ShopBreadcrumbProps> = ({
  items,
  className = '',
  ariaLabel,
}) => {
  const navigate = useNavigate();
  if (!items.length) return null;

  return (
    <nav
      className={`shop-breadcrumb ${className}`.trim()}
      aria-label={ariaLabel || 'Breadcrumb'}
    >
      <ol className="shop-breadcrumb__list">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const linkLabel = item.ariaLabel
            || (typeof item.label === 'string' ? item.label : item.key);
          return (
            <li key={item.key} className="shop-breadcrumb__item">
              {!item.path || isLast ? (
                <span
                  className="shop-breadcrumb__current"
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.label}
                </span>
              ) : (
                <button
                  type="button"
                  className="shop-breadcrumb__link"
                  aria-label={linkLabel}
                  title={linkLabel}
                  onClick={() => navigate(item.path as string)}
                >
                  {item.label}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default ShopBreadcrumb;
