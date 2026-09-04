import { useEffect } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { CategoryPublic, ProductPublic as Product } from '../types';
import { categoryApi, createApiAbortController, productApi, wishlistApi } from '../api';
import { localizeProduct } from '../utils/localizedProduct';
import {
  buildProductCatalogFallbackCategories,
  loadFallbackProductCatalog,
  loadProductCatalogSnapshot,
  saveProductCatalogSnapshot,
} from '../utils/productCatalogSnapshot';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import { cancelIdleTask, scheduleIdleTask } from '../utils/idleScheduler';
import { addAppScrollListener, getAppScrollMetrics } from '../utils/nativeScroll';
import { PRODUCT_VIEW_PREFERENCES_KEY, loadProductViewPreferences } from '../utils/productViewPreferences';
import type { Language } from '../i18n';
import {
  DISCOVERY_BATCH_SIZE,
  HOME_FEATURED_LIMIT,
  HOME_PRODUCT_PAGE_SIZE,
  mergeProductsById,
} from '../pages/homeHelpers';

type Translate = (key: string, params?: Record<string, string | number>) => string;

type UseHomeCatalogArgs = {
  language: Language;
  t: Translate;
  isAuthenticated: boolean;
  catalogReadyRef: MutableRefObject<boolean>;
  discoveryProductsLength: number;
  viewPreferencesRecent: number[];
  setWishlistedProductIds: Dispatch<SetStateAction<Set<number>>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setLoadError: Dispatch<SetStateAction<boolean>>;
  setFeatured: Dispatch<SetStateAction<Product[]>>;
  setProducts: Dispatch<SetStateAction<Product[]>>;
  setCategories: Dispatch<SetStateAction<CategoryPublic[]>>;
  setVisibleCount: Dispatch<SetStateAction<number>>;
  setUsingCatalogSnapshot: Dispatch<SetStateAction<boolean>>;
  setPersonalizedProducts: Dispatch<SetStateAction<Product[]>>;
  setViewPreferences: Dispatch<SetStateAction<ReturnType<typeof loadProductViewPreferences>>>;
  setRecentlyViewedDetails: Dispatch<SetStateAction<Product[]>>;
  setRecentlyViewedHydrated: Dispatch<SetStateAction<boolean>>;
};

