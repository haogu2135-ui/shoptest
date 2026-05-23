import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, Row, Col, Button, Input, Select, Pagination, Tag, message, Empty, Typography, Slider, Checkbox, Modal, Space, Drawer } from 'antd';
import { BarChartOutlined, BellOutlined, CheckCircleOutlined, CustomerServiceOutlined, FireOutlined, FilterOutlined, GiftOutlined, HeartFilled, HeartOutlined, ReloadOutlined, SearchOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { productApi, cartApi, categoryApi, wishlistApi } from '../api';
import type { Product, Category } from '../types';
import { flattenCategoryTree, getDisplayCategoryRoots, getLocalizedCategoryValue } from '../utils/categoryTree';
import { useLanguage } from '../i18n';
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
import { loadProductCatalogSnapshot, saveProductCatalogSnapshot } from '../utils/productCatalogSnapshot';
import { getLocalStorageItem, hasStoredValue, setLocalStorageItem } from '../utils/safeStorage';
import { openCartDrawerWithSnapshot } from '../utils/cartDrawer';
import './ProductList.css';

const { Text } = Typography;
const SEARCH_HISTORY_KEY = 'shop-product-search-history';
const MAX_SEARCH_HISTORY = 6;
const MAX_SEARCH_LENGTH = 80;
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
const VALID_COLLECTIONS = new Set(['smart-devices']);
const resolveProductListImage = resolveProductImage;
const productListImageSizes = '(max-width: 575px) 50vw, (max-width: 991px) 33vw, 25vw';
const eagerImagePriorityProps = { fetchPriority: 'high' } as unknown as React.ImgHTMLAttributes<HTMLImageElement>;
const lazyImagePriorityProps = { fetchPriority: 'auto' } as unknown as React.ImgHTMLAttributes<HTMLImageElement>;

const readSearchHistory = () => {
  try {
    const parsed = JSON.parse(getLocalStorageItem(SEARCH_HISTORY_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean).slice(0, MAX_SEARCH_HISTORY) : [];
  } catch {
    return [];
  }
};

const writeSearchHistory = (history: string[]) => {
  setLocalStorageItem(SEARCH_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_SEARCH_HISTORY)));
};

const normalizeSearchValue = (value: string) => value.replace(/\s+/g, ' ').trim().slice(0, MAX_SEARCH_LENGTH);
const normalizeSortValue = (value: string | null | undefined) =>
  value && VALID_SORT_VALUES.has(value) ? value : 'default';
const normalizePetSizeValue = (value: string | null | undefined) =>
  value && VALID_PET_SIZES.has(value) ? value : '';
const normalizePetSizeValues = (values: Array<string | null | undefined>) =>
  Array.from(new Set(values.map(normalizePetSizeValue).filter(Boolean)));
const normalizeCollectionValue = (value: string | null | undefined) =>
  value && VALID_COLLECTIONS.has(value) ? value : '';
const parsePositiveId = (value: string | null) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

