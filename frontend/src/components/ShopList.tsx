import React from 'react';
import ShopSpin from './ShopSpin';
import ShopEmpty from './ShopEmpty';
import './ShopList.css';

export type ShopListPagination = {
  current?: number;
  pageSize?: number;
  total?: number;
  showSizeChanger?: boolean;
  pageSizeOptions?: Array<string | number>;
  size?: 'default' | 'small';
  showTotal?: (total: number, range?: [number, number]) => React.ReactNode;
  itemRender?: (...args: any[]) => React.ReactNode;
  onChange?: (page: number, pageSize: number) => void;
  onShowSizeChange?: (current: number, size: number) => void;
};

export type ShopListProps<T = any> = {
  dataSource?: T[];
  renderItem?: (item: T, index: number) => React.ReactNode;
  loading?: boolean;
  locale?: { emptyText?: React.ReactNode };
  pagination?: false | ShopListPagination;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  split?: boolean;
  rowKey?: string | ((item: T) => string | number);
};

export type ShopListItemProps = React.LiHTMLAttributes<HTMLLIElement> & {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  actions?: React.ReactNode[];
};

export type ShopListItemMetaProps = {
  avatar?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

const ShopListItemMeta: React.FC<ShopListItemMetaProps> = ({
  avatar,
  title,
  description,
  className = '',
  style,
}) => (
  <div className={['shop-list__meta', 'ant-list-item-meta', className].filter(Boolean).join(' ')} style={style}>
    {avatar != null && avatar !== false ? (
      <div className="shop-list__metaAvatar ant-list-item-meta-avatar">{avatar}</div>
    ) : null}
    <div className="shop-list__metaContent ant-list-item-meta-content">
      {title != null && title !== false ? (
        <div className="shop-list__metaTitle ant-list-item-meta-title">{title}</div>
      ) : null}
      {description != null && description !== false ? (
        <div className="shop-list__metaDescription ant-list-item-meta-description">{description}</div>
      ) : null}
    </div>
  </div>
);

type ShopListItemComponent = React.FC<ShopListItemProps> & {
  Meta: typeof ShopListItemMeta;
};

const ShopListItem = (({
  children,
  className = '',
  style,
  onClick,
  onKeyDown,
  actions,
  role,
  tabIndex,
  ...rest
}: ShopListItemProps) => {
  const interactive = Boolean(onClick);
  return (
    <li
      className={['shop-list__item', 'ant-list-item', className].filter(Boolean).join(' ')}
      style={style}
      onClick={onClick}
      onKeyDown={onKeyDown}
      role={role ?? (interactive ? 'button' : undefined)}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      {...rest}
    >
      <div className="shop-list__itemMain ant-list-item-main">{children}</div>
      {actions && actions.length > 0 ? (
        <ul className="shop-list__itemActions ant-list-item-action">
          {actions.map((action, index) => (
            <li key={index} className="shop-list__itemAction">
              <span>{action}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}) as ShopListItemComponent;

ShopListItem.Meta = ShopListItemMeta;

const resolveRowKey = <T,>(item: T, index: number, rowKey?: ShopListProps<T>['rowKey']): string | number => {
  if (typeof rowKey === 'function') return rowKey(item);
  if (typeof rowKey === 'string' && item && typeof item === 'object' && rowKey in (item as object)) {
    const value = (item as Record<string, unknown>)[rowKey];
    if (typeof value === 'string' || typeof value === 'number') return value;
  }
  if (item && typeof item === 'object' && 'id' in (item as object)) {
    const value = (item as { id?: string | number }).id;
    if (typeof value === 'string' || typeof value === 'number') return value;
  }
  return index;
};

type ShopListComponent = (<T,>(props: ShopListProps<T>) => React.ReactElement) & {
  Item: typeof ShopListItem;
};

const ShopListInner = <T,>({
  dataSource,
  renderItem,
  loading = false,
  locale,
  pagination,
  className = '',
  style,
  children,
  split = true,
  rowKey,
}: ShopListProps<T>) => {
  const items = Array.isArray(dataSource) ? dataSource : [];
  const emptyText = locale?.emptyText;
  const content = renderItem
    ? items.map((item, index) => (
        <React.Fragment key={resolveRowKey(item, index, rowKey)}>
          {renderItem(item, index)}
        </React.Fragment>
      ))
    : children;

  const isEmpty = renderItem ? items.length === 0 : React.Children.count(children) === 0;

  let paginationNode: React.ReactNode = null;
  const paginationConfig = typeof pagination === 'object' && pagination ? pagination : null;
  if (paginationConfig) {
    const current = Math.max(1, Number(paginationConfig.current || 1));
    const pageSize = Math.max(1, Number(paginationConfig.pageSize || 10));
    const total = Math.max(0, Number(paginationConfig.total || 0));
    const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
    const start = total === 0 ? 0 : (current - 1) * pageSize + 1;
    const end = Math.min(total, current * pageSize);
    paginationNode = (
      <div className="shop-list__pagination ant-list-pagination">
        {paginationConfig.showTotal ? (
          <span className="shop-list__paginationTotal">{paginationConfig.showTotal(total, [start, end])}</span>
        ) : null}
        <div className="shop-list__paginationControls">
          <button
            type="button"
            className="shop-list__pageBtn"
            disabled={current <= 1}
            onClick={() => paginationConfig.onChange?.(current - 1, pageSize)}
          >
            ‹
          </button>
          <span className="shop-list__pageStatus">{current} / {totalPages}</span>
          <button
            type="button"
            className="shop-list__pageBtn"
            disabled={current >= totalPages}
            onClick={() => paginationConfig.onChange?.(current + 1, pageSize)}
          >
            ›
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={[
        'shop-list',
        'ant-list',
        split ? 'ant-list-split' : '',
        loading ? 'ant-list-loading' : '',
        className,
      ].filter(Boolean).join(' ')}
      style={style}
    >
      <ShopSpin spinning={loading}>
        {isEmpty && !loading ? (
          <div className="shop-list__empty ant-list-empty-text">
            {emptyText != null && emptyText !== false ? emptyText : <ShopEmpty />}
          </div>
        ) : (
          <ul className="shop-list__items ant-list-items">{content}</ul>
        )}
      </ShopSpin>
      {paginationNode}
    </div>
  );
};

const ShopList = ShopListInner as ShopListComponent;
ShopList.Item = ShopListItem;

export { ShopListItem, ShopListItemMeta };
export default ShopList;
