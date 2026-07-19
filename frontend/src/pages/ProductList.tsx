import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, Row, Col, Button, Input, Select, Pagination, Tag, message, Empty, Typography, Slider, Checkbox, Modal, Space, Drawer, Rate } from 'antd';
import { ArrowUpOutlined, BarChartOutlined, BellOutlined, CheckCircleOutlined, CloseOutlined, CustomerServiceOutlined, FireOutlined, FilterOutlined, GiftOutlined, HeartFilled, HeartOutlined, ReloadOutlined, SearchOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { productApi, cartApi, categoryApi, wishlistApi, createApiAbortController } from '../api';
import type { ProductPublic as Product, ProductPublicPage, CategoryPublic } from '../types';
import { flattenCategoryTree, getDisplayCategoryRoots, getLocalizedCategoryValue } from '../utils/categoryTree';
import type { CategoryTreeNode } from '../utils/categoryTree';
import { useLanguage } from '../i18n';
import { usePageTitle } from '../hooks/usePageTitle';
import { useMarket } from '../hooks/useMarket';
import { localizeProduct } from '../utils/localizedProduct';
import { addGuestCartItem } from '../utils/guestCart';
import { buildBundleSpecs, getBundleInfo } from '../utils/bundle';
import { addCompareProduct, isProductCompared, MAX_COMPARE_ITEMS } from '../utils/productCompare';
import { addStockAlert, readStockAlerts, removeStockAlert } from '../utils/stockAlerts';
import { conversionConfig, getLowStockCount } from '../utils/conversionConfig';
import { ProductCardSkeleton, StatsStripSkeleton } from '../components/SkeletonLoader';
import { loadProductViewPreferences } from '../utils/productViewPreferences';
import { getProductOptionGroups, getProductVariants, optionValueIsCompatible, selectCompatibleProductOption } from '../utils/productOptions';
import { getLocalizedOptionLabel } from '../utils/localizedProductOptions';
import { productImageFallback, resolveProductImage } from '../utils/productMedia';
import { buildResponsiveImageSrcSet, getOptimizedImageUrl } from '../utils/mediaAssets';
import { buildLoginUrlFromWindow } from '../utils/authRedirect';
import { dispatchDomEvent } from '../utils/domEvents';
import { loadGuestSupportContext } from '../utils/guestSupportContext';
import { buildProductCatalogFallbackCategories, loadFallbackProductCatalog, loadProductCatalogSnapshot, saveProductCatalogSnapshot } from '../utils/productCatalogSnapshot';
import { getLocalStorageItem, hasStoredValue, setLocalStorageItem } from '../utils/safeStorage';
import { openCartDrawerWithSnapshot } from '../utils/cartDrawer';
import { getApiErrorMessage } from '../utils/apiError';
import { addAppScrollListener, getAppScrollMetrics, scrollAppToTop } from '../utils/nativeScroll';
import { useNativeBackHandler } from '../utils/nativeBack';
import { AUTH_SESSION_CHANGED_EVENT } from '../utils/authEvents';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import PageError from '../components/PageError';
import PageEmpty from '../components/PageEmpty';
import './ProductList.css';
import '../styles/mobile-page-contrast.css';

const { Text } = Typography;
const SEARCH_HISTORY_KEY = 'shop-product-search-history';
const MAX_SEARCH_HISTORY = 6;
const MAX_SEARCH_LENGTH = 80;
const PRODUCT_LIST_PAGE_SIZE = 12;
const PRODUCT_LIST_FETCH_SIZE = PRODUCT_LIST_PAGE_SIZE * 8;
const CATEGORY_CACHE_TTL = 5 * 60 * 1000;
const DEFAULT_PRICE_RANGE: [number, number] = [0, 10000];
const SMART_DEVICE_CATEGORY_IDS = new Set([10, 11]);
const SMART_DEVICE_TERMS = ['smart', 'automatic', 'feeder', 'feeders', 'fountain', 'waterer', 'waterers', 'camera', 'tracker', 'sensor', 'device', 'connected'];
const VALID_SORT_VALUES = new Set([
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
const VALID_PET_SIZES = new Set(['Small', 'Medium', 'Large']);
const VALID_MATERIALS = new Set(['Cotton', 'Nylon', 'Silicone', 'Wood']);
const VALID_COLORS = new Set(['Black', 'Blue', 'Green', 'Pink']);
const VALID_COLLECTIONS = new Set(['smart-devices']);
const resolveProductListImage = resolveProductImage;
const resolveProductPrimaryImage = (product: Product) => {
  const galleryImage = Array.isArray(product.images) ? product.images.find((image) => String(image || '').trim()) : '';
  return resolveProductListImage(product.imageUrl || galleryImage || '');
};
const productListImageSizes = '(max-width: 575px) 50vw, (max-width: 991px) 33vw, 25vw';
const eagerImagePriorityProps = { fetchpriority: 'high' } as unknown as React.ImgHTMLAttributes<HTMLImageElement>;
const lazyImagePriorityProps = { fetchpriority: 'auto' } as unknown as React.ImgHTMLAttributes<HTMLImageElement>;
const shouldShowCatalogFallbackToast = process.env.NODE_ENV !== 'production';

const readSearchHistory = () => {
  try {
    const parsed = JSON.parse(getLocalStorageItem(SEARCH_HISTORY_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean).slice(0, MAX_SEARCH_HISTORY) : [];
  } catch (error) {
    reportNonBlockingError('ProductList.readSearchHistory', error);
    return [];
  }
};

const writeSearchHistory = (history: string[]) => {
  setLocalStorageItem(SEARCH_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_SEARCH_HISTORY)));
};

const normalizeSearchValue = (value: string) => value.replace(/\s+/g, ' ').trim().slice(0, MAX_SEARCH_LENGTH);
const labelPaginationControl = (element: React.ReactNode, label: string) => {
  if (!React.isValidElement(element)) return element;
  return React.cloneElement(element as React.ReactElement<{ 'aria-label'?: string; title?: string }>, {
    'aria-label': label,
    title: label,
  });
};
const normalizeSortValue = (value: string | null | undefined) =>
  value && VALID_SORT_VALUES.has(value) ? value : 'default';
const normalizePetSizeValue = (value: string | null | undefined) =>
  value && VALID_PET_SIZES.has(value) ? value : '';
const normalizePetSizeValues = (values: Array<string | null | undefined>) =>
  Array.from(new Set(values.map(normalizePetSizeValue).filter(Boolean)));
const normalizeOptionValues = (values: Array<string | null | undefined>, allowedValues: Set<string>) => {
  const allowedByLower = new Map(Array.from(allowedValues).map((value) => [value.toLowerCase(), value]));
  return Array.from(new Set(values
    .map((value) => allowedByLower.get(String(value || '').trim().toLowerCase()))
    .filter(Boolean))) as string[];
};
const normalizeCollectionValue = (value: string | null | undefined) =>
  value && VALID_COLLECTIONS.has(value) ? value : '';
const parsePositiveId = (value: string | null) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};
const normalizePageNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
};
const parsePageParam = (value: string | null) => normalizePageNumber(value || 1);
const parsePriceParam = (value: string | null) => {
  if (value === null || value.trim() === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
};

const DEFAULT_CATALOG_TITLE_BY_LANGUAGE = {
  en: 'Pet supplies',
  zh: '\u5ba0\u7269\u7528\u54c1',
  es: 'Productos para mascotas',
} as const;

const getDefaultCatalogTitle = (language: string) =>
  DEFAULT_CATALOG_TITLE_BY_LANGUAGE[language as keyof typeof DEFAULT_CATALOG_TITLE_BY_LANGUAGE]
  || DEFAULT_CATALOG_TITLE_BY_LANGUAGE.en;

const normalizeCatalogTitle = (value: string | null | undefined, fallback: string) => {
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

const productSearchText = (product: Product) => [
  product.name,
  product.description,
  product.brand,
  product.tag,
  ...Object.values(product.specifications || {}),
].join(' ').toLowerCase();

const matchesSmartDeviceCollection = (product: Product) => {
  if (SMART_DEVICE_CATEGORY_IDS.has(Number(product.categoryId))) {
    return true;
  }
  const text = productSearchText(product);
  return SMART_DEVICE_TERMS.some((term) => text.includes(term));
};

const matchesDiscountFilter = (product: Product) =>
  Boolean(product.activeLimitedTimeDiscount) ||
  Number(product.effectiveDiscountPercent || product.discount || 0) > 0 ||
  (product.originalPrice !== undefined && Number(product.originalPrice) > Number(product.effectivePrice ?? product.price ?? 0));

const filterSnapshotProducts = (products: Product[], keyword?: string, categoryId?: number, discount?: boolean, collection?: string) => {
  const normalizedKeyword = normalizeSearchValue(keyword || '').toLowerCase();
  return products.filter((product) => {
    if (collection === 'smart-devices' && !matchesSmartDeviceCollection(product)) return false;
    if (normalizedKeyword && !productSearchText(product).includes(normalizedKeyword)) return false;
    if (categoryId && Number(product.categoryId) !== categoryId) return false;
    if (discount && !matchesDiscountFilter(product)) return false;
    return true;
  });
};

const pickBestProductFallback = (products: Product[], keyword?: string, categoryId?: number, discount?: boolean, collection?: string) => {
  const filtered = filterSnapshotProducts(products, keyword, categoryId, discount, collection);
  return filtered.length > 0 ? filtered : products;
};

const notifyCatalogFallback = (text: string) => {
  if (shouldShowCatalogFallbackToast) {
    message.warning(text);
  }
};

let categoryCache: { expiresAt: number; items: CategoryPublic[] } | null = null;
let categoryCacheRequest: Promise<CategoryPublic[]> | null = null;

const clearProductListSessionCaches = () => {
  categoryCache = null;
  categoryCacheRequest = null;
};

type ProductListUrlOverrides = Partial<{
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

type ProductFetchFilters = {
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

type ActiveResultContextAction = {
  key: string;
  icon: React.ReactNode;
  label: string;
  onClear: () => void;
};

type ProductListTranslate = ReturnType<typeof useLanguage>['t'];

type ProductListCardProps = {
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

const getPrice = (product: Product) => product.effectivePrice ?? product.price;
const getDiscountPercent = (product: Product) => product.effectiveDiscountPercent || product.discount || 0;
const getPositiveRate = (product: Product) => product.positiveRate ?? 0;
const hasReviewSignal = (product: Product) => Number(product.reviewCount || 0) > 0;
const getSavingsAmount = (product: Product) => Math.max(0, Number(product.originalPrice || 0) - getPrice(product));
const isProductSoldOut = (product: Product) => product.stock !== undefined && product.stock <= 0;
const isQuickAddReady = (product: Product) =>
  !isProductSoldOut(product) && getProductOptionGroups(product).length === 0 && getProductVariants(product).length === 0;
const isBestValueProduct = (product: Product) => {
  const config = conversionConfig.productValueBadge;
  if (!config.enabled) return false;
  return getDiscountPercent(product) >= config.minDiscountPercent
    && getPositiveRate(product) >= config.minPositiveRate
    && Number(product.reviewCount || 0) >= config.minReviewCount;
};

const buildProductListBadges = (product: Product, t: ProductListTranslate) => {
  const badges: Array<{ label: string; color: string }> = [];
  if (isBestValueProduct(product)) badges.push({ label: t('pages.productList.bestValue'), color: 'green' });
  if (getDiscountPercent(product) > 0) badges.push({ label: t('pages.productList.sale'), color: 'volcano' });
  if (product.tag === 'new') badges.push({ label: t('pages.productList.new'), color: 'blue' });
  if (product.isFeatured) badges.push({ label: t('pages.productList.bestSeller'), color: 'gold' });
  if (getLowStockCount(product.stock) !== null && (product.stock || 0) > 0) badges.push({ label: t('pages.productList.runningLow'), color: 'red' });
  return badges;
};

const ProductListConfidenceStrip: React.FC<{ product: Product; t: ProductListTranslate }> = ({ product, t }) => {
  const quickReady = isQuickAddReady(product);
  const lowStock = getLowStockCount(product.stock);
  const soldOut = isProductSoldOut(product);
  return (
    <div className="product-list__confidenceStrip">
      {!soldOut && (
        <span className={`product-list__confidencePill${quickReady ? ' product-list__confidencePill--ready' : ''}`}>
          <CheckCircleOutlined />
          {quickReady ? t('pages.productList.cardQuickReady') : t('pages.productList.cardOptionsNeeded')}
        </span>
      )}
      {lowStock !== null && (
        <span className="product-list__confidencePill product-list__confidencePill--alert">
          <FireOutlined />
          {t('pages.productList.cardLowStock', { count: lowStock })}
        </span>
      )}
      {lowStock === null && !soldOut && (
        <span className="product-list__confidencePill product-list__confidencePill--trust">
          <CheckCircleOutlined />
          {t('pages.productList.cardReturnReady')}
        </span>
      )}
    </div>
  );
};

const ProductListCard = React.memo(({
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
    <Col xs={12} sm={12} md={8} lg={6}>
      <Card
        className="product-list__card"
        hoverable
        onMouseEnter={() => onPrefetch(product.id)}
        onFocus={() => onPrefetch(product.id)}
        cover={
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
                {buildProductListBadges(product, t).slice(0, 3).map((badge) => <Tag key={badge.label} color={badge.color}>{badge.label}</Tag>)}
              </span>
              {soldOut && (
                <span className="product-list__soldOut">
                  {t('pages.productList.soldOut')}
                </span>
              )}
            </Link>
            <div className="product-list__imageOverlay">
              <Button
                size="small"
                icon={<SearchOutlined />}
                className="product-list__previewTrigger"
                aria-label={previewActionLabel}
                title={previewActionLabel}
                onClick={(event) => onPreview(event, product)}
              >
                {t('pages.productList.quickPreview')}
              </Button>
            </div>
          </div>
        }
        actions={[
          soldOut ? (
            <Button
              key="stock-alert"
              icon={<BellOutlined />}
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
            </Button>
          ) : (
            <Button
              key="quick-add"
              type="primary"
              icon={<ShoppingCartOutlined />}
              size="small"
              className="product-list__actionButton"
              aria-label={quickAddActionLabel}
              title={quickAddActionLabel}
              onClick={(event) => onQuickAdd(event, product)}
            >
              <span className="product-list__actionLabel">
                {quickAddLabel}
              </span>
            </Button>
          ),
          <Button
            key="wishlist"
            icon={wishlisted ? <HeartFilled /> : <HeartOutlined />}
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
          </Button>,
          <Button
            key="compare"
            icon={<BarChartOutlined />}
            size="small"
            className="product-list__actionButton product-list__actionButton--compact"
            aria-label={compareActionLabel}
            title={compareActionLabel}
            onClick={(event) => onCompare(event, product)}
          >
            <span className="product-list__actionLabel">
              {compared ? t('pages.productList.viewCompare') : t('pages.productList.compare')}
            </span>
          </Button>,
        ]}
      >
        <Card.Meta
          title={(
            <Link
              to={productDetailPath}
              className="product-list__titleLink"
              aria-label={viewDetailsActionLabel}
              title={viewDetailsActionLabel}
            >
              <Text ellipsis={{ tooltip: productName }}>{productName}</Text>
            </Link>
          )}
          description={
            <div>
              <div className="product-list__priceLine">
                <span className="product-list__currentPrice commerce-money">{formatMoney(getPrice(product))}</span>
                {product.originalPrice && product.originalPrice > getPrice(product) && (
                  <Text delete type="secondary" className="product-list__originalPrice commerce-money">{formatMoney(product.originalPrice)}</Text>
                )}
                {product.activeLimitedTimeDiscount && <Tag color="red" className="product-list__priceTag">{t('pages.keywords.deal')}</Tag>}
              </div>
              {isBestValueProduct(product) && getSavingsAmount(product) > 0 ? (
                <div className="product-list__valueLine">
                  <Text type="success">
                    {renderSavingsText(getSavingsAmount(product))}
                  </Text>
                </div>
              ) : null}
              <div className="product-list__ratingLine">
                <Text type={hasReviewSignal(product) ? 'secondary' : undefined} className={hasReviewSignal(product) ? undefined : 'product-list__newReviewSignal'}>
                  {hasReviewSignal(product)
                    ? t('pages.productList.positiveRate', { rate: Math.round(product.positiveRate || 0).toString(), count: product.reviewCount || 0 })
                    : t('pages.productList.noReviewsYet')}
                </Text>
              </div>
              <div className="product-list__metaRow">
                {product.brand && <Text type="secondary" className="product-list__brand">{product.brand}</Text>}
              </div>
              <ProductListConfidenceStrip product={product} t={t} />
            </div>
          }
        />
      </Card>
    </Col>
  );
});

ProductListCard.displayName = 'ProductListCard';

const ProductList: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CategoryPublic[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [usingCatalogSnapshot, setUsingCatalogSnapshot] = useState(false);
  const [keyword, setKeyword] = useState(normalizeSearchValue(searchParams.get('keyword') || ''));
  const [categoryId, setCategoryId] = useState<number | undefined>(parsePositiveId(searchParams.get('categoryId')));
  const [discount, setDiscount] = useState(searchParams.get('discount') === 'true');
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [sortBy, setSortBy] = useState<string>(normalizeSortValue(searchParams.get('sort')));
  const [priceRange, setPriceRange] = useState<[number, number]>(DEFAULT_PRICE_RANGE);
  const [priceFilterTouched, setPriceFilterTouched] = useState(false);
  const [petSizes, setPetSizes] = useState<string[]>(
    normalizePetSizeValues(searchParams.getAll('petSize').length ? searchParams.getAll('petSize') : [searchParams.get('petSize')]),
  );
  const [materials, setMaterials] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [quickAddProduct, setQuickAddProduct] = useState<Product | null>(null);
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);
  const [quickAddOptions, setQuickAddOptions] = useState<Record<string, string>>({});
  const [quickAddSubmitting, setQuickAddSubmitting] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>(() => readSearchHistory());
  const [personalizedProducts, setPersonalizedProducts] = useState<Product[]>([]);
  const [viewPreferences, setViewPreferences] = useState(() => loadProductViewPreferences());
  const [currentPage, setCurrentPage] = useState(1);
  const [productTotal, setProductTotal] = useState(0);
  const [usingServerPagination, setUsingServerPagination] = useState(false);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [wishlistedProductIds, setWishlistedProductIds] = useState<Set<number>>(new Set());
  const [authSessionVersion, setAuthSessionVersion] = useState(0);
  const [alertedStockProductIds, setAlertedStockProductIds] = useState<Set<number>>(
    () => new Set(readStockAlerts().map((alert) => alert.productId)),
  );
  const priceRangeMaxRef = useRef(DEFAULT_PRICE_RANGE[1]);
  const productRequestSeqRef = useRef(0);
  const productFetchAbortRef = useRef<AbortController | null>(null);
  const previousProductsRef = useRef<Product[]>([]);
  const { t, language } = useLanguage();
  usePageTitle(t('pages.productList.title'));
  const { formatMoney } = useMarket();
  const productSearchActionLabel = `${t('common.search')}: ${t('pages.productList.searchPlaceholder')}`;
  const productListProductName = useCallback((product: Pick<Product, 'id' | 'name'>) =>
    (product.name || '').trim() || t('pages.profile.productFallback', { id: product.id }), [t]);
  useNativeBackHandler(filterDrawerOpen, () => {
    setFilterDrawerOpen(false);
    return true;
  });
  useNativeBackHandler(Boolean(quickAddProduct), () => {
    if (!quickAddSubmitting) {
      setQuickAddProduct(null);
    }
    return true;
  });
  useNativeBackHandler(Boolean(previewProduct), () => {
    setPreviewProduct(null);
    return true;
  });
  const catalogTitleFallback = normalizeCatalogTitle(
    t('pages.productList.catalogTitle'),
    getDefaultCatalogTitle(language),
  );
  const normalizeCategoryTitle = useCallback((category: CategoryPublic | null | undefined, fallback = catalogTitleFallback) => (
    category ? normalizeCatalogTitle(getLocalizedCategoryValue(category, language, 'name'), fallback) : ''
  ), [catalogTitleFallback, language]);
  const collection = normalizeCollectionValue(searchParams.get('collection'));
  const pageSize = PRODUCT_LIST_PAGE_SIZE;
  const isAuthenticated = hasStoredValue('token');
  const openSupport = useCallback(() => {
    if (!hasStoredValue('token')) {
      const guestContext = loadGuestSupportContext();
      if (guestContext) {
        dispatchDomEvent('shop:open-support', guestContext);
        return;
      }
      dispatchDomEvent('shop:open-support');
      return;
    }
    dispatchDomEvent('shop:open-support');
  }, []);
  const petSizeOptions = useMemo(() => [
    { label: t('pages.profile.petSizeSmall'), value: 'Small' },
    { label: t('pages.profile.petSizeMedium'), value: 'Medium' },
    { label: t('pages.profile.petSizeLarge'), value: 'Large' },
  ], [t]);
  const materialOptions = useMemo(() => [
    { label: t('pages.productList.materialCotton'), value: 'Cotton' },
    { label: t('pages.productList.materialNylon'), value: 'Nylon' },
    { label: t('pages.productList.materialSilicone'), value: 'Silicone' },
    { label: t('pages.productList.materialWood'), value: 'Wood' },
  ], [t]);
  const colorOptions = useMemo(() => [
    { label: t('pages.productList.colorBlack'), value: 'Black', swatch: '#1f2933' },
    { label: t('pages.productList.colorBlue'), value: 'Blue', swatch: '#2563eb' },
    { label: t('pages.productList.colorGreen'), value: 'Green', swatch: '#16a34a' },
    { label: t('pages.productList.colorPink'), value: 'Pink', swatch: '#ec4899' },
  ], [t]);

  useEffect(() => {
    const handleAuthSessionChanged = () => {
      clearProductListSessionCaches();
      setCategories([]);
      setWishlistedProductIds(new Set());
      setPersonalizedProducts([]);
      setAuthSessionVersion((version) => version + 1);
    };
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, handleAuthSessionChanged);
    return () => {
      window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, handleAuthSessionChanged);
    };
  }, []);

  useEffect(() => {
    if (categoryCache && categoryCache.expiresAt > Date.now()) {
      setCategories(categoryCache.items);
      return;
    }
    let active = true;
    if (!categoryCacheRequest) {
      categoryCacheRequest = categoryApi.getTopLevel()
        .then((res) => {
          categoryCache = { expiresAt: Date.now() + CATEGORY_CACHE_TTL, items: res.data };
          return res.data;
        })
        .finally(() => {
          categoryCacheRequest = null;
        });
    }
    categoryCacheRequest
      .then((items) => {
        if (active) setCategories(items);
      })
      .catch(() => {
        if (!active) return;
        const snapshot = loadProductCatalogSnapshot();
        const fallbackCategories = buildProductCatalogFallbackCategories(
          snapshot?.products?.length ? snapshot.products : loadFallbackProductCatalog(),
        );
        setCategories(fallbackCategories);
      });
    return () => {
      active = false;
    };
  }, [authSessionVersion, t]);

  useEffect(() => {
    if (!isAuthenticated) {
      setWishlistedProductIds(new Set());
      return;
    }
    let disposed = false;
    wishlistApi.getByUser(0)
      .then((res) => {
        if (!disposed) setWishlistedProductIds(new Set(res.data.map((item) => item.productId)));
      })
      .catch(() => {
        if (!disposed) setWishlistedProductIds(new Set());
      });
    return () => {
      disposed = true;
    };
  }, [isAuthenticated, authSessionVersion]);

  useEffect(() => {
    const refreshStockAlerts = () => {
      setAlertedStockProductIds(new Set(readStockAlerts().map((alert) => alert.productId)));
    };
    const refreshPreferences = () => {
      setViewPreferences(loadProductViewPreferences());
    };
    window.addEventListener('shop:stock-alerts-updated', refreshStockAlerts);
    window.addEventListener('shop:product-view-preferences-updated', refreshPreferences);
    window.addEventListener('storage', refreshStockAlerts);
    window.addEventListener('storage', refreshPreferences);
    return () => {
      window.removeEventListener('shop:stock-alerts-updated', refreshStockAlerts);
      window.removeEventListener('shop:product-view-preferences-updated', refreshPreferences);
      window.removeEventListener('storage', refreshStockAlerts);
      window.removeEventListener('storage', refreshPreferences);
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setPersonalizedProducts([]);
      return;
    }
    let disposed = false;
    productApi.getPersonalizedRecommendations()
      .then((response) => {
        if (!disposed) setPersonalizedProducts(response.data.map((product) => localizeProduct(product, language)));
      })
      .catch(() => {
        if (!disposed) setPersonalizedProducts([]);
      });
    return () => {
      disposed = true;
    };
  }, [isAuthenticated, language, authSessionVersion]);

  const collectionProducts = useMemo(() => {
    let result = products;
    if (!usingServerPagination && collection === 'smart-devices') {
      result = result.filter(matchesSmartDeviceCollection);
    }
    if (!usingServerPagination && collection && keyword.trim()) {
      const normalizedKeyword = keyword.trim().toLowerCase();
      result = result.filter((product) => productSearchText(product).includes(normalizedKeyword));
    }
    return result;
  }, [collection, keyword, products, usingServerPagination]);

  const maxCatalogPrice = useMemo(() => {
    const highestPrice = collectionProducts.reduce((max, product) => Math.max(max, Number(getPrice(product) || 0)), 0);
    if (highestPrice <= 0) return 50;
    const roundTo = highestPrice > 1000 ? 100 : highestPrice > 200 ? 50 : 10;
    return Math.max(50, Math.ceil(highestPrice / roundTo) * roundTo);
  }, [collectionProducts]);

  const priceStep = maxCatalogPrice > 1000 ? 50 : maxCatalogPrice > 200 ? 10 : 5;

  const displayedPriceRange = useMemo<[number, number]>(() => {
    const min = Math.min(priceRange[0], maxCatalogPrice);
    const max = Math.min(Math.max(priceRange[1], min), maxCatalogPrice);
    return [min, max];
  }, [maxCatalogPrice, priceRange]);

  const priceFilterActive = priceFilterTouched && (displayedPriceRange[0] > 0 || displayedPriceRange[1] < maxCatalogPrice);
  const activeFilterCount = [
    priceFilterActive,
    petSizes.length > 0,
    materials.length > 0,
    colors.length > 0,
  ].filter(Boolean).length;
  const activeRefinementCount = activeFilterCount + (categoryId ? 1 : 0);
  const buildProductsUrl = useCallback((overrides: ProductListUrlOverrides = {}) => {
    const nextCollection = normalizeCollectionValue(overrides.collection ?? collection);
    const nextKeyword = normalizeSearchValue(overrides.keyword ?? keyword);
    const nextCategoryId = Object.prototype.hasOwnProperty.call(overrides, 'categoryId')
      ? overrides.categoryId
      : categoryId;
    const nextDiscount = overrides.discount ?? discount;
    const nextSort = normalizeSortValue(overrides.sortBy ?? sortBy);
    const nextPetSizes = normalizePetSizeValues(overrides.petSizes ?? petSizes);
    const nextMaterials = normalizeOptionValues(overrides.materials ?? materials, VALID_MATERIALS);
    const nextColors = normalizeOptionValues(overrides.colors ?? colors, VALID_COLORS);
    const nextPriceFilterTouched = overrides.priceFilterTouched ?? priceFilterTouched;
    const nextPriceRange = overrides.priceRange ?? priceRange;
    const nextPage = normalizePageNumber(overrides.page ?? 1);
    const params = new URLSearchParams();
    if (nextCollection) params.set('collection', nextCollection);
    if (nextKeyword) params.set('keyword', nextKeyword);
    if (nextCategoryId) params.set('categoryId', nextCategoryId.toString());
    if (nextDiscount) params.set('discount', 'true');
    if (nextSort !== 'default') params.set('sort', nextSort);
    nextPetSizes.forEach((size) => params.append('petSize', size));
    nextMaterials.forEach((material) => params.append('material', material));
    nextColors.forEach((color) => params.append('color', color));
    if (nextPriceFilterTouched) {
      if (nextPriceRange[0] > 0) params.set('minPrice', String(nextPriceRange[0]));
      if (nextPriceRange[1] > 0) params.set('maxPrice', String(nextPriceRange[1]));
    }
    if (nextPage > 1) params.set('page', String(nextPage));
    return `/products${params.toString() ? '?' + params.toString() : ''}`;
  }, [categoryId, collection, colors, discount, keyword, materials, petSizes, priceFilterTouched, priceRange, sortBy]);
  const updatePetSizes = useCallback((nextSizes: string[]) => {
    const normalizedSizes = normalizePetSizeValues(nextSizes);
    setPetSizes(normalizedSizes);
    setCurrentPage(1);
    navigate(buildProductsUrl({ petSizes: normalizedSizes }));
  }, [buildProductsUrl, navigate]);
  const updateMaterials = useCallback((nextMaterials: string[]) => {
    const normalizedMaterials = normalizeOptionValues(nextMaterials, VALID_MATERIALS);
    setMaterials(normalizedMaterials);
    setCurrentPage(1);
    navigate(buildProductsUrl({ materials: normalizedMaterials }));
  }, [buildProductsUrl, navigate]);
  const updateColors = useCallback((nextColors: string[]) => {
    const normalizedColors = normalizeOptionValues(nextColors, VALID_COLORS);
    setColors(normalizedColors);
    setCurrentPage(1);
    navigate(buildProductsUrl({ colors: normalizedColors }));
  }, [buildProductsUrl, navigate]);
  const commitPriceRange = useCallback((nextRange: [number, number]) => {
    const normalizedRange: [number, number] = [
      Math.max(0, Math.min(nextRange[0], nextRange[1])),
      Math.max(nextRange[0], nextRange[1]),
    ];
    setPriceFilterTouched(true);
    setPriceRange(normalizedRange);
    setCurrentPage(1);
    navigate(buildProductsUrl({ priceRange: normalizedRange, priceFilterTouched: true }));
  }, [buildProductsUrl, navigate]);

  useEffect(() => {
    setPriceRange((currentRange) => {
      if (!priceFilterTouched) {
        const normalizedRange: [number, number] = [0, maxCatalogPrice];
        return normalizedRange[0] === currentRange[0] && normalizedRange[1] === currentRange[1]
          ? currentRange
          : normalizedRange;
      }
      const previousMax = priceRangeMaxRef.current;
      const followsCatalogMax = currentRange[1] === previousMax || currentRange[1] >= previousMax;
      const nextMin = Math.min(currentRange[0], maxCatalogPrice);
      const nextMax = followsCatalogMax ? maxCatalogPrice : Math.min(currentRange[1], maxCatalogPrice);
      const normalizedRange: [number, number] = [nextMin, Math.max(nextMin, nextMax)];
      return normalizedRange[0] === currentRange[0] && normalizedRange[1] === currentRange[1]
        ? currentRange
        : normalizedRange;
    });
    priceRangeMaxRef.current = maxCatalogPrice;
  }, [maxCatalogPrice, priceFilterTouched]);

  const visibleCategories = useMemo(() => {
    if (usingServerPagination && !collection) {
      return categories;
    }
    const hasActiveCatalogNarrowing = Boolean(collection || keyword.trim() || categoryId);
    if (collectionProducts.length === 0) {
      return hasActiveCatalogNarrowing ? [] : categories;
    }
    const sourceProducts = collectionProducts;
    if (sourceProducts.length === 0) {
      return categories;
    }
    const categoryById = new Map(categories.map((category) => [category.id, category]));
    const visibleIds = new Set<number>();
    sourceProducts.forEach((product) => {
      let currentId: number | undefined | null = product.categoryId;
      while (currentId) {
        const category = categoryById.get(currentId);
        if (!category || visibleIds.has(category.id)) {
          break;
        }
        visibleIds.add(category.id);
        currentId = category.parentId;
      }
    });
    return categories.filter((category) => visibleIds.has(category.id));
  }, [categories, categoryId, collection, collectionProducts, keyword, usingServerPagination]);
  const categoryTree = useMemo(() => getDisplayCategoryRoots(visibleCategories), [visibleCategories]);
  const categoryRows = useMemo(() => flattenCategoryTree(categoryTree), [categoryTree]);
  const categoryDepthById = useMemo(() => {
    const depths = new Map<number, number>();
    const visit = (nodes: CategoryTreeNode<CategoryPublic>[], depth: number) => {
      nodes.forEach((category) => {
        depths.set(category.id, depth);
        visit(category.children || [], depth + 1);
      });
    };
    visit(categoryTree, 1);
    return depths;
  }, [categoryTree]);
  const selectedCategory = useMemo(
    () => categoryRows.find((category) => category.id === categoryId),
    [categoryId, categoryRows],
  );
  const activeRefinementTags = useMemo(() => {
    const tags: Array<{ key: string; label: string; onClose: () => void }> = [];
    if (selectedCategory) {
      tags.push({
        key: `category-${selectedCategory.id}`,
        label: normalizeCategoryTitle(selectedCategory),
        onClose: () => {
          setCategoryId(undefined);
          setCurrentPage(1);
          navigate(buildProductsUrl({ categoryId: undefined }));
          setFilterDrawerOpen(false);
        },
      });
    }
    if (priceFilterActive) {
      tags.push({
        key: 'price',
        label: `${t('pages.productList.price')}: ${formatMoney(displayedPriceRange[0])} - ${formatMoney(displayedPriceRange[1])}`,
        onClose: () => {
          setPriceRange([0, maxCatalogPrice]);
          setPriceFilterTouched(false);
          setCurrentPage(1);
          navigate(buildProductsUrl({ priceRange: [0, maxCatalogPrice], priceFilterTouched: false }));
        },
      });
    }
    const optionLabels = new Map([
      ...petSizeOptions.map((option) => [option.value, option.label] as const),
      ...materialOptions.map((option) => [option.value, option.label] as const),
      ...colorOptions.map((option) => [option.value, option.label] as const),
    ]);
    petSizes.forEach((value) => tags.push({
      key: `size-${value}`,
      label: `${t('pages.productList.filterSize')}: ${optionLabels.get(value) || value}`,
      onClose: () => {
        updatePetSizes(petSizes.filter((item) => item !== value));
      },
    }));
    materials.forEach((value) => tags.push({
      key: `material-${value}`,
      label: `${t('pages.productList.filterMaterial')}: ${optionLabels.get(value) || value}`,
      onClose: () => {
        updateMaterials(materials.filter((item) => item !== value));
      },
    }));
    colors.forEach((value) => tags.push({
      key: `color-${value}`,
      label: `${t('pages.productList.filterColor')}: ${optionLabels.get(value) || value}`,
      onClose: () => {
        updateColors(colors.filter((item) => item !== value));
      },
    }));
    return tags;
  }, [
    colorOptions,
    colors,
    buildProductsUrl,
    displayedPriceRange,
    formatMoney,
    materialOptions,
    materials,
    maxCatalogPrice,
    navigate,
    normalizeCategoryTitle,
    petSizeOptions,
    petSizes,
    priceFilterActive,
    selectedCategory,
    t,
    updateColors,
    updateMaterials,
    updatePetSizes,
  ]);
  const applySort = (nextSort: string) => {
    const normalizedSort = normalizeSortValue(nextSort);
    setSortBy(normalizedSort);
    setCurrentPage(1);
    navigate(buildProductsUrl({ sortBy: normalizedSort }));
  };
  const getCollectionLabel = useCallback((value: string) => {
    if (value === 'smart-devices') return t('nav.petNav.smartDevices');
    return value.replace(/-/g, ' ');
  }, [t]);
  const resultContextTags = [
    collection ? { key: 'collection', color: 'geekblue', label: normalizeCatalogTitle(getCollectionLabel(collection), catalogTitleFallback) } : null,
    keyword.trim() ? { key: 'keyword', color: 'purple', label: keyword.trim() } : null,
    selectedCategory ? { key: 'category', color: 'green', label: normalizeCategoryTitle(selectedCategory) } : null,
    discount ? { key: 'discount', color: 'red', label: t('home.flashOffers') } : null,
  ].filter(Boolean) as Array<{ key: string; color: string; label: string }>;
  const quickAddOptionGroups = useMemo(() => getProductOptionGroups(quickAddProduct), [quickAddProduct]);
  const quickAddVariants = useMemo(() => getProductVariants(quickAddProduct), [quickAddProduct]);
  const quickAddBundleInfo = useMemo(() => getBundleInfo(quickAddProduct), [quickAddProduct]);
  const quickAddVariant = useMemo(() => {
    if (!quickAddVariants.length) return undefined;
    return quickAddVariants.find((variant) =>
      Object.entries(variant.options || {}).every(([key, value]) => quickAddOptions[key] === value),
    );
  }, [quickAddOptions, quickAddVariants]);
  const quickAddPrice = useMemo(
    () => quickAddBundleInfo?.price ?? quickAddVariant?.price ?? (quickAddProduct ? getPrice(quickAddProduct) : 0),
    [quickAddBundleInfo, quickAddProduct, quickAddVariant],
  );
  const quickAddMissingOption = useMemo(
    () => quickAddOptionGroups.find((group) => !quickAddOptions[group.name]),
    [quickAddOptionGroups, quickAddOptions],
  );
  const quickAddInvalidSelection = quickAddVariants.length > 0 && !quickAddMissingOption && !quickAddVariant;
  const quickAddSubmitDisabled = Boolean(quickAddMissingOption || quickAddInvalidSelection);
  const buildQuickAddCartSnapshot = () => quickAddProduct ? ({
    ...quickAddProduct,
    stock: quickAddVariant?.stock ?? quickAddProduct.stock,
    price: quickAddPrice,
    effectivePrice: quickAddPrice,
    imageUrl: quickAddVariant?.imageUrl || resolveProductPrimaryImage(quickAddProduct),
  }) : null;

  const fetchProducts = useCallback(async (kw?: string, cid?: number, disc?: boolean, filters: ProductFetchFilters = {}) => {
    const requestSeq = productRequestSeqRef.current + 1;
    productRequestSeqRef.current = requestSeq;
    const previousAbortController = productFetchAbortRef.current;
    const abortController = createApiAbortController();
    productFetchAbortRef.current = abortController;
    previousAbortController?.abort();
    const isCurrentRequest = () => productRequestSeqRef.current === requestSeq && !abortController.signal.aborted;
    try {
      setLoading(true);
      const requestedPage = Math.max(0, normalizePageNumber((filters.page ?? 0) + 1) - 1);
      const requestedSize = Math.max(1, Number.isFinite(Number(filters.size)) ? Math.floor(Number(filters.size)) : pageSize);
      const boundedFilters = {
        ...filters,
        page: requestedPage,
        size: requestedSize,
      };
      const res = await productApi.getPage(kw || undefined, cid, disc, boundedFilters, { signal: abortController.signal });
      if (!isCurrentRequest()) return;
      let pageData: ProductPublicPage = res.data;
      let localizedProducts = pageData.items.map((product) => localizeProduct(product, language));
      if (localizedProducts.length === 0 && pageData.total > 0 && requestedPage > 0) {
        const totalPages = pageData.totalPages > 0
          ? pageData.totalPages
          : Math.ceil(pageData.total / Math.max(1, pageData.size || requestedSize));
        const lastPageIndex = Math.max(0, totalPages - 1);
        if (lastPageIndex < requestedPage) {
          const lastPageRes = await productApi.getPage(kw || undefined, cid, disc, {
            ...boundedFilters,
            page: lastPageIndex,
          }, { signal: abortController.signal });
          if (!isCurrentRequest()) return;
          pageData = lastPageRes.data;
          localizedProducts = pageData.items.map((product) => localizeProduct(product, language));
        }
      }
      if (localizedProducts.length === 0 && pageData.total === 0 && !kw && !cid && !disc) {
        const snapshot = loadProductCatalogSnapshot();
        const snapshotProducts = snapshot?.products?.length
          ? snapshot.products.map((product) => localizeProduct(product, language))
          : [];
        const fallbackProducts = snapshotProducts.length > 0
          ? snapshotProducts
          : loadFallbackProductCatalog().map((product) => localizeProduct(product, language));
        if (fallbackProducts.length > 0) {
          previousProductsRef.current = fallbackProducts;
          setProducts(fallbackProducts);
          setProductTotal(fallbackProducts.length);
          setUsingServerPagination(false);
          setLoadFailed(false);
          setUsingCatalogSnapshot(true);
          setCurrentPage(1);
          notifyCatalogFallback(t('pages.productList.snapshotNotice'));
          return;
        }
      }
      if (localizedProducts.length > 0 && pageData.page === 0) {
        saveProductCatalogSnapshot(pageData.items);
      }
      previousProductsRef.current = localizedProducts;
      setProducts(localizedProducts);
      setProductTotal(pageData.total);
      setUsingServerPagination(true);
      setLoadFailed(false);
      setUsingCatalogSnapshot(false);
      const totalPagesForUi = Math.max(1, pageData.totalPages || Math.ceil(pageData.total / Math.max(1, pageData.size || requestedSize)));
      setCurrentPage(pageData.total === 0 ? 1 : Math.min(totalPagesForUi, Math.max(1, pageData.page + 1)));
    } catch (error) {
      if (!isCurrentRequest()) return;
      const errorMessage = getApiErrorMessage(error, t('pages.productList.fetchFailed'), language);
      if (kw || cid || disc || filters.collection) {
        try {
          const fallbackRes = await productApi.getAll(undefined, undefined, undefined, { page: 0, size: PRODUCT_LIST_FETCH_SIZE }, { signal: abortController.signal });
          if (!isCurrentRequest()) return;
          const fallbackProducts = pickBestProductFallback(fallbackRes.data, kw, cid, disc, filters.collection).map((product) => localizeProduct(product, language));
          if (fallbackProducts.length === 0) {
            throw new Error('Empty fallback catalog');
          }
          saveProductCatalogSnapshot(fallbackRes.data);
          previousProductsRef.current = fallbackProducts;
          setProducts(fallbackProducts);
          setProductTotal(fallbackProducts.length);
          setUsingServerPagination(false);
          setLoadFailed(false);
          setUsingCatalogSnapshot(false);
          setCurrentPage(1);
          return;
        } catch (fallbackError) {
          reportNonBlockingError('ProductList.loadFilteredFallback', fallbackError);
        }
      }
      const snapshot = loadProductCatalogSnapshot();
      if (snapshot) {
        const snapshotProducts = pickBestProductFallback(snapshot.products, kw, cid, disc).map((product) => localizeProduct(product, language));
        if (snapshotProducts.length === 0) {
          const broadSnapshotProducts = snapshot.products.map((product) => localizeProduct(product, language));
          if (broadSnapshotProducts.length > 0) {
            previousProductsRef.current = broadSnapshotProducts;
            setProducts(broadSnapshotProducts);
            setProductTotal(broadSnapshotProducts.length);
            setUsingServerPagination(false);
            setLoadFailed(false);
            setUsingCatalogSnapshot(true);
            setCurrentPage(1);
            notifyCatalogFallback(t('pages.productList.snapshotNotice'));
            return;
          }
        }
        previousProductsRef.current = snapshotProducts;
        setProducts(snapshotProducts);
        setProductTotal(snapshotProducts.length);
        setUsingServerPagination(false);
        setLoadFailed(false);
        setUsingCatalogSnapshot(true);
        setCurrentPage(1);
        notifyCatalogFallback(t('pages.productList.snapshotNotice'));
        return;
      }
      if (previousProductsRef.current.length > 0) {
        const previousProducts = pickBestProductFallback(previousProductsRef.current, kw, cid, disc);
        const fallbackProducts = previousProducts.length > 0 ? previousProducts : previousProductsRef.current;
        setProducts(fallbackProducts);
        setProductTotal(fallbackProducts.length);
        setUsingServerPagination(false);
        setLoadFailed(false);
        setUsingCatalogSnapshot(true);
        notifyCatalogFallback(t('pages.productList.snapshotNotice'));
        return;
      }
      const fallbackProducts = pickBestProductFallback(loadFallbackProductCatalog(), kw, cid, disc).map((product) => localizeProduct(product, language));
      if (fallbackProducts.length > 0) {
        previousProductsRef.current = fallbackProducts;
        setProducts(fallbackProducts);
        setProductTotal(fallbackProducts.length);
        setUsingServerPagination(false);
        setLoadFailed(false);
        setUsingCatalogSnapshot(true);
        notifyCatalogFallback(t('pages.productList.snapshotNotice'));
        return;
      }
      const broadFallbackProducts = loadFallbackProductCatalog().map((product) => localizeProduct(product, language));
      if (broadFallbackProducts.length > 0) {
        previousProductsRef.current = broadFallbackProducts;
        setProducts(broadFallbackProducts);
        setProductTotal(broadFallbackProducts.length);
        setUsingServerPagination(false);
        setLoadFailed(false);
        setUsingCatalogSnapshot(true);
        notifyCatalogFallback(t('pages.productList.snapshotNotice'));
        return;
      }
      setLoadFailed(true);
      setUsingCatalogSnapshot(false);
      setUsingServerPagination(false);
      setProductTotal(0);
      setProducts([]);
      if (process.env.NODE_ENV !== 'production') {
        message.error(errorMessage);
      }
    } finally {
      if (productFetchAbortRef.current === abortController) {
        productFetchAbortRef.current = null;
      }
      if (isCurrentRequest()) {
        setLoading(false);
      }
    }
  }, [language, pageSize, t]);

  useEffect(() => () => {
    productRequestSeqRef.current += 1;
    productFetchAbortRef.current?.abort();
    productFetchAbortRef.current = null;
  }, []);

  const buildActiveFetchFilters = useCallback((page = 0): ProductFetchFilters => ({
    minPrice: priceFilterTouched ? priceRange[0] : undefined,
    maxPrice: priceFilterTouched ? priceRange[1] : undefined,
    petSizes,
    materials,
    colors,
    collection: collection || undefined,
    includeChildren: categoryId ? true : undefined,
    sort: sortBy,
    page,
    size: pageSize,
  }), [categoryId, collection, colors, materials, pageSize, petSizes, priceFilterTouched, priceRange, sortBy]);

  useEffect(() => {
    const kw = normalizeSearchValue(searchParams.get('keyword') || '');
    const cid = parsePositiveId(searchParams.get('categoryId'));
    const disc = searchParams.get('discount') === 'true';
    const activeCollection = normalizeCollectionValue(searchParams.get('collection'));
    const requestedSort = normalizeSortValue(searchParams.get('sort'));
    const requestedPetSizes = normalizePetSizeValues(searchParams.getAll('petSize').length ? searchParams.getAll('petSize') : [searchParams.get('petSize')]);
    const requestedMaterials = normalizeOptionValues(searchParams.getAll('material'), VALID_MATERIALS);
    const requestedColors = normalizeOptionValues(searchParams.getAll('color'), VALID_COLORS);
    const requestedMinPrice = parsePriceParam(searchParams.get('minPrice'));
    const requestedMaxPrice = parsePriceParam(searchParams.get('maxPrice'));
    const requestedPriceFilterTouched = requestedMinPrice !== undefined || requestedMaxPrice !== undefined;
    const requestedPriceRange: [number, number] = [
      requestedMinPrice ?? 0,
      Math.max(requestedMinPrice ?? 0, requestedMaxPrice ?? priceRangeMaxRef.current),
    ];
    const requestedPage = parsePageParam(searchParams.get('page'));
    setKeyword(kw);
    setCategoryId(cid);
    setDiscount(disc);
    setSortBy(requestedSort);
    setPetSizes(requestedPetSizes);
    setMaterials(requestedMaterials);
    setColors(requestedColors);
    setPriceFilterTouched(requestedPriceFilterTouched);
    if (requestedPriceFilterTouched) {
      setPriceRange(requestedPriceRange);
    }
    setCurrentPage(requestedPage);
    fetchProducts(kw, cid, disc, {
      minPrice: requestedMinPrice,
      maxPrice: requestedMaxPrice,
      petSizes: requestedPetSizes,
      materials: requestedMaterials,
      colors: requestedColors,
      collection: activeCollection || undefined,
      sort: requestedSort,
      page: requestedPage - 1,
      size: pageSize,
    });
  }, [fetchProducts, pageSize, searchParams, language]);

  useEffect(() => {
    if (products.length > 0) {
      previousProductsRef.current = products;
    }
  }, [products]);

  const handleSearch = (value: string) => {
    const trimmed = normalizeSearchValue(value);
    if (trimmed) {
      const nextHistory = [trimmed, ...searchHistory.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_SEARCH_HISTORY);
      setSearchHistory(nextHistory);
      writeSearchHistory(nextHistory);
    }
    navigate(buildProductsUrl({ keyword: trimmed }));
  };

  const handleSearchTermKeyDown = (event: React.KeyboardEvent<HTMLElement>, term: string) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    handleSearch(term);
  };

  const clearSearchHistory = () => {
    setSearchHistory([]);
    writeSearchHistory([]);
  };

  const handleCompare = useCallback((e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    const result = addCompareProduct(product);
    if (result.status === 'full') {
      message.warning(t('pages.productList.compareFull', { count: MAX_COMPARE_ITEMS }));
      return;
    }
    message.success(result.status === 'exists' ? t('pages.productList.compareExists') : t('pages.productList.compareAdded'));
    navigate('/compare');
  }, [navigate, t]);

  const handleWishlistToggle = useCallback(async (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      message.warning(t('messages.loginRequired'));
      navigate(buildLoginUrlFromWindow());
      return;
    }
    try {
      const res = await wishlistApi.toggle(0, product.id);
      setWishlistedProductIds((current) => {
        const next = new Set(current);
        if (res.data.wishlisted) {
          next.add(product.id);
        } else {
          next.delete(product.id);
        }
        return next;
      });
      dispatchDomEvent('shop:wishlist-updated');
      message.success(res.data.wishlisted ? t('pages.productDetail.favoritedMsg') : t('pages.productDetail.unfavoritedMsg'));
    } catch (error) {
      message.error(getApiErrorMessage(error, t('messages.operationFailed'), language));
    }
  }, [isAuthenticated, language, navigate, t]);

  const openProductDetail = useCallback((productId: number) => {
    navigate(`/products/${productId}`);
  }, [navigate]);

  const resetFilters = () => {
    setPriceRange([0, maxCatalogPrice]);
    setPriceFilterTouched(false);
    setPetSizes([]);
    setMaterials([]);
    setColors([]);
    setCurrentPage(1);
    navigate(buildProductsUrl({
      petSizes: [],
      materials: [],
      colors: [],
      priceRange: [0, maxCatalogPrice],
      priceFilterTouched: false,
    }));
  };

  const handleCategoryChange = (cid: number | undefined) => {
    setCategoryId(cid);
    navigate(buildProductsUrl({ categoryId: cid }));
    setFilterDrawerOpen(false);
  };

  const openQuickAdd = useCallback((e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    setQuickAddSubmitting(false);
    setQuickAddProduct(product);
    setQuickAddOptions({});
  }, []);

  const selectQuickAddOption = (groupName: string, value: string) => {
    setQuickAddOptions((current) =>
      selectCompatibleProductOption(quickAddOptionGroups, quickAddVariants, current, groupName, value),
    );
  };

  const renderQuickAddOptions = () => (
    <>
      <Text type="secondary">{t('pages.productList.quickAddHint')}</Text>
      {quickAddOptionGroups.map((group) => (
        (() => {
          const groupLabel = getLocalizedOptionLabel(group.name, language);
          const quickAddOptionLabel = `${groupLabel}: ${quickAddProductName || t('pages.productList.quickAdd')}`;
          return (
            <Select
              key={group.name}
              placeholder={groupLabel}
              value={quickAddOptions[group.name] || undefined}
              aria-label={quickAddOptionLabel}
              title={quickAddOptionLabel}
              onChange={(value) => selectQuickAddOption(group.name, value)}
              options={group.values.map((value) => ({
                value,
                label: getLocalizedOptionLabel(value, language),
                disabled: !optionValueIsCompatible(quickAddVariants, quickAddOptions, group.name, value),
              }))}
              className="product-list__quickAddSelect"
              classNames={{ popup: { root: 'shop-mobile-popup-layer product-list__quickAddPopup' } }}
              getPopupContainer={() => document.body}
            />
          );
        })()
      ))}
      {Object.keys(quickAddOptions).length > 0 && (
        <Button
          type="link"
          onClick={() => setQuickAddOptions({})}
          className="product-list__quickAddReset"
          aria-label={quickAddResetActionLabel}
          title={quickAddResetActionLabel}
        >
          {t('common.reset')}
        </Button>
      )}
    </>
  );

  const handleStockAlert = useCallback((e: React.MouseEvent, product: Product, stockAlerted: boolean) => {
    e.stopPropagation();
    if (stockAlerted) {
      removeStockAlert(product.id);
      message.success(t('pages.stockAlerts.removed'));
      return;
    }
    const result = addStockAlert(product);
    message.success(result.status === 'exists' ? t('pages.stockAlerts.exists') : t('pages.stockAlerts.added'));
  }, [t]);

  const prefetchProduct = useCallback((productId: number) => {
    void productApi.prefetchById(productId);
  }, []);

  const openProductPreview = useCallback((event: React.MouseEvent, product: Product) => {
    event.stopPropagation();
    setPreviewProduct(product);
    prefetchProduct(product.id);
  }, [prefetchProduct]);

  const submitQuickAdd = async () => {
    if (!quickAddProduct) return;
    if (quickAddSubmitting) return;
    const missingOption = quickAddOptionGroups.find((group) => !quickAddOptions[group.name]);
    if (missingOption) {
      message.warning(t('pages.productDetail.selectOption', { option: missingOption.name }));
      return;
    }
    if (quickAddVariants.length > 0 && !quickAddVariant) {
      message.warning(t('pages.productDetail.variantUnavailable'));
      return;
    }
    const selectedStock = quickAddVariant?.stock ?? quickAddProduct.stock;
    if (selectedStock !== undefined && selectedStock <= 0) {
      message.error(t('pages.productDetail.insufficientStock'));
      return;
    }
    const bundleInfo = getBundleInfo(quickAddProduct);
    if (bundleInfo) {
      const token = getLocalStorageItem('token');
      const selectedSpecs = buildBundleSpecs(quickAddProduct, quickAddOptions, quickAddVariant?.sku);
      const snapshot = buildQuickAddCartSnapshot();
      setQuickAddSubmitting(true);
      try {
        if (token) {
          await cartApi.addItem(0, quickAddProduct.id, 1, selectedSpecs);
          dispatchDomEvent('shop:cart-updated');
        } else if (snapshot) {
          addGuestCartItem(snapshot, 1, selectedSpecs, bundleInfo.price);
        }
        message.success(t('messages.addCartSuccess'));
        setQuickAddProduct(null);
        await openCartDrawerWithSnapshot({ authenticated: Boolean(token) });
      } catch (error) {
        message.error(getApiErrorMessage(error, t('messages.addFailed'), language));
      } finally {
        setQuickAddSubmitting(false);
      }
      return;
    }
    const token = getLocalStorageItem('token');
    const selectedSpecs = quickAddOptionGroups.length
      ? JSON.stringify({
        ...quickAddOptions,
        ...(quickAddVariant?.sku ? { _variantSku: quickAddVariant.sku } : {}),
      })
      : undefined;
    const selectedPrice = quickAddPrice;
    const snapshot = buildQuickAddCartSnapshot();
    setQuickAddSubmitting(true);
    try {
      if (token) {
        await cartApi.addItem(0, quickAddProduct.id, 1, selectedSpecs);
        dispatchDomEvent('shop:cart-updated');
      } else if (snapshot) {
        addGuestCartItem(snapshot, 1, selectedSpecs, selectedPrice);
      }
      message.success(t('messages.addCartSuccess'));
      setQuickAddProduct(null);
      await openCartDrawerWithSnapshot({ authenticated: Boolean(token) });
    } catch (error) {
      message.error(getApiErrorMessage(error, t('messages.addFailed'), language));
    } finally {
      setQuickAddSubmitting(false);
    }
  };

  const filteredProducts = useMemo(() => collectionProducts.filter((product) => {
    const price = getPrice(product);
    const specs = product.specifications || {};
    const specText = Object.values(specs).join(' ').toLowerCase();
    const matchPrice = !priceFilterActive || (price >= displayedPriceRange[0] && price <= displayedPriceRange[1]);
    const matchSize = petSizes.length === 0 || petSizes.some((size) => specText.includes(size.toLowerCase()));
    const matchMaterial = materials.length === 0 || materials.some((material) => specText.includes(material.toLowerCase()));
    const matchColor = colors.length === 0 || colors.some((color) => specText.includes(color.toLowerCase()) || product.name.toLowerCase().includes(color.toLowerCase()));
    return matchPrice && matchSize && matchMaterial && matchColor;
  }), [collectionProducts, colors, displayedPriceRange, materials, petSizes, priceFilterActive]);

  const personalizedProductIds = useMemo(
    () => new Set(personalizedProducts.map((product) => product.id)),
    [personalizedProducts],
  );
  const topPreferenceCategory = useMemo(() => {
    const [categoryIdValue] = Object.entries(viewPreferences.categories || {})
      .sort((left, right) => Number(right[1] || 0) - Number(left[1] || 0))[0] || [];
    return categoryIdValue;
  }, [viewPreferences.categories]);
  const topPreferenceBrand = useMemo(() => {
    const [brand] = Object.entries(viewPreferences.brands || {})
      .sort((left, right) => Number(right[1] || 0) - Number(left[1] || 0))[0] || [];
    return brand;
  }, [viewPreferences.brands]);
  const getPersonalizedSortScore = (product: Product) =>
    (personalizedProductIds.has(product.id) ? 42 : 0) +
    (String(product.categoryId) === topPreferenceCategory ? 14 : 0) +
    (topPreferenceBrand && product.brand === topPreferenceBrand ? 12 : 0) +
    (viewPreferences.recent.includes(product.id) ? 6 : 0) +
    (isBestValueProduct(product) ? 34 : 0) +
    (isQuickAddReady(product) ? 18 : 0) +
    Math.min(18, getDiscountPercent(product)) +
    Math.min(14, getPositiveRate(product) / 8) +
    Math.min(10, Number(product.reviewCount || 0) / 2) +
    (getLowStockCount(product.stock) !== null ? 4 : 0);

  const getConversionSortScore = (product: Product) =>
    getPersonalizedSortScore(product) +
    (product.isFeatured ? 12 : 0) +
    (product.activeLimitedTimeDiscount ? 10 : 0) +
    (product.freeShipping ? 8 : 0) +
    (getSavingsAmount(product) > 0 ? Math.min(12, getSavingsAmount(product) / 20) : 0) -
    (isProductSoldOut(product) ? 120 : 0);

  const sortedProducts = usingServerPagination ? [...filteredProducts] : [...filteredProducts].sort((a, b) => {
    if (sortBy === 'quick-add-desc') {
      const readyDiff = Number(isQuickAddReady(b)) - Number(isQuickAddReady(a));
      if (readyDiff !== 0) return readyDiff;
      return getConversionSortScore(b) - getConversionSortScore(a);
    }
    if (sortBy === 'best-value-desc') {
      const valueDiff = Number(isBestValueProduct(b)) - Number(isBestValueProduct(a));
      if (valueDiff !== 0) return valueDiff;
      const savingsDiff = getSavingsAmount(b) - getSavingsAmount(a);
      if (savingsDiff !== 0) return savingsDiff;
      return getConversionSortScore(b) - getConversionSortScore(a);
    }
    if (sortBy === 'low-stock-desc') {
      const aStock = getLowStockCount(a.stock);
      const bStock = getLowStockCount(b.stock);
      const urgencyDiff = Number(bStock !== null && !isProductSoldOut(b)) - Number(aStock !== null && !isProductSoldOut(a));
      if (urgencyDiff !== 0) return urgencyDiff;
      if (aStock !== null && bStock !== null && aStock !== bStock) return aStock - bStock;
      return getConversionSortScore(b) - getConversionSortScore(a);
    }
    if (sortBy === 'personalized-desc') {
      return getPersonalizedSortScore(b) - getPersonalizedSortScore(a);
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
    return getConversionSortScore(b) - getConversionSortScore(a);
  });
  const productCountForUi = usingServerPagination ? productTotal : sortedProducts.length;
  const handleProductPageChange = useCallback((nextPage: number) => {
    const totalPages = Math.max(1, Math.ceil(productCountForUi / pageSize));
    const normalizedPage = Math.min(totalPages, normalizePageNumber(nextPage));
    setCurrentPage(normalizedPage);
    if (usingServerPagination) {
      navigate(buildProductsUrl({ page: normalizedPage }));
    }
    scrollAppToTop('smooth');
  }, [buildProductsUrl, navigate, pageSize, productCountForUi, usingServerPagination]);
  const updateBackToTopVisibility = useCallback(() => {
    const metrics = getAppScrollMetrics();
    setShowBackToTop(metrics.scrollTop > 640 && metrics.scrollHeight > metrics.viewportHeight + 320);
  }, []);
  useEffect(() => {
    updateBackToTopVisibility();
    return addAppScrollListener(updateBackToTopVisibility, { passive: true });
  }, [updateBackToTopVisibility]);
  const handleBackToTop = useCallback(() => {
    setShowBackToTop(false);
    scrollAppToTop('smooth');
  }, []);
  const checkoutPathProducts = sortedProducts.filter((product) => !isProductSoldOut(product)).slice(0, 3);
  const checkoutPathReadyCount = checkoutPathProducts.filter(isQuickAddReady).length;

  const productListInsightTotals = filteredProducts.reduce((summary, product) => {
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
  const productListInsights = {
    bestValueCount: productListInsightTotals.bestValueCount,
    lowStockCount: productListInsightTotals.lowStockCount,
    quickAddReadyCount: productListInsightTotals.quickAddReadyCount,
    averageSavings: filteredProducts.length ? productListInsightTotals.totalSavings / filteredProducts.length : 0,
  };
  const selectedCategoryName = selectedCategory
    ? normalizeCategoryTitle(selectedCategory)
    : '';
  const leadingCategoryName = categoryRows[0]
    ? normalizeCategoryTitle(categoryRows[0])
    : '';
  const topCategoryName = selectedCategoryName
    || leadingCategoryName
    || normalizeCatalogTitle(t('pages.productList.allCategories'), catalogTitleFallback);
  const collectionLabel = normalizeCatalogTitle(getCollectionLabel(collection), catalogTitleFallback);
  const catalogHeroTitle = normalizeCatalogTitle(keyword.trim()
    || selectedCategoryName
    || (categoryId ? leadingCategoryName : '')
    || (collection ? collectionLabel : '')
    || (discount ? t('pages.productList.shopBestDeals') : '')
    || catalogTitleFallback, catalogTitleFallback);
  const recommendedProduct = filteredProducts
    .filter((product) => !isProductSoldOut(product))
    .map((product, index) => ({
      product,
      index,
      score: getPersonalizedSortScore(product),
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)[0]?.product || null;
  const heroProduct = recommendedProduct || sortedProducts.find((product) => !isProductSoldOut(product)) || sortedProducts[0] || null;
  const heroProductHighlights = heroProduct
    ? [
      heroProduct.brand,
      getDiscountPercent(heroProduct) > 0 ? t('pages.productList.sale') : '',
      isQuickAddReady(heroProduct) ? t('pages.productList.cardQuickReady') : t('pages.productList.cardOptionsNeeded'),
    ].filter(Boolean)
    : [];
  const mobileHeroSignal = heroProduct
    ? [
      formatMoney(getPrice(heroProduct)),
      isQuickAddReady(heroProduct) ? t('pages.productList.cardQuickReady') : t('pages.productList.cardOptionsNeeded'),
      getLowStockCount(heroProduct.stock) !== null
        ? t('pages.productList.cardLowStock', { count: getLowStockCount(heroProduct.stock) as number })
        : '',
    ].filter(Boolean).join(' / ')
    : t('pages.productList.quickAddReady', { count: productListInsights.quickAddReadyCount });
  const heroProductName = heroProduct ? productListProductName(heroProduct) : '';
  const quickAddProductName = quickAddProduct ? productListProductName(quickAddProduct) : '';
  const quickAddSubmitActionLabel = `${t('pages.productList.addToCart')}: ${quickAddProductName || t('pages.productList.quickAdd')}`;
  const quickAddResetActionLabel = `${t('common.reset')}: ${quickAddProductName || t('pages.productList.quickAdd')}`;
  const previewProductName = previewProduct ? productListProductName(previewProduct) : '';
  const previewProductWishlisted = previewProduct ? wishlistedProductIds.has(previewProduct.id) : false;
  const previewProductStockAlerted = previewProduct ? alertedStockProductIds.has(previewProduct.id) : false;
  const previewPrimaryLabel = previewProduct
    ? isQuickAddReady(previewProduct) ? t('pages.productList.quickAdd') : t('pages.productList.chooseOptionsAction')
    : '';
  const previewPrimaryActionLabel = previewProduct ? `${previewPrimaryLabel}: ${previewProductName}` : '';
  const previewStockAlertActionLabel = previewProduct
    ? `${previewProductStockAlerted ? t('pages.stockAlerts.remove') : t('pages.stockAlerts.notifyMe')}: ${previewProductName}`
    : '';
  const previewViewActionLabel = previewProduct ? `${t('pages.productList.viewDetails')}: ${previewProductName}` : '';
  const previewWishlistActionLabel = previewProduct
    ? `${previewProductWishlisted ? t('pages.productDetail.favorited') : t('pages.productDetail.favorite')}: ${previewProductName}`
    : '';
  const previewRatingValue = previewProduct ? Math.max(0, Math.min(5, Number(previewProduct.averageRating || 0))) : 0;
  const previewRatingSummary = previewProduct
    ? hasReviewSignal(previewProduct)
      ? t('pages.productList.positiveRate', {
        rate: Math.round(previewProduct.positiveRate || 0).toString(),
        count: previewProduct.reviewCount || 0,
      })
      : t('pages.productList.noReviewsYet')
    : '';
  const previewRatingLabel = previewProduct
    ? `${t('pages.productDetail.rating')}: ${previewRatingValue.toFixed(1)} / 5, ${previewRatingSummary}`
    : '';
  const renderProductAmountText = useCallback((label: string, amount: string) => {
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
  }, []);
  const renderSavingsText = useCallback((amount: number) => renderProductAmountText(
    t('pages.productList.bestValueSavings', { amount: formatMoney(amount) }),
    formatMoney(amount),
  ), [formatMoney, renderProductAmountText, t]);
  const productListGuideText = activeFilterCount > 0
    ? t('pages.productList.guideRefineResults')
    : productListInsights.bestValueCount > 0
      ? t('pages.productList.guideBestValue', { count: productListInsights.bestValueCount })
      : productListInsights.quickAddReadyCount > 0
        ? t('pages.productList.guideQuickAdd', { count: productListInsights.quickAddReadyCount })
        : t('pages.productList.guideStart');
  const sortOptions = [
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
  ];
  const mobileDiscoveryActions = [
    {
      key: 'all',
      icon: <SearchOutlined />,
      label: t('pages.productList.allCategories'),
      active: !collection && !keyword.trim() && !discount && sortBy === 'default' && activeRefinementCount === 0,
      onClick: () => {
        setKeyword('');
        setCategoryId(undefined);
        setDiscount(false);
        setSortBy('default');
        setPetSizes([]);
        setMaterials([]);
        setColors([]);
        setPriceRange([0, maxCatalogPrice]);
        setPriceFilterTouched(false);
        setCurrentPage(1);
        navigate('/products');
      },
    },
    {
      key: 'deals',
      icon: <FireOutlined />,
      label: t('pages.productList.shopBestDeals'),
      active: discount || sortBy === 'discount-desc',
      onClick: () => {
        setDiscount(true);
        setSortBy('discount-desc');
        setCurrentPage(1);
        navigate(buildProductsUrl({ discount: true, sortBy: 'discount-desc' }));
      },
    },
    {
      key: 'smart',
      icon: <GiftOutlined />,
      label: t('nav.petNav.smartDevices'),
      active: collection === 'smart-devices',
      onClick: () => {
        setCurrentPage(1);
        navigate(buildProductsUrl({ collection: 'smart-devices' }));
      },
    },
    {
      key: 'rated',
      icon: <BarChartOutlined />,
      label: t('pages.productList.shopTopRated'),
      active: sortBy === 'positive-rate-desc',
      onClick: () => applySort('positive-rate-desc'),
    },
    {
      key: 'quick',
      icon: <ShoppingCartOutlined />,
      label: t('pages.productList.shopQuickAdd'),
      active: sortBy === 'quick-add-desc',
      onClick: () => applySort('quick-add-desc'),
    },
    {
      key: 'support',
      icon: <CustomerServiceOutlined />,
      label: t('footer.helpCenter'),
      active: false,
      onClick: openSupport,
    },
  ];
  const resetCatalogView = () => {
    setKeyword('');
    setCategoryId(undefined);
    setDiscount(false);
    setSortBy('default');
    setPetSizes([]);
    setMaterials([]);
    setColors([]);
    setPriceRange([0, maxCatalogPrice]);
    setPriceFilterTouched(false);
    setCurrentPage(1);
    navigate('/products');
  };
  const resetMobileRefinements = () => {
    resetFilters();
    setCategoryId(undefined);
    navigate(buildProductsUrl({
      categoryId: undefined,
      petSizes: [],
      materials: [],
      colors: [],
      priceRange: [0, maxCatalogPrice],
      priceFilterTouched: false,
    }));
  };
  const hasActiveCatalogContext = Boolean(keyword.trim() || categoryId || collection || discount || activeRefinementCount > 0);
  const mobileNextStepText = filteredProducts.length === 0
    ? hasActiveCatalogContext
      ? t('pages.productList.loadRecoveryTipFilters')
      : t('pages.productList.guideStart')
    : productListGuideText;
  const mobileNextStepTitle = filteredProducts.length === 0 && activeRefinementCount > 0
    ? t('pages.productList.activeFilters', { count: activeRefinementCount })
    : t('pages.productList.count', { count: productCountForUi });
  const mobileNextStepActions = filteredProducts.length === 0
    ? [
      {
        key: 'recover',
        icon: activeRefinementCount > 0 ? <ReloadOutlined /> : <FilterOutlined />,
        label: activeRefinementCount > 0 ? t('pages.productList.resetFilters') : t('pages.productList.filters'),
        primary: activeRefinementCount > 0,
        onClick: activeRefinementCount > 0 ? resetMobileRefinements : () => setFilterDrawerOpen(true),
      },
      {
        key: 'catalog',
        icon: <SearchOutlined />,
        label: t('pages.productList.allCategories'),
        primary: activeRefinementCount === 0 && hasActiveCatalogContext,
        onClick: resetCatalogView,
      },
      {
        key: 'coupons',
        icon: <GiftOutlined />,
        label: t('pages.productList.loadRecoveryCoupons'),
        primary: !hasActiveCatalogContext,
        onClick: () => navigate('/coupons'),
      },
    ]
    : [
      {
        key: 'filter',
        icon: <FilterOutlined />,
        label: t('pages.productList.filters'),
        primary: activeRefinementCount > 0,
        onClick: () => setFilterDrawerOpen(true),
      },
      {
        key: 'deals',
        icon: <FireOutlined />,
        label: t('pages.productList.shopBestDeals'),
        primary: productListInsights.bestValueCount > 0,
        onClick: () => applySort('discount-desc'),
      },
      {
        key: 'quick',
        icon: <ShoppingCartOutlined />,
        label: t('pages.productList.shopQuickAdd'),
        primary: productListInsights.quickAddReadyCount > 0,
        onClick: () => applySort('quick-add-desc'),
      },
    ];
  const currentSortLabel = sortOptions.find((option) => option.value === sortBy)?.label || t('pages.productList.defaultSort');
  const activeResultContextActions = [
    keyword.trim()
      ? {
        key: 'keyword',
        icon: <SearchOutlined />,
        label: `${t('common.search')}: ${keyword.trim()}`,
        onClear: () => {
          setKeyword('');
          setCurrentPage(1);
          navigate(buildProductsUrl({ keyword: '' }));
        },
      }
      : null,
    collection
      ? {
        key: 'collection',
        icon: <GiftOutlined />,
        label: normalizeCatalogTitle(getCollectionLabel(collection), catalogTitleFallback),
        onClear: () => {
          setCurrentPage(1);
          navigate(buildProductsUrl({ collection: '' }));
        },
      }
      : null,
    discount
      ? {
        key: 'discount',
        icon: <FireOutlined />,
        label: t('pages.productList.shopBestDeals'),
        onClear: () => {
          setDiscount(false);
          setCurrentPage(1);
          navigate(buildProductsUrl({ discount: false }));
        },
      }
      : null,
    ...activeRefinementTags.map((tag) => ({
      key: `refinement-${tag.key}`,
      icon: <FilterOutlined />,
      label: tag.label,
      onClear: tag.onClose,
    })),
    sortBy !== 'default'
      ? {
        key: 'sort',
        icon: <BarChartOutlined />,
        label: `${t('pages.productList.sortLabel')}: ${currentSortLabel}`,
        onClear: () => applySort('default'),
      }
      : null,
  ].filter(Boolean) as ActiveResultContextAction[];
  const productListFilterContextLabel = `${t('pages.productList.filters')}: ${activeRefinementCount > 0 ? t('pages.productList.activeFilters', { count: activeRefinementCount }) : t('pages.productList.allCategories')}, ${t('pages.productList.count', { count: productCountForUi })}`;
  const openFilterDrawerActionLabel = productListFilterContextLabel;
  const resetRefinementsActionLabel = `${t('pages.productList.resetFilters')}: ${productListFilterContextLabel}`;
  const applyRefinementsActionLabel = `${t('pages.productList.applyFilters')}: ${productListFilterContextLabel}`;
  const shopBestDealsActionLabel = `${t('pages.productList.shopBestDeals')}: ${t('pages.productList.count', { count: productCountForUi })}`;
  const shopQuickAddActionLabel = `${t('pages.productList.shopQuickAdd')}: ${t('pages.productList.quickAddReady', { count: productListInsights.quickAddReadyCount })}`;
  const loadRecoveryContextLabel = `${t('pages.productList.fetchFailed')}: ${productListFilterContextLabel}`;
  const refreshCatalogActionLabel = `${t('common.refresh')}: ${loadRecoveryContextLabel}`;
  const allCategoriesRecoveryActionLabel = `${t('pages.productList.allCategories')}: ${loadRecoveryContextLabel}`;
  const couponsRecoveryActionLabel = `${t('pages.productList.loadRecoveryCoupons')}: ${loadRecoveryContextLabel}`;
  const supportRecoveryActionLabel = `${t('pages.productList.loadRecoverySupport')}: ${loadRecoveryContextLabel}`;
  const emptyAllCategoriesActionLabel = `${t('pages.productList.allCategories')}: ${t('pages.productList.empty')}`;
  const emptyResetFiltersActionLabel = `${t('pages.productList.resetFilters')}: ${t('pages.productList.empty')}, ${productListFilterContextLabel}`;
  const mobilePrimaryActionLabel = heroProduct
    ? `${isQuickAddReady(heroProduct) ? t('pages.productList.addToCart') : t('pages.productList.chooseOptionsAction')}: ${heroProductName}`
    : filteredProducts.length > 0
      ? shopQuickAddActionLabel
      : `${t('pages.productList.loadRecoveryCoupons')}: ${t('pages.productList.empty')}`;
  const mobileSecondaryActionLabel = filteredProducts.length > 0
    ? shopBestDealsActionLabel
    : activeRefinementCount > 0
      ? resetRefinementsActionLabel
      : `${t('pages.productList.allCategories')}: ${t('pages.productList.empty')}`;
  const backToTopActionLabel = t('common.backToTop');
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(productCountForUi / pageSize));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, pageSize, productCountForUi]);

  const paginatedProducts = usingServerPagination
    ? sortedProducts
    : sortedProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const renderBadges = useCallback((product: Product) => buildProductListBadges(product, t), [t]);

  const renderCategoryPanel = () => (
    <div className="product-list__categoryStack">
      <Button
        type={!categoryId ? 'primary' : 'text'}
        block
        aria-pressed={!categoryId}
        aria-label={t('pages.productList.allCategories')}
        title={t('pages.productList.allCategories')}
        onClick={() => handleCategoryChange(undefined)}
        className="product-list__categoryButton"
      >
        {t('pages.productList.allCategories')}
      </Button>
      {categoryRows.map((cat) => {
        const categoryTitle = normalizeCategoryTitle(cat);
        const selected = categoryId === cat.id;
        return (
          <Button
            key={cat.id}
            type={selected ? 'primary' : 'text'}
            block
            aria-pressed={selected}
            aria-label={categoryTitle}
            title={categoryTitle}
            onClick={() => handleCategoryChange(cat.id)}
            className="product-list__categoryButton"
            style={{ paddingLeft: 12 + ((categoryDepthById.get(cat.id) || 1) - 1) * 14 }}
          >
            {categoryTitle}
          </Button>
        );
      })}
    </div>
  );

  const renderFilterPanel = () => (
    <Space direction="vertical" className="product-list__filterStack" size="middle">
      <div>
        <Text strong>{t('pages.productList.price')}</Text>
        <Slider
          range
          min={0}
          max={maxCatalogPrice}
          step={priceStep}
          value={displayedPriceRange}
          ariaLabelForHandle={[
            `${t('pages.productList.price')} ${formatMoney(displayedPriceRange[0])}`,
            `${t('pages.productList.price')} ${formatMoney(displayedPriceRange[1])}`,
          ]}
          onChange={(value) => {
            setPriceFilterTouched(true);
            setPriceRange(value as [number, number]);
            setCurrentPage(1);
          }}
          onChangeComplete={(value) => commitPriceRange(value as [number, number])}
        />
        <Text type="secondary" className="commerce-atomic">{formatMoney(displayedPriceRange[0])} - {formatMoney(displayedPriceRange[1])}</Text>
      </div>
      <div>
        <Text strong className="product-list__filterLabel">{t('pages.productList.filterSize')}</Text>
        <Checkbox.Group
          value={petSizes}
          aria-label={`${t('pages.productList.filterSize')}: ${t('pages.productList.filters')}`}
          onChange={(value) => updatePetSizes(value.map(String))}
          options={petSizeOptions}
        />
      </div>
      <div>
        <Text strong className="product-list__filterLabel">{t('pages.productList.filterMaterial')}</Text>
        <Checkbox.Group
          value={materials}
          aria-label={`${t('pages.productList.filterMaterial')}: ${t('pages.productList.filters')}`}
          onChange={(value) => updateMaterials(value.map(String))}
          options={materialOptions}
        />
      </div>
      <div>
        <Text strong className="product-list__filterLabel">{t('pages.productList.filterColor')}</Text>
        <Checkbox.Group
          value={colors}
          aria-label={`${t('pages.productList.filterColor')}: ${t('pages.productList.filters')}`}
          onChange={(value) => updateColors(value.map(String))}
        >
          {colorOptions.map((option) => (
            <Checkbox key={option.value} value={option.value} aria-label={option.label}>
              <span className="product-list__colorOption">
                <span
                  className="product-list__colorSwatch"
                  style={{ backgroundColor: option.swatch }}
                  aria-hidden="true"
                  data-color-value={option.value}
                />
                <span className="product-list__colorName">{option.label}</span>
              </span>
            </Checkbox>
          ))}
        </Checkbox.Group>
      </div>
    </Space>
  );
  const emptyDiscoveryActions = [
    {
      key: 'catalog',
      icon: <FilterOutlined />,
      title: activeRefinementCount > 0 ? t('pages.productList.resetFilters') : t('pages.productList.allCategories'),
      text: t('pages.productList.loadRecoveryTipFilters'),
      ariaLabel: activeRefinementCount > 0 ? resetRefinementsActionLabel : emptyAllCategoriesActionLabel,
      primary: true,
      onClick: () => {
        if (activeRefinementCount > 0) {
          resetMobileRefinements();
          return;
        }
        navigate('/products');
      },
    },
    {
      key: 'deals',
      icon: <FireOutlined />,
      title: t('pages.productList.shopBestDeals'),
      text: t('pages.productList.guideStart'),
      ariaLabel: `${t('pages.productList.shopBestDeals')}: ${t('pages.productList.empty')}`,
      onClick: () => navigate('/products?discount=true'),
    },
    {
      key: 'coupons',
      icon: <GiftOutlined />,
      title: t('pages.productList.loadRecoveryCoupons'),
      text: t('pages.productList.loadRecoveryText'),
      ariaLabel: `${t('pages.productList.loadRecoveryCoupons')}: ${t('pages.productList.empty')}`,
      onClick: () => navigate('/coupons'),
    },
    {
      key: 'support',
      icon: <CustomerServiceOutlined />,
      title: t('pages.productList.loadRecoverySupport'),
      text: t('pages.productList.loadRecoveryTipSupport'),
      ariaLabel: `${t('pages.productList.loadRecoverySupport')}: ${t('pages.productList.empty')}`,
      onClick: openSupport,
    },
  ];
  const renderDiscoveryActions = () => (
    <div className="product-list__emptyDiscovery" aria-label={t('pages.productList.guideTitle')}>
      {emptyDiscoveryActions.map((action) => (
        <button
          key={action.key}
          type="button"
          className={`product-list__emptyDiscoveryCard${action.primary ? ' product-list__emptyDiscoveryCard--primary' : ''}`}
          aria-label={action.ariaLabel}
          title={action.ariaLabel}
          onClick={action.onClick}
        >
          <span className="product-list__emptyDiscoveryIcon">{action.icon}</span>
          <span>
            <strong>{action.title}</strong>
            <small>{action.text}</small>
          </span>
        </button>
      ))}
    </div>
  );

  return (
    <div className={`product-list product-list--${language}${!loading && !loadFailed && filteredProducts.length === 0 ? ' product-list--empty' : ''}${quickAddProduct ? ' product-list--quickAddOpen' : ''}${previewProduct ? ' product-list--previewOpen' : ''}${filterDrawerOpen ? ' product-list--filterDrawerOpen' : ''}`}>
      <Row gutter={24}>
        <Col xs={0} sm={0} md={5} lg={4} className="product-list__sidebar">
          <Card title={t('pages.productList.sidebarTitle')} size="small" className="product-list__sidebarCard">
            {renderCategoryPanel()}
          </Card>
          <Card
            title={
              <Space>
                <span>{t('pages.productList.filters')}</span>
                {activeFilterCount > 0 ? <Tag color="blue">{t('pages.productList.activeFilters', { count: activeFilterCount })}</Tag> : null}
              </Space>
            }
            size="small"
            extra={
              <Button type="link" size="small" disabled={activeFilterCount === 0} onClick={resetFilters}>
                {t('pages.productList.resetFilters')}
              </Button>
            }
          >
            {renderFilterPanel()}
          </Card>
        </Col>
        <Col xs={24} sm={24} md={19} lg={20}>
          <section className="product-list__heroBand">
            <div className="product-list__heroContent">
              <span className="product-list__heroEyebrow">{topCategoryName}</span>
              <h1>{catalogHeroTitle}</h1>
              <Text>
                {collection
                  ? `${t('pages.productList.resultContextLabel')}: ${collectionLabel}`
                  : resultContextTags.length > 0
                    ? resultContextTags.map((tag) => tag.label).join(' / ')
                    : t('pages.productList.searchPlaceholder')}
              </Text>
              <div className="product-list__heroStats">
                <span>{t('pages.productList.count', { count: productCountForUi })}</span>
                <span>{t('pages.productList.quickAddReady', { count: productListInsights.quickAddReadyCount })}</span>
                <span>{t('pages.productList.bestValueCount', { count: productListInsights.bestValueCount })}</span>
              </div>
            </div>
            {heroProduct ? (
              <button
                type="button"
                className="product-list__heroCard"
                onMouseEnter={() => prefetchProduct(heroProduct.id)}
                onFocus={() => prefetchProduct(heroProduct.id)}
                onClick={() => openProductDetail(heroProduct.id)}
                aria-label={`${t('pages.productList.viewPick')}: ${heroProductName}`}
                title={`${t('pages.productList.viewPick')}: ${heroProductName}`}
              >
                <strong>{heroProductName}</strong>
                <Text className="commerce-money">{formatMoney(getPrice(heroProduct))}</Text>
                <span>{renderBadges(heroProduct).slice(0, 2).map((badge) => badge.label).join(' / ') || t('pages.productList.viewPick')}</span>
                {heroProductHighlights.length ? (
                  <div className="product-list__heroHighlights">
                    {heroProductHighlights.map((item) => (
                      <small key={item}>{item}</small>
                    ))}
                  </div>
                ) : null}
              </button>
            ) : null}
          </section>
          <Card className="product-list__toolbar">
            <Row gutter={[12, 12]} align="middle">
              <Col xs={24} sm={12} md={14} flex="auto">
                <Input.Search
                  placeholder={t('pages.productList.searchPlaceholder')}
                  aria-label={productSearchActionLabel}
                  title={productSearchActionLabel}
                  value={keyword}
                  maxLength={MAX_SEARCH_LENGTH}
                  onChange={e => setKeyword(e.target.value.slice(0, MAX_SEARCH_LENGTH))}
                  onSearch={handleSearch}
                  className="product-list__search"
                  enterButton={(
                    <Button
                      type="primary"
                      aria-label={productSearchActionLabel}
                      title={productSearchActionLabel}
                      icon={<SearchOutlined />}
                    />
                  )}
                />
              </Col>
              <Col xs={12} sm={5} md={6}>
                <Select
                  value={sortBy}
                  onChange={applySort}
                  className="product-list__sortSelect"
                  aria-label={`${t('pages.productList.defaultSort')}: ${currentSortLabel}`}
                  title={`${t('pages.productList.defaultSort')}: ${currentSortLabel}`}
                  options={sortOptions}
                  classNames={{ popup: { root: 'shop-mobile-popup-layer' } }}
                  getPopupContainer={() => document.body}
                />
              </Col>
              <Col xs={12} sm={7} md={4}>
                <div className="product-list__toolbarMeta">
                  <Text type="secondary">{t('pages.productList.count', { count: productCountForUi })}</Text>
                  <Button className="product-list__filterButton" icon={<FilterOutlined />} aria-label={openFilterDrawerActionLabel} title={openFilterDrawerActionLabel} onClick={() => setFilterDrawerOpen(true)}>
                    <span>{t('pages.productList.filters')}</span>
                    {activeRefinementCount > 0 ? (
                      <span className="product-list__filterCount">{activeRefinementCount > 99 ? '99+' : activeRefinementCount}</span>
                    ) : null}
                  </Button>
                </div>
              </Col>
            </Row>
            {activeResultContextActions.length > 0 ? (
              <section className="product-list__activeContextBar product-list__mobileContextBar" aria-label={t('pages.productList.resultContextLabel')}>
                {activeResultContextActions.map((action) => (
                  <button
                    key={action.key}
                    type="button"
                    className="product-list__activeContextChip product-list__mobileContextChip"
                    onClick={action.onClear}
                    aria-label={`${t('common.reset')}: ${action.label}`}
                    title={`${t('common.reset')}: ${action.label}`}
                  >
                    <span className="product-list__mobileContextIcon">{action.icon}</span>
                    <span>{action.label}</span>
                    <CloseOutlined className="product-list__mobileContextClose" aria-hidden />
                  </button>
                ))}
                <Button
                  type="link"
                  size="small"
                  className="product-list__activeContextReset"
                  aria-label={`${t('pages.productList.resetFilters')}: ${t('pages.productList.resultContextLabel')}`}
                  title={`${t('pages.productList.resetFilters')}: ${t('pages.productList.resultContextLabel')}`}
                  onClick={resetCatalogView}
                >
                  {t('pages.productList.resetFilters')}
                </Button>
              </section>
            ) : null}
            {searchHistory.length > 0 && (
              <Space wrap size={[8, 8]} className="product-list__recentSearches">
                <Text type="secondary">{t('pages.productList.recentSearches')}</Text>
                {searchHistory.map((term) => (
                  <Tag
                    key={term}
                    style={{ cursor: 'pointer' }}
                    role="button"
                    tabIndex={0}
                    aria-label={`${t('common.search')}: ${term}`}
                    title={`${t('common.search')}: ${term}`}
                    onClick={() => handleSearch(term)}
                    onKeyDown={(event) => handleSearchTermKeyDown(event, term)}
                  >
                    {term}
                  </Tag>
                ))}
                <Button type="link" size="small" aria-label={`${t('pages.productList.clearSearches')}: ${t('pages.productList.recentSearches')}`} title={`${t('pages.productList.clearSearches')}: ${t('pages.productList.recentSearches')}`} onClick={clearSearchHistory}>
                  {t('pages.productList.clearSearches')}
                </Button>
              </Space>
            )}
          </Card>
          <section className="product-list__mobileDiscovery" aria-label={t('home.categories')}>
            {mobileDiscoveryActions.map((action) => (
              <button
                key={action.key}
                type="button"
                className={action.active ? 'product-list__mobileDiscoveryButton product-list__mobileDiscoveryButton--active' : 'product-list__mobileDiscoveryButton'}
                aria-pressed={action.active}
                aria-label={`${action.label}: ${t('home.categories')}`}
                title={`${action.label}: ${t('home.categories')}`}
                onClick={action.onClick}
              >
                <span className="product-list__mobileDiscoveryIcon">{action.icon}</span>
                <span>{action.label}</span>
              </button>
            ))}
          </section>
          {!loading && !loadFailed ? (
            <section
              className={`product-list__mobileNextStep${filteredProducts.length === 0 ? ' product-list__mobileNextStep--empty' : ''}`}
              aria-label={t('pages.productList.guideTitle')}
            >
              <div className="product-list__mobileNextStepCopy">
                <span>{t('pages.productList.guideTitle')}</span>
                <strong>{mobileNextStepTitle}</strong>
                <Text>{mobileNextStepText}</Text>
              </div>
              <div className="product-list__mobileNextStepActions">
                {mobileNextStepActions.map((action) => (
                  <Button
                    key={action.key}
                    size="small"
                    type={action.primary ? 'primary' : 'default'}
                    icon={action.icon}
                    aria-label={`${action.label}: ${mobileNextStepTitle}`}
                    title={`${action.label}: ${mobileNextStepTitle}`}
                    onClick={action.onClick}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            </section>
          ) : null}
          {!loading && !loadFailed ? (
            <section
              className={`product-list__mobileConversionBar${filteredProducts.length === 0 ? ' product-list__mobileConversionBar--empty' : ''}`}
              aria-label={t('pages.productList.insightTitle')}
            >
              <div className="product-list__mobileConversionStats">
                <span className="product-list__mobileConversionEyebrow">{t('pages.productList.viewPick')}</span>
                <strong>{heroProduct?.name || t('pages.productList.count', { count: productCountForUi })}</strong>
                <span>
                  {activeRefinementCount > 0
                    ? t('pages.productList.activeFilters', { count: activeRefinementCount })
                    : mobileHeroSignal || t('pages.productList.quickAddReady', { count: productListInsights.quickAddReadyCount })}
                </span>
              </div>
              <div className="product-list__mobileConversionActions">
                <Button icon={<FilterOutlined />} aria-label={openFilterDrawerActionLabel} title={openFilterDrawerActionLabel} onClick={() => setFilterDrawerOpen(true)}>
                  {t('pages.productList.filters')}
                </Button>
                <Button aria-label={mobileSecondaryActionLabel} title={mobileSecondaryActionLabel} onClick={filteredProducts.length > 0 ? () => applySort('discount-desc') : activeRefinementCount > 0 ? resetMobileRefinements : () => navigate('/products')}>
                  {filteredProducts.length > 0
                    ? t('pages.productList.shopBestDeals')
                    : activeRefinementCount > 0
                      ? t('pages.productList.resetFilters')
                      : t('pages.productList.allCategories')}
                </Button>
                <Button
                  type="primary"
                  icon={heroProduct || filteredProducts.length > 0 ? <ShoppingCartOutlined /> : <GiftOutlined />}
                  aria-label={mobilePrimaryActionLabel}
                  title={mobilePrimaryActionLabel}
                  onClick={(event) => {
                    if (heroProduct) {
                      if (isQuickAddReady(heroProduct)) {
                        openQuickAdd(event, heroProduct);
                        return;
                      }
                      openProductDetail(heroProduct.id);
                      return;
                    }
                    if (filteredProducts.length > 0) {
                      applySort('quick-add-desc');
                      return;
                    }
                    navigate('/coupons');
                  }}
                >
                  {heroProduct
                    ? !isQuickAddReady(heroProduct)
                    ? t('pages.productList.chooseOptionsAction')
                      : t('pages.productList.addToCart')
                    : filteredProducts.length > 0
                      ? t('pages.productList.shopQuickAdd')
                      : t('pages.productList.loadRecoveryCoupons')}
                </Button>
              </div>
            </section>
          ) : null}
          {!loading && !loadFailed && filteredProducts.length > 0 ? (
            <>
              {usingCatalogSnapshot ? (
                <section className="product-list__snapshotNotice" role="status" aria-live="polite">
                  <div>
                    <Text strong>{t('pages.productList.snapshotTitle')}</Text>
                    <Text type="secondary">{t('pages.productList.snapshotText')}</Text>
                  </div>
                  <Button
                    size="small"
                    icon={<ReloadOutlined />}
                    aria-label={refreshCatalogActionLabel}
                    title={refreshCatalogActionLabel}
                    onClick={() => fetchProducts(keyword, categoryId, discount, buildActiveFetchFilters(Math.max(0, currentPage - 1)))}
                  >
                    {t('common.refresh')}
                  </Button>
                </section>
              ) : null}
              <section className="product-list__smartBar" aria-label={t('pages.productList.insightTitle')}>
                <div className="product-list__smartBarLeft">
                  <CheckCircleOutlined />
                  <Text strong>{t('pages.productList.insightTitle')}</Text>
                  <Space wrap size={[6, 6]} className="product-list__smartStats">
                    <Tag className="product-list__smartStat product-list__smartStat--ready">
                      {t('pages.productList.quickAddReady', { count: productListInsights.quickAddReadyCount })}
                    </Tag>
                    <Tag className="product-list__smartStat product-list__smartStat--value">
                      {t('pages.productList.bestValueCount', { count: productListInsights.bestValueCount })}
                    </Tag>
                  </Space>
                </div>
                <Space wrap className="product-list__smartActions" size={[8, 8]}>
                  {heroProduct ? (
                    <Button
                      className="product-list__smartPick"
                      onMouseEnter={() => prefetchProduct(heroProduct.id)}
                      onFocus={() => prefetchProduct(heroProduct.id)}
                      aria-label={`${t('pages.productList.viewPick')}: ${heroProductName}`}
                      title={`${t('pages.productList.viewPick')}: ${heroProductName}`}
                      onClick={() => openProductDetail(heroProduct.id)}
                    >
                      <span>{t('pages.productList.viewPick')}</span>
                      <strong>{heroProductName}</strong>
                    </Button>
                  ) : null}
                  <Button className="product-list__smartAction" aria-label={shopBestDealsActionLabel} title={shopBestDealsActionLabel} onClick={() => applySort('discount-desc')}>
                    {t('pages.productList.shopBestDeals')}
                  </Button>
                  <Button className="product-list__smartPersonal" aria-label={shopQuickAddActionLabel} title={shopQuickAddActionLabel} onClick={() => applySort('quick-add-desc')}>
                    {t('pages.productList.shopQuickAdd')}
                  </Button>
                </Space>
              </section>
              <section className="product-list__insightPanel" aria-label={t('pages.productList.guideTitle')}>
                <div className="product-list__insightCopy">
                  <span>{t('pages.productList.guideTitle')}</span>
                  <strong>{topCategoryName}</strong>
                  <Text>{productListGuideText}</Text>
                </div>
                <div className="product-list__insightMetrics">
                  <span>{renderProductAmountText(t('pages.productList.averageSavings', { amount: formatMoney(productListInsights.averageSavings) }), formatMoney(productListInsights.averageSavings))}</span>
                  <span>{t('pages.productList.lowStockCount', { count: productListInsights.lowStockCount })}</span>
                  {activeFilterCount > 0 ? (
                    <Button type="link" aria-label={resetRefinementsActionLabel} title={resetRefinementsActionLabel} onClick={resetFilters}>{t('pages.productList.resetFilters')}</Button>
                  ) : (
                    <Button type="link" aria-label={`${t('pages.productList.shopTopRated')}: ${topCategoryName}`} title={`${t('pages.productList.shopTopRated')}: ${topCategoryName}`} onClick={() => applySort('positive-rate-desc')}>{t('pages.productList.shopTopRated')}</Button>
                  )}
                </div>
              </section>
              {checkoutPathProducts.length > 0 ? (
                <section className="product-list__checkoutPath" aria-label={t('pages.productList.checkoutPathEyebrow')}>
                  <div className="product-list__checkoutPathCopy">
                    <Text className="product-list__checkoutPathEyebrow">{t('pages.productList.checkoutPathEyebrow')}</Text>
                    <strong>{t('pages.productList.checkoutPathTitle')}</strong>
                    <Text>{t('pages.productList.checkoutPathText', { count: checkoutPathProducts.length, ready: checkoutPathReadyCount })}</Text>
                  </div>
                  <div className="product-list__checkoutPathItems">
                    {checkoutPathProducts.map((product) => {
                      const productName = productListProductName(product);
                      const quickReady = isQuickAddReady(product);
                      const lowStock = getLowStockCount(product.stock);
                      const tagLabel = quickReady
                        ? t('pages.productList.cardQuickReady')
                        : lowStock !== null
                          ? t('pages.productList.cardLowStock', { count: lowStock })
                          : t('pages.productList.cardOptionsNeeded');
                      const tagColor = quickReady ? 'green' : lowStock !== null ? 'red' : 'blue';
                      const savings = getSavingsAmount(product);
                      return (
                        <button
                          key={product.id}
                          type="button"
                          className="product-list__checkoutPathItem"
                          aria-label={`${t('pages.productList.viewPick')}: ${productName}`}
                          title={`${t('pages.productList.viewPick')}: ${productName}`}
                          onMouseEnter={() => prefetchProduct(product.id)}
                          onFocus={() => prefetchProduct(product.id)}
                          onClick={(event) => {
                            if (quickReady) {
                              openQuickAdd(event, product);
                              return;
                            }
                            openProductDetail(product.id);
                          }}
                        >
                          <span>
                            <strong>{productName}</strong>
                            <small className="commerce-atomic">
                              <span className="commerce-money">{formatMoney(getPrice(product))}</span>
                              {savings > 0 ? <span> - {renderSavingsText(savings)}</span> : null}
                            </small>
                          </span>
                          <Tag color={tagColor}>{tagLabel}</Tag>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ) : null}
            </>
          ) : null}
          {loading ? (
            <div className="product-list__loading" role="status" aria-live="polite" aria-busy="true" aria-label={t('common.loading')}>
              <StatsStripSkeleton cols={3} />
              <div className="product-list__loadingGrid">
                <ProductCardSkeleton count={12} />
              </div>
            </div>
          ) : loadFailed ? (
            <div className="product-list__loadFailed">
              <PageError
                title={t('pages.productList.fetchFailed')}
                description={(
                  <div className="product-list__recovery">
                    <Text>{t('pages.productList.loadRecoveryText')}</Text>
                    <div className="product-list__recoveryTips">
                      <span>{t('pages.productList.loadRecoveryTipRefresh')}</span>
                      <span>{t('pages.productList.loadRecoveryTipFilters')}</span>
                      <span>{t('pages.productList.loadRecoveryTipSupport')}</span>
                    </div>
                  </div>
                )}
                retryLabel={refreshCatalogActionLabel}
                onRetry={() => fetchProducts(keyword, categoryId, discount, buildActiveFetchFilters(Math.max(0, currentPage - 1)))}
                homeLabel={allCategoriesRecoveryActionLabel}
                onHome={() => navigate('/products')}
              />
              <div className="product-list__recovery product-list__recovery--secondary">
                <div className="product-list__recoveryGrid">
                  <Button icon={<GiftOutlined />} aria-label={couponsRecoveryActionLabel} title={couponsRecoveryActionLabel} onClick={() => navigate('/coupons')}>
                    {t('pages.productList.loadRecoveryCoupons')}
                  </Button>
                  <Button icon={<CustomerServiceOutlined />} aria-label={supportRecoveryActionLabel} title={supportRecoveryActionLabel} onClick={openSupport}>
                    {t('pages.productList.loadRecoverySupport')}
                  </Button>
                </div>
                {renderDiscoveryActions()}
              </div>
            </div>
          ) : paginatedProducts.length === 0 ? (
            <PageEmpty
              className="product-list__empty"
              description={(
                <div className="product-list__emptyContent">
                  <div>{t('pages.productList.empty')}</div>
                  {renderDiscoveryActions()}
                </div>
              )}
              primaryAction={(keyword || categoryId || collection || activeFilterCount > 0) ? {
                key: 'reset',
                label: emptyResetFiltersActionLabel,
                onClick: resetFilters,
              } : {
                key: 'all',
                label: emptyAllCategoriesActionLabel,
                onClick: () => navigate('/products'),
              }}
              secondaryAction={(keyword || categoryId || collection || activeFilterCount > 0) ? {
                key: 'all',
                label: emptyAllCategoriesActionLabel,
                onClick: () => navigate('/products'),
              } : undefined}
            />
          ) : (
            <>
              <Row gutter={[16, 16]} className="product-list__grid">
                {paginatedProducts.map((product, index) => (
                  <ProductListCard
                    key={product.id}
                    product={product}
                    index={index}
                    currentPage={currentPage}
                    productName={productListProductName(product)}
                    wishlisted={wishlistedProductIds.has(product.id)}
                    stockAlerted={alertedStockProductIds.has(product.id)}
                    compared={isProductCompared(product.id)}
                    t={t}
                    formatMoney={formatMoney}
                    renderSavingsText={renderSavingsText}
                    onPrefetch={prefetchProduct}
                    onPreview={openProductPreview}
                    onQuickAdd={openQuickAdd}
                    onStockAlert={handleStockAlert}
                    onWishlistToggle={handleWishlistToggle}
                    onCompare={handleCompare}
                  />
                ))}
              </Row>
              {productCountForUi > pageSize && (
                <div className="product-list__pagination">
                  <Pagination
                    current={currentPage}
                    total={productCountForUi}
                    pageSize={pageSize}
                    onChange={handleProductPageChange}
                    showTotal={(total) => t('pages.productList.count', { count: total })}
                    itemRender={(_page, type, element) => {
                      if (type === 'prev') return labelPaginationControl(element, t('common.previousPage'));
                      if (type === 'next') return labelPaginationControl(element, t('common.nextPage'));
                      return element;
                    }}
                  />
                </div>
              )}
            </>
          )}
        </Col>
      </Row>
      <Drawer
        title={
          <Space>
            <FilterOutlined />
            <span>{t('pages.productList.filters')}</span>
            {activeRefinementCount > 0 ? <Tag color="blue">{t('pages.productList.activeFilters', { count: activeRefinementCount })}</Tag> : null}
          </Space>
        }
        open={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        placement="bottom"
        height="82vh"
        rootClassName="product-list__filterDrawerRoot"
        className="profile-mobile-safe-modal product-list__mobileDrawer"
        extra={
          <Button type="link" disabled={activeRefinementCount === 0} aria-label={resetRefinementsActionLabel} title={resetRefinementsActionLabel} onClick={resetMobileRefinements}>
            {t('pages.productList.resetFilters')}
          </Button>
        }
      >
        <div className="product-list__drawerContent">
          <section className="product-list__drawerSummary" aria-live="polite">
            <span>{t('pages.productList.count', { count: productCountForUi })}</span>
            <strong>
              {activeRefinementCount > 0
                ? t('pages.productList.activeFilters', { count: activeRefinementCount })
                : t('pages.productList.allCategories')}
            </strong>
          </section>
          <div className="product-list__drawerPanels">
            <Card title={t('pages.productList.drawerCategoryTitle')} size="small">
              {renderCategoryPanel()}
            </Card>
            <Card title={t('pages.productList.drawerFilterTitle')} size="small">
              {renderFilterPanel()}
            </Card>
          </div>
          <div className="product-list__drawerFooter">
            <Button size="large" disabled={activeRefinementCount === 0} aria-label={resetRefinementsActionLabel} title={resetRefinementsActionLabel} onClick={resetMobileRefinements}>
              {t('pages.productList.resetFilters')}
            </Button>
            <Button type="primary" size="large" aria-label={applyRefinementsActionLabel} title={applyRefinementsActionLabel} onClick={() => setFilterDrawerOpen(false)}>
              {t('pages.productList.applyFilters')}
            </Button>
          </div>
        </div>
      </Drawer>
      {showBackToTop ? (
        <Button
          type="primary"
          shape="circle"
          size="large"
          icon={<ArrowUpOutlined />}
          className="product-list__backToTop"
          aria-label={backToTopActionLabel}
          title={backToTopActionLabel}
          onClick={handleBackToTop}
        />
      ) : null}
      <Modal
        title={quickAddProduct ? t('pages.productList.quickAddTitle', { name: quickAddProductName }) : t('pages.productList.quickAdd')}
        open={!!quickAddProduct}
        onCancel={() => {
          if (quickAddSubmitting) return;
          setQuickAddProduct(null);
        }}
        onOk={submitQuickAdd}
        okText={t('pages.productList.addToCart')}
        cancelText={t('common.cancel')}
        okButtonProps={{ disabled: quickAddSubmitDisabled || quickAddSubmitting, loading: quickAddSubmitting, 'aria-label': quickAddSubmitActionLabel, title: quickAddSubmitActionLabel }}
        cancelButtonProps={{ disabled: quickAddSubmitting, 'aria-label': `${t('common.cancel')}: ${quickAddSubmitActionLabel}`, title: `${t('common.cancel')}: ${quickAddSubmitActionLabel}` }}
        rootClassName="product-list__quickAddModalRoot"
        className="profile-mobile-safe-modal product-list__quickAddModal"
      >
        <Space direction="vertical" className="product-list__quickAddContent">
          {quickAddBundleInfo ? (
            <>
              {quickAddOptionGroups.length > 0 ? renderQuickAddOptions() : null}
              <Text type="secondary">{t('bundle.includes')}</Text>
              <Space wrap size={[6, 6]}>
                {quickAddBundleInfo.items.map((item) => (
                  <Tag key={item.name} className="commerce-atomic">{item.name} <span className="commerce-quantity">x{item.quantity || 1}</span></Tag>
                ))}
              </Space>
                <Text>{t('pages.productList.quickAddPrice')}: <span className="commerce-money">{formatMoney(quickAddBundleInfo.price)}</span></Text>
            </>
          ) : quickAddOptionGroups.length > 0 ? (
            <>
              {renderQuickAddOptions()}
              {quickAddMissingOption ? (
                <Text type="secondary">{t('pages.productList.quickAddCompleteOptions', { option: getLocalizedOptionLabel(quickAddMissingOption.name, language) })}</Text>
              ) : quickAddInvalidSelection ? (
                <Text type="danger">{t('pages.productList.quickAddUnavailable')}</Text>
              ) : (
                <Text type="success">{t('pages.productList.quickAddSelectionReady')}</Text>
              )}
              <Text>
                {t('pages.productList.quickAddPrice')}: <span className="commerce-money">{formatMoney(quickAddPrice)}</span>
              </Text>
              {quickAddVariant?.stock !== undefined && (
                <Text type="secondary">{t('pages.productDetail.stock')}: {quickAddVariant.stock}</Text>
              )}
            </>
          ) : (
            <Text type="secondary">{t('pages.productList.quickAddNoOptions')}</Text>
          )}
        </Space>
      </Modal>
      <Modal
        title={null}
        open={!!previewProduct}
        footer={null}
        onCancel={() => setPreviewProduct(null)}
        width={860}
        rootClassName="product-list__previewModalRoot"
        className="profile-mobile-safe-modal product-list__previewModal"
        destroyOnHidden
      >
        {previewProduct ? (
          <div className="product-list__preview">
            <div className="product-list__previewMedia">
              <img
                alt={previewProductName}
                src={getOptimizedImageUrl(resolveProductPrimaryImage(previewProduct), 720)}
                srcSet={buildResponsiveImageSrcSet(resolveProductPrimaryImage(previewProduct), [360, 520, 720, 960])}
                sizes="(max-width: 720px) 100vw, 420px"
                onError={(event) => {
                  if (event.currentTarget.src !== productImageFallback) {
                    event.currentTarget.removeAttribute('srcset');
                    event.currentTarget.src = productImageFallback;
                  }
                }}
              />
              {getDiscountPercent(previewProduct) > 0 ? (
                <span className="product-list__previewDiscount">
                  -{getDiscountPercent(previewProduct)}%
                </span>
              ) : null}
            </div>
            <div className="product-list__previewBody">
              <Space wrap size={[6, 6]} className="product-list__previewBadges">
                {renderBadges(previewProduct).slice(0, 4).map((badge) => (
                  <Tag key={badge.label} color={badge.color}>{badge.label}</Tag>
                ))}
              </Space>
              <Text type="secondary" className="product-list__previewBrand">
                {previewProduct.brand || topCategoryName}
              </Text>
              <h2>{previewProductName}</h2>
              <div className="product-list__previewRating" aria-label={previewRatingLabel} title={previewRatingLabel}>
                <Rate disabled allowHalf value={previewRatingValue} />
                <Text type="secondary">{previewRatingSummary}</Text>
              </div>
              <Text className="product-list__previewDescription">
                {previewProduct.description || t('pages.productList.previewNoDescription')}
              </Text>
              <div className="product-list__previewPrice">
                <strong className="commerce-money">{formatMoney(getPrice(previewProduct))}</strong>
                {previewProduct.originalPrice && previewProduct.originalPrice > getPrice(previewProduct) ? (
                  <Text delete className="commerce-money">{formatMoney(previewProduct.originalPrice)}</Text>
                ) : null}
              </div>
              <div className="product-list__previewSignals">
                <span>
                  {isProductSoldOut(previewProduct)
                    ? t('pages.productList.previewSoldOut')
                    : previewProduct.stock !== undefined
                      ? t('pages.productList.previewStockReady', { count: previewProduct.stock })
                      : t('pages.productList.cardStockReady')}
                </span>
                <span>
                  {hasReviewSignal(previewProduct)
                    ? t('pages.productList.positiveRate', {
                        rate: Math.round(previewProduct.positiveRate || 0).toString(),
                        count: previewProduct.reviewCount || 0,
                      })
                    : t('pages.productList.noReviewsYet')}
                </span>
                {getSavingsAmount(previewProduct) > 0 ? (
                  <span>{renderSavingsText(getSavingsAmount(previewProduct))}</span>
                ) : null}
              </div>
              <div className="product-list__previewActions">
                {isProductSoldOut(previewProduct) ? (
                  <Button
                    icon={<BellOutlined />}
                    aria-pressed={previewProductStockAlerted}
                    aria-label={previewStockAlertActionLabel}
                    title={previewStockAlertActionLabel}
                    onClick={(event) => handleStockAlert(event, previewProduct, previewProductStockAlerted)}
                  >
                    {previewProductStockAlerted ? t('pages.stockAlerts.remove') : t('pages.stockAlerts.notifyMe')}
                  </Button>
                ) : (
                  <Button
                    type="primary"
                    icon={<ShoppingCartOutlined />}
                    aria-label={previewPrimaryActionLabel}
                    title={previewPrimaryActionLabel}
                    onClick={(event) => {
                      openQuickAdd(event, previewProduct);
                      setPreviewProduct(null);
                    }}
                  >
                    {previewPrimaryLabel}
                  </Button>
                )}
                <Button aria-label={previewViewActionLabel} title={previewViewActionLabel} onClick={() => openProductDetail(previewProduct.id)}>
                  {t('pages.productList.viewDetails')}
                </Button>
                <Button
                  icon={previewProductWishlisted ? <HeartFilled /> : <HeartOutlined />}
                  aria-pressed={previewProductWishlisted}
                  aria-label={previewWishlistActionLabel}
                  title={previewWishlistActionLabel}
                  onClick={(event) => handleWishlistToggle(event, previewProduct)}
                >
                  {previewProductWishlisted ? t('pages.productDetail.favorited') : t('pages.productDetail.favorite')}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

export default ProductList;
