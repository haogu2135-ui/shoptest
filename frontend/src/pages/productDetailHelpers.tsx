import React from 'react';
import { ShopIcon, SI } from '../components/ShopIcon';
import type { ProductPublic as Product } from '../types';
import { loadFallbackProductCatalog, loadProductCatalogSnapshot } from '../utils/productCatalogSnapshot';
import { resolveApiAssetUrl } from '../utils/mediaAssets';
import { productImageFallback } from '../utils/productMedia';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import { estimatePetSize, getLowStockCount } from '../utils/conversionConfig';
import type { ProductOptionGroup } from '../utils/productOptions';
import { getLocalizedOptionLabel, isSizeOptionName } from '../utils/localizedProductOptions';

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
  price: number;
  title?: string;
  items?: Array<{ name?: string; quantity?: number; productId?: number }>;
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

export type ProductDetailTranslate = (key: string, params?: Record<string, string | number>) => string;

export type ProductDetailPricingState = {
  activePrice: number;
  displayPrice: number;
  bundleSavings: number;
  purchaseSubtotal: number;
  purchaseSavings: number;
  discountPercent: number;
  originalReferencePrice?: number;
  priceSavingsAmount: number;
  priceSavingsPercent: number;
};

export type ProductDetailSelectionState = {
  selectedStock: number | undefined;
  isOutOfStock: boolean;
  stockLabel: string | number;
  lowStockCount: number | null;
  isLowStock: boolean;
  hasCompleteOptions: boolean;
  hasUnavailableSelectedVariant: boolean;
  optionsMissing: boolean;
  purchaseSelectionBlocked: boolean;
};

export type ProductDetailActionBlockState = {
  addToCartBlocked: boolean;
  mobileAddToCartBlocked: boolean;
  buyNowBlocked: boolean;
};

export type ProductDetailRecommendedPath = {
  recommendedPurchaseMode: 'once' | 'bundle';
  recommendedPathTitle: string;
  recommendedPathText: string;
};

export const deriveProductDetailPricing = (params: {
  product: Product;
  selectedVariant?: { price?: number } | null;
  purchaseMode: 'once' | 'bundle';
  bundleInfo?: BundleInfoLike | null;
  quantity: number;
}): ProductDetailPricingState => {
  const activePrice = params.selectedVariant?.price
    ?? params.product.effectivePrice
    ?? params.product.price;
  const displayPrice = params.purchaseMode === 'bundle' && params.bundleInfo
    ? params.bundleInfo.price
    : activePrice;
  const bundleSavings = params.bundleInfo
    ? Math.max(0, activePrice - params.bundleInfo.price)
    : 0;
  const purchaseSubtotal = displayPrice * params.quantity;
  const purchaseSavings = params.purchaseMode === 'bundle'
    ? bundleSavings * params.quantity
    : 0;
  const discountPercent = params.product.effectiveDiscountPercent || params.product.discount || 0;
  const originalReferencePrice = params.product.originalPrice && params.product.originalPrice > displayPrice
    ? params.product.originalPrice
    : undefined;
  const priceSavingsAmount = originalReferencePrice
    ? Math.max(0, originalReferencePrice - displayPrice)
    : 0;
  const priceSavingsPercent = originalReferencePrice
    ? Math.max(1, Math.round((priceSavingsAmount / originalReferencePrice) * 100))
    : discountPercent;
  return {
    activePrice,
    displayPrice,
    bundleSavings,
    purchaseSubtotal,
    purchaseSavings,
    discountPercent,
    originalReferencePrice,
    priceSavingsAmount,
    priceSavingsPercent,
  };
};

