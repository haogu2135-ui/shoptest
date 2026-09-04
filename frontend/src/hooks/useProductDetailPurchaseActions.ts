import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { cartApi, createApiAbortController } from '../api';
import type { Language } from '../i18n';
import type { CartItem, ProductPublic as Product } from '../types';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { getApiErrorMessage } from '../utils/apiError';
import { clearCheckoutCartItemIds, syncCheckoutCartItemIds } from '../utils/cartSession';
import { dispatchDomEvent } from '../utils/domEvents';
import { addGuestCartItem } from '../utils/guestCart';
import { resolveProductPrimaryImage } from '../pages/productDetailHelpers';
import { getLocalStorageItem, removeSessionStorageItem } from '../utils/safeStorage';

type ProductVariantLike = {
  imageUrl?: string | null;
  price?: number | null;
  sku?: string | null;
  stock?: number | null;
} | null | undefined;

type UseProductDetailPurchaseActionsParams = {
  bundleInfo: { price: number; title?: string; items?: unknown[] } | null | undefined;
  id: string | undefined;
  language: Language;
  navigate: NavigateFunction;
  optionGroupsLength: number;
  product: Product | null;
  purchaseMode: 'once' | 'bundle';
  purchaseSubmitting: 'cart' | 'buy' | null;
  quantity: number;
  selectedSpecsPayload: string;
  selectedStock: number | undefined;
  selectedVariant: ProductVariantLike;
  setPurchaseSubmitting: Dispatch<SetStateAction<'cart' | 'buy' | null>>;
  t: (key: string, params?: Record<string, string | number>) => string;
  validateOptions: () => boolean;
};

