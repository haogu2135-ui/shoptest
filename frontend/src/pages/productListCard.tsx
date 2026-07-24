import React from 'react';
import { Link } from 'react-router-dom';
import type { ProductPublic as Product } from '../types';
import { ShopIcon, SI } from '../components/ShopIcon';
import ShopButton from '../components/ShopButton';
import ShopTag from '../components/ShopTag';
import { getOptimizedImageUrl, buildResponsiveImageSrcSet } from '../utils/mediaAssets';
import { productImageFallback } from '../utils/productMedia';
import { getLowStockCount } from '../utils/conversionConfig';
import {
  type ProductListCardProps,
  type ProductListTranslate,
  buildProductListBadges,
  eagerImagePriorityProps,
  getPrice,
  getSavingsAmount,
  hasReviewSignal,
  isBestValueProduct,
  isProductSoldOut,
  isQuickAddReady,
  lazyImagePriorityProps,
  productListImageSizes,
  resolveProductPrimaryImage,
} from './productListHelpers';

export const ProductListConfidenceStrip: React.FC<{ product: Product; t: ProductListTranslate }> = ({ product, t }) => {
  const quickReady = isQuickAddReady(product);
  const lowStock = getLowStockCount(product.stock);
  const soldOut = isProductSoldOut(product);
  return (
    <div className="product-list__confidenceStrip">
      {!soldOut && (
        <span className={`product-list__confidencePill${quickReady ? ' product-list__confidencePill--ready' : ''}`}>
          <ShopIcon path={SI.check} />
          {quickReady ? t('pages.productList.cardQuickReady') : t('pages.productList.cardOptionsNeeded')}
        </span>
      )}
      {lowStock !== null && (
        <span className="product-list__confidencePill product-list__confidencePill--alert">
          <ShopIcon path={SI.fire} />
          {t('pages.productList.cardLowStock', { count: lowStock })}
        </span>
      )}
      {lowStock === null && !soldOut && (
        <span className="product-list__confidencePill product-list__confidencePill--trust">
          <ShopIcon path={SI.check} />
          {t('pages.productList.cardReturnReady')}
        </span>
      )}
    </div>
  );
};

