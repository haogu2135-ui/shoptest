import type { CartItem } from '../types';
import { reportNonBlockingError } from './nonBlockingError';
import { getLocalStorageItem, getSessionStorageItem, removeSessionStorageItem, setSessionStorageItem } from './safeStorage';

const CHECKOUT_CART_ITEM_IDS_KEY = 'checkoutCartItemIds';

const getTokenScopedCheckoutCartItemIdsKey = (token: string) => {
  let hash = 0;
  for (let index = 0; index < token.length; index += 1) {
    hash = (hash * 31 + token.charCodeAt(index)) >>> 0;
  }
  return `${CHECKOUT_CART_ITEM_IDS_KEY}:auth:${hash.toString(36)}`;
};

const getCheckoutCartItemIdsKey = () => {
  const token = getLocalStorageItem('token');
  if (!token) return `${CHECKOUT_CART_ITEM_IDS_KEY}:guest`;
  const userId = Number(getLocalStorageItem('userId'));
  if (Number.isFinite(userId) && userId > 0) {
    return `${CHECKOUT_CART_ITEM_IDS_KEY}:auth:${userId}`;
  }
  return getTokenScopedCheckoutCartItemIdsKey(token);
};

export const getAuthenticatedCartUserId = () => {
  const token = getLocalStorageItem('token');
  const userId = Number(getLocalStorageItem('userId'));
  return token && Number.isFinite(userId) && userId > 0 ? userId : null;
};

export const hasAuthenticatedCartSession = () => Boolean(getLocalStorageItem('token'));

export const readCheckoutCartItemIds = () => {
  try {
    const token = getLocalStorageItem('token');
    const legacyTokenKey = token ? getTokenScopedCheckoutCartItemIdsKey(token) : null;
    const raw = getSessionStorageItem(getCheckoutCartItemIdsKey())
      || (legacyTokenKey ? getSessionStorageItem(legacyTokenKey) : null)
      || getSessionStorageItem(CHECKOUT_CART_ITEM_IDS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const ids = Array.isArray(parsed)
      ? parsed.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0)
      : [];
    return Array.from(new Set(ids));
  } catch (error) {
    reportNonBlockingError('cartSession.readCheckoutCartItemIds', error);
    return [];
  }
};

export const syncCheckoutCartItemIds = (items: Pick<CartItem, 'id'>[]) => {
  try {
    const token = getLocalStorageItem('token');
    const currentKey = getCheckoutCartItemIdsKey();
    const ids = Array.from(new Set(
      items
        .map((item) => Number(item?.id))
        .filter((id) => Number.isSafeInteger(id) && id > 0),
    ));
    setSessionStorageItem(currentKey, JSON.stringify(ids));
    if (token) {
      const legacyTokenKey = getTokenScopedCheckoutCartItemIdsKey(token);
      if (legacyTokenKey !== currentKey) {
        removeSessionStorageItem(legacyTokenKey);
      }
    }
    removeSessionStorageItem(CHECKOUT_CART_ITEM_IDS_KEY);
  } catch (error) {
    reportNonBlockingError('cartSession.saveCheckoutCartItemIds', error);
  }
};

export const clearCheckoutCartItemIds = () => {
  try {
    const token = getLocalStorageItem('token');
    const currentKey = getCheckoutCartItemIdsKey();
    removeSessionStorageItem(currentKey);
    if (token) {
      const legacyTokenKey = getTokenScopedCheckoutCartItemIdsKey(token);
      if (legacyTokenKey !== currentKey) {
        removeSessionStorageItem(legacyTokenKey);
      }
    }
    removeSessionStorageItem(CHECKOUT_CART_ITEM_IDS_KEY);
  } catch (error) {
    reportNonBlockingError('cartSession.clearCheckoutCartItemIds', error);
  }
};
