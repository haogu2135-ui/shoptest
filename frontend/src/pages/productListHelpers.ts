import React from 'react';
import type { ProductPublic as Product, CategoryPublic } from '../types';
import { getProductOptionGroups, getProductVariants } from '../utils/productOptions';
import { conversionConfig, getLowStockCount } from '../utils/conversionConfig';
import { resolveProductImage } from '../utils/productMedia';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import {
  getLocalStorageItem,
  setLocalStorageItem,
} from '../utils/safeStorage';

export const PRODUCT_LIST_FILTER_HINT_KEY = 'shop-product-list-filter-hint-dismissed';
export const SEARCH_HISTORY_KEY = 'shop-product-search-history';
export const MAX_SEARCH_HISTORY = 6;
export const MAX_SEARCH_LENGTH = 80;
export const PRODUCT_LIST_PAGE_SIZE = 12;
export const PRODUCT_LIST_FETCH_SIZE = PRODUCT_LIST_PAGE_SIZE * 8;
export const CATEGORY_CACHE_TTL = 5 * 60 * 1000;
export const DEFAULT_PRICE_RANGE: [number, number] = [0, 10000];
export const SMART_DEVICE_CATEGORY_IDS = new Set([10, 11]);
export const SMART_DEVICE_TERMS = ['smart', 'automatic', 'feeder', 'feeders', 'fountain', 'waterer', 'waterers', 'camera', 'tracker', 'sensor', 'device', 'connected'];
export const VALID_SORT_VALUES = new Set([
  'default',
  'personalized-desc',
  'quick-add-desc',
  'best-value-desc',
  'low-stock-desc',
  'price-asc',
  'price-desc',
  'discount-desc',
  'positive-rate-desc',
  'name',
]);
export const VALID_PET_SIZES = new Set(['Small', 'Medium', 'Large']);
export const VALID_MATERIALS = new Set(['Cotton', 'Nylon', 'Silicone', 'Wood']);
export const VALID_COLORS = new Set(['Black', 'Blue', 'Green', 'Pink']);
export const VALID_COLLECTIONS = new Set(['smart-devices']);
export const resolveProductListImage = resolveProductImage;
export const resolveProductPrimaryImage = (product: Product) => {
  const galleryImage = Array.isArray(product.images) ? product.images.find((image) => String(image || '').trim()) : '';
  return resolveProductListImage(product.imageUrl || galleryImage || '');
};
export const productListImageSizes = '(max-width: 575px) 50vw, (max-width: 991px) 33vw, 25vw';
export const eagerImagePriorityProps = { fetchpriority: 'high' } as unknown as React.ImgHTMLAttributes<HTMLImageElement>;
export const lazyImagePriorityProps = { fetchpriority: 'auto' } as unknown as React.ImgHTMLAttributes<HTMLImageElement>;
export const shouldShowCatalogFallbackToast = process.env.NODE_ENV !== 'production';

export const readSearchHistory = () => {
  try {
    const parsed = JSON.parse(getLocalStorageItem(SEARCH_HISTORY_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean).slice(0, MAX_SEARCH_HISTORY) : [];
  } catch (error) {
    reportNonBlockingError('ProductList.readSearchHistory', error);
    return [];
  }
};

export const writeSearchHistory = (history: string[]) => {
  setLocalStorageItem(SEARCH_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_SEARCH_HISTORY)));
};

export const normalizeSearchValue = (value: string) => value.replace(/\s+/g, ' ').trim().slice(0, MAX_SEARCH_LENGTH);
export const normalizeSortValue = (value: string | null | undefined) =>
  value && VALID_SORT_VALUES.has(value) ? value : 'default';
export const normalizePetSizeValue = (value: string | null | undefined) =>
  value && VALID_PET_SIZES.has(value) ? value : '';
export const normalizePetSizeValues = (values: Array<string | null | undefined>) =>
  Array.from(new Set(values.map(normalizePetSizeValue).filter(Boolean)));
export const normalizeOptionValues = (values: Array<string | null | undefined>, allowedValues: Set<string>) => {
  const allowedByLower = new Map(Array.from(allowedValues).map((value) => [value.toLowerCase(), value]));
  return Array.from(new Set(values
    .map((value) => allowedByLower.get(String(value || '').trim().toLowerCase()))
    .filter(Boolean))) as string[];
};
export const normalizeCollectionValue = (value: string | null | undefined) =>
  value && VALID_COLLECTIONS.has(value) ? value : '';
