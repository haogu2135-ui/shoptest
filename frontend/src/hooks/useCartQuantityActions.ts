import type { Dispatch, SetStateAction } from 'react';
import type { CartItem } from '../types';
import { hasAuthenticatedCartSession } from '../utils/cartSession';
import { getCartLineQuantity, normalizeCartQuantity } from '../utils/cartUi';
import { updateGuestCartQuantity } from '../utils/guestCart';

const normalizeCartItems = (items: unknown): CartItem[] => (Array.isArray(items) ? items : []);

type UseCartQuantityActionsParams = {
  hasPendingQuantityTimer: (itemId: number) => boolean;
  hasStaleCartData: boolean;
  invalidateCartSnapshotRequests: () => number;
  scheduleQuantitySync: (itemId: number, quantity: number) => void;
  setCartItems: Dispatch<SetStateAction<CartItem[]>>;
  setQuantityDrafts: Dispatch<SetStateAction<Record<number, string>>>;
};

/**
 * Commercial cart quantity mutation:
 * optimistic local quantity edits + debounced authenticated sync, without stale empty drafts.
 */
export const useCartQuantityActions = ({
  hasPendingQuantityTimer,
  hasStaleCartData,
  invalidateCartSnapshotRequests,
  scheduleQuantitySync,
  setCartItems,
  setQuantityDrafts,
}: UseCartQuantityActionsParams) => {
  // Keep as a plain function (not useCallback) so rapid stepper edits always see latest cart snapshot helpers.
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

  return { updateQuantity };
};
