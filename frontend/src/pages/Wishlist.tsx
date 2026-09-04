import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { useNavigate } from 'react-router-dom';
import { createApiAbortController, wishlistApi, cartApi } from '../api';
import type { WishlistItem } from '../types';
import { useLanguage } from '../i18n';
import { usePageTitle } from '../hooks/usePageTitle';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useMarket } from '../hooks/useMarket';
import { dispatchDomEvent } from '../utils/domEvents';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import { hasStoredValue } from '../utils/safeStorage';
import { allSettledWithConcurrency } from '../utils/asyncBatch';
import { getApiErrorMessage } from '../utils/apiError';
import {
  buildWishlistActionLabels,
  buildWishlistPanelProps,
  buildWishlistRecoveryText,
  groupWishlistItems,
  isPurchasable,
  pickFeaturedWishlistItem,
  resolveWishlistNextActionDescriptor,
  resolveWishlistRecoveryActionDescriptor,
  toWishlistStats,
} from './wishlistHelpers';
import {
  WishlistAuthGate,
  WishlistEmptyShell,
  WishlistLoadErrorShell,
  WishlistLoadingShell,
  WishlistMainPanels,
  type WishlistAction,
  type WishlistPanelsProps,
} from './wishlistPanels';
import './Wishlist.css';

export {
  WISHLIST_LOGIN_REQUIRED_MESSAGE_KEY,
  getLowStockCount,
  isPurchasable,
  groupWishlistItems,
  pickFeaturedWishlistItem,
} from './wishlistHelpers';

