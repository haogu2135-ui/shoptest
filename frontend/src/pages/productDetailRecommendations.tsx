import React from 'react';
import type { MouseEvent } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { ShopIcon, SI } from '../components/ShopIcon';
import ShopButton from '../components/ShopButton';
import type { ProductPublic as Product } from '../types';
import { needsOptionSelection } from '../utils/productOptions';
import { buildResponsiveImageSrcSet, getOptimizedImageUrl } from '../utils/mediaAssets';
import {
  applyImageFallback,
  fallbackProductImage,
  isRecommendationUnavailable,
  resolveProductPrimaryImage,
} from './productDetailHelpers';

type ProductDetailCompleteSetProps = {
  completeSetItems: Product[];
  detailProductName: (item: Pick<Product, 'id' | 'name'>) => string;
  formatMoney: (amount?: number | null) => string;
  handleAddRecommendationToCart: (event: MouseEvent<HTMLElement>, item: Product) => void | Promise<void>;
  navigate: NavigateFunction;
  recommendationAddingId: number | null;
  t: (key: string, params?: Record<string, string | number>) => string;
};

type ProductDetailRecommendationsProps = {
  detailProductName: (item: Pick<Product, 'id' | 'name'>) => string;
  formatMoney: (amount?: number | null) => string;
  handleAddRecommendationToCart: (event: MouseEvent<HTMLElement>, item: Product) => void | Promise<void>;
  navigate: NavigateFunction;
  recommendationAddingId: number | null;
  recommendationsLoadFailed: boolean;
  recommendationsLoading: boolean;
  relatedRecommendations: Product[];
  retryRecommendations: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

/**
 * Commercial product-detail recommendation rails:
 * complete-the-set purchase assist + bought-together strip with load/empty recovery.
 */
export const ProductDetailCompleteSet: React.FC<ProductDetailCompleteSetProps> = ({
  completeSetItems,
  detailProductName,
  formatMoney,
  handleAddRecommendationToCart,
  navigate,
  recommendationAddingId,
  t,
}) => (
  <>
                {completeSetItems.length > 0 ? (
                  <div className="product-complete-set">
                    <div className="product-complete-set__header">
                      <span className="product-detail-page__text product-detail-page__text--strong">{t('pages.productDetail.completeSetTitle')}</span>
                      <span className="product-detail-page__text product-detail-page__text--secondary">{t('pages.productDetail.completeSetText')}</span>
                    </div>
                    <div className="product-complete-set__items">
                      {completeSetItems.map((item) => {
                        const itemName = detailProductName(item);
                        const needsOptions = needsOptionSelection(item);
                        const addSetActionLabel = `${needsOptions ? t('pages.wishlist.selectOptions') : t('pages.productDetail.completeSetAdd')}: ${itemName}`;
                        return (
                          <div
                            key={item.id}
                            role="button"
                            tabIndex={0}
                            className="product-complete-set__item"
                            onClick={() => navigate(`/products/${item.id}`)}
                            onKeyDown={(event) => {
                              if (event.target !== event.currentTarget) {
                                return;
                              }
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                navigate(`/products/${item.id}`);
                              }
                            }}
                          >
                            <img
                              src={getOptimizedImageUrl(resolveProductPrimaryImage(item), 144)}
                              srcSet={buildResponsiveImageSrcSet(resolveProductPrimaryImage(item), [96, 144, 192, 288])}
                              sizes="48px"
                              alt={itemName}
                              width={96}
                              height={96}
                              loading="lazy"
                              decoding="async"
                              onError={(event) => {
                                applyImageFallback(event, fallbackProductImage);
                              }}
                            />
                            <span className="product-complete-set__copy">
                              <strong>{itemName}</strong>
                              <span className="commerce-money">{formatMoney(item.effectivePrice ?? item.price)}</span>
                            </span>
                            <ShopButton
                              size="small"
                              type={needsOptions ? 'default' : 'primary'}
                              icon={<ShopIcon path={SI.cart} />}
                              loading={recommendationAddingId === item.id}
                              aria-label={addSetActionLabel}
                              title={addSetActionLabel}
                              onClick={(event) => handleAddRecommendationToCart(event, item)}
                              onKeyDown={(event) => event.stopPropagation()}
                            >
                              {needsOptions ? t('pages.wishlist.selectOptions') : t('pages.productDetail.completeSetAdd')}
                            </ShopButton>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

  </>
);

export const ProductDetailRecommendations: React.FC<ProductDetailRecommendationsProps> = ({
  detailProductName,
  formatMoney,
  handleAddRecommendationToCart,
  navigate,
  recommendationAddingId,
  recommendationsLoadFailed,
  recommendationsLoading,
  relatedRecommendations,
  retryRecommendations,
  t,
}) => (
  <>
        {/* Related recommendations */}
        {relatedRecommendations.length > 0 ? (
          <div className="product-recommendations product-recommendations--strip">
            <h3 className="product-detail-page__title">{t('pages.productDetail.boughtTogether', { defaultValue: t('pages.productDetail.recommendations') })}</h3>
            <div
              className="product-recommendations__track product-recommendations__track--strip"
              role="list"
              aria-label={t('pages.productDetail.recommendations')}
            >
              {relatedRecommendations.map((rec) => {
                const recName = detailProductName(rec);
                const needsOptions = needsOptionSelection(rec);
                const isRecommendationSoldOut = isRecommendationUnavailable(rec);
                const recommendationReviewCount = Number(rec.reviewCount || 0);
                const recommendationActionLabel = `${isRecommendationSoldOut
                  ? t('pages.productDetail.soldOut')
                  : needsOptions
                    ? t('pages.wishlist.selectOptions')
                    : t('pages.productDetail.addCart')}: ${recName}`;
                const recommendationViewLabel = `${t('pages.productList.viewDetails')}: ${recName}`;
                return (
                  <div key={rec.id} className="product-recommendations__slide">
                    <article
                      className="product-recommendations__card"
                      role="button"
                      tabIndex={0}
                      aria-label={recommendationViewLabel}
                      title={recommendationViewLabel}
                      onClick={() => navigate(`/products/${rec.id}`)}
                      onKeyDown={(event) => {
                        if (event.target !== event.currentTarget) return;
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          navigate(`/products/${rec.id}`);
                        }
                      }}
                    >
                      <div className="product-recommendations__cover">
                        <button
                          type="button"
                          className="product-recommendations__imageButton"
                          aria-label={recommendationViewLabel}
                          title={recommendationViewLabel}
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate(`/products/${rec.id}`);
                          }}
                        >
                          <img
                            alt={recName}
                            src={getOptimizedImageUrl(resolveProductPrimaryImage(rec), 520)}
                            srcSet={buildResponsiveImageSrcSet(resolveProductPrimaryImage(rec), [240, 360, 520, 720])}
                            sizes="(max-width: 520px) 90vw, (max-width: 768px) 45vw, 260px"
                            className="product-recommendations__image"
                            width={520}
                            height={360}
                            loading="lazy"
                            decoding="async"
                            onError={(event) => {
                              applyImageFallback(event, fallbackProductImage);
                            }}
                          />
                        </button>
                      </div>
                      <div className="product-recommendations__body">
                      <div className="product-recommendations__content">
                        <span className="product-detail-page__text product-detail-page__text--strong product-recommendations__name">{recName}</span>
                        <div className="product-recommendations__meta">
                          <span className="product-recommendations__price commerce-money">{formatMoney(rec.effectivePrice ?? rec.price)}</span>
                          {recommendationReviewCount > 0 && (
                            <span className="product-recommendations__proof">
                              {recommendationReviewCount} {t('adminLayout.reviews')}
                            </span>
                          )}
                        </div>
                        <ShopButton
                          block
                          size="small"
                          type={needsOptions ? 'default' : 'primary'}
                          icon={<ShopIcon path={SI.cart} />}
                          loading={recommendationAddingId === rec.id}
                          disabled={isRecommendationSoldOut}
                          aria-label={recommendationActionLabel}
                          title={recommendationActionLabel}
                          onClick={(event) => handleAddRecommendationToCart(event, rec)}
                        >
                          {isRecommendationSoldOut
                            ? t('pages.productDetail.soldOut')
                            : needsOptions
                              ? t('pages.wishlist.selectOptions')
                              : t('pages.productDetail.addCart')}
                        </ShopButton>
                      </div>
                      </div>
                    </article>
                  </div>
                );
              })}
            </div>
          </div>
        ) : recommendationsLoading ? (
          <div className="product-recommendations product-recommendations--loading" data-product-detail-recommendations-loading="true" role="status" aria-live="polite" aria-busy="true" aria-label={t('common.loading')}>
            <h3 className="product-detail-page__title">{t('pages.productDetail.recommendations')}</h3>
            <div className="product-recommendations__loadingCopy">{t('common.loading')}</div>
          </div>
        ) : (
          <div className="product-recommendations product-recommendations--empty" data-product-detail-recommendations-empty={recommendationsLoadFailed ? 'failed' : 'true'}>
            <h3 className="product-detail-page__title">{t('pages.productDetail.recommendations')}</h3>
            <div className="product-recommendations__emptyCopy">
              <div>{recommendationsLoadFailed ? t('pages.productDetail.recommendationsLoadFailed') : t('pages.productDetail.recommendationsEmpty')}</div>
              <div className="product-recommendations__emptyHint">{recommendationsLoadFailed ? t('pages.productDetail.recommendationsLoadFailedHint') : t('pages.productDetail.recommendationsEmptyHint')}</div>
            </div>
            <div className="product-recommendations__emptyActions" data-product-detail-recommendations-empty-actions="true">
              {recommendationsLoadFailed ? (
                <ShopButton
                  type="primary"
                  aria-label={t('common.retry')}
                  title={t('common.retry')}
                  onClick={retryRecommendations}
                >
                  {t('common.retry')}
                </ShopButton>
              ) : null}
              <ShopButton
                type={recommendationsLoadFailed ? 'default' : 'primary'}
                icon={<ShopIcon path={SI.cart} />}
                aria-label={t('pages.cart.browse')}
                title={t('pages.cart.browse')}
                onClick={() => navigate('/products')}
              >
                {t('pages.cart.browse')}
              </ShopButton>
              <ShopButton
                aria-label={t('nav.coupons')}
                title={t('nav.coupons')}
                onClick={() => navigate('/coupons')}
              >
                {t('nav.coupons')}
              </ShopButton>
              <ShopButton
                aria-label={t('nav.petFinder')}
                title={t('nav.petFinder')}
                onClick={() => navigate('/pet-finder')}
              >
                {t('nav.petFinder')}
              </ShopButton>
            </div>
          </div>
        )}

  </>
);

export default ProductDetailRecommendations;
