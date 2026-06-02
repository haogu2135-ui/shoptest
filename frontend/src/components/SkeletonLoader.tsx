/**
 * SkeletonLoader — shared animated skeleton component
 * Usage: <SkeletonLoader rows={4} height={120} avatar />
 */
import React from 'react';
import './SkeletonLoader.css';

interface SkeletonLoaderProps {
  rows?: number;
  height?: number | string;
  avatar?: boolean;
  type?: 'card' | 'list' | 'detail';
  className?: string;
}

const titleWidths = [72, 84, 66, 78, 88, 70];
const metaWidths = [42, 58, 36, 64, 48, 54];

const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  rows = 4,
  height,
  avatar = false,
  type = 'card',
  className = '',
}) => {
  const content = (
    <div className={`skeleton skeleton--${type} ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton__row">
          {avatar && <div className="skeleton__avatar shimmer" />}
          <div
            className="skeleton__lines"
            style={{ flex: 1 }}
          >
            <div
              className="skeleton__line skeleton__line--title shimmer"
              style={{ width: `${titleWidths[i % titleWidths.length]}%` }}
            />
            <div
              className="skeleton__line skeleton__line--meta shimmer"
              style={{ width: `${metaWidths[i % metaWidths.length]}%` }}
            />
          </div>
          {height && (
            <div
              className="skeleton__image shimmer"
              style={{ width: typeof height === 'number' ? height : 80, height: typeof height === 'number' ? height : 80 }}
            />
          )}
        </div>
      ))}
    </div>
  );

  return content;
};

/* ── Hero skeleton ── */
export const HeroSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`hero-skeleton ${className}`}>
    <div className="hero-skeleton__left">
      <div className="skeleton__line hero-skeleton__eyebrow shimmer" />
      <div className="skeleton__line hero-skeleton__title shimmer" />
      <div className="skeleton__line hero-skeleton__text shimmer" />
      <div className="hero-skeleton__actions">
        <div className="hero-skeleton__action shimmer" />
        <div className="hero-skeleton__action hero-skeleton__action--secondary shimmer" />
      </div>
    </div>
    <div className="hero-skeleton__right">
      <div className="shimmer" style={{ width: '100%', height: '100%', borderRadius: 18 }} />
    </div>
  </div>
);

/* ── Product card skeleton ── */
export const ProductCardSkeleton: React.FC<{ count?: number }> = ({ count = 8 }) => (
  <div className="product-skeleton">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="product-skeleton__card">
        <div className="shimmer product-skeleton__image" />
        <div className="product-skeleton__body">
          <div className="product-skeleton__line product-skeleton__line--title shimmer" />
          <div className="product-skeleton__line product-skeleton__line--meta shimmer" />
          <div className="product-skeleton__line product-skeleton__line--price shimmer" />
        </div>
      </div>
    ))}
  </div>
);

/* ── Stats strip skeleton ── */
export const StatsStripSkeleton: React.FC<{ cols?: number }> = ({ cols = 3 }) => (
  <div className="stats-strip-skeleton">
    {Array.from({ length: cols }).map((_, i) => (
      <div key={i} className="shimmer" style={{ height: 92, borderRadius: 16 }} />
    ))}
  </div>
);

export default SkeletonLoader;
