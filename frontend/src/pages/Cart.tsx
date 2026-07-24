import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { cartApi, productApi } from '../api';
import type { CartItem, ProductPublic as Product } from '../types';
import { useLanguage } from '../i18n';
import { usePageTitle } from '../hooks/usePageTitle';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useMarket } from '../hooks/useMarket';
import { useCartQuantitySync } from '../hooks/useCartQuantitySync';
import { useCartCheckoutSubmit } from '../hooks/useCartCheckoutSubmit';
import { useCartItemMutations } from '../hooks/useCartItemMutations';
import { useCartQuantityActions } from '../hooks/useCartQuantityActions';
import { useCartRecoveryAdds } from '../hooks/useCartRecoveryAdds';
import { getGuestCartItems } from '../utils/guestCart';
import {
  getSavedForLaterItems,
  SAVE_FOR_LATER_STORAGE_KEY,
  type SavedForLaterItem,
} from '../utils/saveForLater';
import { conversionConfig } from '../utils/conversionConfig';
import { getNearestCartBenefitTarget, isGiftUnlocked } from '../utils/cartBenefits';
import { loadProductViewPreferences } from '../utils/productViewPreferences';
import { localizeProduct } from '../utils/localizedProduct';
import { clearCheckoutCartItemIds, hasAuthenticatedCartSession } from '../utils/cartSession';
import {
  canCartItemCheckout as canCheckout,
  deriveCartShippingSummary,
  getCartLineAmount,
  getCartLineQuantity,
  isCartItemAvailable as isAvailable,
  roundCartMoney,
} from '../utils/cartUi';
import { dispatchDomEvent } from '../utils/domEvents';
import ShopBreadcrumb from '../components/ShopBreadcrumb';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import { getLocalStorageItem, removeSessionStorageItem } from '../utils/safeStorage';
import { getApiErrorMessage, isAuthExpiredError } from '../utils/apiError';
import AddOnAssistant from '../components/AddOnAssistant';
import { CartFullEmptyState, CartLoadErrorState, CartLoadingState } from './cartShellStates';
import { CartInlineEmptyPanel, CartOrderSummary, CartPaymentReturnBanner } from './cartConversionPanels';
import { CartLineItems } from './cartLineItems';
import { CartSavedPanel } from './cartSavedPanel';
import { CartBulkReadinessPanel, CartHeroOverview, CartRecentRecoveryPanel } from './cartOverviewPanels';
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

  const { updateQuantity } = useCartQuantityActions({
    hasPendingQuantityTimer,
    hasStaleCartData,
    invalidateCartSnapshotRequests,
    scheduleQuantitySync,
    setCartItems,
    setQuantityDrafts,
  });

  const {
    moveSavedItemToCart,
    moveSavedItemsToCart,
    removeItem,
    removeItems,
    removeSavedItem,
    saveForLater,
  } = useCartItemMutations({
    canCheckout,
    cancelPendingQuantitySync,
    clearRecentProductsCache,
    getCartItemName,
    hasStaleCartData,
    invalidateCartSnapshotRequests,
    isCurrentCartSnapshotRequest,
    language,
    mountedRef,
    removingItemIds,
    resetCheckoutStateAfterCartMutation,
    restoringSaved,
    restoringSavedItemIds,
    setCartItems,
    setRemovingItemIds,
    setRestoringSaved,
    setRestoringSavedItemIds,
    setSavedItems,
    setSelectedIds,
    t,
  });

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

  const { goCheckout } = useCartCheckoutSubmit({
    canCheckout,
    checkoutSubmittingRef,
    flushPendingQuantityUpdates,
    hasStaleCartData,
    mountedRef,
    navigate,
    selectedItems,
    setCheckoutSubmitting,
    t,
  });

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

  const {
    addRecentProduct,
    addSuggestedProduct,
  } = useCartRecoveryAdds({
    canCheckout,
    clearRecentProductsCache,
    hasStaleCartData,
    invalidateCartSnapshotRequests,
    isCurrentCartSnapshotRequest,
    language,
    mountedRef,
    navigate,
    normalizePositiveProductId,
    setAddingRecentId,
    setCartItems,
    setSelectedIds,
    t,
  });

  const paymentCancelledResumeLabel = paymentReturnOrderNo
    ? `${t('pages.cart.paymentCancelledResume')}: ${paymentReturnOrderNo}`
    : t('pages.cart.paymentCancelledResume');
  const paymentCancelledTrackLabel = paymentReturnOrderNo
    ? `${t('pages.cart.paymentCancelledTrack')}: ${paymentReturnOrderNo}`
    : t('pages.cart.paymentCancelledTrack');
  const paymentCancelledCheckoutLabel = t('pages.cart.checkout');

  const paymentReturnBanner = paymentReturnIncomplete ? (
    <CartPaymentReturnBanner
      cartItemCount={cartItems.length}
      clearPaymentReturnParams={clearPaymentReturnParams}
      navigate={navigate}
      paymentCancelledCheckoutLabel={paymentCancelledCheckoutLabel}
      paymentCancelledResumeLabel={paymentCancelledResumeLabel}
      paymentCancelledTrackLabel={paymentCancelledTrackLabel}
      paymentReturnOrderNo={paymentReturnOrderNo}
      paymentReturnStatus={paymentReturnStatus}
      t={t}
    />
  ) : null;

  if (loading) {
    return <CartLoadingState language={language} t={t} />;
  }

  if (!loading && loadError && cartItems.length === 0) {
    return (
      <CartLoadErrorState
        language={language}
        loadErrorMessage={loadErrorMessage}
        navigate={navigate}
        onRetry={() => { setLoading(true); fetchCartItems(); }}
        paymentReturnBanner={paymentReturnBanner}
        retryCartLoadActionLabel={retryCartLoadActionLabel}
        t={t}
      />
    );
  }

  if (!loading && cartItems.length === 0 && savedItems.length === 0 && recentProducts.length === 0) {
    return (
      <CartFullEmptyState
        emptyBrowseActionLabel={emptyBrowseActionLabel}
        emptyCouponsActionLabel={emptyCouponsActionLabel}
        emptyHistoryActionLabel={emptyHistoryActionLabel}
        emptyPetFinderActionLabel={emptyPetFinderActionLabel}
        formatMoney={formatMoney}
        freeShippingThreshold={freeShippingThreshold}
        language={language}
        navigate={navigate}
        paymentReturnBanner={paymentReturnBanner}
        t={t}
      />
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
      <CartHeroOverview
        browseAllProductsActionLabel={browseAllProductsActionLabel}
        cartHeroHighlights={cartHeroHighlights}
        cartItemsCount={cartItems.length}
        cartNextAction={cartNextAction}
        cartNextActionLabel={cartNextActionLabel}
        cartSummaryCards={cartSummaryCards}
        cartTopNextActionLabel={cartTopNextActionLabel}
        emptyBrowseActionLabel={emptyBrowseActionLabel}
        emptyCouponsActionLabel={emptyCouponsActionLabel}
        emptyHistoryActionLabel={emptyHistoryActionLabel}
        emptyPetFinderActionLabel={emptyPetFinderActionLabel}
        hasStaleCartData={hasStaleCartData}
        loadErrorMessage={loadErrorMessage}
        navigate={navigate}
        refreshCartItems={refreshCartItems}
        retryCartLoadActionLabel={retryCartLoadActionLabel}
        t={t}
        unavailableCount={unavailableItems.length}
      />
      <CartRecentRecoveryPanel
        addRecentProduct={addRecentProduct}
        addingRecentId={addingRecentId}
        formatMoney={formatMoney}
        getCartProductName={getCartProductName}
        hasStaleCartData={hasStaleCartData}
        navigate={navigate}
        recentProducts={recentProducts}
        recentRecoveryBrowseActionLabel={recentRecoveryBrowseActionLabel}
        showRecentlyViewedRecovery={showRecentlyViewedRecovery}
        t={t}
      />
      {cartItems.length > 0 ? (
        <>
          <CartBulkReadinessPanel
            allSelected={allSelected}
            cartNextAction={cartNextAction}
            cartNextActionLabel={cartNextActionLabel}
            checkoutBlocked={checkoutBlocked}
            clearUnavailableActionLabel={clearUnavailableActionLabel}
            clearUnavailableItems={clearUnavailableItems}
            deleteSelectedActionLabel={deleteSelectedActionLabel}
            freeShippingGapTitle={freeShippingGapTitle}
            freeShippingRemaining={freeShippingRemaining}
            freeShippingUnlocked={freeShippingUnlocked}
            giftUnlocked={giftUnlocked}
            hasStaleCartData={hasStaleCartData}
            purchasableItemsCount={purchasableItems.length}
            purchasableUnitCount={purchasableUnitCount}
            removeSelectedItems={removeSelectedItems}
            removingItemIds={removingItemIds}
            restoringSaved={restoringSaved}
            selectReadyActionLabel={selectReadyActionLabel}
            selectedIds={selectedIds}
            selectedPurchasableCount={selectedPurchasableCount}
            selectedUnitCount={selectedUnitCount}
            t={t}
            toggleAll={toggleAll}
            unavailableItems={unavailableItems}
          />
          <CartLineItems
            allSelected={allSelected}
            cartItems={cartItems}
            checkoutSubmitting={checkoutSubmitting}
            formatMoney={formatMoney}
            getCartItemName={getCartItemName}
            hasStaleCartData={hasStaleCartData}
            language={language}
            loading={loading}
            quantityDrafts={quantityDrafts}
            removeItem={removeItem}
            removingItemIds={removingItemIds}
            saveForLater={saveForLater}
            selectedIds={selectedIds}
            selectedPurchasableCount={selectedPurchasableCount}
            setQuantityDrafts={setQuantityDrafts}
            t={t}
            toggleAll={toggleAll}
            toggleOne={toggleOne}
            updateQuantity={updateQuantity}
            updatingItemIds={updatingItemIds}
          />
          <CartOrderSummary
            checkoutActionLabel={checkoutActionLabel}
            checkoutBlocked={checkoutBlocked}
            checkoutSubmitting={checkoutSubmitting}
            formatMoney={formatMoney}
            freeShippingPercent={freeShippingPercent}
            freeShippingStatusTitle={freeShippingStatusTitle}
            freeShippingUnlocked={freeShippingUnlocked}
            goCheckout={goCheckout}
            hasStaleCartData={hasStaleCartData}
            selectedTotal={selectedTotal}
            selectedUnitCount={selectedUnitCount}
            t={t}
          />
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
        <CartInlineEmptyPanel
          emptyBrowseActionLabel={emptyBrowseActionLabel}
          emptyCouponsActionLabel={emptyCouponsActionLabel}
          emptyHistoryActionLabel={emptyHistoryActionLabel}
          emptyPetFinderActionLabel={emptyPetFinderActionLabel}
          navigate={navigate}
          t={t}
        />
      )}
      <CartSavedPanel
        formatMoney={formatMoney}
        getCartItemName={getCartItemName}
        getSavedAgeDays={getSavedAgeDays}
        hasStaleCartData={hasStaleCartData}
        language={language}
        moveAllSavedActionLabel={moveAllSavedActionLabel}
        moveSavedItemToCart={moveSavedItemToCart}
        moveSavedItemsToCart={moveSavedItemsToCart}
        navigate={navigate}
        removeSavedItem={removeSavedItem}
        restoreSavedReminderActionLabel={restoreSavedReminderActionLabel}
        restoringSaved={restoringSaved}
        restoringSavedItemIds={restoringSavedItemIds}
        savedItems={savedItems}
        savedReminderItems={savedReminderItems}
        savedValueText={savedValueText}
        t={t}
      />
    </div>
  );
};

export default Cart;