const Wishlist: React.FC = () => {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(() => hasStoredValue('token'));
  const [authRequired, setAuthRequired] = useState(() => !hasStoredValue('token'));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [removingProductIds, setRemovingProductIds] = useState<number[]>([]);
  const [addingAllToCart, setAddingAllToCart] = useState(false);
  const mountedRef = useRef(true);
  const wishlistFetchSeqRef = useRef(0);
  const wishlistFetchAbortRef = useRef<AbortController | null>(null);
  const removingProductIdsRef = useRef(new Set<number>());
  const addingAllToCartRef = useRef(false);
  const addingProductIdsRef = useRef(new Set<number>());
  const clearingUnavailableRef = useRef(false);
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  usePageTitle(t('pages.wishlist.pageTitle'));
  useDocumentMeta({
    title: t('pages.wishlist.pageTitle'),
    description: t('common.siteDescription'),
    path: '/wishlist',
    type: 'website',
    noIndex: true,
    siteName: t('common.siteTitle'),
  });
  const { formatMoney } = useMarket();
  const actionsDisabledByStaleData = Boolean(loadError);
  const wishlistProductName = useCallback((item: WishlistItem) =>
    (item.productName || '').trim() || t('pages.profile.productFallback', { id: item.productId }), [t]);
  const wishlistGroups = useMemo(() => groupWishlistItems(items), [items]);
  const directAddItems = wishlistGroups.directAddItems;
  const wishlistStats = toWishlistStats(wishlistGroups);
  const featuredWishlistItem = useMemo(() => pickFeaturedWishlistItem(items), [items]);
  const recoveryText = buildWishlistRecoveryText({
    t,
    directAddCount: directAddItems.length,
    optionCount: wishlistStats.optionCount,
    unavailableCount: wishlistStats.unavailableCount,
  });

  const fetchWishlist = useCallback(async () => {
    wishlistFetchAbortRef.current?.abort();
    const requestSeq = wishlistFetchSeqRef.current + 1;
    wishlistFetchSeqRef.current = requestSeq;
    const abortController = createApiAbortController();
    wishlistFetchAbortRef.current = abortController;
    const isCurrentRequest = () => mountedRef.current && wishlistFetchSeqRef.current === requestSeq;
    try {
      const res = await wishlistApi.getByUser(0, { signal: abortController.signal });
      if (!isCurrentRequest()) return;
      setItems(res.data);
      setLoadError(null);
    } catch (error) {
      if (abortController.signal.aborted) return;
      if (!isCurrentRequest()) return;
      const errorMessage = getApiErrorMessage(error, t('pages.wishlist.fetchFailed'), language);
      setLoadError(errorMessage);
      reportNonBlockingError('Wishlist.fetchWishlist', error);
      announceAccessibleMessage(errorMessage, 'error');
    } finally {
      if (wishlistFetchAbortRef.current === abortController) wishlistFetchAbortRef.current = null;
      if (!isCurrentRequest()) return;
      setLoading(false);
    }
  }, [language, t]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      wishlistFetchSeqRef.current += 1;
      wishlistFetchAbortRef.current?.abort();
      wishlistFetchAbortRef.current = null;
      addingProductIdsRef.current.clear();
      clearingUnavailableRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!hasStoredValue('token')) {
      setAuthRequired(true);
      setLoading(false);
      setItems([]);
      setLoadError(null);
      return;
    }
    setAuthRequired(false);
    setLoading(true);
    fetchWishlist();
  }, [fetchWishlist]);

  const handleRemove = async (productId: number) => {
    if (actionsDisabledByStaleData) {
      announceAccessibleMessage(t('pages.wishlist.staleActionBlocked'), 'warning');
      return;
    }
    if (removingProductIdsRef.current.has(productId)) return;
    wishlistFetchSeqRef.current += 1;
    wishlistFetchAbortRef.current?.abort();
    removingProductIdsRef.current.add(productId);
    setRemovingProductIds((current) => current.includes(productId) ? current : [...current, productId]);
    try {
      await wishlistApi.remove(0, productId);
      if (!mountedRef.current) return;
      setItems((current) => current.filter(item => item.productId !== productId));
      dispatchDomEvent('shop:wishlist-updated');
      announceAccessibleMessage(t('pages.wishlist.removed'), 'success');
    } catch (error) {
      reportNonBlockingError('Wishlist.handleRemove', error);
      if (mountedRef.current) {
        announceAccessibleMessage(t('messages.operationFailed'), 'error');
      }
    } finally {
      removingProductIdsRef.current.delete(productId);
      if (mountedRef.current) {
        setRemovingProductIds((current) => current.filter((id) => id !== productId));
      }
    }
  };

  const handleAddToCart = async (productId: number) => {
    if (actionsDisabledByStaleData) {
      announceAccessibleMessage(t('pages.wishlist.staleActionBlocked'), 'warning');
      return;
    }
    if (addingProductIdsRef.current.has(productId)) return;
    wishlistFetchSeqRef.current += 1;
    wishlistFetchAbortRef.current?.abort();
    addingProductIdsRef.current.add(productId);
    try {
      await cartApi.addItem(0, productId, 1);
      if (!mountedRef.current) return;
      announceAccessibleMessage(t('messages.addCartSuccess'), 'success');
      dispatchDomEvent('shop:cart-updated');
      dispatchDomEvent('shop:open-cart');
    } catch (err: unknown) {
      if (mountedRef.current) {
        announceAccessibleMessage(getApiErrorMessage(err, t('messages.addFailed'), language), 'error');
      }
    } finally {
      addingProductIdsRef.current.delete(productId);
    }
  };

  const handleAddAllToCart = async () => {
    if (actionsDisabledByStaleData) {
      announceAccessibleMessage(t('pages.wishlist.staleActionBlocked'), 'warning');
      return;
    }
    if (addingAllToCartRef.current) return;
    if (directAddItems.length === 0) {
      announceAccessibleMessage(t('pages.wishlist.noDirectAdd'), 'info');
      return;
    }
    addingAllToCartRef.current = true;
    wishlistFetchSeqRef.current += 1;
    wishlistFetchAbortRef.current?.abort();
    setAddingAllToCart(true);
    try {
      const results = await allSettledWithConcurrency(
        directAddItems,
        (item) => cartApi.addItem(0, item.productId, 1),
      );
      if (!mountedRef.current) return;
      const added = results.filter((result) => result.status === 'fulfilled').length;
      if (added > 0) {
        announceAccessibleMessage(t('pages.wishlist.addedAllToCart', { count: added }), 'success');
        dispatchDomEvent('shop:cart-updated');
        dispatchDomEvent('shop:open-cart');
      } else {
        announceAccessibleMessage(t('messages.addFailed'), 'error');
      }
    } finally {
      addingAllToCartRef.current = false;
      if (mountedRef.current) {
        setAddingAllToCart(false);
      }
    }
  };

  const clearUnavailableItems = async () => {
    if (actionsDisabledByStaleData) {
      announceAccessibleMessage(t('pages.wishlist.staleActionBlocked'), 'warning');
      return;
    }
    if (wishlistGroups.unavailableItems.length === 0) return;
    if (clearingUnavailableRef.current) return;
    clearingUnavailableRef.current = true;
    wishlistFetchSeqRef.current += 1;
    wishlistFetchAbortRef.current?.abort();
    try {
      const results = await allSettledWithConcurrency(
        wishlistGroups.unavailableItems,
        (item) => wishlistApi.remove(0, item.productId),
      );
      if (!mountedRef.current) return;
      const removedProductIds = new Set(
        wishlistGroups.unavailableItems
          .filter((_, index) => results[index]?.status === 'fulfilled')
          .map((item) => item.productId),
      );
      if (removedProductIds.size > 0) {
        setItems((current) => current.filter((item) => !removedProductIds.has(item.productId)));
        dispatchDomEvent('shop:wishlist-updated');
        announceAccessibleMessage(t('pages.cart.clearedUnavailable', { count: removedProductIds.size }), 'success');
        return;
      }
      announceAccessibleMessage(t('messages.operationFailed'), 'error');
    } finally {
      clearingUnavailableRef.current = false;
    }
  };

  const recoveryDescriptor = resolveWishlistRecoveryActionDescriptor({
    t,
    directAddCount: directAddItems.length,
    optionCount: wishlistStats.optionCount,
  });
  const openResolveOptions = () => {
    const nextItem = items.find((item) => item.requiresSelection && isPurchasable(item));
    if (nextItem) navigate(`/products/${nextItem.productId}`);
  };
  const recoveryAction: WishlistAction = {
    label: recoveryDescriptor.label,
    disabled: recoveryDescriptor.intent === 'add-all'
      ? addingAllToCart || actionsDisabledByStaleData
      : false,
    action: () => {
      if (recoveryDescriptor.intent === 'add-all') {
        void handleAddAllToCart();
        return;
      }
      if (recoveryDescriptor.intent === 'resolve-options') {
        openResolveOptions();
        return;
      }
      navigate('/products');
    },
  };

  const nextActionDescriptor = resolveWishlistNextActionDescriptor({
    t,
    directAddCount: directAddItems.length,
    readyValueLabel: formatMoney(wishlistStats.readyValue),
    optionCount: wishlistStats.optionCount,
    lowStockCount: wishlistStats.lowStockCount,
    featuredName: featuredWishlistItem ? wishlistProductName(featuredWishlistItem) : undefined,
    featuredProductId: featuredWishlistItem?.productId,
  });
  const wishlistNextAction: WishlistAction = {
    tone: nextActionDescriptor.tone,
    title: nextActionDescriptor.title,
    text: nextActionDescriptor.text,
    label: nextActionDescriptor.label,
    disabled: nextActionDescriptor.intent === 'add-all'
      ? addingAllToCart || actionsDisabledByStaleData
      : false,
    action: () => {
      if (nextActionDescriptor.intent === 'add-all') {
        void handleAddAllToCart();
        return;
      }
      if (nextActionDescriptor.intent === 'resolve-options') {
        openResolveOptions();
        return;
      }
      if (nextActionDescriptor.intent === 'view-featured' && nextActionDescriptor.featuredProductId != null) {
        navigate(`/products/${nextActionDescriptor.featuredProductId}`);
        return;
      }
      navigate('/products?sort=personalized-desc');
    },
  };
  const {
    addAllToCartActionLabel,
    clearUnavailableActionLabel,
    recoveryActionLabel,
    wishlistNextActionLabel,
    wishlistBrowseActionLabel,
  } = buildWishlistActionLabels({
    t,
    directAddCount: directAddItems.length,
    unavailableCount: wishlistStats.unavailableCount,
    recoveryActionLabelText: recoveryAction.label,
    recoveryText,
    nextActionLabel: wishlistNextAction.label,
    nextActionTitle: wishlistNextAction.title || '',
  });

  if (authRequired) {
    return (
      <WishlistAuthGate
        t={t}
        language={language}
        navigate={navigate}
        wishlistBrowseActionLabel={wishlistBrowseActionLabel}
      />
    );
  }

  if (loading) {
    return <WishlistLoadingShell t={t} />;
  }

  if (items.length === 0 && loadError) {
    return (
      <WishlistLoadErrorShell
        t={t}
        language={language}
        loadError={loadError}
        wishlistBrowseActionLabel={wishlistBrowseActionLabel}
        fetchWishlist={fetchWishlist}
        navigate={navigate}
      />
    );
  }

  if (items.length === 0) {
    return (
      <WishlistEmptyShell
        t={t}
        language={language}
        wishlistBrowseActionLabel={wishlistBrowseActionLabel}
        navigate={navigate}
      />
    );
  }

  const panelProps: WishlistPanelsProps = buildWishlistPanelProps({
    t,
    language,
    navigate,
    formatMoney,
    items,
    loading,
    loadError,
    directAddItems,
    wishlistStats,
    featuredWishlistItem,
    recoveryText,
    recoveryAction,
    wishlistNextAction,
    addAllToCartActionLabel,
    clearUnavailableActionLabel,
    recoveryActionLabel,
    wishlistNextActionLabel,
    wishlistBrowseActionLabel,
    addingAllToCart,
    actionsDisabledByStaleData,
    removingProductIds,
    wishlistProductName,
    fetchWishlist,
    handleAddAllToCart,
    handleAddToCart,
    handleRemove,
    clearUnavailableItems,
  });

  return <WishlistMainPanels {...panelProps} />;
};

export default Wishlist;
