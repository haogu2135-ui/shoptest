import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { cartApi } from '../api';
import type { Language } from '../i18n';
import type { CartItem } from '../types';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { getApiErrorMessage } from '../utils/apiError';
import { allSettledWithConcurrency } from '../utils/asyncBatch';
import { hasAuthenticatedCartSession } from '../utils/cartSession';
import type { CheckoutTranslationFn } from '../utils/checkoutHelpers';
import { conversionConfig } from '../utils/conversionConfig';
import { dispatchDomEvent } from '../utils/domEvents';
import { addGuestCartItem, getGuestCartItems, removeGuestCartItem, removeGuestCartItems } from '../utils/guestCart';
import {
  getSavedForLaterItems,
  removeSavedForLaterItem,
  removeSavedForLaterProduct,
  replaceSavedForLaterItems,
  saveCartItemForLater,
  type SavedForLaterItem,
} from '../utils/saveForLater';

const normalizeCartItems = (items: unknown): CartItem[] => (Array.isArray(items) ? items : []);
const normalizeSavedForLaterItems = (items: unknown): SavedForLaterItem[] => (Array.isArray(items) ? items : []);
const getSavedForLaterItemsSnapshot = () => normalizeSavedForLaterItems(getSavedForLaterItems());

type UseCartItemMutationsParams = {
  canCheckout: (item: CartItem) => boolean;
  cancelPendingQuantitySync: (itemIds: number[]) => void;
  clearRecentProductsCache: () => void;
  getCartItemName: (item: Pick<CartItem, 'productId' | 'productName'>) => string;
  hasStaleCartData: boolean;
  invalidateCartSnapshotRequests: () => number;
  isCurrentCartSnapshotRequest: (requestId: number) => boolean;
  language: Language;
  mountedRef: MutableRefObject<boolean>;
  removingItemIds: number[];
  resetCheckoutStateAfterCartMutation: () => void;
  restoringSaved: boolean;
  restoringSavedItemIds: number[];
  setCartItems: Dispatch<SetStateAction<CartItem[]>>;
  setRemovingItemIds: Dispatch<SetStateAction<number[]>>;
  setRestoringSaved: Dispatch<SetStateAction<boolean>>;
  setRestoringSavedItemIds: Dispatch<SetStateAction<number[]>>;
  setSavedItems: Dispatch<SetStateAction<SavedForLaterItem[]>>;
  setSelectedIds: Dispatch<SetStateAction<number[]>>;
  t: CheckoutTranslationFn;
};

/**
 * Commercial cart item mutations:
 * remove / bulk-remove, save-for-later, and restore saved items without rolling back stale cart rows.
 */
export const useCartItemMutations = ({
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
}: UseCartItemMutationsParams) => {
  const removeItem = useCallback(async (itemId: number) => {
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
  }, [
    cancelPendingQuantitySync,
    hasStaleCartData,
    invalidateCartSnapshotRequests,
    language,
    mountedRef,
    removingItemIds,
    resetCheckoutStateAfterCartMutation,
    setCartItems,
    setRemovingItemIds,
    setSelectedIds,
    t,
  ]);

  const saveForLater = useCallback(async (item: CartItem) => {
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
  }, [
    cancelPendingQuantitySync,
    hasStaleCartData,
    invalidateCartSnapshotRequests,
    language,
    mountedRef,
    removingItemIds,
    resetCheckoutStateAfterCartMutation,
    setCartItems,
    setRemovingItemIds,
    setSavedItems,
    setSelectedIds,
    t,
  ]);

  const moveSavedItemToCart = useCallback(async (item: SavedForLaterItem) => {
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
  }, [
    canCheckout,
    clearRecentProductsCache,
    getCartItemName,
    hasStaleCartData,
    invalidateCartSnapshotRequests,
    isCurrentCartSnapshotRequest,
    language,
    mountedRef,
    restoringSaved,
    restoringSavedItemIds,
    setCartItems,
    setRestoringSavedItemIds,
    setSavedItems,
    setSelectedIds,
    t,
  ]);

  const moveSavedItemsToCart = useCallback(async (items: SavedForLaterItem[]) => {
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
  }, [
    canCheckout,
    clearRecentProductsCache,
    getCartItemName,
    hasStaleCartData,
    invalidateCartSnapshotRequests,
    isCurrentCartSnapshotRequest,
    language,
    mountedRef,
    setCartItems,
    setRestoringSaved,
    setSavedItems,
    setSelectedIds,
    t,
  ]);

  const removeSavedItem = useCallback((itemId: number) => {
    setSavedItems(normalizeSavedForLaterItems(removeSavedForLaterItem(itemId)));
    announceAccessibleMessage(t('messages.deleteSuccess'), 'success');
  }, [setSavedItems, t]);

  const removeItems = useCallback(async (itemIds: number[], successMessage: string) => {
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
  }, [
    cancelPendingQuantitySync,
    hasStaleCartData,
    invalidateCartSnapshotRequests,
    language,
    mountedRef,
    resetCheckoutStateAfterCartMutation,
    setCartItems,
    setRemovingItemIds,
    setSelectedIds,
    t,
  ]);

  return {
    moveSavedItemToCart,
    moveSavedItemsToCart,
    removeItem,
    removeItems,
    removeSavedItem,
    saveForLater,
  };
};
