import React from 'react';
import ShopModal, { type ShopModalButtonProps } from './ShopModal';
import './ShopConfirm.css';

export type ShopConfirmProps = {
  open: boolean;
  title: React.ReactNode;
  description?: React.ReactNode;
  okText?: React.ReactNode;
  cancelText?: React.ReactNode;
  onOk?: () => void | Promise<void>;
  onCancel: () => void;
  confirmLoading?: boolean;
  okButtonProps?: ShopModalButtonProps & { danger?: boolean };
  cancelButtonProps?: ShopModalButtonProps;
  className?: string;
  rootClassName?: string;
  closeLabel?: string;
  width?: string | number;
};

const ShopConfirm: React.FC<ShopConfirmProps> = ({
  open,
  title,
  description,
  okText = 'OK',
  cancelText = 'Cancel',
  onOk,
  onCancel,
  confirmLoading = false,
  okButtonProps,
  cancelButtonProps,
  className = '',
  rootClassName = '',
  closeLabel = 'Close',
  width = 420,
}) => (
  <ShopModal
    open={open}
    title={title}
    onClose={onCancel}
    onOk={onOk}
    okText={okText}
    cancelText={cancelText}
    confirmLoading={confirmLoading}
    okButtonProps={okButtonProps}
    cancelButtonProps={cancelButtonProps}
    className={`shop-confirm ${className}`.trim()}
    rootClassName={rootClassName}
    closeLabel={closeLabel}
    width={width}
    maskClosable={!confirmLoading}
    closable={!confirmLoading}
  >
    {description ? <div className="shop-confirm__description">{description}</div> : null}
  </ShopModal>
);

export default ShopConfirm;
