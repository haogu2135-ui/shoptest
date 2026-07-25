import React, { useCallback, useEffect } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { addAppScrollListener, getAppScrollMetrics, scrollAppToTop } from '../utils/nativeScroll';
import {
  MAX_SEARCH_HISTORY,
  VALID_COLORS,
  VALID_MATERIALS,
  normalizeCollectionValue,
  normalizeOptionValues,
  normalizePageNumber,
  normalizePetSizeValues,
  normalizeSearchValue,
  normalizeSortValue,
  writeSearchHistory,
  type ProductListUrlOverrides,
} from '../pages/productListHelpers';

type UseProductListNavigationArgs = {
  navigate: NavigateFunction;
  categoryId: number | undefined;
  collection: string;
  colors: string[];
  discount: boolean;
  keyword: string;
  materials: string[];
  petSizes: string[];
  priceFilterTouched: boolean;
  priceRange: [number, number];
  sortBy: string;
  searchHistory: string[];
  maxCatalogPrice: number;
  pageSize: number;
  productCountForUi: number;
  usingServerPagination: boolean;
  priceRangeMaxRef: MutableRefObject<number>;
  setCategoryId: Dispatch<SetStateAction<number | undefined>>;
  setColors: Dispatch<SetStateAction<string[]>>;
  setCurrentPage: Dispatch<SetStateAction<number>>;
  setFilterDrawerOpen: Dispatch<SetStateAction<boolean>>;
  setMaterials: Dispatch<SetStateAction<string[]>>;
  setPetSizes: Dispatch<SetStateAction<string[]>>;
  setPriceFilterTouched: Dispatch<SetStateAction<boolean>>;
  setPriceRange: Dispatch<SetStateAction<[number, number]>>;
  setSearchHistory: Dispatch<SetStateAction<string[]>>;
  setShowBackToTop: Dispatch<SetStateAction<boolean>>;
  setSortBy: Dispatch<SetStateAction<string>>;
};

export const useProductListNavigation = ({
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
}: UseProductListNavigationArgs) => {
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
  }, [buildProductsUrl, navigate, setCurrentPage, setPetSizes]);

  const updateMaterials = useCallback((nextMaterials: string[]) => {
    const normalizedMaterials = normalizeOptionValues(nextMaterials, VALID_MATERIALS);
    setMaterials(normalizedMaterials);
    setCurrentPage(1);
    navigate(buildProductsUrl({ materials: normalizedMaterials }));
  }, [buildProductsUrl, navigate, setCurrentPage, setMaterials]);

  const updateColors = useCallback((nextColors: string[]) => {
    const normalizedColors = normalizeOptionValues(nextColors, VALID_COLORS);
    setColors(normalizedColors);
    setCurrentPage(1);
    navigate(buildProductsUrl({ colors: normalizedColors }));
  }, [buildProductsUrl, navigate, setColors, setCurrentPage]);

  const commitPriceRange = useCallback((nextRange: [number, number]) => {
    const normalizedRange: [number, number] = [
      Math.max(0, Math.min(nextRange[0], nextRange[1])),
      Math.max(nextRange[0], nextRange[1]),
    ];
    setPriceFilterTouched(true);
    setPriceRange(normalizedRange);
    setCurrentPage(1);
    navigate(buildProductsUrl({ priceRange: normalizedRange, priceFilterTouched: true }));
  }, [buildProductsUrl, navigate, setCurrentPage, setPriceFilterTouched, setPriceRange]);

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
  }, [maxCatalogPrice, priceFilterTouched, priceRangeMaxRef, setPriceRange]);

  const applySort = useCallback((nextSort: string) => {
    const normalizedSort = normalizeSortValue(nextSort);
    setSortBy(normalizedSort);
    setCurrentPage(1);
    navigate(buildProductsUrl({ sortBy: normalizedSort }));
  }, [buildProductsUrl, navigate, setCurrentPage, setSortBy]);

  const handleSearch = useCallback((value: string) => {
    const trimmed = normalizeSearchValue(value);
    if (trimmed) {
      const nextHistory = [trimmed, ...searchHistory.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_SEARCH_HISTORY);
      setSearchHistory(nextHistory);
      writeSearchHistory(nextHistory);
    }
    navigate(buildProductsUrl({ keyword: trimmed }));
  }, [buildProductsUrl, navigate, searchHistory, setSearchHistory]);

  const handleSearchTermKeyDown = useCallback((event: React.KeyboardEvent<HTMLElement>, term: string) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    handleSearch(term);
  }, [handleSearch]);

  const clearSearchHistory = useCallback(() => {
    setSearchHistory([]);
    writeSearchHistory([]);
  }, [setSearchHistory]);

  const resetFilters = useCallback(() => {
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
  }, [
    buildProductsUrl,
    maxCatalogPrice,
    navigate,
    setColors,
    setCurrentPage,
    setMaterials,
    setPetSizes,
    setPriceFilterTouched,
    setPriceRange,
  ]);

  const handleCategoryChange = useCallback((cid: number | undefined) => {
    setCategoryId(cid);
    navigate(buildProductsUrl({ categoryId: cid }));
    setFilterDrawerOpen(false);
  }, [buildProductsUrl, navigate, setCategoryId, setFilterDrawerOpen]);

  const handleProductPageChange = useCallback((nextPage: number) => {
    const totalPages = Math.max(1, Math.ceil(productCountForUi / pageSize));
    const normalizedPage = Math.min(totalPages, normalizePageNumber(nextPage));
    setCurrentPage(normalizedPage);
    if (usingServerPagination) {
      navigate(buildProductsUrl({ page: normalizedPage }));
    }
    scrollAppToTop('smooth');
  }, [buildProductsUrl, navigate, pageSize, productCountForUi, setCurrentPage, usingServerPagination]);

  const updateBackToTopVisibility = useCallback(() => {
    const metrics = getAppScrollMetrics();
    setShowBackToTop(metrics.scrollTop > 640 && metrics.scrollHeight > metrics.viewportHeight + 320);
  }, [setShowBackToTop]);

  useEffect(() => {
    updateBackToTopVisibility();
    return addAppScrollListener(updateBackToTopVisibility, { passive: true });
  }, [updateBackToTopVisibility]);

  const handleBackToTop = useCallback(() => {
    setShowBackToTop(false);
    scrollAppToTop('smooth');
  }, [setShowBackToTop]);

  return {
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
  };
};
