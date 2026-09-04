import { cartApi } from '../api';
import type { CartItem } from '../types';
import { dispatchDomEvent } from './domEvents';
import { getGuestCartItems } from './guestCart';
import { reportNonBlockingError } from './nonBlockingError';
import { hasStoredValue } from './safeStorage';

type OpenCartDrawerOptions = {
  authenticated?: boolean;
  items?: CartItem[];
  signal?: AbortSignal;
};

export const openCartDrawer = (items?: CartItem[]) =>
  dispatchDomEvent('shop:open-cart', Array.isArray(items) ? { items } : undefined);

export const openCartDrawerWithSnapshot = async (options: OpenCartDrawerOptions = {}) => {
  if (Array.isArray(options.items)) {
    return openCartDrawer(options.items);
  }

  const authenticated = options.authenticated ?? hasStoredValue('token');
  if (!authenticated) {
    return openCartDrawer(getGuestCartItems());
  }

  try {
    const response = options.signal
      ? await cartApi.getItems(0, { signal: options.signal })
      : await cartApi.getItems(0);
    if (options.signal?.aborted) return false;
    return openCartDrawer(response.data);
  } catch (error) {
    if (options.signal?.aborted) return false;
    reportNonBlockingError('cartDrawer.openCartDrawerWithSnapshot', error);
    return openCartDrawer();
  }
};
