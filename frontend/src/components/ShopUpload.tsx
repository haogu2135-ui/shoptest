import React, { useId, useRef } from 'react';
import './ShopUpload.css';

/** Drop-in stand-in for ant Upload.LIST_IGNORE — skip file-list mutation. */
export const SHOP_UPLOAD_LIST_IGNORE = false as const;

export type ShopUploadBeforeUploadResult =
  | boolean
  | typeof SHOP_UPLOAD_LIST_IGNORE
  | void
  | Promise<boolean | typeof SHOP_UPLOAD_LIST_IGNORE | void>;

export type ShopUploadProps = {
  accept?: string;
  disabled?: boolean;
  multiple?: boolean;
  className?: string;
  /** Always false for ShopUpload; accepted for ant Upload API compatibility. */
  showUploadList?: boolean;
  beforeUpload?: (file: File) => ShopUploadBeforeUploadResult;
  children?: React.ReactNode;
  ariaLabel?: string;
  'aria-label'?: string;
  title?: string;
  id?: string;
  name?: string;
};

type ShopUploadComponent = React.FC<ShopUploadProps> & {
  LIST_IGNORE: typeof SHOP_UPLOAD_LIST_IGNORE;
};

const ShopUpload: ShopUploadComponent = ({
  accept,
  disabled = false,
  multiple = false,
  className = '',
  beforeUpload,
  children,
  ariaLabel,
  'aria-label': ariaLabelAttr,
  title,
  id,
  name,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const autoId = useId();
  const inputId = id || `shop-upload-${autoId}`;
  const label = ariaLabel || ariaLabelAttr || title;

  const openPicker = () => {
    if (disabled) return;
    const input = inputRef.current;
    if (!input) return;
    input.value = '';
    input.click();
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (disabled || !fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    for (const file of files) {
      if (beforeUpload) {
        try {
          await beforeUpload(file);
        } catch {
          // Handlers report their own errors.
        }
      }
      if (!multiple) break;
    }
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return (
    <span
      className={[
        'shop-upload',
        'ant-upload-wrapper',
        'ant-upload',
        'ant-upload-select',
        disabled ? 'shop-upload--disabled ant-upload-disabled' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <input
        ref={inputRef}
        id={inputId}
        name={name}
        type="file"
        className="shop-upload__input"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden={true}
        onChange={(event) => {
          void handleFiles(event.target.files);
        }}
      />
      <span
        className="shop-upload__trigger"
        onClick={(event) => {
          // Avoid double-handling if an inner control already stopped.
          if (disabled) {
            event.preventDefault();
            return;
          }
          openPicker();
        }}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === 'Enter' || event.key === ' ') {
            // Only handle when the wrapper itself is focused (no inner button).
            if (event.target === event.currentTarget) {
              event.preventDefault();
              openPicker();
            }
          }
        }}
      >
        {children}
      </span>
    </span>
  );
};

ShopUpload.LIST_IGNORE = SHOP_UPLOAD_LIST_IGNORE;

export default ShopUpload;
