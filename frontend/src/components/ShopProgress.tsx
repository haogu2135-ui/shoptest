import React from 'react';
import './ShopProgress.css';

export type ShopProgressType = 'line' | 'circle' | 'dashboard';
export type ShopProgressStatus = 'normal' | 'exception' | 'success' | 'active';
export type ShopProgressSize = 'default' | 'small' | number;

export type ShopProgressProps = {
  percent?: number;
  type?: ShopProgressType;
  showInfo?: boolean;
  strokeColor?: string;
  trailColor?: string;
  size?: ShopProgressSize;
  width?: number;
  status?: ShopProgressStatus;
  format?: (percent?: number) => React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  'aria-label'?: string;
  'aria-labelledby'?: string;
};

const clampPercent = (value: number | undefined): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
};

const resolveCircleSize = (size: ShopProgressSize | undefined, width: number | undefined): number => {
  if (typeof width === 'number' && Number.isFinite(width) && width > 0) return width;
  if (typeof size === 'number' && Number.isFinite(size) && size > 0) return size;
  if (size === 'small') return 80;
  return 120;
};

const defaultFormat = (percent: number): string => `${Math.round(percent)}%`;

const ShopProgress: React.FC<ShopProgressProps> = ({
  percent = 0,
  type = 'line',
  showInfo = true,
  strokeColor,
  trailColor,
  size = 'default',
  width,
  status = 'normal',
  format,
  className = '',
  style,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
}) => {
  const safePercent = clampPercent(percent);
  const isCircle = type === 'circle' || type === 'dashboard';
  const resolvedStroke =
    strokeColor
    || (status === 'exception' ? '#ff4d4f' : status === 'success' ? '#52c41a' : '#124734');
  const resolvedTrail = trailColor || '#edf0ed';
  const infoNode = showInfo
    ? (format ? format(safePercent) : defaultFormat(safePercent))
    : null;

  if (isCircle) {
    const diameter = resolveCircleSize(size, width);
    const strokeWidth = type === 'dashboard' ? 8 : 6;
    const radius = (diameter - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    // dashboard uses ~75% of the circle arc (antd-like)
    const arcRatio = type === 'dashboard' ? 0.75 : 1;
    const trackLength = circumference * arcRatio;
    const progressLength = trackLength * (safePercent / 100);
    const rotation = type === 'dashboard' ? 135 : -90;

    return (
      <div
        className={[
          'shop-progress',
          'shop-progress--circle',
          'ant-progress',
          'ant-progress-circle',
          type === 'dashboard' ? 'shop-progress--dashboard ant-progress-status-normal' : '',
          status === 'exception' ? 'ant-progress-status-exception' : '',
          status === 'success' ? 'ant-progress-status-success' : '',
          className,
        ].filter(Boolean).join(' ')}
        style={{ width: diameter, height: diameter, ...style }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(safePercent)}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
      >
        <svg
          className="shop-progress__svg ant-progress-circle"
          viewBox={`0 0 ${diameter} ${diameter}`}
          width={diameter}
          height={diameter}
          aria-hidden="true"
        >
          <circle
            className="shop-progress__trail"
            cx={diameter / 2}
            cy={diameter / 2}
            r={radius}
            fill="none"
            stroke={resolvedTrail}
            strokeWidth={strokeWidth}
            strokeDasharray={`${trackLength} ${circumference}`}
            strokeLinecap="round"
            transform={`rotate(${rotation} ${diameter / 2} ${diameter / 2})`}
          />
          <circle
            className="shop-progress__stroke"
            cx={diameter / 2}
            cy={diameter / 2}
            r={radius}
            fill="none"
            stroke={resolvedStroke}
            strokeWidth={strokeWidth}
            strokeDasharray={`${progressLength} ${circumference}`}
            strokeLinecap="round"
            transform={`rotate(${rotation} ${diameter / 2} ${diameter / 2})`}
          />
        </svg>
        {showInfo ? (
          <span className="shop-progress__circleInfo ant-progress-text">{infoNode}</span>
        ) : null}
      </div>
    );
  }

  const isSmall = size === 'small';
  return (
    <div
      className={[
        'shop-progress',
        'shop-progress--line',
        'ant-progress',
        'ant-progress-line',
        isSmall ? 'shop-progress--small ant-progress-small' : '',
        showInfo ? 'ant-progress-show-info' : '',
        status === 'exception' ? 'ant-progress-status-exception' : '',
        status === 'success' ? 'ant-progress-status-success' : '',
        className,
      ].filter(Boolean).join(' ')}
      style={style}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(safePercent)}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
    >
      <div className="shop-progress__outer ant-progress-outer">
        <div className="shop-progress__inner ant-progress-inner" style={{ backgroundColor: resolvedTrail }}>
          <div
            className="shop-progress__bg ant-progress-bg"
            style={{ width: `${safePercent}%`, backgroundColor: resolvedStroke }}
          />
        </div>
      </div>
      {showInfo ? (
        <span className="shop-progress__info ant-progress-text">{infoNode}</span>
      ) : null}
    </div>
  );
};

export default ShopProgress;
