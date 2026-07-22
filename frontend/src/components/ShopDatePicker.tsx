import React from 'react';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import './ShopDatePicker.css';

export type ShopDatePickerProps = {
  value?: Dayjs | null;
  onChange?: (value: Dayjs | null) => void;
  className?: string;
  disabled?: boolean;
  id?: string;
  ariaLabel?: string;
  title?: string;
  placeholder?: string;
  allowClear?: boolean;
  /** When true, uses datetime-local (YYYY-MM-DDTHH:mm). */
  showTime?: boolean;
};

const toInputValue = (value?: Dayjs | null, showTime = false) => {
  if (!value || !dayjs.isDayjs(value) || !value.isValid()) return '';
  return value.format(showTime ? 'YYYY-MM-DDTHH:mm' : 'YYYY-MM-DD');
};

const ShopDatePicker: React.FC<ShopDatePickerProps> = ({
  value = null,
  onChange,
  className = '',
  disabled = false,
  id,
  ariaLabel,
  title,
  placeholder = '',
  allowClear = true,
  showTime = false,
}) => {
  const inputValue = toInputValue(value, showTime);
  const label = ariaLabel || placeholder || (showTime ? 'Date time' : 'Date');

  return (
    <div className={`shop-date-picker ${className}`.trim()}>
      <input
        id={id}
        type={showTime ? 'datetime-local' : 'date'}
        className="shop-date-picker__input"
        value={inputValue}
        disabled={disabled}
        aria-label={label}
        title={title || label}
        placeholder={placeholder}
        onChange={(event) => {
          const next = event.target.value;
          if (!next) {
            onChange?.(null);
            return;
          }
          const parsed = dayjs(next);
          onChange?.(parsed.isValid() ? parsed : null);
        }}
      />
      {allowClear && inputValue && !disabled ? (
        <button
          type="button"
          className="shop-date-picker__clear"
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

export default ShopDatePicker;
