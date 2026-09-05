import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { cartApi, createApiAbortController, productApi } from '../api';
import type { Language } from '../i18n';
import type { CartItem, ProductPublic as Product } from '../types';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { getApiErrorMessage, isAuthExpiredError } from '../utils/apiError';
import { clearCheckoutCartItemIds, hasAuthenticatedCartSession } from '../utils/cartSession';
import { canCartItemCheckout as canCheckout } from '../utils/cartUi';
import { conversionConfig } from '../utils/conversionConfig';
import { getGuestCartItems } from '../utils/guestCart';
import { localizeProduct } from '../utils/localizedProduct';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import { loadProductViewPreferences } from '../utils/productViewPreferences';
import { getLocalStorageItem, removeSessionStorageItem } from '../utils/safeStorage';
import {
  SAVE_FOR_LATER_STORAGE_KEY,
  type SavedForLaterItem,
} from '../utils/saveForLater';
import {
  clearRecentProductsCache,
  getCachedRecentProducts,
  getSavedForLaterItemsSnapshot,
  normalizeCartItems,
  setCachedRecentProducts,
} from '../pages/cartHelpers';

type CheckoutTranslationFn = (key: string, params?: Record<string, string | number>) => string;

type UseCartSessionDataParams = {
  cartItems: CartItem[];
  language: Language;
  setCartItems: Dispatch<SetStateAction<CartItem[]>>;
  setLoadError: Dispatch<SetStateAction<boolean>>;
  setLoadErrorMessage: Dispatch<SetStateAction<string | null>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setQuantityDrafts: Dispatch<SetStateAction<Record<number, string>>>;
  setRecentProducts: Dispatch<SetStateAction<Product[]>>;
  setSavedItems: Dispatch<SetStateAction<SavedForLaterItem[]>>;
  setSelectedIds: Dispatch<SetStateAction<number[]>>;
  t: CheckoutTranslationFn;
};

/**
 * Commercial cart session bootstrap:
 * snapshot fetch, guest storage sync, selection pruning, and recently-viewed recovery.
 */
