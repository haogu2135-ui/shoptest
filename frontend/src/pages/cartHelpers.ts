import type { CartItem, ProductPublic as Product } from '../types';
import { getSavedForLaterItems, type SavedForLaterItem } from '../utils/saveForLater';
import {
  canCartItemCheckout as canCheckout,
  getCartLineAmount,
  getCartLineQuantity,
  roundCartMoney,
} from '../utils/cartUi';

export const RECENT_PRODUCTS_CACHE_MS = 2 * 60 * 1000;
export const RECENT_PRODUCTS_CACHE_MAX_ENTRIES = 50;
type RecentProductsCacheEntry = { expiresAt: number; products: Product[] };
const recentProductsCache = new Map<string, RecentProductsCacheEntry>();

export const pruneRecentProductsCache = (now = Date.now()) => {
  recentProductsCache.forEach((entry, key) => {
    if (entry.expiresAt <= now) {
      recentProductsCache.delete(key);
    }
  });
  while (recentProductsCache.size > RECENT_PRODUCTS_CACHE_MAX_ENTRIES) {
    const oldestKey = recentProductsCache.keys().next().value;
    if (!oldestKey) break;
    recentProductsCache.delete(oldestKey);
  }
};

export const getCachedRecentProducts = (cacheKey: string, now = Date.now()) => {
  const cached = recentProductsCache.get(cacheKey);
  if (!cached) {
    pruneRecentProductsCache(now);
    return null;
  }
  if (cached.expiresAt <= now) {
    recentProductsCache.delete(cacheKey);
    return null;
  }
  recentProductsCache.delete(cacheKey);
  recentProductsCache.set(cacheKey, cached);
  return cached.products;
};

export const setCachedRecentProducts = (cacheKey: string, products: Product[], now = Date.now()) => {
  pruneRecentProductsCache(now);
  recentProductsCache.delete(cacheKey);
  recentProductsCache.set(cacheKey, {
    expiresAt: now + RECENT_PRODUCTS_CACHE_MS,
    products,
  });
  pruneRecentProductsCache(now);
};

export const clearRecentProductsCache = () => {
  recentProductsCache.clear();
};

export const getSavedAgeDays = (savedAt?: number) => {
  if (!savedAt) return 0;
  return Math.max(0, Math.floor((Date.now() - savedAt) / 86400000));
};

export const getLineTotal = (item: Pick<CartItem, 'price' | 'quantity'> | Pick<SavedForLaterItem, 'price' | 'quantity'>) =>
  getCartLineAmount(item);

export const normalizeCartItems = (items: unknown): CartItem[] => (Array.isArray(items) ? items : []);

export const normalizeSavedForLaterItems = (items: unknown): SavedForLaterItem[] => (Array.isArray(items) ? items : []);

export const getSavedForLaterItemsSnapshot = () => normalizeSavedForLaterItems(getSavedForLaterItems());

export const normalizePositiveProductId = (value: unknown) => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

export const deriveCartCheckoutMetrics = (
  items: unknown,
  selectedIds: number[],
  canCheckoutItem: (item: CartItem) => boolean = canCheckout,
) => {
  const selectedIdSet = new Set(selectedIds);
  const nextSelectedItems: CartItem[] = [];
  const nextPurchasableItems: CartItem[] = [];
  const nextUnavailableItems: CartItem[] = [];
  let nextSelectedTotal = 0;
  let nextSelectedUnitCount = 0;
  let nextPurchasableUnitCount = 0;
  let nextSelectedPurchasableCount = 0;
  let selectedHasUnavailableItem = false;

  normalizeCartItems(items).forEach((item) => {
    const checkoutReady = canCheckoutItem(item);
    if (checkoutReady) {
      nextPurchasableItems.push(item);
      nextPurchasableUnitCount += getCartLineQuantity(item.quantity);
    } else {
      nextUnavailableItems.push(item);
    }

    if (!selectedIdSet.has(item.id)) return;
    nextSelectedItems.push(item);
    nextSelectedTotal += getLineTotal(item);
    nextSelectedUnitCount += getCartLineQuantity(item.quantity);
    if (checkoutReady) {
      nextSelectedPurchasableCount += 1;
    } else {
      selectedHasUnavailableItem = true;
    }
  });

  return {
    checkoutBlocked: nextSelectedPurchasableCount === 0 || selectedHasUnavailableItem,
    purchasableItems: nextPurchasableItems,
    purchasableUnitCount: nextPurchasableUnitCount,
    selectedItems: nextSelectedItems,
    selectedPurchasableCount: nextSelectedPurchasableCount,
    selectedTotal: roundCartMoney(nextSelectedTotal),
    selectedUnitCount: nextSelectedUnitCount,
    unavailableItems: nextUnavailableItems,
  };
};