export const useProductDetailPurchaseActions = ({
  bundleInfo,
  id,
  language,
  navigate,
  optionGroupsLength,
  product,
  purchaseMode,
  purchaseSubmitting,
  quantity,
  selectedSpecsPayload,
  selectedStock,
  selectedVariant,
  setPurchaseSubmitting,
  t,
  validateOptions,
}: UseProductDetailPurchaseActionsParams) => {
  const purchaseRequestKeyRef = useRef<string | null>(null);
  const purchaseRequestSeqRef = useRef(0);
  const purchaseReadAbortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      purchaseRequestSeqRef.current += 1;
      purchaseRequestKeyRef.current = null;
      purchaseReadAbortRef.current?.abort();
      purchaseReadAbortRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (mountedRef.current) setPurchaseSubmitting(null);
    return () => {
      purchaseRequestSeqRef.current += 1;
      purchaseRequestKeyRef.current = null;
      purchaseReadAbortRef.current?.abort();
      purchaseReadAbortRef.current = null;
    };
  }, [id, setPurchaseSubmitting]);

  const resolveDisplayPrice = () => {
    if (!product) return 0;
    const activePrice = selectedVariant?.price ?? product.effectivePrice ?? product.price;
    return purchaseMode === 'bundle' && bundleInfo ? bundleInfo.price : activePrice;
  };

  const buildCartProductSnapshot = () => {
    if (!product) {
      throw new Error('ProductDetail.purchase requires a loaded product');
    }
    const displayPrice = resolveDisplayPrice();
    return {
      ...product,
      stock: selectedStock,
      price: displayPrice,
      effectivePrice: displayPrice,
      imageUrl: selectedVariant?.imageUrl || resolveProductPrimaryImage(product),
    };
  };

  const findCheckoutCartItem = (items: CartItem[], specs?: string) => {
    const normalizedSpecs = specs || '';
    return [...items]
      .filter((item) => item.productId === Number(id) && (item.selectedSpecs || '') === normalizedSpecs)
      .sort((left, right) => Number(right.id || 0) - Number(left.id || 0))[0];
  };

  const handleAddToCart = async () => {
    if (!product || purchaseSubmitting || purchaseRequestKeyRef.current) return;
    const token = getLocalStorageItem('token');
    let requestSeq: number | null = null;
    try {
      if (!validateOptions()) return;
      if (selectedStock !== undefined && selectedStock < quantity) {
        announceAccessibleMessage(t('pages.productDetail.insufficientStock'), 'error');
        return;
      }
      const specs = optionGroupsLength || purchaseMode !== 'once' ? selectedSpecsPayload : undefined;
      const displayPrice = resolveDisplayPrice();
      purchaseRequestKeyRef.current = `cart:${id}:${quantity}:${specs || ''}`;
      requestSeq = purchaseRequestSeqRef.current + 1;
      purchaseRequestSeqRef.current = requestSeq;
      const isCurrentRequest = () => mountedRef.current && purchaseRequestSeqRef.current === requestSeq;
      setPurchaseSubmitting('cart');
      if (token) {
        await cartApi.addItem(0, Number(id), quantity, specs);
        if (!isCurrentRequest()) return;
        dispatchDomEvent('shop:cart-updated');
      } else {
        const cartItem = addGuestCartItem(buildCartProductSnapshot(), quantity, specs, displayPrice);
        if (!cartItem) {
          announceAccessibleMessage(t('messages.addFailed'), 'error');
          return;
        }
      }
      if (!isCurrentRequest()) return;
      announceAccessibleMessage(t('messages.addCartSuccess'), 'success');
      dispatchDomEvent('shop:open-cart');
    } catch (err: unknown) {
      if (!mountedRef.current || requestSeq === null || purchaseRequestSeqRef.current !== requestSeq) return;
      announceAccessibleMessage(getApiErrorMessage(err, t('messages.addFailed'), language), 'error');
    } finally {
      if (requestSeq !== null && purchaseRequestKeyRef.current && mountedRef.current && purchaseRequestSeqRef.current === requestSeq) {
        purchaseRequestKeyRef.current = null;
        setPurchaseSubmitting(null);
      }
    }
  };

  const handleBuyNow = async () => {
    if (!product || purchaseSubmitting || purchaseRequestKeyRef.current) return;
    const token = getLocalStorageItem('token');
    let requestSeq: number | null = null;
    const abortController = createApiAbortController();
    try {
      if (!validateOptions()) return;
      if (selectedStock !== undefined && selectedStock < quantity) {
        announceAccessibleMessage(t('pages.productDetail.insufficientStock'), 'error');
        return;
      }
      const specs = optionGroupsLength || purchaseMode !== 'once' ? selectedSpecsPayload : undefined;
      const displayPrice = resolveDisplayPrice();
      purchaseRequestKeyRef.current = `buy:${id}:${quantity}:${specs || ''}`;
      requestSeq = purchaseRequestSeqRef.current + 1;
      purchaseRequestSeqRef.current = requestSeq;
      purchaseReadAbortRef.current?.abort();
      purchaseReadAbortRef.current = abortController;
      const isCurrentRequest = () => mountedRef.current
        && purchaseRequestSeqRef.current === requestSeq
        && !abortController.signal.aborted;
      setPurchaseSubmitting('buy');
      if (token) {
        await cartApi.addItem(0, Number(id), quantity, specs);
        if (!isCurrentRequest()) return;
        dispatchDomEvent('shop:cart-updated');
        const cartRes = await cartApi.getItems(0, { signal: abortController.signal });
        if (!isCurrentRequest()) return;
        const cartItem = findCheckoutCartItem(cartRes.data, specs);
        if (cartItem) {
          syncCheckoutCartItemIds([cartItem]);
        } else {
          clearCheckoutCartItemIds();
          announceAccessibleMessage(t('messages.operationFailed'), 'error');
          return;
        }
      } else {
        const cartItem = addGuestCartItem(buildCartProductSnapshot(), quantity, specs, displayPrice);
        if (!cartItem) {
          announceAccessibleMessage(t('messages.operationFailed'), 'error');
          return;
        }
        syncCheckoutCartItemIds([cartItem]);
      }
      if (!isCurrentRequest()) return;
      removeSessionStorageItem('checkoutPaymentMethod');
      navigate('/checkout');
    } catch (err: unknown) {
      if (!mountedRef.current || requestSeq === null || purchaseRequestSeqRef.current !== requestSeq || abortController.signal.aborted) return;
      announceAccessibleMessage(getApiErrorMessage(err, t('messages.operationFailed'), language), 'error');
    } finally {
      if (abortController && purchaseReadAbortRef.current === abortController) {
        purchaseReadAbortRef.current = null;
      }
      if (requestSeq !== null && purchaseRequestKeyRef.current && mountedRef.current && purchaseRequestSeqRef.current === requestSeq && !abortController.signal.aborted) {
        purchaseRequestKeyRef.current = null;
        setPurchaseSubmitting(null);
      }
    }
  };

  return {
    handleAddToCart,
    handleBuyNow,
  };
};
