import React from 'react';
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
  ...rest
}) => {
  const [broken, setBroken] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const resolvedSrc = broken ? (fallback || '') : (src || fallback || '');

  React.useEffect(() => {
    setBroken(false);
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
            {...rest}
            className="shop-image__img ant-image-img"
            src={resolvedSrc}
            alt={alt}
            title={title}
            width={typeof width === 'number' ? width : undefined}
            height={typeof height === 'number' ? height : undefined}
            loading={loading}
            style={sizeStyle}
            onClick={(event) => {
              onClick?.(event);
              if (canPreview && !event.defaultPrevented) {
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
          className="shop-image-preview ant-image-preview"
          role="dialog"
          aria-modal="true"
          aria-label={alt || title || 'image preview'}
          onClick={() => setPreviewOpen(false)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setPreviewOpen(false);
          }}
        >
          <button type="button" className="shop-image-preview__close" aria-label="Close" onClick={() => setPreviewOpen(false)}>
            ×
          </button>
          <img className="shop-image-preview__img" src={resolvedSrc} alt={alt} />
        </div>
      ) : null}
    </>
  );
};

export default ShopImage;
