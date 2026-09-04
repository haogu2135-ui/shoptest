import React, { useEffect, useMemo, useRef, useState } from 'react';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { useNavigate } from 'react-router-dom';
import { cartApi, createApiAbortController, productApi } from '../api';
import { useLanguage } from '../i18n';
import { usePageTitle } from '../hooks/usePageTitle';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useMarket } from '../hooks/useMarket';
import type { ProductPublic as Product } from '../types';
import { addGuestCartItem } from '../utils/guestCart';
import { clearStockAlerts, readStockAlerts, removeStockAlert, type StockAlertItem } from '../utils/stockAlerts';
import { localizeProduct } from '../utils/localizedProduct';
import { needsOptionSelection } from '../utils/productOptions';
import { dispatchDomEvent } from '../utils/domEvents';
import { getLocalStorageItem } from '../utils/safeStorage';
import { allSettledWithConcurrency } from '../utils/asyncBatch';
import { getApiErrorMessage } from '../utils/apiError';
import {
  buildStockAlertAssistantSubtitle,
  buildStockAlertMobileNextActionStatus,
  buildStockAlertsActionLabels,
  buildStockAlertsPanelProps,
  deriveStockAlertInsights,
  maskStaleStockAlertInsights,
  resolveStockAlertImage,
  resolveStockAlertNextActionDescriptor,
  stockAlertProductName as resolveStockAlertProductName,
} from './stockAlertsHelpers';
import {
  StockAlertsMainPanels,
  type StockAlertsNextAction,
  type StockAlertsPanelsProps,
} from './stockAlertsPanels';
import './StockAlerts.css';