export type CartTranslate = (key: string, params?: Record<string, string | number>) => string;

export type CartPresentationCard = {
  key: string;
  title: string;
  text: string;
  highlightAmount?: string;
};

export const buildCartHeroHighlightDescriptors = (params: {
  t: CartTranslate;
  selectedTotalText: string;
  freeShippingStatusTitle: string;
  freeShippingProgressText: string;
  savedValueText: string;
}): CartPresentationCard[] => ([
  {
    key: 'total',
    title: params.t('common.total'),
    text: params.selectedTotalText,
  },
  {
    key: 'shipping',
    title: params.freeShippingStatusTitle,
    text: params.freeShippingProgressText,
  },
  {
    key: 'saved',
    title: params.t('pages.cart.saveForLaterTitle'),
    text: params.savedValueText,
  },
]);

export const buildCartSummaryCardDescriptors = (params: {
  t: CartTranslate;
  selectedUnitCount: number;
  selectedTotalText: string;
  freeShippingGapTitle: string;
  freeShippingProgressText: string;
  savedItemsCount: number;
}): CartPresentationCard[] => ([
  {
    key: 'selected',
    title: params.t('pages.cart.selectedSummary', { count: params.selectedUnitCount }),
    text: params.selectedTotalText,
  },
  {
    key: 'shipping',
    title: params.freeShippingGapTitle,
    text: params.freeShippingProgressText,
  },
  {
    key: 'saved',
    title: params.t('pages.cart.saveForLaterTitle'),
    text: `${params.savedItemsCount}`,
  },
]);

