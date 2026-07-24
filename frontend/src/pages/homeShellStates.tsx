import React from 'react';
import type { NavigateFunction } from 'react-router-dom';
import PageError from '../components/PageError';
import { HeroSkeleton, ProductCardSkeleton, StatsStripSkeleton } from '../components/SkeletonLoader';
import { dispatchDomEvent } from '../utils/domEvents';

type HomeTranslate = (key: string, params?: Record<string, string | number>) => string;

/** Accessible commercial home loading skeleton. */
export const HomeLoadingShell: React.FC<{
  homeLanguageClass: string;
  t: HomeTranslate;
}> = ({ homeLanguageClass, t }) => (
  <main className={`${homeLanguageClass} shopee-home--loading`} aria-busy="true" data-home-loading-shell="true">
    <div role="status" aria-live="polite" aria-busy="true" aria-label={t('common.loading')}>
      <section className="shopee-hero">
        <div className="shopee-container shopee-hero__grid">
          <HeroSkeleton />
          <div className="shopee-hero__aside" aria-hidden="true">
            {[1, 2, 3].map((i) => (
              <div key={i} className="shopee-hero__asideSkeleton shimmer" />
            ))}
          </div>
        </div>
      </section>
      <div className="shopee-container shopee-mobile-priority" aria-hidden="true">
        <section className="shopee-mobile-quick-panel shopee-mobile-quick-panel--skeleton">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <span key={i} className="shopee-mobile-quick-panel__skeletonCell shimmer" />
          ))}
        </section>
      </div>
      <div className="shopee-container">
        <section className="pet-trust-strip pet-trust-strip--skeleton" aria-hidden="true">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="shimmer" />
          ))}
        </section>
        <StatsStripSkeleton />
        <section className="shopee-section shopee-categories-section shopee-categories-section--skeleton" aria-hidden="true">
          <div className="shopee-section__header">
            <span className="shimmer shopee-categories-section__titleSkeleton" aria-hidden="true" />
          </div>
          <div className="shopee-categories shopee-categories--skeleton">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <span key={i} className="shopee-categories__skeletonTile shimmer" />
            ))}
          </div>
        </section>
        <div className="shopee-loading-products">
          <ProductCardSkeleton count={8} />
        </div>
      </div>
    </div>
  </main>
);

/** Multi-path home load-recovery shell for commercial resilience. */
export const HomeLoadRecoveryShell: React.FC<{
  homeLanguageClass: string;
  navigate: NavigateFunction;
  t: HomeTranslate;
}> = ({ homeLanguageClass, navigate, t }) => (
  <main className={homeLanguageClass} data-home-load-recovery="true">
    <div className="shopee-container">
      <PageError
        className="home-load-recovery"
        title={t('messages.loadFailed')}
        description={t('messages.loadFailedRetry')}
        actions={[
          {
            key: 'retry',
            label: t('messages.retry'),
            onClick: () => window.location.reload(),
            type: 'primary',
          },
          {
            key: 'products',
            label: t('pages.productList.title'),
            onClick: () => navigate('/products'),
            type: 'default',
          },
          {
            key: 'coupons',
            label: t('pages.productList.loadRecoveryCoupons'),
            onClick: () => navigate('/coupons'),
            type: 'default',
          },
          {
            key: 'track',
            label: t('nav.trackOrder'),
            onClick: () => navigate('/track-order'),
            type: 'default',
          },
          {
            key: 'support',
            label: t('pages.productList.loadRecoverySupport'),
            onClick: () => dispatchDomEvent('shop:open-support'),
            type: 'default',
          },
        ]}
      />
    </div>
  </main>
);
