import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { useNavigate } from 'react-router-dom';
import { wishlistApi, cartApi } from '../api';
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
import './Wishlist.css';
import '../styles/mobile-page-contrast.css';
import {
  groupWishlistItems,
  isPurchasable,
  pickFeaturedWishlistItem,
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
  const removingProductIdsRef = useRef(new Set<number>());
  const addingAllToCartRef = useRef(false);
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
  const recoveryText = directAddItems.length > 0
    ? t('pages.wishlist.recoveryDirectText', { count: directAddItems.length })
    : wishlistStats.optionCount > 0
      ? t('pages.wishlist.recoveryOptionsText', { count: wishlistStats.optionCount })
      : wishlistStats.unavailableCount > 0
        ? t('pages.wishlist.recoveryUnavailableText')
        : t('pages.wishlist.recoveryBrowseText');

  const fetchWishlist = useCallback(async () => {
    const requestSeq = wishlistFetchSeqRef.current + 1;
    wishlistFetchSeqRef.current = requestSeq;
    const isCurrentRequest = () => mountedRef.current && wishlistFetchSeqRef.current === requestSeq;
    try {
      const res = await wishlistApi.getByUser(0);
      if (!isCurrentRequest()) return;
      setItems(res.data);
      setLoadError(null);
    } catch (error) {
      if (!isCurrentRequest()) return;
      const errorMessage = getApiErrorMessage(error, t('pages.wishlist.fetchFailed'), language);
      setLoadError(errorMessage);
      reportNonBlockingError('Wishlist.fetchWishlist', error);
      announceAccessibleMessage(errorMessage, 'error');
    } finally {
      if (!isCurrentRequest()) return;
      setLoading(false);
    }
  }, [language, t]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      wishlistFetchSeqRef.current += 1;
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
  };

  const recoveryAction: WishlistAction = directAddItems.length > 0
    ? { label: t('pages.wishlist.addAllToCart'), action: handleAddAllToCart, disabled: addingAllToCart || actionsDisabledByStaleData }
    : wishlistStats.optionCount > 0
      ? { label: t('pages.wishlist.resolveOptions'), action: () => {
        const nextItem = items.find((item) => item.requiresSelection && isPurchasable(item));
        if (nextItem) navigate(`/products/${nextItem.productId}`);
      }, disabled: false }
      : { label: t('pages.wishlist.browse'), action: () => navigate('/products'), disabled: false };

  const wishlistNextAction: WishlistAction = (() => {
    if (directAddItems.length > 0) {
      return {
        tone: 'ready',
        title: t('pages.wishlist.nextActionReadyTitle'),
        text: t('pages.wishlist.nextActionReadyText', {
          count: directAddItems.length,
          amount: formatMoney(wishlistStats.readyValue),
        }),
        label: t('pages.wishlist.addAllToCart'),
        action: handleAddAllToCart,
        disabled: addingAllToCart || actionsDisabledByStaleData,
      };
    }
    if (wishlistStats.optionCount > 0) {
      return {
        tone: 'options',
        title: t('pages.wishlist.nextActionOptionsTitle'),
        text: t('pages.wishlist.nextActionOptionsText', { count: wishlistStats.optionCount }),
        label: t('pages.wishlist.resolveOptions'),
        action: recoveryAction.action,
        disabled: false,
      };
    }
    if (wishlistStats.lowStockCount > 0 && featuredWishlistItem) {
      const featuredName = wishlistProductName(featuredWishlistItem);
      return {
        tone: 'urgent',
        title: t('pages.wishlist.nextActionLowStockTitle'),
        text: t('pages.wishlist.nextActionLowStockText', { name: featuredName }),
        label: t('pages.wishlist.viewBestPick'),
        action: () => navigate(`/products/${featuredWishlistItem.productId}`),
        disabled: false,
      };
    }
    return {
      tone: 'browse',
      title: t('pages.wishlist.nextActionBrowseTitle'),
      text: t('pages.wishlist.nextActionBrowseText'),
      label: t('pages.wishlist.browsePersonalized'),
      action: () => navigate('/products?sort=personalized-desc'),
      disabled: false,
    };
  })();
  const addAllToCartActionLabel = `${t('pages.wishlist.addAllToCart')}: ${directAddItems.length}`;
  const clearUnavailableActionLabel = `${t('pages.cart.clearUnavailable')}: ${wishlistStats.unavailableCount}`;
  const recoveryActionLabel = `${recoveryAction.label}: ${recoveryText}`;
  const wishlistNextActionLabel = `${wishlistNextAction.label}: ${wishlistNextAction.title}`;
  const wishlistBrowseActionLabel = t('pages.wishlist.browse');

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

  const panelProps: WishlistPanelsProps = {
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
  };

  return <WishlistMainPanels {...panelProps} />;
};

export default Wishlist;
