import React from 'react';
import { ShopIcon, SI } from '../components/ShopIcon';
import type { ProductPublic as Product } from '../types';
import { loadFallbackProductCatalog, loadProductCatalogSnapshot } from '../utils/productCatalogSnapshot';
import { resolveApiAssetUrl } from '../utils/mediaAssets';
import { productImageFallback } from '../utils/productMedia';
import { reportNonBlockingError } from '../utils/nonBlockingError';

export const fallbackProductImage = productImageFallback;
export const resolveDetailImage = (imageUrl?: string | null) => resolveApiAssetUrl(imageUrl, fallbackProductImage);
const PRODUCT_RECOMMENDATIONS_CACHE_TTL = 2 * 60 * 1000;
export const PRODUCT_RECOMMENDATIONS_CACHE_MAX_ENTRIES = 50;

export type GalleryTouchPoint = Pick<Touch, 'clientX' | 'clientY'>;
export type GalleryTouchList = {
  length: number;
  item?: (index: number) => GalleryTouchPoint | null;
  [index: number]: GalleryTouchPoint | undefined;
};

const productRecommendationsCache = new Map<string, { expiresAt: number; items: Product[] }>();

export type ProductRecommendationCandidate = Partial<Omit<Product, 'images'>> & {
  images?: Product['images'] | string | null;
  imageUrl?: Product['imageUrl'] | null;
};

export const clearProductDetailSessionCaches = () => {
  productRecommendationsCache.clear();
};

const pruneExpiredProductRecommendations = (now: number) => {
  productRecommendationsCache.forEach((entry, cacheKey) => {
    if (entry.expiresAt <= now) {
      productRecommendationsCache.delete(cacheKey);
    }
  });
};

export const getCachedProductRecommendations = (cacheKey: string, now = Date.now()) => {
  pruneExpiredProductRecommendations(now);
  const cached = productRecommendationsCache.get(cacheKey);
  if (!cached) return null;
  productRecommendationsCache.delete(cacheKey);
  productRecommendationsCache.set(cacheKey, cached);
  return cached.items;
};

export const cacheProductRecommendations = (cacheKey: string, items: Product[], now = Date.now()) => {
  pruneExpiredProductRecommendations(now);
  productRecommendationsCache.delete(cacheKey);
  productRecommendationsCache.set(cacheKey, {
    expiresAt: now + PRODUCT_RECOMMENDATIONS_CACHE_TTL,
    items,
  });
  while (productRecommendationsCache.size > PRODUCT_RECOMMENDATIONS_CACHE_MAX_ENTRIES) {
    const oldestKey = productRecommendationsCache.keys().next().value;
    if (oldestKey === undefined) break;
    productRecommendationsCache.delete(oldestKey);
  }
};

const parseImageList = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((item) => String(item || '').trim()).filter(Boolean) : [];
  } catch (error) {
    reportNonBlockingError('ProductDetail.parseImageList', error);
    return [];
  }
};

export const normalizeProductImages = (product: ProductRecommendationCandidate | null | undefined) => {
  const rawImages = parseImageList(product?.images);
  const images = [product?.imageUrl, ...rawImages]
    .map((image) => String(image || '').trim())
    .filter(Boolean);
  const uniqueImages = Array.from(new Set(images.map(resolveDetailImage)));
  return uniqueImages.length > 0
    ? uniqueImages.concat(fallbackProductImage)
    : [fallbackProductImage, fallbackProductImage];
};

export const resolveProductPrimaryImage = (product: Partial<Product> | null | undefined) => {
  const images = product?.images;
  const galleryImage = Array.isArray(images) ? images.find((image) => String(image || '').trim()) : '';
  return resolveDetailImage(product?.imageUrl || galleryImage || fallbackProductImage);
};

export const findFallbackProductById = (id: number) => {
  const sources = [loadProductCatalogSnapshot()?.products || [], loadFallbackProductCatalog()];
  for (const products of sources) {
    const product = products.find((item) => Number(item.id) === id);
    if (product) return product;
  }
  return null;
};