export const ProductListCard = React.memo(({
  product,
  index,
  currentPage,
  productName,
  wishlisted,
  stockAlerted,
  compared,
  t,
  formatMoney,
  renderSavingsText,
  onPrefetch,
  onPreview,
  onQuickAdd,
  onStockAlert,
  onWishlistToggle,
  onCompare,
}: ProductListCardProps) => {
  const imageUrl = resolveProductPrimaryImage(product);
  const priorityImage = currentPage === 1 && index < 4;
  const viewDetailsActionLabel = `${t('pages.productList.viewDetails')}: ${productName}`;
  const previewActionLabel = `${t('pages.productList.quickPreview')}: ${productName}`;
  const wishlistActionLabel = `${wishlisted ? t('pages.productDetail.favorited') : t('pages.productDetail.favorite')}: ${productName}`;
  const compareActionLabel = `${compared ? t('pages.productList.viewCompare') : t('pages.productList.compare')}: ${productName}`;
  const productDetailPath = `/products/${product.id}`;
  const soldOut = isProductSoldOut(product);
  const quickAddLabel = isQuickAddReady(product) ? t('pages.productList.quickAdd') : t('pages.productList.chooseOptionsAction');
  const quickAddActionLabel = `${quickAddLabel}: ${productName}`;
  const stockAlertActionLabel = `${stockAlerted ? t('pages.stockAlerts.remove') : t('pages.stockAlerts.notifyMe')}: ${productName}`;

  return (
    <div className="product-list__gridItem">
      <article
        className="product-list__card"
        onMouseEnter={() => onPrefetch(product.id)}
        onFocus={() => onPrefetch(product.id)}
      >
        <div className="product-list__cover">
          <div className="product-list__imageWrap">
            <Link
              to={productDetailPath}
              className="product-list__imageButton"
              aria-label={viewDetailsActionLabel}
              title={viewDetailsActionLabel}
            >
              <img
                alt={productName}
                src={getOptimizedImageUrl(imageUrl, priorityImage ? 520 : 360)}
                srcSet={buildResponsiveImageSrcSet(imageUrl, [240, 360, 520, 720])}
                sizes={productListImageSizes}
                className="product-list__image"
                width={520}
                height={480}
                loading={priorityImage ? 'eager' : 'lazy'}
                decoding="async"
                {...(priorityImage ? eagerImagePriorityProps : lazyImagePriorityProps)}
                onError={(event) => {
                  if (event.currentTarget.src !== productImageFallback) {
                    event.currentTarget.removeAttribute('srcset');
                    event.currentTarget.src = productImageFallback;
                  }
                }}
              />
              <span className="product-list__badges" aria-label={t('pages.productList.productBadges')}>
                {buildProductListBadges(product, t).slice(0, 3).map((badge) => <ShopTag key={badge.label} color={badge.color}>{badge.label}</ShopTag>)}
              </span>
              {soldOut && (
                <span className="product-list__soldOut">
                  {t('pages.productList.soldOut')}
                </span>
              )}
            </Link>
            <div className="product-list__imageOverlay">
              <ShopButton
                size="small"
                icon={<ShopIcon path={SI.search} />}
                className="product-list__previewTrigger"
                aria-label={previewActionLabel}
                title={previewActionLabel}
                onClick={(event) => onPreview(event, product)}
              >
                {t('pages.productList.quickPreview')}
              </ShopButton>
            </div>
          </div>
        </div>
        <div className="product-list__body">
          <div className="product-list__metaTitle">
            <Link
              to={productDetailPath}
              className="product-list__titleLink"
              aria-label={viewDetailsActionLabel}
              title={viewDetailsActionLabel}
            >
              <span className="product-list__text product-list__text--ellipsis" title={productName}>{productName}</span>
            </Link>
          </div>
          <div className="product-list__metaDescription">
            <div className="product-list__priceLine">
              <span className="product-list__currentPrice commerce-money">{formatMoney(getPrice(product))}</span>
              {product.originalPrice && product.originalPrice > getPrice(product) && (
                <span className="product-list__text product-list__text--delete product-list__text--secondary product-list__originalPrice commerce-money">{formatMoney(product.originalPrice)}</span>
              )}
              {product.activeLimitedTimeDiscount && <ShopTag color="red" className="product-list__priceTag">{t('pages.keywords.deal')}</ShopTag>}
            </div>
            {isBestValueProduct(product) && getSavingsAmount(product) > 0 ? (
              <div className="product-list__valueLine">
                <span className="product-list__text product-list__text--success">
                  {renderSavingsText(getSavingsAmount(product))}
                </span>
              </div>
            ) : null}
            <div className="product-list__ratingLine">
              <span className={`product-list__text ${hasReviewSignal(product) ? 'product-list__text--secondary' : 'product-list__newReviewSignal'}`}>
                {hasReviewSignal(product)
                  ? t('pages.productList.positiveRate', { rate: Math.round(product.positiveRate || 0).toString(), count: product.reviewCount || 0 })
                  : t('pages.productList.noReviewsYet')}
              </span>
            </div>
            <div className="product-list__metaRow">
              {product.brand && <span className="product-list__text product-list__text--secondary product-list__brand">{product.brand}</span>}
            </div>
            <ProductListConfidenceStrip product={product} t={t} />
          </div>
        </div>
        <div className="product-list__actions" role="group" aria-label={productName}>
          <div className="product-list__actionItem product-list__actionItem--primary">
            {soldOut ? (
              <ShopButton
                icon={<ShopIcon path={SI.bell} />}
                size="small"
                className="product-list__actionButton product-list__alertButton"
                aria-pressed={stockAlerted}
                aria-label={stockAlertActionLabel}
                title={stockAlertActionLabel}
                onClick={(event) => onStockAlert(event, product, stockAlerted)}
              >
                <span className="product-list__actionLabel">
                  {stockAlerted ? t('pages.stockAlerts.remove') : t('pages.stockAlerts.notifyMe')}
                </span>
              </ShopButton>
            ) : (
              <ShopButton
                type="primary"
                icon={<ShopIcon path={SI.cart} />}
                size="small"
                className="product-list__actionButton"
                aria-label={quickAddActionLabel}
                title={quickAddActionLabel}
                onClick={(event) => onQuickAdd(event, product)}
              >
                <span className="product-list__actionLabel">
                  {quickAddLabel}
                </span>
              </ShopButton>
            )}
          </div>
          <div className="product-list__actionItem">
            <ShopButton
              icon={wishlisted ? <ShopIcon path={SI.heartFill} /> : <ShopIcon path={SI.heart} />}
              size="small"
              className={wishlisted
                ? 'product-list__actionButton product-list__actionButton--compact product-list__favoriteButton product-list__favoriteButton--active'
                : 'product-list__actionButton product-list__actionButton--compact product-list__favoriteButton'}
              aria-pressed={wishlisted}
              aria-label={wishlistActionLabel}
              title={wishlistActionLabel}
              onClick={(event) => onWishlistToggle(event, product)}
            >
              <span className="product-list__actionLabel">
                {wishlisted ? t('pages.productDetail.favorited') : t('pages.productDetail.favorite')}
              </span>
            </ShopButton>
          </div>
          <div className="product-list__actionItem">
            <ShopButton
              icon={<ShopIcon path={SI.barChart} />}
              size="small"
              className="product-list__actionButton product-list__actionButton--compact"
              aria-label={compareActionLabel}
              title={compareActionLabel}
              onClick={(event) => onCompare(event, product)}
            >
              <span className="product-list__actionLabel">
                {compared ? t('pages.productList.viewCompare') : t('pages.productList.compare')}
              </span>
            </ShopButton>
          </div>
        </div>
      </article>
    </div>
  );
});

ProductListCard.displayName = 'ProductListCard';

