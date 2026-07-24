import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ShopButton from '../components/ShopButton';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import ShopPopconfirm from '../components/ShopPopconfirm';
import { ShopIcon, SI } from '../components/ShopIcon';
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
import { needsOptionSelection } from '../utils/productOptions';
import { localizeProduct } from '../utils/localizedProduct';
import { clearCheckoutCartItemIds, hasAuthenticatedCartSession } from '../utils/cartSession';
import {
  canCartItemCheckout as canCheckout,
  cartImageFallback,
  deriveCartShippingSummary,
  getCartLineAmount,
  getCartLineQuantity,
  isCartItemAvailable as isAvailable,
  resolveCartImage,
  roundCartMoney,
} from '../utils/cartUi';
import { dispatchDomEvent } from '../utils/domEvents';
import ShopBreadcrumb from '../components/ShopBreadcrumb';
import ShopTag from '../components/ShopTag';
import ShopAlert from '../components/ShopAlert';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import { getLocalStorageItem, removeSessionStorageItem } from '../utils/safeStorage';
import { getApiErrorMessage, isAuthExpiredError } from '../utils/apiError';
import AddOnAssistant from '../components/AddOnAssistant';
import { CartFullEmptyState, CartLoadErrorState, CartLoadingState } from './cartShellStates';
import { CartInlineEmptyPanel, CartOrderSummary, CartPaymentReturnBanner } from './cartConversionPanels';
import { CartLineItems } from './cartLineItems';
import { CartSavedPanel } from './cartSavedPanel';
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
