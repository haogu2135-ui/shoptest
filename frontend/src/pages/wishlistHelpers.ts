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

export type WishlistRecoveryIntent = 'add-all' | 'resolve-options' | 'browse';
export type WishlistNextActionIntent = 'add-all' | 'resolve-options' | 'view-featured' | 'browse-personalized';

export type WishlistRecoveryActionDescriptor = {
  label: string;
  intent: WishlistRecoveryIntent;
};

export type WishlistNextActionDescriptor = {
  tone: 'ready' | 'options' | 'urgent' | 'browse';
  title: string;
  text: string;
  label: string;
  intent: WishlistNextActionIntent;
  featuredProductId?: number;
};

export const buildWishlistRecoveryText = (params: {
  t: WishlistTranslate;
  directAddCount: number;
  optionCount: number;
  unavailableCount: number;
}) => {
  if (params.directAddCount > 0) {
    return params.t('pages.wishlist.recoveryDirectText', { count: params.directAddCount });
  }
  if (params.optionCount > 0) {
    return params.t('pages.wishlist.recoveryOptionsText', { count: params.optionCount });
  }
  if (params.unavailableCount > 0) {
    return params.t('pages.wishlist.recoveryUnavailableText');
  }
  return params.t('pages.wishlist.recoveryBrowseText');
};

export const resolveWishlistRecoveryActionDescriptor = (params: {
  t: WishlistTranslate;
  directAddCount: number;
  optionCount: number;
}): WishlistRecoveryActionDescriptor => {
  if (params.directAddCount > 0) {
    return { label: params.t('pages.wishlist.addAllToCart'), intent: 'add-all' };
  }
  if (params.optionCount > 0) {
    return { label: params.t('pages.wishlist.resolveOptions'), intent: 'resolve-options' };
  }
  return { label: params.t('pages.wishlist.browse'), intent: 'browse' };
};

export const resolveWishlistNextActionDescriptor = (params: {
  t: WishlistTranslate;
  directAddCount: number;
  readyValueLabel: string;
  optionCount: number;
  lowStockCount: number;
  featuredName?: string;
  featuredProductId?: number;
}): WishlistNextActionDescriptor => {
  if (params.directAddCount > 0) {
    return {
      tone: 'ready',
      title: params.t('pages.wishlist.nextActionReadyTitle'),
      text: params.t('pages.wishlist.nextActionReadyText', {
        count: params.directAddCount,
        amount: params.readyValueLabel,
      }),
      label: params.t('pages.wishlist.addAllToCart'),
      intent: 'add-all',
    };
  }
  if (params.optionCount > 0) {
    return {
      tone: 'options',
      title: params.t('pages.wishlist.nextActionOptionsTitle'),
      text: params.t('pages.wishlist.nextActionOptionsText', { count: params.optionCount }),
      label: params.t('pages.wishlist.resolveOptions'),
      intent: 'resolve-options',
    };
  }
  if (params.lowStockCount > 0 && params.featuredProductId != null && params.featuredName) {
    return {
      tone: 'urgent',
      title: params.t('pages.wishlist.nextActionLowStockTitle'),
      text: params.t('pages.wishlist.nextActionLowStockText', { name: params.featuredName }),
      label: params.t('pages.wishlist.viewBestPick'),
      intent: 'view-featured',
      featuredProductId: params.featuredProductId,
    };
  }
  return {
    tone: 'browse',
    title: params.t('pages.wishlist.nextActionBrowseTitle'),
    text: params.t('pages.wishlist.nextActionBrowseText'),
    label: params.t('pages.wishlist.browsePersonalized'),
    intent: 'browse-personalized',
  };
};

/** Build a11y / CTA labels for Wishlist residual modularization. */
export const buildWishlistActionLabels = (params: {
  t: WishlistTranslate;
  directAddCount: number;
  unavailableCount: number;
  recoveryActionLabelText: string;
  recoveryText: string;
  nextActionLabel: string;
  nextActionTitle: string;
}) => {
  const {
    t,
    directAddCount,
    unavailableCount,
    recoveryActionLabelText,
    recoveryText,
    nextActionLabel,
    nextActionTitle,
  } = params;
  return {
    addAllToCartActionLabel: `${t('pages.wishlist.addAllToCart')}: ${directAddCount}`,
    clearUnavailableActionLabel: `${t('pages.cart.clearUnavailable')}: ${unavailableCount}`,
    recoveryActionLabel: `${recoveryActionLabelText}: ${recoveryText}`,
    wishlistNextActionLabel: `${nextActionLabel}: ${nextActionTitle}`,
    wishlistBrowseActionLabel: t('pages.wishlist.browse'),
  };
};

/** Assemble Wishlist panel prop bag in one pure surface for residual modularization. */
export const buildWishlistPanelProps = <T extends Record<string, unknown>>(props: T): T => props;
