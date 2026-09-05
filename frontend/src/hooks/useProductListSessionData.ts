import { useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { CategoryPublic, ProductPublic as Product } from '../types';
import { categoryApi, createApiAbortController, productApi, wishlistApi } from '../api';
import { localizeProduct } from '../utils/localizedProduct';
import {
  buildProductCatalogFallbackCategories,
  loadFallbackProductCatalog,
  loadProductCatalogSnapshot,
} from '../utils/productCatalogSnapshot';
import { readStockAlerts } from '../utils/stockAlerts';
import { loadProductViewPreferences } from '../utils/productViewPreferences';
import { AUTH_SESSION_CHANGED_EVENT } from '../utils/authEvents';
import type { Language } from '../i18n';
import {
  CATEGORY_CACHE_TTL,
  clearProductListSessionCaches,
  getCategoryCache,
  getCategoryCacheRequest,
  setCategoryCache,
  setCategoryCacheRequest,
} from '../pages/productListHelpers';

type UseProductListSessionDataArgs = {
  language: Language;
  t: (key: string, params?: Record<string, string | number>) => string;
  isAuthenticated: boolean;
  authSessionVersion: number;
  setAuthSessionVersion: Dispatch<SetStateAction<number>>;
  setCategories: Dispatch<SetStateAction<CategoryPublic[]>>;
  setWishlistedProductIds: Dispatch<SetStateAction<Set<number>>>;
  setPersonalizedProducts: Dispatch<SetStateAction<Product[]>>;
  setAlertedStockProductIds: Dispatch<SetStateAction<Set<number>>>;
  setViewPreferences: Dispatch<SetStateAction<ReturnType<typeof loadProductViewPreferences>>>;
};

export const useProductListSessionData = ({
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
}: UseProductListSessionDataArgs) => {
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
  }, [setAuthSessionVersion, setCategories, setPersonalizedProducts, setWishlistedProductIds]);

  useEffect(() => {
    const cachedCategories = getCategoryCache();
    if (cachedCategories && cachedCategories.expiresAt > Date.now()) {
      setCategories(cachedCategories.items);
      return;
    }
    let active = true;
    const abortController = createApiAbortController();
    let categoryRequest = getCategoryCacheRequest();
    if (!categoryRequest) {
      categoryRequest = categoryApi.getTopLevel({ signal: abortController.signal })
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
        if (active && !abortController.signal.aborted) setCategories(items);
      })
      .catch(() => {
        if (!active || abortController.signal.aborted) return;
        const snapshot = loadProductCatalogSnapshot();
        const fallbackCategories = buildProductCatalogFallbackCategories(
          snapshot?.products?.length ? snapshot.products : loadFallbackProductCatalog(),
        );
        setCategories(fallbackCategories);
      });
    return () => {
      active = false;
      abortController.abort();
    };
  }, [authSessionVersion, setCategories, t]);

  useEffect(() => {
    if (!isAuthenticated) {
      setWishlistedProductIds(new Set());
      return;
    }
    let disposed = false;
    const abortController = createApiAbortController();
    wishlistApi.getByUser(0, { signal: abortController.signal })
      .then((res) => {
        if (!disposed && !abortController.signal.aborted) {
          setWishlistedProductIds(new Set(res.data.map((item) => item.productId)));
        }
      })
      .catch(() => {
        if (!disposed && !abortController.signal.aborted) setWishlistedProductIds(new Set());
      });
    return () => {
      disposed = true;
      abortController.abort();
    };
  }, [authSessionVersion, isAuthenticated, setWishlistedProductIds]);

  useEffect(() => {
    const refreshLocalSessionState = (event?: Event) => {
      const isStorageEvent = event instanceof StorageEvent;
      const storageKey = isStorageEvent ? event.key : null;
      const refreshAlerts = !event || event.type === 'shop:stock-alerts-updated'
        || (isStorageEvent && (!storageKey || storageKey === 'shop-stock-alerts'));
      const refreshPreferences = !event || event.type === 'shop:product-view-preferences-updated'
        || (isStorageEvent && (!storageKey || storageKey === 'shop-product-view-preferences'));
      if (refreshAlerts) {
        setAlertedStockProductIds(new Set(readStockAlerts().map((alert) => alert.productId)));
      }
      if (refreshPreferences) {
        setViewPreferences(loadProductViewPreferences());
      }
    };
    window.addEventListener('shop:stock-alerts-updated', refreshLocalSessionState);
    window.addEventListener('shop:product-view-preferences-updated', refreshLocalSessionState);
    window.addEventListener('storage', refreshLocalSessionState);
    return () => {
      window.removeEventListener('shop:stock-alerts-updated', refreshLocalSessionState);
      window.removeEventListener('shop:product-view-preferences-updated', refreshLocalSessionState);
      window.removeEventListener('storage', refreshLocalSessionState);
    };
  }, [setAlertedStockProductIds, setViewPreferences]);

  useEffect(() => {
    if (!isAuthenticated) {
      setPersonalizedProducts([]);
      return;
    }
    let disposed = false;
    const abortController = createApiAbortController();
    productApi.getPersonalizedRecommendations({ signal: abortController.signal })
      .then((response) => {
        if (!disposed && !abortController.signal.aborted) {
          setPersonalizedProducts(response.data.map((product) => localizeProduct(product, language)));
        }
      })
      .catch(() => {
        if (!disposed && !abortController.signal.aborted) setPersonalizedProducts([]);
      });
    return () => {
      disposed = true;
      abortController.abort();
    };
  }, [authSessionVersion, isAuthenticated, language, setPersonalizedProducts]);
};
