import type { WishlistItem } from '../types';
import { productImageFallback, resolveProductImage } from '../utils/productMedia';

export const WISHLIST_LOGIN_REQUIRED_MESSAGE_KEY = 'wishlist-login-required';
export const wishlistImageFallback = productImageFallback;
export const resolveWishlistImage = resolveProductImage;

export type WishlistTranslate = (key: string, params?: Record<string, string | number>) => string;

export const isPurchasable = (item: WishlistItem) =>
  (item.productStatus || 'ACTIVE') === 'ACTIVE' && (item.stock === undefined || item.stock > 0);

export const getLowStockCount = (item: WishlistItem) =>
  item.stock !== undefined && item.stock > 0 && item.stock <= 5 ? item.stock : undefined;

export type WishlistGroups = {
  directAddItems: WishlistItem[];
  optionItems: WishlistItem[];
  lowStockItems: WishlistItem[];
  unavailableItems: WishlistItem[];
  readyValue: number;
};

export const groupWishlistItems = (items: WishlistItem[]): WishlistGroups => {
  const directAddItems: WishlistItem[] = [];
  const optionItems: WishlistItem[] = [];
  const lowStockItems: WishlistItem[] = [];
  const unavailableItems: WishlistItem[] = [];
  let readyValue = 0;

  items.forEach((item) => {
    const purchasable = isPurchasable(item);
    if (!purchasable) {
      unavailableItems.push(item);
      return;
    }
    if (getLowStockCount(item) !== undefined) lowStockItems.push(item);
    if (item.requiresSelection) {
      optionItems.push(item);
    } else {
      directAddItems.push(item);
      readyValue += Number(item.productPrice || 0);
    }
  });

  return { directAddItems, optionItems, lowStockItems, unavailableItems, readyValue };
};

export const scoreWishlistItem = (item: WishlistItem) => {
  const lowStockBoost = getLowStockCount(item) !== undefined ? 48 : 0;
  const readyBoost = item.requiresSelection ? 12 : 36;
  const priceBoost = Math.min(Number(item.productPrice) || 0, 120) / 4;
  return lowStockBoost + readyBoost + priceBoost;
};

export const pickFeaturedWishlistItem = (items: WishlistItem[]) => (
  [...items]
    .filter(isPurchasable)
    .sort((a, b) => scoreWishlistItem(b) - scoreWishlistItem(a))[0]
);

export type WishlistStats = {
  optionCount: number;
  lowStockCount: number;
  unavailableCount: number;
  readyValue: number;
};

export const toWishlistStats = (groups: WishlistGroups): WishlistStats => ({
  optionCount: groups.optionItems.length,
  lowStockCount: groups.lowStockItems.length,
  unavailableCount: groups.unavailableItems.length,
  readyValue: groups.readyValue,
});
