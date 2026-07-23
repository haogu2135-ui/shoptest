import React, { useState } from 'react';
import './ShopAvatar.css';

export type ShopAvatarProps = {
  size?: number | 'large' | 'small' | 'default';
  shape?: 'circle' | 'square';
  src?: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  alt?: string;
};

const resolveSize = (size: ShopAvatarProps['size']): number => {
  if (typeof size === 'number' && Number.isFinite(size) && size > 0) return size;
  if (size === 'large') return 40;
  if (size === 'small') return 24;
  return 32;
};

const ShopAvatar: React.FC<ShopAvatarProps> = ({
  size = 'default',
  shape = 'circle',
  src,
  icon,
  children,
  className = '',
  style,
  alt,
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const px = resolveSize(size);
  const showImage = Boolean(src) && !imgFailed;

  return (
    <span
      className={[
        'shop-avatar',
        'ant-avatar',
        shape === 'square' ? 'shop-avatar--square ant-avatar-square' : 'shop-avatar--circle ant-avatar-circle',
        showImage ? 'ant-avatar-image' : '',
        className,
      ].filter(Boolean).join(' ')}
      style={{ width: px, height: px, lineHeight: `${px}px`, fontSize: Math.max(12, Math.round(px * 0.42)), ...style }}
    >
      {showImage ? (
        <img
          className="shop-avatar__img"
          src={src}
          alt={alt || ''}
          onError={() => setImgFailed(true)}
        />
      ) : icon != null && icon !== false ? (
        <span className="shop-avatar__icon ant-avatar-icon">{icon}</span>
      ) : children != null && children !== false && children !== '' ? (
        <span className="shop-avatar__string ant-avatar-string">{children}</span>
      ) : (
        <span className="shop-avatar__icon ant-avatar-icon" aria-hidden="true">•</span>
      )}
    </span>
  );
};

export default ShopAvatar;
