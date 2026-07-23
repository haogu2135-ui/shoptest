import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ShopCheckbox from '../components/ShopCheckbox';
import ShopButton from '../components/ShopButton';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import ShopPopconfirm from '../components/ShopPopconfirm';
import { ShopIcon, SI } from '../components/ShopIcon';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { cartApi, productApi } from '../api';
import type { CartItem, ProductPublic as Product } from '../types';
import { useLanguage } from '../i18n';
import { usePageTitle } from '../hooks/usePageTitle';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useMarket } from '../hooks/useMarket';
import { useCartQuantitySync } from '../hooks/useCartQuantitySync';
import { formatSelectedSpecs } from '../utils/selectedSpecs';
import { addGuestCartItem, getGuestCartItems, removeGuestCartItem, removeGuestCartItems, updateGuestCartQuantity } from '../utils/guestCart';
import {
  getSavedForLaterItems,
  removeSavedForLaterProduct,
  removeSavedForLaterItem,
  replaceSavedForLaterItems,
  saveCartItemForLater,
  SAVE_FOR_LATER_STORAGE_KEY,
  type SavedForLaterItem,
} from '../utils/saveForLater';
import { conversionConfig } from '../utils/conversionConfig';
import { getNearestCartBenefitTarget, isGiftUnlocked } from '../utils/cartBenefits';
import { loadProductViewPreferences } from '../utils/productViewPreferences';
import { needsOptionSelection } from '../utils/productOptions';
import { localizeProduct } from '../utils/localizedProduct';
import { clearCheckoutCartItemIds, hasAuthenticatedCartSession, syncCheckoutCartItemIds } from '../utils/cartSession';
import {
  canCartItemCheckout as canCheckout,
  cartImageFallback,
  deriveCartShippingSummary,
  getCartItemLowStockCount,
  getCartLineAmount,
  getCartLineQuantity,
  getCartQuantityLimit,
  isCartItemAvailable as isAvailable,
  normalizeCartQuantity,
  resolveCartImage,
  roundCartMoney,
} from '../utils/cartUi';
import { dispatchDomEvent } from '../utils/domEvents';
import PageError from '../components/PageError';
import ShopBreadcrumb from '../components/ShopBreadcrumb';
import ShopProgress from '../components/ShopProgress';
import ShopTag from '../components/ShopTag';
import ShopAlert from '../components/ShopAlert';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import { getLocalStorageItem, removeSessionStorageItem } from '../utils/safeStorage';
import { allSettledWithConcurrency } from '../utils/asyncBatch';
import { getApiErrorMessage, isAuthExpiredError } from '../utils/apiError';
import AddOnAssistant from '../components/AddOnAssistant';
import { ProductCardSkeleton, StatsStripSkeleton } from '../components/SkeletonLoader';
import './Cart.css';
import '../styles/mobile-page-contrast.css';

const RECENT_PRODUCTS_CACHE_MS = 2 * 60 * 1000;
const RECENT_PRODUCTS_CACHE_MAX_ENTRIES = 50;
type RecentProductsCacheEntry = { expiresAt: number; products: Product[] };
const recentProductsCache = new Map<string, RecentProductsCacheEntry>();

const pruneRecentProductsCache = (now = Date.now()) => {
  recentProductsCache.forEach((entry, key) => {
    if (entry.expiresAt <= now) {
      recentProductsCache.delete(key);
    }
  });
  while (recentProductsCache.size > RECENT_PRODUCTS_CACHE_MAX_ENTRIES) {
    const oldestKey = recentProductsCache.keys().next().value;
    if (!oldestKey) break;
    recentProductsCache.delete(oldestKey);
  }
};

const getCachedRecentProducts = (cacheKey: string, now = Date.now()) => {
  const cached = recentProductsCache.get(cacheKey);
  if (!cached) {
    pruneRecentProductsCache(now);
    return null;
  }
  if (cached.expiresAt <= now) {
    recentProductsCache.delete(cacheKey);
    return null;
  }
  recentProductsCache.delete(cacheKey);
  recentProductsCache.set(cacheKey, cached);
  return cached.products;
};

const setCachedRecentProducts = (cacheKey: string, products: Product[], now = Date.now()) => {
  pruneRecentProductsCache(now);
  recentProductsCache.delete(cacheKey);
  recentProductsCache.set(cacheKey, {
    expiresAt: now + RECENT_PRODUCTS_CACHE_MS,
    products,
  });
  pruneRecentProductsCache(now);
};

const clearRecentProductsCache = () => {
  recentProductsCache.clear();
};

const getSavedAgeDays = (savedAt?: number) => {
  if (!savedAt) return 0;
  return Math.max(0, Math.floor((Date.now() - savedAt) / 86400000));
};

const isCartItemStockOut = (stock?: number | null) => {
  if (stock === undefined || stock === null) return false;
  const numeric = Number(stock);
  return Number.isFinite(numeric) && numeric <= 0;
};

const getLineTotal = (item: Pick<CartItem, 'price' | 'quantity'> | Pick<SavedForLaterItem, 'price' | 'quantity'>) =>
  getCartLineAmount(item);

const normalizeCartItems = (items: unknown): CartItem[] => (Array.isArray(items) ? items : []);

const normalizeSavedForLaterItems = (items: unknown): SavedForLaterItem[] => (Array.isArray(items) ? items : []);

const getSavedForLaterItemsSnapshot = () => normalizeSavedForLaterItems(getSavedForLaterItems());

const normalizePositiveProductId = (value: unknown) => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

export const deriveCartCheckoutMetrics = (
  items: unknown,
  selectedIds: number[],
  canCheckoutItem: (item: CartItem) => boolean = canCheckout,
) => {
  const selectedIdSet = new Set(selectedIds);
  const nextSelectedItems: CartItem[] = [];
  const nextPurchasableItems: CartItem[] = [];
  const nextUnavailableItems: CartItem[] = [];
  let nextSelectedTotal = 0;
  let nextSelectedUnitCount = 0;
  let nextPurchasableUnitCount = 0;
  let nextSelectedPurchasableCount = 0;
  let selectedHasUnavailableItem = false;

  normalizeCartItems(items).forEach((item) => {
    const checkoutReady = canCheckoutItem(item);
    if (checkoutReady) {
      nextPurchasableItems.push(item);
      nextPurchasableUnitCount += getCartLineQuantity(item.quantity);
    } else {
      nextUnavailableItems.push(item);
    }

    if (!selectedIdSet.has(item.id)) return;
    nextSelectedItems.push(item);
    nextSelectedTotal += getLineTotal(item);
    nextSelectedUnitCount += getCartLineQuantity(item.quantity);
    if (checkoutReady) {
      nextSelectedPurchasableCount += 1;
    } else {
      selectedHasUnavailableItem = true;
    }
  });

  return {
    checkoutBlocked: nextSelectedPurchasableCount === 0 || selectedHasUnavailableItem,
    purchasableItems: nextPurchasableItems,
    purchasableUnitCount: nextPurchasableUnitCount,
    selectedItems: nextSelectedItems,
    selectedPurchasableCount: nextSelectedPurchasableCount,
    selectedTotal: roundCartMoney(nextSelectedTotal),
    selectedUnitCount: nextSelectedUnitCount,
    unavailableItems: nextUnavailableItems,
  };
};

