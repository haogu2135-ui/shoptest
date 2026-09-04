import React, { useEffect, useMemo, useState } from 'react';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { useNavigate } from 'react-router-dom';
import { cartApi, createApiAbortController, productApi } from '../api';
import { useLanguage } from '../i18n';
import { usePageTitle } from '../hooks/usePageTitle';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useMarket } from '../hooks/useMarket';
import type { ProductPublic as Product } from '../types';
import { localizeProduct } from '../utils/localizedProduct';
import { addGuestCartItem } from '../utils/guestCart';
import { needsOptionSelection } from '../utils/productOptions';
import { dispatchDomEvent } from '../utils/domEvents';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import { getLocalStorageItem } from '../utils/safeStorage';
import { getApiErrorMessage } from '../utils/apiError';
import {
  clearProductViewHistory,
  loadProductViewPreferences,
  PRODUCT_VIEW_PREFERENCES_KEY,
  removeProductViewHistoryItem,
} from '../utils/productViewPreferences';
import {
  buildBrowsingHistoryActionLabels,
  buildBrowsingHistoryPanelProps,
  buildViewedAtById,
  deriveHistoryInsights,
  filterHistoryProducts,
  historyProductName as resolveHistoryProductName,
  isPurchasable,
  orderHistoryProducts,
  resolveHistoryNextActionDescriptor,
  type HistoryQuickFilter,
} from './browsingHistoryHelpers';
import {
  BrowsingHistoryLoadingShell,
  BrowsingHistoryMainPanels,
  type BrowsingHistoryNextAction,
  type BrowsingHistoryPanelsProps,
} from './browsingHistoryPanels';
import './BrowsingHistory.css';

