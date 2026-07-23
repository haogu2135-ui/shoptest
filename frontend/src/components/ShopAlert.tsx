import React from 'react';
import './ShopAlert.css';

export type ShopAlertType = 'success' | 'info' | 'warning' | 'error';

export type ShopAlertProps = {
  type?: ShopAlertType;
  message?: React.ReactNode;
  description?: React.ReactNode;
  showIcon?: boolean;
  icon?: React.ReactNode;
  closable?: boolean;
  onClose?: (event?: React.MouseEvent<HTMLButtonElement>) => void;
  action?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  banner?: boolean;
  role?: React.AriaRole;
  'aria-live'?: React.AriaAttributes['aria-live'];
  'aria-label'?: string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'role' | 'title' | 'color'>;

const TYPE_ICON: Record<ShopAlertType, string> = {
  success: '✓',
  info: 'i',
  warning: '!',
  error: '×',
};

const ShopAlert: React.FC<ShopAlertProps> = ({
  type = 'info',
  message,
  description,
  showIcon = false,
  icon,
  closable = false,
  onClose,
  action,
  className = '',
  style,
  banner = false,
  role,
  'aria-live': ariaLive,
  'aria-label': ariaLabel,
  children,
  ...rest
}) => {
  const [closed, setClosed] = React.useState(false);
  if (closed) return null;

  const resolvedRole = role || (type === 'error' || type === 'warning' ? 'alert' : 'status');
  const resolvedLive = ariaLive || (type === 'error' || type === 'warning' ? 'assertive' : 'polite');
  const showIconSlot = Boolean(showIcon || (icon != null && icon !== false));
  const iconNode = icon != null && icon !== false ? icon : TYPE_ICON[type];

  return (
    <div
      {...rest}
      className={[
        'shop-alert',
        'ant-alert',
        `shop-alert--${type}`,
        `ant-alert-${type}`,
        showIconSlot ? 'ant-alert-with-description shop-alert--withIcon ant-alert-with-icon' : '',
        description ? 'ant-alert-with-description' : '',
        banner ? 'shop-alert--banner ant-alert-banner' : '',
        className,
      ].filter(Boolean).join(' ')}
      style={style}
      role={resolvedRole}
      aria-live={resolvedLive}
      aria-label={ariaLabel || (typeof message === 'string' ? message : undefined)}
    >
      {showIconSlot ? (
        <span className="shop-alert__icon ant-alert-icon" aria-hidden="true">{iconNode}</span>
      ) : null}
      <div className="shop-alert__content ant-alert-content">
        {message != null && message !== false && message !== '' ? (
          <div className="shop-alert__message ant-alert-message">{message}</div>
        ) : null}
        {description != null && description !== false && description !== '' ? (
          <div className="shop-alert__description ant-alert-description">{description}</div>
        ) : null}
        {children != null && children !== false ? children : null}
      </div>
      {action != null && action !== false ? (
        <div className="shop-alert__action ant-alert-action">{action}</div>
      ) : null}
      {closable ? (
        <button
          type="button"
          className="shop-alert__close ant-alert-close-icon"
          aria-label="Close"
          onClick={(event) => {
            setClosed(true);
            onClose?.(event);
          }}
        >
          ×
        </button>
      ) : null}
    </div>
  );
};

export default ShopAlert;
