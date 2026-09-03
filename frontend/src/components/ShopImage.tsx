import React from 'react';
import { activateFocusTrap } from '../utils/focusTrap';
import { ShopIcon, SI } from './ShopIcon';
import './ShopImage.css';

export type ShopImageProps = {
  src?: string;
  alt?: string;
  fallback?: string;
  width?: number | string;
  height?: number | string;
  preview?: boolean;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
  onClick?: React.MouseEventHandler<HTMLImageElement>;
  onError?: React.ReactEventHandler<HTMLImageElement>;
  loading?: 'eager' | 'lazy';
  previewCloseLabel?: string;
} & Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'width' | 'height' | 'loading' | 'src' | 'alt' | 'title' | 'onClick' | 'onError'>;

const ShopImage: React.FC<ShopImageProps> = ({
  src,
  alt = '',
  fallback,
  width,
  height,
  preview = true,
  className = '',
  style,
  title,
  onClick,
  onError,
  loading = 'lazy',
  previewCloseLabel = 'Close',
  ...rest
}) => {
  const [broken, setBroken] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const previewPanelRef = React.useRef<HTMLDivElement | null>(null);
  const previewCloseRef = React.useRef<HTMLButtonElement | null>(null);
  const resolvedSrc = broken ? (fallback || '') : (src || fallback || '');

  React.useEffect(() => {
    setBroken(false);
    setPreviewOpen(false);
  }, [src, fallback]);

  const sizeStyle: React.CSSProperties = {
    width: width ?? undefined,
    height: height ?? undefined,
    ...style,
  };

  const handleError: React.ReactEventHandler<HTMLImageElement> = (event) => {
    if (!broken && fallback && event.currentTarget.src !== fallback) {
      setBroken(true);
      event.currentTarget.src = fallback;
    }
    onError?.(event);
  };

  const canPreview = preview !== false && Boolean(resolvedSrc);

  React.useEffect(() => {
    if (!previewOpen) return;
    return activateFocusTrap({
      getPanel: () => previewPanelRef.current,
      getInitialFocus: () => previewCloseRef.current,
      onEscape: () => setPreviewOpen(false),
      escapeEnabled: true,
      initialFocusDelayMs: 0,
    });
  }, [previewOpen]);

  const { onKeyDown: restOnKeyDown, ...imageRest } = rest;

  return (
    <>
      <span
        className={[
          'shop-image',
          'ant-image',
          canPreview ? 'shop-image--previewable' : '',
          className,
        ].filter(Boolean).join(' ')}
        style={typeof width === 'string' || typeof height === 'string' ? { display: 'inline-block', width, height } : undefined}
      >
        {resolvedSrc ? (
          <img
            {...imageRest}
            className="shop-image__img ant-image-img"
            src={resolvedSrc}
            alt={alt}
            title={title}
            width={typeof width === 'number' ? width : undefined}
            height={typeof height === 'number' ? height : undefined}
            loading={loading}
            decoding={rest.decoding || 'async'}
            style={sizeStyle}
            role={canPreview ? 'button' : undefined}
            tabIndex={canPreview ? 0 : undefined}
            aria-haspopup={canPreview ? 'dialog' : undefined}
            aria-expanded={canPreview ? previewOpen : undefined}
            onClick={(event) => {
              onClick?.(event);
              if (canPreview && !event.defaultPrevented) {
                setPreviewOpen(true);
              }
            }}
            onKeyDown={(event) => {
              restOnKeyDown?.(event);
              if (event.defaultPrevented || !canPreview) return;
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setPreviewOpen(true);
              }
            }}
            onError={handleError}
          />
        ) : (
          <span className="shop-image__placeholder ant-image-img" style={sizeStyle} title={title || alt} aria-label={alt || title || 'image'}>
            —
          </span>
        )}
      </span>
      {previewOpen && resolvedSrc ? (
        <div
          ref={previewPanelRef}
          className="shop-image-preview ant-image-preview"
          role="dialog"
          aria-modal="true"
          aria-label={alt || title || 'image preview'}
          tabIndex={-1}
          onClick={(event) => {
            if (event.target === event.currentTarget) setPreviewOpen(false);
          }}
        >
          <button ref={previewCloseRef} type="button" className="shop-image-preview__close" aria-label={previewCloseLabel} title={previewCloseLabel} onClick={() => setPreviewOpen(false)}>
            <ShopIcon path={SI.close} />
          </button>
          <img className="shop-image-preview__img" src={resolvedSrc} alt={alt} loading="eager" decoding="async" onClick={(event) => event.stopPropagation()} />
        </div>
      ) : null}
    </>
  );
};

export default ShopImage;