export const handleGalleryZoomMove = (event: React.MouseEvent<HTMLImageElement>) => {
  const rect = event.currentTarget.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;
  event.currentTarget.style.transformOrigin = `${x}% ${y}%`;
};

export const handleGalleryZoomLeave = (event: React.MouseEvent<HTMLImageElement>) => {
  event.currentTarget.style.transformOrigin = 'center center';
};

export const applyImageFallback = (event: React.SyntheticEvent<HTMLImageElement>, fallback: string) => {
  if (event.currentTarget.src === fallback) return;
  event.currentTarget.removeAttribute('srcset');
  event.currentTarget.src = fallback;
};

export const getTouchDistance = (first: GalleryTouchPoint, second: GalleryTouchPoint) =>
  Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);

export const clampZoom = (value: number) => Math.min(3, Math.max(1, value));

export const getTouchPair = (touches: GalleryTouchList) => {
  const first = touches.item?.(0) || touches[0] || null;
  const second = touches.item?.(1) || touches[1] || null;
  if (!first || !second) return null;
  return { first, second };
};

export const renderTrustIcon = (icon: string) => {
  switch (icon) {
    case 'truck':
      return <ShopIcon path={SI.truck} />;
    case 'shield':
    case 'support':
      return <ShopIcon path={SI.safety} />;
    default:
      return <ShopIcon path={SI.checkCircle} />;
  }
};

const PRODUCT_RECOMMENDATION_ACCESSORY_KEYWORDS = [
  'accessory',
  'accessories',
  'filter',
  'refill',
  'replacement',
  'cleaner',
  'cleaning',
  'brush',
  'mat',
  'liner',
  'cartridge',
  '耗材',
  '配件',
  '滤芯',
  '清洁',
  '刷',
  '垫',
  'recambio',
  'filtro',
  'limpieza',
  'accesorio',
];

const recommendationObjectValues = (value: unknown) => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? Object.values(value as Record<string, unknown>)
    : []
);

const productRecommendationSearchText = (item: ProductRecommendationCandidate | null | undefined) => [
  item?.name,
  item?.description,
  item?.brand,
  item?.tag,
  item?.shipping,
  item?.warranty,
  ...recommendationObjectValues(item?.specifications),
  ...recommendationObjectValues(item?.specificationItems),
].filter(Boolean).join(' ').toLowerCase();

export const isRecommendationUnavailable = (item: ProductRecommendationCandidate | null | undefined) => {
  const hasStockValue = item?.stock !== undefined && item?.stock !== null;
  return Boolean(hasStockValue && Number(item?.stock) <= 0);
};

export const scoreRelatedRecommendation = (
  currentProduct: ProductRecommendationCandidate | null | undefined,
  candidate: ProductRecommendationCandidate | null | undefined,
) => {
  const text = productRecommendationSearchText(candidate);
  const currentText = productRecommendationSearchText(currentProduct);
  let score = 0;
  if (Number(candidate?.categoryId) === Number(currentProduct?.categoryId)) score += 24;
  if (PRODUCT_RECOMMENDATION_ACCESSORY_KEYWORDS.some((keyword) => text.includes(keyword))) score += 18;
  if (currentText && PRODUCT_RECOMMENDATION_ACCESSORY_KEYWORDS.some((keyword) => currentText.includes(keyword) && text.includes(keyword))) score += 8;
  if (candidate?.activeLimitedTimeDiscount || Number(candidate?.effectiveDiscountPercent || candidate?.discount || 0) > 0) score += 6;
  const reviewCount = Number(candidate?.reviewCount || 0);
  const averageRating = Number(candidate?.averageRating || 0);
  if (reviewCount > 0) score += Math.min(5, Math.floor(reviewCount / 10) + 1);
  if (averageRating > 0) score += Math.min(5, averageRating);
  return score;
};


