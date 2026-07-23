import React, { useEffect, useId, useRef } from 'react';
import ShopButton from './ShopButton';
import { ShopIcon, SI } from './ShopIcon';
import { activateFocusTrap } from '../utils/focusTrap';
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
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const hasTitle = Boolean(title);
  const labelledBy = !ariaLabel && hasTitle ? titleId : undefined;
  const resolvedAriaLabel = ariaLabel
    || (!hasTitle ? closeLabel : (typeof title === 'string' ? title : undefined));

  useEffect(() => {
    if (!open) return undefined;
    return activateFocusTrap({
      getPanel: () => panelRef.current,
      getInitialFocus: () => (
        closeRef.current
        || panelRef.current?.querySelector<HTMLElement>('[data-shop-modal-initial-focus="true"]')
        || null
      ),
      onEscape: (closable || maskClosable) ? onClose : undefined,
      escapeEnabled: closable || maskClosable,
      excludeClassNames: ['shop-modal__mask'],
      initialFocusDelayMs: 0,
    });
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
          tabIndex={-1}
          onClick={onClose}
        />
      ) : (
        <div className="shop-modal__mask" aria-hidden="true" />
      )}
      <div className="shop-modal__wrap">
        <div
          ref={panelRef}
          className={`shop-modal__panel ${className}`.trim()}
          role="dialog"
          aria-modal="true"
          aria-label={labelledBy ? undefined : resolvedAriaLabel}
          aria-labelledby={labelledBy}
          tabIndex={-1}
          style={panelStyle}
        >
          <div className="shop-modal__content">
            {closable ? (
              <button
                ref={closeRef}
                type="button"
                className="shop-modal__close"
                aria-label={closeLabel}
                title={closeLabel}
                data-shop-modal-initial-focus="true"
                onClick={onClose}
              >
                <ShopIcon path={SI.close} />
              </button>
            ) : null}
            {title ? (
              <div className="shop-modal__header">
                <div className="shop-modal__title" id={titleId}>{title}</div>
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
