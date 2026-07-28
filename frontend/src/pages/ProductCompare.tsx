import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { useNavigate } from 'react-router-dom';
import { cartApi, productApi } from '../api';
import { useLanguage } from '../i18n';
import { usePageTitle } from '../hooks/usePageTitle';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useMarket } from '../hooks/useMarket';
import type { ProductPublic as Product } from '../types';
import { addGuestCartItem } from '../utils/guestCart';
import { localizeProduct } from '../utils/localizedProduct';
import { clearCompareProducts, readCompareProductIds, removeCompareProduct } from '../utils/productCompare';
import { needsOptionSelection } from '../utils/productOptions';
import { dispatchDomEvent } from '../utils/domEvents';
import { getLocalStorageItem } from '../utils/safeStorage';
import { allSettledWithConcurrency } from '../utils/asyncBatch';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import {
  buildCompareDecision,
  getPrice,
  resolveCompareImage,
} from './productCompareHelpers';
import {
  ProductCompareMainPanels,
  type ProductComparePanelsProps,
} from './productComparePanels';
import './ProductCompare.css';

export {
  buildCompareDecision,
  collectCompareSpecKeys,
  compareImageFallback,
  getPrice,
  getSpecValue,
  isHiddenSpecKey,
  normalizeSpecValue,
  resolveCompareImage,
  valuesDiffer,
} from './productCompareHelpers';

