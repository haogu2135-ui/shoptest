import React, { forwardRef, useId } from 'react';
import './ShopInput.css';

export type ShopInputNumberProps = {
  value?: number | null;
  defaultValue?: number | null;
  onChange?: (value: number | null) => void;
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
  onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void;
  min?: number;
  max?: number;
  step?: number | string;
  precision?: number;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  name?: string;
  placeholder?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  addonAfter?: React.ReactNode;
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'true' | 'false' | 'grammar' | 'spelling';
  'aria-required'?: boolean | 'true' | 'false';
  title?: string;
  status?: 'error' | 'warning' | '';
};

const clamp = (value: number, min?: number, max?: number) => {
  let next = value;
  if (typeof min === 'number' && next < min) next = min;
  if (typeof max === 'number' && next > max) next = max;
  return next;
};

const roundPrecision = (value: number, precision?: number) => {
  if (typeof precision !== 'number' || precision < 0) return value;
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

const ShopInputNumber = forwardRef<HTMLInputElement, ShopInputNumberProps>(({
  value,
  defaultValue,
  onChange,
  onBlur,
  onFocus,
  min,
  max,
  step = 'any',
  precision,
  disabled = false,
  readOnly = false,
  className = '',
  style,
  id,
  name,
  placeholder = '',
  prefix,
  suffix,
  addonAfter,
  status = '',
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
  title,
}, ref) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  const isControlled = value !== undefined;
  const resolvedValue = isControlled
    ? (value == null ? '' : String(value))
    : undefined;
  const resolvedDefault = !isControlled && defaultValue != null ? String(defaultValue) : undefined;

  const commit = (raw: string) => {
    if (raw.trim() === '') {
      onChange?.(null);
      return null;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return null;
    const next = roundPrecision(clamp(parsed, min, max), precision);
    onChange?.(next);
    return next;
  };

  return (
    <div
      className={[
        'shop-input',
        'shop-input--number',
        prefix ? 'shop-input--withPrefix' : '',
        suffix ? 'shop-input--withSuffix' : '',
        addonAfter ? 'shop-input--withAddon' : '',
        status ? `shop-input--${status}` : '',
        disabled ? 'shop-input--disabled' : '',
        className,
      ].filter(Boolean).join(' ')}
      style={style}
    >
      <div className="shop-input__shell">
        {prefix ? <span className="shop-input__prefix" aria-hidden="true">{prefix}</span> : null}
        <input
          ref={ref}
          id={inputId}
          name={name}
          className="shop-input__control"
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={resolvedValue}
          defaultValue={resolvedDefault}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
          aria-invalid={ariaInvalid}
          aria-required={ariaRequired}
          title={title || ariaLabel}
          onChange={(event) => {
            commit(event.target.value);
          }}
          onBlur={(event) => {
            const next = commit(event.target.value);
            if (next != null && isControlled) {
              // no-op: parent controls value
            }
            onBlur?.(event);
          }}
          onFocus={onFocus}
        />
        {suffix ? <span className="shop-input__suffix">{suffix}</span> : null}
      </div>
      {addonAfter ? <div className="shop-input__addon">{addonAfter}</div> : null}
    </div>
  );
});

ShopInputNumber.displayName = 'ShopInputNumber';

export default ShopInputNumber;
