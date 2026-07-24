import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { ShopIcon, SI } from '../components/ShopIcon';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { productApi, cartApi, categoryApi, wishlistApi, createApiAbortController } from '../api';
import type { ProductPublic as Product, ProductPublicPage, CategoryPublic } from '../types';
import { flattenCategoryTree, getDisplayCategoryRoots, getLocalizedCategoryValue } from '../utils/categoryTree';
import type { CategoryTreeNode } from '../utils/categoryTree';
import { useLanguage } from '../i18n';
import { usePageTitle } from '../hooks/usePageTitle';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { buildItemListStructuredData, buildWebsiteStructuredData } from '../utils/structuredData';
import { useMarket } from '../hooks/useMarket';
import { localizeProduct } from '../utils/localizedProduct';
import { addGuestCartItem } from '../utils/guestCart';
import { buildBundleSpecs, getBundleInfo } from '../utils/bundle';
import { addCompareProduct, isProductCompared, MAX_COMPARE_ITEMS } from '../utils/productCompare';
import { addStockAlert, readStockAlerts, removeStockAlert } from '../utils/stockAlerts';
import { conversionConfig, getLowStockCount } from '../utils/conversionConfig';
import { loadProductViewPreferences } from '../utils/productViewPreferences';
import { getProductOptionGroups, getProductVariants, optionValueIsCompatible, selectCompatibleProductOption } from '../utils/productOptions';
import { getLocalizedOptionLabel } from '../utils/localizedProductOptions';
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
import './ProductList.css';
import '../styles/mobile-page-contrast.css';

import {
  PRODUCT_LIST_FILTER_HINT_KEY,
  MAX_SEARCH_HISTORY,
  MAX_SEARCH_LENGTH,
  PRODUCT_LIST_PAGE_SIZE,
  PRODUCT_LIST_FETCH_SIZE,
  CATEGORY_CACHE_TTL,
  DEFAULT_PRICE_RANGE,
  VALID_MATERIALS,
  VALID_COLORS,
  resolveProductPrimaryImage,
  readSearchHistory,
  writeSearchHistory,
  normalizeSearchValue,
  normalizeSortValue,
  normalizePetSizeValue,
  normalizePetSizeValues,
  normalizeOptionValues,
  normalizeCollectionValue,
  parsePositiveId,
  normalizePageNumber,
  parsePageParam,
  parsePriceParam,
  getDefaultCatalogTitle,
  normalizeCatalogTitle,
  productSearchText,
  matchesSmartDeviceCollection,
  pickBestProductFallback,
  notifyCatalogFallback,
  clearProductListSessionCaches,
  getCategoryCache,
  setCategoryCache,
  getCategoryCacheRequest,
  setCategoryCacheRequest,
  type ProductListUrlOverrides,
  type ProductFetchFilters,
  type ActiveResultContextAction,
  getPrice,
  getDiscountPercent,
  getPositiveRate,
  getSavingsAmount,
  isProductSoldOut,
  isQuickAddReady,
  isBestValueProduct,
  buildProductListBadges,
} from './productListHelpers';
import {
  ProductListCategoryPanel,
  ProductListFilterPanel,
  type ProductListDiscoveryAction,
} from './productListPanels';
import {
  ProductListMainShell,
  type ProductListMainShellProps,
} from './productListShellPanels';

