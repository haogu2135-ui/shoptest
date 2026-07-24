import React from 'react';

export const ProductDetailSkeleton: React.FC<{ label: string }> = ({ label }) => (
  <div className="product-detail-page product-detail-page--loading">
    <div className="product-detail-shell">
      <div
        className="product-detail-skeleton"
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={label}
        data-testid="product-detail-skeleton"
      >
        <span className="product-detail-skeleton__sr">{label}</span>
        <div className="product-detail-skeleton__breadcrumb" aria-hidden="true">
          <span className="product-detail-skeleton__block product-detail-skeleton__block--crumb" />
          <span className="product-detail-skeleton__block product-detail-skeleton__block--crumb product-detail-skeleton__block--crumbLong" />
          <span className="product-detail-skeleton__block product-detail-skeleton__block--crumb product-detail-skeleton__block--crumbShort" />
        </div>

        <div className="product-detail-skeleton__main">
          <section className="product-detail-skeleton__media" aria-hidden="true" data-testid="product-detail-skeleton-gallery">
            <div className="product-detail-skeleton__imageFrame">
              <span className="product-detail-skeleton__block product-detail-skeleton__block--image" />
            </div>
            <div className="product-detail-skeleton__thumbs">
              {Array.from({ length: 4 }).map((_, index) => (
                <span key={index} className="product-detail-skeleton__block product-detail-skeleton__block--thumb" />
              ))}
            </div>
          </section>

          <section className="product-detail-skeleton__summary" aria-hidden="true" data-testid="product-detail-skeleton-summary">
            <span className="product-detail-skeleton__block product-detail-skeleton__block--brand" />
            <span className="product-detail-skeleton__block product-detail-skeleton__block--title" />
            <span className="product-detail-skeleton__block product-detail-skeleton__block--subtitle" />
            <span className="product-detail-skeleton__block product-detail-skeleton__block--price" />
            <div className="product-detail-skeleton__signals">
              {Array.from({ length: 3 }).map((_, index) => (
                <span key={index} className="product-detail-skeleton__block product-detail-skeleton__block--signal" />
              ))}
            </div>
            <div className="product-detail-skeleton__options">
              {Array.from({ length: 2 }).map((_, index) => (
                <div key={index} className="product-detail-skeleton__optionGroup">
                  <span className="product-detail-skeleton__block product-detail-skeleton__block--optionLabel" />
                  <div className="product-detail-skeleton__optionPills">
                    {Array.from({ length: 3 }).map((__, pillIndex) => (
                      <span key={pillIndex} className="product-detail-skeleton__block product-detail-skeleton__block--pill" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="product-detail-skeleton__actions">
              <span className="product-detail-skeleton__block product-detail-skeleton__block--action" />
              <span className="product-detail-skeleton__block product-detail-skeleton__block--action product-detail-skeleton__block--actionPrimary" />
            </div>
          </section>
        </div>

        <div className="product-detail-skeleton__afterfold" aria-hidden="true" data-testid="product-detail-skeleton-afterfold">
          <div className="product-detail-skeleton__tabs">
            <span className="product-detail-skeleton__block product-detail-skeleton__block--tab" />
            <span className="product-detail-skeleton__block product-detail-skeleton__block--tab" />
            <span className="product-detail-skeleton__block product-detail-skeleton__block--tab" />
          </div>
          <div className="product-detail-skeleton__detailRows">
            <span className="product-detail-skeleton__block product-detail-skeleton__block--detail product-detail-skeleton__block--detailLong" />
            <span className="product-detail-skeleton__block product-detail-skeleton__block--detail" />
            <span className="product-detail-skeleton__block product-detail-skeleton__block--detail product-detail-skeleton__block--detailShort" />
          </div>
          <div className="product-detail-skeleton__recommendations">
            {Array.from({ length: 3 }).map((_, index) => (
              <span key={index} className="product-detail-skeleton__block product-detail-skeleton__block--recommendation" />
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

export const ProductDetailLazyFallback: React.FC<{ label: string; variant: 'rich' | 'review' }> = ({ label, variant }) => (
  <div
    className={`product-detail-lazy-skeleton product-detail-lazy-skeleton--${variant}`}
    role="status"
    aria-live="polite"
    aria-busy="true"
    aria-label={label}
    data-testid={`product-detail-lazy-${variant}-fallback`}
  >
    <span className="product-detail-skeleton__sr">{label}</span>
    {variant === 'rich' ? (
      <>
        <span className="product-detail-skeleton__block product-detail-lazy-skeleton__line product-detail-lazy-skeleton__line--wide" />
        <span className="product-detail-skeleton__block product-detail-lazy-skeleton__line" />
        <span className="product-detail-skeleton__block product-detail-lazy-skeleton__media" />
      </>
    ) : (
      <>
        <span className="product-detail-skeleton__block product-detail-lazy-skeleton__title" />
        <div className="product-detail-lazy-skeleton__composer">
          <span className="product-detail-skeleton__block product-detail-lazy-skeleton__select" />
          <span className="product-detail-skeleton__block product-detail-lazy-skeleton__textarea" />
          <span className="product-detail-skeleton__block product-detail-lazy-skeleton__button" />
        </div>
        <div className="product-detail-lazy-skeleton__reviewRows">
          {Array.from({ length: 2 }).map((_, index) => (
            <div className="product-detail-lazy-skeleton__reviewRow" key={index}>
              <span className="product-detail-skeleton__block product-detail-lazy-skeleton__avatar" />
              <span className="product-detail-skeleton__block product-detail-lazy-skeleton__line" />
            </div>
          ))}
        </div>
      </>
    )}
  </div>
);
