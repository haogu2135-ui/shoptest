import React from 'react';
import type { NavigateFunction } from 'react-router-dom';
import type { CategoryPublic, ProductPublic as Product } from '../types';
import type { Language } from '../i18n';
import { getLocalizedCategoryValue } from '../utils/categoryTree';
import { buildLoginUrlFromWindow } from '../utils/authRedirect';
import { HomeIcon, HI } from './homeHelpers';

export type HomeTranslate = (key: string, params?: Record<string, string | number>) => string;

export type HomeSpotlightCard = {
  key: string;
  icon: React.ReactNode;
  title: string;
  summary: string;
  actionLabel: string;
  action: () => void;
  disabled?: boolean;
};

export type HomeGuestJourneyAction = {
  key: string;
  icon: React.ReactNode;
  title: string;
  text: string;
  actionLabel: string;
  action: () => void;
};

export type HomeMobileQuickAction = {
  key: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
};

export type HomeConversionHighlight = {
  key: string;
  value: string;
  label: string;
};

export type HomeStoryCard = {
  key: string;
  icon: React.ReactNode;
  title: string;
  summary: string;
  actionLabel: string;
  action: () => void;
};

export const homeSectionActionLabel = (section: string, action: string, detail?: string | number) => (
  detail !== undefined && String(detail).trim()
    ? `${section}: ${action}, ${detail}`
    : `${section}: ${action}`
);

