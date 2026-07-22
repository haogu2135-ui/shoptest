import React, { useId, useState } from 'react';
import { ShopIcon, SI } from './ShopIcon';
import './ShopSearchField.css';

export type ShopSearchFieldProps = {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onSearch?: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  title?: string;
  className?: string;
  inputClassName?: string;
  allowClear?: boolean;
  showSubmit?: boolean;
  submitLabel?: string;
  disabled?: boolean;
  size?: 'middle' | 'large';
  id?: string;
  name?: string;
  autoComplete?: string;
  prefix?: React.ReactNode;
};

const ShopSearchField: React.FC<ShopSearchFieldProps> = ({
  value,
  defaultValue = '',
  onChange,
  onSearch,
  placeholder = '',
  ariaLabel,
  title,
  className = '',
  inputClassName = '',
  allowClear = true,
  showSubmit = true,
  submitLabel,
  disabled = false,
  size = 'middle',
  id,
  name,
  autoComplete = 'off',
  prefix,
}) => {
  const isControlled = typeof value === 'string';
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const resolvedValue = isControlled ? value : uncontrolled;
  const generatedId = useId();
  const inputId = id || generatedId;
  const label = ariaLabel || placeholder || submitLabel || 'Search';

  const setValue = (next: string) => {
    if (!isControlled) setUncontrolled(next);
    onChange?.(next);
  };

  const submit = () => {
    if (disabled) return;
    onSearch?.(resolvedValue);
  };

  return (
    <div className={`shop-search-field shop-search-field--${size}${showSubmit ? '' : ' shop-search-field--noSubmit'} ${className}`.trim()}>
      <div className="shop-search-field__control">
        {prefix ? <span className="shop-search-field__prefix" aria-hidden="true">{prefix}</span> : null}
        <input
          id={inputId}
          name={name}
          type="search"
          className={`shop-search-field__input ${inputClassName}`.trim()}
          value={resolvedValue}
          disabled={disabled}
          placeholder={placeholder}
          aria-label={label}
          title={title || label}
          autoComplete={autoComplete}
          enterKeyHint="search"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              submit();
            }
          }}
        />
        {allowClear && resolvedValue && !disabled ? (
          <button
            type="button"
            className="shop-search-field__clear"
            aria-label="Clear"
            title="Clear"
            onClick={() => {
              setValue('');
              onChange?.('');
            }}
          >
            ×
          </button>
        ) : null}
      </div>
      {showSubmit ? (
        <button
          type="button"
          className="shop-search-field__submit"
          aria-label={submitLabel || label}
          title={submitLabel || label}
          disabled={disabled}
          onClick={submit}
        >
          <ShopIcon path={SI.search} />
        </button>
      ) : null}
    </div>
  );
};

export default ShopSearchField;
