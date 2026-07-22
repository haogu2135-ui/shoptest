import React, { useMemo } from 'react';
import './ShopPagination.css';

export type ShopPaginationProps = {
  current: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
  showTotal?: (total: number) => React.ReactNode;
  className?: string;
  prevLabel?: string;
  nextLabel?: string;
  ariaLabel?: string;
};

const buildPageItems = (current: number, totalPages: number): Array<number | 'ellipsis-left' | 'ellipsis-right'> => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const items: Array<number | 'ellipsis-left' | 'ellipsis-right'> = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(totalPages - 1, current + 1);

  if (start > 2) items.push('ellipsis-left');
  for (let page = start; page <= end; page += 1) items.push(page);
  if (end < totalPages - 1) items.push('ellipsis-right');
  items.push(totalPages);
  return items;
};

const ShopPagination: React.FC<ShopPaginationProps> = ({
  current,
  total,
  pageSize,
  onChange,
  showTotal,
  className = '',
  prevLabel = 'Previous page',
  nextLabel = 'Next page',
  ariaLabel = 'Pagination',
}) => {
  const totalPages = Math.max(1, Math.ceil(Math.max(0, total) / Math.max(1, pageSize)));
  const safeCurrent = Math.min(totalPages, Math.max(1, Math.floor(current) || 1));
  const pageItems = useMemo(() => buildPageItems(safeCurrent, totalPages), [safeCurrent, totalPages]);

  if (total <= pageSize) return null;

  return (
    <nav className={`shop-pagination ${className}`.trim()} aria-label={ariaLabel}>
      {showTotal ? <div className="shop-pagination__total">{showTotal(total)}</div> : null}
      <ul className="shop-pagination__list" role="list">
        <li className={`shop-pagination__prev${safeCurrent <= 1 ? ' shop-pagination__item--disabled' : ''}`}>
          <button
            type="button"
            className="shop-pagination__control"
            aria-label={prevLabel}
            title={prevLabel}
            disabled={safeCurrent <= 1}
            onClick={() => onChange(safeCurrent - 1)}
          >
            ‹
          </button>
        </li>
        {pageItems.map((item) => {
          if (item === 'ellipsis-left' || item === 'ellipsis-right') {
            return (
              <li key={item} className="shop-pagination__jump" aria-hidden="true">
                <span className="shop-pagination__ellipsis">…</span>
              </li>
            );
          }
          const selected = item === safeCurrent;
          return (
            <li
              key={item}
              className={`shop-pagination__item${selected ? ' shop-pagination__item--active' : ''}`}
            >
              <button
                type="button"
                className="shop-pagination__page"
                aria-label={String(item)}
                aria-current={selected ? 'page' : undefined}
                title={String(item)}
                onClick={() => {
                  if (!selected) onChange(item);
                }}
              >
                {item}
              </button>
            </li>
          );
        })}
        <li className={`shop-pagination__next${safeCurrent >= totalPages ? ' shop-pagination__item--disabled' : ''}`}>
          <button
            type="button"
            className="shop-pagination__control"
            aria-label={nextLabel}
            title={nextLabel}
            disabled={safeCurrent >= totalPages}
            onClick={() => onChange(safeCurrent + 1)}
          >
            ›
          </button>
        </li>
      </ul>
    </nav>
  );
};

export default ShopPagination;
