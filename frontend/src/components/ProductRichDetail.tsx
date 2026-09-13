import React from 'react';
import type { ProductDetailBlock } from '../types';
import { useLanguage } from '../i18n';
import { buildResponsiveImageSrcSet, normalizePersistentImageUrl, resolveApiAssetUrl } from '../utils/mediaAssets';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import './ProductRichDetail.css';

type ProductRichDetailProps = {
  detailContent?: ProductDetailBlock[] | string | null;
  fallback?: string;
  emptyText?: string;
  labels?: Partial<ProductRichDetailLabels>;
};

type ProductRichDetailLabels = {
  imageAlt: string;
  videoTitle: (index: number) => string;
  openVideo: string;
  unsupported: string;
};

export const isHttpMediaUrl = (value?: string): value is string => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return false;
  return Boolean(normalizePersistentImageUrl(trimmed));
};

export const resolveRichMediaUrl = (value?: string) => {
  if (!isHttpMediaUrl(value)) return null;
  const trimmed = String(value || '').trim();
  return resolveApiAssetUrl(trimmed);
};

export const parseDetailContent = (value?: ProductRichDetailProps['detailContent']): ProductDetailBlock[] => {
  const normalizeBlocks = (items: unknown[]) => {
    const normalized: ProductDetailBlock[] = [];
    for (const item of items) {
      const block = item as Partial<ProductDetailBlock>;
      if (block?.type === 'text') {
        const content = String(block.content || '').trim();
        if (content) normalized.push({ type: 'text', content });
        continue;
      }
      if (block?.type === 'image' || block?.type === 'video') {
        const url = String(block.url || '').trim();
        if (url) normalized.push({ type: block.type, url, caption: String(block.caption || '').trim() });
      }
    }
    return normalized;
  };
  if (Array.isArray(value)) return normalizeBlocks(value);
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? normalizeBlocks(parsed) : [];
  } catch (error) {
    reportNonBlockingError('ProductRichDetail.parseDetailContent', error);
    return [];
  }
};

export const isDirectVideo = (value: string) => /\.(mp4|webm|ogg)([?#].*)?$/i.test(value);

export const toEmbeddableVideoUrl = (value: string) => {
  try {
    const resolvedValue = resolveRichMediaUrl(value) || value;
    const url = new URL(resolvedValue, window.location.origin);
    const hostname = url.hostname.replace(/^www\./, '').toLowerCase();
    if (hostname === 'youtube.com' || hostname.endsWith('.youtube.com')) {
      const parts = url.pathname.split('/');
      const videoId = url.searchParams.get('v')
        || ((parts[1] === 'embed' || parts[1] === 'shorts') ? parts[2] : undefined);
      return videoId ? `https://www.youtube.com/embed/${videoId}` : value;
    }
    if (hostname === 'youtu.be') {
      const videoId = url.pathname.slice(1);
      return videoId ? `https://www.youtube.com/embed/${videoId}` : value;
    }
    if (hostname === 'vimeo.com' || hostname.endsWith('.vimeo.com')) {
      const parts = url.pathname.split('/');
      const videoId = hostname === 'player.vimeo.com' && parts[1] === 'video' ? parts[2] : parts[1];
      return videoId ? `https://player.vimeo.com/video/${videoId}` : value;
    }
    return resolvedValue;
  } catch (error) {
    reportNonBlockingError('ProductRichDetail.toEmbeddableVideoUrl', error);
    return value;
  }
};

export const canEmbedVideoUrl = (value: string) => {
  const embeddableUrl = toEmbeddableVideoUrl(value);
  return embeddableUrl !== value || isDirectVideo(value);
};

const handleImageZoomMove = (event: React.MouseEvent<HTMLImageElement>) => {
  const rect = event.currentTarget.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;
  event.currentTarget.style.transformOrigin = `${x}% ${y}%`;
};

const handleImageZoomLeave = (event: React.MouseEvent<HTMLImageElement>) => {
  event.currentTarget.style.transformOrigin = 'center center';
};

const handleRichImageError = (event: React.SyntheticEvent<HTMLImageElement>) => {
  event.currentTarget.removeAttribute('srcset');
};

const ProductRichDetail: React.FC<ProductRichDetailProps> = ({
  detailContent,
  fallback,
  emptyText,
  labels,
}) => {
  const { t } = useLanguage();
  const resolvedEmptyText = emptyText ?? t('pages.productDetail.noDetails');
  const resolvedLabels: ProductRichDetailLabels = {
    imageAlt: labels?.imageAlt ?? t('pages.productDetail.richImageAlt'),
    videoTitle: labels?.videoTitle ?? ((index) => t('pages.productDetail.richVideoTitle', { index })),
    openVideo: labels?.openVideo ?? t('pages.productDetail.openRichVideo'),
    unsupported: labels?.unsupported ?? t('pages.productDetail.unsupportedRichContent'),
  };
  const blocks: ProductDetailBlock[] = [];
  for (const block of parseDetailContent(detailContent)) {
    if (block.type === 'text' ? block.content?.trim() : isHttpMediaUrl(block.url)) blocks.push(block);
  }

  if (blocks.length === 0) {
    return fallback ? <p className="product-rich-detail__text">{fallback}</p> : <div className="product-rich-detail__empty" role="status">{resolvedEmptyText}</div>;
  }

  return (
    <div className="product-rich-detail">
      {blocks.map((block, index) => {
        const mediaUrl = resolveRichMediaUrl(block.url);
        if (block.type === 'text') {
          return (
            <p key={index} className="product-rich-detail__text">
              {block.content}
            </p>
          );
        }

        if (block.type === 'image' && mediaUrl) {
          return (
            <figure key={index} className="product-rich-detail__figure">
              <img
                src={mediaUrl}
                srcSet={buildResponsiveImageSrcSet(mediaUrl, [480, 720, 960, 1200, 1600])}
                sizes="min(860px, 100vw)"
                alt={block.caption || resolvedLabels.imageAlt}
                width={1200}
                height={900}
                loading="lazy"
                decoding="async"
                onMouseMove={handleImageZoomMove}
                onMouseLeave={handleImageZoomLeave}
                onError={handleRichImageError}
              />
              {block.caption ? <figcaption>{block.caption}</figcaption> : null}
            </figure>
          );
        }

        if (block.type === 'video' && mediaUrl) {
          const videoUrl = toEmbeddableVideoUrl(mediaUrl);
          return (
            <figure key={index} className="product-rich-detail__figure">
              {canEmbedVideoUrl(mediaUrl) ? (
                <div className="product-rich-detail__video">
                  {isDirectVideo(videoUrl) ? (
                    <video src={videoUrl} controls preload="metadata" aria-label={block.caption || resolvedLabels.videoTitle(index + 1)} />
                  ) : (
                    <iframe
                      src={videoUrl}
                      title={block.caption || resolvedLabels.videoTitle(index + 1)}
                      sandbox="allow-scripts allow-same-origin allow-presentation"
                      referrerPolicy="strict-origin-when-cross-origin"
                      allow="fullscreen; picture-in-picture"
                    />
                  )}
                </div>
              ) : (
                <a className="product-rich-detail__video-link" href={mediaUrl} target="_blank" rel="noopener noreferrer">
                  {block.caption || resolvedLabels.openVideo}
                </a>
              )}
              {block.caption ? <figcaption>{block.caption}</figcaption> : null}
            </figure>
          );
        }

        return (
          <span key={index} className="product-rich-detail__unsupported">
            {resolvedLabels.unsupported}
          </span>
        );
      })}
    </div>
  );
};

export default ProductRichDetail;
