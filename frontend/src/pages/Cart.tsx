import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Checkbox, Empty, message, Popconfirm, Progress, Space, Table, Tag, Typography } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, DeleteOutlined, ExclamationCircleOutlined, MinusOutlined, PlusOutlined, ShoppingCartOutlined, ShoppingOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { cartApi, productApi } from '../api';
import type { CartItem, ProductPublic as Product } from '../types';
import { useLanguage } from '../i18n';
import { useMarket } from '../hooks/useMarket';
import { formatSelectedSpecs } from '../utils/selectedSpecs';
import { addGuestCartItem, getGuestCartItems, removeGuestCartItem, removeGuestCartItems, updateGuestCartQuantity } from '../utils/guestCart';
import {
  getSavedForLaterItems,
  removeSavedForLaterProduct,
  removeSavedForLaterItem,
  saveCartItemForLater,
  type SavedForLaterItem,
} from '../utils/saveForLater';
import { conversionConfig } from '../utils/conversionConfig';
import { getNearestCartBenefitTarget, isGiftUnlocked } from '../utils/cartBenefits';
import { loadProductViewPreferences } from '../utils/productViewPreferences';
import { needsOptionSelection } from '../utils/productOptions';
import { localizeProduct } from '../utils/localizedProduct';
import { hasAuthenticatedCartSession, syncCheckoutCartItemIds } from '../utils/cartSession';
import { canCartItemCheckout as canCheckout, cartImageFallback, getCartItemLowStockCount, isCartItemAvailable as isAvailable, resolveCartImage } from '../utils/cartUi';
import { dispatchDomEvent } from '../utils/domEvents';
import { getLocalStorageItem, removeSessionStorageItem } from '../utils/safeStorage';
import { allSettledWithConcurrency } from '../utils/asyncBatch';
import { getApiErrorMessage } from '../utils/apiError';
import AddOnAssistant from '../components/AddOnAssistant';
import { ProductCardSkeleton, StatsStripSkeleton } from '../components/SkeletonLoader';
import './Cart.css';
import '../styles/mobile-page-contrast.css';

const { Title, Text } = Typography;
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

const getSavedAgeDays = (savedAt?: number) => {
  if (!savedAt) return 0;
  return Math.max(0, Math.floor((Date.now() - savedAt) / 86400000));
};

const getCartQuantityLimit = (stock?: number | null) => {
  if (stock === undefined || stock === null) return 99;
  return Math.max(1, stock);
};

const isAuthExpiredError = (error: any) => {
  const status = Number(error?.response?.status);
  return status === 401 || status === 403;
};

const getLineQuantity = (quantity: unknown) => {
  const numeric = Number(quantity);
  return Number.isFinite(numeric) ? Math.max(1, Math.floor(numeric)) : 1;
};

const getLinePrice = (price: unknown) => {
  const numeric = Number(price);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
};

const getLineTotal = (item: Pick<CartItem, 'price' | 'quantity'> | Pick<SavedForLaterItem, 'price' | 'quantity'>) =>
  getLinePrice(item.price) * getLineQuantity(item.quantity);

