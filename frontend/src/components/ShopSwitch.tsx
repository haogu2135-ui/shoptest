import React, { useId, useState } from 'react';
import './ShopSwitch.css';

export type ShopSwitchProps = {
  checked?: boolean;
  defaultChecked?: boolean;
  // Method syntax keeps callbacks bivariant under strictFunctionTypes (boolean setters OK).
  onChange?(checked: boolean): void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  id?: string;
  ariaLabel?: string;
  title?: string;
  checkedChildren?: React.ReactNode;
  unCheckedChildren?: React.ReactNode;
  size?: 'default' | 'small';
};

const ShopSwitch: React.FC<ShopSwitchProps> = ({
  checked,
  defaultChecked = false,
  onChange,
  disabled = false,
  loading = false,
  className = '',
  id,
  ariaLabel,
  title,
  checkedChildren,
  unCheckedChildren,
  size = 'default',
}) => {
  const generatedId = useId();
  const isControlled = typeof checked === 'boolean';
  const [uncontrolledChecked, setUncontrolledChecked] = useState(Boolean(defaultChecked));
  const resolvedChecked = isControlled ? Boolean(checked) : uncontrolledChecked;
  const isDisabled = disabled || loading;
  const labelId = `${id || generatedId}-label`;
  const hasChildren = checkedChildren != null || unCheckedChildren != null;
  const activeChild = resolvedChecked ? checkedChildren : unCheckedChildren;

  const toggle = () => {
    if (isDisabled) return;
    const next = !resolvedChecked;
    if (!isControlled) setUncontrolledChecked(next);
    onChange?.(next);
  };

  return (
    <button
      id={id || generatedId}
      type="button"
      role="switch"
      className={[
        'shop-switch',
        'ant-switch',
        size === 'small' ? 'shop-switch--small ant-switch-small' : 'shop-switch--default',
        resolvedChecked ? 'shop-switch--checked ant-switch-checked' : '',
        isDisabled ? 'shop-switch--disabled ant-switch-disabled' : '',
        loading ? 'shop-switch--loading' : '',
        hasChildren ? 'shop-switch--withText' : '',
        className,
      ].filter(Boolean).join(' ')}
      aria-checked={resolvedChecked}
      aria-busy={loading || undefined}
      aria-label={ariaLabel}
      aria-labelledby={!ariaLabel && hasChildren ? labelId : undefined}
      title={title || ariaLabel}
      disabled={isDisabled}
      onClick={toggle}
    >
      <span className="shop-switch__handle ant-switch-handle" aria-hidden="true" />
      {hasChildren ? (
        <span id={labelId} className="shop-switch__inner ant-switch-inner" aria-hidden={Boolean(ariaLabel) || undefined}>
          <span className="shop-switch__innerText ant-switch-inner-checked">{checkedChildren}</span>
          <span className="shop-switch__innerText ant-switch-inner-unchecked">{unCheckedChildren}</span>
          <span className="shop-switch__activeText">{activeChild}</span>
        </span>
      ) : (
        <span className="shop-switch__inner ant-switch-inner" aria-hidden="true" />
      )}
    </button>
  );
};

export default ShopSwitch;