const ProductList: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CategoryPublic[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [showMobileFilterHint, setShowMobileFilterHint] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !hasStoredValue(PRODUCT_LIST_FILTER_HINT_KEY);
  });
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
  const dismissMobileFilterHint = useCallback(() => {
    setShowMobileFilterHint(false);
    setLocalStorageItem(PRODUCT_LIST_FILTER_HINT_KEY, '1');
  }, []);
  const openMobileFilterDrawer = useCallback(() => {
    dismissMobileFilterHint();
    setFilterDrawerOpen(true);
  }, [dismissMobileFilterHint]);
  usePageTitle(t('pages.productList.title'));
  const productListDescription = useMemo(() => {
    if (keyword.trim()) {
      return t('pages.productList.searchSeoDescription', { keyword: keyword.trim() });
    }
    return t('pages.productList.seoDescription');
  }, [keyword, t]);
  const { currency, formatMoney } = useMarket();
  const productListJsonLd = useMemo(() => {
    const websiteData = buildWebsiteStructuredData({
      name: t('pages.productList.title'),
      description: productListDescription,
      path: '/products',
      searchPathTemplate: '/products?keyword={search_term_string}',
    });
    const itemListData = buildItemListStructuredData({
      name: t('pages.productList.title'),
      description: productListDescription,
      path: '/products',
      items: products.slice(0, 24).map((product) => ({
        id: product.id,
        name: product.name,
        path: `/products/${product.id}`,
        imageUrl: product.imageUrl || product.images?.[0] || '',
        price: product.effectivePrice ?? product.price,
        currency,
      })),
    });
    return [websiteData, itemListData].filter(Boolean) as Array<Record<string, unknown>>;
  }, [currency, productListDescription, products, t]);
  useDocumentMeta({
    title: t('pages.productList.title'),
    description: productListDescription,
    path: '/products',
    type: 'website',
    siteName: t('common.siteTitle'),
    jsonLdId: 'website-products',
    jsonLd: productListJsonLd,
  });
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
    const cachedCategories = getCategoryCache();
    if (cachedCategories && cachedCategories.expiresAt > Date.now()) {
      setCategories(cachedCategories.items);
      return;
    }
    let active = true;
    let categoryRequest = getCategoryCacheRequest();
    if (!categoryRequest) {
      categoryRequest = categoryApi.getTopLevel()
        .then((res) => {
          setCategoryCache({ expiresAt: Date.now() + CATEGORY_CACHE_TTL, items: res.data });
          return res.data;
        })
        .finally(() => {
          setCategoryCacheRequest(null);
        });
      setCategoryCacheRequest(categoryRequest);
    }
    categoryRequest
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
    const isCurrentRequest = () => productRequestSeqRef.current === requestSeq;
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
      if (abortController.signal.aborted) return;
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
        announceAccessibleMessage(errorMessage, 'error');
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
      announceAccessibleMessage(t('pages.productList.compareFull', { count: MAX_COMPARE_ITEMS }), 'warning');
      return;
    }
    announceAccessibleMessage(result.status === 'exists' ? t('pages.productList.compareExists') : t('pages.productList.compareAdded'), 'success');
    navigate('/compare');
  }, [navigate, t]);

  const handleWishlistToggle = useCallback(async (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      announceAccessibleMessage(t('messages.loginRequired'), 'warning');
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
      announceAccessibleMessage(res.data.wishlisted ? t('pages.productDetail.favoritedMsg') : t('pages.productDetail.unfavoritedMsg'), 'success');
    } catch (error) {
      announceAccessibleMessage(getApiErrorMessage(error, t('messages.operationFailed'), language), 'error');
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


  const handleStockAlert = useCallback((e: React.MouseEvent, product: Product, stockAlerted: boolean) => {
    e.stopPropagation();
    if (stockAlerted) {
      removeStockAlert(product.id);
      announceAccessibleMessage(t('pages.stockAlerts.removed'), 'success');
      return;
    }
    const result = addStockAlert(product);
    announceAccessibleMessage(result.status === 'exists' ? t('pages.stockAlerts.exists') : t('pages.stockAlerts.added'), 'success');
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
      announceAccessibleMessage(t('pages.productDetail.selectOption', { option: missingOption.name }), 'warning');
      return;
    }
    if (quickAddVariants.length > 0 && !quickAddVariant) {
      announceAccessibleMessage(t('pages.productDetail.variantUnavailable'), 'warning');
      return;
    }
    const selectedStock = quickAddVariant?.stock ?? quickAddProduct.stock;
    if (selectedStock !== undefined && selectedStock <= 0) {
      announceAccessibleMessage(t('pages.productDetail.insufficientStock'), 'error');
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
        announceAccessibleMessage(t('messages.addCartSuccess'), 'success');
        setQuickAddProduct(null);
        await openCartDrawerWithSnapshot({ authenticated: Boolean(token) });
      } catch (error) {
        announceAccessibleMessage(getApiErrorMessage(error, t('messages.addFailed'), language), 'error');
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
      announceAccessibleMessage(t('messages.addCartSuccess'), 'success');
      setQuickAddProduct(null);
      await openCartDrawerWithSnapshot({ authenticated: Boolean(token) });
    } catch (error) {
      announceAccessibleMessage(getApiErrorMessage(error, t('messages.addFailed'), language), 'error');
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
  const productCountLabel = loading
    ? t('common.loading')
    : t('pages.productList.count', { count: productCountForUi });
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
  const previewProductName = previewProduct ? productListProductName(previewProduct) : '';
  const previewProductWishlisted = previewProduct ? wishlistedProductIds.has(previewProduct.id) : false;
  const previewProductStockAlerted = previewProduct ? alertedStockProductIds.has(previewProduct.id) : false;
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
      icon: <ShopIcon path={SI.search} />,
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
      icon: <ShopIcon path={SI.fire} />,
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
      icon: <ShopIcon path={SI.gift} />,
      label: t('nav.petNav.smartDevices'),
      active: collection === 'smart-devices',
      onClick: () => {
        setCurrentPage(1);
        navigate(buildProductsUrl({ collection: 'smart-devices' }));
      },
    },
    {
      key: 'rated',
      icon: <ShopIcon path={SI.barChart} />,
      label: t('pages.productList.shopTopRated'),
      active: sortBy === 'positive-rate-desc',
      onClick: () => applySort('positive-rate-desc'),
    },
    {
      key: 'quick',
      icon: <ShopIcon path={SI.cart} />,
      label: t('pages.productList.shopQuickAdd'),
      active: sortBy === 'quick-add-desc',
      onClick: () => applySort('quick-add-desc'),
    },
    {
      key: 'support',
      icon: <ShopIcon path={SI.support} />,
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
    : productCountLabel;
  const mobileNextStepActions = filteredProducts.length === 0
    ? [
      {
        key: 'recover',
        icon: activeRefinementCount > 0 ? <ShopIcon path={SI.reload} /> : <ShopIcon path={SI.filter} />,
        label: activeRefinementCount > 0 ? t('pages.productList.resetFilters') : t('pages.productList.filters'),
        primary: activeRefinementCount > 0,
        onClick: activeRefinementCount > 0 ? resetMobileRefinements : openMobileFilterDrawer,
      },
      {
        key: 'catalog',
        icon: <ShopIcon path={SI.search} />,
        label: t('pages.productList.allCategories'),
        primary: activeRefinementCount === 0 && hasActiveCatalogContext,
        onClick: resetCatalogView,
      },
      {
        key: 'coupons',
        icon: <ShopIcon path={SI.gift} />,
        label: t('pages.productList.loadRecoveryCoupons'),
        primary: !hasActiveCatalogContext,
        onClick: () => navigate('/coupons'),
      },
    ]
    : [
      {
        key: 'filter',
        icon: <ShopIcon path={SI.filter} />,
        label: t('pages.productList.filters'),
        primary: activeRefinementCount > 0,
        onClick: openMobileFilterDrawer,
      },
      {
        key: 'deals',
        icon: <ShopIcon path={SI.fire} />,
        label: t('pages.productList.shopBestDeals'),
        primary: productListInsights.bestValueCount > 0,
        onClick: () => applySort('discount-desc'),
      },
      {
        key: 'quick',
        icon: <ShopIcon path={SI.cart} />,
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
        icon: <ShopIcon path={SI.search} />,
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
        icon: <ShopIcon path={SI.gift} />,
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
        icon: <ShopIcon path={SI.fire} />,
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
      icon: <ShopIcon path={SI.filter} />,
      label: tag.label,
      onClear: tag.onClose,
    })),
    sortBy !== 'default'
      ? {
        key: 'sort',
        icon: <ShopIcon path={SI.barChart} />,
        label: `${t('pages.productList.sortLabel')}: ${currentSortLabel}`,
        onClear: () => applySort('default'),
      }
      : null,
  ].filter(Boolean) as ActiveResultContextAction[];
  const productListFilterContextLabel = `${t('pages.productList.filters')}: ${activeRefinementCount > 0 ? t('pages.productList.activeFilters', { count: activeRefinementCount }) : t('pages.productList.allCategories')}, ${productCountLabel}`;
  const openFilterDrawerActionLabel = productListFilterContextLabel;
  const resetRefinementsActionLabel = `${t('pages.productList.resetFilters')}: ${productListFilterContextLabel}`;
  const applyRefinementsActionLabel = `${t('pages.productList.applyFilters')}: ${productListFilterContextLabel}`;
  const shopBestDealsActionLabel = `${t('pages.productList.shopBestDeals')}: ${productCountLabel}`;
  const shopQuickAddActionLabel = `${t('pages.productList.shopQuickAdd')}: ${t('pages.productList.quickAddReady', { count: productListInsights.quickAddReadyCount })}`;
  const loadRecoveryContextLabel = `${t('pages.productList.fetchFailed')}: ${productListFilterContextLabel}`;
  const refreshCatalogActionLabel = `${t('common.refresh')}: ${loadRecoveryContextLabel}`;
  const allCategoriesRecoveryActionLabel = `${t('pages.productList.allCategories')}: ${loadRecoveryContextLabel}`;
  const couponsRecoveryActionLabel = `${t('pages.productList.loadRecoveryCoupons')}: ${loadRecoveryContextLabel}`;
  const supportRecoveryActionLabel = `${t('pages.productList.loadRecoverySupport')}: ${loadRecoveryContextLabel}`;
  const emptyAllCategoriesActionLabel = `${t('pages.productList.allCategories')}: ${t('pages.productList.empty')}`;
  const emptyResetFiltersActionLabel = `${t('pages.productList.resetFilters')}: ${t('pages.productList.empty')}, ${productListFilterContextLabel}`;
  const emptyCouponsActionLabel = `${t('pages.productList.loadRecoveryCoupons')}: ${t('pages.productList.empty')}`;
  const emptyPetFinderActionLabel = `${t('nav.petFinder')}: ${t('pages.productList.empty')}`;
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

  const categoryPanelRows = useMemo(
    () => categoryRows.map((category) => ({
      id: category.id,
      title: normalizeCategoryTitle(category),
    })),
    [categoryRows, normalizeCategoryTitle],
  );

  const categoryPanel = (
    <ProductListCategoryPanel
      allCategoriesLabel={t('pages.productList.allCategories')}
      categoryDepthById={categoryDepthById}
      categoryId={categoryId}
      categoryRows={categoryPanelRows}
      onCategoryChange={handleCategoryChange}
      t={t}
    />
  );

  const filterPanel = (
    <ProductListFilterPanel
      colors={colors}
      colorOptions={colorOptions}
      commitPriceRange={commitPriceRange}
      displayedPriceRange={displayedPriceRange}
      formatMoney={formatMoney}
      materials={materials}
      materialOptions={materialOptions}
      maxCatalogPrice={maxCatalogPrice}
      petSizeOptions={petSizeOptions}
      petSizes={petSizes}
      priceStep={priceStep}
      setCurrentPage={setCurrentPage}
      setPriceFilterTouched={setPriceFilterTouched}
      setPriceRange={setPriceRange}
      t={t}
      updateColors={updateColors}
      updateMaterials={updateMaterials}
      updatePetSizes={updatePetSizes}
    />
  );

  const emptyDiscoveryActions: ProductListDiscoveryAction[] = [
    {
      key: 'catalog',
      icon: <ShopIcon path={SI.filter} />,
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
      icon: <ShopIcon path={SI.fire} />,
      title: t('pages.productList.shopBestDeals'),
      text: t('pages.productList.guideStart'),
      ariaLabel: `${t('pages.productList.shopBestDeals')}: ${t('pages.productList.empty')}`,
      onClick: () => navigate('/products?discount=true'),
    },
    {
      key: 'coupons',
      icon: <ShopIcon path={SI.gift} />,
      title: t('pages.productList.loadRecoveryCoupons'),
      text: t('pages.productList.loadRecoveryText'),
      ariaLabel: `${t('pages.productList.loadRecoveryCoupons')}: ${t('pages.productList.empty')}`,
      onClick: () => navigate('/coupons'),
    },
    {
      key: 'support',
      icon: <ShopIcon path={SI.support} />,
      title: t('pages.productList.loadRecoverySupport'),
      text: t('pages.productList.loadRecoveryTipSupport'),
      ariaLabel: `${t('pages.productList.loadRecoverySupport')}: ${t('pages.productList.empty')}`,
      onClick: openSupport,
    },
  ];

  const shellProps: ProductListMainShellProps = {
    language,
    loading,
    loadFailed,
    filteredProducts,
    quickAddProduct,
    previewProduct,
    filterDrawerOpen,
    t,
    selectedCategoryName,
    categoryPanel,
    filterPanel,
    activeFilterCount,
    resetFilters,
    topCategoryName,
    catalogHeroTitle,
    collection,
    collectionLabel,
    resultContextTags,
    productCountLabel,
    productListInsights,
    heroProduct,
    heroProductName,
    heroProductHighlights,
    prefetchProduct,
    openProductDetail,
    formatMoney,
    renderBadges,
    keyword,
    setKeyword,
    handleSearch,
    handleSearchTermKeyDown,
    productSearchActionLabel,
    sortBy,
    applySort,
    sortOptions,
    currentSortLabel,
    openFilterDrawerActionLabel,
    openMobileFilterDrawer,
    activeRefinementCount,
    activeResultContextActions,
    resetCatalogView,
    searchHistory,
    clearSearchHistory,
    mobileDiscoveryActions,
    mobileNextStepTitle,
    mobileNextStepText,
    mobileNextStepActions,
    mobileHeroSignal,
    mobilePrimaryActionLabel,
    mobileSecondaryActionLabel,
    shopBestDealsActionLabel,
    shopQuickAddActionLabel,
    openQuickAdd,
    usingCatalogSnapshot,
    refreshCatalogActionLabel,
    fetchProducts,
    categoryId,
    discount,
    buildActiveFetchFilters,
    currentPage,
    checkoutPathProducts,
    checkoutPathReadyCount,
    productListGuideText,
    renderProductAmountText,
    productListProductName,
    emptyDiscoveryActions,
    allCategoriesRecoveryActionLabel,
    couponsRecoveryActionLabel,
    navigate,
    openSupport,
    supportRecoveryActionLabel,
    emptyAllCategoriesActionLabel,
    emptyCouponsActionLabel,
    emptyPetFinderActionLabel,
    emptyResetFiltersActionLabel,
    paginatedProducts,
    alertedStockProductIds,
    handleCompare,
    handleProductPageChange,
    handleStockAlert,
    handleWishlistToggle,
    isProductCompared,
    openProductPreview,
    pageSize,
    productCountForUi,
    renderSavingsText,
    wishlistedProductIds,
    applyRefinementsActionLabel,
    resetMobileRefinements,
    resetRefinementsActionLabel,
    setFilterDrawerOpen,
    showBackToTop,
    backToTopActionLabel,
    handleBackToTop,
    setPreviewProduct,
    setQuickAddProduct,
    submitQuickAdd,
    setQuickAddOptions,
    selectQuickAddOption,
    previewProductName,
    previewProductStockAlerted,
    previewProductWishlisted,
    quickAddBundleInfo,
    quickAddInvalidSelection,
    quickAddMissingOption,
    quickAddOptionGroups,
    quickAddOptions,
    quickAddPrice,
    quickAddProductName,
    quickAddSubmitDisabled,
    quickAddSubmitting,
    quickAddVariant,
    quickAddVariants,
    showMobileFilterHint,
    dismissMobileFilterHint,
  };

  return <ProductListMainShell {...shellProps} />;
};

export default ProductList;