const Cart: React.FC = () => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [savedItems, setSavedItems] = useState<SavedForLaterItem[]>(() => getSavedForLaterItems());
  const [recentProducts, setRecentProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [restoringSaved, setRestoringSaved] = useState(false);
  const [addingRecentId, setAddingRecentId] = useState<number | null>(null);
  const [updatingItemIds, setUpdatingItemIds] = useState<number[]>([]);
  const [removingItemIds, setRemovingItemIds] = useState<number[]>([]);
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { currency, market, formatMoney } = useMarket();
  const getCartItemName = useCallback((item: Pick<CartItem, 'productId' | 'productName'>) => (
    (item.productName || '').trim() || t('pages.profile.productFallback', { id: item.productId })
  ), [t]);
  const getCartProductName = useCallback((product: Pick<Product, 'id' | 'name'>) => (
    (product.name || '').trim() || t('pages.profile.productFallback', { id: product.id })
  ), [t]);

  const fetchCartItems = useCallback(async () => {
    const authenticated = hasAuthenticatedCartSession();
    if (!authenticated) {
      const guestItems = getGuestCartItems();
      setCartItems(guestItems);
      setSelectedIds(guestItems.filter(canCheckout).map((item) => item.id));
      setLoading(false);
      return;
    }
    try {
      setLoadError(false);
      const response = await cartApi.getItems(0);
      setCartItems(response.data);
      setSelectedIds(response.data.filter(canCheckout).map((item) => item.id));
    } catch (error: any) {
      if (isAuthExpiredError(error)) {
        const guestItems = getGuestCartItems();
        setCartItems(guestItems);
        setSelectedIds(guestItems.filter(canCheckout).map((item) => item.id));
        setLoadError(false);
      } else {
        setLoadError(true);
        message.error(getApiErrorMessage(error, t('pages.cart.fetchFailed'), language));
      }
    } finally {
      setLoading(false);
    }
  }, [language, t]);

  useEffect(() => {
    fetchCartItems();
  }, [fetchCartItems]);

  useEffect(() => {
    if (!conversionConfig.cartRecentlyViewed.enabled) return;
    const loadRecentlyViewedProducts = async () => {
      const preferences = loadProductViewPreferences();
      if (preferences.recent.length === 0) {
        setRecentProducts([]);
        return;
      }
      try {
        const recentIds = preferences.recent.slice(0, conversionConfig.cartRecentlyViewed.maxItems * 2);
        const cacheKey = `${language}|${recentIds.join(',')}`;
        const cachedProducts = getCachedRecentProducts(cacheKey);
        if (cachedProducts) {
          setRecentProducts(cachedProducts);
          return;
        }
        const response = await productApi.getByIds(recentIds);
        const productById = new Map(response.data.map((product) => [product.id, localizeProduct(product, language)]));
        const nextRecentProducts = preferences.recent
            .map((productId) => productById.get(productId))
            .filter((product): product is Product => Boolean(product))
            .filter((product) => product.stock === undefined || product.stock > 0)
            .slice(0, conversionConfig.cartRecentlyViewed.maxItems);
        setCachedRecentProducts(cacheKey, nextRecentProducts);
        setRecentProducts(nextRecentProducts);
      } catch {
        setRecentProducts([]);
      }
    };
    loadRecentlyViewedProducts();
    window.addEventListener('shop:product-view-preferences-updated', loadRecentlyViewedProducts);
    return () => window.removeEventListener('shop:product-view-preferences-updated', loadRecentlyViewedProducts);
  }, [language]);

  useEffect(() => {
    const refreshSavedItems = () => setSavedItems(getSavedForLaterItems());
    const refreshGuestCartFromStorage = (event: StorageEvent) => {
      if (event.key !== 'shop-guest-cart' || getLocalStorageItem('token')) return;
      const guestItems = getGuestCartItems();
      setCartItems(guestItems);
      setSelectedIds(guestItems.filter(canCheckout).map((item) => item.id));
      setLoading(false);
    };
    window.addEventListener('shop:save-for-later-updated', refreshSavedItems);
    window.addEventListener('storage', refreshGuestCartFromStorage);
    return () => {
      window.removeEventListener('shop:save-for-later-updated', refreshSavedItems);
      window.removeEventListener('storage', refreshGuestCartFromStorage);
    };
  }, []);

  const updateQuantity = async (itemId: number, quantity: number) => {
    if (updatingItemIds.includes(itemId)) return;
    const targetItem = cartItems.find((item) => item.id === itemId);
    const normalizedQuantity = Math.max(1, Math.min(Number(quantity) || 1, getCartQuantityLimit(targetItem?.stock)));
    if (targetItem && normalizedQuantity === targetItem.quantity) return;
    try {
      setUpdatingItemIds((ids) => Array.from(new Set([...ids, itemId])));
      const authenticated = hasAuthenticatedCartSession();
      if (authenticated) {
        await cartApi.updateQuantity(itemId, normalizedQuantity);
        setCartItems((items) => items.map((item) => (item.id === itemId ? { ...item, quantity: normalizedQuantity } : item)));
      } else {
        setCartItems(updateGuestCartQuantity(itemId, normalizedQuantity));
      }
      if (authenticated) dispatchDomEvent('shop:cart-updated');
    } catch (err: any) {
      message.error(getApiErrorMessage(err, t('pages.cart.quantityFailed'), language));
    } finally {
      setUpdatingItemIds((ids) => ids.filter((id) => id !== itemId));
    }
  };

  const renderQuantityControl = (item: CartItem) => {
    const itemName = getCartItemName(item);
    const quantityLabel = `${t('common.quantity')}: ${itemName}`;
    const decreaseLabel = `${t('pages.cart.decreaseQuantity')}: ${itemName}`;
    const increaseLabel = `${t('pages.cart.increaseQuantity')}: ${itemName}`;
    const limit = getCartQuantityLimit(item.stock);
    const disabled = !isAvailable(item) || updatingItemIds.includes(item.id) || removingItemIds.includes(item.id);
    const quantity = getLineQuantity(item.quantity);

    return (
      <div className="cart-page__quantityStepper" role="group" aria-label={quantityLabel} title={quantityLabel}>
        <Button
          size="small"
          icon={<MinusOutlined />}
          aria-label={decreaseLabel}
          title={decreaseLabel}
          disabled={disabled || quantity <= 1}
          onClick={() => updateQuantity(item.id, quantity - 1)}
        />
        <input
          className="cart-page__quantityInput"
          type="number"
          min={1}
          max={limit}
          value={quantity}
          disabled={disabled}
          aria-label={quantityLabel}
          title={quantityLabel}
          onChange={(event) => updateQuantity(item.id, Number(event.currentTarget.value) || 1)}
        />
        <Button
          size="small"
          icon={<PlusOutlined />}
          aria-label={increaseLabel}
          title={increaseLabel}
          disabled={disabled || quantity >= limit}
          onClick={() => updateQuantity(item.id, quantity + 1)}
        />
      </div>
    );
  };

  const removeItem = async (itemId: number) => {
    if (removingItemIds.includes(itemId)) return;
    try {
      setRemovingItemIds((ids) => Array.from(new Set([...ids, itemId])));
      const authenticated = hasAuthenticatedCartSession();
      if (authenticated) {
        await cartApi.removeItem(itemId);
        setCartItems((items) => items.filter((item) => item.id !== itemId));
      } else {
        setCartItems(removeGuestCartItem(itemId));
      }
      message.success(t('messages.deleteSuccess'));
      setSelectedIds((ids) => ids.filter((id) => id !== itemId));
      if (authenticated) dispatchDomEvent('shop:cart-updated');
    } catch {
      message.error(t('messages.deleteFailed'));
    } finally {
      setRemovingItemIds((ids) => ids.filter((id) => id !== itemId));
    }
  };

  const saveForLater = async (item: CartItem) => {
    try {
      const authenticated = hasAuthenticatedCartSession();
      if (authenticated) {
        await cartApi.removeItem(item.id);
        saveCartItemForLater(item);
        setCartItems((items) => items.filter((cartItem) => cartItem.id !== item.id));
      } else {
        saveCartItemForLater(item);
        setCartItems(removeGuestCartItem(item.id));
      }
      setSelectedIds((ids) => ids.filter((id) => id !== item.id));
      setSavedItems(getSavedForLaterItems());
      message.success(t('pages.cart.savedForLater'));
      if (authenticated) dispatchDomEvent('shop:cart-updated');
    } catch {
      message.error(t('messages.operationFailed'));
    }
  };

  const moveSavedItemToCart = async (item: SavedForLaterItem) => {
    try {
      const authenticated = hasAuthenticatedCartSession();
      if (authenticated) {
        await cartApi.addItem(0, item.productId, item.quantity, item.selectedSpecs);
        const response = await cartApi.getItems(0);
        setCartItems(response.data);
        setSelectedIds(response.data.filter(canCheckout).map((cartItem) => cartItem.id));
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
        const nextItems = getGuestCartItems();
        setCartItems(nextItems);
        setSelectedIds(nextItems.filter(canCheckout).map((cartItem) => cartItem.id));
      }
      removeSavedForLaterProduct(item.productId, item.selectedSpecs);
      setSavedItems(getSavedForLaterItems());
      message.success(t('pages.cart.movedToCart'));
      if (authenticated) dispatchDomEvent('shop:cart-updated');
    } catch {
      message.error(t('messages.operationFailed'));
    }
  };

  const moveSavedItemsToCart = async (items: SavedForLaterItem[]) => {
    if (items.length === 0) return;
    const targetItems = items.slice(0, conversionConfig.saveForLater.maxBulkRestoreItems);
    setRestoringSaved(true);
    try {
      const authenticated = hasAuthenticatedCartSession();
      let restoredItems = targetItems;
      if (authenticated) {
        const results = await allSettledWithConcurrency(
          targetItems,
          (item) => cartApi.addItem(0, item.productId, item.quantity, item.selectedSpecs),
        );
        restoredItems = targetItems.filter((_, index) => results[index].status === 'fulfilled');
        if (restoredItems.length === 0) {
          message.error(t('messages.operationFailed'));
          return;
        }
        const response = await cartApi.getItems(0);
        setCartItems(response.data);
        setSelectedIds(response.data.filter(canCheckout).map((cartItem) => cartItem.id));
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
        const nextItems = getGuestCartItems();
        setCartItems(nextItems);
        setSelectedIds(nextItems.filter(canCheckout).map((cartItem) => cartItem.id));
      }
      restoredItems.forEach((item) => removeSavedForLaterProduct(item.productId, item.selectedSpecs));
      setSavedItems(getSavedForLaterItems());
      if (restoredItems.length === targetItems.length) {
        message.success(t('pages.cart.movedSavedBatch', { count: restoredItems.length }));
      } else {
        message.warning(t('pages.cart.movedSavedBatchPartial', { count: restoredItems.length, failed: targetItems.length - restoredItems.length }));
      }
      if (authenticated) dispatchDomEvent('shop:cart-updated');
    } catch {
      message.error(t('messages.operationFailed'));
    } finally {
      setRestoringSaved(false);
    }
  };

  const removeSavedItem = (itemId: number) => {
    setSavedItems(removeSavedForLaterItem(itemId));
    message.success(t('messages.deleteSuccess'));
  };

  const removeItems = async (itemIds: number[], successMessage: string) => {
    if (itemIds.length === 0) return;
    const normalizedIds = Array.from(new Set(itemIds));
    try {
      setRemovingItemIds((ids) => Array.from(new Set([...ids, ...normalizedIds])));
      const authenticated = hasAuthenticatedCartSession();
      if (authenticated) {
        await cartApi.removeItems(normalizedIds);
        setCartItems((items) => items.filter((item) => !normalizedIds.includes(item.id)));
      } else {
        setCartItems(removeGuestCartItems(normalizedIds));
      }
      setSelectedIds((ids) => ids.filter((id) => !normalizedIds.includes(id)));
      message.success(successMessage);
      if (authenticated) dispatchDomEvent('shop:cart-updated');
    } catch (err: any) {
      message.error(getApiErrorMessage(err, t('messages.deleteFailed'), language));
    } finally {
      setRemovingItemIds((ids) => ids.filter((id) => !normalizedIds.includes(id)));
    }
  };

  const selectedItems = useMemo(
    () => cartItems.filter((item) => selectedIds.includes(item.id)),
    [cartItems, selectedIds],
  );
  const purchasableItems = useMemo(() => cartItems.filter(canCheckout), [cartItems]);
  const unavailableItems = useMemo(() => cartItems.filter((item) => !canCheckout(item)), [cartItems]);
  const savedReminderItems = useMemo(
    () => savedItems.filter((item) => getSavedAgeDays(item.savedAt) >= conversionConfig.saveForLater.reminderAfterDays),
    [savedItems],
  );
  const showRecentlyViewedRecovery = recentProducts.length > 0 && (cartItems.length === 0 || purchasableItems.length === 0);

  const selectedTotal = selectedItems.reduce((total, item) => total + getLineTotal(item), 0);
  const freeShippingThreshold = market.freeShippingThreshold;
  const freeShippingRemaining = Math.max(0, freeShippingThreshold - selectedTotal);
  const benefitTarget = getNearestCartBenefitTarget(selectedTotal, freeShippingThreshold, currency);
  const giftUnlocked = isGiftUnlocked(selectedTotal, currency);
  const freeShippingPercent = freeShippingThreshold > 0
    ? Math.min(100, Math.round((selectedTotal / freeShippingThreshold) * 100))
    : 100;
  const selectedPurchasableIds = selectedIds.filter((id) => purchasableItems.some((item) => item.id === id));
  const selectedPurchasableCount = selectedPurchasableIds.length;
  const allSelected = purchasableItems.length > 0 && selectedPurchasableCount === purchasableItems.length;
  const selectedUnitCount = selectedItems.reduce((sum, item) => sum + getLineQuantity(item.quantity), 0);
  const savedItemsTotal = savedItems.reduce((sum, item) => sum + getLineTotal(item), 0);
  const checkoutBlocked = selectedPurchasableCount === 0 || selectedItems.some((item) => !canCheckout(item));
  const toggleAll = (checked: boolean) => {
    setSelectedIds(checked ? purchasableItems.map((item) => item.id) : []);
  };

  const toggleOne = (itemId: number, checked: boolean) => {
    setSelectedIds((ids) => (checked ? Array.from(new Set([...ids, itemId])) : ids.filter((id) => id !== itemId)));
  };

  const goCheckout = () => {
    const checkoutItems = selectedItems.filter(canCheckout);
    if (checkoutItems.length === 0) {
      message.warning(t('pages.cart.chooseItems'));
      return;
    }
    syncCheckoutCartItemIds(checkoutItems);
    removeSessionStorageItem('checkoutPaymentMethod');
    navigate('/checkout');
  };

  const removeSelectedItems = () => {
    removeItems(selectedIds, t('pages.cart.removedSelected', { count: selectedIds.length }));
  };

  const clearUnavailableItems = () => {
    removeItems(unavailableItems.map((item) => item.id), t('pages.cart.clearedUnavailable', { count: unavailableItems.length }));
  };

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

  const cartNextAction = (() => {
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
        text: t('pages.cart.nextActionSelectText', { count: purchasableItems.reduce((sum, item) => sum + getLineQuantity(item.quantity), 0) }),
        label: t('pages.cart.selectCheckoutReady'),
        action: () => toggleAll(true),
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
      title: t('pages.cart.freeShippingUnlocked'),
      text: freeShippingRemaining > 0
        ? freeShippingRemainingText(freeShippingRemaining)
        : t('pages.cart.freeShippingUnlocked'),
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
      title: freeShippingRemaining > 0
        ? renderCartAmountText(t('pages.cart.readinessFreeShippingGap', { amount: formatMoney(freeShippingRemaining) }), formatMoney(freeShippingRemaining))
        : t('pages.cart.freeShippingUnlocked'),
      text: `${freeShippingPercent}%`,
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
  const browseAllProductsActionLabel = `${t('pages.cart.browse')}: ${t('pages.productList.allCategories')}`;
  const recentRecoveryBrowseActionLabel = `${t('pages.cart.browse')}: ${t('pages.cart.recentRecoveryTitle')}`;
  const deleteSelectedActionLabel = `${t('pages.cart.deleteSelected')}: ${t('pages.cart.selectedSummary', { count: selectedIds.length })}`;
  const clearUnavailableActionLabel = `${t('pages.cart.clearUnavailable')}: ${t('pages.cart.blockedItems', { count: unavailableItems.length })}`;
  const selectReadyActionLabel = `${t('pages.cart.selectCheckoutReady')}: ${t('pages.cart.readyItems', { count: purchasableItems.length })}`;
  const checkoutActionLabel = `${t('pages.cart.checkout')}: ${t('pages.cart.selectedSummary', { count: selectedUnitCount })}, ${formatMoney(selectedTotal)}`;
  const moveAllSavedActionLabel = `${t('pages.cart.moveAllToCart')}: ${t('pages.cart.saveForLaterTitle')} (${savedItems.length})`;
  const restoreSavedReminderActionLabel = `${t('pages.cart.restoreReminder')}: ${t('pages.cart.savedReminderTitle', { count: savedReminderItems.length })}`;

  const addSuggestedProduct = async (product: Product) => {
    const authenticated = hasAuthenticatedCartSession();
    if (authenticated) {
      await cartApi.addItem(0, product.id, 1);
      const response = await cartApi.getItems(0);
      setCartItems(response.data);
      const addedItemIds = response.data
        .filter((item) => item.productId === product.id && canCheckout(item))
        .map((item) => item.id);
      setSelectedIds((ids) => Array.from(new Set([...ids, ...addedItemIds])));
      dispatchDomEvent('shop:cart-updated');
      return;
    }
    addGuestCartItem(product, 1);
    const nextItems = getGuestCartItems();
    setCartItems(nextItems);
    const addedItemIds = nextItems
      .filter((item) => item.productId === product.id && canCheckout(item))
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
      message.success(t('messages.addCartSuccess'));
    } catch (err: any) {
      message.error(getApiErrorMessage(err, t('messages.addFailed'), language));
    } finally {
      setAddingRecentId(null);
    }
  };

  const columns = [
    {
      title: (
        <Checkbox checked={allSelected} indeterminate={selectedPurchasableCount > 0 && !allSelected} onChange={(e) => toggleAll(e.target.checked)}>
          {t('pages.cart.selectAll')}
        </Checkbox>
      ),
      key: 'select',
      width: 90,
      render: (_: unknown, record: CartItem) => {
        const itemName = getCartItemName(record);
        const selectItemLabel = `${t('pages.cart.selectAll')}: ${itemName}`;
        return (
          <Checkbox
            disabled={!canCheckout(record)}
            checked={selectedIds.includes(record.id)}
            aria-label={selectItemLabel}
            title={selectItemLabel}
            onChange={(e) => toggleOne(record.id, e.target.checked)}
          />
        );
      },
    },
    {
      title: t('pages.cart.product'),
      dataIndex: 'productName',
      key: 'productName',
      render: (_name: string, record: CartItem) => {
        const itemName = getCartItemName(record);
        return (
          <Space>
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
              <Link to={`/products/${record.productId}`}><Text>{itemName}</Text></Link>
              {record.selectedSpecs ? <div><Text type="secondary">{formatSelectedSpecs(record.selectedSpecs, t, language)}</Text></div> : null}
              {!canCheckout(record) && <div><Text type="danger">{t('pages.cart.unavailable')}</Text></div>}
              {canCheckout(record) && getCartItemLowStockCount(record) !== null ? (
                <div>
                  <Text type="warning" className="cart-page__urgency">
                    {t('pages.cart.lowStockLeft', { count: getCartItemLowStockCount(record) ?? 0 })}
                  </Text>
                </div>
              ) : null}
            </div>
          </Space>
        );
      },
    },
    {
      title: t('pages.cart.unitPrice'),
      dataIndex: 'price',
      key: 'price',
      width: 110,
      render: (price: number) => <Text className="cart-page__priceText commerce-money">{formatMoney(price)}</Text>,
    },
    {
      title: t('common.quantity'),
      dataIndex: 'quantity',
      key: 'quantity',
      width: 130,
      render: (_: unknown, record: CartItem) => renderQuantityControl(record),
    },
    {
      title: t('common.subtotal'),
      key: 'subtotal',
      width: 120,
      render: (_: unknown, record: CartItem) => <Text strong className="cart-page__priceText commerce-money">{formatMoney(getLineTotal(record))}</Text>,
    },
    {
      title: t('common.actions'),
      key: 'action',
      width: 150,
      render: (_: unknown, record: CartItem) => {
        const itemName = getCartItemName(record);
        const saveActionLabel = `${t('pages.cart.saveForLater')}: ${itemName}`;
        const deleteActionLabel = `${t('common.delete')}: ${itemName}`;
        return (
          <Space direction="vertical" size={2}>
            <Button type="text" icon={<ClockCircleOutlined />} size="small" aria-label={saveActionLabel} title={saveActionLabel} onClick={() => saveForLater(record)} disabled={removingItemIds.includes(record.id)}>
              {t('pages.cart.saveForLater')}
            </Button>
            <Popconfirm
              classNames={{ root: 'shop-mobile-popup-layer cart-page-popconfirm' }}
              title={t('pages.cart.deleteConfirm')}
              onConfirm={() => removeItem(record.id)}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
              okButtonProps={{ danger: true, 'aria-label': deleteActionLabel, title: deleteActionLabel }}
              cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${deleteActionLabel}`, title: `${t('common.cancel')}: ${deleteActionLabel}` }}
            >
              <Button type="text" danger icon={<DeleteOutlined />} size="small" loading={removingItemIds.includes(record.id)} aria-label={deleteActionLabel} title={deleteActionLabel}>{t('common.delete')}</Button>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  if (loading) {
    return (
      <div className={`cart-page cart-page--${language}`}>
        <section className="cart-page__hero">
          <div className="cart-page__heroContent">
            <div className="cart-page__loadingEyebrow shimmer" />
            <div className="cart-page__loadingTitle shimmer" />
            <div className="cart-page__loadingText shimmer" />
            <div className="cart-page__heroActions">
              <div className="cart-page__loadingAction shimmer" />
              <div className="cart-page__loadingAction cart-page__loadingAction--secondary shimmer" />
            </div>
          </div>
          <div className="cart-page__heroStats">
            {[1, 2, 3].map(i => <div key={i} className="cart-page__loadingStat shimmer" />)}
          </div>
        </section>
        <section className="cart-page__summaryStrip">
          <StatsStripSkeleton cols={3} />
        </section>
        <div className="cart-page__loadingProducts">
          <ProductCardSkeleton count={6} />
        </div>
      </div>
    );
  }

  if (!loading && loadError && cartItems.length === 0) {
    return (
      <div className={`cart-page cart-page--empty cart-page--${language}`}>
        <div style={{ padding: '80px 24px', textAlign: 'center' }}>
          <Alert
            type="error"
            showIcon
            message={t('messages.loadFailed')}
            description={t('pages.cart.fetchFailed')}
            style={{ maxWidth: 480, margin: '0 auto 24px' }}
            action={
              <Button
                type="primary"
                aria-label={retryCartLoadActionLabel}
                title={retryCartLoadActionLabel}
                onClick={() => { setLoading(true); fetchCartItems(); }}
              >
                {t('messages.retry')}
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  if (!loading && cartItems.length === 0 && savedItems.length === 0 && recentProducts.length === 0) {
    return (
      <div className={`cart-page cart-page--empty cart-page--${language}`}>
        <section className="cart-page__emptyHero" aria-label={t('pages.cart.empty')}>
          <span className="cart-page__emptyIcon">
            <ShoppingCartOutlined />
          </span>
          <div className="cart-page__emptyCopy">
            <span className="cart-page__emptyEyebrow">{t('pages.cart.yourCart')}</span>
            <Title level={2}>{t('pages.cart.empty')}</Title>
            <Text>{t('pages.cart.recentRecoverySubtitle')}</Text>
          </div>
          <div className="cart-page__emptyActions">
            <Button type="primary" icon={<ShoppingOutlined />} aria-label={emptyBrowseActionLabel} title={emptyBrowseActionLabel} onClick={() => navigate('/products')}>
              {t('pages.cart.browse')}
            </Button>
            <Button icon={<ShoppingOutlined />} aria-label={emptyCouponsActionLabel} title={emptyCouponsActionLabel} onClick={() => navigate('/coupons')}>
              {t('nav.coupons')}
            </Button>
            <Button icon={<ShoppingOutlined />} aria-label={emptyPetFinderActionLabel} title={emptyPetFinderActionLabel} onClick={() => navigate('/pet-finder')}>
              {t('nav.petFinder')}
            </Button>
            <Button icon={<ClockCircleOutlined />} aria-label={emptyHistoryActionLabel} title={emptyHistoryActionLabel} onClick={() => navigate('/history')}>
              {t('nav.history')}
            </Button>
          </div>
          <div className="cart-page__emptySignals">
            <span>
              <CheckCircleOutlined />
              {freeShippingThreshold > 0
                ? t('pages.cart.freeShippingRemaining', { amount: formatMoney(freeShippingThreshold) })
                : t('pages.cart.freeShippingUnlocked')}
            </span>
            <span>
              <ClockCircleOutlined />
              {t('pages.cart.saveForLaterTitle')}
            </span>
            <span>
              <ShoppingOutlined />
              {t('pages.cart.recentRecoveryTitle')}
            </span>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={`cart-page cart-page--${language}`}>
      <section className="cart-page__hero">
        <div className="cart-page__heroContent">
          <span className="cart-page__heroEyebrow">{t('pages.cart.nextActionEyebrow')}</span>
          <Title level={2}>{t('pages.cart.title')}</Title>
          <Text>{cartItems.length > 0 ? cartNextAction.text : t('pages.cart.empty')}</Text>
          <div className="cart-page__heroActions">
            {cartItems.length > 0 && cartNextAction.key === 'clear' ? (
              <Popconfirm
                classNames={{ root: 'shop-mobile-popup-layer cart-page-popconfirm' }}
                title={t('pages.cart.clearUnavailableConfirm', { count: unavailableItems.length })}
                onConfirm={cartNextAction.action}
                okText={cartNextAction.label}
                cancelText={t('common.cancel')}
                okButtonProps={{ danger: true, 'aria-label': cartNextActionLabel, title: cartNextActionLabel }}
                cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${cartNextActionLabel}`, title: `${t('common.cancel')}: ${cartNextActionLabel}` }}
              >
                <Button type="primary" aria-label={cartNextActionLabel} title={cartNextActionLabel}>
                  {cartNextAction.label}
                </Button>
              </Popconfirm>
            ) : (
              <Button
                type={cartItems.length > 0 ? 'primary' : 'default'}
                aria-label={cartItems.length > 0 ? cartNextActionLabel : emptyBrowseActionLabel}
                title={cartItems.length > 0 ? cartNextActionLabel : emptyBrowseActionLabel}
                onClick={cartItems.length > 0 ? cartNextAction.action : () => navigate('/products')}
              >
                {cartItems.length > 0 ? cartNextAction.label : t('pages.cart.browse')}
              </Button>
            )}
            <Button
              aria-label={cartItems.length > 0 ? browseAllProductsActionLabel : emptyCouponsActionLabel}
              title={cartItems.length > 0 ? browseAllProductsActionLabel : emptyCouponsActionLabel}
              onClick={() => navigate(cartItems.length > 0 ? '/products' : '/coupons')}
            >
              {cartItems.length > 0 ? t('pages.cart.browse') : t('nav.coupons')}
            </Button>
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
      {showRecentlyViewedRecovery ? (
        <Card className="cart-page__recentRecovery">
          <div className="cart-page__recentRecoveryHeader">
            <div>
              <Text strong>{t('pages.cart.recentRecoveryTitle')}</Text>
              <Text type="secondary">{t('pages.cart.recentRecoverySubtitle')}</Text>
            </div>
            <Button size="small" aria-label={recentRecoveryBrowseActionLabel} title={recentRecoveryBrowseActionLabel} onClick={() => navigate('/products')}>{t('pages.cart.browse')}</Button>
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
                      <Text strong>{productName}</Text>
                      <Text type="secondary" className="commerce-money">{formatMoney(product.effectivePrice ?? product.price)}</Text>
                    </span>
                  </button>
                  <Button
                    size="small"
                    type={needsOptionSelection(product) ? 'default' : 'primary'}
                    icon={<ShoppingCartOutlined />}
                    loading={addingRecentId === product.id}
                    aria-label={recentActionLabel}
                    title={recentActionLabel}
                    onClick={() => addRecentProduct(product)}
                  >
                    {recentActionText}
                  </Button>
                </article>
              );
            })}
          </div>
        </Card>
      ) : null}
      {cartItems.length > 0 ? (
        <>
          <Card size="small" className="cart-page__bulkActions">
            <Space wrap>
              <Popconfirm
                classNames={{ root: 'shop-mobile-popup-layer cart-page-popconfirm' }}
                title={t('pages.cart.deleteSelectedConfirm', { count: selectedIds.length })}
                disabled={selectedIds.length === 0}
                onConfirm={removeSelectedItems}
                okText={t('common.confirm')}
                cancelText={t('common.cancel')}
                okButtonProps={{ danger: true, 'aria-label': deleteSelectedActionLabel, title: deleteSelectedActionLabel }}
                cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${deleteSelectedActionLabel}`, title: `${t('common.cancel')}: ${deleteSelectedActionLabel}` }}
              >
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  disabled={selectedIds.length === 0}
                  loading={selectedIds.some((id) => removingItemIds.includes(id))}
                  aria-label={deleteSelectedActionLabel}
                  title={deleteSelectedActionLabel}
                >
                  {t('pages.cart.deleteSelected')}
                </Button>
              </Popconfirm>
              <Popconfirm
                classNames={{ root: 'shop-mobile-popup-layer cart-page-popconfirm' }}
                title={t('pages.cart.clearUnavailableConfirm', { count: unavailableItems.length })}
                disabled={unavailableItems.length === 0}
                onConfirm={clearUnavailableItems}
                okText={t('common.confirm')}
                cancelText={t('common.cancel')}
                okButtonProps={{ danger: true, 'aria-label': clearUnavailableActionLabel, title: clearUnavailableActionLabel }}
                cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${clearUnavailableActionLabel}`, title: `${t('common.cancel')}: ${clearUnavailableActionLabel}` }}
              >
                <Button
                  disabled={unavailableItems.length === 0}
                  loading={unavailableItems.some((item) => removingItemIds.includes(item.id))}
                  aria-label={clearUnavailableActionLabel}
                  title={clearUnavailableActionLabel}
                >
                  {t('pages.cart.clearUnavailable')}
                </Button>
              </Popconfirm>
              <Text type="secondary">{t('pages.cart.unavailableSummary', { count: unavailableItems.length })}</Text>
            </Space>
          </Card>
          <div className={checkoutBlocked ? 'cart-page__readiness cart-page__readiness--warning' : 'cart-page__readiness'}>
            <div className="cart-page__readinessIntro">
              {checkoutBlocked ? <ExclamationCircleOutlined /> : <CheckCircleOutlined />}
              <div>
                <Text strong>{checkoutBlocked ? t('pages.cart.readinessNeedsAction') : t('pages.cart.readinessReady')}</Text>
                <Text type="secondary">
                  {t('pages.cart.readinessSubtitle', {
                    selected: selectedUnitCount,
                    available: purchasableItems.reduce((sum, item) => sum + getLineQuantity(item.quantity), 0),
                  })}
                </Text>
              </div>
            </div>
            <div className="cart-page__readinessStats">
              <Tag color="green">{t('pages.cart.readyItems', { count: selectedPurchasableCount })}</Tag>
              <Tag color={unavailableItems.length > 0 ? 'red' : 'default'}>{t('pages.cart.blockedItems', { count: unavailableItems.length })}</Tag>
              <Tag color={freeShippingRemaining > 0 ? 'orange' : 'green'}>
                {freeShippingRemaining > 0
                  ? t('pages.cart.readinessFreeShippingGap', { amount: formatMoney(freeShippingRemaining) })
                  : t('pages.cart.freeShippingUnlocked')}
              </Tag>
              {giftUnlocked ? (
                <Tag color="green">{t('pages.cart.drawerGiftUnlocked')}</Tag>
              ) : null}
            </div>
            <div className="cart-page__readinessActions">
              <Button
                size="small"
                aria-label={selectReadyActionLabel}
                title={selectReadyActionLabel}
                onClick={() => toggleAll(true)}
                disabled={purchasableItems.length === 0 || allSelected}
              >
                {t('pages.cart.selectCheckoutReady')}
              </Button>
              {unavailableItems.length > 0 ? (
                <Popconfirm
                  classNames={{ root: 'shop-mobile-popup-layer cart-page-popconfirm' }}
                  title={t('pages.cart.clearUnavailableConfirm', { count: unavailableItems.length })}
                  onConfirm={clearUnavailableItems}
                  okText={t('common.confirm')}
                  cancelText={t('common.cancel')}
                  okButtonProps={{ danger: true, 'aria-label': clearUnavailableActionLabel, title: clearUnavailableActionLabel }}
                  cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${clearUnavailableActionLabel}`, title: `${t('common.cancel')}: ${clearUnavailableActionLabel}` }}
                >
                  <Button
                    size="small"
                    loading={unavailableItems.some((item) => removingItemIds.includes(item.id))}
                    aria-label={clearUnavailableActionLabel}
                    title={clearUnavailableActionLabel}
                  >
                    {t('pages.cart.clearUnavailable')}
                  </Button>
                </Popconfirm>
              ) : null}
            </div>
          </div>
          {cartNextAction.tone !== 'ready' ? (
            <div className={`cart-page__nextAction cart-page__nextAction--${cartNextAction.tone}`}>
              <span>
                <Text type="secondary">{t('pages.cart.nextActionEyebrow')}</Text>
                <Text strong>{cartNextAction.title}</Text>
                <Text type="secondary">{cartNextAction.text}</Text>
              </span>
              {cartNextAction.key === 'clear' ? (
                <Popconfirm
                  classNames={{ root: 'shop-mobile-popup-layer cart-page-popconfirm' }}
                  title={t('pages.cart.clearUnavailableConfirm', { count: unavailableItems.length })}
                  onConfirm={cartNextAction.action}
                  okText={cartNextAction.label}
                  cancelText={t('common.cancel')}
                  okButtonProps={{ danger: true, 'aria-label': cartNextActionLabel, title: cartNextActionLabel }}
                  cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${cartNextActionLabel}`, title: `${t('common.cancel')}: ${cartNextActionLabel}` }}
                >
                  <Button type="default" aria-label={cartNextActionLabel} title={cartNextActionLabel}>
                    {cartNextAction.label}
                  </Button>
                </Popconfirm>
              ) : (
                <Button
                  type="default"
                  aria-label={cartNextActionLabel}
                  title={cartNextActionLabel}
                  onClick={cartNextAction.action}
                  loading={cartNextAction.key === 'saved' && restoringSaved}
                >
                  {cartNextAction.label}
                </Button>
              )}
            </div>
          ) : null}
          <div className="cart-page__table">
            <Table columns={columns} dataSource={cartItems} rowKey="id" loading={loading} pagination={false} />
          </div>
          <div className="cart-page__mobileList" role="list" aria-label={t('pages.cart.title')}>
            {cartItems.map((item) => {
              const itemName = getCartItemName(item);
              const saveActionLabel = `${t('pages.cart.saveForLaterShort')}: ${itemName}`;
              const deleteActionLabel = `${t('common.delete')}: ${itemName}`;
              return (
              <Card key={item.id} size="small" className="cart-page__mobileItem" role="listitem">
                <div className="cart-page__mobileItemTop">
                  <Checkbox
                    disabled={!canCheckout(item)}
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
                    <Link className="cart-page__mobileItemTitle" to={`/products/${item.productId}`}><Text strong>{itemName}</Text></Link>
                    {item.selectedSpecs ? <div className="cart-page__mobileItemMeta"><Text type="secondary">{formatSelectedSpecs(item.selectedSpecs, t, language)}</Text></div> : null}
                    {!canCheckout(item) && <div><Text type="danger">{t('pages.cart.unavailable')}</Text></div>}
                    {canCheckout(item) && getCartItemLowStockCount(item) !== null ? (
                      <div>
                        <Text type="warning" className="cart-page__urgency">
                          {t('pages.cart.lowStockLeft', { count: getCartItemLowStockCount(item) ?? 0 })}
                        </Text>
                      </div>
                    ) : null}
                    <Text type="secondary" className="cart-page__mobileItemUnit commerce-atomic commerce-price-quantity">
                      <span className="cart-page__mobileItemUnitPrice commerce-money">{formatMoney(item.price)}</span>
                      <span className="commerce-quantity">x {item.quantity}</span>
                    </Text>
                  </div>
                </div>
                <div className="cart-page__mobileItemBottom">
                  <div className="cart-page__mobileItemCommerce">
                    {renderQuantityControl(item)}
                    <Text strong className="cart-page__priceText commerce-money">{formatMoney(getLineTotal(item))}</Text>
                  </div>
                  <div className="cart-page__mobileItemActions">
                    <Button type="text" icon={<ClockCircleOutlined />} size="small" aria-label={saveActionLabel} title={saveActionLabel} onClick={() => saveForLater(item)} disabled={removingItemIds.includes(item.id)}>
                      {t('pages.cart.saveForLaterShort')}
                    </Button>
                    <Popconfirm
                      classNames={{ root: 'shop-mobile-popup-layer cart-page-popconfirm' }}
                      title={t('pages.cart.deleteConfirm')}
                      onConfirm={() => removeItem(item.id)}
                      okText={t('common.confirm')}
                      cancelText={t('common.cancel')}
                      okButtonProps={{ danger: true, 'aria-label': deleteActionLabel, title: deleteActionLabel }}
                      cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${deleteActionLabel}`, title: `${t('common.cancel')}: ${deleteActionLabel}` }}
                    >
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        size="small"
                        loading={removingItemIds.includes(item.id)}
                        aria-label={deleteActionLabel}
                        title={deleteActionLabel}
                      />
                    </Popconfirm>
                  </div>
                </div>
              </Card>
              );
            })}
          </div>
          <Card className="cart-page__summary">
            <div className="cart-page__summaryProgress">
              <Text strong>
                {freeShippingRemaining > 0
                  ? freeShippingRemainingText(freeShippingRemaining)
                  : t('pages.cart.freeShippingUnlocked')}
              </Text>
              <Progress percent={freeShippingPercent} showInfo={false} strokeColor="#124734" />
            </div>
            <div className="cart-page__summaryFooter">
              <div>
                <Text>{t('pages.cart.selectedSummary', { count: selectedUnitCount })}</Text>
                <Text className="cart-page__total">
                  {t('common.total')}: <Text strong className="cart-page__totalAmount commerce-money">{formatMoney(selectedTotal)}</Text>
                </Text>
              </div>
              <Button type="primary" size="large" aria-label={checkoutActionLabel} title={checkoutActionLabel} onClick={goCheckout} disabled={checkoutBlocked}>
                {t('pages.cart.checkout')}
              </Button>
            </div>
          </Card>
          {selectedItems.length > 0 ? (
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
        <Card className="cart-page__emptyPanel">
          <Empty image={<ShoppingOutlined style={{ fontSize: 54, color: '#ccc' }} />} description={t('pages.cart.empty')}>
            <Button type="primary" aria-label={emptyBrowseActionLabel} title={emptyBrowseActionLabel} onClick={() => navigate('/products')}>{t('pages.cart.browse')}</Button>
          </Empty>
        </Card>
      )}
      <Card
        className="cart-page__savedCard"
        title={`${t('pages.cart.saveForLaterTitle')} (${savedItems.length})`}
        extra={savedItems.length > 0 ? (
          <Button
            size="small"
            icon={<ShoppingCartOutlined />}
            loading={restoringSaved}
            aria-label={moveAllSavedActionLabel}
            title={moveAllSavedActionLabel}
            onClick={() => moveSavedItemsToCart(savedItems)}
          >
            {t('pages.cart.moveAllToCart')}
          </Button>
        ) : null}
      >
        {savedItems.length > 0 ? (
          <div className="cart-page__savedValue">
            <ClockCircleOutlined />
            <span>
              <Text strong>{t('pages.cart.savedValueTitle')}</Text>
              <Text type="secondary" className="cart-page__amountPhrase">{savedValueText}</Text>
            </span>
          </div>
        ) : null}
        {conversionConfig.saveForLater.enabled && savedReminderItems.length > 0 ? (
          <Alert
            type="info"
            showIcon
            className="cart-page__savedReminder"
            message={t('pages.cart.savedReminderTitle', { count: savedReminderItems.length })}
            description={t('pages.cart.savedReminderText')}
            action={(
              <Button
                size="small"
                type="primary"
                loading={restoringSaved}
                aria-label={restoreSavedReminderActionLabel}
                title={restoreSavedReminderActionLabel}
                onClick={() => moveSavedItemsToCart(savedReminderItems)}
              >
                {t('pages.cart.restoreReminder')}
              </Button>
            )}
          />
        ) : null}
        {savedItems.length === 0 ? (
          <Empty description={t('pages.cart.saveForLaterEmpty')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <div className="cart-page__savedGrid">
            {savedItems.map((item) => {
              const itemName = getCartItemName(item);
              const moveActionLabel = `${t('pages.cart.moveToCart')}: ${itemName}`;
              const deleteActionLabel = `${t('common.delete')}: ${itemName}`;
              return (
              <div className="cart-page__savedItem" key={item.id}>
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
                  <Link to={`/products/${item.productId}`}><Text strong>{itemName}</Text></Link>
                  {item.selectedSpecs ? <Text type="secondary">{formatSelectedSpecs(item.selectedSpecs, t, language)}</Text> : null}
                  <Text type="secondary" className="cart-page__savedQuantity commerce-quantity">{t('common.quantity')}: {item.quantity}</Text>
                  <Tag className="cart-page__savedAge">
                    {t('pages.cart.savedDaysAgo', { count: getSavedAgeDays(item.savedAt) })}
                  </Tag>
                  <Text strong className="cart-page__savedPrice commerce-money">{formatMoney(item.price)}</Text>
                </div>
                <Space className="cart-page__savedActions">
                  <Button icon={<ShoppingCartOutlined />} aria-label={moveActionLabel} title={moveActionLabel} onClick={() => moveSavedItemToCart(item)}>
                    {t('pages.cart.moveToCart')}
                  </Button>
                  <Popconfirm
                    classNames={{ root: 'shop-mobile-popup-layer cart-page-popconfirm' }}
                    title={t('pages.cart.deleteSavedConfirm')}
                    onConfirm={() => removeSavedItem(item.id)}
                    okText={t('common.confirm')}
                    cancelText={t('common.cancel')}
                    okButtonProps={{ danger: true, 'aria-label': deleteActionLabel, title: deleteActionLabel }}
                    cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${deleteActionLabel}`, title: `${t('common.cancel')}: ${deleteActionLabel}` }}
                  >
                    <Button danger type="text" icon={<DeleteOutlined />} aria-label={deleteActionLabel} title={deleteActionLabel} />
                  </Popconfirm>
                </Space>
              </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

export default Cart;