export const deriveProductDetailSelectionState = (params: {
  selectedStock: number | undefined;
  quantity: number;
  optionGroups: ProductOptionGroup[];
  variantsLength: number;
  selectedVariant: unknown;
  selectedOptions: Record<string, string>;
  enoughStockLabel: string | number;
}): ProductDetailSelectionState => {
  const isOutOfStock = params.selectedStock !== undefined && params.selectedStock <= 0;
  const stockLabel = params.selectedStock !== undefined ? params.selectedStock : params.enoughStockLabel;
  const lowStockCount = getLowStockCount(params.selectedStock, params.quantity);
  const isLowStock = !isOutOfStock && lowStockCount !== null && lowStockCount > 0;
  const hasCompleteOptions = params.optionGroups.every((group) => params.selectedOptions[group.name]);
  const hasUnavailableSelectedVariant = params.variantsLength > 0 && hasCompleteOptions && !params.selectedVariant;
  const optionsMissing = params.optionGroups.length > 0 && !hasCompleteOptions;
  const purchaseSelectionBlocked = optionsMissing || hasUnavailableSelectedVariant;
  return {
    selectedStock: params.selectedStock,
    isOutOfStock,
    stockLabel,
    lowStockCount,
    isLowStock,
    hasCompleteOptions,
    hasUnavailableSelectedVariant,
    optionsMissing,
    purchaseSelectionBlocked,
  };
};

export const deriveProductDetailActionBlockState = (params: {
  isOutOfStock: boolean;
  purchaseSelectionBlocked: boolean;
  purchaseSubmitting: string | null;
}): ProductDetailActionBlockState => {
  const addToCartBlocked = params.isOutOfStock
    || params.purchaseSelectionBlocked
    || params.purchaseSubmitting !== null;
  const mobileAddToCartBlocked = !params.isOutOfStock
    && (params.purchaseSelectionBlocked || params.purchaseSubmitting !== null);
  const buyNowBlocked = params.isOutOfStock
    || params.purchaseSelectionBlocked
    || params.purchaseSubmitting !== null;
  return {
    addToCartBlocked,
    mobileAddToCartBlocked,
    buyNowBlocked,
  };
};

