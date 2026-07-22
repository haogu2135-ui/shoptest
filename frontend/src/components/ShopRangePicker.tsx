import React from 'react';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import './ShopRangePicker.css';

export type ShopRangeValue = [Dayjs | null, Dayjs | null] | null;

export type ShopRangePickerProps = {
  value?: ShopRangeValue;
  // Method syntax keeps callbacks bivariant under strictFunctionTypes.
  onChange?(value: ShopRangeValue): void;
  className?: string;
  disabled?: boolean;
  allowClear?: boolean;
  showTime?: boolean;
  startId?: string;
  endId?: string;
  placeholder?: [string, string];
  ariaLabel?: string;
  title?: string;
  startAriaLabel?: string;
  endAriaLabel?: string;
};

const toInputValue = (value?: Dayjs | null, showTime = false) => {
  if (!value || !dayjs.isDayjs(value) || !value.isValid()) return '';
  return value.format(showTime ? 'YYYY-MM-DDTHH:mm' : 'YYYY-MM-DD');
};

const parseInput = (raw: string): Dayjs | null => {
  if (!raw) return null;
  const parsed = dayjs(raw);
  return parsed.isValid() ? parsed : null;
};

const normalizeRange = (start: Dayjs | null, end: Dayjs | null): ShopRangeValue => {
  if (!start && !end) return null;
  return [start, end];
};

const ShopRangePicker: React.FC<ShopRangePickerProps> = ({
  value = null,
  onChange,
  className = '',
  disabled = false,
  allowClear = true,
  showTime = false,
  startId,
  endId,
  placeholder,
  ariaLabel,
  title,
  startAriaLabel,
  endAriaLabel,
}) => {
  const start = value?.[0] ?? null;
  const end = value?.[1] ?? null;
  const startValue = toInputValue(start, showTime);
  const endValue = toInputValue(end, showTime);
  const inputType = showTime ? 'datetime-local' : 'date';
  const startLabel = startAriaLabel || placeholder?.[0] || 'Start';
  const endLabel = endAriaLabel || placeholder?.[1] || 'End';
  const groupLabel = ariaLabel || title || 'Date range';
  const hasValue = Boolean(startValue || endValue);

  const emit = (nextStart: Dayjs | null, nextEnd: Dayjs | null) => {
    onChange?.(normalizeRange(nextStart, nextEnd));
  };

  return (
    <div
      className={`shop-range-picker ${className}`.trim()}
      role="group"
      aria-label={groupLabel}
      title={title || groupLabel}
    >
      <input
        id={startId}
        type={inputType}
        className="shop-range-picker__input shop-range-picker__input--start"
        value={startValue}
        disabled={disabled}
        aria-label={startLabel}
        title={startLabel}
        placeholder={placeholder?.[0]}
        onChange={(event) => emit(parseInput(event.target.value), end)}
      />
      <span className="shop-range-picker__separator" aria-hidden="true">
        –
      </span>
      <input
        id={endId}
        type={inputType}
        className="shop-range-picker__input shop-range-picker__input--end"
        value={endValue}
        disabled={disabled}
        aria-label={endLabel}
        title={endLabel}
        placeholder={placeholder?.[1]}
        onChange={(event) => emit(start, parseInput(event.target.value))}
      />
      {allowClear && hasValue && !disabled ? (
        <button
          type="button"
          className="shop-range-picker__clear"
          aria-label="Clear"
          title="Clear"
          onClick={() => onChange?.(null)}
        >
          ×
        </button>
      ) : null}
    </div>
  );
};

export default ShopRangePicker;
