import React, { forwardRef, useId, useState } from 'react';
import './ShopInput.css';

export type ShopInputProps = {
  value?: string;
  defaultValue?: string;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
  onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  type?: React.HTMLInputTypeAttribute;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  id?: string;
  name?: string;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  pattern?: string;
  maxLength?: number;
  minLength?: number;
  min?: number | string;
  max?: number | string;
  step?: number | string;
  enterKeyHint?: React.InputHTMLAttributes<HTMLInputElement>['enterKeyHint'];
  size?: 'middle' | 'large';
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  addonAfter?: React.ReactNode;
  allowClear?: boolean;
  showCount?: boolean;
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'true' | 'false' | 'grammar' | 'spelling';
  'aria-required'?: boolean | 'true' | 'false';
  title?: string;
  status?: 'error' | 'warning' | '';
};

const ShopInput = forwardRef<HTMLInputElement, ShopInputProps>(({
  value,
  defaultValue,
  onChange,
  onBlur,
  onFocus,
  onKeyDown,
  type = 'text',
  placeholder = '',
  disabled = false,
  readOnly = false,
  className = '',
  id,
  name,
  autoComplete,
  inputMode,
  pattern,
  maxLength,
  minLength,
  min,
  max,
  step,
  enterKeyHint,
  size = 'middle',
  prefix,
  suffix,
  addonAfter,
  allowClear = false,
  showCount = false,
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
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? '');
  const resolvedValue = isControlled ? String(value ?? '') : uncontrolled;
  const showClear = allowClear && !disabled && !readOnly && Boolean(resolvedValue);
  const currentLength = resolvedValue.length;

  return (
    <div
      className={[
        'shop-input',
        `shop-input--${size}`,
        prefix ? 'shop-input--withPrefix' : '',
        (suffix || showClear) ? 'shop-input--withSuffix' : '',
        addonAfter ? 'shop-input--withAddon' : '',
        status ? `shop-input--${status}` : '',
        disabled ? 'shop-input--disabled' : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      <div className="shop-input__shell">
        {prefix ? <span className="shop-input__prefix" aria-hidden="true">{prefix}</span> : null}
        <input
          ref={ref}
          id={inputId}
          name={name}
          className="shop-input__control"
          type={type}
          value={isControlled ? value : undefined}
          defaultValue={isControlled ? undefined : defaultValue}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          autoComplete={autoComplete}
          inputMode={inputMode}
          pattern={pattern}
          maxLength={maxLength}
          minLength={minLength}
          min={min}
          max={max}
          step={step}
          enterKeyHint={enterKeyHint}
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
          aria-invalid={ariaInvalid}
          aria-required={ariaRequired}
          title={title || ariaLabel}
          onChange={(event) => {
            if (!isControlled) setUncontrolled(event.target.value);
            onChange?.(event);
          }}
          onBlur={onBlur}
          onFocus={onFocus}
          onKeyDown={onKeyDown}
        />
        {showClear ? (
          <button
            type="button"
            className="shop-input__clear"
            aria-label="Clear"
            title="Clear"
            onClick={(event) => {
              event.preventDefault();
              if (!isControlled) setUncontrolled('');
              if (!onChange) return;
              const target = { value: '' } as HTMLInputElement;
              onChange({ target, currentTarget: target } as React.ChangeEvent<HTMLInputElement>);
            }}
          >
            ×
          </button>
        ) : null}
        {suffix ? <span className="shop-input__suffix">{suffix}</span> : null}
      </div>
      {addonAfter ? <div className="shop-input__addon">{addonAfter}</div> : null}
      {showCount && typeof maxLength === 'number' ? (
        <div className="shop-input__count" aria-hidden="true">
          {currentLength}/{maxLength}
        </div>
      ) : null}
    </div>
  );
});

ShopInput.displayName = 'ShopInput';

export type ShopPasswordInputProps = Omit<ShopInputProps, 'type' | 'suffix'> & {
  iconRender?: (visible: boolean) => React.ReactNode;
  visibilityToggle?: boolean;
};

export const ShopPasswordInput = forwardRef<HTMLInputElement, ShopPasswordInputProps>(({
  iconRender,
  visibilityToggle = true,
  ...rest
}, ref) => {
  const [visible, setVisible] = React.useState(false);
  const toggle = visibilityToggle ? (
    <button
      type="button"
      className="shop-input__visibility"
      aria-label={typeof rest['aria-label'] === 'string' ? `${rest['aria-label']}: ${visible ? 'Hide' : 'Show'}` : (visible ? 'Hide password' : 'Show password')}
      aria-pressed={visible}
      title={typeof rest['aria-label'] === 'string' ? `${rest['aria-label']}: ${visible ? 'Hide' : 'Show'}` : (visible ? 'Hide password' : 'Show password')}
      onClick={(event) => {
        event.preventDefault();
        setVisible((current) => !current);
      }}
    >
      {iconRender ? iconRender(visible) : (visible ? '🙈' : '👁')}
    </button>
  ) : null;

  // When iconRender returns a full button (Login style), wrap without nested button.
  const suffix = (() => {
    if (!visibilityToggle) return null;
    if (iconRender) {
      return (
        <span
          className="shop-input__visibilityWrap"
          onClick={(event) => {
            // If custom iconRender already includes a button, let it handle clicks;
            // still toggle visibility when the wrap is clicked.
            const target = event.target as HTMLElement;
            if (target.closest('button')) {
              setVisible((current) => !current);
            }
          }}
          onKeyDown={() => undefined}
          role="presentation"
        >
          {iconRender(visible)}
        </span>
      );
    }
    return toggle;
  })();

  return (
    <ShopInput
      {...rest}
      ref={ref}
      type={visible ? 'text' : 'password'}
      suffix={suffix}
    />
  );
});

ShopPasswordInput.displayName = 'ShopPasswordInput';


export type ShopTextAreaProps = {
  value?: string;
  defaultValue?: string;
  onChange?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onBlur?: (event: React.FocusEvent<HTMLTextAreaElement>) => void;
  onFocus?: (event: React.FocusEvent<HTMLTextAreaElement>) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onPressEnter?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  id?: string;
  name?: string;
  autoComplete?: string;
  rows?: number;
  maxLength?: number;
  minLength?: number;
  showCount?: boolean;
  autoSize?: boolean | { minRows?: number; maxRows?: number };
  spellCheck?: boolean;
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'true' | 'false' | 'grammar' | 'spelling';
  'aria-required'?: boolean | 'true' | 'false';
  title?: string;
  status?: 'error' | 'warning' | '';
};

export const ShopTextArea = forwardRef<HTMLTextAreaElement, ShopTextAreaProps>(({
  value,
  defaultValue,
  onChange,
  onBlur,
  onFocus,
  placeholder = '',
  disabled = false,
  readOnly = false,
  className = '',
  id,
  name,
  autoComplete,
  rows = 3,
  maxLength,
  minLength,
  showCount = false,
  autoSize,
  spellCheck,
  status = '',
  onKeyDown,
  onPressEnter,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
  title,
}, ref) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  const isControlled = value !== undefined;
  const minRows = typeof autoSize === 'object' && autoSize?.minRows ? autoSize.minRows : (typeof autoSize === 'boolean' && autoSize ? 2 : rows);
  const maxRows = typeof autoSize === 'object' && autoSize?.maxRows ? autoSize.maxRows : undefined;
  const resolvedRows = minRows || rows;
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? '');
  const resolved = isControlled ? String(value ?? '') : uncontrolled;
  const currentLength = resolved.length;

  return (
    <div
      className={[
        'shop-input',
        'shop-input--textarea',
        status ? `shop-input--${status}` : '',
        disabled ? 'shop-input--disabled' : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      <div className="shop-input__shell shop-input__shell--textarea">
        <textarea
          ref={ref}
          id={inputId}
          name={name}
          className="shop-input__control shop-input__control--textarea"
          value={isControlled ? value : undefined}
          defaultValue={isControlled ? undefined : defaultValue}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          autoComplete={autoComplete}
          spellCheck={spellCheck}
          rows={resolvedRows}
          maxLength={maxLength}
          minLength={minLength}
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
          aria-invalid={ariaInvalid}
          aria-required={ariaRequired}
          title={title || ariaLabel}
          style={maxRows ? { maxHeight: `calc(${maxRows} * 1.45em + 20px)`, overflowY: 'auto' } : undefined}
          onChange={(event) => {
            if (!isControlled) setUncontrolled(event.target.value);
            onChange?.(event);
          }}
          onBlur={onBlur}
          onFocus={onFocus}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              onPressEnter?.(event);
            }
            onKeyDown?.(event);
          }}
        />
      </div>
      {showCount && typeof maxLength === 'number' ? (
        <div className="shop-input__count" aria-hidden="true">
          {currentLength}/{maxLength}
        </div>
      ) : null}
    </div>
  );
});

ShopTextArea.displayName = 'ShopTextArea';

export default ShopInput;
