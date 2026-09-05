import React, { forwardRef, useId, useState } from 'react';
import { useLanguage } from '../i18n';

const normalizeRows = (value: number | undefined, fallback: number) => (
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    ? Math.min(value, 100)
    : fallback
);

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
  required?: boolean;
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
  clearLabel?: string;
  showCount?: boolean;
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'true' | 'false' | 'grammar' | 'spelling';
  'aria-required'?: boolean | 'true' | 'false';
  title?: string;
  status?: 'error' | 'warning' | '';
};

const ShopInput = forwardRef<HTMLInputElement, ShopInputProps>((props, ref) => {
  const {
  value,
  defaultValue,
  onChange,
  onBlur,
  onFocus,
  onKeyDown,
  type = 'text',
  placeholder = '',
  disabled = false,
  required = false,
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
  clearLabel = 'Clear',
  showCount = false,
  status = '',
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
  title,
  } = props;
  const generatedId = useId();
  const inputId = id || generatedId;
  const normalizedMaxLength = typeof maxLength === 'number' && Number.isSafeInteger(maxLength) && maxLength >= 0 ? maxLength : undefined;
  const normalizedMinLength = typeof minLength === 'number' && Number.isSafeInteger(minLength) && minLength >= 0 ? minLength : undefined;
  // Form.Item initially supplies `value: undefined`; preserve that controlled
  // contract so the native input never flips modes when form data arrives.
  const isControlled = Object.prototype.hasOwnProperty.call(props, 'value');
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
          value={resolvedValue}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          readOnly={readOnly}
          autoComplete={autoComplete}
          inputMode={inputMode}
          pattern={pattern}
          maxLength={normalizedMaxLength}
          minLength={normalizedMinLength}
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
            aria-label={clearLabel}
            title={clearLabel}
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
      {showCount && normalizedMaxLength !== undefined ? (
        <div className="shop-input__count" aria-hidden="true">
          {currentLength}/{normalizedMaxLength}
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
  const { t } = useLanguage();
  const showPasswordLabel = t('pages.auth.showPassword', { defaultValue: 'Show password' });
  const hidePasswordLabel = t('pages.auth.hidePassword', { defaultValue: 'Hide password' });
  const visibilityActionLabel = typeof rest['aria-label'] === 'string'
    ? `${rest['aria-label']}: ${visible ? hidePasswordLabel : showPasswordLabel}`
    : (visible ? hidePasswordLabel : showPasswordLabel);
  const toggle = visibilityToggle ? (
    <button
      type="button"
      className="shop-input__visibility"
      aria-label={visibilityActionLabel}
      aria-pressed={visible}
      title={visibilityActionLabel}
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
  allowClear?: boolean;
  clearLabel?: string;
  autoSize?: boolean | { minRows?: number; maxRows?: number };
  spellCheck?: boolean;
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'true' | 'false' | 'grammar' | 'spelling';
  'aria-required'?: boolean | 'true' | 'false';
  title?: string;
  status?: 'error' | 'warning' | '';
};

export const ShopTextArea = forwardRef<HTMLTextAreaElement, ShopTextAreaProps>((props, ref) => {
  const {
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
  allowClear = false,
  clearLabel = 'Clear',
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
  } = props;
  const generatedId = useId();
  const inputId = id || generatedId;
  const normalizedMaxLength = typeof maxLength === 'number' && Number.isSafeInteger(maxLength) && maxLength >= 0 ? maxLength : undefined;
  const normalizedMinLength = typeof minLength === 'number' && Number.isSafeInteger(minLength) && minLength >= 0 ? minLength : undefined;
  const isControlled = Object.prototype.hasOwnProperty.call(props, 'value');
  const baseRows = normalizeRows(rows, 3);
  const minRows = typeof autoSize === 'object' ? normalizeRows(autoSize.minRows, baseRows) : (typeof autoSize === 'boolean' && autoSize ? 2 : baseRows);
  const requestedMaxRows = typeof autoSize === 'object' ? normalizeRows(autoSize.maxRows, minRows) : undefined;
  const maxRows = requestedMaxRows !== undefined ? Math.max(minRows, requestedMaxRows) : undefined;
  const resolvedRows = minRows;
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? '');
  const resolved = isControlled ? String(value ?? '') : uncontrolled;
  const currentLength = resolved.length;

  return (
    <div
      className={[
        'shop-input',
        'shop-input--textarea',
        allowClear && !disabled && !readOnly && Boolean(resolved) ? 'shop-input--withSuffix' : '',
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
          value={resolved}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          autoComplete={autoComplete}
          spellCheck={spellCheck}
          rows={resolvedRows}
          maxLength={normalizedMaxLength}
          minLength={normalizedMinLength}
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
        {allowClear && !disabled && !readOnly && Boolean(resolved) ? (
          <button
            type="button"
            className="shop-input__clear"
            aria-label={clearLabel}
            title={clearLabel}
            onClick={(event) => {
              event.preventDefault();
              if (!isControlled) setUncontrolled('');
              if (!onChange) return;
              const target = { value: '' } as HTMLTextAreaElement;
              onChange({ target, currentTarget: target } as React.ChangeEvent<HTMLTextAreaElement>);
            }}
          >
            ×
          </button>
        ) : null}
      </div>
      {showCount && normalizedMaxLength !== undefined ? (
        <div className="shop-input__count" aria-hidden="true">
          {currentLength}/{normalizedMaxLength}
        </div>
      ) : null}
    </div>
  );
});

ShopTextArea.displayName = 'ShopTextArea';

export default ShopInput;