export const buildRelatedRecommendations = <T extends ProductRecommendationCandidate & { id?: number | string }>(
  currentProduct: ProductRecommendationCandidate | null | undefined,
  recommendations: T[],
): T[] => {
  const currentId = Number(currentProduct?.id);
  return (Array.from(
    recommendations
      .filter((item) => Number(item.id) !== currentId)
      .reduce((itemsById, item) => {
        const recommendationId = Number(item.id);
        if (Number.isFinite(recommendationId) && !itemsById.has(recommendationId)) {
          itemsById.set(recommendationId, item);
        }
        return itemsById;
      }, new Map<number, T>())
      .values(),
  ) as T[])
    .map((item, index) => ({ item, index, score: scoreRelatedRecommendation(currentProduct, item) }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((entry) => entry.item);
};

export const buildCompleteSetItems = <T extends ProductRecommendationCandidate>(
  relatedRecommendations: T[],
  limit = 2,
): T[] => relatedRecommendations
  .filter((item) => !isRecommendationUnavailable(item))
  .slice(0, limit);


export interface PendingProductQuestion {
  id: string;
  question: string;
  createdAt: string;
}

export const eagerImagePriorityProps = { fetchpriority: 'high' } as unknown as React.ImgHTMLAttributes<HTMLImageElement>;
export const lazyImagePriorityProps = { fetchpriority: 'auto' } as unknown as React.ImgHTMLAttributes<HTMLImageElement>;

export const PRODUCT_QUESTION_MAX_LENGTH = 500;
export const PRODUCT_SIZE_CALCULATOR_MAX_WEIGHT_KG = 200;

export type ProductVariantLike = {
  options?: Record<string, string> | null;
  sku?: string | null;
} | null | undefined;

export type BundleInfoLike = {
  title?: string;
  items?: Array<{ name?: string; quantity?: number }>;
} | null | undefined;

/** Exact selected-option match used by commercial purchase and stock resolution. */
export const findSelectedProductVariant = <T extends ProductVariantLike>(
  variants: T[],
  selectedOptions: Record<string, string>,
): T | undefined => {
  if (!variants.length) return undefined;
  return variants.find((variant) => {
    const variantOptions = variant?.options || {};
    const variantKeys = Object.keys(variantOptions);
    const selectedKeys = Object.keys(selectedOptions).filter((key) => selectedOptions[key]);
    return variantKeys.length === selectedKeys.length
      && variantKeys.every((key) => selectedOptions[key] === variantOptions[key])
      && selectedKeys.every((key) => Object.prototype.hasOwnProperty.call(variantOptions, key));
  });
};

export const buildSelectedSpecsPayload = (
  selectedOptions: Record<string, string>,
  selectedVariant: ProductVariantLike,
  purchaseMode: 'once' | 'bundle',
  bundleInfo: BundleInfoLike,
) => JSON.stringify({
  ...selectedOptions,
  ...(selectedVariant?.sku ? { _variantSku: selectedVariant.sku } : {}),
  ...(purchaseMode === 'bundle' && bundleInfo ? {
    _purchaseMode: 'bundle',
    _bundleTitle: bundleInfo.title,
    _bundleItems: (bundleInfo.items || []).map((item) => `${item.name} x${item.quantity || 1}`).join(', '),
  } : {}),
});


export const stripQuestionControlChars = (value: string) =>
  Array.from(value, (char) => {
    const code = char.charCodeAt(0);
    return code <= 31 || code === 127 ? ' ' : char;
  }).join('');

export const normalizeQuestionText = (value: string) => (
  stripQuestionControlChars(value).trim().replace(/\s+/g, ' ').slice(0, PRODUCT_QUESTION_MAX_LENGTH)
);

export const normalizeSizeCalculatorWeight = (value: string) => {
  if (!value.trim()) return '';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '';
  return String(Math.min(PRODUCT_SIZE_CALCULATOR_MAX_WEIGHT_KG, Math.max(0, numeric)));
};

export const PRODUCT_DETAIL_TAB_KEYS = ['details', 'specs', 'service'] as const;
export type ProductDetailTabKey = (typeof PRODUCT_DETAIL_TAB_KEYS)[number];

export const normalizeProductDetailTab = (value: string | null | undefined): ProductDetailTabKey => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'specs' || normalized === '2') return 'specs';
  if (normalized === 'service' || normalized === 'shipping' || normalized === '3') return 'service';
  if (normalized === 'details' || normalized === '1' || normalized === 'detail') return 'details';
  return 'details';
};