export const parsePositiveId = (value: string | null) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};
export const normalizePageNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
};
export const parsePageParam = (value: string | null) => normalizePageNumber(value || 1);
export const parsePriceParam = (value: string | null) => {
  if (value === null || value.trim() === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
};

export const DEFAULT_CATALOG_TITLE_BY_LANGUAGE = {
  en: 'Pet supplies',
  zh: '\u5ba0\u7269\u7528\u54c1',
  es: 'Productos para mascotas',
} as const;

export const getDefaultCatalogTitle = (language: string) =>
  DEFAULT_CATALOG_TITLE_BY_LANGUAGE[language as keyof typeof DEFAULT_CATALOG_TITLE_BY_LANGUAGE]
  || DEFAULT_CATALOG_TITLE_BY_LANGUAGE.en;

export const normalizeCatalogTitle = (value: string | null | undefined, fallback: string) => {
  const title = String(value || '').replace(/\s+/g, ' ').trim();
  const normalized = title.toLowerCase();
  if (
    !title
    || normalized === 'catalog title'
    || normalized === 'pages.productlist.catalogtitle'
    || normalized === 'pages.products.catalogtitle'
  ) {
    return fallback;
  }
  return title;
};

export const productSearchText = (product: Product) => [
  product.name,
  product.description,
  product.brand,
  product.tag,
  ...Object.values(product.specifications || {}),
].join(' ').toLowerCase();

export const matchesSmartDeviceCollection = (product: Product) => {
  if (SMART_DEVICE_CATEGORY_IDS.has(Number(product.categoryId))) {
    return true;
  }
  const text = productSearchText(product);
  return SMART_DEVICE_TERMS.some((term) => text.includes(term));
};

export const matchesDiscountFilter = (product: Product) =>
  Boolean(product.activeLimitedTimeDiscount) ||
  Number(product.effectiveDiscountPercent || product.discount || 0) > 0 ||
  (product.originalPrice !== undefined && Number(product.originalPrice) > Number(product.effectivePrice ?? product.price ?? 0));

export const filterSnapshotProducts = (products: Product[], keyword?: string, categoryId?: number, discount?: boolean, collection?: string) => {
  const normalizedKeyword = normalizeSearchValue(keyword || '').toLowerCase();
  return products.filter((product) => {
    if (collection === 'smart-devices' && !matchesSmartDeviceCollection(product)) return false;
    if (normalizedKeyword && !productSearchText(product).includes(normalizedKeyword)) return false;
    if (categoryId && Number(product.categoryId) !== categoryId) return false;
    if (discount && !matchesDiscountFilter(product)) return false;
    return true;
  });
};

export const pickBestProductFallback = (products: Product[], keyword?: string, categoryId?: number, discount?: boolean, collection?: string) => {
  const filtered = filterSnapshotProducts(products, keyword, categoryId, discount, collection);
  return filtered.length > 0 ? filtered : products;
};

export const notifyCatalogFallback = (text: string) => {
  if (shouldShowCatalogFallbackToast) {
    announceAccessibleMessage(text, 'warning');
  }
};

let categoryCache: { expiresAt: number; items: CategoryPublic[] } | null = null;
let categoryCacheRequest: Promise<CategoryPublic[]> | null = null;

export const getCategoryCache = () => categoryCache;
export const setCategoryCache = (value: { expiresAt: number; items: CategoryPublic[] } | null) => {
  categoryCache = value;
};
export const getCategoryCacheRequest = () => categoryCacheRequest;
export const setCategoryCacheRequest = (value: Promise<CategoryPublic[]> | null) => {
  categoryCacheRequest = value;
};

export const clearProductListSessionCaches = () => {
  categoryCache = null;
  categoryCacheRequest = null;
};

export type ProductListUrlOverrides = Partial<{
  collection: string;
  keyword: string;
  categoryId?: number;
  discount: boolean;
  sortBy: string;
  petSizes: string[];
  materials: string[];
  colors: string[];
  priceRange: [number, number];
  priceFilterTouched: boolean;
  page: number;
}>;

export type ProductFetchFilters = {
  minPrice?: number;
  maxPrice?: number;
  petSizes?: string[];
  materials?: string[];
  colors?: string[];
  collection?: string;
  includeChildren?: boolean;
  sort?: string;
  page?: number;
  size?: number;
};

export type ActiveResultContextAction = {
  key: string;
  icon: React.ReactNode;
  label: string;
  onClear: () => void;
};

export type ProductListTranslate = (key: string, params?: Record<string, string | number>) => string;

export type ProductListCardProps = {
  product: Product;
  index: number;
  currentPage: number;
  productName: string;
  wishlisted: boolean;
  stockAlerted: boolean;
  compared: boolean;
  t: ProductListTranslate;
  formatMoney: (value?: number | null) => string;
  renderSavingsText: (amount: number) => React.ReactNode;
  onPrefetch: (productId: number) => void;
  onPreview: (event: React.MouseEvent, product: Product) => void;
  onQuickAdd: (event: React.MouseEvent, product: Product) => void;
  onStockAlert: (event: React.MouseEvent, product: Product, stockAlerted: boolean) => void;
  onWishlistToggle: (event: React.MouseEvent, product: Product) => void;
  onCompare: (event: React.MouseEvent, product: Product) => void;
};

export const getPrice = (product: Product) => product.effectivePrice ?? product.price;
export const getDiscountPercent = (product: Product) => product.effectiveDiscountPercent || product.discount || 0;
export const getPositiveRate = (product: Product) => product.positiveRate ?? 0;
export const hasReviewSignal = (product: Product) => Number(product.reviewCount || 0) > 0;
export const getSavingsAmount = (product: Product) => Math.max(0, Number(product.originalPrice || 0) - getPrice(product));
export const isProductSoldOut = (product: Product) => product.stock !== undefined && product.stock <= 0;
export const isQuickAddReady = (product: Product) =>
  !isProductSoldOut(product) && getProductOptionGroups(product).length === 0 && getProductVariants(product).length === 0;
export const isBestValueProduct = (product: Product) => {
  const config = conversionConfig.productValueBadge;
  if (!config.enabled) return false;
  return getDiscountPercent(product) >= config.minDiscountPercent
    && getPositiveRate(product) >= config.minPositiveRate
    && Number(product.reviewCount || 0) >= config.minReviewCount;
};

export const buildProductListBadges = (product: Product, t: ProductListTranslate) => {
  const badges: Array<{ label: string; color: string }> = [];
  if (isBestValueProduct(product)) badges.push({ label: t('pages.productList.bestValue'), color: 'green' });
  if (getDiscountPercent(product) > 0) badges.push({ label: t('pages.productList.sale'), color: 'volcano' });
  if (product.tag === 'new') badges.push({ label: t('pages.productList.new'), color: 'blue' });
  if (product.isFeatured) badges.push({ label: t('pages.productList.bestSeller'), color: 'gold' });
  if (getLowStockCount(product.stock) !== null && (product.stock || 0) > 0) badges.push({ label: t('pages.productList.runningLow'), color: 'red' });
  return badges;
};

export type ProductListRefinementFilters = {
  priceFilterActive: boolean;
  displayedPriceRange: [number, number];
  petSizes: string[];
  materials: string[];
  colors: string[];
};

export type PersonalizedSortContext = {
  personalizedProductIds: Set<number>;
  topPreferenceCategory?: string;
  topPreferenceBrand?: string;
  recentProductIds: number[];
};

export type ProductListInsightTotals = {
  bestValueCount: number;
  lowStockCount: number;
  quickAddReadyCount: number;
  totalSavings: number;
};

export type ProductListInsights = {
  bestValueCount: number;
  lowStockCount: number;
  quickAddReadyCount: number;
  averageSavings: number;
};

export const filterCollectionProducts = (
  products: Product[],
  options: {
    collection?: string;
    keyword?: string;
    usingServerPagination?: boolean;
  },
) => {
  let result = products;
  const collection = options.collection || '';
  const keyword = String(options.keyword || '').trim();
  if (!options.usingServerPagination && collection === 'smart-devices') {
    result = result.filter(matchesSmartDeviceCollection);
  }
  if (!options.usingServerPagination && collection && keyword) {
    const normalizedKeyword = keyword.toLowerCase();
    result = result.filter((product) => productSearchText(product).includes(normalizedKeyword));
  }
  return result;
};

export const resolveMaxCatalogPrice = (products: Product[]) => {
  const highestPrice = products.reduce((max, product) => Math.max(max, Number(getPrice(product) || 0)), 0);
  if (highestPrice <= 0) return 50;
  const roundTo = highestPrice > 1000 ? 100 : highestPrice > 200 ? 50 : 10;
  return Math.max(50, Math.ceil(highestPrice / roundTo) * roundTo);
};

export const resolvePriceStep = (maxCatalogPrice: number) =>
  (maxCatalogPrice > 1000 ? 50 : maxCatalogPrice > 200 ? 10 : 5);

export const resolveDisplayedPriceRange = (
  priceRange: [number, number],
  maxCatalogPrice: number,
): [number, number] => {
  const min = Math.min(priceRange[0], maxCatalogPrice);
  const max = Math.min(Math.max(priceRange[1], min), maxCatalogPrice);
  return [min, max];
};

export const isPriceFilterActive = (
  priceFilterTouched: boolean,
  displayedPriceRange: [number, number],
  maxCatalogPrice: number,
) => priceFilterTouched && (displayedPriceRange[0] > 0 || displayedPriceRange[1] < maxCatalogPrice);

export const resolveActiveFilterCount = (
  priceFilterActive: boolean,
  petSizes: string[],
  materials: string[],
  colors: string[],
) => [
  priceFilterActive,
  petSizes.length > 0,
  materials.length > 0,
  colors.length > 0,
].filter(Boolean).length;

export const filterProductsByRefinements = (
  products: Product[],
  filters: ProductListRefinementFilters,
) => products.filter((product) => {
  const price = getPrice(product);
  const specs = product.specifications || {};
  const specText = Object.values(specs).join(' ').toLowerCase();
  const matchPrice = !filters.priceFilterActive
    || (price >= filters.displayedPriceRange[0] && price <= filters.displayedPriceRange[1]);
  const matchSize = filters.petSizes.length === 0
    || filters.petSizes.some((size) => specText.includes(size.toLowerCase()));
  const matchMaterial = filters.materials.length === 0
    || filters.materials.some((material) => specText.includes(material.toLowerCase()));
  const matchColor = filters.colors.length === 0
    || filters.colors.some((color) =>
      specText.includes(color.toLowerCase()) || product.name.toLowerCase().includes(color.toLowerCase()));
  return matchPrice && matchSize && matchMaterial && matchColor;
});

export const resolveTopPreferenceKey = (scores?: Record<string, number>) => {
  const [key] = Object.entries(scores || {})
    .sort((left, right) => Number(right[1] || 0) - Number(left[1] || 0))[0] || [];
  return key;
};

export const buildPersonalizedSortContext = (
  personalizedProducts: Array<Pick<Product, 'id'>>,
  viewPreferences: {
    categories?: Record<string, number>;
    brands?: Record<string, number>;
    recent?: number[];
  },
): PersonalizedSortContext => ({
  personalizedProductIds: new Set(personalizedProducts.map((product) => product.id)),
  topPreferenceCategory: resolveTopPreferenceKey(viewPreferences.categories),
  topPreferenceBrand: resolveTopPreferenceKey(viewPreferences.brands),
  recentProductIds: Array.isArray(viewPreferences.recent) ? viewPreferences.recent : [],
});

export const getPersonalizedSortScore = (
  product: Product,
  context: PersonalizedSortContext,
) =>
  (context.personalizedProductIds.has(product.id) ? 42 : 0) +
  (String(product.categoryId) === context.topPreferenceCategory ? 14 : 0) +
  (context.topPreferenceBrand && product.brand === context.topPreferenceBrand ? 12 : 0) +
  (context.recentProductIds.includes(product.id) ? 6 : 0) +
  (isBestValueProduct(product) ? 34 : 0) +
  (isQuickAddReady(product) ? 18 : 0) +
  Math.min(18, getDiscountPercent(product)) +
  Math.min(14, getPositiveRate(product) / 8) +
  Math.min(10, Number(product.reviewCount || 0) / 2) +
  (getLowStockCount(product.stock) !== null ? 4 : 0);

export const getConversionSortScore = (
  product: Product,
  context: PersonalizedSortContext,
) =>
  getPersonalizedSortScore(product, context) +
  (product.isFeatured ? 12 : 0) +
  (product.activeLimitedTimeDiscount ? 10 : 0) +
  (product.freeShipping ? 8 : 0) +
  (getSavingsAmount(product) > 0 ? Math.min(12, getSavingsAmount(product) / 20) : 0) -
  (isProductSoldOut(product) ? 120 : 0);

export const sortProductList = (
  products: Product[],
  sortBy: string,
  context: PersonalizedSortContext,
  usingServerPagination = false,
) => {
  if (usingServerPagination) {
    return [...products];
  }
  return [...products].sort((a, b) => {
    if (sortBy === 'quick-add-desc') {
      const readyDiff = Number(isQuickAddReady(b)) - Number(isQuickAddReady(a));
      if (readyDiff !== 0) return readyDiff;
      return getConversionSortScore(b, context) - getConversionSortScore(a, context);
    }
    if (sortBy === 'best-value-desc') {
      const valueDiff = Number(isBestValueProduct(b)) - Number(isBestValueProduct(a));
      if (valueDiff !== 0) return valueDiff;
      const savingsDiff = getSavingsAmount(b) - getSavingsAmount(a);
      if (savingsDiff !== 0) return savingsDiff;
      return getConversionSortScore(b, context) - getConversionSortScore(a, context);
    }
    if (sortBy === 'low-stock-desc') {
      const aStock = getLowStockCount(a.stock);
      const bStock = getLowStockCount(b.stock);
      const urgencyDiff = Number(bStock !== null && !isProductSoldOut(b)) - Number(aStock !== null && !isProductSoldOut(a));
      if (urgencyDiff !== 0) return urgencyDiff;
      if (aStock !== null && bStock !== null && aStock !== bStock) return aStock - bStock;
      return getConversionSortScore(b, context) - getConversionSortScore(a, context);
    }
    if (sortBy === 'personalized-desc') {
      return getPersonalizedSortScore(b, context) - getPersonalizedSortScore(a, context);
    }
    if (sortBy === 'price-asc') return getPrice(a) - getPrice(b);
    if (sortBy === 'price-desc') return getPrice(b) - getPrice(a);
    if (sortBy === 'discount-desc') return getDiscountPercent(b) - getDiscountPercent(a);
    if (sortBy === 'positive-rate-desc') {
      const rateDiff = getPositiveRate(b) - getPositiveRate(a);
      if (rateDiff !== 0) return rateDiff;
      return (b.reviewCount || 0) - (a.reviewCount || 0);
    }
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    return getConversionSortScore(b, context) - getConversionSortScore(a, context);
  });
};

export const deriveProductListInsightTotals = (products: Product[]): ProductListInsightTotals =>
  products.reduce((summary, product) => {
    if (isBestValueProduct(product)) summary.bestValueCount += 1;
    if (getLowStockCount(product.stock) !== null && !isProductSoldOut(product)) summary.lowStockCount += 1;
    if (isQuickAddReady(product)) summary.quickAddReadyCount += 1;
    summary.totalSavings += getSavingsAmount(product);
    return summary;
  }, {
    bestValueCount: 0,
    lowStockCount: 0,
    quickAddReadyCount: 0,
    totalSavings: 0,
  });

export const deriveProductListInsights = (products: Product[]): ProductListInsights => {
  const totals = deriveProductListInsightTotals(products);
  return {
    bestValueCount: totals.bestValueCount,
    lowStockCount: totals.lowStockCount,
    quickAddReadyCount: totals.quickAddReadyCount,
    averageSavings: products.length ? totals.totalSavings / products.length : 0,
  };
};

export const pickRecommendedProduct = (
  products: Product[],
  context: PersonalizedSortContext,
) => products
  .filter((product) => !isProductSoldOut(product))
  .map((product, index) => ({
    product,
    index,
    score: getPersonalizedSortScore(product, context),
  }))
  .sort((left, right) => right.score - left.score || left.index - right.index)[0]?.product || null;

export const pickHeroProduct = (
  recommendedProduct: Product | null,
  sortedProducts: Product[],
) => recommendedProduct
  || sortedProducts.find((product) => !isProductSoldOut(product))
  || sortedProducts[0]
  || null;

export const pickCheckoutPathProducts = (sortedProducts: Product[], limit = 3) =>
  sortedProducts.filter((product) => !isProductSoldOut(product)).slice(0, limit);

export const resolvePaginatedProducts = (
  sortedProducts: Product[],
  options: {
    usingServerPagination: boolean;
    currentPage: number;
    pageSize: number;
  },
) => (options.usingServerPagination
  ? sortedProducts
  : sortedProducts.slice((options.currentPage - 1) * options.pageSize, options.currentPage * options.pageSize));


export const resolveProductListCollectionLabel = (value: string, t: ProductListTranslate) => {
  if (value === 'smart-devices') return t('nav.petNav.smartDevices');
  return value.replace(/-/g, ' ');
};

export const buildProductListResultContextTags = (params: {
  collection: string;
  collectionLabel: string;
  keyword: string;
  selectedCategoryName: string;
  discount: boolean;
  t: ProductListTranslate;
}) => ([
  params.collection
    ? { key: 'collection', color: 'geekblue', label: params.collectionLabel }
    : null,
  params.keyword.trim()
    ? { key: 'keyword', color: 'purple', label: params.keyword.trim() }
    : null,
  params.selectedCategoryName
    ? { key: 'category', color: 'green', label: params.selectedCategoryName }
    : null,
  params.discount
    ? { key: 'discount', color: 'red', label: params.t('home.flashOffers') }
    : null,
].filter(Boolean) as Array<{ key: string; color: string; label: string }>);

export type ProductListCatalogPresentation = {
  selectedCategoryName: string;
  leadingCategoryName: string;
  topCategoryName: string;
  collectionLabel: string;
  catalogHeroTitle: string;
  heroProductHighlights: string[];
  mobileHeroSignal: string;
  heroProductName: string;
  quickAddProductName: string;
  previewProductName: string;
  previewProductWishlisted: boolean;
  previewProductStockAlerted: boolean;
};

export const deriveProductListCatalogPresentation = (params: {
  t: ProductListTranslate;
  catalogTitleFallback: string;
  keyword: string;
  categoryId?: number;
  collection: string;
  discount: boolean;
  selectedCategoryName: string;
  leadingCategoryName: string;
  heroProduct: Product | null;
  quickAddProduct: Product | null;
  previewProduct: Product | null;
  productListProductName: (product: Product) => string;
  formatMoney: (value: number) => string;
  quickAddReadyCount: number;
  wishlistedProductIds: Set<number>;
  alertedStockProductIds: Set<number>;
}): ProductListCatalogPresentation => {
  const collectionLabel = normalizeCatalogTitle(
    resolveProductListCollectionLabel(params.collection, params.t),
    params.catalogTitleFallback,
  );
  const topCategoryName = params.selectedCategoryName
    || params.leadingCategoryName
    || normalizeCatalogTitle(params.t('pages.productList.allCategories'), params.catalogTitleFallback);
  const catalogHeroTitle = normalizeCatalogTitle(params.keyword.trim()
    || params.selectedCategoryName
    || (params.categoryId ? params.leadingCategoryName : '')
    || (params.collection ? collectionLabel : '')
    || (params.discount ? params.t('pages.productList.shopBestDeals') : '')
    || params.catalogTitleFallback, params.catalogTitleFallback);
  const heroProductHighlights = params.heroProduct
    ? [
      params.heroProduct.brand,
      getDiscountPercent(params.heroProduct) > 0 ? params.t('pages.productList.sale') : '',
      isQuickAddReady(params.heroProduct) ? params.t('pages.productList.cardQuickReady') : params.t('pages.productList.cardOptionsNeeded'),
    ].filter((item): item is string => Boolean(item))
    : [];
  const lowStockCount = params.heroProduct ? getLowStockCount(params.heroProduct.stock) : null;
  const mobileHeroSignal = params.heroProduct
    ? [
      params.formatMoney(getPrice(params.heroProduct)),
      isQuickAddReady(params.heroProduct) ? params.t('pages.productList.cardQuickReady') : params.t('pages.productList.cardOptionsNeeded'),
      lowStockCount !== null
        ? params.t('pages.productList.cardLowStock', { count: lowStockCount as number })
        : '',
    ].filter(Boolean).join(' / ')
    : params.t('pages.productList.quickAddReady', { count: params.quickAddReadyCount });
  return {
    selectedCategoryName: params.selectedCategoryName,
    leadingCategoryName: params.leadingCategoryName,
    topCategoryName,
    collectionLabel,
    catalogHeroTitle,
    heroProductHighlights,
    mobileHeroSignal,
    heroProductName: params.heroProduct ? params.productListProductName(params.heroProduct) : '',
    quickAddProductName: params.quickAddProduct ? params.productListProductName(params.quickAddProduct) : '',
    previewProductName: params.previewProduct ? params.productListProductName(params.previewProduct) : '',
    previewProductWishlisted: params.previewProduct ? params.wishlistedProductIds.has(params.previewProduct.id) : false,
    previewProductStockAlerted: params.previewProduct ? params.alertedStockProductIds.has(params.previewProduct.id) : false,
  };
};

export const buildProductListGuideText = (params: {
  t: ProductListTranslate;
  activeFilterCount: number;
  bestValueCount: number;
  quickAddReadyCount: number;
}) => {
  if (params.activeFilterCount > 0) return params.t('pages.productList.guideRefineResults');
  if (params.bestValueCount > 0) return params.t('pages.productList.guideBestValue', { count: params.bestValueCount });
  if (params.quickAddReadyCount > 0) return params.t('pages.productList.guideQuickAdd', { count: params.quickAddReadyCount });
  return params.t('pages.productList.guideStart');
};

export const buildProductListSortOptions = (t: ProductListTranslate) => ([
  { value: 'default', label: t('pages.productList.defaultSort') },
  { value: 'personalized-desc', label: t('pages.productList.personalizedSort') },
  { value: 'quick-add-desc', label: t('pages.productList.quickAddSort') },
  { value: 'best-value-desc', label: t('pages.productList.bestValueSort') },
  { value: 'low-stock-desc', label: t('pages.productList.lowStockSort') },
  { value: 'price-asc', label: t('pages.productList.priceAsc') },
  { value: 'price-desc', label: t('pages.productList.priceDesc') },
  { value: 'discount-desc', label: t('pages.productList.discountDesc') },
  { value: 'positive-rate-desc', label: t('pages.productList.positiveRateDesc') },
  { value: 'name', label: t('pages.productList.byName') },
]);

export type ProductListRefinementTagData = {
  key: string;
  label: string;
  kind: 'category' | 'price' | 'size' | 'material' | 'color';
  value?: string;
};

export const buildProductListActiveRefinementTagData = (params: {
  t: ProductListTranslate;
  selectedCategory?: { id: number; title: string } | null;
  priceFilterActive: boolean;
  displayedPriceRange: [number, number];
  formatMoney: (value: number) => string;
  petSizes: string[];
  materials: string[];
  colors: string[];
  optionLabels: Map<string, string>;
}): ProductListRefinementTagData[] => {
  const tags: ProductListRefinementTagData[] = [];
  if (params.selectedCategory) {
    tags.push({
      key: `category-${params.selectedCategory.id}`,
      label: params.selectedCategory.title,
      kind: 'category',
    });
  }
  if (params.priceFilterActive) {
    tags.push({
      key: 'price',
      label: `${params.t('pages.productList.price')}: ${params.formatMoney(params.displayedPriceRange[0])} - ${params.formatMoney(params.displayedPriceRange[1])}`,
      kind: 'price',
    });
  }
  params.petSizes.forEach((value) => tags.push({
    key: `size-${value}`,
    label: `${params.t('pages.productList.filterSize')}: ${params.optionLabels.get(value) || value}`,
    kind: 'size',
    value,
  }));
  params.materials.forEach((value) => tags.push({
    key: `material-${value}`,
    label: `${params.t('pages.productList.filterMaterial')}: ${params.optionLabels.get(value) || value}`,
    kind: 'material',
    value,
  }));
  params.colors.forEach((value) => tags.push({
    key: `color-${value}`,
    label: `${params.t('pages.productList.filterColor')}: ${params.optionLabels.get(value) || value}`,
    kind: 'color',
    value,
  }));
  return tags;
};

export const resolveProductListHasActiveCatalogContext = (params: {
  keyword: string;
  categoryId?: number;
  collection: string;
  discount: boolean;
  activeRefinementCount: number;
}) => Boolean(
  params.keyword.trim()
  || params.categoryId
  || params.collection
  || params.discount
  || params.activeRefinementCount > 0,
);

export const resolveProductListMobileNextStepCopy = (params: {
  t: ProductListTranslate;
  filteredProductsLength: number;
  hasActiveCatalogContext: boolean;
  activeRefinementCount: number;
  productListGuideText: string;
  productCountLabel: string;
}) => {
  const mobileNextStepText = params.filteredProductsLength === 0
    ? params.hasActiveCatalogContext
      ? params.t('pages.productList.loadRecoveryTipFilters')
      : params.t('pages.productList.guideStart')
    : params.productListGuideText;
  const mobileNextStepTitle = params.filteredProductsLength === 0 && params.activeRefinementCount > 0
    ? params.t('pages.productList.activeFilters', { count: params.activeRefinementCount })
    : params.productCountLabel;
  return { mobileNextStepText, mobileNextStepTitle };
};

export const buildProductListActionLabels = (params: {
  t: ProductListTranslate;
  activeRefinementCount: number;
  productCountLabel: string;
  quickAddReadyCount: number;
  heroProduct: Product | null;
  heroProductName: string;
  filteredProductsLength: number;
  shopQuickAddActionLabel?: string;
}) => {
  const productListFilterContextLabel = `${params.t('pages.productList.filters')}: ${params.activeRefinementCount > 0 ? params.t('pages.productList.activeFilters', { count: params.activeRefinementCount }) : params.t('pages.productList.allCategories')}, ${params.productCountLabel}`;
  const openFilterDrawerActionLabel = productListFilterContextLabel;
  const resetRefinementsActionLabel = `${params.t('pages.productList.resetFilters')}: ${productListFilterContextLabel}`;
  const applyRefinementsActionLabel = `${params.t('pages.productList.applyFilters')}: ${productListFilterContextLabel}`;
  const shopBestDealsActionLabel = `${params.t('pages.productList.shopBestDeals')}: ${params.productCountLabel}`;
  const shopQuickAddActionLabel = `${params.t('pages.productList.shopQuickAdd')}: ${params.t('pages.productList.quickAddReady', { count: params.quickAddReadyCount })}`;
  const loadRecoveryContextLabel = `${params.t('pages.productList.fetchFailed')}: ${productListFilterContextLabel}`;
  const refreshCatalogActionLabel = `${params.t('common.refresh')}: ${loadRecoveryContextLabel}`;
  const allCategoriesRecoveryActionLabel = `${params.t('pages.productList.allCategories')}: ${loadRecoveryContextLabel}`;
  const couponsRecoveryActionLabel = `${params.t('pages.productList.loadRecoveryCoupons')}: ${loadRecoveryContextLabel}`;
  const supportRecoveryActionLabel = `${params.t('pages.productList.loadRecoverySupport')}: ${loadRecoveryContextLabel}`;
  const emptyAllCategoriesActionLabel = `${params.t('pages.productList.allCategories')}: ${params.t('pages.productList.empty')}`;
  const emptyResetFiltersActionLabel = `${params.t('pages.productList.resetFilters')}: ${params.t('pages.productList.empty')}, ${productListFilterContextLabel}`;
  const emptyCouponsActionLabel = `${params.t('pages.productList.loadRecoveryCoupons')}: ${params.t('pages.productList.empty')}`;
  const emptyPetFinderActionLabel = `${params.t('nav.petFinder')}: ${params.t('pages.productList.empty')}`;
  const mobilePrimaryActionLabel = params.heroProduct
    ? `${isQuickAddReady(params.heroProduct) ? params.t('pages.productList.addToCart') : params.t('pages.productList.chooseOptionsAction')}: ${params.heroProductName}`
    : params.filteredProductsLength > 0
      ? shopQuickAddActionLabel
      : `${params.t('pages.productList.loadRecoveryCoupons')}: ${params.t('pages.productList.empty')}`;
  const mobileSecondaryActionLabel = params.filteredProductsLength > 0
    ? shopBestDealsActionLabel
    : params.activeRefinementCount > 0
      ? resetRefinementsActionLabel
      : `${params.t('pages.productList.allCategories')}: ${params.t('pages.productList.empty')}`;
  const backToTopActionLabel = params.t('common.backToTop');
  const productSearchActionLabel = `${params.t('common.search')}: ${params.productCountLabel}`;
  return {
    productListFilterContextLabel,
    openFilterDrawerActionLabel,
    resetRefinementsActionLabel,
    applyRefinementsActionLabel,
    shopBestDealsActionLabel,
    shopQuickAddActionLabel,
    loadRecoveryContextLabel,
    refreshCatalogActionLabel,
    allCategoriesRecoveryActionLabel,
    couponsRecoveryActionLabel,
    supportRecoveryActionLabel,
    emptyAllCategoriesActionLabel,
    emptyResetFiltersActionLabel,
    emptyCouponsActionLabel,
    emptyPetFinderActionLabel,
    mobilePrimaryActionLabel,
    mobileSecondaryActionLabel,
    backToTopActionLabel,
    productSearchActionLabel,
  };
};

export const renderProductListAmountText = (label: string, amount: string): React.ReactNode => {
  const parts = label.split(amount);
  if (parts.length <= 1) return label;
  return (
    <span className="product-list__amountPhrase commerce-atomic">
      {parts.map((part, index) => (
        <React.Fragment key={`${part}-${index}`}>
          {part}
          {index < parts.length - 1 ? <span className="commerce-money">{amount}</span> : null}
        </React.Fragment>
      ))}
    </span>
  );
};

export type ProductListMobileDiscoveryDescriptor = {
  key: string;
  label: string;
  active: boolean;
  intent: 'reset-catalog' | 'deals' | 'smart-devices' | 'top-rated' | 'quick-add' | 'support';
};

export const buildProductListMobileDiscoveryDescriptors = (params: {
  t: ProductListTranslate;
  collection: string;
  keyword: string;
  discount: boolean;
  sortBy: string;
  activeRefinementCount: number;
}): ProductListMobileDiscoveryDescriptor[] => ([
  {
    key: 'all',
    label: params.t('pages.productList.allCategories'),
    active: !params.collection && !params.keyword.trim() && !params.discount && params.sortBy === 'default' && params.activeRefinementCount === 0,
    intent: 'reset-catalog',
  },
  {
    key: 'deals',
    label: params.t('pages.productList.shopBestDeals'),
    active: params.discount || params.sortBy === 'discount-desc',
    intent: 'deals',
  },
  {
    key: 'smart',
    label: params.t('nav.petNav.smartDevices'),
    active: params.collection === 'smart-devices',
    intent: 'smart-devices',
  },
  {
    key: 'rated',
    label: params.t('pages.productList.shopTopRated'),
    active: params.sortBy === 'positive-rate-desc',
    intent: 'top-rated',
  },
  {
    key: 'quick',
    label: params.t('pages.productList.shopQuickAdd'),
    active: params.sortBy === 'quick-add-desc',
    intent: 'quick-add',
  },
  {
    key: 'support',
    label: params.t('footer.helpCenter'),
    active: false,
    intent: 'support',
  },
]);
