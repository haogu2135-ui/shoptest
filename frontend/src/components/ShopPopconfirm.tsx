import React, { cloneElement, isValidElement, useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from 'antd';
import './ShopPopconfirm.css';

export type ShopPopconfirmButtonProps = {
  disabled?: boolean;
  'aria-label'?: string;
  title?: string;
};

export type ShopPopconfirmProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  onConfirm?: () => void | Promise<void>;
  okText?: React.ReactNode;
  cancelText?: React.ReactNode;
  okButtonProps?: ShopPopconfirmButtonProps & { danger?: boolean };
  cancelButtonProps?: ShopPopconfirmButtonProps;
  disabled?: boolean;
  children: React.ReactElement;
  rootClassName?: string;
  className?: string;
  okDanger?: boolean;
};

const ShopPopconfirm: React.FC<ShopPopconfirmProps> = ({
  title,
  description,
  onConfirm,
  okText = 'OK',
  cancelText = 'Cancel',
  okButtonProps,
  cancelButtonProps,
  disabled = false,
  children,
  rootClassName = '',
  className = '',
  okDanger = false,
}) => {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const trigger = isValidElement(children)
    ? cloneElement(children as React.ReactElement<any>, {
        onClick: (event: React.MouseEvent) => {
          const childProps = children.props as { onClick?: (e: React.MouseEvent) => void; disabled?: boolean };
          childProps.onClick?.(event);
          if (disabled || childProps.disabled || event.defaultPrevented) return;
          setOpen(true);
        },
      })
    : children;

  const panel = open && typeof document !== 'undefined'
    ? createPortal(
        <div className={`shop-popconfirm ${rootClassName}`.trim()} role="presentation">
          <button
            type="button"
            className="shop-popconfirm__mask"
            aria-label="Dismiss"
            title="Dismiss"
            onClick={() => setOpen(false)}
          />
          <div
            className={`shop-popconfirm__panel ${className}`.trim()}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <div className="shop-popconfirm__title" id={titleId}>{title}</div>
            {description ? <div className="shop-popconfirm__description">{description}</div> : null}
            <div className="shop-popconfirm__actions">
              <Button
                onClick={() => setOpen(false)}
                disabled={cancelButtonProps?.disabled}
                aria-label={cancelButtonProps?.['aria-label'] || (typeof cancelText === 'string' ? cancelText : undefined)}
                title={cancelButtonProps?.title || (typeof cancelText === 'string' ? cancelText : undefined)}
              >
                {cancelText}
              </Button>
              <Button
                type="primary"
                danger={okDanger || okButtonProps?.danger}
                disabled={okButtonProps?.disabled}
                aria-label={okButtonProps?.['aria-label'] || (typeof okText === 'string' ? okText : undefined)}
                title={okButtonProps?.title || (typeof okText === 'string' ? okText : undefined)}
                onClick={() => {
                  setOpen(false);
                  void onConfirm?.();
                }}
              >
                {okText}
              </Button>
            </div>
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      {trigger}
      {panel}
    </>
  );
};

export default ShopPopconfirm;