const BrowsingHistory: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [quickFilter, setQuickFilter] = useState<HistoryQuickFilter>('all');
  const [preferences, setPreferences] = useState(() => loadProductViewPreferences());
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  usePageTitle(t('pages.browsingHistory.title'));
  useDocumentMeta({
    title: t('pages.browsingHistory.title'),
    description: t('common.siteDescription'),
    path: '/browsing-history',
    type: 'website',
    noIndex: true,
    siteName: t('common.siteTitle'),
  });
  const { formatMoney } = useMarket();
  const hasHistory = preferences.recent.length > 0;
  const historyProductName = (product: Pick<Product, 'id' | 'name'>) =>
    resolveHistoryProductName(product, t);

  useEffect(() => {
    let disposed = false;
    const abortController = createApiAbortController();
    const fetchProducts = async () => {
      if (!hasHistory) {
        setProducts([]);
        setLoadError(false);
        setLoading(false);
        return;
      }
      setLoading(true);
      setLoadError(false);
      try {
        const response = await productApi.getByIds(preferences.recent, { signal: abortController.signal });
        if (disposed) return;
        setProducts(response.data.map((product) => localizeProduct(product, language)));
      } catch (error) {
        if (disposed || abortController.signal.aborted) return;
        reportNonBlockingError('BrowsingHistory.fetchProducts', error);
        setLoadError(true);
      } finally {
        if (!disposed && !abortController.signal.aborted) setLoading(false);
      }
    };
    fetchProducts();
    return () => {
      disposed = true;
      abortController.abort();
    };
  }, [hasHistory, language, preferences.recent, reloadToken]);

  useEffect(() => {
    const syncPreferences = (event?: Event) => {
      if (event instanceof StorageEvent && event.key && event.key !== PRODUCT_VIEW_PREFERENCES_KEY) return;
      setPreferences(loadProductViewPreferences());
    };
    window.addEventListener('shop:product-view-preferences-updated', syncPreferences);
    window.addEventListener('storage', syncPreferences);
    return () => {
      window.removeEventListener('shop:product-view-preferences-updated', syncPreferences);
      window.removeEventListener('storage', syncPreferences);
    };
  }, []);

  const viewedAtById = useMemo(
    () => buildViewedAtById(preferences.recentEntries),
    [preferences.recentEntries],
  );

  const historyProducts = useMemo(
    () => orderHistoryProducts(products, preferences.recent),
    [preferences.recent, products],
  );
  const hasStaleHistoryData = Boolean(loadError && hasHistory);
  const historyDisplayCount = loadError ? preferences.recent.length : historyProducts.length;

  const historyInsights = useMemo(
    () => deriveHistoryInsights(historyProducts, viewedAtById),
    [historyProducts, viewedAtById],
  );

  const filteredProducts = useMemo(
    () => filterHistoryProducts({
      historyProducts,
      keyword,
      quickFilter,
      viewedAtById,
    }),
    [historyProducts, keyword, quickFilter, viewedAtById],
  );

  const clearHistory = () => {
    clearProductViewHistory();
    setPreferences(loadProductViewPreferences());
  };

  const removeItem = (productId: number) => {
    removeProductViewHistoryItem(productId);
    setPreferences(loadProductViewPreferences());
  };

  const addHistoryProductToCart = async (product: Product) => {
    if (!isPurchasable(product)) {
      announceAccessibleMessage(t('pages.browsingHistory.unavailable'), 'warning');
      return;
    }
    if (needsOptionSelection(product)) {
      navigate(`/products/${product.id}`);
      return;
    }
    const token = getLocalStorageItem('token');
    try {
      if (token) {
        await cartApi.addItem(0, product.id, 1);
      } else {
        addGuestCartItem(product, 1, undefined, product.effectivePrice ?? product.price);
      }
      announceAccessibleMessage(t('messages.addCartSuccess'), 'success');
      dispatchDomEvent('shop:cart-updated');
      dispatchDomEvent('shop:open-cart');
    } catch (err: unknown) {
      announceAccessibleMessage(getApiErrorMessage(err, t('messages.addFailed'), language), 'error');
    }
  };

  const nextActionDescriptor = resolveHistoryNextActionDescriptor({
    t,
    hasHistory,
    loadError,
    historyInsights,
    historyProductName,
  });
  const historyNextAction: BrowsingHistoryNextAction = {
    tone: nextActionDescriptor.tone,
    title: nextActionDescriptor.title,
    text: nextActionDescriptor.text,
    label: nextActionDescriptor.label,
    action: () => {
      const intent = nextActionDescriptor.intent;
      if (intent.kind === 'retry') {
        setReloadToken((current) => current + 1);
        return;
      }
      if (intent.kind === 'add-best') {
        const product = historyProducts.find((item) => item.id === intent.productId) || historyInsights.bestRecovery;
        if (product) {
          void addHistoryProductToCart(product);
        }
        return;
      }
      if (intent.kind === 'resume-product') {
        navigate(`/products/${intent.productId}`);
        return;
      }
      if (intent.kind === 'filter-low-stock') {
        setQuickFilter('lowStock');
        return;
      }
      navigate('/products?sort=personalized-desc');
    },
  };
  const {
    clearHistoryActionLabel,
    historyBrowseActionLabel,
    historyNextActionLabel,
    resetHistoryFiltersLabel,
  } = buildBrowsingHistoryActionLabels({
    t,
    recentCount: preferences.recent.length,
    nextActionLabel: historyNextAction.label,
    nextActionTitle: historyNextAction.title,
    filteredCount: filteredProducts.length,
    historyCount: historyProducts.length,
  });

  if (loading) {
    return <BrowsingHistoryLoadingShell t={t} language={language} />;
  }

  const panelProps: BrowsingHistoryPanelsProps = buildBrowsingHistoryPanelProps({
    t,
    language,
    navigate,
    formatMoney,
    hasHistory,
    hasStaleHistoryData,
    historyDisplayCount,
    historyInsights,
    filteredProducts,
    historyProducts,
    viewedAtById,
    keyword,
    setKeyword,
    quickFilter,
    setQuickFilter,
    loadError,
    setReloadToken,
    historyNextAction,
    clearHistoryActionLabel,
    historyBrowseActionLabel,
    historyNextActionLabel,
    resetHistoryFiltersLabel,
    historyProductName,
    clearHistory,
    removeItem,
    addHistoryProductToCart,
  });

  return <BrowsingHistoryMainPanels {...panelProps} />;
};

export default BrowsingHistory;