export const buildCartActionLabels = (params: {
  t: CartTranslate;
  cartNextActionTitle: string;
  cartNextActionPrimaryLabel: string;
  selectedIdsCount: number;
  unavailableItemsCount: number;
  purchasableItemsCount: number;
  selectedUnitCount: number;
  selectedTotalText: string;
  savedItemsCount: number;
  savedReminderItemsCount: number;
  paymentReturnOrderNo?: string | null;
}) => {
  const retryCartLoadActionLabel = `${params.t('messages.retry')}: ${params.t('pages.cart.fetchFailed')}`;
  const emptyBrowseActionLabel = `${params.t('pages.cart.browse')}: ${params.t('pages.cart.empty')}`;
  const emptyCouponsActionLabel = `${params.t('nav.coupons')}: ${params.t('pages.cart.empty')}`;
  const emptyPetFinderActionLabel = `${params.t('nav.petFinder')}: ${params.t('pages.cart.empty')}`;
  const emptyHistoryActionLabel = `${params.t('nav.history')}: ${params.t('pages.cart.recentRecoveryTitle')}`;
  const cartNextActionLabel = `${params.cartNextActionPrimaryLabel}: ${params.cartNextActionTitle}`;
  const cartTopNextActionLabel = `${params.t('pages.cart.nextActionEyebrow')}: ${cartNextActionLabel}`;
  const browseAllProductsActionLabel = `${params.t('pages.cart.browse')}: ${params.t('pages.productList.allCategories')}`;
  const recentRecoveryBrowseActionLabel = `${params.t('pages.cart.browse')}: ${params.t('pages.cart.recentRecoveryTitle')}`;
  const deleteSelectedActionLabel = `${params.t('pages.cart.deleteSelected')}: ${params.t('pages.cart.selectedSummary', { count: params.selectedIdsCount })}`;
  const clearUnavailableActionLabel = `${params.t('pages.cart.clearUnavailable')}: ${params.t('pages.cart.blockedItems', { count: params.unavailableItemsCount })}`;
  const selectReadyActionLabel = `${params.t('pages.cart.selectCheckoutReady')}: ${params.t('pages.cart.readyItems', { count: params.purchasableItemsCount })}`;
  const checkoutActionLabel = `${params.t('pages.cart.checkout')}: ${params.t('pages.cart.selectedSummary', { count: params.selectedUnitCount })}, ${params.selectedTotalText}`;
  const moveAllSavedActionLabel = `${params.t('pages.cart.moveAllToCart')}: ${params.t('pages.cart.saveForLaterTitle')} (${params.savedItemsCount})`;
  const restoreSavedReminderActionLabel = `${params.t('pages.cart.restoreReminder')}: ${params.t('pages.cart.savedReminderTitle', { count: params.savedReminderItemsCount })}`;
  const paymentCancelledResumeLabel = params.paymentReturnOrderNo
    ? `${params.t('pages.cart.paymentCancelledResume')}: ${params.paymentReturnOrderNo}`
    : params.t('pages.cart.paymentCancelledResume');
  const paymentCancelledTrackLabel = params.paymentReturnOrderNo
    ? `${params.t('pages.cart.paymentCancelledTrack')}: ${params.paymentReturnOrderNo}`
    : params.t('pages.cart.paymentCancelledTrack');
  const paymentCancelledCheckoutLabel = params.t('pages.cart.checkout');
  return {
    retryCartLoadActionLabel,
    emptyBrowseActionLabel,
    emptyCouponsActionLabel,
    emptyPetFinderActionLabel,
    emptyHistoryActionLabel,
    cartNextActionLabel,
    cartTopNextActionLabel,
    browseAllProductsActionLabel,
    recentRecoveryBrowseActionLabel,
    deleteSelectedActionLabel,
    clearUnavailableActionLabel,
    selectReadyActionLabel,
    checkoutActionLabel,
    moveAllSavedActionLabel,
    restoreSavedReminderActionLabel,
    paymentCancelledResumeLabel,
    paymentCancelledTrackLabel,
    paymentCancelledCheckoutLabel,
  };
};

export type CartNextActionIntent =
  | 'refresh'
  | 'clear-unavailable'
  | 'select-ready'
  | 'checkout'
  | 'find-addon'
  | 'restore-saved';

export type CartNextActionDescriptor = {
  key: string;
  tone: 'warning' | 'ready' | 'warm';
  title: string;
  text: string;
  label: string;
  intent: CartNextActionIntent;
  highlightAmount?: string;
};

