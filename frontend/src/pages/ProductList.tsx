import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ShopIcon, SI } from '../components/ShopIcon';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ProductPublic as Product, CategoryPublic } from '../types';
import { flattenCategoryTree, getDisplayCategoryRoots, getLocalizedCategoryValue } from '../utils/categoryTree';
import type { CategoryTreeNode } from '../utils/categoryTree';
import { useLanguage } from '../i18n';
import { usePageTitle } from '../hooks/usePageTitle';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { buildItemListStructuredData, buildWebsiteStructuredData } from '../utils/structuredData';
import { useMarket } from '../hooks/useMarket';
import { getBundleInfo } from '../utils/bundle';
import { isProductCompared } from '../utils/productCompare';
import { readStockAlerts } from '../utils/stockAlerts';
import { getLowStockCount } from '../utils/conversionConfig';
import { loadProductViewPreferences } from '../utils/productViewPreferences';
import { getProductOptionGroups, getProductVariants, optionValueIsCompatible } from '../utils/productOptions';
import { getLocalizedOptionLabel } from '../utils/localizedProductOptions';
import { dispatchDomEvent } from '../utils/domEvents';
import { loadGuestSupportContext } from '../utils/guestSupportContext';
import { hasStoredValue, setLocalStorageItem } from '../utils/safeStorage';
import { useNativeBackHandler } from '../utils/nativeBack';
import './ProductList.css';
import '../styles/mobile-page-contrast.css';

import {
  PRODUCT_LIST_FILTER_HINT_KEY,
  PRODUCT_LIST_PAGE_SIZE,
  DEFAULT_PRICE_RANGE,
  readSearchHistory,
  normalizeSearchValue,
  normalizeSortValue,
  normalizePetSizeValues,
  normalizeCollectionValue,
  parsePositiveId,
  getDefaultCatalogTitle,
  normalizeCatalogTitle,
  type ActiveResultContextAction,
  getPrice,
  getDiscountPercent,
  isQuickAddReady,
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
import { useProductListCatalog } from '../hooks/useProductListCatalog';
import { useProductListProductActions } from '../hooks/useProductListProductActions';
import { useProductListSessionData } from '../hooks/useProductListSessionData';
import { useProductListNavigation } from '../hooks/useProductListNavigation';
import { useProductListDerivedCatalog } from '../hooks/useProductListDerivedCatalog';

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

  useProductListSessionData({
    language,
    t,
    isAuthenticated,
    authSessionVersion,
    setAuthSessionVersion,
    setCategories,
    setWishlistedProductIds,
    setPersonalizedProducts,
    setAlertedStockProductIds,
    setViewPreferences,
  });

  const {
    collectionProducts,
    maxCatalogPrice,
    priceStep,
    displayedPriceRange,
    priceFilterActive,
    activeFilterCount,
    activeRefinementCount,
    filteredProducts,
    productCountForUi,
    productListInsights,
    checkoutPathProducts,
    checkoutPathReadyCount,
    heroProduct,
    paginatedProducts,
  } = useProductListDerivedCatalog({
    products,
    personalizedProducts,
    viewPreferences,
    usingServerPagination,
    collection,
    keyword,
    priceRange,
    priceFilterTouched,
    petSizes,
    materials,
    colors,
    sortBy,
    categoryId,
    productTotal,
    currentPage,
    pageSize,
  });

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
  const {
    fetchProducts,
    buildActiveFetchFilters,
  } = useProductListCatalog({
    pageSize,
    language,
    t,
    products,
    priceFilterTouched,
    priceRange,
    petSizes,
    materials,
    colors,
    collection,
    categoryId,
    sortBy,
    searchParams,
    priceRangeMaxRef,
    setLoading,
    setProducts,
    setProductTotal,
    setUsingServerPagination,
    setLoadFailed,
    setUsingCatalogSnapshot,
    setCurrentPage,
    setKeyword,
    setCategoryId,
    setDiscount,
    setSortBy,
    setPetSizes,
    setMaterials,
    setColors,
    setPriceFilterTouched,
    setPriceRange,
  });

  const {
    handleCompare,
    handleWishlistToggle,
    openProductDetail,
    openQuickAdd,
    selectQuickAddOption,
    handleStockAlert,
    prefetchProduct,
    openProductPreview,
    submitQuickAdd,
  } = useProductListProductActions({
    navigate,
    t,
    language,
    isAuthenticated,
    quickAddProduct,
    quickAddOptions,
    quickAddOptionGroups,
    quickAddVariants,
    quickAddVariant,
    quickAddPrice,
    quickAddSubmitting,
    setWishlistedProductIds,
    setQuickAddProduct,
    setQuickAddOptions,
    setQuickAddSubmitting,
    setPreviewProduct,
  });

  const productCountLabel = loading
    ? t('common.loading')
    : t('pages.productList.count', { count: productCountForUi });
  const {
    buildProductsUrl,
    updatePetSizes,
    updateMaterials,
    updateColors,
    commitPriceRange,
    applySort,
    handleSearch,
    handleSearchTermKeyDown,
    clearSearchHistory,
    resetFilters,
    handleCategoryChange,
    handleProductPageChange,
    handleBackToTop,
  } = useProductListNavigation({
    navigate,
    categoryId,
    collection,
    colors,
    discount,
    keyword,
    materials,
    petSizes,
    priceFilterTouched,
    priceRange,
    sortBy,
    searchHistory,
    maxCatalogPrice,
    pageSize,
    productCountForUi,
    usingServerPagination,
    priceRangeMaxRef,
    setCategoryId,
    setColors,
    setCurrentPage,
    setFilterDrawerOpen,
    setMaterials,
    setPetSizes,
    setPriceFilterTouched,
    setPriceRange,
    setSearchHistory,
    setShowBackToTop,
    setSortBy,
  });

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
  const heroProductHighlights = heroProduct
    ? [
      heroProduct.brand,
      getDiscountPercent(heroProduct) > 0 ? t('pages.productList.sale') : '',
      isQuickAddReady(heroProduct) ? t('pages.productList.cardQuickReady') : t('pages.productList.cardOptionsNeeded'),
    ].filter((item): item is string => Boolean(item))
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
