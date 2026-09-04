import { useCallback, useEffect, useRef } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { ProductPublic as Product, ProductPublicPage } from '../types';
import { productApi, createApiAbortController } from '../api';
import { localizeProduct } from '../utils/localizedProduct';
import { loadFallbackProductCatalog, loadProductCatalogSnapshot, saveProductCatalogSnapshot } from '../utils/productCatalogSnapshot';
import { getApiErrorMessage } from '../utils/apiError';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import type { Language } from '../i18n';
import {
  PRODUCT_LIST_FETCH_SIZE,
  VALID_MATERIALS,
  VALID_COLORS,
  normalizeSearchValue,
  normalizeSortValue,
  normalizePetSizeValues,
  normalizeOptionValues,
  normalizeCollectionValue,
  parsePositiveId,
  normalizePageNumber,
  parsePageParam,
  parsePriceParam,
  pickBestProductFallback,
  notifyCatalogFallback,
  type ProductFetchFilters,
} from '../pages/productListHelpers';

type Translate = (key: string, params?: Record<string, string | number>) => string;

type UseProductListCatalogArgs = {
  pageSize: number;
  language: Language;
  t: Translate;
  products: Product[];
  priceFilterTouched: boolean;
  priceRange: [number, number];
  petSizes: string[];
  materials: string[];
  colors: string[];
  collection: string;
  categoryId: number | undefined;
  sortBy: string;
  searchParams: URLSearchParams;
  priceRangeMaxRef: MutableRefObject<number>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setProducts: Dispatch<SetStateAction<Product[]>>;
  setProductTotal: Dispatch<SetStateAction<number>>;
  setUsingServerPagination: Dispatch<SetStateAction<boolean>>;
  setLoadFailed: Dispatch<SetStateAction<boolean>>;
  setUsingCatalogSnapshot: Dispatch<SetStateAction<boolean>>;
  setCurrentPage: Dispatch<SetStateAction<number>>;
  setKeyword: Dispatch<SetStateAction<string>>;
  setCategoryId: Dispatch<SetStateAction<number | undefined>>;
  setDiscount: Dispatch<SetStateAction<boolean>>;
  setSortBy: Dispatch<SetStateAction<string>>;
  setPetSizes: Dispatch<SetStateAction<string[]>>;
  setMaterials: Dispatch<SetStateAction<string[]>>;
  setColors: Dispatch<SetStateAction<string[]>>;
  setPriceFilterTouched: Dispatch<SetStateAction<boolean>>;
  setPriceRange: Dispatch<SetStateAction<[number, number]>>;
};

export const useProductListCatalog = ({
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
}: UseProductListCatalogArgs) => {
  const productRequestSeqRef = useRef(0);
  const productFetchAbortRef = useRef<AbortController | null>(null);
  const previousProductsRef = useRef<Product[]>([]);

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
      const shouldUpdateLoading = isCurrentRequest();
      if (productFetchAbortRef.current === abortController) {
        productFetchAbortRef.current = null;
      }
      if (shouldUpdateLoading) {
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

  return {
    fetchProducts,
    buildActiveFetchFilters,
    previousProductsRef,
  };
};
