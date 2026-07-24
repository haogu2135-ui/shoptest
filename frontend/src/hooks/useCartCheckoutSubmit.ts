import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import type { CartItem } from '../types';
import { syncCheckoutCartItemIds } from '../utils/cartSession';
import { removeSessionStorageItem } from '../utils/safeStorage';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import type { CheckoutTranslationFn } from '../utils/checkoutHelpers';

type UseCartCheckoutSubmitParams = {
  canCheckout: (item: CartItem) => boolean;
  checkoutSubmittingRef: MutableRefObject<boolean>;
  flushPendingQuantityUpdates: (items: CartItem[]) => Promise<void>;
  hasStaleCartData: boolean;
  mountedRef: MutableRefObject<boolean>;
  navigate: NavigateFunction;
  selectedItems: CartItem[];
  setCheckoutSubmitting: Dispatch<SetStateAction<boolean>>;
  t: CheckoutTranslationFn;
};

/**
 * Commercial cart -> checkout handoff:
 * flush pending quantity sync, latch submit, stamp selected cart ids, clear stale payment method.
 */
export const useCartCheckoutSubmit = ({
  canCheckout,
  checkoutSubmittingRef,
  flushPendingQuantityUpdates,
  hasStaleCartData,
  mountedRef,
  navigate,
  selectedItems,
  setCheckoutSubmitting,
  t,
}: UseCartCheckoutSubmitParams) => {
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
  }, [
    canCheckout,
    checkoutSubmittingRef,
    flushPendingQuantityUpdates,
    hasStaleCartData,
    mountedRef,
    navigate,
    selectedItems,
    setCheckoutSubmitting,
    t,
  ]);

  return { goCheckout };
};
