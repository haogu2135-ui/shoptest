import React from 'react';
import {
  CheckCircleOutlined,
  FireOutlined,
  HeartFilled,
  HeartOutlined,
  SearchOutlined,
  ShoppingCartOutlined,
  StarFilled,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import type { ProductPublic as Product } from '../types';
import type { TranslateFn } from '../i18n';
import { needsOptionSelection } from '../utils/productOptions';
import { buildResponsiveImageSrcSet, getOptimizedImageUrl, imageFallbacks, resolveApiAssetUrl } from '../utils/mediaAssets';
import { reportNonBlockingError } from '../utils/nonBlockingError';

const productTileImageSizes = '(max-width: 575px) 50vw, (max-width: 991px) 33vw, 17vw';
const discoveryTileImageSizes = '(max-width: 575px) 50vw, (max-width: 991px) 33vw, 25vw';
const productImageFallback = imageFallbacks.product;

const parseImageList = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    reportNonBlockingError('HomeProductCard.parseImageList', error);
    return [];
  }
};

const resolveProductAssetImage = (imageUrl: string, fallback = '') => resolveApiAssetUrl(imageUrl, fallback);

const normalizeProductImages = (product: Product, _index: number) => {
  const rawImages = parseImageList(product.images);
  const images = [product.imageUrl, ...rawImages]
    .map((image) => String(image || '').trim())
    .filter(Boolean)
    .map((image) => resolveProductAssetImage(image))
    .filter(Boolean);
  return Array.from(new Set([...images, productImageFallback].filter(Boolean))).slice(0, 6);
};

const applyProductImageFallback = (event: React.SyntheticEvent<HTMLImageElement>, fallback: string) => {
  if (event.currentTarget.src !== fallback) {
    event.currentTarget.removeAttribute('srcset');
    event.currentTarget.src = fallback;
  }
};

const getHomeProductPrice = (product: Product) => product.effectivePrice ?? product.price;

const getHomeProductDiscountPercent = (product: Product) => product.effectiveDiscountPercent || product.discount || 0;

type HomeProductCardModel = {
  productName: string;
  primaryImage: string;
  fallbackImage: string;
  imageWidth: number;
  imageWidths: number[];
  imageSizes: string;
  price: number;
  originalPrice: number | null;
  discountPercent: number;
  savingsAmount: number;
  isSoldOut: boolean;
  quickAddReady: boolean;
  stockCount?: number;
  lowStockCount: number | null;
  ratingText: string | null;
  hasPositiveSignal: boolean;
  positiveRate: number;
};

const buildHomeProductCardModel = (
  product: Product,
  index: number,
  compact: boolean,
  productName: string,
): HomeProductCardModel => {
  const images = normalizeProductImages(product, index);
  const price = getHomeProductPrice(product);
  const originalPrice = typeof product.originalPrice === 'number' && product.originalPrice > price
    ? product.originalPrice
    : null;
  const stockCount = product.stock;
  const ratingValue = product.averageRating;
  const hasRatingSignal = typeof ratingValue === 'number' && ratingValue > 0;
  const positiveRate = Math.round(product.positiveRate || 0);

  return {
    productName,
    primaryImage: images[0],
    fallbackImage: images[images.length - 1],
    imageWidth: compact ? 360 : 520,
    imageWidths: compact ? [180, 240, 360, 520] : [240, 360, 520, 720],
    imageSizes: compact ? productTileImageSizes : discoveryTileImageSizes,
    price,
    originalPrice,
    discountPercent: getHomeProductDiscountPercent(product),
    savingsAmount: originalPrice ? Math.max(0, originalPrice - price) : 0,
    isSoldOut: stockCount !== undefined && stockCount <= 0,
    quickAddReady: stockCount === undefined || stockCount > 0 ? !needsOptionSelection(product) : false,
    stockCount,
    lowStockCount: stockCount !== undefined && stockCount > 0 && stockCount <= 5 ? stockCount : null,
    ratingText: hasRatingSignal ? ratingValue.toFixed(1) : null,
    hasPositiveSignal: positiveRate > 0 && (product.reviewCount || 0) > 0,
    positiveRate,
  };
};