export const useHomeCatalog = ({
  language,
  t,
  isAuthenticated,
  catalogReadyRef,
  discoveryProductsLength,
  viewPreferencesRecent,
  setWishlistedProductIds,
  setLoading,
  setLoadError,
  setFeatured,
  setProducts,
  setCategories,
  setVisibleCount,
  setUsingCatalogSnapshot,
  setPersonalizedProducts,
  setViewPreferences,
  setRecentlyViewedDetails,
  setRecentlyViewedHydrated,
}: UseHomeCatalogArgs) => {
  useEffect(() => {
    if (!isAuthenticated) {
      setWishlistedProductIds(new Set());
      return;
    }
    let disposed = false;
    const abortController = createApiAbortController();
    wishlistApi.getByUser(0, { signal: abortController.signal })
      .then((response) => {
        if (!disposed && !abortController.signal.aborted) {
          setWishlistedProductIds(new Set(response.data.map((item) => item.productId)));
        }
      })
      .catch((error) => {
        if (!disposed && !abortController.signal.aborted) {
          reportNonBlockingError('Home.fetchWishlist', error);
          setWishlistedProductIds(new Set());
        }
      });
    return () => {
      disposed = true;
      abortController.abort();
    };
  }, [isAuthenticated, setWishlistedProductIds]);

  useEffect(() => {
    let disposed = false;
    const abortController = createApiAbortController();
    const fetchHome = async () => {
      // Stale-while-revalidate: only blank to skeleton when nothing is paintable yet.
      if (!catalogReadyRef.current) {
        setLoading(true);
      }
      setLoadError(false);
      try {
        const [productsRes, featuredRes, categoriesRes] = await Promise.all([
          productApi.getAll(undefined, undefined, undefined, { page: 0, size: HOME_PRODUCT_PAGE_SIZE }, { signal: abortController.signal }),
          productApi.getFeatured(HOME_FEATURED_LIMIT, { signal: abortController.signal }),
          categoryApi.getTopLevel({ signal: abortController.signal }),
        ]);
        if (disposed || abortController.signal.aborted) return;
        const boundedCatalog = mergeProductsById(featuredRes.data, productsRes.data);
        saveProductCatalogSnapshot(boundedCatalog);
        const localizedProducts = boundedCatalog.map((product) => localizeProduct(product, language));
        const featuredProducts = featuredRes.data.map((product) => localizeProduct(product, language)).slice(0, HOME_FEATURED_LIMIT);
        setFeatured(featuredProducts.length ? featuredProducts : localizedProducts.slice(0, HOME_FEATURED_LIMIT));
        setProducts(localizedProducts);
        setCategories(categoriesRes.data);
        setVisibleCount(DISCOVERY_BATCH_SIZE);
        setUsingCatalogSnapshot(false);
        setLoadError(false);
        catalogReadyRef.current = true;
      } catch (error) {
        if (disposed || abortController.signal.aborted) return;
        reportNonBlockingError('Home.fetchHome', error);
        const fallbackSourceProducts = loadProductCatalogSnapshot()?.products || loadFallbackProductCatalog();
        const fallbackProducts = fallbackSourceProducts.map((product) => localizeProduct(product, language));
        if (fallbackProducts.length > 0) {
          // Keep already-painted bootstrap content when possible; only replace if empty or hard failure.
          if (!catalogReadyRef.current) {
            const featuredFallback = fallbackProducts.filter((product) => product.isFeatured).slice(0, HOME_FEATURED_LIMIT);
            setFeatured(featuredFallback.length ? featuredFallback : fallbackProducts.slice(0, HOME_FEATURED_LIMIT));
            setProducts(fallbackProducts);
            setCategories(buildProductCatalogFallbackCategories(fallbackSourceProducts));
            setVisibleCount(DISCOVERY_BATCH_SIZE);
          }
          setLoadError(false);
          setUsingCatalogSnapshot(true);
          catalogReadyRef.current = true;
          return;
        }
        if (!catalogReadyRef.current) {
          setLoadError(true);
          setFeatured([]);
          setProducts([]);
          setCategories([]);
        }
      } finally {
        if (!disposed && !abortController.signal.aborted) setLoading(false);
      }
    };

    fetchHome();
    return () => {
      disposed = true;
      abortController.abort();
    };
  }, [
    catalogReadyRef,
    language,
    setCategories,
    setFeatured,
    setLoadError,
    setLoading,
    setProducts,
    setUsingCatalogSnapshot,
    setVisibleCount,
    t,
  ]);

  useEffect(() => {
    let disposed = false;
    const fetchPersonalizedProducts = async () => {
      if (!isAuthenticated) {
        setPersonalizedProducts([]);
        return;
      }
      if (abortController.signal.aborted) return;
      try {
        const response = await productApi.getPersonalizedRecommendations({ signal: abortController.signal });
        if (!disposed && !abortController.signal.aborted) {
          setPersonalizedProducts(response.data.map((product) => localizeProduct(product, language)));
        }
      } catch (error) {
        if (!disposed && !abortController.signal.aborted) {
          reportNonBlockingError('Home.fetchPersonalizedProducts', error);
          setPersonalizedProducts([]);
        }
      }
    };

    if (!isAuthenticated) {
      setPersonalizedProducts([]);
      return;
    }
    const abortController = createApiAbortController();
    const task = scheduleIdleTask(fetchPersonalizedProducts, 1500);
    return () => {
      disposed = true;
      abortController.abort();
      cancelIdleTask(task);
    };
  }, [isAuthenticated, language, setPersonalizedProducts]);

  useEffect(() => {
    const handlePreferencesUpdated = (event?: Event) => {
      if (event instanceof StorageEvent && event.key && event.key !== PRODUCT_VIEW_PREFERENCES_KEY) return;
      setViewPreferences(loadProductViewPreferences());
    };
    window.addEventListener('shop:product-view-preferences-updated', handlePreferencesUpdated);
    window.addEventListener('storage', handlePreferencesUpdated);
    return () => {
      window.removeEventListener('shop:product-view-preferences-updated', handlePreferencesUpdated);
      window.removeEventListener('storage', handlePreferencesUpdated);
    };
  }, [setViewPreferences]);

  useEffect(() => {
    if (viewPreferencesRecent.length === 0) {
      setRecentlyViewedDetails([]);
      setRecentlyViewedHydrated(true);
      return;
    }
    let disposed = false;
    const abortController = createApiAbortController();
    setRecentlyViewedHydrated(false);
    const recentProductIds = viewPreferencesRecent.slice(0, 8);
    const task = scheduleIdleTask(() => {
      productApi.getByIds(recentProductIds, { signal: abortController.signal })
        .then((response) => {
          if (!disposed && !abortController.signal.aborted) {
            setRecentlyViewedDetails(response.data.map((product) => localizeProduct(product, language)));
            setRecentlyViewedHydrated(true);
          }
        })
        .catch((error) => {
          if (!disposed && !abortController.signal.aborted) {
            reportNonBlockingError('Home.fetchRecentlyViewedDetails', error);
            setRecentlyViewedDetails([]);
            setRecentlyViewedHydrated(true);
          }
        });
    }, 1900);
    return () => {
      disposed = true;
      abortController.abort();
      cancelIdleTask(task);
    };
  }, [language, setRecentlyViewedDetails, setRecentlyViewedHydrated, viewPreferencesRecent]);

  useEffect(() => {
    let frameId: number | null = null;
    const updateVisibleCount = () => {
      frameId = null;
      const { scrollHeight, viewportHeight, scrollTop } = getAppScrollMetrics();
      const distanceToBottom = scrollHeight - viewportHeight - scrollTop;
      if (distanceToBottom < 420) {
        setVisibleCount((count) => Math.min(count + DISCOVERY_BATCH_SIZE, discoveryProductsLength));
      }
    };
    const handleScroll = () => {
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(updateVisibleCount);
    };
    const removeScrollListener = addAppScrollListener(handleScroll, { passive: true });
    updateVisibleCount();
    return () => {
      removeScrollListener();
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [discoveryProductsLength, setVisibleCount]);
};
