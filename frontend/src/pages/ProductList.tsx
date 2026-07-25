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
  buildProductListActionLabels,
  buildProductListActiveRefinementTagData,
  buildProductListActiveResultContextDescriptors,
  buildProductListBadges,
  buildProductListColorOptions,
  buildProductListEmptyDiscoveryDescriptors,
  buildProductListGuideText,
  buildProductListMainShellProps,
  buildProductListMaterialOptions,
  buildProductListMobileDiscoveryDescriptors,
  buildProductListMobileNextStepDescriptors,
  buildProductListOptionLabelMap,
  buildProductListPetSizeOptions,
  buildProductListResultContextTags,
  buildProductListSortOptions,
  deriveProductListCatalogPresentation,
  deriveProductListVisibleCategories,
  renderProductListAmountText,
  resolveProductListCollectionLabel,
  resolveProductListHasActiveCatalogContext,
  resolveProductListMobileNextStepCopy,
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
  const petSizeOptions = useMemo(() => buildProductListPetSizeOptions(t), [t]);
  const materialOptions = useMemo(() => buildProductListMaterialOptions(t), [t]);
  const colorOptions = useMemo(() => buildProductListColorOptions(t), [t]);

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

  const visibleCategories = useMemo(
    () => deriveProductListVisibleCategories({
      categories,
      collectionProducts,
      usingServerPagination,
      collection,
      keyword,
      categoryId,
    }),
    [categories, categoryId, collection, collectionProducts, keyword, usingServerPagination],
  );
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
  const getCollectionLabel = useCallback(
    (value: string) => resolveProductListCollectionLabel(value, t),
    [t],
  );
  const selectedCategoryNameEarly = selectedCategory ? normalizeCategoryTitle(selectedCategory) : '';
  const collectionLabelEarly = normalizeCatalogTitle(getCollectionLabel(collection), catalogTitleFallback);
  const resultContextTags = buildProductListResultContextTags({
    collection,
    collectionLabel: collectionLabelEarly,
    keyword,
    selectedCategoryName: selectedCategoryNameEarly,
    discount,
    t,
  });
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

  const optionLabels = useMemo(
    () => buildProductListOptionLabelMap({ petSizeOptions, materialOptions, colorOptions }),
    [colorOptions, materialOptions, petSizeOptions],
  );
  const activeRefinementTagData = useMemo(() => buildProductListActiveRefinementTagData({
    t,
    selectedCategory: selectedCategory
      ? { id: selectedCategory.id, title: normalizeCategoryTitle(selectedCategory) }
      : null,
    priceFilterActive,
    displayedPriceRange,
    formatMoney,
    petSizes,
    materials,
    colors,
    optionLabels,
  }), [
    colors,
    displayedPriceRange,
    formatMoney,
    materials,
    normalizeCategoryTitle,
    optionLabels,
    petSizes,
    priceFilterActive,
    selectedCategory,
    t,
  ]);
  const clearActiveRefinementTag = useCallback((tag: { kind: string; value?: string }) => {
    if (tag.kind === 'category') {
      setCategoryId(undefined);
      setCurrentPage(1);
      navigate(buildProductsUrl({ categoryId: undefined }));
      setFilterDrawerOpen(false);
      return;
    }
    if (tag.kind === 'price') {
      setPriceRange([0, maxCatalogPrice]);
      setPriceFilterTouched(false);
      setCurrentPage(1);
      navigate(buildProductsUrl({ priceRange: [0, maxCatalogPrice], priceFilterTouched: false }));
      return;
    }
    if (tag.kind === 'size' && tag.value) {
      updatePetSizes(petSizes.filter((item) => item !== tag.value));
      return;
    }
    if (tag.kind === 'material' && tag.value) {
      updateMaterials(materials.filter((item) => item !== tag.value));
      return;
    }
    if (tag.kind === 'color' && tag.value) {
      updateColors(colors.filter((item) => item !== tag.value));
    }
  }, [buildProductsUrl, colors, materials, maxCatalogPrice, navigate, petSizes, updateColors, updateMaterials, updatePetSizes]);
  const activeRefinementTags = useMemo(
    () => activeRefinementTagData.map((tag) => ({
      key: tag.key,
      label: tag.label,
      onClose: () => clearActiveRefinementTag(tag),
    })),
    [activeRefinementTagData, clearActiveRefinementTag],
  );

  const selectedCategoryName = selectedCategory
    ? normalizeCategoryTitle(selectedCategory)
    : '';
  const leadingCategoryName = categoryRows[0]
    ? normalizeCategoryTitle(categoryRows[0])
    : '';
  const {
    topCategoryName,
    collectionLabel,
    catalogHeroTitle,
    heroProductHighlights,
    mobileHeroSignal,
    heroProductName,
    quickAddProductName,
    previewProductName,
    previewProductWishlisted,
    previewProductStockAlerted,
  } = deriveProductListCatalogPresentation({
    t,
    catalogTitleFallback,
    keyword,
    categoryId,
    collection,
    discount,
    selectedCategoryName,
    leadingCategoryName,
    heroProduct,
    quickAddProduct,
    previewProduct,
    productListProductName,
    formatMoney,
    quickAddReadyCount: productListInsights.quickAddReadyCount,
    wishlistedProductIds,
    alertedStockProductIds,
  });
  const renderProductAmountText = useCallback(
    (label: string, amount: string) => renderProductListAmountText(label, amount),
    [],
  );
  const renderSavingsText = useCallback((amount: number) => renderProductAmountText(
    t('pages.productList.bestValueSavings', { amount: formatMoney(amount) }),
    formatMoney(amount),
  ), [formatMoney, renderProductAmountText, t]);
  const productListGuideText = buildProductListGuideText({
    t,
    activeFilterCount,
    bestValueCount: productListInsights.bestValueCount,
    quickAddReadyCount: productListInsights.quickAddReadyCount,
  });
  const sortOptions = buildProductListSortOptions(t);
  const mobileDiscoveryDescriptors = buildProductListMobileDiscoveryDescriptors({
    t,
    collection,
    keyword,
    discount,
    sortBy,
    activeRefinementCount,
  });
  const mobileDiscoveryActions = mobileDiscoveryDescriptors.map((item) => {
    const iconPath = item.key === 'all'
      ? SI.search
      : item.key === 'deals'
        ? SI.fire
        : item.key === 'smart'
          ? SI.gift
          : item.key === 'rated'
            ? SI.barChart
            : item.key === 'quick'
              ? SI.cart
              : SI.support;
    const onClick = () => {
      if (item.intent === 'reset-catalog') {
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
        return;
      }
      if (item.intent === 'deals') {
        setDiscount(true);
        setSortBy('discount-desc');
        setCurrentPage(1);
        navigate(buildProductsUrl({ discount: true, sortBy: 'discount-desc' }));
        return;
      }
      if (item.intent === 'smart-devices') {
        setCurrentPage(1);
        navigate(buildProductsUrl({ collection: 'smart-devices' }));
        return;
      }
      if (item.intent === 'top-rated') {
        applySort('positive-rate-desc');
        return;
      }
      if (item.intent === 'quick-add') {
        applySort('quick-add-desc');
        return;
      }
      openSupport();
    };
    return {
      key: item.key,
      icon: <ShopIcon path={iconPath} />,
      label: item.label,
      active: item.active,
      onClick,
    };
  });
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
  const hasActiveCatalogContext = resolveProductListHasActiveCatalogContext({
    keyword,
    categoryId,
    collection,
    discount,
    activeRefinementCount,
  });
  const {
    mobileNextStepText,
    mobileNextStepTitle,
  } = resolveProductListMobileNextStepCopy({
    t,
    filteredProductsLength: filteredProducts.length,
    hasActiveCatalogContext,
    activeRefinementCount,
    productListGuideText,
    productCountLabel,
  });
  const mobileNextStepDescriptors = buildProductListMobileNextStepDescriptors({
    t,
    filteredProductsLength: filteredProducts.length,
    activeRefinementCount,
    hasActiveCatalogContext,
    bestValueCount: productListInsights.bestValueCount,
    quickAddReadyCount: productListInsights.quickAddReadyCount,
  });
  const mobileNextStepActions = mobileNextStepDescriptors.map((item) => {
    const iconPath = item.iconKey === 'reload'
      ? SI.reload
      : item.iconKey === 'search'
        ? SI.search
        : item.iconKey === 'gift'
          ? SI.gift
          : item.iconKey === 'fire'
            ? SI.fire
            : item.iconKey === 'cart'
              ? SI.cart
              : SI.filter;
    const onClick = () => {
      if (item.intent === 'reset-refinements') {
        resetMobileRefinements();
        return;
      }
      if (item.intent === 'open-filters') {
        openMobileFilterDrawer();
        return;
      }
      if (item.intent === 'reset-catalog') {
        resetCatalogView();
        return;
      }
      if (item.intent === 'coupons') {
        navigate('/coupons');
        return;
      }
      if (item.intent === 'deals') {
        applySort('discount-desc');
        return;
      }
      applySort('quick-add-desc');
    };
    return {
      key: item.key,
      icon: <ShopIcon path={iconPath} />,
      label: item.label,
      primary: item.primary,
      onClick,
    };
  });
  const currentSortLabel = sortOptions.find((option) => option.value === sortBy)?.label || t('pages.productList.defaultSort');
  const activeResultContextActions: ActiveResultContextAction[] = buildProductListActiveResultContextDescriptors({
    t,
    keyword,
    collection,
    collectionLabel: collection
      ? normalizeCatalogTitle(getCollectionLabel(collection), catalogTitleFallback)
      : null,
    discount,
    activeRefinementTags: activeRefinementTags.map((tag) => ({ key: tag.key, label: tag.label })),
    sortBy,
    currentSortLabel,
  }).map((item) => {
    const iconPath = item.iconKey === 'search'
      ? SI.search
      : item.iconKey === 'gift'
        ? SI.gift
        : item.iconKey === 'fire'
          ? SI.fire
          : item.iconKey === 'barChart'
            ? SI.barChart
            : SI.filter;
    const onClear = () => {
      if (item.intent === 'keyword') {
        setKeyword('');
        setCurrentPage(1);
        navigate(buildProductsUrl({ keyword: '' }));
        return;
      }
      if (item.intent === 'collection') {
        setCurrentPage(1);
        navigate(buildProductsUrl({ collection: '' }));
        return;
      }
      if (item.intent === 'discount') {
        setDiscount(false);
        setCurrentPage(1);
        navigate(buildProductsUrl({ discount: false }));
        return;
      }
      if (item.intent === 'sort') {
        applySort('default');
        return;
      }
      const refinement = activeRefinementTags.find((tag) => tag.key === item.refinementKey);
      refinement?.onClose();
    };
    return {
      key: item.key,
      icon: <ShopIcon path={iconPath} />,
      label: item.label,
      onClear,
    };
  });
  const {
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
  } = buildProductListActionLabels({
    t,
    activeRefinementCount,
    productCountLabel,
    quickAddReadyCount: productListInsights.quickAddReadyCount,
    heroProduct,
    heroProductName,
    filteredProductsLength: filteredProducts.length,
  });
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

  const emptyDiscoveryDescriptors = buildProductListEmptyDiscoveryDescriptors({
    t,
    activeRefinementCount,
    resetRefinementsActionLabel,
    emptyAllCategoriesActionLabel,
  });
  const emptyDiscoveryActions: ProductListDiscoveryAction[] = emptyDiscoveryDescriptors.map((item) => {
    const iconPath = item.iconKey === 'fire'
      ? SI.fire
      : item.iconKey === 'gift'
        ? SI.gift
        : item.iconKey === 'support'
          ? SI.support
          : SI.filter;
    const onClick = () => {
      if (item.intent === 'reset-refinements') {
        resetMobileRefinements();
        return;
      }
      if (item.intent === 'all-categories') {
        navigate('/products');
        return;
      }
      if (item.intent === 'deals') {
        navigate('/products?discount=true');
        return;
      }
      if (item.intent === 'coupons') {
        navigate('/coupons');
        return;
      }
      openSupport();
    };
    return {
      key: item.key,
      icon: <ShopIcon path={iconPath} />,
      title: item.title,
      text: item.text,
      ariaLabel: item.ariaLabel,
      primary: item.primary,
      onClick,
    };
  });

  const shellProps: ProductListMainShellProps = buildProductListMainShellProps({
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
  });

  return <ProductListMainShell {...shellProps} />;
};

export default ProductList;