export const formatLimitedTimeCountdown = (
  milliseconds: number,
  t: ProductDetailTranslate,
) => {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const time = [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
  return days > 0 ? `${t('pages.productDetail.limitedTimeDays', { count: days })} ${time}` : time;
};

export const resolveRecommendedPurchaseMode = (params: {
  bundleInfo?: BundleInfoLike | null;
  bundleSavings: number;
}): 'once' | 'bundle' => (
  params.bundleInfo && params.bundleSavings > 0 ? 'bundle' : 'once'
);

export const buildRecommendedPurchasePath = (params: {
  recommendedPurchaseMode: 'once' | 'bundle';
  bundleInfo?: BundleInfoLike | null;
  bundleSavings: number;
  quantity: number;
  t: ProductDetailTranslate;
  formatMoney: (value: number) => string;
  renderAmountText: (label: string, amount: string) => React.ReactNode;
}): ProductDetailRecommendedPath & { recommendedPathTextNode: React.ReactNode } => {
  const recommendedPathTitle = params.recommendedPurchaseMode === 'bundle'
    ? params.t('pages.productDetail.pathBundleTitle')
    : params.t('pages.productDetail.pathOnceTitle');
  const recommendedPathText = params.recommendedPurchaseMode === 'bundle' && params.bundleInfo
    ? params.t('pages.productDetail.pathBundleText', { amount: params.formatMoney(params.bundleSavings * params.quantity) })
    : params.t('pages.productDetail.pathOnceText');
  const recommendedPathTextNode = params.recommendedPurchaseMode === 'bundle' && params.bundleInfo
    ? params.renderAmountText(
      params.t('pages.productDetail.pathBundleText', { amount: params.formatMoney(params.bundleSavings * params.quantity) }),
      params.formatMoney(params.bundleSavings * params.quantity),
    )
    : params.t('pages.productDetail.pathOnceText');
  return {
    recommendedPurchaseMode: params.recommendedPurchaseMode,
    recommendedPathTitle,
    recommendedPathText,
    recommendedPathTextNode,
  };
};

export const resolveSizeCalculatorWeightKg = (sizeCalculatorWeight: string) => Math.min(
  PRODUCT_SIZE_CALCULATOR_MAX_WEIGHT_KG,
  Math.max(0, Number(sizeCalculatorWeight || 0)),
);

export const resolveRecommendedSizeMatch = (params: {
  sizeOptionGroup?: ProductOptionGroup | null;
  sizeCalculatorBreed: string;
  sizeCalculatorWeightKg: number;
}) => {
  const recommendedSize = estimatePetSize(params.sizeCalculatorBreed, params.sizeCalculatorWeightKg);
  const recommendedSizeValue = params.sizeOptionGroup?.values.find(
    (value) => value.toLowerCase() === String(recommendedSize || '').toLowerCase(),
  );
  return {
    recommendedSize,
    recommendedSizeValue,
  };
};

export const buildProductDetailActionLabels = (params: {
  t: ProductDetailTranslate;
  productName: string;
  isAlerted: boolean;
  isWishlisted: boolean;
  isCompared: boolean;
}) => {
  const { t, productName } = params;
  return {
    addCartActionLabel: `${t('pages.productDetail.addCart')}: ${productName}`,
    buyNowActionLabel: `${t('pages.productDetail.buyNow')}: ${productName}`,
    selectOptionsActionLabel: `${t('pages.wishlist.selectOptions')}: ${productName}`,
    questionInputLabel: `${t('pages.ask.title')}: ${productName}`,
    questionSubmitActionLabel: `${t('pages.ask.submit')}: ${productName}`,
    stockAlertActionLabel: `${params.isAlerted ? t('pages.stockAlerts.remove') : t('pages.stockAlerts.notifyMe')}: ${productName}`,
    favoriteActionLabel: `${params.isWishlisted ? t('pages.productDetail.favorited') : t('pages.productDetail.favorite')}: ${productName}`,
    compareActionLabel: `${params.isCompared ? t('pages.productList.viewCompare') : t('pages.productList.compare')}: ${productName}`,
    homeActionLabel: `${t('nav.ariaHome')}: ${productName}`,
    sizeGuideActionLabel: `${t('pages.productDetail.sizeGuide')}: ${productName}`,
    resetSelectedOptionsActionLabel: `${t('pages.productList.resetFilters')}: ${productName}`,
    sizeBreedInputLabel: `${t('pages.productDetail.sizeCalculatorBreed')}: ${productName}`,
    sizeWeightInputLabel: `${t('pages.productDetail.sizeCalculatorWeight')}: ${productName}`,
    purchaseModeActionLabel: `${t('pages.productDetail.purchaseMode')}: ${productName}`,
    useRecommendedPathActionLabel: `${t('pages.productDetail.useRecommendedPath')}: ${productName}`,
    sizeGuideConfirmActionLabel: `${t('pages.productDetail.sizeGuideGotIt')}: ${t('pages.productDetail.sizeGuideTitle')}, ${productName}`,
  };
};

export const resolveMobilePurchaseStatus = (params: {
  t: ProductDetailTranslate;
  isOutOfStock: boolean;
  hasUnavailableSelectedVariant: boolean;
  optionsMissing: boolean;
  isLowStock: boolean;
  lowStockUrgencyLabel: string;
}) => {
  if (params.isOutOfStock) return params.t('pages.productDetail.soldOut');
  if (params.hasUnavailableSelectedVariant) return params.t('pages.productDetail.selectedVariantUnavailable');
  if (params.optionsMissing) return params.t('pages.productDetail.decisionOptionsMissingText');
  if (params.isLowStock) return params.lowStockUrgencyLabel;
  return params.t('pages.productDetail.decisionReady');
};

export const resolveBuyNowBlockedReason = (params: {
  t: ProductDetailTranslate;
  productName: string;
  isOutOfStock: boolean;
  purchaseSelectionBlocked: boolean;
  selectOptionsActionLabel: string;
  buyNowActionLabel: string;
}) => {
  if (params.isOutOfStock) return `${params.t('pages.productDetail.soldOut')}: ${params.productName}`;
  if (params.purchaseSelectionBlocked) return params.selectOptionsActionLabel;
  return params.buyNowActionLabel;
};

export type ProductDetailChecklistItemData = {
  key: string;
  ready: boolean;
  title: string;
  text: React.ReactNode;
};

export const buildProductDetailDecisionChecklistData = (params: {
  t: ProductDetailTranslate;
  isOutOfStock: boolean;
  isLowStock: boolean;
  optionGroupsLength: number;
  hasCompleteOptions: boolean;
  hasUnavailableSelectedVariant: boolean;
  lowStockCount: number | null;
  stockLabel: string | number;
  deliveryEnabled: boolean;
  deliveryWindowText?: string;
  productShippingText: React.ReactNode;
}): ProductDetailChecklistItemData[] => ([
  {
    key: 'options',
    // Commercial trust: never mark options "ready to add" when the SKU is sold out.
    ready: !params.isOutOfStock && (params.optionGroupsLength === 0 || (params.hasCompleteOptions && !params.hasUnavailableSelectedVariant)),
    title: params.isOutOfStock
      ? params.t('pages.productDetail.decisionStockOutTitle')
      : params.optionGroupsLength === 0
        ? params.t('pages.productDetail.decisionNoOptionsTitle')
        : params.hasCompleteOptions && !params.hasUnavailableSelectedVariant
          ? params.t('pages.productDetail.decisionOptionsReadyTitle')
          : params.t('pages.productDetail.decisionOptionsMissingTitle'),
    text: params.isOutOfStock
      ? params.t('pages.productDetail.decisionStockOutText')
      : params.optionGroupsLength === 0
        ? params.t('pages.productDetail.decisionNoOptionsText')
        : params.hasCompleteOptions && !params.hasUnavailableSelectedVariant
          ? params.t('pages.productDetail.decisionOptionsReadyText')
          : params.t('pages.productDetail.decisionOptionsMissingText'),
  },
  {
    key: 'stock',
    ready: !params.isOutOfStock && !params.isLowStock,
    title: params.isOutOfStock
      ? params.t('pages.productDetail.decisionStockOutTitle')
      : params.isLowStock
        ? params.t('pages.productDetail.decisionStockLowTitle')
        : params.t('pages.productDetail.decisionStockReadyTitle'),
    text: params.isOutOfStock
      ? params.t('pages.productDetail.decisionStockOutText')
      : params.isLowStock
        ? params.t('pages.productDetail.decisionStockLowText', { count: params.lowStockCount as number, stock: params.stockLabel })
        : params.t('pages.productDetail.decisionStockReadyText', { stock: params.stockLabel }),
  },
  {
    key: 'delivery',
    ready: Boolean(params.deliveryEnabled),
    title: params.t('pages.productDetail.trustShippingTitle'),
    text: params.deliveryEnabled
      ? params.t('pages.productDetail.deliveryPromise', { window: params.deliveryWindowText || '' })
      : params.productShippingText,
  },
]);

export const buildProductDetailPurchaseReadinessData = (params: {
  t: ProductDetailTranslate;
  isOutOfStock: boolean;
  isLowStock: boolean;
  purchaseSelectionBlocked: boolean;
  optionGroupsLength: number;
  hasUnavailableSelectedVariant: boolean;
  hasCompleteOptions: boolean;
  stockLabel: string | number;
  lowStockCount: number | null;
  deliveryEnabled: boolean;
  deliveryWindowText?: string;
  productShippingText: React.ReactNode;
  purchaseSavings: number;
  purchaseSubtotal: number;
  formatMoney: (value: number) => string;
}): ProductDetailChecklistItemData[] => ([
  {
    key: 'selection',
    // Commercial trust: sold-out SKUs must never claim "ready to add" / direct-add copy.
    ready: !params.isOutOfStock && !params.purchaseSelectionBlocked,
    title: params.isOutOfStock
      ? params.t('pages.productDetail.decisionStockOutTitle')
      : params.optionGroupsLength === 0
        ? params.t('pages.productDetail.decisionNoOptionsTitle')
        : params.purchaseSelectionBlocked
          ? params.t('pages.productDetail.decisionOptionsMissingTitle')
          : params.t('pages.productDetail.decisionOptionsReadyTitle'),
    text: params.isOutOfStock
      ? params.t('pages.productDetail.decisionStockOutText')
      : params.optionGroupsLength === 0
        ? params.t('pages.productDetail.decisionNoOptionsText')
        : params.hasUnavailableSelectedVariant
          ? params.t('pages.productDetail.selectedVariantUnavailable')
          : params.hasCompleteOptions
            ? params.t('pages.productDetail.selectedVariantStock', { stock: params.stockLabel })
            : params.t('pages.productDetail.selectedOptionsEmpty'),
  },
  {
    key: 'stock',
    ready: !params.isOutOfStock && !params.isLowStock,
    title: params.isOutOfStock
      ? params.t('pages.productDetail.decisionStockOutTitle')
      : params.isLowStock
        ? params.t('pages.productDetail.decisionStockLowTitle')
        : params.t('pages.productDetail.decisionStockReadyTitle'),
    text: params.isOutOfStock
      ? params.t('pages.productDetail.decisionStockOutText')
      : params.isLowStock
        ? params.t('pages.productDetail.decisionStockLowText', { count: params.lowStockCount as number, stock: params.stockLabel })
        : params.t('pages.productDetail.decisionStockReadyText', { stock: params.stockLabel }),
  },
  {
    key: 'delivery',
    ready: Boolean(params.deliveryEnabled),
    title: params.t('pages.productDetail.trustShippingTitle'),
    text: params.deliveryEnabled
      ? params.t('pages.productDetail.deliveryPromise', { window: params.deliveryWindowText || '' })
      : params.productShippingText,
  },
  {
    key: 'value',
    ready: true,
    title: params.purchaseSavings > 0
      ? params.t('pages.productDetail.purchaseSavings')
      : params.t('pages.productDetail.purchaseSubtotal'),
    text: params.purchaseSavings > 0
      ? params.formatMoney(params.purchaseSavings)
      : params.formatMoney(params.purchaseSubtotal),
  },
]);

export const buildProductDetailFaqItems = (t: ProductDetailTranslate) => ([
  {
    question: t('pages.productDetail.faqQuietQuestion'),
    answer: t('pages.productDetail.faqQuietAnswer'),
  },
  {
    question: t('pages.productDetail.faqFilterQuestion'),
    answer: t('pages.productDetail.faqFilterAnswer'),
  },
  {
    question: t('pages.productDetail.faqReplaceQuestion'),
    answer: t('pages.productDetail.faqReplaceAnswer'),
  },
]);


export const renderProductDetailAmountText = (label: string, amount: string): React.ReactNode => {
  const parts = label.split(amount);
  if (parts.length <= 1) return label;
  return (
    <span className="product-detail__amountPhrase commerce-atomic">
      {parts.map((part, index) => (
        <React.Fragment key={`${part}-${index}`}>
          {part}
          {index < parts.length - 1 ? <span className="commerce-money">{amount}</span> : null}
        </React.Fragment>
      ))}
    </span>
  );
};

export const buildProductDetailShippingCopy = (params: {
  t: ProductDetailTranslate;
  freeShippingThreshold: number;
  formatMoney: (value: number) => string;
  productFreeShipping?: boolean | null;
  productShipping?: string | null;
}) => {
  const freeShippingThresholdAmount = params.formatMoney(params.freeShippingThreshold);
  const productFreeShippingText = params.freeShippingThreshold > 0
    ? renderProductDetailAmountText(
      params.t('pages.productDetail.freeShippingOver', { amount: freeShippingThresholdAmount }),
      freeShippingThresholdAmount,
    )
    : params.t('pages.productDetail.freeShipping');
  const productShippingText = params.productFreeShipping
    ? params.t('pages.productDetail.freeShipping')
    : params.productShipping || productFreeShippingText;
  return {
    freeShippingThresholdAmount,
    productFreeShippingText,
    productShippingText,
  };
};

export const resolveProductDetailPurchaseModeLabel = (
  purchaseMode: 'once' | 'bundle',
  t: ProductDetailTranslate,
) => (
  purchaseMode === 'bundle'
    ? t('bundle.bundleDeal')
    : t('pages.productDetail.oneTimePurchase')
);

export const resolveProductDetailCartActionLabels = (params: {
  purchaseSelectionBlocked: boolean;
  selectOptionsActionLabel: string;
  addCartActionLabel: string;
}) => {
  const addToCartActionLabel = params.purchaseSelectionBlocked
    ? params.selectOptionsActionLabel
    : params.addCartActionLabel;
  const mobileCartBlockedReason = params.purchaseSelectionBlocked
    ? params.selectOptionsActionLabel
    : addToCartActionLabel;
  return {
    addToCartActionLabel,
    mobileCartBlockedReason,
  };
};

export type ProductDetailSelectedOptionTag = {
  name: string;
  label: string;
  value: string;
  valueLabel: string;
};

export const buildProductDetailSelectedOptionTags = (
  optionGroups: ProductOptionGroup[],
  selectedOptions: Record<string, string>,
  language: string,
): ProductDetailSelectedOptionTag[] => optionGroups
  .map((group) => ({
    name: group.name,
    label: getLocalizedOptionLabel(group.name, language),
    value: selectedOptions[group.name],
    valueLabel: getLocalizedOptionLabel(selectedOptions[group.name] || '', language),
  }))
  .filter((item): item is ProductDetailSelectedOptionTag => Boolean(item.value));

export const buildProductDetailFitGuidance = (params: {
  t: ProductDetailTranslate;
  language: string;
  optionGroups: ProductOptionGroup[];
  sizeCalculatorBreed: string;
  sizeCalculatorWeight: string;
  hasCompleteOptions: boolean;
}) => {
  const sizeOptionGroup = params.optionGroups.find((group) => isSizeOptionName(group.name));
  const sizeCalculatorWeightKg = resolveSizeCalculatorWeightKg(params.sizeCalculatorWeight);
  const { recommendedSize, recommendedSizeValue } = resolveRecommendedSizeMatch({
    sizeOptionGroup,
    sizeCalculatorBreed: params.sizeCalculatorBreed,
    sizeCalculatorWeightKg,
  });
  const recommendedSizeLabel = recommendedSizeValue
    ? getLocalizedOptionLabel(recommendedSizeValue, params.language)
    : getLocalizedOptionLabel(String(recommendedSize || ''), params.language);
  const fitConfidenceText = sizeOptionGroup
    ? recommendedSizeValue
      ? params.t('pages.productDetail.fitConfidenceMatched', { size: recommendedSizeLabel })
      : params.hasCompleteOptions
        ? params.t('pages.productDetail.fitConfidenceSelected')
        : params.t('pages.productDetail.fitConfidenceNeedSize')
    : params.t('pages.productDetail.fitConfidenceNoSize');
  return {
    sizeOptionGroup,
    sizeCalculatorWeightKg,
    recommendedSize,
    recommendedSizeValue,
    recommendedSizeLabel,
    fitConfidenceText,
  };
};

export const buildProductDetailQuantityLabels = (
  t: ProductDetailTranslate,
  quantity: number,
) => ({
  quantityValueLabel: t('pages.productDetail.quantityValue', { quantity }),
  decreaseQuantityLabel: t('pages.productDetail.decreaseQuantity', { quantity }),
  increaseQuantityLabel: t('pages.productDetail.increaseQuantity', { quantity }),
});

export const shouldShowProductDetailDecisionChecklist = (params: {
  optionsMissing: boolean;
  hasUnavailableSelectedVariant: boolean;
  isOutOfStock: boolean;
  isLowStock: boolean;
}) => (
  params.optionsMissing
  || params.hasUnavailableSelectedVariant
  || params.isOutOfStock
  || params.isLowStock
);

export const resolveProductDetailChecklistIconPath = (key: string) => {
  if (key === 'options' || key === 'selection') return SI.checkCircle;
  if (key === 'stock') return SI.safety;
  if (key === 'delivery') return SI.truck;
  return SI.thunder;
};


export const resolveProductDetailLowStockUrgencyLabel = (params: {
  t: ProductDetailTranslate;
  isLowStock: boolean;
  lowStockCount: number;
}): string => (
  params.isLowStock
    ? params.t('pages.productDetail.lowStockUrgency', { count: params.lowStockCount })
    : ''
);

export const buildProductDetailMobileBuybarPresentation = (params: {
  displayPrice: number;
  formatMoney: (value: number) => string;
  mobilePurchaseStatus: string;
}) => ({
  mobileBuybarPrice: params.formatMoney(params.displayPrice),
  mobileBuybarStatus: params.mobilePurchaseStatus,
});

export type ProductDetailChecklistItemWithIcon = ProductDetailChecklistItemData & {
  icon: React.ReactNode;
};

export const withProductDetailChecklistIcons = (
  items: ProductDetailChecklistItemData[],
): ProductDetailChecklistItemWithIcon[] => items.map((item) => ({
  ...item,
  icon: <ShopIcon path={resolveProductDetailChecklistIconPath(item.key)} />,
}));

/** Assemble ProductDetailMainShell prop bag in one pure surface for residual modularization. */
export const buildProductDetailMainShellProps = <T extends Record<string, unknown>>(props: T): T => props;

/** Early-return shell prop bags — keep ProductDetail free of inline shell object literals. */
export const buildProductDetailLoadingShellProps = <T extends Record<string, unknown>>(props: T): T => props;

export const buildProductDetailLoadErrorShellProps = <T extends Record<string, unknown>>(props: T): T => props;

export const buildProductDetailNotFoundShellProps = <T extends Record<string, unknown>>(props: T): T => props;


export const resolveProductDetailPageTitle = (params: {
  t: ProductDetailTranslate;
  productName?: string | null;
  loadError?: string | null;
}): string => {
  const name = String(params.productName || '').trim();
  if (name) return name;
  if (params.loadError) return params.t('pages.productDetail.loadFailed');
  return '';
};

export const resolveProductDetailSeoDescription = (params: {
  t: ProductDetailTranslate;
  productDescription?: string | null;
  loadError?: string | null;
}): string => {
  const raw = String(params.productDescription || '').replace(/\s+/g, ' ').trim();
  if (raw) return raw.slice(0, 300);
  if (params.loadError) return params.t('pages.productDetail.loadFailedDescription');
  return params.t('common.siteDescription');
};

export const resolveProductDetailSeoImage = (params: {
  selectedImage?: string | null;
  productImageUrl?: string | null;
  productImages?: string[] | null;
}): string => (
  params.selectedImage
  || params.productImageUrl
  || params.productImages?.[0]
  || ''
);

export const resolveProductDetailVariantGallerySelection = (params: {
  galleryImages: string[];
  variantImageUrl?: string | null;
}): { imageUrl: string; galleryIndex: number } | null => {
  const imageUrl = String(params.variantImageUrl || '').trim();
  if (!imageUrl) return null;
  const galleryIndex = params.galleryImages.indexOf(imageUrl);
  return { imageUrl, galleryIndex };
};

