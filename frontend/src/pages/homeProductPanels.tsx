import React from 'react';
import type { NavigateFunction } from 'react-router-dom';
import type { CategoryPublic, ProductPublic as Product } from '../types';
import type { Language } from '../i18n';
import HomeProductCard, { type HomeProductCardProps } from '../components/HomeProductCard';
import PageEmpty from '../components/PageEmpty';
import { ProductCardSkeleton } from '../components/SkeletonLoader';
import { getLocalizedCategoryValue } from '../utils/categoryTree';
import { buildResponsiveImageSrcSet, getOptimizedImageUrl } from '../utils/mediaAssets';
import {
  HomeIcon,
  HI,
  applyHomeImageFallback,
  categoryImageFallback,
  resolveAssetImage,
} from './homeHelpers';
import { homeSectionActionLabel, type HomeTranslate } from './homeFirstFoldPanels';

export type HomeProductCardCommonProps = Pick<
  HomeProductCardProps,
  | 't'
  | 'formatPrice'
  | 'formatViewedAt'
  | 'prefetchProduct'
  | 'openProduct'
  | 'handleQuickAddToCart'
  | 'handleQuickWishlist'
  | 'wishlistedProductIds'
>;

export type HomeRecentlyViewedEntry = {
  product: Product;
  viewedAt?: number;
};

const homeProductName = (product: Pick<Product, 'id' | 'name'>, t: HomeTranslate) =>
  (product.name || '').trim() || t('pages.profile.productFallback', { id: product.id });

const getPrice = (product: Product) => product.effectivePrice ?? product.price;

/** Best-sellers product rail with compact commerce cards. */
export const HomeBestSellersSection: React.FC<{
  bestSellers: Product[];
  navigate: NavigateFunction;
  productCardCommonProps: HomeProductCardCommonProps;
  t: HomeTranslate;
}> = ({ bestSellers, navigate, productCardCommonProps, t }) => {
  if (!bestSellers.length) return null;
  const shopAllLabel = homeSectionActionLabel(t('home.bestSellers'), t('home.shopAll'), bestSellers.length);
  return (
    <section className="shopee-section shopee-promo-products shopee-best-sellers">
      <div className="shopee-section__header">
        <h2>
          <HomeIcon path={HI.star} /> {t('home.bestSellers')}
        </h2>
        <button type="button" aria-label={shopAllLabel} title={shopAllLabel} onClick={() => navigate('/products')}>{t('home.shopAll')}</button>
      </div>
      <div className="home-product-grid">
        {bestSellers.map((product, index) => (
          <div key={product.id} className="home-product-grid__item">
            <HomeProductCard {...productCardCommonProps} product={product} index={index} compact priority={index < 2} sectionLabel={t('home.bestSellers')} />
          </div>
        ))}
      </div>
    </section>
  );
};