const StockAlerts: React.FC = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  usePageTitle(t('pages.stockAlerts.title'));
  useDocumentMeta({
    title: t('pages.stockAlerts.title'),
    description: t('common.siteDescription'),
    path: '/stock-alerts',
    type: 'website',
    noIndex: true,
    siteName: t('common.siteTitle'),
  });
  const { formatMoney } = useMarket();
  const dateLocale = language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US';
  const [alerts, setAlerts] = useState<StockAlertItem[]>(() => readStockAlerts());
  const [products, setProducts] = useState<Record<number, Product>>({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [addingReady, setAddingReady] = useState(false);
  const [addingProductIds, setAddingProductIds] = useState<Set<number>>(() => new Set());
  const inFlightCartProductIds = useRef(new Set<number>());
  const addingReadyRef = useRef(false);
  const productFetchSeqRef = useRef(0);
  const productFetchAbortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const stockAlertProductName = (
    item: { productId: number; productName?: string; product?: Pick<Product, 'id' | 'name'> },
  ) => resolveStockAlertProductName(item, t);

  useEffect(() => {
    const refresh = () => setAlerts(readStockAlerts());
    window.addEventListener('shop:stock-alerts-updated', refresh);
    return () => window.removeEventListener('shop:stock-alerts-updated', refresh);
  }, []);

  useEffect(() => () => {
    mountedRef.current = false;
    productFetchSeqRef.current += 1;
    productFetchAbortRef.current?.abort();
    productFetchAbortRef.current = null;
  }, []);

  useEffect(() => {
    const loadProducts = async () => {
      const requestSeq = productFetchSeqRef.current + 1;
      productFetchSeqRef.current = requestSeq;
      productFetchAbortRef.current?.abort();
      const abortController = createApiAbortController();
      productFetchAbortRef.current = abortController;
      const isCurrentRequest = () => mountedRef.current
        && productFetchSeqRef.current === requestSeq
        && !abortController.signal.aborted;
      if (alerts.length === 0) {
        if (isCurrentRequest()) {
          setProducts({});
          setLoadError('');
          setLoading(false);
        }
        if (productFetchAbortRef.current === abortController) productFetchAbortRef.current = null;
        return;
      }
      try {
        setLoading(true);
        const productIds = Array.from(new Set(alerts.map((alert) => alert.productId)));
        const response = await productApi.getByIds(productIds, { signal: abortController.signal });
        if (!isCurrentRequest()) return;
        const nextProducts = response.data.reduce<Record<number, Product>>((acc, item) => {
          const product = localizeProduct(item, language);
          acc[product.id] = product;
          return acc;
        }, {});
        setProducts(nextProducts);
        setLoadError('');
      } catch (error: unknown) {
        if (!isCurrentRequest()) return;
        const localizedError = getApiErrorMessage(error, t('pages.stockAlerts.loadFailed'), language);
        setLoadError(localizedError);
        announceAccessibleMessage(localizedError, 'error');
      } finally {
        const shouldUpdateLoading = isCurrentRequest();
        if (productFetchAbortRef.current === abortController) productFetchAbortRef.current = null;
        if (shouldUpdateLoading) setLoading(false);
      }
    };
    loadProducts();
  }, [alerts, language, reloadKey, t]);

  const removeAlert = (productId: number) => {
    removeStockAlert(productId);
    setAlerts(readStockAlerts());
  };

  const clearAll = () => {
    clearStockAlerts();
    setAlerts([]);
    setProducts({});
  };

  const addToCart = async (product: Product, quiet = false) => {
    if (product.stock !== undefined && product.stock <= 0) {
      announceAccessibleMessage(t('pages.productDetail.insufficientStock'), 'error');
      return false;
    }
    if (needsOptionSelection(product)) {
      navigate(`/products/${product.id}`);
      return false;
    }
    if (inFlightCartProductIds.current.has(product.id)) return false;

    inFlightCartProductIds.current.add(product.id);
    setAddingProductIds((current) => new Set(current).add(product.id));
    const token = getLocalStorageItem('token');
    try {
      if (token) {
        await cartApi.addItem(0, product.id, 1);
        dispatchDomEvent('shop:cart-updated');
      } else {
        addGuestCartItem({ ...product, imageUrl: resolveStockAlertImage(product.imageUrl) }, 1, undefined, product.effectivePrice ?? product.price);
      }
      if (!quiet) {
        announceAccessibleMessage(t('messages.addCartSuccess'), 'success');
        dispatchDomEvent('shop:open-cart');
      }
      return true;
    } catch (error: unknown) {
      announceAccessibleMessage(getApiErrorMessage(error, t('messages.addFailed'), language), 'error');
      return false;
    } finally {
      inFlightCartProductIds.current.delete(product.id);
      setAddingProductIds((current) => {
        const next = new Set(current);
        next.delete(product.id);
        return next;
      });
    }
  };

  const stockAlertInsights = useMemo(
    () => deriveStockAlertInsights(alerts, products),
    [alerts, products],
  );
  const hasStaleProductData = Boolean(loadError && alerts.length > 0);
  const visibleStockAlertInsights = hasStaleProductData
    ? maskStaleStockAlertInsights(stockAlertInsights)
    : stockAlertInsights;
  const assistantSubtitle = buildStockAlertAssistantSubtitle({
    t,
    hasStaleProductData,
    bestReadyItem: visibleStockAlertInsights.bestReadyItem,
    productName: stockAlertProductName,
  });

  const addReadyItemsToCart = async () => {
    if (hasStaleProductData) {
      setReloadKey((value) => value + 1);
      return;
    }
    if (addingReadyRef.current) return;
    const readyProducts = visibleStockAlertInsights.directAddItems
      .map((item) => item.product)
      .filter((product): product is Product => Boolean(product));
    if (readyProducts.length === 0) {
      announceAccessibleMessage(t('pages.stockAlerts.noReadyToCart'), 'info');
      return;
    }

    addingReadyRef.current = true;
    setAddingReady(true);
    try {
      const results = await allSettledWithConcurrency(
        readyProducts,
        (product) => addToCart(product, true),
      );
      const added = results.filter((result) => result.status === 'fulfilled' && result.value).length;
      if (added > 0) {
        announceAccessibleMessage(t('pages.stockAlerts.addedReadyCount', { count: added }), 'success');
        dispatchDomEvent('shop:open-cart');
      }
    } finally {
      addingReadyRef.current = false;
      setAddingReady(false);
    }
  };

  const nextActionDescriptor = resolveStockAlertNextActionDescriptor({
    t,
    hasStaleProductData,
    insights: visibleStockAlertInsights,
    productName: stockAlertProductName,
  });
  const restockNextAction: StockAlertsNextAction = {
    tone: nextActionDescriptor.tone,
    title: nextActionDescriptor.title,
    text: nextActionDescriptor.text,
    label: nextActionDescriptor.label,
    action: () => {
      const intent = nextActionDescriptor.intent;
      if (intent.kind === 'retry') {
        setReloadKey((value) => value + 1);
        return;
      }
      if (intent.kind === 'add-ready') {
        void addReadyItemsToCart();
        return;
      }
      if (intent.kind === 'resume-options') {
        navigate(`/products/${intent.productId}`);
        return;
      }
      navigate('/products?sort=personalized-desc');
    },
  };
  const mobileNextActionStatus = buildStockAlertMobileNextActionStatus({
    t,
    tone: restockNextAction.tone,
    insights: visibleStockAlertInsights,
  });
  const {
    addReadyActionLabel,
    restockNextActionLabel,
    browseStockAlertsActionLabel,
    clearStockAlertsActionLabel,
  } = buildStockAlertsActionLabels({
    t,
    directReadyCount: visibleStockAlertInsights.directAddItems.length,
    nextActionLabel: restockNextAction.label,
    nextActionTitle: restockNextAction.title,
    alertCount: alerts.length,
  });

  const panelProps: StockAlertsPanelsProps = buildStockAlertsPanelProps({
    t,
    language,
    navigate,
    formatMoney,
    dateLocale,
    alerts,
    loading,
    loadError,
    hasStaleProductData,
    visibleStockAlertInsights,
    assistantSubtitle,
    restockNextAction,
    mobileNextActionStatus,
    addReadyActionLabel,
    restockNextActionLabel,
    browseStockAlertsActionLabel,
    clearStockAlertsActionLabel,
    addingReady,
    isAddingProduct: (productId: number) => addingProductIds.has(productId),
    stockAlertProductName,
    setReloadKey,
    clearAll,
    removeAlert,
    addToCart,
    addReadyItemsToCart,
  });

  return <StockAlertsMainPanels {...panelProps} />;
};

export default StockAlerts;
