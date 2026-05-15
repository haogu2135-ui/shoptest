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
              style={{ width: `${60 + Math.random() * 30}%` }}
            />
            <div
              className="skeleton__line skeleton__line--meta shimmer"
              style={{ width: `${35 + Math.random() * 40}%` }}
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
      <div className="skeleton__line shimmer" style={{ width: '40%', height: 18, borderRadius: 999 }} />
      <div className="skeleton__line shimmer" style={{ width: '70%', height: 40, borderRadius: 10 }} />
      <div className="skeleton__line shimmer" style={{ width: '85%', height: 16, borderRadius: 6 }} />
      <div className="hero-skeleton__actions">
        <div className="shimmer" style={{ width: 140, height: 40, borderRadius: 10 }} />
        <div className="shimmer" style={{ width: 120, height: 40, borderRadius: 10 }} />
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
          <div className="shimmer" style={{ width: '90%', height: 14, borderRadius: 4 }} />
          <div className="shimmer" style={{ width: '60%', height: 14, borderRadius: 4 }} />
          <div className="shimmer" style={{ width: '40%', height: 18, borderRadius: 4, marginTop: 8 }} />
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