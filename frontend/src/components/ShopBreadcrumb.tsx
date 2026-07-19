import React from 'react';
import { Breadcrumb } from 'antd';
import { useNavigate } from 'react-router-dom';
import './ShopBreadcrumb.css';

export type ShopBreadcrumbItem = {
  key: string;
  label: string;
  path?: string;
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
      <Breadcrumb
        className="shop-breadcrumb__list"
        items={items.map((item, index) => {
          const isLast = index === items.length - 1;
          if (!item.path || isLast) {
            return {
              key: item.key,
              title: (
                <span className="shop-breadcrumb__current" aria-current={isLast ? 'page' : undefined}>
                  {item.label}
                </span>
              ),
            };
          }
          return {
            key: item.key,
            title: (
              <button
                type="button"
                className="shop-breadcrumb__link"
                aria-label={item.label}
                title={item.label}
                onClick={() => navigate(item.path as string)}
              >
                {item.label}
              </button>
            ),
          };
        })}
      />
    </nav>
  );
};

export default ShopBreadcrumb;
