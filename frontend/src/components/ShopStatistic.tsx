import React from 'react';
import './ShopStatistic.css';

export type ShopStatisticProps = {
  title?: React.ReactNode;
  value?: string | number;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  precision?: number;
  formatter?: (value?: string | number) => React.ReactNode;
  valueStyle?: React.CSSProperties;
  className?: string;
  style?: React.CSSProperties;
  'aria-label'?: string;
};

const formatNumericValue = (value: string | number | undefined, precision?: number): string => {
  if (value == null) return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (typeof precision === 'number' && Number.isFinite(precision) && precision >= 0) {
      return value.toFixed(precision);
    }
    return String(value);
  }
  return String(value);
};

const ShopStatistic: React.FC<ShopStatisticProps> = ({
  title,
  value,
  prefix,
  suffix,
  precision,
  formatter,
  valueStyle,
  className = '',
  style,
  'aria-label': ariaLabel,
}) => {
  const displayValue = formatter
    ? formatter(value)
    : formatNumericValue(value, precision);

  return (
    <div
      className={['shop-statistic', 'ant-statistic', className].filter(Boolean).join(' ')}
      style={style}
      aria-label={ariaLabel || (typeof title === 'string' ? title : undefined)}
    >
      {title != null && title !== false && title !== '' ? (
        <div className="shop-statistic__title ant-statistic-title">{title}</div>
      ) : null}
      <div className="shop-statistic__content ant-statistic-content" style={valueStyle}>
        {prefix != null && prefix !== false && prefix !== '' ? (
          <span className="shop-statistic__prefix ant-statistic-content-prefix">{prefix}</span>
        ) : null}
        <span className="shop-statistic__value ant-statistic-content-value">{displayValue}</span>
        {suffix != null && suffix !== false && suffix !== '' ? (
          <span className="shop-statistic__suffix ant-statistic-content-suffix">{suffix}</span>
        ) : null}
      </div>
    </div>
  );
};

export default ShopStatistic;
