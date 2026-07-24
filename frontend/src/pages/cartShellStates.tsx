import React from 'react';
import type { ReactNode } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import ShopButton from '../components/ShopButton';
import { ShopIcon, SI } from '../components/ShopIcon';
import ShopBreadcrumb from '../components/ShopBreadcrumb';
import PageError from '../components/PageError';
import { ProductCardSkeleton, StatsStripSkeleton } from '../components/SkeletonLoader';
import { dispatchDomEvent } from '../utils/domEvents';

type Translate = (key: string, params?: Record<string, string | number>) => string;

const cartBreadcrumbItems = (t: Translate) => ([
  { key: 'home', label: t('nav.ariaHome'), path: '/' },
  { key: 'products', label: t('pages.productList.title'), path: '/products' },
  { key: 'cart', label: t('pages.cart.title') },
]);

export type CartLoadingStateProps = {
  language: string;
  t: Translate;
};

/** Commercial cart loading skeleton for first paint conversion continuity. */
export const CartLoadingState: React.FC<CartLoadingStateProps> = ({ language, t }) => (
  <div className={`cart-page cart-page--${language}`} role="status" aria-live="polite" aria-busy="true" aria-label={t('common.loading')}>
    <section className="cart-page__hero">
      <div className="cart-page__heroContent">
        <span className="cart-page__heroEyebrow">{t('pages.cart.nextActionEyebrow')}</span>
        <h1 className="cart-page__title">{t('pages.cart.title')}</h1>
        <div className="cart-page__loadingText shimmer" aria-hidden="true" />
        <div className="cart-page__heroActions" aria-hidden="true">
          <div className="cart-page__loadingAction shimmer" />
          <div className="cart-page__loadingAction cart-page__loadingAction--secondary shimmer" />
        </div>
      </div>
      <div className="cart-page__heroStats" aria-hidden="true">
        {[1, 2, 3].map((i) => <div key={i} className="cart-page__loadingStat shimmer" />)}
      </div>
    </section>
    <section className="cart-page__summaryStrip" aria-hidden="true">
      <StatsStripSkeleton cols={3} />
    </section>
    <div className="cart-page__loadingProducts" aria-hidden="true">
      <ProductCardSkeleton count={6} />
    </div>
  </div>
);

export type CartLoadErrorStateProps = {
  language: string;
  loadErrorMessage?: string | null;
  navigate: NavigateFunction;
  onRetry: () => void;
  paymentReturnBanner?: ReactNode;
  retryCartLoadActionLabel: string;
  t: Translate;
};

/** Commercial multipath recovery when cart bootstrap fails with an empty cart. */
export const CartLoadErrorState: React.FC<CartLoadErrorStateProps> = ({
  language,
  loadErrorMessage,
  navigate,
  onRetry,
  paymentReturnBanner = null,
  retryCartLoadActionLabel,
  t,
}) => (
  <div className={`cart-page cart-page--empty cart-page--${language}`}>
    <ShopBreadcrumb
      ariaLabel={t('pages.cart.title')}
      items={cartBreadcrumbItems(t)}
    />
    {paymentReturnBanner}
    <section className="cart-page__hero cart-page__hero--recovery">
      <div className="cart-page__heroContent">
        <span className="cart-page__heroEyebrow">{t('pages.cart.nextActionEyebrow')}</span>
        <h1 className="cart-page__title">{t('pages.cart.title')}</h1>
      </div>
    </section>
    <div data-cart-load-recovery="true">
      <PageError
        className="cart-page__loadError"
        title={t('messages.loadFailed')}
        description={loadErrorMessage || t('pages.cart.fetchFailed')}
        actions={[
          {
            key: 'retry',
            label: retryCartLoadActionLabel,
            onClick: onRetry,
            type: 'primary',
          },
          {
            key: 'browse',
            label: t('pages.cart.browse'),
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
            key: 'history',
            label: t('nav.history'),
            onClick: () => navigate('/history'),
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
  </div>
);

export type CartFullEmptyStateProps = {
  emptyBrowseActionLabel: string;
  emptyCouponsActionLabel: string;
  emptyHistoryActionLabel: string;
  emptyPetFinderActionLabel: string;
  formatMoney: (amount?: number | null) => string;
  freeShippingThreshold: number;
  language: string;
  navigate: NavigateFunction;
  paymentReturnBanner?: ReactNode;
  t: Translate;
};

/** Commercial full-empty cart with multipath recovery CTAs and trust signals. */
export const CartFullEmptyState: React.FC<CartFullEmptyStateProps> = ({
  emptyBrowseActionLabel,
  emptyCouponsActionLabel,
  emptyHistoryActionLabel,
  emptyPetFinderActionLabel,
  formatMoney,
  freeShippingThreshold,
  language,
  navigate,
  paymentReturnBanner = null,
  t,
}) => (
  <div className={`cart-page cart-page--empty cart-page--${language}`}>
    <ShopBreadcrumb
      ariaLabel={t('pages.cart.title')}
      items={cartBreadcrumbItems(t)}
    />
    {paymentReturnBanner}
    <section className="cart-page__emptyHero" aria-label={t('pages.cart.empty')}>
      <span className="cart-page__emptyIcon">
        <ShopIcon path={SI.cart} />
      </span>
      <div className="cart-page__emptyCopy">
        <span className="cart-page__emptyEyebrow">{t('pages.cart.yourCart')}</span>
        <h1 className="cart-page__title">{t('pages.cart.empty')}</h1>
        <span className="cart-page__text">{t('pages.cart.recentRecoverySubtitle')}</span>
      </div>
      <div className="cart-page__emptyActions" data-cart-empty-actions="true">
        <ShopButton type="primary" icon={<ShopIcon path={SI.shopping} />} aria-label={emptyBrowseActionLabel} title={emptyBrowseActionLabel} onClick={() => navigate('/products')}>
          {t('pages.cart.browse')}
        </ShopButton>
        <ShopButton icon={<ShopIcon path={SI.shopping} />} aria-label={emptyCouponsActionLabel} title={emptyCouponsActionLabel} onClick={() => navigate('/coupons')}>
          {t('nav.coupons')}
        </ShopButton>
        <ShopButton icon={<ShopIcon path={SI.shopping} />} aria-label={emptyPetFinderActionLabel} title={emptyPetFinderActionLabel} onClick={() => navigate('/pet-finder')}>
          {t('nav.petFinder')}
        </ShopButton>
        <ShopButton icon={<ShopIcon path={SI.clock} />} aria-label={emptyHistoryActionLabel} title={emptyHistoryActionLabel} onClick={() => navigate('/history')}>
          {t('nav.history')}
        </ShopButton>
      </div>
      <div className="cart-page__emptySignals">
        <span className="cart-page__emptySignal">
          <ShopIcon path={SI.check} />
          <span className="cart-page__emptySignalText">
            {freeShippingThreshold > 0
              ? t('pages.cart.freeShippingRemaining', { amount: formatMoney(freeShippingThreshold) })
              : t('pages.cart.shippingCalculatedAtCheckout')}
          </span>
        </span>
        <span className="cart-page__emptySignal">
          <ShopIcon path={SI.clock} />
          <span className="cart-page__emptySignalText">{t('pages.cart.saveForLaterTitle')}</span>
        </span>
        <span className="cart-page__emptySignal">
          <ShopIcon path={SI.shopping} />
          <span className="cart-page__emptySignalText">{t('pages.cart.recentRecoveryTitle')}</span>
        </span>
      </div>
    </section>
  </div>
);
