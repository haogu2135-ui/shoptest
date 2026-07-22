import React, { useMemo, useState } from 'react';
import { ShopIcon, SI } from './ShopIcon';
import './ShopRate.css';

export type ShopRateProps = {
  value?: number;
  count?: number;
  allowHalf?: boolean;
  disabled?: boolean;
  onChange?: (value: number) => void;
  className?: string;
  ariaLabel?: string;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const normalizeValue = (value: number, count: number, allowHalf: boolean) => {
  const capped = clamp(Number.isFinite(value) ? value : 0, 0, count);
  if (!allowHalf) return Math.round(capped);
  return Math.round(capped * 2) / 2;
};

const ShopRate: React.FC<ShopRateProps> = ({
  value = 0,
  count = 5,
  allowHalf = false,
  disabled = false,
  onChange,
  className = '',
  ariaLabel,
}) => {
  const interactive = Boolean(onChange) && !disabled;
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const stars = useMemo(() => Array.from({ length: count }, (_, index) => index + 1), [count]);
  const displayValue = normalizeValue(hoverValue ?? value, count, allowHalf);
  const label = ariaLabel || `${displayValue} / ${count}`;

  const pickValue = (star: number, event: React.MouseEvent | React.KeyboardEvent) => {
    if (!allowHalf) return star;
    if ('clientX' in event && event.currentTarget instanceof HTMLElement) {
      const rect = event.currentTarget.getBoundingClientRect();
      const ratio = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 1;
      return ratio <= 0.5 ? star - 0.5 : star;
    }
    return star;
  };

  const commit = (next: number) => {
    if (!interactive || !onChange) return;
    const normalized = normalizeValue(next, count, allowHalf);
    if (normalized !== value) onChange(normalized);
  };

  return (
    <div
      className={`shop-rate${interactive ? ' shop-rate--interactive' : ''} ${className}`.trim()}
      role={interactive ? 'radiogroup' : 'img'}
      aria-label={label}
      aria-disabled={disabled || undefined}
      onMouseLeave={interactive ? () => setHoverValue(null) : undefined}
    >
      {stars.map((star) => {
        const fill = clamp(displayValue - (star - 1), 0, 1);
        const selected = interactive && normalizeValue(value, count, allowHalf) === star;
        const starLabel = `${star}`;
        const content = (
          <>
            <span className="shop-rate__base" aria-hidden="true">
              <ShopIcon path={SI.star} />
            </span>
            <span
              className="shop-rate__fill"
              aria-hidden="true"
              style={{ width: `${fill * 100}%` }}
            >
              <ShopIcon path={SI.star} />
            </span>
          </>
        );

        if (!interactive) {
          return (
            <span key={star} className="shop-rate__star">
              {content}
            </span>
          );
        }

        return (
          <button
            key={star}
            type="button"
            role="radio"
            className={`shop-rate__star shop-rate__star--button${fill > 0 ? ' shop-rate__star--active' : ''}`}
            aria-checked={selected || (allowHalf && value === star - 0.5 && fill >= 0.5)}
            aria-label={starLabel}
            title={starLabel}
            onMouseMove={(event) => setHoverValue(pickValue(star, event))}
            onFocus={() => setHoverValue(star)}
            onBlur={() => setHoverValue(null)}
            onClick={(event) => commit(pickValue(star, event))}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                commit(star);
              }
            }}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
};

export default ShopRate;
