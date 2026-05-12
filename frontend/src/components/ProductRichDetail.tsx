import React from 'react';
import { Empty, Typography } from 'antd';
import type { ProductDetailBlock } from '../types';
import './ProductRichDetail.css';

const { Paragraph, Text } = Typography;

type ProductRichDetailProps = {
  detailContent?: ProductDetailBlock[] | string | null;
  fallback?: string;
  emptyText?: string;
};

export const isHttpMediaUrl = (value?: string): value is string => {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

export const parseDetailContent = (value?: ProductRichDetailProps['detailContent']): ProductDetailBlock[] => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const isDirectVideo = (value: string) => /\.(mp4|webm|ogg)(\?.*)?$/i.test(value);

export const toEmbeddableVideoUrl = (value: string) => {
  try {
    const url = new URL(value);
    const hostname = url.hostname.replace(/^www\./, '').toLowerCase();
    if (hostname === 'youtube.com' || hostname.endsWith('.youtube.com')) {
      const parts = url.pathname.split('/').filter(Boolean);
      const videoId = url.searchParams.get('v') || (['embed', 'shorts'].includes(parts[0]) ? parts[1] : undefined);
      return videoId ? `https://www.youtube.com/embed/${videoId}` : value;
    }
    if (hostname === 'youtu.be') {
      const videoId = url.pathname.replace('/', '');
      return videoId ? `https://www.youtube.com/embed/${videoId}` : value;
    }
    if (hostname === 'vimeo.com' || hostname.endsWith('.vimeo.com')) {
      const parts = url.pathname.split('/').filter(Boolean);
      const videoId = hostname === 'player.vimeo.com' && parts[0] === 'video' ? parts[1] : parts[0];
      return videoId ? `https://player.vimeo.com/video/${videoId}` : value;
    }
    return value;
  } catch {
    return value;
  }
};

export const canEmbedVideoUrl = (value: string) => {
  const embeddableUrl = toEmbeddableVideoUrl(value);
  return embeddableUrl !== value || isDirectVideo(value);
};

const handleImageZoomMove = (event: React.MouseEvent<HTMLImageElement>) => {
  const rect = event.currentTarget.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;
  event.currentTarget.style.transformOrigin = `${x}% ${y}%`;
};

const handleImageZoomLeave = (event: React.MouseEvent<HTMLImageElement>) => {
  event.currentTarget.style.transformOrigin = 'center center';
};

const ProductRichDetail: React.FC<ProductRichDetailProps> = ({ detailContent, fallback, emptyText = 'No details' }) => {
  const blocks = parseDetailContent(detailContent).filter((block) => {
    if (block.type === 'text') return !!block.content?.trim();
    return isHttpMediaUrl(block.url);
  });

  if (blocks.length === 0) {
    return fallback ? <Paragraph>{fallback}</Paragraph> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />;
  }

  return (
    <div className="product-rich-detail">
      {blocks.map((block, index) => {
        if (block.type === 'text') {
          return (
            <Paragraph key={index} className="product-rich-detail__text">
              {block.content}
            </Paragraph>
          );
        }

        if (block.type === 'image' && isHttpMediaUrl(block.url)) {
          return (
            <figure key={index} className="product-rich-detail__figure">
              <img
                src={block.url}
                alt={block.caption || 'Product detail'}
                loading="lazy"
                onMouseMove={handleImageZoomMove}
                onMouseLeave={handleImageZoomLeave}
              />
              {block.caption ? <figcaption>{block.caption}</figcaption> : null}
            </figure>
          );
        }

        if (block.type === 'video' && isHttpMediaUrl(block.url)) {
          const videoUrl = toEmbeddableVideoUrl(block.url);
          return (
            <figure key={index} className="product-rich-detail__figure">
              {canEmbedVideoUrl(block.url) ? (
                <div className="product-rich-detail__video">
                  {isDirectVideo(videoUrl) ? (
                    <video src={videoUrl} controls preload="metadata" />
                  ) : (
                    <iframe src={videoUrl} title={block.caption || `Product video ${index + 1}`} allowFullScreen />
                  )}
                </div>
              ) : (
                <a className="product-rich-detail__video-link" href={block.url} target="_blank" rel="noopener noreferrer">
                  {block.caption || 'Open product video'}
                </a>
              )}
              {block.caption ? <figcaption>{block.caption}</figcaption> : null}
            </figure>
          );
        }

        return (
          <Text key={index} type="secondary">
            Unsupported detail content
          </Text>
        );
      })}
    </div>
  );
};

export default ProductRichDetail;
