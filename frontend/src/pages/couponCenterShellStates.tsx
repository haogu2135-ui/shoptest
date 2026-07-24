import React from 'react';

export type CouponCenterTranslate = (key: string, params?: Record<string, string | number>) => string;

/** Commercial loading shell for coupon center (CLS-stable skeletons). */
export const CouponCenterLoadingShell: React.FC<{
  language: string;
  t: CouponCenterTranslate;
}> = ({ language, t }) => (
  <div
    className={`coupon-center-page coupon-center-page--loading coupon-center-page--${language}`}
    role="status"
    aria-live="polite"
    aria-busy="true"
    aria-label={t('common.loading')}
    data-coupon-loading-shell="true"
  >
    <div className="coupon-center-page__loadingHero">
      <div className="coupon-center-page__skeleton coupon-center-page__skeleton--hero" aria-hidden="true">
        <span className="coupon-center-page__skeletonLine" />
        <span className="coupon-center-page__skeletonLine" />
        <span className="coupon-center-page__skeletonLine coupon-center-page__skeletonLine--short" />
      </div>
    </div>
    <div className="coupon-center-page__loadingGrid">
      {[0, 1, 2].map((index) => (
        <div key={index} className="coupon-center-page__skeleton" aria-hidden="true">
          <span className="coupon-center-page__skeletonLine" />
          <span className="coupon-center-page__skeletonLine" />
          <span className="coupon-center-page__skeletonLine" />
          <span className="coupon-center-page__skeletonLine coupon-center-page__skeletonLine--short" />
        </div>
      ))}
    </div>
  </div>
);
