import React, { useCallback, useMemo, useRef } from 'react';
import './ShopRangeSlider.css';

export type ShopRangeSliderProps = {
  min: number;
  max: number;
  step?: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
  onChangeComplete?: (value: [number, number]) => void;
  ariaLabelForHandle?: [string, string];
  className?: string;
  disabled?: boolean;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const ShopRangeSlider: React.FC<ShopRangeSliderProps> = ({
  min,
  max,
  step = 1,
  value,
  onChange,
  onChangeComplete,
  ariaLabelForHandle,
  className = '',
  disabled = false,
}) => {
  const safeMax = Math.max(min, max);
  const safeMin = Math.min(min, safeMax);
  const low = clamp(Math.min(value[0], value[1]), safeMin, safeMax);
  const high = clamp(Math.max(value[0], value[1]), safeMin, safeMax);
  const span = Math.max(1, safeMax - safeMin);
  const lowPercent = ((low - safeMin) / span) * 100;
  const highPercent = ((high - safeMin) / span) * 100;
  const activeValueRef = useRef<[number, number]>([low, high]);
  activeValueRef.current = [low, high];

  const labels = useMemo(
    () => ariaLabelForHandle || [`Minimum ${low}`, `Maximum ${high}`],
    [ariaLabelForHandle, high, low],
  );

  const emitChange = useCallback((next: [number, number]) => {
    const normalized: [number, number] = [
      clamp(Math.min(next[0], next[1]), safeMin, safeMax),
      clamp(Math.max(next[0], next[1]), safeMin, safeMax),
    ];
    activeValueRef.current = normalized;
    onChange(normalized);
  }, [onChange, safeMax, safeMin]);

  const complete = useCallback(() => {
    onChangeComplete?.(activeValueRef.current);
  }, [onChangeComplete]);

  return (
    <div
      className={`shop-range ${disabled ? 'shop-range--disabled' : ''} ${className}`.trim()}
      data-shop-range="true"
    >
      <div className="shop-range__rail" aria-hidden="true">
        <div
          className="shop-range__track"
          style={{ left: `${lowPercent}%`, width: `${Math.max(0, highPercent - lowPercent)}%` }}
        />
      </div>
      <input
        type="range"
        className="shop-range__input shop-range__input--low"
        min={safeMin}
        max={safeMax}
        step={step}
        value={low}
        disabled={disabled}
        aria-label={labels[0]}
        aria-valuemin={safeMin}
        aria-valuemax={safeMax}
        aria-valuenow={low}
        onChange={(event) => {
          const nextLow = Number(event.target.value);
          emitChange([Math.min(nextLow, high), high]);
        }}
        onMouseUp={complete}
        onTouchEnd={complete}
        onKeyUp={(event) => {
          if (event.key === 'Enter' || event.key === ' ') complete();
        }}
        onBlur={complete}
      />
      <input
        type="range"
        className="shop-range__input shop-range__input--high"
        min={safeMin}
        max={safeMax}
        step={step}
        value={high}
        disabled={disabled}
        aria-label={labels[1]}
        aria-valuemin={safeMin}
        aria-valuemax={safeMax}
        aria-valuenow={high}
        onChange={(event) => {
          const nextHigh = Number(event.target.value);
          emitChange([low, Math.max(nextHigh, low)]);
        }}
        onMouseUp={complete}
        onTouchEnd={complete}
        onKeyUp={(event) => {
          if (event.key === 'Enter' || event.key === ' ') complete();
        }}
        onBlur={complete}
      />
    </div>
  );
};

export default ShopRangeSlider;
