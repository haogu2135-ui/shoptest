import React, { createContext, useContext, useId, useMemo, useState } from 'react';
import './ShopCheckbox.css';

export type ShopCheckboxChangeEvent = {
  target: {
    checked: boolean;
    type: 'checkbox';
    value?: string;
  };
};

export type ShopCheckboxProps = {
  checked?: boolean;
  defaultChecked?: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  value?: string;
  // Method syntax keeps callbacks bivariant under strictFunctionTypes.
  onChange?(event: ShopCheckboxChangeEvent): void;
  className?: string;
  children?: React.ReactNode;
  id?: string;
  ariaLabel?: string;
  'aria-label'?: string;
  title?: string;
};

export type ShopCheckboxOption = {
  label: React.ReactNode;
  value: string;
  disabled?: boolean;
  className?: string;
};

export type ShopCheckboxGroupProps = {
  value?: string[];
  defaultValue?: string[];
  // Method syntax keeps callbacks bivariant under strictFunctionTypes.
  onChange?(checkedValue: string[]): void;
  options?: Array<string | ShopCheckboxOption>;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
  'aria-label'?: string;
  title?: string;
};

type GroupContextValue = {
  value: string[];
  disabled: boolean;
  toggle: (optionValue: string, nextChecked: boolean) => void;
};

const ShopCheckboxGroupContext = createContext<GroupContextValue | null>(null);

const normalizeOptions = (options?: Array<string | ShopCheckboxOption>): ShopCheckboxOption[] => {
  if (!options?.length) return [];
  return options.map((option) => {
    if (typeof option === 'string') {
      return { label: option, value: option };
    }
    return option;
  });
};

export const ShopCheckbox: React.FC<ShopCheckboxProps> = ({
  checked,
  defaultChecked = false,
  indeterminate = false,
  disabled = false,
  value,
  onChange,
  className = '',
  children,
  id,
  ariaLabel,
  'aria-label': ariaLabelAttr,
  title,
}) => {
  const generatedId = useId();
  const group = useContext(ShopCheckboxGroupContext);
  const isGrouped = Boolean(group && value !== undefined);
  const isControlled = typeof checked === 'boolean' || isGrouped;
  const [uncontrolledChecked, setUncontrolledChecked] = useState(Boolean(defaultChecked));
  const resolvedChecked = isGrouped
    ? Boolean(value !== undefined && group?.value.includes(String(value)))
    : (typeof checked === 'boolean' ? checked : uncontrolledChecked);
  const isDisabled = disabled || Boolean(group?.disabled);
  const inputId = id || generatedId;
  const label = ariaLabel || ariaLabelAttr || title;

  const emitChange = (nextChecked: boolean) => {
    if (isDisabled) return;
    if (isGrouped && value !== undefined) {
      group?.toggle(String(value), nextChecked);
      return;
    }
    if (!isControlled) setUncontrolledChecked(nextChecked);
    onChange?.({ target: { checked: nextChecked, type: 'checkbox', value } });
  };

  return (
    <label
      className={[
        'shop-checkbox',
        'ant-checkbox-wrapper',
        resolvedChecked ? 'shop-checkbox--checked ant-checkbox-wrapper-checked' : '',
        indeterminate && !resolvedChecked ? 'shop-checkbox--indeterminate' : '',
        isDisabled ? 'shop-checkbox--disabled ant-checkbox-wrapper-disabled' : '',
        className,
      ].filter(Boolean).join(' ')}
      title={title || label}
    >
      <span
        className={[
          'shop-checkbox__box',
          'ant-checkbox',
          resolvedChecked ? 'ant-checkbox-checked' : '',
          indeterminate && !resolvedChecked ? 'ant-checkbox-indeterminate' : '',
          isDisabled ? 'ant-checkbox-disabled' : '',
        ].filter(Boolean).join(' ')}
      >
        <input
          id={inputId}
          type="checkbox"
          className="shop-checkbox__input ant-checkbox-input"
          checked={resolvedChecked}
          disabled={isDisabled}
          aria-label={label}
          aria-checked={indeterminate && !resolvedChecked ? 'mixed' : resolvedChecked}
          onChange={(event) => emitChange(event.target.checked)}
        />
        <span className="shop-checkbox__inner ant-checkbox-inner" aria-hidden="true" />
      </span>
      {children != null ? <span className="shop-checkbox__label">{children}</span> : null}
    </label>
  );
};

export const ShopCheckboxGroup: React.FC<ShopCheckboxGroupProps> = ({
  value,
  defaultValue = [],
  onChange,
  options,
  children,
  className = '',
  disabled = false,
  ariaLabel,
  'aria-label': ariaLabelAttr,
  title,
}) => {
  const isControlled = Array.isArray(value);
  const groupLabel = ariaLabel || ariaLabelAttr;
  const [uncontrolledValue, setUncontrolledValue] = useState<string[]>(defaultValue.map(String));
  const resolvedValue = (isControlled ? value || [] : uncontrolledValue).map(String);
  const normalizedOptions = useMemo(() => normalizeOptions(options), [options]);

  const toggle = (optionValue: string, nextChecked: boolean) => {
    if (disabled) return;
    const set = new Set(resolvedValue);
    if (nextChecked) set.add(optionValue);
    else set.delete(optionValue);
    const next = Array.from(set);
    if (!isControlled) setUncontrolledValue(next);
    onChange?.(next);
  };

  const contextValue = useMemo<GroupContextValue>(() => ({
    value: resolvedValue,
    disabled,
    toggle,
  }), [disabled, resolvedValue]);

  return (
    <ShopCheckboxGroupContext.Provider value={contextValue}>
      <div
        className={`shop-checkbox-group ant-checkbox-group ${className}`.trim()}
        role="group"
        aria-label={groupLabel}
        title={title || groupLabel}
      >
        {normalizedOptions.length > 0
          ? normalizedOptions.map((option) => (
              <ShopCheckbox
                key={option.value}
                value={option.value}
                disabled={option.disabled || disabled}
                className={option.className}
                ariaLabel={typeof option.label === 'string' ? option.label : option.value}
              >
                {option.label}
              </ShopCheckbox>
            ))
          : children}
      </div>
    </ShopCheckboxGroupContext.Provider>
  );
};

export default ShopCheckbox;