/** Above-the-fold commercial hero with conversion CTAs and featured pick. */
export const HomeHeroSection: React.FC<{
  bestSellersCount: number;
  displayCategoryRootsCount: number;
  formatPrice: (value?: number | null) => string;
  freeShippingThreshold: number;
  heroCategoryTiles: CategoryPublic[];
  heroFeaturedProduct: Product | null;
  heroFeaturedProductName: string;
  heroFeaturedTag: string;
  heroSpotlights: HomeSpotlightCard[];
  isAuthenticated: boolean;
  language: Language;
  navigate: NavigateFunction;
  onQuickAdd: (event: React.MouseEvent | undefined, product: Product) => void;
  onOpenProduct: (productId: number) => void;
  onPrefetchProduct: (productId: number) => void;
  promoProductsCount: number;
  t: HomeTranslate;
}> = ({
  bestSellersCount,
  displayCategoryRootsCount,
  formatPrice,
  freeShippingThreshold,
  heroCategoryTiles,
  heroFeaturedProduct,
  heroFeaturedProductName,
  heroFeaturedTag,
  heroSpotlights,
  isAuthenticated,
  language,
  navigate,
  onQuickAdd,
  onOpenProduct,
  onPrefetchProduct,
  promoProductsCount,
  t,
}) => (
  <section className="shopee-hero">
    <div className="shopee-container shopee-hero__grid">
      <div className="shopee-hero__main">
        <div>
          <span className="shopee-hero__eyebrow">{t('home.heroEyebrow')}</span>
          <h1>{t('home.heroTitle')}</h1>
          <p>{t('home.heroText')}</p>
          <div className="shopee-hero__actions">
            <button type="button" className="home-btn home-btn--lg" onClick={() => navigate('/products')}>
              <HomeIcon path={HI.shopping} />
              {t('home.buyNow')}
            </button>
            <button type="button" className="home-btn home-btn--lg home-btn--ghost" onClick={() => navigate('/coupons')}>
              <HomeIcon path={HI.gift} />
              {t('home.claimCoupons')}
            </button>
          </div>
          {!isAuthenticated ? (
            <div className="shopee-hero__authActions" aria-label={t('nav.account')}>
              <button type="button" className="home-btn home-btn--lg home-btn--primary" onClick={() => navigate('/register')}>
                {t('nav.register')}
              </button>
              <button type="button" className="home-btn home-btn--lg home-btn--ghost" onClick={() => navigate(buildLoginUrlFromWindow())}>
                {t('nav.login')}
              </button>
            </div>
          ) : null}
          {heroCategoryTiles.length ? (
            <div className="shopee-hero__categoryRail" aria-label={t('home.categories')}>
              {heroCategoryTiles.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => navigate(`/products?categoryId=${category.id}`)}
                >
                  {getLocalizedCategoryValue(category, language, 'name')}
                </button>
              ))}
            </div>
          ) : null}
          <div className="shopee-hero__signalRow">
            <span className="shopee-hero__signalMetric">
              <small>{t('home.bestSellers')}</small>
              <strong>{bestSellersCount}</strong>
            </span>
            <span className="shopee-hero__signalMetric">
              <small>{t('home.flashOffers')}</small>
              <strong>{promoProductsCount}</strong>
            </span>
            <span className="shopee-hero__signalMetric">
              <small>{t('home.categories')}</small>
              <strong>{displayCategoryRootsCount}</strong>
            </span>
          </div>
          <div className="shopee-hero__trustPills" aria-label={t('home.trust.petSafe')}>
            <span>{t('home.trust.freeShipping', { amount: formatPrice(freeShippingThreshold) })}</span>
            <span>{t('home.trust.easyReturns')}</span>
            <span>{t('home.trust.petSafe')}</span>
          </div>
        </div>
      </div>
      <aside className="shopee-hero__aside" aria-label={t('home.petRecommendations')}>
        {heroFeaturedProduct ? (
          <article className="shopee-hero__featuredCard">
            <span className="shopee-hero__featuredEyebrow">{t('pages.productList.viewPick')}</span>
            <strong>{heroFeaturedProductName}</strong>
            <p>{heroFeaturedProduct.description || t('home.petRecommendationsHint')}</p>
            <div className="shopee-hero__featuredMeta">
              <span className="commerce-money">{formatPrice(heroFeaturedProduct.effectivePrice ?? heroFeaturedProduct.price)}</span>
              {heroFeaturedTag ? <small>{heroFeaturedTag}</small> : null}
            </div>
            <div className="shopee-hero__featuredActions">
              <button
                type="button"
                className="home-btn home-btn--primary"
                onMouseEnter={() => onPrefetchProduct(heroFeaturedProduct.id)}
                onFocus={() => onPrefetchProduct(heroFeaturedProduct.id)}
                aria-label={`${t('home.buyNow')}: ${heroFeaturedProductName}`}
                title={`${t('home.buyNow')}: ${heroFeaturedProductName}`}
                onClick={() => onOpenProduct(heroFeaturedProduct.id)}
              >
                {t('home.buyNow')}
              </button>
              <button
                type="button"
                className="home-btn"
                aria-label={`${t('pages.productList.addToCart')}: ${heroFeaturedProductName}`}
                title={`${t('pages.productList.addToCart')}: ${heroFeaturedProductName}`}
                onClick={() => onQuickAdd(undefined, heroFeaturedProduct)}
              >
                {t('pages.productList.addToCart')}
              </button>
            </div>
          </article>
        ) : null}
        {heroSpotlights.map((card) => (
          <article key={card.key} className={`shopee-hero__spotlight shopee-hero__spotlight--${card.key}`}>
            <span className="shopee-hero__spotlightIcon">{card.icon}</span>
            <div className="shopee-hero__spotlightBody">
              <strong>{card.title}</strong>
              <p>{card.summary}</p>
            </div>
            <button
              type="button"
              className="home-btn home-btn--default"
              aria-label={homeSectionActionLabel(card.title, card.actionLabel, card.summary)}
              title={homeSectionActionLabel(card.title, card.actionLabel, card.summary)}
              onClick={card.action}
              disabled={card.disabled}
            >
              {card.actionLabel}
            </button>
          </article>
        ))}
      </aside>
    </div>
  </section>
);

/** Mobile commerce quick-entry rail under the hero. */
export const HomeMobileQuickPanel: React.FC<{
  actions: HomeMobileQuickAction[];
  t: HomeTranslate;
}> = ({ actions, t }) => (
  <div className="shopee-container shopee-mobile-priority">
    <section className="shopee-mobile-quick-panel" aria-label={t('home.categories')}>
      {actions.map((action) => (
        <button key={action.key} type="button" onClick={action.onClick}>
          <span className="shopee-mobile-quick-panel__icon">{action.icon}</span>
          <span className="shopee-mobile-quick-panel__label">{action.label}</span>
        </button>
      ))}
    </section>
  </div>
);

