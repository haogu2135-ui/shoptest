import React, { cloneElement, isValidElement, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ShopButton from './ShopButton';
import { activateFocusTrap } from '../utils/focusTrap';
import { reportNonBlockingError } from '../utils/nonBlockingError';

export type ShopPopconfirmButtonProps = {
  disabled?: boolean;
  loading?: boolean;
  'aria-label'?: string;
  title?: string;
};

type ShopPopconfirmTriggerProps = {
  disabled?: boolean;
  onClick?: (event: React.MouseEvent) => void;
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
  children: React.ReactElement<ShopPopconfirmTriggerProps>;
  rootClassName?: string;
  className?: string;
  okDanger?: boolean;
  dismissLabel?: string;
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
  dismissLabel = 'Dismiss',
}) => {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const confirmingRef = useRef(false);
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);

  const close = () => {
    if (confirmingRef.current) return;
    setOpen(false);
  };

  useEffect(() => {
    if (!open) {
      confirmingRef.current = false;
      setConfirming(false);
      return;
    }
    return activateFocusTrap({
      getPanel: () => panelRef.current,
      getInitialFocus: () => panelRef.current?.querySelector<HTMLButtonElement>('.shop-button') || null,
      onEscape: close,
      escapeEnabled: true,
      initialFocusDelayMs: 0,
      lockBodyScroll: false,
    });
  }, [open]);

  const confirm = async () => {
    if (confirming) return;
    try {
      const result = onConfirm?.();
      if (!result || typeof (result as Promise<void>).then !== 'function') {
        setOpen(false);
        return;
      }
      confirmingRef.current = true;
      setConfirming(true);
      await result;
      setOpen(false);
    } catch (error) {
      reportNonBlockingError('ShopPopconfirm.onConfirm', error);
    } finally {
      confirmingRef.current = false;
      setConfirming(false);
    }
  };

  const trigger = isValidElement(children)
    ? cloneElement(children, {
        onClick: (event: React.MouseEvent) => {
          const childProps = children.props;
          childProps.onClick?.(event);
          if (disabled || childProps.disabled || event.defaultPrevented) return;
          setOpen(true);
        },
      })
    : children;

  const panel = open && typeof document !== 'undefined'
    ? createPortal(
        <div className={`shop-popconfirm ant-popconfirm ${rootClassName}`.trim()} role="presentation">
          <button
            type="button"
            className="shop-popconfirm__mask"
            aria-label={dismissLabel}
            title={dismissLabel}
            onClick={close}
          />
          <div
            className={`shop-popconfirm__panel ant-popconfirm-inner-content ${className}`.trim()}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            ref={panelRef}
            tabIndex={-1}
          >
            <div className="shop-popconfirm__title" id={titleId}>{title}</div>
            {description ? <div className="shop-popconfirm__description" id={descriptionId}>{description}</div> : null}
            <div className="shop-popconfirm__actions ant-popconfirm-buttons">
              <ShopButton
                onClick={close}
                disabled={cancelButtonProps?.disabled}
                aria-label={cancelButtonProps?.['aria-label'] || (typeof cancelText === 'string' ? cancelText : undefined)}
                title={cancelButtonProps?.title || (typeof cancelText === 'string' ? cancelText : undefined)}
              >
                {cancelText}
              </ShopButton>
              <ShopButton
                type="primary"
                danger={okDanger || okButtonProps?.danger}
                disabled={okButtonProps?.disabled || confirming}
                loading={okButtonProps?.loading || confirming}
                aria-label={okButtonProps?.['aria-label'] || (typeof okText === 'string' ? okText : undefined)}
                title={okButtonProps?.title || (typeof okText === 'string' ? okText : undefined)}
                onClick={() => { void confirm(); }}
              >
                {okText}
              </ShopButton>
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
