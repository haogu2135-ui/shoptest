import type React from 'react';
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