/** Trust badge strip used by commercial conversion contracts. */
export const HomeTrustStrip: React.FC<{
  formatPrice: (value?: number | null) => string;
  freeShippingThreshold: number;
  t: HomeTranslate;
}> = ({ formatPrice, freeShippingThreshold, t }) => (
  <section className="pet-trust-strip">
    <div><HomeIcon path={HI.truck} /><strong>{t('home.trust.freeShipping', { amount: formatPrice(freeShippingThreshold) })}</strong><span>{t('home.trust.fastDispatch')}</span></div>
    <div><HomeIcon path={HI.safety} /><strong>{t('home.trust.petSafe')}</strong><span>{t('home.trust.nonToxic')}</span></div>
    <div><HomeIcon path={HI.check} /><strong>{t('home.trust.easyReturns')}</strong><span>{t('home.trust.betterFit')}</span></div>
    <div><HomeIcon path={HI.star} /><strong>{t('home.trust.loved')}</strong><span>{t('home.trust.happyTails')}</span></div>
  </section>
);

/** Snapshot notice, guest conversion band, metrics strip, and coupon entries. */
export const HomeConversionActionsSection: React.FC<{
  conversionHighlights: HomeConversionHighlight[];
  guestJourneyActions: HomeGuestJourneyAction[];
  isAuthenticated: boolean;
  navigate: NavigateFunction;
  onOpenDiscountProducts: () => void;
  t: HomeTranslate;
  usingCatalogSnapshot: boolean;
}> = ({
  conversionHighlights,
  guestJourneyActions,
  isAuthenticated,
  navigate,
  onOpenDiscountProducts,
  t,
  usingCatalogSnapshot,
}) => (
  <section className="shopee-home-actions" aria-label={t('home.couponsExtra')}>
    {usingCatalogSnapshot ? (
      <div className="shopee-home__snapshotNotice home-alert home-alert--warning" role="status">
        <strong>{t('pages.productList.snapshotTitle')}</strong>
        <p>{t('pages.productList.snapshotText')}</p>
      </div>
    ) : null}
    {!isAuthenticated ? (
      <div className="shopee-conversion-band" aria-label={t('nav.account')}>
        {guestJourneyActions.map((item) => (
          <button type="button" key={item.key} className="shopee-conversion-band__card" onClick={item.action}>
            <span className="shopee-conversion-band__icon">{item.icon}</span>
            <span className="shopee-conversion-band__body">
              <strong>{item.title}</strong>
              <span className="home-text">{item.text}</span>
            </span>
            <span className="shopee-conversion-band__action">{item.actionLabel}</span>
          </button>
        ))}
      </div>
    ) : null}
    <div className="shopee-conversion-strip" aria-label={t('home.petRecommendations')}>
      {conversionHighlights.map((item) => (
        <article key={item.key} className={`shopee-conversion-strip__item shopee-conversion-strip__item--${item.key}`}>
          <strong>{item.value}</strong>
          <span>{item.label}</span>
        </article>
      ))}
    </div>
    <button type="button" className="shopee-coupon-entry" onClick={() => navigate('/coupons')}>
      <span className="shopee-coupon-entry__icon"><HomeIcon path={HI.gift} /></span>
      <span>
        <strong>{t('home.couponsExtra')}</strong>
        <span className="home-text">{t('nav.coupons')}</span>
      </span>
    </button>
    <button type="button" className="shopee-coupon-entry shopee-coupon-entry--deal" onClick={onOpenDiscountProducts}>
      <span className="shopee-coupon-entry__icon"><HomeIcon path={HI.fire} /></span>
      <span>
        <strong>{t('home.flashOffers')}</strong>
        <span className="home-text">{t('home.viewDeals')}</span>
      </span>
    </button>
  </section>
);

/** Curated story cards for mid-fold conversion storytelling. */
export const HomeStoryGrid: React.FC<{
  cards: HomeStoryCard[];
  t: HomeTranslate;
}> = ({ cards, t }) => (
  <section className="shopee-story-grid" aria-label={t('home.bestSellers')}>
    {cards.map((card) => (
      <article key={card.key} className={`shopee-story-card shopee-story-card--${card.key}`}>
        <span className="shopee-story-card__icon">{card.icon}</span>
        <div className="shopee-story-card__body">
          <strong>{card.title}</strong>
          <span className="home-text">{card.summary}</span>
        </div>
        <button type="button" className="home-btn home-btn--text" onClick={card.action}>
          {card.actionLabel}
        </button>
      </article>
    ))}
  </section>
);