/** Editorial feature band for top best-sellers. */
export const HomeEditorialBand: React.FC<{
  bestSellers: Product[];
  formatPrice: (value?: number | null) => string;
  navigate: NavigateFunction;
  onOpenProduct: (productId: number) => void;
  onQuickAdd: (event: React.MouseEvent | undefined, product: Product) => void;
  t: HomeTranslate;
}> = ({ bestSellers, formatPrice, navigate, onOpenProduct, onQuickAdd, t }) => {
  if (bestSellers.length < 3) return null;
  const editorialFeatureProduct = bestSellers[0] || null;
  const editorialFeatureName = editorialFeatureProduct ? homeProductName(editorialFeatureProduct, t) : '';
  const moreProductsLabel = homeSectionActionLabel(t('home.petRecommendations'), t('home.moreProducts'), bestSellers.length);
  return (
    <section className="shopee-section shopee-editorial-band">
      <div className="shopee-section__header">
        <h2>
          <HomeIcon path={HI.heart} /> {t('home.petRecommendations')}
        </h2>
        <button type="button" aria-label={moreProductsLabel} title={moreProductsLabel} onClick={() => navigate('/products')}>{t('home.moreProducts')}</button>
      </div>
      <div className="shopee-editorial-band__grid">
        <article className="shopee-editorial-band__feature">
          <span className="shopee-editorial-band__eyebrow">{t('home.heroEyebrow')}</span>
          <strong>{editorialFeatureName}</strong>
          <span className="home-text">{editorialFeatureProduct?.description || t('home.petRecommendationsHint')}</span>
          <div className="shopee-editorial-band__actions">
            <button type="button" className="home-btn home-btn--primary" aria-label={`${t('home.buyNow')}: ${editorialFeatureName}`} title={`${t('home.buyNow')}: ${editorialFeatureName}`} onClick={() => onOpenProduct(bestSellers[0].id)}>
              {t('home.buyNow')}
            </button>
            <button type="button" className="home-btn" aria-label={`${t('pages.productList.addToCart')}: ${editorialFeatureName}`} title={`${t('pages.productList.addToCart')}: ${editorialFeatureName}`} onClick={() => onQuickAdd(undefined, bestSellers[0])}>
              {t('pages.productList.addToCart')}
            </button>
          </div>
        </article>
        <div className="shopee-editorial-band__stack">
          {bestSellers.slice(1, 3).map((product, index) => {
            const productName = homeProductName(product, t);
            return (
              <button
                key={product.id}
                type="button"
                className="shopee-editorial-band__miniCard"
                aria-label={`${t('pages.productList.viewDetails')}: ${productName}`}
                title={`${t('pages.productList.viewDetails')}: ${productName}`}
                onClick={() => onOpenProduct(product.id)}
              >
                <span className="shopee-editorial-band__miniIndex">0{index + 2}</span>
                <span className="shopee-editorial-band__miniBody">
                  <strong>{productName}</strong>
                  <span className="commerce-money">{formatPrice(getPrice(product))}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};

/** Personalized recommendations with insight strip and add-all CTA. */
export const HomePersonalizedProductsSection: React.FC<{
  navigate: NavigateFunction;
  onAddPersonalizedReady: () => void;
  personalizedDealCount: number;
  personalizedDisplayProducts: Product[];
  personalizedPreferenceLabel: string;
  personalizedReadyCount: number;
  personalizedReadyProducts: Product[];
  personalizedRecommendationSource: string;
  productCardCommonProps: HomeProductCardCommonProps;
  t: HomeTranslate;
}> = ({
  navigate,
  onAddPersonalizedReady,
  personalizedDealCount,
  personalizedDisplayProducts,
  personalizedPreferenceLabel,
  personalizedReadyCount,
  personalizedReadyProducts,
  personalizedRecommendationSource,
  productCardCommonProps,
  t,
}) => {
  if (!personalizedDisplayProducts.length) return null;
  const managePetProfilesActionLabel = homeSectionActionLabel(
    t('home.petRecommendations'),
    t('home.managePetProfiles'),
    t('home.petRecommendationReady', { count: personalizedReadyCount }),
  );
  const personalizedAddAllActionLabel = homeSectionActionLabel(
    t('home.petRecommendations'),
    t('pages.wishlist.addAllToCart'),
    t('home.petRecommendationReady', { count: personalizedReadyCount }),
  );
  return (
    <section className="shopee-section shopee-promo-products shopee-personalized-products">
      <div className="shopee-section__header">
        <h2>
          <HomeIcon path={HI.compass} /> {t('home.petRecommendations')}
        </h2>
        <button type="button" aria-label={managePetProfilesActionLabel} title={managePetProfilesActionLabel} onClick={() => navigate('/profile?tab=pets')}>{t('home.managePetProfiles')}</button>
      </div>
      <div className="shopee-personalized-insight">
        <div>
          <strong className="home-text">{t('home.petRecommendationInsightTitle')}</strong>
          <span className="home-text home-text--secondary">
            {personalizedRecommendationSource === 'petProfile'
              ? t('home.petRecommendationInsightPetProfile')
              : personalizedPreferenceLabel
                ? t('home.petRecommendationInsightPreference', { value: personalizedPreferenceLabel })
                : t('home.petRecommendationsHint')}
          </span>
        </div>
        <div className="shopee-personalized-insight__stats">
          <span>{t('home.petRecommendationReady', { count: personalizedReadyCount })}</span>
          <span>{t('home.petRecommendationDeals', { count: personalizedDealCount })}</span>
        </div>
        <button
          type="button"
          className="home-btn home-btn--primary"
          disabled={personalizedReadyProducts.length === 0}
          aria-label={personalizedAddAllActionLabel}
          title={personalizedAddAllActionLabel}
          onClick={onAddPersonalizedReady}
        >
          <HomeIcon path={HI.cart} />
          {t('pages.wishlist.addAllToCart')}
        </button>
      </div>
      <div className="home-product-grid">
        {personalizedDisplayProducts.slice(0, 8).map((product, index) => (
          <div key={product.id} className="home-product-grid__item">
            <HomeProductCard {...productCardCommonProps} product={product} index={index} compact sectionLabel={t('home.petRecommendations')} />
          </div>
        ))}
      </div>
    </section>
  );
};

/** Category tiles with empty-state recovery. */
export const HomeCategoriesSection: React.FC<{
  categoryTiles: CategoryPublic[];
  language: Language;
  navigate: NavigateFunction;
  t: HomeTranslate;
}> = ({ categoryTiles, language, navigate, t }) => {
  const categoriesViewAllLabel = homeSectionActionLabel(t('home.categories'), t('home.viewAll'), categoryTiles.length);
  return (
    <section className="shopee-section shopee-categories-section">
      <div className="shopee-section__header">
        <h2>{t('home.categories')}</h2>
        <button type="button" aria-label={categoriesViewAllLabel} title={categoriesViewAllLabel} onClick={() => navigate('/products')}>{t('home.viewAll')}</button>
      </div>
      {categoryTiles.length ? (
        <div className="shopee-categories">
          {categoryTiles.map((category, index) => {
            const categoryName = getLocalizedCategoryValue(category, language, 'name');
            const categoryImage = category.imageUrl ? resolveAssetImage(category.imageUrl, categoryImageFallback) : '';
            return (
              <button type="button" key={category.id} onClick={() => navigate(`/products?categoryId=${category.id}`)}>
                <span>
                  {categoryImage ? (
                    <img
                      src={getOptimizedImageUrl(categoryImage, 96) || categoryImageFallback}
                      srcSet={buildResponsiveImageSrcSet(categoryImage, [64, 96, 144])}
                      sizes="34px"
                      alt={categoryName}
                      loading="lazy"
                      decoding="async"
                      width={34}
                      height={34}
                      className="shopee-categories__image"
                      onError={(event) => applyHomeImageFallback(event, categoryImageFallback)}
                    />
                  ) : (
                    [<HomeIcon path={HI.appstore} />, <HomeIcon path={HI.mobile} />, <HomeIcon path={HI.shop} />, <HomeIcon path={HI.gift} />, <HomeIcon path={HI.star} />][index % 5]
                  )}
                </span>
                <span className="shopee-categories__name">{categoryName}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <PageEmpty
          className="home-empty-categories"
          data-home-empty-categories="true"
          description={(
            <div>
              <div>{t('home.noCategories')}</div>
              <div>{t('home.emptyCategoriesHint')}</div>
            </div>
          )}
          actions={[
            {
              key: 'browse',
              label: t('home.browseCatalog'),
              onClick: () => navigate('/products'),
            },
            {
              key: 'coupons',
              label: t('nav.coupons'),
              onClick: () => navigate('/coupons'),
              type: 'default',
            },
            {
              key: 'pet-finder',
              label: t('nav.petFinder'),
              onClick: () => navigate('/pet-finder'),
              type: 'default',
            },
            {
              key: 'home-refresh',
              label: t('common.refresh'),
              onClick: () => window.location.reload(),
              type: 'default',
            },
          ]}
        />
      )}
    </section>
  );
};

/** Recently viewed products with pending skeleton and clear action. */
export const HomeRecentlyViewedSection: React.FC<{
  navigate: NavigateFunction;
  onClearRecentlyViewed: () => void;
  productCardCommonProps: HomeProductCardCommonProps;
  recentlyViewedPending: boolean;
  recentlyViewedProducts: HomeRecentlyViewedEntry[];
  t: HomeTranslate;
}> = ({
  navigate,
  onClearRecentlyViewed,
  productCardCommonProps,
  recentlyViewedPending,
  recentlyViewedProducts,
  t,
}) => {
  if (!recentlyViewedProducts.length && !recentlyViewedPending) return null;
  const clearRecentlyViewedActionLabel = `${t('home.clearRecentlyViewed')}: ${recentlyViewedProducts.length}`;
  const recentlyViewedMoreProductsLabel = homeSectionActionLabel(
    t('home.recentlyViewed'),
    t('home.moreProducts'),
    recentlyViewedProducts.length,
  );
  return (
    <section className="shopee-section shopee-promo-products shopee-recently-viewed-products">
      <div className="shopee-section__header shopee-section__header--with-actions">
        <h2>{t('home.recentlyViewed')}</h2>
        <div className="shopee-section__actions">
          <button type="button" aria-label={recentlyViewedMoreProductsLabel} title={recentlyViewedMoreProductsLabel} onClick={() => navigate('/products')}>{t('home.moreProducts')}</button>
          <button
            type="button"
            aria-label={clearRecentlyViewedActionLabel}
            title={clearRecentlyViewedActionLabel}
            onClick={onClearRecentlyViewed}
          >
            {t('home.clearRecentlyViewed')}
          </button>
        </div>
      </div>
      {recentlyViewedPending ? (
        <div className="shopee-recently-viewed-products__pending" data-home-recently-viewed-pending="true" aria-busy="true" aria-live="polite">
          <ProductCardSkeleton count={4} />
        </div>
      ) : (
        <div className="home-product-grid">
          {recentlyViewedProducts.map(({ product, viewedAt }, index) => (
            <div key={product.id} className="home-product-grid__item">
              <HomeProductCard {...productCardCommonProps} product={product} index={index} compact viewedAt={viewedAt} sectionLabel={t('home.recentlyViewed')} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

/** Flash / limited-time offer product rail. */
export const HomeFlashOffersSection: React.FC<{
  onOpenDiscountProducts: () => void;
  productCardCommonProps: HomeProductCardCommonProps;
  promoProducts: Product[];
  t: HomeTranslate;
}> = ({ onOpenDiscountProducts, productCardCommonProps, promoProducts, t }) => {
  if (!promoProducts.length) return null;
  const flashOffersViewAllLabel = homeSectionActionLabel(t('home.flashOffers'), t('home.viewAll'), promoProducts.length);
  return (
    <section className="shopee-section shopee-promo-products shopee-flash-products">
      <div className="shopee-section__header">
        <h2>
          <HomeIcon path={HI.fire} /> {t('home.flashOffers')}
        </h2>
        <button type="button" aria-label={flashOffersViewAllLabel} title={flashOffersViewAllLabel} onClick={onOpenDiscountProducts}>{t('home.viewAll')}</button>
      </div>
      <div className="home-product-grid">
        {promoProducts.map((product, index) => (
          <div key={product.id} className="home-product-grid__item">
            <HomeProductCard {...productCardCommonProps} product={product} index={index} compact sectionLabel={t('home.flashOffers')} />
          </div>
        ))}
      </div>
    </section>
  );
};

/** Daily discovery / for-you grid with progressive load-more. */
export const HomeDiscoverySection: React.FC<{
  discoveryProducts: Product[];
  hasMoreDiscoveryProducts: boolean;
  navigate: NavigateFunction;
  onLoadMore: () => void;
  productCardCommonProps: HomeProductCardCommonProps;
  t: HomeTranslate;
  visibleDiscoveryProducts: Product[];
}> = ({
  discoveryProducts,
  hasMoreDiscoveryProducts,
  navigate,
  onLoadMore,
  productCardCommonProps,
  t,
  visibleDiscoveryProducts,
}) => {
  const dailyDiscoveryMoreProductsLabel = homeSectionActionLabel(
    t('home.dailyDiscovery'),
    t('home.moreProducts'),
    discoveryProducts.length,
  );
  return (
    <section className="shopee-section shopee-discovery shopee-for-you">
      <div className="shopee-section__header shopee-section__header--accent">
        <h2>{t('home.guessYouLike', { defaultValue: t('home.dailyDiscovery') })}</h2>
        <button type="button" aria-label={dailyDiscoveryMoreProductsLabel} title={dailyDiscoveryMoreProductsLabel} onClick={() => navigate('/products')}>{t('home.moreProducts')}</button>
      </div>
      {discoveryProducts.length ? (
        <>
          <div
            className="shopee-discovery__status"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {hasMoreDiscoveryProducts
              ? t('home.discoveryShowing', {
                  shown: visibleDiscoveryProducts.length,
                  total: discoveryProducts.length,
                })
              : t('home.discoveryAllLoaded')}
          </div>
          <div className="home-product-grid" role="list" aria-label={t('home.dailyDiscovery')}>
            {visibleDiscoveryProducts.map((product, index) => (
              <div key={product.id} className="home-product-grid__item" role="listitem">
                <HomeProductCard {...productCardCommonProps} product={product} index={index} priority={index < 2} sectionLabel={t('home.dailyDiscovery')} />
              </div>
            ))}
          </div>
          {hasMoreDiscoveryProducts ? (
            <div className="shopee-load-more">
              <button
                type="button"
                className="shopee-load-more__button"
                aria-label={t('home.discoveryLoadMore')}
                title={t('home.discoveryLoadMore')}
                onClick={onLoadMore}
              >
                {t('home.discoveryLoadMore')}
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <PageEmpty
          className="home-empty-products"
          data-home-empty-products="true"
          description={(
            <div>
              <div>{t('home.noProducts')}</div>
              <div>{t('home.emptyProductsHint')}</div>
            </div>
          )}
          actions={[
            {
              key: 'browse',
              label: t('home.browseCatalog'),
              onClick: () => navigate('/products'),
            },
            {
              key: 'coupons',
              label: t('nav.coupons'),
              onClick: () => navigate('/coupons'),
              type: 'default',
            },
            {
              key: 'pet-finder',
              label: t('nav.petFinder'),
              onClick: () => navigate('/pet-finder'),
              type: 'default',
            },
            {
              key: 'track',
              label: t('nav.trackOrder'),
              onClick: () => navigate('/track-order'),
              type: 'default',
            },
          ]}
        />
      )}
    </section>
  );
};

