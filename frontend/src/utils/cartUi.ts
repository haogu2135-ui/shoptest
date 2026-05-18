import type { CartItem } from '../types';
import { getLowStockCount } from './conversionConfig';
import { productImageFallback, resolveProductImage } from './productMedia';

export const cartImageFallback = productImageFallback;
export const resolveCartImage = resolveProductImage;

export const isCartItemAvailable = (item: CartItem) =>
  (item.productStatus || 'ACTIVE') === 'ACTIVE' && (
    item.stock === undefined || (Number.isFinite(Number(item.stock)) && Number(item.stock) > 0)
  );

export const canCartItemCheckout = (item: CartItem) =>
  isCartItemAvailable(item) && (
    item.stock === undefined
    || Math.floor(Number(item.stock)) >= Math.max(1, Math.floor(Number(item.quantity) || 1))
  );

export const getCartItemLowStockCount = (item: CartItem) => getLowStockCount(item.stock, item.quantity);
