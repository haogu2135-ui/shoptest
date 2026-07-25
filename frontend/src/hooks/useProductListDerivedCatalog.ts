import { useMemo } from 'react';
import type { ProductPublic as Product } from '../types';
import type { ProductViewPreferences } from '../utils/productViewPreferences';
import {
  buildPersonalizedSortContext,
  deriveProductListInsights,
  filterCollectionProducts,
  filterProductsByRefinements,
  isPriceFilterActive,
  isQuickAddReady,
  pickCheckoutPathProducts,
  pickHeroProduct,
  pickRecommendedProduct,
  resolveActiveFilterCount,
  resolveDisplayedPriceRange,
  resolveMaxCatalogPrice,
  resolvePaginatedProducts,
  resolvePriceStep,
  sortProductList,
} from '../pages/productListHelpers';

type UseProductListDerivedCatalogArgs = {
  products: Product[];
  personalizedProducts: Product[];
  viewPreferences: ProductViewPreferences;
  usingServerPagination: boolean;
  collection: string;
  keyword: string;
  priceRange: [number, number];
  priceFilterTouched: boolean;
  petSizes: string[];
  materials: string[];
  colors: string[];
  sortBy: string;
  categoryId?: number;
  productTotal: number;
  currentPage: number;
  pageSize: number;
};

export const useProductListDerivedCatalog = ({
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
}: UseProductListDerivedCatalogArgs) => {
  const collectionProducts = useMemo(
    () => filterCollectionProducts(products, { collection, keyword, usingServerPagination }),
    [collection, keyword, products, usingServerPagination],
  );

  const maxCatalogPrice = useMemo(
    () => resolveMaxCatalogPrice(collectionProducts),
    [collectionProducts],
  );

  const priceStep = resolvePriceStep(maxCatalogPrice);

  const displayedPriceRange = useMemo(
    () => resolveDisplayedPriceRange(priceRange, maxCatalogPrice),
    [maxCatalogPrice, priceRange],
  );

  const priceFilterActive = isPriceFilterActive(priceFilterTouched, displayedPriceRange, maxCatalogPrice);
  const activeFilterCount = resolveActiveFilterCount(priceFilterActive, petSizes, materials, colors);
  const activeRefinementCount = activeFilterCount + (categoryId ? 1 : 0);

  const filteredProducts = useMemo(
    () => filterProductsByRefinements(collectionProducts, {
      priceFilterActive,
      displayedPriceRange,
      petSizes,
      materials,
      colors,
    }),
    [collectionProducts, colors, displayedPriceRange, materials, petSizes, priceFilterActive],
  );

  const personalizedSortContext = useMemo(
    () => buildPersonalizedSortContext(personalizedProducts, viewPreferences),
    [personalizedProducts, viewPreferences],
  );

  const sortedProducts = useMemo(
    () => sortProductList(filteredProducts, sortBy, personalizedSortContext, usingServerPagination),
    [filteredProducts, personalizedSortContext, sortBy, usingServerPagination],
  );

  const productCountForUi = usingServerPagination ? productTotal : sortedProducts.length;

  const productListInsights = useMemo(
    () => deriveProductListInsights(filteredProducts),
    [filteredProducts],
  );

  const checkoutPathProducts = useMemo(
    () => pickCheckoutPathProducts(sortedProducts),
    [sortedProducts],
  );
  const checkoutPathReadyCount = checkoutPathProducts.filter(isQuickAddReady).length;

  const recommendedProduct = useMemo(
    () => pickRecommendedProduct(filteredProducts, personalizedSortContext),
    [filteredProducts, personalizedSortContext],
  );

  const heroProduct = useMemo(
    () => pickHeroProduct(recommendedProduct, sortedProducts),
    [recommendedProduct, sortedProducts],
  );

  const paginatedProducts = useMemo(
    () => resolvePaginatedProducts(sortedProducts, {
      usingServerPagination,
      currentPage,
      pageSize,
    }),
    [currentPage, pageSize, sortedProducts, usingServerPagination],
  );

  return {
    collectionProducts,
    maxCatalogPrice,
    priceStep,
    displayedPriceRange,
    priceFilterActive,
    activeFilterCount,
    activeRefinementCount,
    filteredProducts,
    sortedProducts,
    productCountForUi,
    productListInsights,
    checkoutPathProducts,
    checkoutPathReadyCount,
    recommendedProduct,
    heroProduct,
    paginatedProducts,
  };
};
