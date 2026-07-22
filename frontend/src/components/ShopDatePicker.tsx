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
};

const toInputValue = (value?: Dayjs | null) => {
  if (!value || !dayjs.isDayjs(value) || !value.isValid()) return '';
  return value.format('YYYY-MM-DD');
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
}) => {
  const inputValue = toInputValue(value);
  const label = ariaLabel || placeholder || 'Date';

  return (
    <div className={`shop-date-picker ${className}`.trim()}>
      <input
        id={id}
        type="date"
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
