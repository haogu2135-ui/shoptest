import React, { useEffect } from 'react';
import ShopButton from './ShopButton';
import { ShopIcon, SI } from './ShopIcon';
import './ShopModal.css';

export type ShopModalButtonProps = {
  disabled?: boolean;
  loading?: boolean;
  danger?: boolean;
  'aria-label'?: string;
  title?: string;
};

export type ShopModalProps = {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  footer?: React.ReactNode | null;
  onOk?: () => void | Promise<void>;
  okText?: React.ReactNode;
  cancelText?: React.ReactNode;
  okButtonProps?: ShopModalButtonProps;
  cancelButtonProps?: ShopModalButtonProps;
  width?: string | number;
  rootClassName?: string;
  className?: string;
  children?: React.ReactNode;
  ariaLabel?: string;
  closeLabel?: string;
  maskClosable?: boolean;
  closable?: boolean;
  confirmLoading?: boolean;
};

const toCssSize = (value?: string | number) => {
  if (value == null) return undefined;
  return typeof value === 'number' ? `${value}px` : value;
};

const ShopModal: React.FC<ShopModalProps> = ({
  open,
  onClose,
  title,
  footer,
  onOk,
  okText = 'OK',
  cancelText = 'Cancel',
  okButtonProps,
  cancelButtonProps,
  width,
  rootClassName = '',
  className = '',
  children,
  ariaLabel,
  closeLabel = 'Close',
  maskClosable = true,
  closable = true,
  confirmLoading = false,
}) => {
  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;
    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && (closable || maskClosable)) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose, closable, maskClosable]);

  if (!open) return null;

  const defaultFooter = (
    <>
      <ShopButton
        onClick={onClose}
        disabled={cancelButtonProps?.disabled}
        aria-label={cancelButtonProps?.['aria-label'] || (typeof cancelText === 'string' ? cancelText : closeLabel)}
        title={cancelButtonProps?.title || (typeof cancelText === 'string' ? cancelText : closeLabel)}
      >
        {cancelText}
      </ShopButton>
      <ShopButton
        type="primary"
        danger={okButtonProps?.danger}
        onClick={() => {
          void onOk?.();
        }}
        disabled={okButtonProps?.disabled}
        loading={okButtonProps?.loading || confirmLoading}
        aria-label={okButtonProps?.['aria-label'] || (typeof okText === 'string' ? okText : undefined)}
        title={okButtonProps?.title || (typeof okText === 'string' ? okText : undefined)}
      >
        {okText}
      </ShopButton>
    </>
  );

  const resolvedFooter = footer === null ? null : footer ?? (onOk ? defaultFooter : null);
  const panelStyle: React.CSSProperties = {};
  if (width != null) panelStyle.width = toCssSize(width);

  return (
    <div className={`shop-modal shop-modal--open ${rootClassName}`.trim()} role="presentation">
      {maskClosable ? (
        <button
          type="button"
          className="shop-modal__mask"
          aria-label={closeLabel}
          title={closeLabel}
          onClick={onClose}
        />
      ) : (
        <div className="shop-modal__mask" aria-hidden="true" />
      )}
      <div className="shop-modal__wrap">
        <div
          className={`shop-modal__panel ${className}`.trim()}
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel || (typeof title === 'string' ? title : closeLabel)}
          style={panelStyle}
        >
          <div className="shop-modal__content">
            {closable ? (
              <button
                type="button"
                className="shop-modal__close"
                aria-label={closeLabel}
                title={closeLabel}
                onClick={onClose}
              >
                <ShopIcon path={SI.close} />
              </button>
            ) : null}
            {title ? (
              <div className="shop-modal__header">
                <div className="shop-modal__title">{title}</div>
              </div>
            ) : null}
            <div className="shop-modal__body">{children}</div>
            {resolvedFooter != null ? <div className="shop-modal__footer">{resolvedFooter}</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShopModal;