const ProductCompare: React.FC = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  usePageTitle(t('pages.compare.title'));
  useDocumentMeta({
    title: t('pages.compare.title'),
    description: t('common.siteDescription'),
    path: '/compare',
    type: 'website',
    noIndex: true,
    siteName: t('common.siteTitle'),
  });
  const { formatMoney } = useMarket();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [compareLoadError, setCompareLoadError] = useState(false);
  const [compareLoadAttemptCount, setCompareLoadAttemptCount] = useState(0);
  const [showOnlyDifferences, setShowOnlyDifferences] = useState(false);
  const compareCopy = useMemo(() => ({
    detailDifferences: t('pages.compare.detailDifferences'),
    different: t('pages.compare.different'),
    missing: t('pages.compare.missing'),
    noDifferences: t('pages.compare.noDifferences'),
    onlyDifferent: t('pages.compare.onlyDifferent'),
    summary: (count: number) => t('pages.compare.summary', { count }),
  }), [t]);
  const compareProductName = useCallback((product: Product) =>
    (product.name || '').trim() || t('pages.profile.productFallback', { id: product.id }), [t]);

  const fetchComparedProducts = useCallback(async () => {
    const ids = readCompareProductIds();
    setCompareLoadAttemptCount(ids.length);
    if (ids.length === 0) {
      setProducts([]);
      setCompareLoadError(false);
      return;
    }
    try {
      setLoading(true);
      const response = await productApi.getByIds(ids);
      const nextProducts = response.data.map((product) => localizeProduct(product, language));
      ids
        .filter((id) => !nextProducts.some((product) => product.id === id))
        .forEach((id) => removeCompareProduct(id));
      setProducts(nextProducts);
      setCompareLoadError(false);
    } catch (error) {
      reportNonBlockingError('ProductCompare.fetchComparedProducts', error);
      setCompareLoadError(true);
      announceAccessibleMessage(t('pages.compare.loadFailed'), 'error');
    } finally {
      setLoading(false);
    }
  }, [language, t]);

  useEffect(() => {
    fetchComparedProducts();
    const refreshComparedProducts = () => fetchComparedProducts();
    const refreshComparedProductsFromStorage = (event: StorageEvent) => {
      if (event.key === 'shop-product-compare') {
        fetchComparedProducts();
      }
    };
    window.addEventListener('shop:compare-updated', refreshComparedProducts);
    window.addEventListener('storage', refreshComparedProductsFromStorage);
    return () => {
      window.removeEventListener('shop:compare-updated', refreshComparedProducts);
      window.removeEventListener('storage', refreshComparedProductsFromStorage);
    };
  }, [fetchComparedProducts]);

  const comparedIds = useMemo(() => products.map((product) => product.id), [products]);
  const directReadyProducts = useMemo(
    () => products.filter((product) => (product.stock === undefined || product.stock > 0) && !needsOptionSelection(product)),
    [products],
  );
  const compareDecision = useMemo(() => buildCompareDecision(products), [products]);
  const compareActionsDisabled = compareLoadError;

  const removeProduct = (productId: number) => {
    removeCompareProduct(productId);
    setProducts((current) => current.filter((product) => product.id !== productId));
  };

  const clearAll = () => {
    clearCompareProducts();
    setProducts([]);
    setCompareLoadAttemptCount(0);
    setCompareLoadError(false);
  };

  const addToCart = async (product: Product) => {
    if (compareActionsDisabled) {
      announceAccessibleMessage(t('pages.compare.staleDataWarning'), 'warning');
      return;
    }
    if (product.stock !== undefined && product.stock <= 0) {
      announceAccessibleMessage(t('pages.productDetail.insufficientStock'), 'error');
      return;
    }
    const token = getLocalStorageItem('token');
    try {
      if (token) {
        await cartApi.addItem(0, product.id, 1);
        dispatchDomEvent('shop:cart-updated');
      } else {
        addGuestCartItem({ ...product, imageUrl: resolveCompareImage(product.imageUrl) }, 1, undefined, getPrice(product));
      }
      announceAccessibleMessage(t('messages.addCartSuccess'), 'success');
      dispatchDomEvent('shop:open-cart');
    } catch (error) {
      reportNonBlockingError('ProductCompare.addToCart', error);
      announceAccessibleMessage(t('messages.addFailed'), 'error');
    }
  };

  const addDirectReadyProductsToCart = async () => {
    if (compareActionsDisabled) {
      announceAccessibleMessage(t('pages.compare.staleDataWarning'), 'warning');
      return;
    }
    if (directReadyProducts.length === 0) {
      announceAccessibleMessage(t('pages.compare.recommendationEmpty'), 'info');
      return;
    }
    const token = getLocalStorageItem('token');
    try {
      if (token) {
        const results = await allSettledWithConcurrency(
          directReadyProducts,
          (product) => cartApi.addItem(0, product.id, 1),
        );
        const added = results.filter((result) => result.status === 'fulfilled').length;
        if (added === 0) {
          announceAccessibleMessage(t('messages.addFailed'), 'error');
          return;
        }
        dispatchDomEvent('shop:cart-updated');
        announceAccessibleMessage(t('pages.wishlist.addedAllToCart', { count: added }), 'success');
      } else {
        directReadyProducts.forEach((product) => {
          addGuestCartItem({ ...product, imageUrl: resolveCompareImage(product.imageUrl) }, 1, undefined, getPrice(product));
        });
        announceAccessibleMessage(t('pages.wishlist.addedAllToCart', { count: directReadyProducts.length }), 'success');
      }
      dispatchDomEvent('shop:open-cart');
    } catch (error) {
      reportNonBlockingError('ProductCompare.addDirectReadyProductsToCart', error);
      announceAccessibleMessage(t('messages.addFailed'), 'error');
    }
  };

  const compareAddAllActionLabel = `${t('pages.wishlist.addAllToCart')}: ${directReadyProducts.length}`;
  const selectedCompareCount = compareLoadError && products.length === 0 ? compareLoadAttemptCount : comparedIds.length;
  const compareAddMoreActionLabel = `${t('pages.compare.addMore')}: ${selectedCompareCount}`;
  const compareClearActionLabel = `${t('pages.compare.clear')}: ${products.length}`;
  const compareBrowseActionLabel = t('pages.compare.browse');
  // differentRows length is computed in panels for toggle label copy; keep original label text using onlyDifferent key
  const compareAttributeHeader = t('pages.compare.attribute');
  const tableMinWidth = 150 + products.length * 240;

  const panelProps: ProductComparePanelsProps = {
    t,
    navigate,
    formatMoney,
    products,
    loading,
    compareLoadError,
    compareLoadAttemptCount,
    showOnlyDifferences,
    setShowOnlyDifferences,
    compareCopy,
    compareProductName,
    compareDecision,
    compareActionsDisabled,
    directReadyProducts,
    comparedIds,
    fetchComparedProducts,
    removeProduct,
    clearAll,
    addToCart,
    addDirectReadyProductsToCart,
    compareAddAllActionLabel,
    selectedCompareCount,
    compareAddMoreActionLabel,
    compareClearActionLabel,
    compareBrowseActionLabel,
    compareAttributeHeader,
    tableMinWidth,
  };

  return <ProductCompareMainPanels {...panelProps} />;
};

export default ProductCompare;
