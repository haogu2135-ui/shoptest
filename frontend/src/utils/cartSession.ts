import type { CartItem } from '../types';

const CHECKOUT_CART_ITEM_IDS_KEY = 'checkoutCartItemIds';

const getTokenScopedCheckoutCartItemIdsKey = (token: string) => {
  let hash = 0;
  for (let index = 0; index < token.length; index += 1) {
    hash = (hash * 31 + token.charCodeAt(index)) >>> 0;
  }
  return `${CHECKOUT_CART_ITEM_IDS_KEY}:auth:${hash.toString(36)}`;
};

const getCheckoutCartItemIdsKey = () => {
  const token = localStorage.getItem('token');
  if (!token) return `${CHECKOUT_CART_ITEM_IDS_KEY}:guest`;
  const userId = Number(localStorage.getItem('userId'));
  if (Number.isFinite(userId) && userId > 0) {
    return `${CHECKOUT_CART_ITEM_IDS_KEY}:auth:${userId}`;
  }
  return getTokenScopedCheckoutCartItemIdsKey(token);
};

export const getAuthenticatedCartUserId = () => {
  const token = localStorage.getItem('token');
  const userId = Number(localStorage.getItem('userId'));
  return token && Number.isFinite(userId) && userId > 0 ? userId : null;
};

export const readCheckoutCartItemIds = () => {
  try {
    const token = localStorage.getItem('token');
    const legacyTokenKey = token ? getTokenScopedCheckoutCartItemIdsKey(token) : null;
    const raw = sessionStorage.getItem(getCheckoutCartItemIdsKey())
      || (legacyTokenKey ? sessionStorage.getItem(legacyTokenKey) : null)
      || sessionStorage.getItem(CHECKOUT_CART_ITEM_IDS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const ids = Array.isArray(parsed)
      ? parsed.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0)
      : [];
    return Array.from(new Set(ids));
  } catch {
    return [];
  }
};

export const syncCheckoutCartItemIds = (items: Pick<CartItem, 'id'>[]) => {
  try {
    const token = localStorage.getItem('token');
    const currentKey = getCheckoutCartItemIdsKey();
    const ids = Array.from(new Set(
      items
        .map((item) => Number(item?.id))
        .filter((id) => Number.isSafeInteger(id) && id > 0),
    ));
    sessionStorage.setItem(currentKey, JSON.stringify(ids));
    if (token) {
      const legacyTokenKey = getTokenScopedCheckoutCartItemIdsKey(token);
      if (legacyTokenKey !== currentKey) {
        sessionStorage.removeItem(legacyTokenKey);
      }
    }
    sessionStorage.removeItem(CHECKOUT_CART_ITEM_IDS_KEY);
  } catch {
    // Checkout selection storage is best-effort in restricted browser storage modes.
  }
};

export const clearCheckoutCartItemIds = () => {
  try {
    const token = localStorage.getItem('token');
    const currentKey = getCheckoutCartItemIdsKey();
    sessionStorage.removeItem(currentKey);
    if (token) {
      const legacyTokenKey = getTokenScopedCheckoutCartItemIdsKey(token);
      if (legacyTokenKey !== currentKey) {
        sessionStorage.removeItem(legacyTokenKey);
      }
    }
    sessionStorage.removeItem(CHECKOUT_CART_ITEM_IDS_KEY);
  } catch {
    // Checkout selection cleanup is best-effort.
  }
};
