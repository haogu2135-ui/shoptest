import React, { useCallback, useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import type { ProductPublic as Product, ProductVariant } from '../types';
import { createApiAbortController, productApi, cartApi, wishlistApi } from '../api';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { addGuestCartItem } from '../utils/guestCart';
import { buildBundleSpecs, getBundleInfo } from '../utils/bundle';
import { addCompareProduct, MAX_COMPARE_ITEMS } from '../utils/productCompare';
import { addStockAlert, removeStockAlert } from '../utils/stockAlerts';
import { selectCompatibleProductOption, type ProductOptionGroup } from '../utils/productOptions';
import { buildLoginUrlFromWindow } from '../utils/authRedirect';
import { dispatchDomEvent } from '../utils/domEvents';
import { getLocalStorageItem } from '../utils/safeStorage';
import { openCartDrawerWithSnapshot } from '../utils/cartDrawer';
import { getApiErrorMessage } from '../utils/apiError';
import type { Language } from '../i18n';
import { resolveProductPrimaryImage } from '../pages/productListHelpers';

type Translate = (key: string, params?: Record<string, string | number>) => string;

type UseProductListProductActionsArgs = {
  navigate: NavigateFunction;
  t: Translate;
  language: Language;
  isAuthenticated: boolean;
  quickAddProduct: Product | null;
  quickAddOptions: Record<string, string>;
  quickAddOptionGroups: ProductOptionGroup[];
  quickAddVariants: ProductVariant[];
  quickAddVariant: ProductVariant | undefined;
  quickAddPrice: number;
  quickAddSubmitting: boolean;
  setWishlistedProductIds: Dispatch<SetStateAction<Set<number>>>;
  setQuickAddProduct: Dispatch<SetStateAction<Product | null>>;
  setQuickAddOptions: Dispatch<SetStateAction<Record<string, string>>>;
  setQuickAddSubmitting: Dispatch<SetStateAction<boolean>>;
  setPreviewProduct: Dispatch<SetStateAction<Product | null>>;
};

export const useProductListProductActions = ({
  navigate,
  t,
  language,
  isAuthenticated,
  quickAddProduct,
  quickAddOptions,
  quickAddOptionGroups,
  quickAddVariants,
  quickAddVariant,
  quickAddPrice,
  quickAddSubmitting,
  setWishlistedProductIds,
  setQuickAddProduct,
  setQuickAddOptions,
  setQuickAddSubmitting,
  setPreviewProduct,
}: UseProductListProductActionsArgs) => {
  const mountedRef = useRef(true);
  const quickAddSubmittingRef = useRef(false);
  const quickAddReadAbortRef = useRef<AbortController | null>(null);
  const wishlistingProductIdsRef = useRef(new Set<number>());

  useEffect(() => () => {
    mountedRef.current = false;
    quickAddReadAbortRef.current?.abort();
    quickAddReadAbortRef.current = null;
    wishlistingProductIdsRef.current.clear();
  }, []);

  const buildQuickAddCartSnapshot = () => quickAddProduct ? ({
    ...quickAddProduct,
    stock: quickAddVariant?.stock ?? quickAddProduct.stock,
    price: quickAddPrice,
    effectivePrice: quickAddPrice,
    imageUrl: quickAddVariant?.imageUrl || resolveProductPrimaryImage(quickAddProduct),
  }) : null;

  const handleCompare = useCallback((e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    const result = addCompareProduct(product);
    if (result.status === 'full') {
      announceAccessibleMessage(t('pages.productList.compareFull', { count: MAX_COMPARE_ITEMS }), 'warning');
      return;
    }
    announceAccessibleMessage(result.status === 'exists' ? t('pages.productList.compareExists') : t('pages.productList.compareAdded'), 'success');
    navigate('/compare');
  }, [navigate, t]);

  const handleWishlistToggle = useCallback(async (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    if (!mountedRef.current || wishlistingProductIdsRef.current.has(product.id)) return;
    if (!isAuthenticated) {
      announceAccessibleMessage(t('messages.loginRequired'), 'warning');
      navigate(buildLoginUrlFromWindow());
      return;
    }
    wishlistingProductIdsRef.current.add(product.id);
    try {
      const res = await wishlistApi.toggle(0, product.id);
      if (!mountedRef.current) return;
      setWishlistedProductIds((current) => {
        const next = new Set(current);
        if (res.data.wishlisted) {
          next.add(product.id);
        } else {
          next.delete(product.id);
        }
        return next;
      });
      dispatchDomEvent('shop:wishlist-updated');
      announceAccessibleMessage(res.data.wishlisted ? t('pages.productDetail.favoritedMsg') : t('pages.productDetail.unfavoritedMsg'), 'success');
    } catch (error) {
      if (mountedRef.current) {
        announceAccessibleMessage(getApiErrorMessage(error, t('messages.operationFailed'), language), 'error');
      }
    } finally {
      wishlistingProductIdsRef.current.delete(product.id);
    }
  }, [isAuthenticated, language, navigate, setWishlistedProductIds, t]);

  const openProductDetail = useCallback((productId: number) => {
    navigate(`/products/${productId}`);
  }, [navigate]);

  const openQuickAdd = useCallback((e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    setQuickAddSubmitting(false);
    setQuickAddProduct(product);
    setQuickAddOptions({});
  }, [setQuickAddOptions, setQuickAddProduct, setQuickAddSubmitting]);

  const selectQuickAddOption = useCallback((groupName: string, value: string) => {
    setQuickAddOptions((current) =>
      selectCompatibleProductOption(quickAddOptionGroups, quickAddVariants, current, groupName, value),
    );
  }, [quickAddOptionGroups, quickAddVariants, setQuickAddOptions]);

  const handleStockAlert = useCallback((e: React.MouseEvent, product: Product, stockAlerted: boolean) => {
    e.stopPropagation();
    if (stockAlerted) {
      removeStockAlert(product.id);
      announceAccessibleMessage(t('pages.stockAlerts.removed'), 'success');
      return;
    }
    const result = addStockAlert(product);
    announceAccessibleMessage(result.status === 'exists' ? t('pages.stockAlerts.exists') : t('pages.stockAlerts.added'), 'success');
  }, [t]);

  const prefetchProduct = useCallback((productId: number) => {
    void productApi.prefetchById(productId);
  }, []);

  const openProductPreview = useCallback((event: React.MouseEvent, product: Product) => {
    event.stopPropagation();
    setPreviewProduct(product);
    prefetchProduct(product.id);
  }, [prefetchProduct, setPreviewProduct]);

  const submitQuickAdd = useCallback(async () => {
    if (!mountedRef.current || !quickAddProduct) return;
    if (quickAddSubmitting || quickAddSubmittingRef.current) return;
    const missingOption = quickAddOptionGroups.find((group) => !quickAddOptions[group.name]);
    if (missingOption) {
      announceAccessibleMessage(t('pages.productDetail.selectOption', { option: missingOption.name }), 'warning');
      return;
    }
    if (quickAddVariants.length > 0 && !quickAddVariant) {
      announceAccessibleMessage(t('pages.productDetail.variantUnavailable'), 'warning');
      return;
    }
    const selectedStock = quickAddVariant?.stock ?? quickAddProduct.stock;
    if (selectedStock !== undefined && selectedStock <= 0) {
      announceAccessibleMessage(t('pages.productDetail.insufficientStock'), 'error');
      return;
    }
    const bundleInfo = getBundleInfo(quickAddProduct);
    quickAddSubmittingRef.current = true;
    const abortController = createApiAbortController();
    quickAddReadAbortRef.current = abortController;
    if (bundleInfo) {
      const token = getLocalStorageItem('token');
      const selectedSpecs = buildBundleSpecs(quickAddProduct, quickAddOptions, quickAddVariant?.sku);
      const snapshot = buildQuickAddCartSnapshot();
      setQuickAddSubmitting(true);
      try {
        if (token) {
          await cartApi.addItem(0, quickAddProduct.id, 1, selectedSpecs);
          if (!mountedRef.current) return;
          dispatchDomEvent('shop:cart-updated');
        } else if (snapshot) {
          addGuestCartItem(snapshot, 1, selectedSpecs, bundleInfo.price);
        }
        if (!mountedRef.current) return;
        await openCartDrawerWithSnapshot({ authenticated: Boolean(token), signal: abortController.signal });
        if (!mountedRef.current || abortController.signal.aborted) return;
        announceAccessibleMessage(t('messages.addCartSuccess'), 'success');
        setQuickAddProduct(null);
      } catch (error) {
        if (mountedRef.current && !abortController.signal.aborted) {
          announceAccessibleMessage(getApiErrorMessage(error, t('messages.addFailed'), language), 'error');
        }
      } finally {
        quickAddSubmittingRef.current = false;
        if (quickAddReadAbortRef.current === abortController) quickAddReadAbortRef.current = null;
        if (mountedRef.current) setQuickAddSubmitting(false);
      }
      return;
    }
    const token = getLocalStorageItem('token');
    const selectedSpecs = quickAddOptionGroups.length
      ? JSON.stringify({
        ...quickAddOptions,
        ...(quickAddVariant?.sku ? { _variantSku: quickAddVariant.sku } : {}),
      })
      : undefined;
    const selectedPrice = quickAddPrice;
    const snapshot = buildQuickAddCartSnapshot();
    setQuickAddSubmitting(true);
    try {
      if (token) {
        await cartApi.addItem(0, quickAddProduct.id, 1, selectedSpecs);
        if (!mountedRef.current) return;
        dispatchDomEvent('shop:cart-updated');
      } else if (snapshot) {
        addGuestCartItem(snapshot, 1, selectedSpecs, selectedPrice);
      }
      if (!mountedRef.current) return;
      await openCartDrawerWithSnapshot({ authenticated: Boolean(token), signal: abortController.signal });
      if (!mountedRef.current || abortController.signal.aborted) return;
      announceAccessibleMessage(t('messages.addCartSuccess'), 'success');
      setQuickAddProduct(null);
    } catch (error) {
      if (mountedRef.current && !abortController.signal.aborted) {
        announceAccessibleMessage(getApiErrorMessage(error, t('messages.addFailed'), language), 'error');
      }
    } finally {
      quickAddSubmittingRef.current = false;
      if (quickAddReadAbortRef.current === abortController) quickAddReadAbortRef.current = null;
      if (mountedRef.current) setQuickAddSubmitting(false);
    }
  }, [
    language,
    quickAddOptionGroups,
    quickAddOptions,
    quickAddPrice,
    quickAddProduct,
    quickAddSubmitting,
    quickAddVariant,
    quickAddVariants,
    setQuickAddProduct,
    setQuickAddSubmitting,
    t,
  ]);

  return {
    handleCompare,
    handleWishlistToggle,
    openProductDetail,
    openQuickAdd,
    selectQuickAddOption,
    handleStockAlert,
    prefetchProduct,
    openProductPreview,
    submitQuickAdd,
  };
};