export const useCartSessionData = ({
  cartItems,
  language,
  setCartItems,
  setLoadError,
  setLoadErrorMessage,
  setLoading,
  setQuantityDrafts,
  setRecentProducts,
  setSavedItems,
  setSelectedIds,
  t,
}: UseCartSessionDataParams) => {
  const mountedRef = useRef(true);
  const cartSnapshotRequestRef = useRef(0);
  const cartSnapshotAbortRef = useRef<AbortController | null>(null);
  const cartFetchErrorFallbackRef = useRef(t('pages.cart.fetchFailed'));
  const cartFetchErrorLanguageRef = useRef(language);

  useEffect(() => {
    cartFetchErrorFallbackRef.current = t('pages.cart.fetchFailed');
    cartFetchErrorLanguageRef.current = language;
  }, [language, t]);

  const resetCheckoutStateAfterCartMutation = useCallback(() => {
    clearRecentProductsCache();
    clearCheckoutCartItemIds();
    removeSessionStorageItem('checkoutPaymentMethod');
  }, []);

  const beginCartSnapshotRequest = useCallback(() => {
    cartSnapshotRequestRef.current += 1;
    return cartSnapshotRequestRef.current;
  }, []);

  const isCurrentCartSnapshotRequest = useCallback((requestId: number) => (
    mountedRef.current && cartSnapshotRequestRef.current === requestId
  ), []);

  const invalidateCartSnapshotRequests = useCallback(() => {
    cartSnapshotRequestRef.current += 1;
    return cartSnapshotRequestRef.current;
  }, []);

  const fetchCartItems = useCallback(async () => {
    if (!mountedRef.current) return;
    cartSnapshotAbortRef.current?.abort();
    const abortController = createApiAbortController();
    cartSnapshotAbortRef.current = abortController;
    const authenticated = hasAuthenticatedCartSession();
    const requestId = beginCartSnapshotRequest();
    if (!authenticated) {
      const guestItems = normalizeCartItems(getGuestCartItems());
      if (!isCurrentCartSnapshotRequest(requestId)) return;
      if (guestItems.length === 0) {
        resetCheckoutStateAfterCartMutation();
      }
      setLoadError(false);
      setLoadErrorMessage(null);
      setCartItems(guestItems);
      setSelectedIds(guestItems.filter(canCheckout).map((item) => item.id));
      if (isCurrentCartSnapshotRequest(requestId)) setLoading(false);
      if (cartSnapshotAbortRef.current === abortController) cartSnapshotAbortRef.current = null;
      return;
    }
    try {
      setLoadError(false);
      setLoadErrorMessage(null);
      const response = await cartApi.getItems(0, { signal: abortController.signal });
      if (!mountedRef.current) return;
      const nextItems = normalizeCartItems(response.data);
      if (!isCurrentCartSnapshotRequest(requestId)) return;
      if (nextItems.length === 0) {
        resetCheckoutStateAfterCartMutation();
      }
      setCartItems(nextItems);
      setSelectedIds(nextItems.filter(canCheckout).map((item) => item.id));
    } catch (error: unknown) {
      if (abortController.signal.aborted || !mountedRef.current) return;
      if (!isCurrentCartSnapshotRequest(requestId)) return;
      if (isAuthExpiredError(error)) {
        const guestItems = normalizeCartItems(getGuestCartItems());
        if (guestItems.length === 0) {
          resetCheckoutStateAfterCartMutation();
        }
        setCartItems(guestItems);
        setSelectedIds(guestItems.filter(canCheckout).map((item) => item.id));
        setLoadError(false);
        setLoadErrorMessage(null);
      } else {
        const errorMessage = getApiErrorMessage(error, cartFetchErrorFallbackRef.current, cartFetchErrorLanguageRef.current);
        setLoadError(true);
        setLoadErrorMessage(errorMessage);
        announceAccessibleMessage(errorMessage, 'error');
      }
    } finally {
      if (cartSnapshotAbortRef.current === abortController) cartSnapshotAbortRef.current = null;
      if (isCurrentCartSnapshotRequest(requestId)) setLoading(false);
    }
  }, [
    beginCartSnapshotRequest,
    isCurrentCartSnapshotRequest,
    resetCheckoutStateAfterCartMutation,
    setCartItems,
    setLoadError,
    setLoadErrorMessage,
    setLoading,
    setSelectedIds,
  ]);

  const isCartMounted = useCallback(() => mountedRef.current, []);

  const handleQuantitySyncError = useCallback(async (err: unknown) => {
    announceAccessibleMessage(getApiErrorMessage(err, t('pages.cart.quantityFailed'), language), 'error');
    try {
      await fetchCartItems();
    } catch (refreshError) {
      reportNonBlockingError('Cart.handleQuantitySyncError.fetchCartItems', refreshError);
    }
  }, [fetchCartItems, language, t]);

  useEffect(() => {
    fetchCartItems();
  }, [fetchCartItems]);

  useEffect(() => {
    setQuantityDrafts((drafts) => {
      const visibleItemIds = new Set(cartItems.map((item) => item.id));
      let changed = false;
      const nextDrafts: Record<number, string> = {};
      Object.entries(drafts).forEach(([itemId, value]) => {
        const numericItemId = Number(itemId);
        if (visibleItemIds.has(numericItemId)) {
          nextDrafts[numericItemId] = value;
        } else {
          changed = true;
        }
      });
      return changed ? nextDrafts : drafts;
    });
  }, [cartItems, setQuantityDrafts]);

  useEffect(() => {
    // Skip empty-cart prunes so the initial mount effect cannot race the first
    // fetchCartItems() selection write (same commit can queue this updater after
    // setSelectedIds([...readyIds]) and wipe guest/member auto-select).
    if (cartItems.length === 0) return;
    setSelectedIds((ids) => {
      if (ids.length === 0) return ids;
      const checkoutableItemIds = new Set(cartItems.filter(canCheckout).map((item) => item.id));
      let changed = false;
      const nextIds: number[] = [];
      ids.forEach((id) => {
        if (!checkoutableItemIds.has(id)) {
          changed = true;
          return;
        }
        if (nextIds.includes(id)) {
          changed = true;
          return;
        }
        nextIds.push(id);
      });
      return changed ? nextIds : ids;
    });
  }, [cartItems, setSelectedIds]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      cartSnapshotAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!conversionConfig.cartRecentlyViewed.enabled) return;
    let disposed = false;
    let activeAbortController: AbortController | null = null;
    // The preferences-updated listener re-invokes this loader inside the same effect
    // run, so `disposed` alone cannot tell two concurrent loads apart: a slow earlier
    // fetch would resolve last and repaint the panel with the older history. Each run
    // claims a sequence number so only the newest one writes.
    let recentLoadSeq = 0;
    const loadRecentlyViewedProducts = async () => {
      activeAbortController?.abort();
      const abortController = createApiAbortController();
      activeAbortController = abortController;
      const requestSeq = recentLoadSeq + 1;
      recentLoadSeq = requestSeq;
      const isCurrentLoad = () => (
        !disposed
        && mountedRef.current
        && recentLoadSeq === requestSeq
        && !abortController.signal.aborted
      );
      const preferences = loadProductViewPreferences();
      if (preferences.recent.length === 0) {
        if (!isCurrentLoad()) return;
        setRecentProducts([]);
        return;
      }
      try {
        const recentIds = preferences.recent.slice(0, conversionConfig.cartRecentlyViewed.maxItems * 2);
        const cacheKey = `${language}|${recentIds.join(',')}`;
        const cachedProducts = getCachedRecentProducts(cacheKey);
        if (cachedProducts) {
          if (!isCurrentLoad()) return;
          setRecentProducts(cachedProducts);
          return;
        }
        const response = await productApi.getByIds(recentIds, { signal: abortController.signal });
        if (!isCurrentLoad()) return;
        const productById = new Map(response.data.map((product) => [product.id, localizeProduct(product, language)]));
        const nextRecentProducts = preferences.recent
          .map((productId) => productById.get(productId))
          .filter((product): product is Product => Boolean(product))
          .filter((product) => product.stock === undefined || product.stock > 0)
          .slice(0, conversionConfig.cartRecentlyViewed.maxItems);
        setCachedRecentProducts(cacheKey, nextRecentProducts);
        setRecentProducts(nextRecentProducts);
      } catch (error) {
        if (abortController.signal.aborted) return;
        reportNonBlockingError('Cart.loadRecentProducts', error);
        if (!isCurrentLoad()) return;
        setRecentProducts([]);
      }
    };
    loadRecentlyViewedProducts();
    window.addEventListener('shop:product-view-preferences-updated', loadRecentlyViewedProducts);
    return () => {
      disposed = true;
      activeAbortController?.abort();
      activeAbortController = null;
      window.removeEventListener('shop:product-view-preferences-updated', loadRecentlyViewedProducts);
    };
  }, [language, setRecentProducts]);

  useEffect(() => {
    const refreshStoredState = (event: Event) => {
      const isStorageEvent = event.type === 'storage';
      const storageEvent = isStorageEvent ? event as StorageEvent : null;
      const allStorageCleared = storageEvent?.key === null;
      const savedItemsChanged = event.type === 'shop:save-for-later-updated'
        || (isStorageEvent && (allStorageCleared || storageEvent?.key === SAVE_FOR_LATER_STORAGE_KEY));
      if (savedItemsChanged) {
        setSavedItems(getSavedForLaterItemsSnapshot());
      }
      const guestCartChanged = event.type === 'shop:cart-updated'
        || (isStorageEvent && (allStorageCleared || storageEvent?.key === 'shop-guest-cart'));
      if (!guestCartChanged || getLocalStorageItem('token')) return;
      const guestItems = normalizeCartItems(getGuestCartItems());
      if (guestItems.length === 0) {
        resetCheckoutStateAfterCartMutation();
      }
      setCartItems(guestItems);
      setSelectedIds(guestItems.filter(canCheckout).map((item) => item.id));
      if (mountedRef.current) setLoading(false);
    };
    window.addEventListener('shop:save-for-later-updated', refreshStoredState);
    window.addEventListener('shop:cart-updated', refreshStoredState);
    window.addEventListener('storage', refreshStoredState);
    return () => {
      window.removeEventListener('shop:save-for-later-updated', refreshStoredState);
      window.removeEventListener('shop:cart-updated', refreshStoredState);
      window.removeEventListener('storage', refreshStoredState);
    };
  }, [resetCheckoutStateAfterCartMutation, setCartItems, setLoading, setSavedItems, setSelectedIds]);

  return {
    beginCartSnapshotRequest,
    fetchCartItems,
    handleQuantitySyncError,
    invalidateCartSnapshotRequests,
    isCartMounted,
    isCurrentCartSnapshotRequest,
    mountedRef,
    resetCheckoutStateAfterCartMutation,
  };
};