export type HomeProductCardProps = {
  product: Product;
  index: number;
  sectionLabel: string;
  compact?: boolean;
  viewedAt?: number;
  t: TranslateFn;
  formatPrice: (value: number) => string;
  formatViewedAt: (value: number) => string;
  prefetchProduct: (productId: number) => void;
  openProduct: (productId: number) => void;
  handleQuickAddToCart: (event: React.MouseEvent, product: Product) => void;
  handleQuickWishlist: (event: React.MouseEvent, product: Product) => void;
  wishlistedProductIds: Set<number>;
};

const HomeProductCard: React.FC<HomeProductCardProps> = ({
  product,
  index,
  compact = false,
  viewedAt,
  sectionLabel,
  t,
  formatPrice,
  formatViewedAt,
  prefetchProduct,
  openProduct,
  handleQuickAddToCart,
  handleQuickWishlist,
  wishlistedProductIds,
}) => {
  const fallbackName = t('pages.profile.productFallback', { id: product.id });
  const productName = (product.name || '').trim() || fallbackName;
  const card = buildHomeProductCardModel(product, index, compact, productName);
  const isWishlisted = wishlistedProductIds.has(product.id);
  const stockBadgeText = card.stockCount !== undefined && card.stockCount > 0
    ? card.lowStockCount !== null
      ? t('pages.cart.lowStockLeft', { count: card.stockCount })
      : t('home.stockAvailable', { count: card.stockCount })
    : t('home.inStock');
  const tileContextLabel = `${sectionLabel} #${index + 1}`;
  const imageViewActionLabel = `${t('pages.productList.viewDetails')}: ${card.productName} - image - ${tileContextLabel}`;
  const quickViewActionLabel = `${t('pages.productList.viewDetails')}: ${card.productName} - quick action - ${tileContextLabel}`;
  const titleViewActionLabel = `${t('pages.productList.viewDetails')}: ${card.productName} - ${tileContextLabel}`;
  const productDetailPath = `/products/${product.id}`;
  const cartActionLabel = `${t('pages.productList.addToCart')}: ${card.productName}`;
  const wishlistActionLabel = `${isWishlisted ? t('pages.productDetail.favorited') : t('pages.productDetail.favorite')}: ${card.productName}`;

  return (
    <article
      className={[
        'shopee-product',
        compact ? 'shopee-product--compact' : '',
        card.isSoldOut ? 'shopee-product--soldOut' : '',
      ].filter(Boolean).join(' ')}
      onMouseEnter={() => prefetchProduct(product.id)}
      onFocus={() => prefetchProduct(product.id)}
    >
      <span className="shopee-product__imageWrap">
        <Link
          to={productDetailPath}
          className="shopee-product__imageButton"
          aria-label={imageViewActionLabel}
          title={imageViewActionLabel}
        >
          <img
            src={getOptimizedImageUrl(card.primaryImage, card.imageWidth)}
            srcSet={buildResponsiveImageSrcSet(card.primaryImage, card.imageWidths)}
            sizes={card.imageSizes}
            alt={card.productName}
            className="shopee-product__image"
            width={card.imageWidth}
            height={card.imageWidth}
            loading="lazy"
            decoding="async"
            onError={(event) => applyProductImageFallback(event, card.fallbackImage)}
          />
          {card.discountPercent > 0 ? (
            <span className="shopee-product__discount">-{card.discountPercent}%</span>
          ) : null}
          {product.isFeatured ? <span className="shopee-product__mall">{t('common.mall')}</span> : null}
          {card.isSoldOut ? <span className="shopee-product__soldOut">{t('pages.productList.soldOut')}</span> : null}
        </Link>
        <span className="shopee-product__quickActions">
          <button
            type="button"
            aria-label={quickViewActionLabel}
            title={quickViewActionLabel}
            onMouseEnter={() => prefetchProduct(product.id)}
            onFocus={() => prefetchProduct(product.id)}
            onClick={(event) => {
              event.stopPropagation();
              openProduct(product.id);
            }}
          >
            <SearchOutlined />
          </button>
          <button
            type="button"
            aria-label={cartActionLabel}
            title={cartActionLabel}
            disabled={card.isSoldOut}
            onClick={(event) => handleQuickAddToCart(event, product)}
          >
            <ShoppingCartOutlined />
          </button>
          <button
            type="button"
            aria-label={wishlistActionLabel}
            title={wishlistActionLabel}
            className={isWishlisted ? 'shopee-product__quickAction--favorite shopee-product__quickAction--favoriteActive' : 'shopee-product__quickAction--favorite'}
            onClick={(event) => handleQuickWishlist(event, product)}
          >
            {isWishlisted ? <HeartFilled /> : <HeartOutlined />}
          </button>
        </span>
      </span>
      <span className="shopee-product__body">
        <Link
          to={productDetailPath}
          className="shopee-product__name"
          aria-label={titleViewActionLabel}
          title={titleViewActionLabel}
        >
          {card.productName}
        </Link>
        {card.ratingText || card.hasPositiveSignal ? (
          <span className="shopee-product__socialProof">
            {card.ratingText ? (
              <span className="shopee-product__rating">
                <StarFilled /> {card.ratingText}
              </span>
            ) : null}
            {card.hasPositiveSignal ? (
              <span className="shopee-product__reviewCount">
                {t('pages.productList.positiveRate', { rate: card.positiveRate, count: product.reviewCount || 0 })}
              </span>
            ) : product.reviewCount ? (
              <span className="shopee-product__reviewCount">
                {product.reviewCount} {t('home.sold')}
              </span>
            ) : null}
          </span>
        ) : null}
        <span className="shopee-product__meta">
          <span className="shopee-product__price commerce-money">{formatPrice(card.price)}</span>
          {!compact && !card.isSoldOut ? (
            <span className={card.lowStockCount !== null ? 'shopee-product__stockBadge shopee-product__stockBadge--low' : 'shopee-product__stockBadge shopee-product__stockBadge--ok'}>
              {stockBadgeText}
            </span>
          ) : null}
        </span>
        {card.originalPrice !== null ? (
          <span className="shopee-product__original commerce-money">{formatPrice(card.originalPrice)}</span>
        ) : null}
        {!card.isSoldOut ? (
          <span className="shopee-product__signalRow">
            {card.savingsAmount > 0 ? (
              <span className="shopee-product__signal shopee-product__signal--deal">
                <FireOutlined />
                {t('pages.productList.bestValueSavings', { amount: formatPrice(card.savingsAmount) })}
              </span>
            ) : null}
            <span className={card.lowStockCount !== null ? 'shopee-product__signal shopee-product__signal--urgent' : 'shopee-product__signal shopee-product__signal--ready'}>
              {card.lowStockCount !== null ? <FireOutlined /> : <CheckCircleOutlined />}
              {card.lowStockCount !== null
                ? t('pages.productList.cardLowStock', { count: card.lowStockCount })
                : card.quickAddReady
                  ? t('pages.productList.cardQuickReady')
                  : t('pages.productList.cardOptionsNeeded')}
            </span>
          </span>
        ) : null}
        {viewedAt ? (
          <span className="shopee-product__lastViewed">{t('home.viewedAt', { time: formatViewedAt(viewedAt) })}</span>
        ) : null}
      </span>
    </article>
  );
};

const MemoizedHomeProductCard = React.memo(HomeProductCard);
MemoizedHomeProductCard.displayName = 'HomeProductCard';

export default MemoizedHomeProductCard;
