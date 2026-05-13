import type { CartItem } from '../types';

const CHECKOUT_CART_ITEM_IDS_KEY = 'checkoutCartItemIds';

export const getAuthenticatedCartUserId = () => {
  const token = localStorage.getItem('token');
  const userId = Number(localStorage.getItem('userId') || 0);
  return token && userId > 0 ? userId : null;
};

export const readCheckoutCartItemIds = () => {
  try {
    const raw = sessionStorage.getItem(CHECKOUT_CART_ITEM_IDS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(Number).filter(Boolean) : [];
  } catch {
    return [];
  }
};

export const syncCheckoutCartItemIds = (items: Pick<CartItem, 'id'>[]) => {
  sessionStorage.setItem(CHECKOUT_CART_ITEM_IDS_KEY, JSON.stringify(items.map((item) => item.id)));
};

export const clearCheckoutCartItemIds = () => {
  sessionStorage.removeItem(CHECKOUT_CART_ITEM_IDS_KEY);
};
