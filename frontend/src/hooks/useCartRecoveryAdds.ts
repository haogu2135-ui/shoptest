import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { cartApi } from '../api';
import type { Language } from '../i18n';
import type { CartItem, ProductPublic as Product } from '../types';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { getApiErrorMessage } from '../utils/apiError';
import { hasAuthenticatedCartSession } from '../utils/cartSession';
import type { CheckoutTranslationFn } from '../utils/checkoutHelpers';
import { dispatchDomEvent } from '../utils/domEvents';
import { addGuestCartItem, getGuestCartItems } from '../utils/guestCart';
import { needsOptionSelection } from '../utils/productOptions';

const normalizeCartItems = (items: unknown): CartItem[] => (Array.isArray(items) ? items : []);

type UseCartRecoveryAddsParams = {
  canCheckout: (item: CartItem) => boolean;
  clearRecentProductsCache: () => void;
  hasStaleCartData: boolean;
  invalidateCartSnapshotRequests: () => number;
  isCurrentCartSnapshotRequest: (requestId: number) => boolean;
  language: Language;
  mountedRef: MutableRefObject<boolean>;
  navigate: NavigateFunction;
  normalizePositiveProductId: (value: unknown) => number | null;
  setAddingRecentId: Dispatch<SetStateAction<number | null>>;
  setCartItems: Dispatch<SetStateAction<CartItem[]>>;
  setSelectedIds: Dispatch<SetStateAction<number[]>>;
  t: CheckoutTranslationFn;
};

/**
 * Commercial cart recovery adds:
 * recently-viewed / suggested products re-enter cart with snapshot-safe selection.
 */
export const useCartRecoveryAdds = ({
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
}: UseCartRecoveryAddsParams) => {
  const addSuggestedProduct = useCallback(async (product: Product) => {
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
  }, [
    canCheckout,
    clearRecentProductsCache,
    hasStaleCartData,
    invalidateCartSnapshotRequests,
    isCurrentCartSnapshotRequest,
    mountedRef,
    normalizePositiveProductId,
    setCartItems,
    setSelectedIds,
    t,
  ]);

  const addRecentProduct = useCallback(async (product: Product) => {
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
  }, [addSuggestedProduct, language, navigate, setAddingRecentId, t]);

  return {
    addRecentProduct,
    addSuggestedProduct,
  };
};
