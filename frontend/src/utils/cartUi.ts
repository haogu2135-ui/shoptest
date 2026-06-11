import type { CartItem } from '../types';
import { getLowStockCount } from './conversionConfig';
import { productImageFallback, resolveProductImage } from './productMedia';

export const cartImageFallback = productImageFallback;
export const resolveCartImage = resolveProductImage;
export const DEFAULT_CART_QUANTITY_LIMIT = 99;

const toNonNegativeFinite = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
};

const isExactZeroFinite = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric === 0;
};

const toOptionalPositiveFinite = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
};

export const roundCartMoney = (value: unknown) => {
  const numeric = toNonNegativeFinite(value);
  return Math.round((numeric + Number.EPSILON) * 100) / 100;
};

export const getCartQuantityLimit = (stock?: number | null) => {
  if (stock === undefined || stock === null) return DEFAULT_CART_QUANTITY_LIMIT;
  const numeric = Math.floor(Number(stock));
  return Number.isFinite(numeric) ? Math.max(1, numeric) : DEFAULT_CART_QUANTITY_LIMIT;
};

export const getCartLineQuantity = (quantity: unknown) => {
  const numeric = Math.floor(Number(quantity));
  return Number.isFinite(numeric) ? Math.max(1, numeric) : 1;
};

export const normalizeCartQuantity = (
  item: Pick<CartItem, 'stock'> | undefined,
  quantity: unknown,
) => Math.max(1, Math.min(getCartLineQuantity(quantity), getCartQuantityLimit(item?.stock)));

const hasAvailableStockForQuantity = (item: CartItem) => {
  if (item.stock === undefined || item.stock === null) return true;
  const stock = Math.floor(Number(item.stock));
  return Number.isFinite(stock) && stock >= getCartLineQuantity(item.quantity);
};

export const isCartItemAvailable = (item: CartItem) =>
  (item.productStatus || 'ACTIVE') === 'ACTIVE' && hasAvailableStockForQuantity(item);

export const canCartItemCheckout = (item: CartItem) =>
  isCartItemAvailable(item);

export const getCartItemLowStockCount = (item: CartItem) => getLowStockCount(item.stock, item.quantity);

export type CartShippingSummary = {
  freeShippingUnlocked: boolean;
  remainingAmount: number;
  progressPercent: number;
  threshold: number;
  allItemsQualifyForFreeShipping: boolean;
};

export const getCartLineAmount = (item: Pick<CartItem, 'price' | 'quantity'>) =>
  roundCartMoney(toNonNegativeFinite(item.price) * getCartLineQuantity(item.quantity));

export const isCartItemFreeShippingQualified = (
  item: Pick<CartItem, 'freeShipping' | 'freeShippingThreshold' | 'price' | 'quantity'>,
) => {
  if (item.freeShipping === true) return true;
  const itemThreshold = toOptionalPositiveFinite(item.freeShippingThreshold);
  return itemThreshold !== null && getCartLineAmount(item) >= itemThreshold;
};

export const deriveCartShippingSummary = (
  items: Array<Pick<CartItem, 'freeShipping' | 'freeShippingThreshold' | 'price' | 'quantity'>> | null | undefined,
  freeShippingThreshold: number,
  subtotalOverride?: number,
): CartShippingSummary => {
  const safeItems = Array.isArray(items) ? items : [];
  const subtotal = subtotalOverride === undefined
    ? roundCartMoney(safeItems.reduce((sum, item) => sum + getCartLineAmount(item), 0))
    : roundCartMoney(subtotalOverride);
  const zeroThresholdFreeShipping = isExactZeroFinite(freeShippingThreshold);
  const threshold = toNonNegativeFinite(freeShippingThreshold);
  const globalFreeShippingUnlocked = zeroThresholdFreeShipping || (threshold > 0 && subtotal >= threshold);
  const allItemsQualifyForFreeShipping = safeItems.length > 0 && safeItems.every(isCartItemFreeShippingQualified);
  const freeShippingUnlocked = globalFreeShippingUnlocked || allItemsQualifyForFreeShipping;
  const remainingAmount = freeShippingUnlocked || threshold <= 0
    ? 0
    : Math.max(0, threshold - subtotal);
  const progressPercent = freeShippingUnlocked
    ? 100
    : threshold > 0
      ? Math.min(100, Math.round((subtotal / threshold) * 100))
      : 0;

  return {
    freeShippingUnlocked,
    remainingAmount,
    progressPercent,
    threshold,
    allItemsQualifyForFreeShipping,
  };
};
