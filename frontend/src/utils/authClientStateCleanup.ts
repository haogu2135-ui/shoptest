import { clearCheckoutCartItemIds } from './cartSession';
import { clearGuestSupportContext } from './guestSupportContext';
import { clearCompareProducts } from './productCompare';
import { clearProductViewHistory } from './productViewPreferences';
import { clearSavedForLaterItems } from './saveForLater';
import { removeLocalStorageItem, removeSessionStorageItem } from './safeStorage';
import { clearStockAlerts } from './stockAlerts';
import { reportNonBlockingError } from './nonBlockingError';

const SESSION_STORAGE_KEYS = [
  'checkoutPaymentMethod',
  'checkoutGuestDraft',
];

const LOCAL_STORAGE_KEYS = [
  'shop-pet-gallery-local-likes',
];

export const clearAuthClientState = () => {
  try {
    clearCheckoutCartItemIds();
    SESSION_STORAGE_KEYS.forEach(removeSessionStorageItem);
    LOCAL_STORAGE_KEYS.forEach(removeLocalStorageItem);
    clearProductViewHistory();
    clearCompareProducts();
    clearStockAlerts();
    clearSavedForLaterItems();
    clearGuestSupportContext();
  } catch (error) {
    reportNonBlockingError('authClientStateCleanup.clearAuthClientState', error);
  }
};