const Cart: React.FC = () => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [savedItems, setSavedItems] = useState<SavedForLaterItem[]>(() => getSavedForLaterItemsSnapshot());
  const [recentProducts, setRecentProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);
  const [restoringSaved, setRestoringSaved] = useState(false);
  const [restoringSavedItemIds, setRestoringSavedItemIds] = useState<number[]>([]);
  const [addingRecentId, setAddingRecentId] = useState<number | null>(null);
  const [updatingItemIds, setUpdatingItemIds] = useState<number[]>([]);
  const [removingItemIds, setRemovingItemIds] = useState<number[]>([]);
  const [quantityDrafts, setQuantityDrafts] = useState<Record<number, string>>({});
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);
  const checkoutSubmittingRef = useRef(false);
  const mountedRef = useRef(true);
  const cartSnapshotRequestRef = useRef(0);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const paymentReturnStatus = String(searchParams.get('payment') || '').trim().toLowerCase();
  const paymentReturnOrderNo = String(searchParams.get('orderNo') || searchParams.get('order') || '').trim();
  const paymentReturnIncomplete = paymentReturnStatus === 'cancelled'
    || paymentReturnStatus === 'canceled'
    || paymentReturnStatus === 'failed';
  const clearPaymentReturnParams = useCallback(() => {
    if (!searchParams.has('payment') && !searchParams.has('orderNo') && !searchParams.has('order') && !searchParams.has('orderId')) {
      return;
    }
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('payment');
    nextParams.delete('orderNo');
    nextParams.delete('order');
    nextParams.delete('orderId');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);
  const { t, language } = useLanguage();
  usePageTitle(t('pages.cart.title'));
  useDocumentMeta({
    title: t('pages.cart.title'),
    description: t('common.siteDescription'),
    path: '/cart',
    type: 'website',
    noIndex: true,
    siteName: t('common.siteTitle'),
  });
  const { currency, market, formatMoney } = useMarket();
  const cartFetchErrorFallbackRef = useRef(t('pages.cart.fetchFailed'));
  const cartFetchErrorLanguageRef = useRef(language);
  const getCartItemName = useCallback((item: Pick<CartItem, 'productId' | 'productName'>) => (
    (item.productName || '').trim() || t('pages.profile.productFallback', { id: item.productId })
  ), [t]);
  const getCartProductName = useCallback((product: Pick<Product, 'id' | 'name'>) => (
    (product.name || '').trim() || t('pages.profile.productFallback', { id: product.id })
  ), [t]);
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

  useEffect(() => {
    cartFetchErrorFallbackRef.current = t('pages.cart.fetchFailed');
    cartFetchErrorLanguageRef.current = language;
  }, [language, t]);

  const fetchCartItems = useCallback(async () => {
    if (!mountedRef.current) return;
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
      return;
    }
    try {
      setLoadError(false);
      setLoadErrorMessage(null);
      const response = await cartApi.getItems(0);
      if (!mountedRef.current) return;
      const nextItems = normalizeCartItems(response.data);
      if (!isCurrentCartSnapshotRequest(requestId)) return;
      if (nextItems.length === 0) {
        resetCheckoutStateAfterCartMutation();
      }
      setCartItems(nextItems);
      setSelectedIds(nextItems.filter(canCheckout).map((item) => item.id));
    } catch (error: unknown) {
      if (!mountedRef.current) return;
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
      if (isCurrentCartSnapshotRequest(requestId)) setLoading(false);
    }
  }, [beginCartSnapshotRequest, isCurrentCartSnapshotRequest, resetCheckoutStateAfterCartMutation]);

  const isCartMounted = useCallback(() => mountedRef.current, []);
  const hasStaleCartData = loadError && cartItems.length > 0;

  const clearQuantityPendingState = useCallback((itemIds: number[]) => {
    if (!mountedRef.current || itemIds.length === 0) return;
    setUpdatingItemIds((ids) => ids.filter((id) => !itemIds.includes(id)));
  }, []);

  const setQuantityPending = useCallback((itemId: number, pending: boolean) => {
    if (!mountedRef.current) return;
    setUpdatingItemIds((ids) => (
      pending
        ? Array.from(new Set([...ids, itemId]))
        : ids.filter((id) => id !== itemId)
    ));
  }, []);

  const handleQuantitySyncError = useCallback(async (err: unknown) => {
    announceAccessibleMessage(getApiErrorMessage(err, t('pages.cart.quantityFailed'), language), 'error');
    try {
      await fetchCartItems();
    } catch (refreshError) {
      reportNonBlockingError('Cart.handleQuantitySyncError.fetchCartItems', refreshError);
    }
  }, [fetchCartItems, language, t]);

  const {
    cancelQuantitySync: cancelPendingQuantitySync,
    flushPendingQuantityUpdates,
    hasPendingQuantityTimer,
    scheduleQuantitySync,
  } = useCartQuantitySync({
    isMounted: isCartMounted,
    onQuantitySyncError: handleQuantitySyncError,
    setQuantityPending,
    clearQuantityPending: clearQuantityPendingState,
  });

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
  }, [cartItems]);

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
  }, [cartItems]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!conversionConfig.cartRecentlyViewed.enabled) return;
    let disposed = false;
    const loadRecentlyViewedProducts = async () => {
      const preferences = loadProductViewPreferences();
      if (preferences.recent.length === 0) {
        if (disposed || !mountedRef.current) return;
        setRecentProducts([]);
        return;
      }
      try {
        const recentIds = preferences.recent.slice(0, conversionConfig.cartRecentlyViewed.maxItems * 2);
        const cacheKey = `${language}|${recentIds.join(',')}`;
        const cachedProducts = getCachedRecentProducts(cacheKey);
        if (cachedProducts) {
          if (disposed || !mountedRef.current) return;
          setRecentProducts(cachedProducts);
          return;
        }
        const response = await productApi.getByIds(recentIds);
        if (disposed || !mountedRef.current) return;
        const productById = new Map(response.data.map((product) => [product.id, localizeProduct(product, language)]));
        const nextRecentProducts = preferences.recent
            .map((productId) => productById.get(productId))
            .filter((product): product is Product => Boolean(product))
            .filter((product) => product.stock === undefined || product.stock > 0)
            .slice(0, conversionConfig.cartRecentlyViewed.maxItems);
        setCachedRecentProducts(cacheKey, nextRecentProducts);
        setRecentProducts(nextRecentProducts);
      } catch (error) {
        reportNonBlockingError('Cart.loadRecentProducts', error);
        if (disposed || !mountedRef.current) return;
        setRecentProducts([]);
      }
    };
    loadRecentlyViewedProducts();
    window.addEventListener('shop:product-view-preferences-updated', loadRecentlyViewedProducts);
    return () => {
      disposed = true;
      window.removeEventListener('shop:product-view-preferences-updated', loadRecentlyViewedProducts);
    };
  }, [language]);

  useEffect(() => {
    const refreshSavedItems = () => setSavedItems(getSavedForLaterItemsSnapshot());
    const refreshCartStorage = (event: StorageEvent) => {
      const allStorageCleared = event.key === null;
      if (allStorageCleared || event.key === SAVE_FOR_LATER_STORAGE_KEY) {
        refreshSavedItems();
      }
      if ((!allStorageCleared && event.key !== 'shop-guest-cart') || getLocalStorageItem('token')) return;
      const guestItems = normalizeCartItems(getGuestCartItems());
      if (guestItems.length === 0) {
        resetCheckoutStateAfterCartMutation();
      }
      setCartItems(guestItems);
      setSelectedIds(guestItems.filter(canCheckout).map((item) => item.id));
      if (mountedRef.current) setLoading(false);
    };
    window.addEventListener('shop:save-for-later-updated', refreshSavedItems);
    window.addEventListener('storage', refreshCartStorage);
    return () => {
      window.removeEventListener('shop:save-for-later-updated', refreshSavedItems);
      window.removeEventListener('storage', refreshCartStorage);
    };
  }, [resetCheckoutStateAfterCartMutation]);

  const updateQuantity = (item: CartItem, quantity: number) => {
    if (hasStaleCartData) return;
    const normalizedQuantity = normalizeCartQuantity(item, quantity);
    const authenticated = hasAuthenticatedCartSession();
    invalidateCartSnapshotRequests();
    setQuantityDrafts((drafts) => {
      if (!(item.id in drafts)) return drafts;
      const nextDrafts = { ...drafts };
      delete nextDrafts[item.id];
      return nextDrafts;
    });
    if (getCartLineQuantity(item.quantity) === normalizedQuantity && !hasPendingQuantityTimer(item.id)) return;
    if (!authenticated) {
      setCartItems(normalizeCartItems(updateGuestCartQuantity(item.id, normalizedQuantity)));
      return;
    }

    setCartItems((items) => normalizeCartItems(items).map((entry) => (entry.id === item.id ? { ...entry, quantity: normalizedQuantity } : entry)));
    scheduleQuantitySync(item.id, normalizedQuantity);
  };

  const renderQuantityControl = (item: CartItem) => {
    const itemName = getCartItemName(item);
    const quantityLabel = `${t('common.quantity')}: ${itemName}`;
    const decreaseLabel = `${t('pages.cart.decreaseQuantity')}: ${itemName}`;
    const increaseLabel = `${t('pages.cart.increaseQuantity')}: ${itemName}`;
    const limit = getCartQuantityLimit(item.stock);
    const syncing = updatingItemIds.includes(item.id);
    const disabled = hasStaleCartData || !isAvailable(item) || removingItemIds.includes(item.id) || checkoutSubmitting;
    const quantity = getCartLineQuantity(item.quantity);
    const quantityDraft = quantityDrafts[item.id];
    const quantityValue = quantityDraft ?? quantity;
    if (!isAvailable(item)) {
      const unavailableLabel = isCartItemStockOut(item.stock) ? t('pages.cart.outOfStock') : t('pages.cart.quantityUnavailable');
      return (
        <div
          className="cart-page__quantityStepper cart-page__quantityStepper--unavailable"
          role="status"
          aria-label={`${quantityLabel}: ${unavailableLabel}`}
          title={unavailableLabel}
        >
          <span className="cart-page__quantityUnavailable">{unavailableLabel}</span>
        </div>
      );
    }

    return (
      <div className="cart-page__quantityStepper" role="group" aria-label={quantityLabel} title={quantityLabel} aria-busy={syncing}>
        <ShopButton
          size="small"
          icon={<ShopIcon path={SI.minus} />}
          aria-label={decreaseLabel}
          title={decreaseLabel}
          disabled={disabled || quantity <= 1}
          onClick={() => updateQuantity(item, quantity - 1)}
        />
        <input
          className="cart-page__quantityInput"
          type="number"
          min={1}
          max={limit}
          step={1}
          inputMode="numeric"
          disabled={disabled}
          aria-label={quantityLabel}
          title={quantityLabel}
          value={quantityValue}
          onChange={(event) => {
            const nextValue = event.currentTarget.value;
            if (nextValue === '') {
              setQuantityDrafts((drafts) => ({ ...drafts, [item.id]: '' }));
              return;
            }
            updateQuantity(item, Math.floor(Number(nextValue) || 1));
          }}
          onBlur={() => {
            if (quantityDraft === '') {
              updateQuantity(item, 1);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && quantityDraft === '') {
              event.currentTarget.blur();
            }
          }}
        />
        <ShopButton
          size="small"
          icon={<ShopIcon path={SI.plus} />}
          aria-label={increaseLabel}
          title={increaseLabel}
          disabled={disabled || quantity >= limit}
          onClick={() => updateQuantity(item, quantity + 1)}
        />
      </div>
    );
  };

  const renderLineTotal = (item: CartItem) => (
    canCheckout(item)
      ? <span className="cart-page__text cart-page__text--strong cart-page__priceText commerce-money">{formatMoney(getLineTotal(item))}</span>
      : <span className="cart-page__text cart-page__text--danger cart-page__unavailableSubtotal">{t('pages.cart.quantityUnavailable')}</span>
  );

  const removeItem = async (itemId: number) => {
    if (hasStaleCartData) return;
    if (removingItemIds.includes(itemId)) return;
    invalidateCartSnapshotRequests();
    cancelPendingQuantitySync([itemId]);
    try {
      setRemovingItemIds((ids) => Array.from(new Set([...ids, itemId])));
      const authenticated = hasAuthenticatedCartSession();
      if (authenticated) {
        await cartApi.removeItem(itemId);
        if (!mountedRef.current) return;
        setCartItems((items) => normalizeCartItems(items).filter((item) => item.id !== itemId));
      } else {
        setCartItems(normalizeCartItems(removeGuestCartItem(itemId)));
      }
      announceAccessibleMessage(t('messages.deleteSuccess'), 'success');
      setSelectedIds((ids) => ids.filter((id) => id !== itemId));
      resetCheckoutStateAfterCartMutation();
      dispatchDomEvent('shop:cart-updated');
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      announceAccessibleMessage(getApiErrorMessage(err, t('messages.deleteFailed'), language), 'error');
    } finally {
      if (mountedRef.current) {
        setRemovingItemIds((ids) => ids.filter((id) => id !== itemId));
      }
    }
  };

  const saveForLater = async (item: CartItem) => {
    if (hasStaleCartData) return;
    if (removingItemIds.includes(item.id)) return;
    invalidateCartSnapshotRequests();
    cancelPendingQuantitySync([item.id]);
    const previousSavedItems = getSavedForLaterItemsSnapshot();
    const savedItem = saveCartItemForLater(item);
    if (!savedItem) {
      announceAccessibleMessage(t('messages.operationFailed'), 'error');
      return;
    }
    setSavedItems(getSavedForLaterItemsSnapshot());
    setRemovingItemIds((ids) => Array.from(new Set([...ids, item.id])));
    try {
      const authenticated = hasAuthenticatedCartSession();
      if (authenticated) {
        await cartApi.removeItem(item.id);
        if (!mountedRef.current) return;
        setCartItems((items) => normalizeCartItems(items).filter((cartItem) => cartItem.id !== item.id));
      } else {
        setCartItems(normalizeCartItems(removeGuestCartItem(item.id)));
      }
      setSelectedIds((ids) => ids.filter((id) => id !== item.id));
      resetCheckoutStateAfterCartMutation();
      announceAccessibleMessage(t('pages.cart.savedForLater'), 'success');
      dispatchDomEvent('shop:cart-updated');
    } catch (error: unknown) {
      replaceSavedForLaterItems(previousSavedItems);
      if (!mountedRef.current) return;
      setSavedItems(previousSavedItems);
      announceAccessibleMessage(getApiErrorMessage(error, t('messages.operationFailed'), language), 'error');
    } finally {
      if (mountedRef.current) {
        setRemovingItemIds((ids) => ids.filter((id) => id !== item.id));
      }
    }
  };

  const moveSavedItemToCart = async (item: SavedForLaterItem) => {
    if (hasStaleCartData) return;
    if (restoringSaved || restoringSavedItemIds.includes(item.id)) return;
    const cartSnapshotRequestId = invalidateCartSnapshotRequests();
    setRestoringSavedItemIds((ids) => Array.from(new Set([...ids, item.id])));
    try {
      const authenticated = hasAuthenticatedCartSession();
      if (authenticated) {
        await cartApi.addItem(0, item.productId, item.quantity, item.selectedSpecs);
        const response = await cartApi.getItems(0);
        if (!mountedRef.current) return;
        if (isCurrentCartSnapshotRequest(cartSnapshotRequestId)) {
          const nextItems = normalizeCartItems(response.data);
          setCartItems(nextItems);
          clearRecentProductsCache();
          setSelectedIds(nextItems.filter(canCheckout).map((cartItem) => cartItem.id));
        }
      } else {
        addGuestCartItem(
          {
            ...item,
            id: item.productId,
            name: getCartItemName(item),
            status: item.productStatus,
          },
          item.quantity,
          item.selectedSpecs,
          item.price,
        );
        const nextItems = normalizeCartItems(getGuestCartItems());
        setCartItems(nextItems);
        clearRecentProductsCache();
        setSelectedIds(nextItems.filter(canCheckout).map((cartItem) => cartItem.id));
      }
      removeSavedForLaterProduct(item.productId, item.selectedSpecs);
      setSavedItems(getSavedForLaterItemsSnapshot());
      announceAccessibleMessage(t('pages.cart.movedToCart'), 'success');
      if (authenticated) dispatchDomEvent('shop:cart-updated');
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      announceAccessibleMessage(getApiErrorMessage(err, t('messages.operationFailed'), language), 'error');
    } finally {
      if (mountedRef.current) {
        setRestoringSavedItemIds((ids) => ids.filter((id) => id !== item.id));
      }
    }
  };

  const moveSavedItemsToCart = async (items: SavedForLaterItem[]) => {
    if (hasStaleCartData) return;
    if (items.length === 0) return;
    const targetItems = items.slice(0, conversionConfig.saveForLater.maxBulkRestoreItems);
    const cartSnapshotRequestId = invalidateCartSnapshotRequests();
    setRestoringSaved(true);
    try {
      const authenticated = hasAuthenticatedCartSession();
      let restoredItems = targetItems;
      if (authenticated) {
        const results = await allSettledWithConcurrency(
          targetItems,
          (item) => cartApi.addItem(0, item.productId, item.quantity, item.selectedSpecs),
        );
        if (!mountedRef.current) return;
        restoredItems = targetItems.filter((_, index) => results[index].status === 'fulfilled');
        if (restoredItems.length === 0) {
          const failedResult = results.find((result) => result.status === 'rejected') as PromiseRejectedResult | undefined;
          announceAccessibleMessage(getApiErrorMessage(failedResult?.reason, t('messages.operationFailed'), language), 'error');
          return;
        }
        const response = await cartApi.getItems(0);
        if (!mountedRef.current) return;
        if (isCurrentCartSnapshotRequest(cartSnapshotRequestId)) {
          const nextItems = normalizeCartItems(response.data);
          setCartItems(nextItems);
          clearRecentProductsCache();
          setSelectedIds(nextItems.filter(canCheckout).map((cartItem) => cartItem.id));
        }
      } else {
        targetItems.forEach((item) => {
          addGuestCartItem(
            {
              ...item,
              id: item.productId,
              name: getCartItemName(item),
              status: item.productStatus,
            },
            item.quantity,
            item.selectedSpecs,
            item.price,
          );
        });
        const nextItems = normalizeCartItems(getGuestCartItems());
        setCartItems(nextItems);
        clearRecentProductsCache();
        setSelectedIds(nextItems.filter(canCheckout).map((cartItem) => cartItem.id));
      }
      restoredItems.forEach((item) => removeSavedForLaterProduct(item.productId, item.selectedSpecs));
      setSavedItems(getSavedForLaterItemsSnapshot());
      if (restoredItems.length === targetItems.length) {
        announceAccessibleMessage(t('pages.cart.movedSavedBatch', { count: restoredItems.length }), 'success');
      } else {
        announceAccessibleMessage(t('pages.cart.movedSavedBatchPartial', { count: restoredItems.length, failed: targetItems.length - restoredItems.length }), 'warning');
      }
      if (authenticated) dispatchDomEvent('shop:cart-updated');
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      announceAccessibleMessage(getApiErrorMessage(err, t('messages.operationFailed'), language), 'error');
    } finally {
      if (mountedRef.current) setRestoringSaved(false);
    }
  };

  const removeSavedItem = (itemId: number) => {
    setSavedItems(normalizeSavedForLaterItems(removeSavedForLaterItem(itemId)));
    announceAccessibleMessage(t('messages.deleteSuccess'), 'success');
  };

  const removeItems = async (itemIds: number[], successMessage: string) => {
    if (hasStaleCartData) return;
    if (itemIds.length === 0) return;
    const normalizedIds = Array.from(new Set(itemIds));
    invalidateCartSnapshotRequests();
    cancelPendingQuantitySync(normalizedIds);
    try {
      setRemovingItemIds((ids) => Array.from(new Set([...ids, ...normalizedIds])));
      const authenticated = hasAuthenticatedCartSession();
      if (authenticated) {
        await cartApi.removeItems(normalizedIds);
        if (!mountedRef.current) return;
        setCartItems((items) => normalizeCartItems(items).filter((item) => !normalizedIds.includes(item.id)));
      } else {
        setCartItems(normalizeCartItems(removeGuestCartItems(normalizedIds)));
      }
      setSelectedIds((ids) => ids.filter((id) => !normalizedIds.includes(id)));
      resetCheckoutStateAfterCartMutation();
      announceAccessibleMessage(successMessage, 'success');
      dispatchDomEvent('shop:cart-updated');
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      announceAccessibleMessage(getApiErrorMessage(err, t('messages.deleteFailed'), language), 'error');
    } finally {
      if (mountedRef.current) {
        setRemovingItemIds((ids) => ids.filter((id) => !normalizedIds.includes(id)));
      }
    }
  };

  const cartCheckoutMetrics = useMemo(() => deriveCartCheckoutMetrics(cartItems, selectedIds), [cartItems, selectedIds]);
  const {
    checkoutBlocked,
    purchasableItems,
    purchasableUnitCount,
    selectedItems,
    selectedPurchasableCount,
    selectedTotal,
    selectedUnitCount,
    unavailableItems,
  } = cartCheckoutMetrics;
  const savedReminderItems = useMemo(
    () => savedItems.filter((item) => getSavedAgeDays(item.savedAt) >= conversionConfig.saveForLater.reminderAfterDays),
    [savedItems],
  );
  const showRecentlyViewedRecovery = recentProducts.length > 0 && (cartItems.length === 0 || purchasableItems.length === 0);

  const freeShippingThreshold = market.freeShippingThreshold;
  const {
    freeShippingRemaining,
    freeShippingUnlocked,
    benefitTarget,
    giftUnlocked,
    freeShippingPercent,
  } = useMemo(() => {
    const nextShippingSummary = deriveCartShippingSummary(selectedItems, freeShippingThreshold, selectedTotal);
    const freeShippingUnlocked = nextShippingSummary.freeShippingUnlocked;
    return {
      shippingSummary: nextShippingSummary,
      freeShippingRemaining: nextShippingSummary.remainingAmount,
      freeShippingUnlocked,
      benefitTarget: getNearestCartBenefitTarget(
        selectedTotal,
        freeShippingUnlocked ? 0 : freeShippingThreshold,
        currency,
      ),
      giftUnlocked: isGiftUnlocked(selectedTotal, currency),
      freeShippingPercent: nextShippingSummary.progressPercent,
    };
  }, [currency, freeShippingThreshold, selectedItems, selectedTotal]);
  const allSelected = purchasableItems.length > 0 && selectedPurchasableCount === purchasableItems.length;
  const savedItemsTotal = useMemo(
    () => roundCartMoney(savedItems.reduce((sum, item) => sum + getLineTotal(item), 0)),
    [savedItems],
  );
  const toggleAll = (checked: boolean) => {
    if (hasStaleCartData) return;
    setSelectedIds(checked ? purchasableItems.map((item) => item.id) : []);
  };

  const toggleOne = (itemId: number, checked: boolean) => {
    if (hasStaleCartData) return;
    setSelectedIds((ids) => (checked ? Array.from(new Set([...ids, itemId])) : ids.filter((id) => id !== itemId)));
  };

  const goCheckout = useCallback(async () => {
    if (hasStaleCartData) {
      announceAccessibleMessage(t('pages.cart.staleDataWarning'), 'warning');
      return;
    }
    if (checkoutSubmittingRef.current) return;
    const checkoutItems = selectedItems.filter(canCheckout);
    if (checkoutItems.length === 0) {
      announceAccessibleMessage(t('pages.cart.chooseItems'), 'warning');
      return;
    }
    checkoutSubmittingRef.current = true;
    setCheckoutSubmitting(true);
    try {
      await flushPendingQuantityUpdates(checkoutItems);
      syncCheckoutCartItemIds(checkoutItems);
      removeSessionStorageItem('checkoutPaymentMethod');
      navigate('/checkout');
    } catch (error) {
      reportNonBlockingError('Cart.goCheckout', error);
      announceAccessibleMessage(t('pages.cart.checkoutSyncFailed'), 'warning');
      return;
    } finally {
      checkoutSubmittingRef.current = false;
      if (mountedRef.current) setCheckoutSubmitting(false);
    }
  }, [flushPendingQuantityUpdates, hasStaleCartData, navigate, selectedItems, t]);

  const removeSelectedItems = () => {
    if (hasStaleCartData) return;
    removeItems(selectedIds, t('pages.cart.removedSelected', { count: selectedIds.length }));
  };

  const clearUnavailableItems = () => {
    if (hasStaleCartData) return;
    removeItems(unavailableItems.map((item) => item.id), t('pages.cart.clearedUnavailable', { count: unavailableItems.length }));
  };

  const refreshCartItems = useCallback(() => {
    setLoading(true);
    fetchCartItems();
  }, [fetchCartItems]);

  const renderCartAmountText = (label: string, amount: string) => {
    const parts = label.split(amount);
    if (parts.length <= 1) return label;
    return (
      <span className="cart-page__amountPhrase commerce-atomic">
        {parts.map((part, index) => (
          <React.Fragment key={`${part}-${index}`}>
            {part}
            {index < parts.length - 1 ? <span className="commerce-money">{amount}</span> : null}
          </React.Fragment>
        ))}
      </span>
    );
  };

  const freeShippingRemainingText = (amount: number) => renderCartAmountText(
    t('pages.cart.freeShippingRemaining', { amount: formatMoney(amount) }),
    formatMoney(amount),
  );
  const savedValueText = renderCartAmountText(
    t('pages.cart.savedValueText', { count: savedItems.length, amount: formatMoney(savedItemsTotal) }),
    formatMoney(savedItemsTotal),
  );
  const freeShippingStatusTitle = freeShippingUnlocked
    ? t('pages.cart.freeShippingUnlocked')
    : freeShippingRemaining > 0
      ? freeShippingRemainingText(freeShippingRemaining)
      : t('pages.cart.shippingCalculatedAtCheckout');
  const freeShippingGapTitle = freeShippingUnlocked
    ? t('pages.cart.freeShippingUnlocked')
    : freeShippingRemaining > 0
      ? renderCartAmountText(t('pages.cart.readinessFreeShippingGap', { amount: formatMoney(freeShippingRemaining) }), formatMoney(freeShippingRemaining))
      : t('pages.cart.shippingCalculatedAtCheckout');
  const freeShippingProgressText = freeShippingUnlocked
    ? t('pages.cart.freeShippingUnlocked')
    : `${freeShippingPercent}%`;

  const cartNextAction = (() => {
    if (hasStaleCartData) {
      return {
        key: 'refresh',
        tone: 'warning',
        title: t('pages.cart.nextActionRefreshTitle'),
        text: t('pages.cart.nextActionRefreshText'),
        label: t('messages.retry'),
        action: refreshCartItems,
      };
    }
    if (unavailableItems.length > 0) {
      return {
        key: 'clear',
        tone: 'warning',
        title: t('pages.cart.nextActionClearTitle'),
        text: t('pages.cart.nextActionClearText', { count: unavailableItems.length }),
        label: t('pages.cart.clearUnavailable'),
        action: clearUnavailableItems,
      };
    }
    if (selectedItems.length === 0 && purchasableItems.length > 0) {
      return {
        key: 'select',
        tone: 'warning',
        title: t('pages.cart.nextActionSelectTitle'),
        text: t('pages.cart.nextActionSelectText', { count: purchasableUnitCount }),
        label: t('pages.cart.selectCheckoutReady'),
        action: () => toggleAll(true),
      };
    }
    if (selectedItems.some(canCheckout)) {
      return {
        key: 'checkout',
        tone: 'ready',
        title: t('pages.cart.nextActionCheckoutTitle'),
        text: renderCartAmountText(t('pages.cart.nextActionCheckoutText', { amount: formatMoney(selectedTotal) }), formatMoney(selectedTotal)),
        label: t('pages.cart.checkout'),
        action: goCheckout,
      };
    }
    if (selectedItems.length > 0 && benefitTarget) {
      return {
        key: benefitTarget.reason,
        tone: 'warm',
        title: benefitTarget.reason === 'gift'
          ? t('pages.cart.nextActionGiftTitle')
          : t('pages.cart.nextActionShippingTitle'),
        text: benefitTarget.reason === 'gift'
          ? renderCartAmountText(t('pages.cart.nextActionGiftText', { amount: formatMoney(benefitTarget.remainingAmount) }), formatMoney(benefitTarget.remainingAmount))
          : renderCartAmountText(t('pages.cart.nextActionShippingText', { amount: formatMoney(benefitTarget.remainingAmount) }), formatMoney(benefitTarget.remainingAmount)),
        label: t('pages.cart.nextActionFindAddOn'),
        action: () => {
          document.getElementById('cart-add-on-assistant')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        },
      };
    }
    if (savedReminderItems.length > 0) {
      return {
        key: 'saved',
        tone: 'warm',
        title: t('pages.cart.nextActionSavedTitle'),
        text: t('pages.cart.nextActionSavedText', { count: savedReminderItems.length }),
        label: t('pages.cart.restoreReminder'),
        action: () => moveSavedItemsToCart(savedReminderItems),
      };
    }
    return {
      key: 'checkout',
      tone: 'ready',
      title: t('pages.cart.nextActionCheckoutTitle'),
      text: renderCartAmountText(t('pages.cart.nextActionCheckoutText', { amount: formatMoney(selectedTotal) }), formatMoney(selectedTotal)),
      label: t('pages.cart.checkout'),
      action: goCheckout,
    };
  })();
  const cartHeroHighlights = [
    {
      key: 'total',
      title: t('common.total'),
      text: formatMoney(selectedTotal),
    },
    {
      key: 'shipping',
      title: freeShippingStatusTitle,
      text: freeShippingProgressText,
    },
    {
      key: 'saved',
      title: t('pages.cart.saveForLaterTitle'),
      text: savedValueText,
    },
  ];
  const cartSummaryCards = [
    {
      key: 'selected',
      title: t('pages.cart.selectedSummary', { count: selectedUnitCount }),
      text: formatMoney(selectedTotal),
    },
    {
      key: 'shipping',
      title: freeShippingGapTitle,
      text: freeShippingProgressText,
    },
    {
      key: 'saved',
      title: t('pages.cart.saveForLaterTitle'),
      text: `${savedItems.length}`,
    },
  ];
  const retryCartLoadActionLabel = `${t('messages.retry')}: ${t('pages.cart.fetchFailed')}`;
  const emptyBrowseActionLabel = `${t('pages.cart.browse')}: ${t('pages.cart.empty')}`;
  const emptyCouponsActionLabel = `${t('nav.coupons')}: ${t('pages.cart.empty')}`;
  const emptyPetFinderActionLabel = `${t('nav.petFinder')}: ${t('pages.cart.empty')}`;
  const emptyHistoryActionLabel = `${t('nav.history')}: ${t('pages.cart.recentRecoveryTitle')}`;
  const cartNextActionLabel = `${cartNextAction.label}: ${cartNextAction.title}`;
  const cartTopNextActionLabel = `${t('pages.cart.nextActionEyebrow')}: ${cartNextActionLabel}`;
  const browseAllProductsActionLabel = `${t('pages.cart.browse')}: ${t('pages.productList.allCategories')}`;
  const recentRecoveryBrowseActionLabel = `${t('pages.cart.browse')}: ${t('pages.cart.recentRecoveryTitle')}`;
  const deleteSelectedActionLabel = `${t('pages.cart.deleteSelected')}: ${t('pages.cart.selectedSummary', { count: selectedIds.length })}`;
  const clearUnavailableActionLabel = `${t('pages.cart.clearUnavailable')}: ${t('pages.cart.blockedItems', { count: unavailableItems.length })}`;
  const selectReadyActionLabel = `${t('pages.cart.selectCheckoutReady')}: ${t('pages.cart.readyItems', { count: purchasableItems.length })}`;
  const checkoutActionLabel = `${t('pages.cart.checkout')}: ${t('pages.cart.selectedSummary', { count: selectedUnitCount })}, ${formatMoney(selectedTotal)}`;
  const moveAllSavedActionLabel = `${t('pages.cart.moveAllToCart')}: ${t('pages.cart.saveForLaterTitle')} (${savedItems.length})`;
  const restoreSavedReminderActionLabel = `${t('pages.cart.restoreReminder')}: ${t('pages.cart.savedReminderTitle', { count: savedReminderItems.length })}`;

  const addSuggestedProduct = async (product: Product) => {
    if (hasStaleCartData) {
      throw new Error(t('pages.cart.staleDataWarning'));
    }
    const productId = normalizePositiveProductId(product.id);
    if (productId === null) {
      throw new Error(t('messages.addFailed'));
    }
    const cartSnapshotRequestId = invalidateCartSnapshotRequests();
    const productWithSafeId = { ...product, id: productId };
    const authenticated = hasAuthenticatedCartSession();
    if (authenticated) {
      await cartApi.addItem(0, productId, 1);
      const response = await cartApi.getItems(0);
      if (!mountedRef.current) return;
      clearRecentProductsCache();
      if (isCurrentCartSnapshotRequest(cartSnapshotRequestId)) {
        const nextItems = normalizeCartItems(response.data);
        setCartItems(nextItems);
        const addedItemIds = nextItems
          .filter((item) => item.productId === productId && canCheckout(item))
          .map((item) => item.id);
        setSelectedIds((ids) => Array.from(new Set([...ids, ...addedItemIds])));
      }
      dispatchDomEvent('shop:cart-updated');
      return;
    }
    const addedItem = addGuestCartItem(productWithSafeId, 1);
    if (!addedItem) {
      throw new Error(t('messages.addFailed'));
    }
    const nextItems = normalizeCartItems(getGuestCartItems());
    setCartItems(nextItems);
    clearRecentProductsCache();
    const addedItemIds = nextItems
      .filter((item) => item.productId === productId && canCheckout(item))
      .map((item) => item.id);
    setSelectedIds((ids) => Array.from(new Set([...ids, ...addedItemIds])));
    dispatchDomEvent('shop:cart-updated');
  };

  const addRecentProduct = async (product: Product) => {
    if (needsOptionSelection(product)) {
      navigate(`/products/${product.id}`);
      return;
    }
    setAddingRecentId(product.id);
    try {
      await addSuggestedProduct(product);
      announceAccessibleMessage(t('messages.addCartSuccess'), 'success');
    } catch (err: unknown) {
      announceAccessibleMessage(getApiErrorMessage(err, t('messages.addFailed'), language), 'error');
    } finally {
      setAddingRecentId(null);
    }
  };

  const paymentCancelledResumeLabel = paymentReturnOrderNo
    ? `${t('pages.cart.paymentCancelledResume')}: ${paymentReturnOrderNo}`
    : t('pages.cart.paymentCancelledResume');
  const paymentCancelledTrackLabel = paymentReturnOrderNo
    ? `${t('pages.cart.paymentCancelledTrack')}: ${paymentReturnOrderNo}`
    : t('pages.cart.paymentCancelledTrack');
  const paymentCancelledCheckoutLabel = t('pages.cart.checkout');

  const paymentReturnBanner = paymentReturnIncomplete ? (
        <ShopAlert
          className="cart-page__paymentReturn"
          type={paymentReturnStatus === 'failed' ? 'error' : 'warning'}
          showIcon
          closable
          role="alert"
          aria-live="assertive"
          onClose={clearPaymentReturnParams}
          message={paymentReturnStatus === 'failed'
            ? t('pages.cart.paymentFailedTitle')
            : t('pages.cart.paymentCancelledTitle')}
          description={paymentReturnOrderNo
            ? t(
              paymentReturnStatus === 'failed'
                ? 'pages.cart.paymentFailedOrderText'
                : 'pages.cart.paymentCancelledOrderText',
              { orderNo: paymentReturnOrderNo },
            )
            : t(
              paymentReturnStatus === 'failed'
                ? 'pages.cart.paymentFailedText'
                : 'pages.cart.paymentCancelledText',
            )}
          action={(
            <div className="cart-page__paymentReturnActions">
              <ShopButton
                type="primary"
                size="small"
                aria-label={paymentCancelledResumeLabel}
                title={paymentCancelledResumeLabel}
                onClick={() => {
                  clearPaymentReturnParams();
                  navigate(paymentReturnOrderNo
                    ? `/profile?tab=orders&orderNo=${encodeURIComponent(paymentReturnOrderNo)}`
                    : '/profile?tab=orders');
                }}
              >
                {t('pages.cart.paymentCancelledResume')}
              </ShopButton>
              {paymentReturnOrderNo ? (
                <ShopButton
                  size="small"
                  aria-label={paymentCancelledTrackLabel}
                  title={paymentCancelledTrackLabel}
                  onClick={() => {
                    clearPaymentReturnParams();
                    navigate(`/track-order?orderNo=${encodeURIComponent(paymentReturnOrderNo)}`);
                  }}
                >
                  {t('pages.cart.paymentCancelledTrack')}
                </ShopButton>
              ) : null}
              {cartItems.length > 0 ? (
                <ShopButton
                  size="small"
                  aria-label={paymentCancelledCheckoutLabel}
                  title={paymentCancelledCheckoutLabel}
                  onClick={() => {
                    clearPaymentReturnParams();
                    navigate('/checkout');
                  }}
                >
                  {t('pages.cart.checkout')}
                </ShopButton>
              ) : (
                <ShopButton
                  size="small"
                  aria-label={t('pages.cart.browse')}
                  title={t('pages.cart.browse')}
                  onClick={() => {
                    clearPaymentReturnParams();
                    navigate('/products');
                  }}
                >
                  {t('pages.cart.browse')}
                </ShopButton>
              )}
            </div>
          )}
        />
      ) : null;

  if (loading) {
    return (
      <div className={`cart-page cart-page--${language}`} role="status" aria-live="polite" aria-busy="true" aria-label={t('common.loading')}>
        <section className="cart-page__hero">
          <div className="cart-page__heroContent">
            <span className="cart-page__heroEyebrow">{t('pages.cart.nextActionEyebrow')}</span>
            <h1 className="cart-page__title">{t('pages.cart.title')}</h1>
            <div className="cart-page__loadingText shimmer" aria-hidden="true" />
            <div className="cart-page__heroActions" aria-hidden="true">
              <div className="cart-page__loadingAction shimmer" />
              <div className="cart-page__loadingAction cart-page__loadingAction--secondary shimmer" />
            </div>
          </div>
          <div className="cart-page__heroStats" aria-hidden="true">
            {[1, 2, 3].map(i => <div key={i} className="cart-page__loadingStat shimmer" />)}
          </div>
        </section>
        <section className="cart-page__summaryStrip" aria-hidden="true">
          <StatsStripSkeleton cols={3} />
        </section>
        <div className="cart-page__loadingProducts" aria-hidden="true">
          <ProductCardSkeleton count={6} />
        </div>
      </div>
    );
  }

  if (!loading && loadError && cartItems.length === 0) {
    return (
      <div className={`cart-page cart-page--empty cart-page--${language}`}>
        <ShopBreadcrumb
          ariaLabel={t('pages.cart.title')}
          items={[
            { key: 'home', label: t('nav.ariaHome'), path: '/' },
            { key: 'products', label: t('pages.productList.title'), path: '/products' },
            { key: 'cart', label: t('pages.cart.title') },
          ]}
        />
        {paymentReturnBanner}
        <section className="cart-page__hero cart-page__hero--recovery">
          <div className="cart-page__heroContent">
            <span className="cart-page__heroEyebrow">{t('pages.cart.nextActionEyebrow')}</span>
            <h1 className="cart-page__title">{t('pages.cart.title')}</h1>
          </div>
        </section>
        <div data-cart-load-recovery="true">
          <PageError
            className="cart-page__loadError"
            title={t('messages.loadFailed')}
            description={loadErrorMessage || t('pages.cart.fetchFailed')}
            actions={[
              {
                key: 'retry',
                label: retryCartLoadActionLabel,
                onClick: () => { setLoading(true); fetchCartItems(); },
                type: 'primary',
              },
              {
                key: 'browse',
                label: t('pages.cart.browse'),
                onClick: () => navigate('/products'),
                type: 'default',
              },
              {
                key: 'coupons',
                label: t('pages.productList.loadRecoveryCoupons'),
                onClick: () => navigate('/coupons'),
                type: 'default',
              },
              {
                key: 'history',
                label: t('nav.history'),
                onClick: () => navigate('/history'),
                type: 'default',
              },
              {
                key: 'support',
                label: t('pages.productList.loadRecoverySupport'),
                onClick: () => dispatchDomEvent('shop:open-support'),
                type: 'default',
              },
            ]}
          />
        </div>
      </div>
    );
  }

  if (!loading && cartItems.length === 0 && savedItems.length === 0 && recentProducts.length === 0) {
    return (
      <div className={`cart-page cart-page--empty cart-page--${language}`}>
        <ShopBreadcrumb
          ariaLabel={t('pages.cart.title')}
          items={[
            { key: 'home', label: t('nav.ariaHome'), path: '/' },
            { key: 'products', label: t('pages.productList.title'), path: '/products' },
            { key: 'cart', label: t('pages.cart.title') },
          ]}
        />
        {paymentReturnBanner}
        <section className="cart-page__emptyHero" aria-label={t('pages.cart.empty')}>
          <span className="cart-page__emptyIcon">
            <ShopIcon path={SI.cart} />
          </span>
          <div className="cart-page__emptyCopy">
            <span className="cart-page__emptyEyebrow">{t('pages.cart.yourCart')}</span>
            <h1 className="cart-page__title">{t('pages.cart.empty')}</h1>
            <span className="cart-page__text">{t('pages.cart.recentRecoverySubtitle')}</span>
          </div>
          <div className="cart-page__emptyActions" data-cart-empty-actions="true">
            <ShopButton type="primary" icon={<ShopIcon path={SI.shopping} />} aria-label={emptyBrowseActionLabel} title={emptyBrowseActionLabel} onClick={() => navigate('/products')}>
              {t('pages.cart.browse')}
            </ShopButton>
            <ShopButton icon={<ShopIcon path={SI.shopping} />} aria-label={emptyCouponsActionLabel} title={emptyCouponsActionLabel} onClick={() => navigate('/coupons')}>
              {t('nav.coupons')}
            </ShopButton>
            <ShopButton icon={<ShopIcon path={SI.shopping} />} aria-label={emptyPetFinderActionLabel} title={emptyPetFinderActionLabel} onClick={() => navigate('/pet-finder')}>
              {t('nav.petFinder')}
            </ShopButton>
            <ShopButton icon={<ShopIcon path={SI.clock} />} aria-label={emptyHistoryActionLabel} title={emptyHistoryActionLabel} onClick={() => navigate('/history')}>
              {t('nav.history')}
            </ShopButton>
          </div>
          <div className="cart-page__emptySignals">
            <span className="cart-page__emptySignal">
              <ShopIcon path={SI.check} />
              <span className="cart-page__emptySignalText">
                {freeShippingThreshold > 0
                  ? t('pages.cart.freeShippingRemaining', { amount: formatMoney(freeShippingThreshold) })
                  : t('pages.cart.shippingCalculatedAtCheckout')}
              </span>
            </span>
            <span className="cart-page__emptySignal">
              <ShopIcon path={SI.clock} />
              <span className="cart-page__emptySignalText">{t('pages.cart.saveForLaterTitle')}</span>
            </span>
            <span className="cart-page__emptySignal">
              <ShopIcon path={SI.shopping} />
              <span className="cart-page__emptySignalText">{t('pages.cart.recentRecoveryTitle')}</span>
            </span>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={`cart-page cart-page--${language}`}>
      <ShopBreadcrumb
        ariaLabel={t('pages.cart.title')}
        items={[
          { key: 'home', label: t('nav.ariaHome'), path: '/' },
          { key: 'products', label: t('pages.productList.title'), path: '/products' },
          { key: 'cart', label: t('pages.cart.title') },
        ]}
      />
      {paymentReturnBanner}
      <section className="cart-page__hero">
        <div className="cart-page__heroContent">
          <span className="cart-page__heroEyebrow">{t('pages.cart.nextActionEyebrow')}</span>
          <h1 className="cart-page__title">{t('pages.cart.title')}</h1>
          <span className="cart-page__text">{cartItems.length > 0 ? cartNextAction.text : t('pages.cart.empty')}</span>
          <div className="cart-page__heroActions">
            {cartItems.length > 0 && cartNextAction.key === 'clear' ? (
              <ShopPopconfirm
                rootClassName='shop-mobile-popup-layer cart-page-popconfirm'
                title={t('pages.cart.clearUnavailableConfirm', { count: unavailableItems.length })}
                onConfirm={cartNextAction.action}
                okText={cartNextAction.label}
                cancelText={t('common.cancel')}
                okButtonProps={{ danger: true, 'aria-label': cartNextActionLabel, title: cartNextActionLabel }}
                cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${cartNextActionLabel}`, title: `${t('common.cancel')}: ${cartNextActionLabel}` }}
              >
                <ShopButton type="primary" aria-label={cartNextActionLabel} title={cartNextActionLabel}>
                  {cartNextAction.label}
                </ShopButton>
              </ShopPopconfirm>
            ) : (
              <ShopButton
                type={cartItems.length > 0 ? 'primary' : 'default'}
                icon={cartNextAction.key === 'refresh' ? <ShopIcon path={SI.reload} /> : undefined}
                aria-label={cartItems.length > 0 ? cartTopNextActionLabel : emptyBrowseActionLabel}
                title={cartItems.length > 0 ? cartTopNextActionLabel : emptyBrowseActionLabel}
                onClick={cartItems.length > 0 ? cartNextAction.action : () => navigate('/products')}
              >
                {cartItems.length > 0 ? cartNextAction.label : t('pages.cart.browse')}
              </ShopButton>
            )}
            <ShopButton
              aria-label={cartItems.length > 0 ? browseAllProductsActionLabel : emptyCouponsActionLabel}
              title={cartItems.length > 0 ? browseAllProductsActionLabel : emptyCouponsActionLabel}
              onClick={() => navigate(cartItems.length > 0 ? '/products' : '/coupons')}
            >
              {cartItems.length > 0 ? t('pages.cart.browse') : t('nav.coupons')}
            </ShopButton>
            {cartItems.length === 0 ? (
              <>
                <ShopButton
                  icon={<ShopIcon path={SI.shopping} />}
                  aria-label={emptyPetFinderActionLabel}
                  title={emptyPetFinderActionLabel}
                  onClick={() => navigate('/pet-finder')}
                >
                  {t('nav.petFinder')}
                </ShopButton>
                <ShopButton
                  icon={<ShopIcon path={SI.clock} />}
                  aria-label={emptyHistoryActionLabel}
                  title={emptyHistoryActionLabel}
                  onClick={() => navigate('/history')}
                >
                  {t('nav.history')}
                </ShopButton>
              </>
            ) : null}
          </div>
        </div>
        <div className="cart-page__heroStats">
          {cartHeroHighlights.map((item) => (
            <article key={item.key} className="cart-page__heroStat">
              <strong>{item.title}</strong>
              <span>{item.text}</span>
            </article>
          ))}
        </div>
      </section>
      <section className="cart-page__summaryStrip">
        {cartSummaryCards.map((item) => (
          <article key={item.key} className="cart-page__summaryStripCard">
            <strong>{item.title}</strong>
            <span>{item.text}</span>
          </article>
        ))}
      </section>
      {hasStaleCartData ? (
        <ShopAlert
          className="cart-page__loadErrorAlert"
          type="warning"
          showIcon
          role="alert"
          aria-live="assertive"
          message={t('pages.cart.staleDataTitle')}
          description={loadErrorMessage || t('pages.cart.staleDataWarning')}
          action={
            <ShopButton type="primary" icon={<ShopIcon path={SI.reload} />} aria-label={retryCartLoadActionLabel} title={retryCartLoadActionLabel} onClick={refreshCartItems}>
              {t('messages.retry')}
            </ShopButton>
          }
        />
      ) : null}
      {showRecentlyViewedRecovery ? (
        <section className="cart-page__recentRecovery" aria-label={t('pages.cart.recentRecoveryTitle')}>
          <div className="cart-page__recentRecoveryHeader">
            <div>
              <span className="cart-page__text cart-page__text--strong">{t('pages.cart.recentRecoveryTitle')}</span>
              <span className="cart-page__text cart-page__text--secondary">{t('pages.cart.recentRecoverySubtitle')}</span>
            </div>
            <ShopButton size="small" aria-label={recentRecoveryBrowseActionLabel} title={recentRecoveryBrowseActionLabel} onClick={() => navigate('/products')}>{t('pages.cart.browse')}</ShopButton>
          </div>
          <div className="cart-page__recentGrid">
            {recentProducts.map((product) => {
              const productName = getCartProductName(product);
              const recentLinkLabel = `${t('pages.productList.viewPick')}: ${productName}`;
              const recentActionText = needsOptionSelection(product) ? t('pages.wishlist.selectOptions') : t('pages.cart.recentAddToCart');
              const recentActionLabel = `${recentActionText}: ${productName}`;
              return (
                <article
                  key={product.id}
                  className="cart-page__recentItem"
                >
                  <button type="button" className="cart-page__recentLink" aria-label={recentLinkLabel} title={recentLinkLabel} onClick={() => navigate(`/products/${product.id}`)}>
                    <img
                      src={resolveCartImage(product.imageUrl)}
                      alt={productName}
                      loading="lazy"
                      decoding="async"
                      onError={(event) => {
                        if (event.currentTarget.src !== cartImageFallback) {
                          event.currentTarget.src = cartImageFallback;
                        }
                      }}
                    />
                    <span>
                      <span className="cart-page__text cart-page__text--strong">{productName}</span>
                      <span className="cart-page__text cart-page__text--secondary commerce-money">{formatMoney(product.effectivePrice ?? product.price)}</span>
                    </span>
                  </button>
                  <ShopButton
                    size="small"
                    type={needsOptionSelection(product) ? 'default' : 'primary'}
                    icon={<ShopIcon path={SI.cart} />}
                    loading={addingRecentId === product.id}
                    disabled={hasStaleCartData}
                    aria-label={recentActionLabel}
                    title={recentActionLabel}
                    onClick={() => addRecentProduct(product)}
                  >
                    {recentActionText}
                  </ShopButton>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
      {cartItems.length > 0 ? (
        <>
          <section className="cart-page__bulkActions" aria-label={t('pages.cart.chooseItems')}>
            <div className="cart-page__bulkActionsRow">
              <ShopPopconfirm
                rootClassName='shop-mobile-popup-layer cart-page-popconfirm'
                title={t('pages.cart.deleteSelectedConfirm', { count: selectedIds.length })}
                disabled={hasStaleCartData || selectedIds.length === 0}
                onConfirm={removeSelectedItems}
                okText={t('common.confirm')}
                cancelText={t('common.cancel')}
                okButtonProps={{ danger: true, 'aria-label': deleteSelectedActionLabel, title: deleteSelectedActionLabel }}
                cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${deleteSelectedActionLabel}`, title: `${t('common.cancel')}: ${deleteSelectedActionLabel}` }}
              >
                <ShopButton
                  danger
                  icon={<ShopIcon path={SI.delete} />}
                  disabled={hasStaleCartData || selectedIds.length === 0}
                  loading={selectedIds.some((id) => removingItemIds.includes(id))}
                  aria-label={deleteSelectedActionLabel}
                  title={deleteSelectedActionLabel}
                >
                  {t('pages.cart.deleteSelected')}
                </ShopButton>
              </ShopPopconfirm>
              <ShopPopconfirm
                rootClassName='shop-mobile-popup-layer cart-page-popconfirm'
                title={t('pages.cart.clearUnavailableConfirm', { count: unavailableItems.length })}
                disabled={hasStaleCartData || unavailableItems.length === 0}
                onConfirm={clearUnavailableItems}
                okText={t('common.confirm')}
                cancelText={t('common.cancel')}
                okButtonProps={{ danger: true, 'aria-label': clearUnavailableActionLabel, title: clearUnavailableActionLabel }}
                cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${clearUnavailableActionLabel}`, title: `${t('common.cancel')}: ${clearUnavailableActionLabel}` }}
              >
                <ShopButton
                  disabled={hasStaleCartData || unavailableItems.length === 0}
                  loading={unavailableItems.some((item) => removingItemIds.includes(item.id))}
                  aria-label={clearUnavailableActionLabel}
                  title={clearUnavailableActionLabel}
                >
                  {t('pages.cart.clearUnavailable')}
                </ShopButton>
              </ShopPopconfirm>
              <span className="cart-page__text cart-page__text--secondary">{t('pages.cart.unavailableSummary', { count: unavailableItems.length })}</span>
            </div>
          </section>
          <div className={checkoutBlocked ? 'cart-page__readiness cart-page__readiness--warning' : 'cart-page__readiness'}>
            <div className="cart-page__readinessIntro">
              {checkoutBlocked ? <ShopIcon path={SI.exclamation} /> : <ShopIcon path={SI.check} />}
              <div>
                <span className="cart-page__text cart-page__text--strong">{checkoutBlocked ? t('pages.cart.readinessNeedsAction') : t('pages.cart.readinessReady')}</span>
                <span className="cart-page__text cart-page__text--secondary">
                  {t('pages.cart.readinessSubtitle', {
                    selected: selectedUnitCount,
                    available: purchasableUnitCount,
                  })}
                </span>
              </div>
            </div>
            <div className="cart-page__readinessStats">
              <ShopTag color="green">{t('pages.cart.readyItems', { count: selectedPurchasableCount })}</ShopTag>
              <ShopTag color={unavailableItems.length > 0 ? 'red' : 'default'}>{t('pages.cart.blockedItems', { count: unavailableItems.length })}</ShopTag>
              <ShopTag color={freeShippingUnlocked ? 'green' : freeShippingRemaining > 0 ? 'orange' : 'default'}>
                {freeShippingGapTitle}
              </ShopTag>
              {giftUnlocked ? (
                <ShopTag color="green">{t('pages.cart.drawerGiftUnlocked')}</ShopTag>
              ) : null}
            </div>
            <div className="cart-page__readinessActions">
              <ShopButton
                size="small"
                aria-label={selectReadyActionLabel}
                title={selectReadyActionLabel}
                onClick={() => toggleAll(true)}
                disabled={hasStaleCartData || purchasableItems.length === 0 || allSelected}
              >
                {t('pages.cart.selectCheckoutReady')}
              </ShopButton>
              {unavailableItems.length > 0 ? (
                <ShopPopconfirm
                  rootClassName='shop-mobile-popup-layer cart-page-popconfirm'
                  title={t('pages.cart.clearUnavailableConfirm', { count: unavailableItems.length })}
                  disabled={hasStaleCartData}
                  onConfirm={clearUnavailableItems}
                  okText={t('common.confirm')}
                  cancelText={t('common.cancel')}
                  okButtonProps={{ danger: true, 'aria-label': clearUnavailableActionLabel, title: clearUnavailableActionLabel }}
                  cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${clearUnavailableActionLabel}`, title: `${t('common.cancel')}: ${clearUnavailableActionLabel}` }}
                >
                  <ShopButton
                    size="small"
                    disabled={hasStaleCartData}
                    loading={unavailableItems.some((item) => removingItemIds.includes(item.id))}
                    aria-label={clearUnavailableActionLabel}
                    title={clearUnavailableActionLabel}
                  >
                    {t('pages.cart.clearUnavailable')}
                  </ShopButton>
                </ShopPopconfirm>
              ) : null}
            </div>
          </div>
          {cartNextAction.tone !== 'ready' ? (
            <div className={`cart-page__nextAction cart-page__nextAction--${cartNextAction.tone}`}>
              <span>
                <span className="cart-page__text cart-page__text--secondary">{t('pages.cart.nextActionEyebrow')}</span>
                <span className="cart-page__text cart-page__text--strong">{cartNextAction.title}</span>
                <span className="cart-page__text cart-page__text--secondary">{cartNextAction.text}</span>
              </span>
              {cartNextAction.key === 'clear' ? (
                <ShopPopconfirm
                  rootClassName='shop-mobile-popup-layer cart-page-popconfirm'
                  title={t('pages.cart.clearUnavailableConfirm', { count: unavailableItems.length })}
                  onConfirm={cartNextAction.action}
                  okText={cartNextAction.label}
                  cancelText={t('common.cancel')}
                  okButtonProps={{ danger: true, 'aria-label': cartNextActionLabel, title: cartNextActionLabel }}
                  cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${cartNextActionLabel}`, title: `${t('common.cancel')}: ${cartNextActionLabel}` }}
                >
                  <ShopButton type="default" aria-label={cartNextActionLabel} title={cartNextActionLabel}>
                    {cartNextAction.label}
                  </ShopButton>
                </ShopPopconfirm>
              ) : (
                <ShopButton
                  type="default"
                  icon={cartNextAction.key === 'refresh' ? <ShopIcon path={SI.reload} /> : undefined}
                  aria-label={cartNextActionLabel}
                  title={cartNextActionLabel}
                  onClick={cartNextAction.action}
                  loading={cartNextAction.key === 'saved' && restoringSaved}
                >
                  {cartNextAction.label}
                </ShopButton>
              )}
            </div>
          ) : null}
          <div
            className="cart-page__table"
            role="table"
            aria-label={t('pages.cart.title')}
            aria-busy={loading}
          >
            <div className="cart-page__tableHead" role="row">
              <div className="cart-page__tableHeadCell cart-page__tableCol--select" role="columnheader">
                <ShopCheckbox
                  checked={allSelected}
                  indeterminate={selectedPurchasableCount > 0 && !allSelected}
                  disabled={hasStaleCartData}
                  aria-label={t('pages.cart.selectAll')}
                  title={t('pages.cart.selectAll')}
                  onChange={(e) => toggleAll(e.target.checked)}
                >
                  {t('pages.cart.selectAll')}
                </ShopCheckbox>
              </div>
              <div className="cart-page__tableHeadCell cart-page__tableCol--product" role="columnheader">
                {t('pages.cart.product')}
              </div>
              <div className="cart-page__tableHeadCell cart-page__tableCol--price" role="columnheader">
                {t('pages.cart.unitPrice')}
              </div>
              <div className="cart-page__tableHeadCell cart-page__tableCol--qty" role="columnheader">
                {t('common.quantity')}
              </div>
              <div className="cart-page__tableHeadCell cart-page__tableCol--subtotal" role="columnheader">
                {t('common.subtotal')}
              </div>
              <div className="cart-page__tableHeadCell cart-page__tableCol--action" role="columnheader">
                {t('common.actions')}
              </div>
            </div>
            <div className="cart-page__tableBody" role="rowgroup">
              {cartItems.map((record) => {
                const itemName = getCartItemName(record);
                const selectItemLabel = `${t('pages.cart.selectAll')}: ${itemName}`;
                const saveActionLabel = `${t('pages.cart.saveForLater')}: ${itemName}`;
                const deleteActionLabel = `${t('common.delete')}: ${itemName}`;
                return (
                  <div key={record.id} className="cart-page__tableRow" role="row">
                    <div className="cart-page__tableCell cart-page__tableCol--select" role="cell">
                      <ShopCheckbox
                        disabled={hasStaleCartData || !canCheckout(record)}
                        checked={selectedIds.includes(record.id)}
                        aria-label={selectItemLabel}
                        title={selectItemLabel}
                        onChange={(e) => toggleOne(record.id, e.target.checked)}
                      />
                    </div>
                    <div className="cart-page__tableCell cart-page__tableCol--product" role="cell">
                      <div className="cart-page__productCell">
                        <img
                          src={resolveCartImage(record.imageUrl)}
                          alt={itemName}
                          className="cart-page__tableImage"
                          loading="lazy"
                          decoding="async"
                          onError={(event) => {
                            if (event.currentTarget.src !== cartImageFallback) {
                              event.currentTarget.src = cartImageFallback;
                            }
                          }}
                        />
                        <div>
                          <Link to={`/products/${record.productId}`}><span className="cart-page__text">{itemName}</span></Link>
                          {record.selectedSpecs ? <div><span className="cart-page__text cart-page__text--secondary">{formatSelectedSpecs(record.selectedSpecs, t, language)}</span></div> : null}
                          {!canCheckout(record) && <div><span className="cart-page__text cart-page__text--danger">{t('pages.cart.unavailable')}</span></div>}
                          {canCheckout(record) && getCartItemLowStockCount(record) !== null ? (
                            <div>
                              <span className="cart-page__text cart-page__text--warning cart-page__urgency">
                                {t('pages.cart.lowStockLeft', { count: getCartItemLowStockCount(record) ?? 0 })}
                              </span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="cart-page__tableCell cart-page__tableCol--price" role="cell">
                      <span className="cart-page__text cart-page__priceText commerce-money">{formatMoney(record.price)}</span>
                    </div>
                    <div className="cart-page__tableCell cart-page__tableCol--qty" role="cell">
                      {renderQuantityControl(record)}
                    </div>
                    <div className="cart-page__tableCell cart-page__tableCol--subtotal" role="cell">
                      {renderLineTotal(record)}
                    </div>
                    <div className="cart-page__tableCell cart-page__tableCol--action" role="cell">
                      <div className="cart-page__tableActions">
                        <ShopButton type="text" icon={<ShopIcon path={SI.clock} />} size="small" aria-label={saveActionLabel} title={saveActionLabel} onClick={() => saveForLater(record)} disabled={hasStaleCartData || removingItemIds.includes(record.id)}>
                          {t('pages.cart.saveForLater')}
                        </ShopButton>
                        <ShopPopconfirm
                          rootClassName='shop-mobile-popup-layer cart-page-popconfirm'
                          title={t('pages.cart.deleteConfirm')}
                          disabled={hasStaleCartData}
                          onConfirm={() => removeItem(record.id)}
                          okText={t('common.confirm')}
                          cancelText={t('common.cancel')}
                          okButtonProps={{ danger: true, 'aria-label': deleteActionLabel, title: deleteActionLabel }}
                          cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${deleteActionLabel}`, title: `${t('common.cancel')}: ${deleteActionLabel}` }}
                        >
                          <ShopButton type="text" danger icon={<ShopIcon path={SI.delete} />} size="small" loading={removingItemIds.includes(record.id)} disabled={hasStaleCartData} aria-label={deleteActionLabel} title={deleteActionLabel}>{t('common.delete')}</ShopButton>
                        </ShopPopconfirm>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="cart-page__mobileList" role="list" aria-label={t('pages.cart.title')}>
            {cartItems.map((item) => {
              const itemName = getCartItemName(item);
              const saveActionLabel = `${t('pages.cart.saveForLaterShort')}: ${itemName}`;
              const deleteActionLabel = `${t('common.delete')}: ${itemName}`;
              return (
              <article key={item.id} className="cart-page__mobileItem" role="listitem">
                <div className="cart-page__mobileItemTop">
                  <ShopCheckbox
                    disabled={hasStaleCartData || !canCheckout(item)}
                    checked={selectedIds.includes(item.id)}
                    aria-label={`${t('pages.cart.chooseItems')}: ${itemName}`}
                    onChange={(e) => toggleOne(item.id, e.target.checked)}
                  />
                  <img
                    className="cart-page__mobileItemImage"
                    src={resolveCartImage(item.imageUrl)}
                    alt={itemName}
                    loading="lazy"
                    decoding="async"
                    onError={(event) => {
                      if (event.currentTarget.src !== cartImageFallback) {
                        event.currentTarget.src = cartImageFallback;
                      }
                    }}
                  />
                  <div className="cart-page__mobileItemInfo">
                    <Link className="cart-page__mobileItemTitle" to={`/products/${item.productId}`}><span className="cart-page__text cart-page__text--strong">{itemName}</span></Link>
                    {item.selectedSpecs ? <div className="cart-page__mobileItemMeta"><span className="cart-page__text cart-page__text--secondary">{formatSelectedSpecs(item.selectedSpecs, t, language)}</span></div> : null}
                    {!canCheckout(item) && <div><span className="cart-page__text cart-page__text--danger">{t('pages.cart.unavailable')}</span></div>}
                    {canCheckout(item) && getCartItemLowStockCount(item) !== null ? (
                      <div>
                        <span className="cart-page__text cart-page__text--warning cart-page__urgency">
                          {t('pages.cart.lowStockLeft', { count: getCartItemLowStockCount(item) ?? 0 })}
                        </span>
                      </div>
                    ) : null}
                    <span className="cart-page__text cart-page__text--secondary cart-page__mobileItemUnit commerce-atomic commerce-price-quantity">
                      <span className="cart-page__mobileItemUnitPrice commerce-money">{formatMoney(item.price)}</span>
                      <span className="commerce-quantity">x {item.quantity}</span>
                    </span>
                  </div>
                </div>
                <div className="cart-page__mobileItemBottom">
                  <div className="cart-page__mobileItemCommerce">
                    {renderQuantityControl(item)}
                    {renderLineTotal(item)}
                  </div>
                  <div className="cart-page__mobileItemActions">
                    <ShopButton type="text" icon={<ShopIcon path={SI.clock} />} size="small" aria-label={saveActionLabel} title={saveActionLabel} onClick={() => saveForLater(item)} disabled={hasStaleCartData || removingItemIds.includes(item.id)}>
                      {t('pages.cart.saveForLaterShort')}
                    </ShopButton>
                    <ShopPopconfirm
                      rootClassName='shop-mobile-popup-layer cart-page-popconfirm'
                      title={t('pages.cart.deleteConfirm')}
                      disabled={hasStaleCartData}
                      onConfirm={() => removeItem(item.id)}
                      okText={t('common.confirm')}
                      cancelText={t('common.cancel')}
                      okButtonProps={{ danger: true, 'aria-label': deleteActionLabel, title: deleteActionLabel }}
                      cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${deleteActionLabel}`, title: `${t('common.cancel')}: ${deleteActionLabel}` }}
                    >
                      <ShopButton
                        type="text"
                        danger
                        icon={<ShopIcon path={SI.delete} />}
                        size="small"
                        loading={removingItemIds.includes(item.id)}
                        disabled={hasStaleCartData}
                        aria-label={deleteActionLabel}
                        title={deleteActionLabel}
                      />
                    </ShopPopconfirm>
                  </div>
                </div>
              </article>
              );
            })}
          </div>
          <section className="cart-page__summary" aria-label={t('pages.cart.orderSummary')}>
            <div
              className="cart-page__summaryProgress"
              role="group"
              aria-label={t('pages.cart.freeShippingProgressLabel')}
            >
              <span className="cart-page__text cart-page__text--strong" id="cart-free-shipping-status">
                {freeShippingStatusTitle}
              </span>
              <ShopProgress
                percent={freeShippingPercent}
                showInfo={false}
                strokeColor="#124734"
                aria-labelledby="cart-free-shipping-status"
                format={() => t('pages.cart.freeShippingProgressValue', { percent: freeShippingPercent })}
              />
              <span className="cart-page__srOnly" aria-live="polite">
                {freeShippingUnlocked
                  ? t('pages.cart.freeShippingUnlocked')
                  : t('pages.cart.freeShippingProgressValue', { percent: freeShippingPercent })}
              </span>
            </div>
            <div className="cart-page__summaryFooter">
              <div>
                <span className="cart-page__text">{t('pages.cart.selectedSummary', { count: selectedUnitCount })}</span>
                <span className="cart-page__text cart-page__total">
                  {t('common.total')}: <span className="cart-page__text cart-page__text--strong cart-page__totalAmount commerce-money">{formatMoney(selectedTotal)}</span>
                </span>
              </div>
              <ShopButton type="primary" size="large" aria-label={checkoutActionLabel} title={checkoutActionLabel} onClick={goCheckout} disabled={hasStaleCartData || checkoutBlocked || checkoutSubmitting} loading={checkoutSubmitting}>
                {checkoutSubmitting ? t('pages.cart.checkoutSyncing') : t('pages.cart.checkout')}
              </ShopButton>
            </div>
            <div className="cart-page__trustBar" aria-label={t('pages.cart.trustTitle')}>
              <div className="cart-page__trustItem">
                <ShopIcon path={SI.lock} aria-hidden="true"  />
                <div>
                  <span className="cart-page__text cart-page__text--strong">{t('pages.cart.trustSecureTitle')}</span>
                  <span className="cart-page__text cart-page__text--secondary">{t('pages.cart.trustSecureText')}</span>
                </div>
              </div>
              <div className="cart-page__trustItem">
                <ShopIcon path={SI.safety} aria-hidden="true"  />
                <div>
                  <span className="cart-page__text cart-page__text--strong">{t('pages.cart.trustReturnsTitle')}</span>
                  <span className="cart-page__text cart-page__text--secondary">{t('pages.cart.trustReturnsText')}</span>
                </div>
              </div>
              <div className="cart-page__trustItem">
                <ShopIcon path={SI.support} aria-hidden="true"  />
                <div>
                  <span className="cart-page__text cart-page__text--strong">{t('pages.cart.trustSupportTitle')}</span>
                  <span className="cart-page__text cart-page__text--secondary">{t('pages.cart.trustSupportText')}</span>
                </div>
              </div>
            </div>
          </section>
          {selectedItems.length > 0 && !hasStaleCartData ? (
            <div className="cart-page__addOn" id="cart-add-on-assistant">
              {benefitTarget ? (
                <AddOnAssistant
                  cartProductIds={cartItems.map((item) => item.productId)}
                  remainingAmount={benefitTarget.remainingAmount}
                  reason={benefitTarget.reason}
                  onAdd={addSuggestedProduct}
                />
              ) : null}
            </div>
          ) : null}
        </>
      ) : (
        <section className="cart-page__emptyPanel" role="status">
          <div className="cart-page__emptyPanelInner" role="status" aria-live="polite">
            <span className="cart-page__emptyPanelIconWrap" aria-hidden="true">
              <ShopIcon path={SI.shopping} className="cart-page__emptyPanelIcon" />
            </span>
            <div className="cart-page__emptyPanelDescription">{t('pages.cart.empty')}</div>
            <div className="cart-page__emptyPanelActions" data-cart-empty-panel-actions="true">
              <ShopButton type="primary" icon={<ShopIcon path={SI.shopping} />} aria-label={emptyBrowseActionLabel} title={emptyBrowseActionLabel} onClick={() => navigate('/products')}>
                {t('pages.cart.browse')}
              </ShopButton>
              <ShopButton icon={<ShopIcon path={SI.shopping} />} aria-label={emptyCouponsActionLabel} title={emptyCouponsActionLabel} onClick={() => navigate('/coupons')}>
                {t('nav.coupons')}
              </ShopButton>
              <ShopButton icon={<ShopIcon path={SI.shopping} />} aria-label={emptyPetFinderActionLabel} title={emptyPetFinderActionLabel} onClick={() => navigate('/pet-finder')}>
                {t('nav.petFinder')}
              </ShopButton>
              <ShopButton icon={<ShopIcon path={SI.clock} />} aria-label={emptyHistoryActionLabel} title={emptyHistoryActionLabel} onClick={() => navigate('/history')}>
                {t('nav.history')}
              </ShopButton>
            </div>
          </div>
        </section>
      )}
      <section
        className="cart-page__savedCard"
        aria-label={`${t('pages.cart.saveForLaterTitle')} (${savedItems.length})`}
      >
        <div className="cart-page__panelHead">
          <h2 className="cart-page__panelTitle">{`${t('pages.cart.saveForLaterTitle')} (${savedItems.length})`}</h2>
          {savedItems.length > 0 ? (
            <ShopButton
              size="small"
              icon={<ShopIcon path={SI.cart} />}
              loading={restoringSaved}
              disabled={hasStaleCartData || restoringSavedItemIds.length > 0}
              aria-label={moveAllSavedActionLabel}
              title={moveAllSavedActionLabel}
              onClick={() => moveSavedItemsToCart(savedItems)}
            >
              {t('pages.cart.moveAllToCart')}
            </ShopButton>
          ) : null}
        </div>
        {savedItems.length > 0 ? (
          <div className="cart-page__savedValue">
            <ShopIcon path={SI.clock} />
            <span>
              <span className="cart-page__text cart-page__text--strong">{t('pages.cart.savedValueTitle')}</span>
              <span className="cart-page__text cart-page__text--secondary cart-page__amountPhrase">{savedValueText}</span>
            </span>
          </div>
        ) : null}
        {conversionConfig.saveForLater.enabled && savedReminderItems.length > 0 ? (
          <ShopAlert
            type="info"
            showIcon
            className="cart-page__savedReminder"
            message={t('pages.cart.savedReminderTitle', { count: savedReminderItems.length })}
            description={t('pages.cart.savedReminderText')}
            action={(
              <ShopButton
                size="small"
                type="primary"
                loading={restoringSaved}
                disabled={hasStaleCartData || restoringSavedItemIds.length > 0}
                aria-label={restoreSavedReminderActionLabel}
                title={restoreSavedReminderActionLabel}
                onClick={() => moveSavedItemsToCart(savedReminderItems)}
              >
                {t('pages.cart.restoreReminder')}
              </ShopButton>
            )}
          />
        ) : null}
        {savedItems.length === 0 ? (
          <div className="cart-page__savedEmpty" role="status" aria-live="polite">
            <div className="cart-page__savedEmptyInner">
              <div className="cart-page__savedEmptyCopy">
                <div>{t('pages.cart.saveForLaterEmpty')}</div>
                <div className="cart-page__savedEmptyHint">{t('pages.cart.saveForLaterEmptyHint')}</div>
              </div>
              <div className="cart-page__savedEmptyActions">
                <ShopButton
                  type="primary"
                  icon={<ShopIcon path={SI.shopping} />}
                  aria-label={t('pages.cart.saveForLaterBrowse')}
                  title={t('pages.cart.saveForLaterBrowse')}
                  onClick={() => navigate('/products')}
                >
                  {t('pages.cart.saveForLaterBrowse')}
                </ShopButton>
                <ShopButton
                  icon={<ShopIcon path={SI.shopping} />}
                  aria-label={t('pages.cart.saveForLaterWishlist')}
                  title={t('pages.cart.saveForLaterWishlist')}
                  onClick={() => navigate('/wishlist')}
                >
                  {t('pages.cart.saveForLaterWishlist')}
                </ShopButton>
              </div>
            </div>
          </div>
        ) : (
          <div className="cart-page__savedGrid" role="list" aria-label={t('pages.cart.saveForLaterTitle')}>
            {savedItems.map((item) => {
              const itemName = getCartItemName(item);
              const moveActionLabel = `${t('pages.cart.moveToCart')}: ${itemName}`;
              const deleteActionLabel = `${t('common.delete')}: ${itemName}`;
              const restoringSavedItem = restoringSaved || restoringSavedItemIds.includes(item.id);
              return (
              <div className="cart-page__savedItem" key={item.id} role="listitem">
                <Link to={`/products/${item.productId}`}>
                  <img
                    src={resolveCartImage(item.imageUrl)}
                    alt={itemName}
                    loading="lazy"
                    decoding="async"
                    onError={(event) => {
                      if (event.currentTarget.src !== cartImageFallback) {
                        event.currentTarget.src = cartImageFallback;
                      }
                    }}
                  />
                </Link>
                <div className="cart-page__savedInfo">
                  <Link to={`/products/${item.productId}`}><span className="cart-page__text cart-page__text--strong">{itemName}</span></Link>
                  {item.selectedSpecs ? <span className="cart-page__text cart-page__text--secondary">{formatSelectedSpecs(item.selectedSpecs, t, language)}</span> : null}
                  <span className="cart-page__text cart-page__text--secondary cart-page__savedQuantity commerce-quantity">{t('common.quantity')}: {item.quantity}</span>
                  <ShopTag className="cart-page__savedAge">
                    {t('pages.cart.savedDaysAgo', { count: getSavedAgeDays(item.savedAt) })}
                  </ShopTag>
                  <span className="cart-page__text cart-page__text--strong cart-page__savedPrice commerce-money">{formatMoney(item.price)}</span>
                </div>
                <div className="cart-page__savedActions">
                  <ShopButton icon={<ShopIcon path={SI.cart} />} loading={restoringSavedItem} disabled={hasStaleCartData || restoringSavedItem} aria-label={moveActionLabel} title={moveActionLabel} onClick={() => moveSavedItemToCart(item)}>
                    {t('pages.cart.moveToCart')}
                  </ShopButton>
                  <ShopPopconfirm
                    rootClassName='shop-mobile-popup-layer cart-page-popconfirm'
                    title={t('pages.cart.deleteSavedConfirm')}
                    onConfirm={() => removeSavedItem(item.id)}
                    okText={t('common.confirm')}
                    cancelText={t('common.cancel')}
                    okButtonProps={{ danger: true, 'aria-label': deleteActionLabel, title: deleteActionLabel }}
                    cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${deleteActionLabel}`, title: `${t('common.cancel')}: ${deleteActionLabel}` }}
                  >
                    <ShopButton danger type="text" icon={<ShopIcon path={SI.delete} />} disabled={restoringSavedItem} aria-label={deleteActionLabel} title={deleteActionLabel} />
                  </ShopPopconfirm>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default Cart;