export const resolveCartNextActionDescriptor = (params: {
  t: CartTranslate;
  hasStaleCartData: boolean;
  unavailableItemsCount: number;
  selectedItemsCount: number;
  purchasableItemsCount: number;
  purchasableUnitCount: number;
  selectedCanCheckout: boolean;
  selectedTotalText: string;
  benefitTargetReason?: string | null;
  benefitTargetRemainingText?: string | null;
  savedReminderItemsCount: number;
}): CartNextActionDescriptor => {
  if (params.hasStaleCartData) {
    return {
      key: 'refresh',
      tone: 'warning',
      title: params.t('pages.cart.nextActionRefreshTitle'),
      text: params.t('pages.cart.nextActionRefreshText'),
      label: params.t('messages.retry'),
      intent: 'refresh',
    };
  }
  if (params.unavailableItemsCount > 0) {
    return {
      key: 'clear',
      tone: 'warning',
      title: params.t('pages.cart.nextActionClearTitle'),
      text: params.t('pages.cart.nextActionClearText', { count: params.unavailableItemsCount }),
      label: params.t('pages.cart.clearUnavailable'),
      intent: 'clear-unavailable',
    };
  }
  if (params.selectedItemsCount === 0 && params.purchasableItemsCount > 0) {
    return {
      key: 'select',
      tone: 'warning',
      title: params.t('pages.cart.nextActionSelectTitle'),
      text: params.t('pages.cart.nextActionSelectText', { count: params.purchasableUnitCount }),
      label: params.t('pages.cart.selectCheckoutReady'),
      intent: 'select-ready',
    };
  }
  if (params.selectedCanCheckout) {
    return {
      key: 'checkout',
      tone: 'ready',
      title: params.t('pages.cart.nextActionCheckoutTitle'),
      text: params.t('pages.cart.nextActionCheckoutText', { amount: params.selectedTotalText }),
      label: params.t('pages.cart.checkout'),
      intent: 'checkout',
      highlightAmount: params.selectedTotalText,
    };
  }
  if (params.selectedItemsCount > 0 && params.benefitTargetReason && params.benefitTargetRemainingText) {
    const isGift = params.benefitTargetReason === 'gift';
    return {
      key: params.benefitTargetReason,
      tone: 'warm',
      title: isGift
        ? params.t('pages.cart.nextActionGiftTitle')
        : params.t('pages.cart.nextActionShippingTitle'),
      text: isGift
        ? params.t('pages.cart.nextActionGiftText', { amount: params.benefitTargetRemainingText })
        : params.t('pages.cart.nextActionShippingText', { amount: params.benefitTargetRemainingText }),
      label: params.t('pages.cart.nextActionFindAddOn'),
      intent: 'find-addon',
      highlightAmount: params.benefitTargetRemainingText,
    };
  }
  if (params.savedReminderItemsCount > 0) {
    return {
      key: 'saved',
      tone: 'warm',
      title: params.t('pages.cart.nextActionSavedTitle'),
      text: params.t('pages.cart.nextActionSavedText', { count: params.savedReminderItemsCount }),
      label: params.t('pages.cart.restoreReminder'),
      intent: 'restore-saved',
    };
  }
  return {
    key: 'checkout',
    tone: 'ready',
    title: params.t('pages.cart.nextActionCheckoutTitle'),
    text: params.t('pages.cart.nextActionCheckoutText', { amount: params.selectedTotalText }),
    label: params.t('pages.cart.checkout'),
    intent: 'checkout',
    highlightAmount: params.selectedTotalText,
  };
};


export type CartShippingPresentation = {
  freeShippingStatusTitle: string;
  freeShippingStatusHighlightAmount?: string;
  freeShippingGapTitle: string;
  freeShippingGapHighlightAmount?: string;
  freeShippingProgressText: string;
  savedValueText: string;
  savedValueHighlightAmount?: string;
};

export const buildCartShippingPresentation = (params: {
  t: CartTranslate;
  freeShippingUnlocked: boolean;
  freeShippingRemaining: number;
  freeShippingPercent: number;
  freeShippingRemainingMoney: string;
  savedItemsCount: number;
  savedItemsTotalMoney: string;
}): CartShippingPresentation => {
  const hasShippingGap = !params.freeShippingUnlocked && params.freeShippingRemaining > 0;
  return {
    freeShippingStatusTitle: params.freeShippingUnlocked
      ? params.t('pages.cart.freeShippingUnlocked')
      : hasShippingGap
        ? params.t('pages.cart.freeShippingRemaining', { amount: params.freeShippingRemainingMoney })
        : params.t('pages.cart.shippingCalculatedAtCheckout'),
    freeShippingStatusHighlightAmount: hasShippingGap ? params.freeShippingRemainingMoney : undefined,
    freeShippingGapTitle: params.freeShippingUnlocked
      ? params.t('pages.cart.freeShippingUnlocked')
      : hasShippingGap
        ? params.t('pages.cart.readinessFreeShippingGap', { amount: params.freeShippingRemainingMoney })
        : params.t('pages.cart.shippingCalculatedAtCheckout'),
    freeShippingGapHighlightAmount: hasShippingGap ? params.freeShippingRemainingMoney : undefined,
    freeShippingProgressText: params.freeShippingUnlocked
      ? params.t('pages.cart.freeShippingUnlocked')
      : `${params.freeShippingPercent}%`,
    savedValueText: params.t('pages.cart.savedValueText', {
      count: params.savedItemsCount,
      amount: params.savedItemsTotalMoney,
    }),
    savedValueHighlightAmount: params.savedItemsCount > 0 ? params.savedItemsTotalMoney : undefined,
  };
};