const productSearchText = (product: Product) => [
  product.name,
  product.description,
  product.brand,
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

const filterSnapshotProducts = (products: Product[], keyword?: string, categoryId?: number, discount?: boolean) => {
  const normalizedKeyword = normalizeSearchValue(keyword || '').toLowerCase();
  return products.filter((product) => {
    if (normalizedKeyword && !productSearchText(product).includes(normalizedKeyword)) return false;
    if (categoryId && Number(product.categoryId) !== categoryId) return false;
    if (discount && !matchesDiscountFilter(product)) return false;
    return true;
  });
};

let categoryCache: { expiresAt: number; items: Category[] } | null = null;
let categoryCacheRequest: Promise<Category[]> | null = null;

type ProductListUrlOverrides = Partial<{
  collection: string;
  keyword: string;
  categoryId?: number;
  discount: boolean;
  sortBy: string;
  petSizes: string[];
}>;

const ProductList: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [usingCatalogSnapshot, setUsingCatalogSnapshot] = useState(false);
  const [keyword, setKeyword] = useState(normalizeSearchValue(searchParams.get('keyword') || ''));
  const [categoryId, setCategoryId] = useState<number | undefined>(parsePositiveId(searchParams.get('categoryId')));
  const [discount, setDiscount] = useState(searchParams.get('discount') === 'true');
  const [sortBy, setSortBy] = useState<string>(normalizeSortValue(searchParams.get('sort')));
  const [priceRange, setPriceRange] = useState<[number, number]>(DEFAULT_PRICE_RANGE);
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
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [wishlistedProductIds, setWishlistedProductIds] = useState<Set<number>>(new Set());
  const [alertedStockProductIds, setAlertedStockProductIds] = useState<Set<number>>(
    () => new Set(readStockAlerts().map((alert) => alert.productId)),
  );
  const priceRangeMaxRef = useRef(DEFAULT_PRICE_RANGE[1]);
  const productRequestSeqRef = useRef(0);
  const { t, language } = useLanguage();
  const { formatMoney } = useMarket();
  const collection = normalizeCollectionValue(searchParams.get('collection'));
  const pageSize = 12;
  const isAuthenticated = hasStoredValue('token');
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
    { label: t('pages.productList.colorBlack'), value: 'Black' },
    { label: t('pages.productList.colorBlue'), value: 'Blue' },
    { label: t('pages.productList.colorGreen'), value: 'Green' },
    { label: t('pages.productList.colorPink'), value: 'Pink' },
  ], [t]);
  useEffect(() => {
    if (categoryCache && categoryCache.expiresAt > Date.now()) {
      setCategories(categoryCache.items);
      return;
    }
    let active = true;
    if (!categoryCacheRequest) {
      categoryCacheRequest = categoryApi.getAll()
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
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setWishlistedProductIds(new Set());
      return;
    }
    wishlistApi.getByUser(0)
      .then((res) => setWishlistedProductIds(new Set(res.data.map((item) => item.productId))))
      .catch(() => setWishlistedProductIds(new Set()));
  }, [isAuthenticated]);

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
    if (!hasStoredValue('token')) {
      setPersonalizedProducts([]);
      return;
    }
    productApi.getPersonalizedRecommendations()
      .then((response) => setPersonalizedProducts(response.data.map((product) => localizeProduct(product, language))))
      .catch(() => setPersonalizedProducts([]));
  }, [language]);

  const collectionProducts = useMemo(() => {
    let result = products;
    if (collection === 'smart-devices') {
      result = result.filter(matchesSmartDeviceCollection);
    }
    if (collection && keyword.trim()) {
      const normalizedKeyword = keyword.trim().toLowerCase();
      result = result.filter((product) => productSearchText(product).includes(normalizedKeyword));
    }
    return result;
  }, [collection, keyword, products]);

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

  const priceFilterActive = displayedPriceRange[0] > 0 || displayedPriceRange[1] < maxCatalogPrice;
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
    const params = new URLSearchParams();
    if (nextCollection) params.set('collection', nextCollection);
    if (nextKeyword) params.set('keyword', nextKeyword);
    if (nextCategoryId) params.set('categoryId', nextCategoryId.toString());
    if (nextDiscount) params.set('discount', 'true');
    if (nextSort !== 'default') params.set('sort', nextSort);
    nextPetSizes.forEach((size) => params.append('petSize', size));
    return `/products${params.toString() ? '?' + params.toString() : ''}`;
  }, [categoryId, collection, discount, keyword, petSizes, sortBy]);
  const updatePetSizes = useCallback((nextSizes: string[]) => {
    const normalizedSizes = normalizePetSizeValues(nextSizes);
    setPetSizes(normalizedSizes);
    setCurrentPage(1);
    navigate(buildProductsUrl({ petSizes: normalizedSizes }));
  }, [buildProductsUrl, navigate]);

  useEffect(() => {
    setPriceRange((currentRange) => {
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
  }, [maxCatalogPrice]);

  const visibleCategories = useMemo(() => {
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
  }, [categories, categoryId, collection, collectionProducts, keyword]);
  const categoryTree = useMemo(() => getDisplayCategoryRoots(visibleCategories), [visibleCategories]);
  const categoryRows = useMemo(() => flattenCategoryTree(categoryTree), [categoryTree]);
  const categoryDepthById = useMemo(() => {
    const depths = new Map<number, number>();
    const visit = (nodes: Category[], depth: number) => {
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
        label: getLocalizedCategoryValue(selectedCategory, language, 'name'),
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
          setCurrentPage(1);
        },
      });
    }
    const optionLabels = new Map([...petSizeOptions, ...materialOptions, ...colorOptions].map((option) => [option.value, option.label]));
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
        setMaterials((current) => current.filter((item) => item !== value));
        setCurrentPage(1);
      },
    }));
    colors.forEach((value) => tags.push({
      key: `color-${value}`,
      label: `${t('pages.productList.filterColor')}: ${optionLabels.get(value) || value}`,
      onClose: () => {
        setColors((current) => current.filter((item) => item !== value));
        setCurrentPage(1);
      },
    }));
    return tags;
  }, [
    colorOptions,
    colors,
    buildProductsUrl,
    displayedPriceRange,
    formatMoney,
    language,
    materialOptions,
    materials,
    maxCatalogPrice,
    navigate,
    petSizeOptions,
    petSizes,
    priceFilterActive,
    selectedCategory,
    t,
    updatePetSizes,
  ]);
  const applySort = (nextSort: string) => {
    const normalizedSort = normalizeSortValue(nextSort);
    setSortBy(normalizedSort);
    setCurrentPage(1);
    navigate(buildProductsUrl({ sortBy: normalizedSort }));
  };
  const resultContextTags = [
    collection ? { key: 'collection', color: 'geekblue', label: collection.replace(/-/g, ' ') } : null,
    keyword.trim() ? { key: 'keyword', color: 'purple', label: keyword.trim() } : null,
    selectedCategory ? { key: 'category', color: 'green', label: getLocalizedCategoryValue(selectedCategory, language, 'name') } : null,
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
    imageUrl: quickAddVariant?.imageUrl || quickAddProduct.imageUrl,
  }) : null;

  const fetchProducts = useCallback(async (kw?: string, cid?: number, disc?: boolean) => {
    const requestSeq = productRequestSeqRef.current + 1;
    productRequestSeqRef.current = requestSeq;
    try {
      setLoading(true);
      const res = await productApi.getAll(kw || undefined, cid, disc);
      if (productRequestSeqRef.current !== requestSeq) return;
      saveProductCatalogSnapshot(res.data);
      setProducts(res.data.map((product) => localizeProduct(product, language)));
      setLoadFailed(false);
      setUsingCatalogSnapshot(false);
      setCurrentPage(1);
    } catch {
      if (productRequestSeqRef.current !== requestSeq) return;
      const snapshot = loadProductCatalogSnapshot();
      if (snapshot) {
        setProducts(filterSnapshotProducts(snapshot.products, kw, cid, disc).map((product) => localizeProduct(product, language)));
        setLoadFailed(false);
        setUsingCatalogSnapshot(true);
        setCurrentPage(1);
        message.warning(t('pages.productList.snapshotNotice'));
        return;
      }
      setProducts([]);
      setLoadFailed(true);
      setUsingCatalogSnapshot(false);
      message.error(t('pages.productList.fetchFailed'));
    } finally {
      if (productRequestSeqRef.current === requestSeq) {
        setLoading(false);
      }
    }
  }, [language, t]);

  useEffect(() => {
    const kw = normalizeSearchValue(searchParams.get('keyword') || '');
    const cid = parsePositiveId(searchParams.get('categoryId'));
    const disc = searchParams.get('discount') === 'true';
    const activeCollection = normalizeCollectionValue(searchParams.get('collection'));
    const requestedSort = normalizeSortValue(searchParams.get('sort'));
    const requestedPetSizes = normalizePetSizeValues(searchParams.getAll('petSize').length ? searchParams.getAll('petSize') : [searchParams.get('petSize')]);
    setKeyword(kw);
    setCategoryId(cid);
    setDiscount(disc);
    setSortBy(requestedSort);
    setPetSizes(requestedPetSizes);
    fetchProducts(activeCollection ? undefined : kw, cid, disc);
  }, [fetchProducts, searchParams, language]);

  const handleSearch = (value: string) => {
    const trimmed = normalizeSearchValue(value);
    if (trimmed) {
      const nextHistory = [trimmed, ...searchHistory.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_SEARCH_HISTORY);
      setSearchHistory(nextHistory);
      writeSearchHistory(nextHistory);
    }
    navigate(buildProductsUrl({ keyword: trimmed }));
  };

  const clearSearchHistory = () => {
    setSearchHistory([]);
    writeSearchHistory([]);
  };

  const handleCompare = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    const result = addCompareProduct(product);
    if (result.status === 'full') {
      message.warning(t('pages.productList.compareFull', { count: MAX_COMPARE_ITEMS }));
      return;
    }
    message.success(result.status === 'exists' ? t('pages.productList.compareExists') : t('pages.productList.compareAdded'));
    navigate('/compare');
  };

  const handleWishlistToggle = async (e: React.MouseEvent, product: Product) => {
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
    } catch {
      message.error(t('messages.operationFailed'));
    }
  };

  const openProductDetail = (productId: number) => {
    navigate(`/products/${productId}`);
  };

  const resetFilters = () => {
    setPriceRange([0, maxCatalogPrice]);
    setPetSizes([]);
    setMaterials([]);
    setColors([]);
    setCurrentPage(1);
  };

  const handleCategoryChange = (cid: number | undefined) => {
    setCategoryId(cid);
    navigate(buildProductsUrl({ categoryId: cid }));
    setFilterDrawerOpen(false);
  };

  const openQuickAdd = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    setQuickAddSubmitting(false);
    setQuickAddProduct(product);
    setQuickAddOptions({});
  };

  const selectQuickAddOption = (groupName: string, value: string) => {
    setQuickAddOptions((current) =>
      selectCompatibleProductOption(quickAddOptionGroups, quickAddVariants, current, groupName, value),
    );
  };

  const renderQuickAddOptions = () => (
    <>
      <Text type="secondary">{t('pages.productList.quickAddHint')}</Text>
      {quickAddOptionGroups.map((group) => (
        <Select
          key={group.name}
          placeholder={getLocalizedOptionLabel(group.name, language)}
          value={quickAddOptions[group.name] || undefined}
          onChange={(value) => selectQuickAddOption(group.name, value)}
          options={group.values.map((value) => ({
            value,
            label: getLocalizedOptionLabel(value, language),
            disabled: !optionValueIsCompatible(quickAddVariants, quickAddOptions, group.name, value),
          }))}
          style={{ width: '100%' }}
        />
      ))}
      {Object.keys(quickAddOptions).length > 0 && (
        <Button type="link" onClick={() => setQuickAddOptions({})} style={{ padding: 0, alignSelf: 'flex-start' }}>
          {t('common.reset')}
        </Button>
      )}
    </>
  );

  const handleStockAlert = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    if (alertedStockProductIds.has(product.id)) {
      removeStockAlert(product.id);
      message.success(t('pages.stockAlerts.removed'));
      return;
    }
    const result = addStockAlert(product);
    message.success(result.status === 'exists' ? t('pages.stockAlerts.exists') : t('pages.stockAlerts.added'));
  };

  const prefetchProduct = useCallback((productId: number) => {
    void productApi.prefetchById(productId);
  }, []);

  const openProductPreview = (event: React.MouseEvent, product: Product) => {
    event.stopPropagation();
    setPreviewProduct(product);
    prefetchProduct(product.id);
  };

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
      } catch {
        message.error(t('messages.addFailed'));
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
    } catch {
      message.error(t('messages.addFailed'));
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

  const sortedProducts = [...filteredProducts].sort((a, b) => {
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
  const topCategoryName = selectedCategory
    ? getLocalizedCategoryValue(selectedCategory, language, 'name')
    : categoryRows[0]
      ? getLocalizedCategoryValue(categoryRows[0], language, 'name')
      : t('pages.productList.allCategories');
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
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(sortedProducts.length / pageSize));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, sortedProducts.length]);

  const paginatedProducts = sortedProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const renderBadges = (product: Product) => {
    const badges: Array<{ label: string; color: string }> = [];
    if (isBestValueProduct(product)) badges.push({ label: t('pages.productList.bestValue'), color: 'green' });
    if (getDiscountPercent(product) > 0) badges.push({ label: t('pages.productList.sale'), color: 'volcano' });
    if (product.tag === 'new') badges.push({ label: t('pages.productList.new'), color: 'blue' });
    if (product.isFeatured) badges.push({ label: t('pages.productList.bestSeller'), color: 'gold' });
    if (getLowStockCount(product.stock) !== null && (product.stock || 0) > 0) badges.push({ label: t('pages.productList.runningLow'), color: 'red' });
    return badges;
  };

  const renderPrimaryAction = (product: Product) => {
    const soldOut = product.stock !== undefined && product.stock <= 0;
    if (soldOut) {
      const alerted = alertedStockProductIds.has(product.id);
      return (
        <Button
          key="stock-alert"
          icon={<BellOutlined />}
          size="small"
          className="product-list__actionButton product-list__alertButton"
          onClick={(e) => handleStockAlert(e, product)}
        >
          <span className="product-list__actionLabel">
            {alerted ? t('pages.stockAlerts.remove') : t('pages.stockAlerts.notifyMe')}
          </span>
        </Button>
      );
    }
    return (
      <Button
        key="quick-add"
        type="primary"
        icon={<ShoppingCartOutlined />}
        size="small"
        className="product-list__actionButton"
        onClick={(e) => openQuickAdd(e, product)}
      >
        <span className="product-list__actionLabel">
          {isQuickAddReady(product) ? t('pages.productList.quickAdd') : t('pages.productList.chooseOptionsAction')}
        </span>
      </Button>
    );
  };
  const renderConfidenceStrip = (product: Product) => {
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

  const renderCategoryPanel = () => (
    <div className="product-list__categoryStack">
      <Button type={!categoryId ? 'primary' : 'text'} block onClick={() => handleCategoryChange(undefined)} className="product-list__categoryButton">
        {t('pages.productList.allCategories')}
      </Button>
      {categoryRows.map(cat => (
        <Button
          key={cat.id}
          type={categoryId === cat.id ? 'primary' : 'text'}
          block
          onClick={() => handleCategoryChange(cat.id)}
          className="product-list__categoryButton"
          style={{ paddingLeft: 12 + ((categoryDepthById.get(cat.id) || 1) - 1) * 14 }}
        >
          {getLocalizedCategoryValue(cat, language, 'name')}
        </Button>
      ))}
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
          onChange={(value) => {
            setPriceRange(value as [number, number]);
            setCurrentPage(1);
          }}
        />
        <Text type="secondary">{formatMoney(displayedPriceRange[0])} - {formatMoney(displayedPriceRange[1])}</Text>
      </div>
      <div>
        <Text strong className="product-list__filterLabel">{t('pages.productList.filterSize')}</Text>
        <Checkbox.Group
          value={petSizes}
          onChange={(value) => updatePetSizes(value.map(String))}
          options={petSizeOptions}
        />
      </div>
      <div>
        <Text strong className="product-list__filterLabel">{t('pages.productList.filterMaterial')}</Text>
        <Checkbox.Group
          value={materials}
          onChange={(value) => {
            setMaterials(value.map(String));
            setCurrentPage(1);
          }}
          options={materialOptions}
        />
      </div>
      <div>
        <Text strong className="product-list__filterLabel">{t('pages.productList.filterColor')}</Text>
        <Checkbox.Group
          value={colors}
          onChange={(value) => {
            setColors(value.map(String));
            setCurrentPage(1);
          }}
          options={colorOptions}
        />
      </div>
    </Space>
  );
  const emptyDiscoveryActions = [
    {
      key: 'catalog',
      icon: <FilterOutlined />,
      title: activeFilterCount > 0 ? t('pages.productList.resetFilters') : t('pages.productList.allCategories'),
      text: t('pages.productList.loadRecoveryTipFilters'),
      primary: true,
      onClick: () => {
        if (activeFilterCount > 0) {
          resetFilters();
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
      onClick: () => navigate('/products?discount=true'),
    },
    {
      key: 'coupons',
      icon: <GiftOutlined />,
      title: t('pages.productList.loadRecoveryCoupons'),
      text: t('pages.productList.loadRecoveryText'),
      onClick: () => navigate('/coupons'),
    },
    {
      key: 'support',
      icon: <CustomerServiceOutlined />,
      title: t('pages.productList.loadRecoverySupport'),
      text: t('pages.productList.loadRecoveryTipSupport'),
      onClick: () => dispatchDomEvent('shop:open-support'),
    },
  ];
  const renderDiscoveryActions = () => (
    <div className="product-list__emptyDiscovery" aria-label={t('pages.productList.guideTitle')}>
      {emptyDiscoveryActions.map((action) => (
        <button
          key={action.key}
          type="button"
          className={`product-list__emptyDiscoveryCard${action.primary ? ' product-list__emptyDiscoveryCard--primary' : ''}`}
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
    <div className={`product-list product-list--${language}`}>
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
              <h1>{keyword.trim() || t('pages.productList.catalogTitle')}</h1>
              <Text>
                {collection
                  ? `${t('pages.productList.resultContextLabel')}: ${collection.replace(/-/g, ' ')}`
                  : resultContextTags.length > 0
                    ? resultContextTags.map((tag) => tag.label).join(' / ')
                    : t('pages.productList.searchPlaceholder')}
              </Text>
              <div className="product-list__heroStats">
                <span>{t('pages.productList.count', { count: filteredProducts.length })}</span>
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
              >
                <strong>{heroProduct.name}</strong>
                <Text>{formatMoney(getPrice(heroProduct))}</Text>
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
                  value={keyword}
                  maxLength={MAX_SEARCH_LENGTH}
                  onChange={e => setKeyword(e.target.value.slice(0, MAX_SEARCH_LENGTH))}
                  onSearch={handleSearch}
                  className="product-list__search"
                />
              </Col>
              <Col xs={12} sm={5} md={6}>
                <Select value={sortBy} onChange={applySort} className="product-list__sortSelect" options={sortOptions} />
              </Col>
              <Col xs={12} sm={7} md={4}>
                <div className="product-list__toolbarMeta">
                  <Text type="secondary">{t('pages.productList.count', { count: filteredProducts.length })}</Text>
                  <Button className="product-list__filterButton" icon={<FilterOutlined />} onClick={() => setFilterDrawerOpen(true)}>
                    <span>{t('pages.productList.filters')}</span>
                    {activeRefinementCount > 0 ? (
                      <span className="product-list__filterCount">{activeRefinementCount > 99 ? '99+' : activeRefinementCount}</span>
                    ) : null}
                  </Button>
                </div>
              </Col>
            </Row>
            {activeRefinementTags.length > 0 ? (
              <div className="product-list__refinementChips">
                {activeRefinementTags.map((tag) => (
                  <Tag
                    key={tag.key}
                    closable
                    onClose={(event) => {
                      event.preventDefault();
                      tag.onClose();
                    }}
                  >
                    {tag.label}
                  </Tag>
                ))}
                <Button type="link" size="small" onClick={resetFilters}>
                  {t('pages.productList.resetFilters')}
                </Button>
              </div>
            ) : null}
            {searchHistory.length > 0 && (
              <Space wrap size={[8, 8]} className="product-list__recentSearches">
                <Text type="secondary">{t('pages.productList.recentSearches')}</Text>
                {searchHistory.map((term) => (
                  <Tag key={term} style={{ cursor: 'pointer' }} onClick={() => handleSearch(term)}>
                    {term}
                  </Tag>
                ))}
                <Button type="link" size="small" onClick={clearSearchHistory}>
                  {t('pages.productList.clearSearches')}
                </Button>
              </Space>
            )}
          </Card>
          {!loading && !loadFailed ? (
            <section className="product-list__mobileConversionBar" aria-label={t('pages.productList.insightTitle')}>
              <div className="product-list__mobileConversionStats">
                <span className="product-list__mobileConversionEyebrow">{t('pages.productList.viewPick')}</span>
                <strong>{heroProduct?.name || t('pages.productList.count', { count: filteredProducts.length })}</strong>
                <span>{mobileHeroSignal}</span>
              </div>
              <div className="product-list__mobileConversionActions">
                <Button icon={<FilterOutlined />} onClick={() => setFilterDrawerOpen(true)}>
                  {t('pages.productList.filters')}
                </Button>
                <Button onClick={() => applySort('discount-desc')}>
                  {t('pages.productList.shopBestDeals')}
                </Button>
                <Button
                  type="primary"
                  icon={<ShoppingCartOutlined />}
                  disabled={!heroProduct}
                  onClick={(event) => {
                    if (!heroProduct) return;
                    if (isQuickAddReady(heroProduct)) {
                      openQuickAdd(event, heroProduct);
                      return;
                    }
                    openProductDetail(heroProduct.id);
                  }}
                >
                  {heroProduct && !isQuickAddReady(heroProduct)
                    ? t('pages.productList.chooseOptionsAction')
                    : t('pages.productList.addToCart')}
                </Button>
              </div>
            </section>
          ) : null}
          {!loading && !loadFailed ? (
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
                    onClick={() => fetchProducts(collection ? undefined : keyword, categoryId, discount)}
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
                      onClick={() => openProductDetail(heroProduct.id)}
                    >
                      <span>{t('pages.productList.viewPick')}</span>
                      <strong>{heroProduct.name}</strong>
                    </Button>
                  ) : null}
                  <Button className="product-list__smartAction" onClick={() => applySort('discount-desc')}>
                    {t('pages.productList.shopBestDeals')}
                  </Button>
                  <Button className="product-list__smartPersonal" onClick={() => applySort('quick-add-desc')}>
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
                  <span>{t('pages.productList.averageSavings', { amount: formatMoney(productListInsights.averageSavings) })}</span>
                  <span>{t('pages.productList.lowStockCount', { count: productListInsights.lowStockCount })}</span>
                  {activeFilterCount > 0 ? (
                    <Button type="link" onClick={resetFilters}>{t('pages.productList.resetFilters')}</Button>
                  ) : (
                    <Button type="link" onClick={() => applySort('positive-rate-desc')}>{t('pages.productList.shopTopRated')}</Button>
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
                          aria-label={`${t('pages.productList.viewPick')}: ${product.name}`}
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
                            <strong>{product.name}</strong>
                            <small>
                              {formatMoney(getPrice(product))}
                              {savings > 0 ? ` - ${t('pages.productList.bestValueSavings', { amount: formatMoney(savings) })}` : ''}
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
            <div className="product-list__loading">
              <StatsStripSkeleton cols={3} />
              <div className="product-list__loadingGrid">
                <ProductCardSkeleton count={12} />
              </div>
            </div>
          ) : loadFailed ? (
            <div className="product-list__loadFailed" role="alert">
              <Empty description={t('pages.productList.fetchFailed')}>
                <div className="product-list__recovery">
                  <Text>{t('pages.productList.loadRecoveryText')}</Text>
                  <div className="product-list__recoveryGrid">
                    <Button
                      type="primary"
                      icon={<ReloadOutlined />}
                      onClick={() => fetchProducts(collection ? undefined : keyword, categoryId, discount)}
                    >
                      {t('common.refresh')}
                    </Button>
                    <Button icon={<FilterOutlined />} onClick={() => navigate('/products')}>
                      {t('pages.productList.allCategories')}
                    </Button>
                    <Button icon={<GiftOutlined />} onClick={() => navigate('/coupons')}>
                      {t('pages.productList.loadRecoveryCoupons')}
                    </Button>
                    <Button icon={<CustomerServiceOutlined />} onClick={() => dispatchDomEvent('shop:open-support')}>
                      {t('pages.productList.loadRecoverySupport')}
                    </Button>
                  </div>
                  <div className="product-list__recoveryTips">
                    <span>{t('pages.productList.loadRecoveryTipRefresh')}</span>
                    <span>{t('pages.productList.loadRecoveryTipFilters')}</span>
                    <span>{t('pages.productList.loadRecoveryTipSupport')}</span>
                  </div>
                  {renderDiscoveryActions()}
                </div>
              </Empty>
            </div>
          ) : paginatedProducts.length === 0 ? (
            <Empty description={t('pages.productList.empty')} className="product-list__empty">
              <div className="product-list__emptyContent">
                {renderDiscoveryActions()}
                {(keyword || categoryId || collection || activeFilterCount > 0) ? (
                  <Space wrap className="product-list__emptyActions">
                    <Button type="link" onClick={() => navigate('/products')}>
                      {t('pages.productList.allCategories')}
                    </Button>
                    <Button type="link" onClick={resetFilters}>
                      {t('pages.productList.resetFilters')}
                    </Button>
                  </Space>
                ) : null}
              </div>
            </Empty>
          ) : (
            <>
              <Row gutter={[16, 16]}>
                {paginatedProducts.map((product, index) => {
                  const imageUrl = resolveProductListImage(product.imageUrl);
                  const priorityImage = currentPage === 1 && index < 4;
                  return (
                  <Col key={product.id} xs={12} sm={12} md={8} lg={6}>
                    <Card
                      className="product-list__card"
                      hoverable
                      role="button"
                      tabIndex={0}
                      onMouseEnter={() => prefetchProduct(product.id)}
                      onFocus={() => prefetchProduct(product.id)}
                      onClick={() => openProductDetail(product.id)}
                      onKeyDown={(event) => {
                        if (event.target !== event.currentTarget) return;
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          openProductDetail(product.id);
                        }
                      }}
                      cover={
                        <div className="product-list__imageWrap">
                          <img
                            alt={product.name}
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
                          <div className="product-list__badges" aria-label={t('pages.productList.productBadges')}>
                            {renderBadges(product).slice(0, 3).map((badge) => <Tag key={badge.label} color={badge.color}>{badge.label}</Tag>)}
                          </div>
                          {product.stock !== undefined && product.stock <= 0 && (
                            <div className="product-list__soldOut">
                              {t('pages.productList.soldOut')}
                            </div>
                          )}
                          <div className="product-list__imageOverlay">
                            <Button
                              size="small"
                              icon={<SearchOutlined />}
                              className="product-list__previewTrigger"
                              onClick={(event) => openProductPreview(event, product)}
                            >
                              {t('pages.productList.quickPreview')}
                            </Button>
                          </div>
                        </div>
                      }
                      actions={[
                        renderPrimaryAction(product),
                        <Button
                          key="wishlist"
                          icon={wishlistedProductIds.has(product.id) ? <HeartFilled /> : <HeartOutlined />}
                          size="small"
                          className={wishlistedProductIds.has(product.id)
                            ? 'product-list__actionButton product-list__actionButton--compact product-list__favoriteButton product-list__favoriteButton--active'
                            : 'product-list__actionButton product-list__actionButton--compact product-list__favoriteButton'}
                          aria-label={wishlistedProductIds.has(product.id) ? t('pages.productDetail.favorited') : t('pages.productDetail.favorite')}
                          title={wishlistedProductIds.has(product.id) ? t('pages.productDetail.favorited') : t('pages.productDetail.favorite')}
                          onClick={(e) => handleWishlistToggle(e, product)}
                        >
                          <span className="product-list__actionLabel">
                            {wishlistedProductIds.has(product.id) ? t('pages.productDetail.favorited') : t('pages.productDetail.favorite')}
                          </span>
                        </Button>,
                        <Button
                          key="compare"
                          icon={<BarChartOutlined />}
                          size="small"
                          className="product-list__actionButton product-list__actionButton--compact"
                          aria-label={isProductCompared(product.id) ? t('pages.productList.viewCompare') : t('pages.productList.compare')}
                          title={isProductCompared(product.id) ? t('pages.productList.viewCompare') : t('pages.productList.compare')}
                          onClick={(e) => handleCompare(e, product)}
                        >
                          <span className="product-list__actionLabel">
                            {isProductCompared(product.id) ? t('pages.productList.viewCompare') : t('pages.productList.compare')}
                          </span>
                        </Button>,
                      ]}
                    >
                      <Card.Meta
                        title={<Text ellipsis={{ tooltip: product.name }}>{product.name}</Text>}
                        description={
                          <div>
                            <div className="product-list__priceLine">
                              {formatMoney(getPrice(product))}
                              {product.originalPrice && product.originalPrice > getPrice(product) && (
                                <Text delete type="secondary" className="product-list__originalPrice">{formatMoney(product.originalPrice)}</Text>
                              )}
                              {product.activeLimitedTimeDiscount && <Tag color="red" className="product-list__priceTag">{t('pages.productList.limitedTime')}</Tag>}
                            </div>
                            {isBestValueProduct(product) && getSavingsAmount(product) > 0 ? (
                              <div className="product-list__valueLine">
                                <Text type="success">
                                  {t('pages.productList.bestValueSavings', { amount: formatMoney(getSavingsAmount(product)) })}
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
                            {renderConfidenceStrip(product)}
                          </div>
                        }
                      />
                    </Card>
                  </Col>
                  );
                })}
              </Row>
              {sortedProducts.length > pageSize && (
                <div className="product-list__pagination">
                  <Pagination current={currentPage} total={sortedProducts.length} pageSize={pageSize} onChange={setCurrentPage} showTotal={(total) => t('pages.productList.count', { count: total })} />
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
            {activeFilterCount > 0 ? <Tag color="blue">{t('pages.productList.activeFilters', { count: activeFilterCount })}</Tag> : null}
          </Space>
        }
        open={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        placement="bottom"
        height="82vh"
        className="product-list__mobileDrawer"
        extra={
          <Button type="link" disabled={activeFilterCount === 0} onClick={resetFilters}>
            {t('pages.productList.resetFilters')}
          </Button>
        }
      >
        <div className="product-list__drawerContent">
          <Card title={t('pages.productList.drawerCategoryTitle')} size="small">
            {renderCategoryPanel()}
          </Card>
          <Card title={t('pages.productList.drawerFilterTitle')} size="small">
            {renderFilterPanel()}
          </Card>
          <Button type="primary" block size="large" onClick={() => setFilterDrawerOpen(false)}>
            {t('pages.productList.applyFilters')}
          </Button>
        </div>
      </Drawer>
      <Modal
        title={quickAddProduct ? t('pages.productList.quickAddTitle', { name: quickAddProduct.name }) : t('pages.productList.quickAdd')}
        open={!!quickAddProduct}
        onCancel={() => {
          if (quickAddSubmitting) return;
          setQuickAddProduct(null);
        }}
        onOk={submitQuickAdd}
        okText={t('pages.productList.addToCart')}
        cancelText={t('common.cancel')}
        okButtonProps={{ disabled: quickAddSubmitDisabled || quickAddSubmitting, loading: quickAddSubmitting }}
        cancelButtonProps={{ disabled: quickAddSubmitting }}
        className="product-list__quickAddModal"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          {quickAddBundleInfo ? (
            <>
              {quickAddOptionGroups.length > 0 ? renderQuickAddOptions() : null}
              <Text type="secondary">{t('bundle.includes')}</Text>
              <Space wrap size={[6, 6]}>
                {quickAddBundleInfo.items.map((item) => (
                  <Tag key={item.name}>{item.name} x{item.quantity || 1}</Tag>
                ))}
              </Space>
              <Text>{t('pages.productList.quickAddPrice')}: {formatMoney(quickAddBundleInfo.price)}</Text>
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
                {t('pages.productList.quickAddPrice')}: {formatMoney(quickAddPrice)}
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
        className="product-list__previewModal"
        destroyOnClose
      >
        {previewProduct ? (
          <div className="product-list__preview">
            <div className="product-list__previewMedia">
              <img
                alt={previewProduct.name}
                src={getOptimizedImageUrl(resolveProductListImage(previewProduct.imageUrl), 720)}
                srcSet={buildResponsiveImageSrcSet(resolveProductListImage(previewProduct.imageUrl), [360, 520, 720, 960])}
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
              <h2>{previewProduct.name}</h2>
              <Text className="product-list__previewDescription">
                {previewProduct.description || t('pages.productList.previewNoDescription')}
              </Text>
              <div className="product-list__previewPrice">
                <strong>{formatMoney(getPrice(previewProduct))}</strong>
                {previewProduct.originalPrice && previewProduct.originalPrice > getPrice(previewProduct) ? (
                  <Text delete>{formatMoney(previewProduct.originalPrice)}</Text>
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
                  <span>{t('pages.productList.bestValueSavings', { amount: formatMoney(getSavingsAmount(previewProduct)) })}</span>
                ) : null}
              </div>
              <div className="product-list__previewActions">
                {isProductSoldOut(previewProduct) ? (
                  <Button icon={<BellOutlined />} onClick={(event) => handleStockAlert(event, previewProduct)}>
                    {alertedStockProductIds.has(previewProduct.id) ? t('pages.stockAlerts.remove') : t('pages.stockAlerts.notifyMe')}
                  </Button>
                ) : (
                  <Button
                    type="primary"
                    icon={<ShoppingCartOutlined />}
                    onClick={(event) => {
                      openQuickAdd(event, previewProduct);
                      setPreviewProduct(null);
                    }}
                  >
                    {isQuickAddReady(previewProduct) ? t('pages.productList.quickAdd') : t('pages.productList.chooseOptionsAction')}
                  </Button>
                )}
                <Button onClick={() => openProductDetail(previewProduct.id)}>
                  {t('pages.productList.viewDetails')}
                </Button>
                <Button
                  icon={wishlistedProductIds.has(previewProduct.id) ? <HeartFilled /> : <HeartOutlined />}
                  onClick={(event) => handleWishlistToggle(event, previewProduct)}
                >
                  {wishlistedProductIds.has(previewProduct.id) ? t('pages.productDetail.favorited') : t('pages.productDetail.favorite')}
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
