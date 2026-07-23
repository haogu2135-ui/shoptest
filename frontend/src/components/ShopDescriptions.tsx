import React from 'react';
import './ShopDescriptions.css';

export type ShopDescriptionsColumn = number | Partial<Record<'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl', number>>;

export type ShopDescriptionsItemProps = {
  label?: React.ReactNode;
  span?: number;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
};

export type ShopDescriptionsProps = {
  column?: ShopDescriptionsColumn;
  size?: 'default' | 'middle' | 'small';
  bordered?: boolean;
  layout?: 'horizontal' | 'vertical';
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  title?: React.ReactNode;
};

const resolveColumnCount = (column: ShopDescriptionsColumn | undefined): number => {
  if (column == null) return 3;
  if (typeof column === 'number' && Number.isFinite(column) && column > 0) return Math.floor(column);
  const obj = column as Record<string, number>;
  return Math.max(1, Math.floor(obj.lg || obj.md || obj.sm || obj.xs || obj.xl || obj.xxl || 1));
};

const ShopDescriptionsItem: React.FC<ShopDescriptionsItemProps> = ({
  label,
  span = 1,
  className = '',
  style,
  children,
}) => (
  <div
    className={['shop-descriptions__item', 'ant-descriptions-item', className].filter(Boolean).join(' ')}
    style={{
      gridColumn: span > 1 ? `span ${span}` : undefined,
      ...style,
    }}
  >
    {label != null && label !== false && label !== '' ? (
      <div className="shop-descriptions__label ant-descriptions-item-label">{label}</div>
    ) : null}
    <div className="shop-descriptions__content ant-descriptions-item-content">{children}</div>
  </div>
);

const ShopDescriptionsRoot: React.FC<ShopDescriptionsProps> = ({
  column = 3,
  size = 'default',
  bordered = false,
  layout = 'horizontal',
  className = '',
  style,
  children,
  title,
}) => {
  const cols = resolveColumnCount(column);
  const responsive = typeof column === 'object' && column != null;
  return (
    <div
      className={[
        'shop-descriptions',
        'ant-descriptions',
        bordered ? 'shop-descriptions--bordered ant-descriptions-bordered' : '',
        size === 'small' ? 'shop-descriptions--small ant-descriptions-small' : '',
        size === 'middle' ? 'shop-descriptions--middle' : '',
        layout === 'vertical' ? 'shop-descriptions--vertical' : '',
        responsive ? 'shop-descriptions--responsive' : '',
        className,
      ].filter(Boolean).join(' ')}
      style={{
        ['--shop-descriptions-cols' as string]: String(cols),
        ...style,
      }}
    >
      {title != null && title !== false && title !== '' ? (
        <div className="shop-descriptions__title ant-descriptions-title">{title}</div>
      ) : null}
      <div className="shop-descriptions__view ant-descriptions-view">
        <div className="shop-descriptions__row ant-descriptions-row">{children}</div>
      </div>
    </div>
  );
};

type ShopDescriptionsComponent = React.FC<ShopDescriptionsProps> & {
  Item: typeof ShopDescriptionsItem;
};

const ShopDescriptions = ShopDescriptionsRoot as ShopDescriptionsComponent;
ShopDescriptions.Item = ShopDescriptionsItem;

export { ShopDescriptionsItem };
export default ShopDescriptions;
