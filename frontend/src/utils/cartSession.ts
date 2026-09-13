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

const getCheckoutCartItemIdsKey = (token = getLocalStorageItem('token')) => {
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
    const raw = getSessionStorageItem(getCheckoutCartItemIdsKey(token))
      || (legacyTokenKey ? getSessionStorageItem(legacyTokenKey) : null)
      || getSessionStorageItem(CHECKOUT_CART_ITEM_IDS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    const ids: number[] = [];
    const seen = new Set<number>();
    for (const value of parsed) {
      const id = Number(value);
      if (!Number.isSafeInteger(id) || id <= 0 || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
    return ids;
  } catch (error) {
    reportNonBlockingError('cartSession.readCheckoutCartItemIds', error);
    return [];
  }
};

export const syncCheckoutCartItemIds = (items: Pick<CartItem, 'id'>[]) => {
  try {
    const token = getLocalStorageItem('token');
    const currentKey = getCheckoutCartItemIdsKey(token);
    const ids: number[] = [];
    const seen = new Set<number>();
    for (const item of items) {
      const id = Number(item?.id);
      if (!Number.isSafeInteger(id) || id <= 0 || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
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
    const currentKey = getCheckoutCartItemIdsKey(token);
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
