import React from 'react';
import './ShopButton.css';

export type ShopButtonType = 'primary' | 'default' | 'dashed' | 'link' | 'text';
export type ShopButtonSize = 'small' | 'middle' | 'large';
export type ShopButtonHtmlType = 'button' | 'submit' | 'reset';
export type ShopButtonShape = 'default' | 'circle' | 'round';

export type ShopButtonProps = {
  type?: ShopButtonType;
  htmlType?: ShopButtonHtmlType;
  size?: ShopButtonSize;
  shape?: ShopButtonShape;
  danger?: boolean;
  ghost?: boolean;
  loading?: boolean;
  disabled?: boolean;
  block?: boolean;
  icon?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  id?: string;
  title?: string;
  ariaLabel?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-controls'?: string;
  'aria-expanded'?: boolean | 'true' | 'false';
  'aria-haspopup'?: boolean | 'true' | 'false' | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog';
  'aria-pressed'?: boolean | 'true' | 'false' | 'mixed';
  role?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLButtonElement>;
  onKeyUp?: React.KeyboardEventHandler<HTMLButtonElement>;
  onMouseEnter?: React.MouseEventHandler<HTMLButtonElement>;
  onMouseLeave?: React.MouseEventHandler<HTMLButtonElement>;
  onMouseDown?: React.MouseEventHandler<HTMLButtonElement>;
  onMouseUp?: React.MouseEventHandler<HTMLButtonElement>;
  onFocus?: React.FocusEventHandler<HTMLButtonElement>;
  onBlur?: React.FocusEventHandler<HTMLButtonElement>;
  form?: string;
  name?: string;
  value?: string;
  autoFocus?: boolean;
  tabIndex?: number;
  'data-testid'?: string;
};

const ShopButton: React.FC<ShopButtonProps> = ({
  type = 'default',
  htmlType = 'button',
  size = 'middle',
  shape = 'default',
  danger = false,
  ghost = false,
  loading = false,
  disabled = false,
  block = false,
  icon,
  className = '',
  style,
  children,
  id,
  title,
  ariaLabel,
  'aria-label': ariaLabelAttr,
  'aria-describedby': ariaDescribedBy,
  'aria-controls': ariaControls,
  'aria-expanded': ariaExpanded,
  'aria-haspopup': ariaHasPopup,
  'aria-pressed': ariaPressed,
  role,
  onClick,
  onKeyDown,
  onKeyUp,
  onMouseEnter,
  onMouseLeave,
  onMouseDown,
  onMouseUp,
  onFocus,
  onBlur,
  form,
  name,
  value,
  autoFocus,
  tabIndex,
  'data-testid': dataTestId,
}) => {
  const isDisabled = disabled || loading;
  const label = ariaLabel || ariaLabelAttr;
  const hasIconOnly = Boolean(icon) && (children == null || children === false || children === '');
  const antTypeClass =
    type === 'primary'
      ? 'ant-btn-primary'
      : type === 'dashed'
        ? 'ant-btn-dashed'
        : type === 'link'
          ? 'ant-btn-link'
          : type === 'text'
            ? 'ant-btn-text'
            : 'ant-btn-default';
  const antSizeClass =
    size === 'small' ? 'ant-btn-sm' : size === 'large' ? 'ant-btn-lg' : '';
  const antShapeClass =
    shape === 'circle' ? 'ant-btn-circle' : shape === 'round' ? 'ant-btn-round' : '';

  return (
    <button
      id={id}
      type={htmlType}
      form={form}
      name={name}
      value={value}
      autoFocus={autoFocus}
      tabIndex={tabIndex}
      role={role}
      data-testid={dataTestId}
      style={style}
      className={[
        'shop-button',
        'ant-btn',
        antTypeClass,
        antSizeClass,
        antShapeClass,
        size === 'small' ? 'shop-button--small' : '',
        size === 'large' ? 'shop-button--large' : '',
        type === 'primary' ? 'shop-button--primary' : '',
        type === 'dashed' ? 'shop-button--dashed' : '',
        type === 'link' ? 'shop-button--link' : '',
        type === 'text' ? 'shop-button--text' : '',
        type === 'default' ? 'shop-button--default' : '',
        shape === 'circle' ? 'shop-button--circle' : '',
        shape === 'round' ? 'shop-button--round' : '',
        danger ? 'shop-button--danger ant-btn-dangerous' : '',
        ghost ? 'shop-button--ghost ant-btn-background-ghost' : '',
        loading ? 'shop-button--loading ant-btn-loading' : '',
        block ? 'shop-button--block ant-btn-block' : '',
        hasIconOnly ? 'shop-button--iconOnly ant-btn-icon-only' : '',
        isDisabled ? 'shop-button--disabled' : '',
        className,
      ].filter(Boolean).join(' ')}
      disabled={isDisabled}
      aria-label={label}
      title={title || label}
      aria-busy={loading || undefined}
      aria-describedby={ariaDescribedBy}
      aria-controls={ariaControls}
      aria-expanded={ariaExpanded}
      aria-haspopup={ariaHasPopup}
      aria-pressed={ariaPressed}
      onClick={(event) => {
        if (isDisabled) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      {loading ? <span className="shop-button__spinner ant-btn-loading-icon" aria-hidden="true" /> : null}
      {icon ? <span className="shop-button__icon ant-btn-icon">{icon}</span> : null}
      {children != null && children !== false && children !== '' ? (
        <span className="shop-button__label">{children}</span>
      ) : null}
    </button>
  );
};

export default ShopButton;
