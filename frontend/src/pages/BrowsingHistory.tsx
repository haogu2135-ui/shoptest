import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Empty, Input, message, Popconfirm, Spin, Tag, Typography } from 'antd';
import { ClockCircleOutlined, DeleteOutlined, FireOutlined, HistoryOutlined, ReloadOutlined, SearchOutlined, ShoppingCartOutlined, ShoppingOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { cartApi, productApi } from '../api';
import { useLanguage } from '../i18n';
import { useMarket } from '../hooks/useMarket';
import type { ProductPublic as Product } from '../types';
import { localizeProduct } from '../utils/localizedProduct';
import { getLowStockCount } from '../utils/conversionConfig';
import { addGuestCartItem } from '../utils/guestCart';
import { needsOptionSelection } from '../utils/productOptions';
import { productImageFallback, resolveProductImage } from '../utils/productMedia';
import { dispatchDomEvent } from '../utils/domEvents';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import { getLocalStorageItem } from '../utils/safeStorage';
import { getApiErrorMessage } from '../utils/apiError';
import PageError from '../components/PageError';
import {
  clearProductViewHistory,
  loadProductViewPreferences,
  PRODUCT_VIEW_PREFERENCES_KEY,
  removeProductViewHistoryItem,
} from '../utils/productViewPreferences';
import './BrowsingHistory.css';
import '../styles/mobile-page-contrast.css';

const fallbackImage = productImageFallback;
const { Paragraph, Title } = Typography;
type HistoryQuickFilter = 'all' | 'recent' | 'deals' | 'lowStock';
const resolveHistoryImage = resolveProductImage;

const isDealProduct = (product: Product) => {
  const activePrice = Number(product.effectivePrice ?? product.price ?? 0);
  const originalPrice = Number(product.originalPrice ?? 0);
  return Number(product.discount || product.effectiveDiscountPercent || 0) > 0 || (originalPrice > activePrice && activePrice > 0);
};

const isPurchasable = (product: Product) =>
  product.stock === undefined || product.stock > 0;

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
  const { formatMoney } = useMarket();
  const hasHistory = preferences.recent.length > 0;
  const historyProductName = (product: Pick<Product, 'id' | 'name'>) =>
    (product.name || '').trim() || t('pages.profile.productFallback', { id: product.id });

  useEffect(() => {
    let disposed = false;
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
        const response = await productApi.getByIds(preferences.recent);
        if (disposed) return;
        setProducts(response.data.map((product) => localizeProduct(product, language)));
      } catch (error) {
        reportNonBlockingError('BrowsingHistory.fetchProducts', error);
        if (disposed) return;
        setLoadError(true);
      } finally {
        if (!disposed) setLoading(false);
      }
    };
    fetchProducts();
    return () => {
      disposed = true;
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
    () => new Map(preferences.recentEntries.map((entry) => [entry.productId, entry.viewedAt])),
    [preferences.recentEntries],
  );

  const historyProducts = useMemo(() => {
    const productById = new Map(products.map((product) => [product.id, product]));
    return preferences.recent
      .map((productId) => productById.get(productId))
      .filter(Boolean) as Product[];
  }, [preferences.recent, products]);
  const hasStaleHistoryData = Boolean(loadError && hasHistory);
  const historyDisplayCount = loadError ? preferences.recent.length : historyProducts.length;

  const historyInsights = useMemo(() => {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const viewedToday = historyProducts.filter((product) => Number(viewedAtById.get(product.id) || 0) >= oneDayAgo).length;
    const deals = historyProducts.filter(isDealProduct).length;
    const lowStock = historyProducts.filter((product) => getLowStockCount(product.stock, 1) !== null).length;
    const readyToCart = historyProducts.filter((product) => isPurchasable(product) && !needsOptionSelection(product)).length;
    const brandCounts = historyProducts.reduce<Record<string, number>>((result, product) => {
      if (product.brand) result[product.brand] = (result[product.brand] || 0) + 1;
      return result;
    }, {});
    const topBrand = Object.entries(brandCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    const bestRecovery = [...historyProducts]
      .sort((a, b) => {
        const score = (product: Product) => {
          const viewedAt = Number(viewedAtById.get(product.id) || 0);
          const recencyBoost = viewedAt >= oneDayAgo ? 28 : 0;
          const dealBoost = isDealProduct(product) ? 24 : 0;
          const stockBoost = getLowStockCount(product.stock, 1) !== null ? 18 : 0;
          return recencyBoost + dealBoost + stockBoost + Math.min(Number(product.averageRating || 0), 5) * 5;
        };
        return score(b) - score(a);
      })[0];
    return { viewedToday, deals, lowStock, readyToCart, topBrand, bestRecovery };
  }, [historyProducts, viewedAtById]);

  const filteredProducts = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    const keywordMatched = !query ? historyProducts : historyProducts.filter((product) =>
      [product.name, product.brand, product.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
    if (quickFilter === 'recent') {
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      return keywordMatched.filter((product) => Number(viewedAtById.get(product.id) || 0) >= oneDayAgo);
    }
    if (quickFilter === 'deals') {
      return keywordMatched.filter(isDealProduct);
    }
    if (quickFilter === 'lowStock') {
      return keywordMatched.filter((product) => getLowStockCount(product.stock, 1) !== null);
    }
    return keywordMatched;
  }, [historyProducts, keyword, quickFilter, viewedAtById]);

  const formatViewedAt = (value?: number) => {
    if (!value) return t('pages.browsingHistory.unknownTime');
    return new Date(value).toLocaleString(language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

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
      message.warning(t('pages.browsingHistory.unavailable'));
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
      message.success(t('messages.addCartSuccess'));
      dispatchDomEvent('shop:cart-updated');
      dispatchDomEvent('shop:open-cart');
    } catch (err: unknown) {
      message.error(getApiErrorMessage(err, t('messages.addFailed'), language));
    }
  };

  const historyNextAction = (() => {
    if (!hasHistory) {
      return {
        tone: 'browse',
        title: t('pages.browsingHistory.nextActionBrowseTitle'),
        text: t('pages.browsingHistory.nextActionBrowseText'),
        label: t('pages.browsingHistory.browsePersonalized'),
        action: () => navigate('/products?sort=personalized-desc'),
      };
    }
    if (loadError) {
      return {
        tone: 'stale',
        title: t('pages.browsingHistory.nextActionStaleTitle'),
        text: t('pages.browsingHistory.nextActionStaleText'),
        label: t('messages.retry'),
        action: () => setReloadToken((current) => current + 1),
      };
    }
    if (historyInsights.bestRecovery && isPurchasable(historyInsights.bestRecovery) && !needsOptionSelection(historyInsights.bestRecovery)) {
      const productName = historyProductName(historyInsights.bestRecovery);
      return {
        tone: 'ready',
        title: t('pages.browsingHistory.nextActionAddTitle'),
        text: t('pages.browsingHistory.nextActionAddText', { name: productName }),
        label: t('pages.browsingHistory.addBestToCart'),
        action: () => addHistoryProductToCart(historyInsights.bestRecovery!),
      };
    }
    if (historyInsights.bestRecovery && needsOptionSelection(historyInsights.bestRecovery)) {
      const productName = historyProductName(historyInsights.bestRecovery);
      return {
        tone: 'options',
        title: t('pages.browsingHistory.nextActionOptionsTitle'),
        text: t('pages.browsingHistory.nextActionOptionsText', { name: productName }),
        label: t('pages.browsingHistory.resumeProduct'),
        action: () => navigate(`/products/${historyInsights.bestRecovery!.id}`),
      };
    }
    if (historyInsights.lowStock > 0) {
      return {
        tone: 'urgent',
        title: t('pages.browsingHistory.nextActionLowStockTitle'),
        text: t('pages.browsingHistory.nextActionLowStockText', { count: historyInsights.lowStock }),
        label: t('pages.browsingHistory.filterLowStock'),
        action: () => setQuickFilter('lowStock'),
      };
    }
    return {
      tone: 'browse',
      title: t('pages.browsingHistory.nextActionBrowseTitle'),
      text: t('pages.browsingHistory.nextActionBrowseText'),
      label: t('pages.browsingHistory.browsePersonalized'),
      action: () => navigate('/products?sort=personalized-desc'),
    };
  })();
  const clearHistoryActionLabel = `${t('pages.browsingHistory.clear')}: ${preferences.recent.length}`;
  const historyBrowseActionLabel = t('pages.browsingHistory.browse');
  const historyNextActionLabel = `${historyNextAction.label}: ${historyNextAction.title}`;
  const resetHistoryFiltersLabel = `${t('pages.productList.resetFilters')}: ${filteredProducts.length} / ${historyProducts.length}`;

  const emptyQuickActions = [
    {
      key: 'browse',
      icon: <ShoppingOutlined />,
      label: t('pages.browsingHistory.browse'),
      action: () => navigate('/products'),
      type: 'primary' as const,
    },
    {
      key: 'personalized',
      icon: <ThunderboltOutlined />,
      label: t('pages.browsingHistory.browsePersonalized'),
      action: () => navigate('/products?sort=personalized-desc'),
    },
    {
      key: 'coupons',
      icon: <FireOutlined />,
      label: t('nav.coupons'),
      action: () => navigate('/coupons'),
    },
    {
      key: 'petFinder',
      icon: <SearchOutlined />,
      label: t('nav.petFinder'),
      action: () => navigate('/pet-finder'),
    },
  ];

  if (loading) {
    return (
      <main
        className={`browsing-history browsing-history--${language} browsing-history--loading`}
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={t('common.loading')}
      >
        <Spin size="large" />
      </main>
    );
  }

  return (
    <main className={`browsing-history browsing-history--${language}${!hasHistory ? ' browsing-history--empty' : ''}`}>
      <section className="browsing-history__hero">
        <div>
          <span className="browsing-history__eyebrow">
            <HistoryOutlined /> {t('pages.browsingHistory.eyebrow')}
          </span>
          <Title level={1} className="browsing-history__title">{t('pages.browsingHistory.title')}</Title>
          <Paragraph className="browsing-history__subtitle">{t('pages.browsingHistory.subtitle', { count: historyDisplayCount })}</Paragraph>
        </div>
        <div className="browsing-history__tools">
          <Input
            allowClear
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={t('pages.browsingHistory.searchPlaceholder')}
            aria-label={t('pages.browsingHistory.searchPlaceholder')}
          />
          <Popconfirm
            classNames={{ root: 'shop-mobile-popup-layer browsing-history-clear-popconfirm' }}
            title={t('pages.browsingHistory.clearConfirm')}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
            okButtonProps={{ danger: true, 'aria-label': clearHistoryActionLabel, title: clearHistoryActionLabel }}
            cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${clearHistoryActionLabel}`, title: `${t('common.cancel')}: ${clearHistoryActionLabel}` }}
            onConfirm={clearHistory}
            disabled={!hasHistory}
          >
            <Button danger icon={<DeleteOutlined />} disabled={!hasHistory} aria-label={clearHistoryActionLabel} title={clearHistoryActionLabel}>
              {t('pages.browsingHistory.clear')}
            </Button>
          </Popconfirm>
        </div>
      </section>

      {hasHistory ? (
        <section className="browsing-history__assistant">
          <div className="browsing-history__assistant-copy">
            <span>{t('pages.browsingHistory.assistantEyebrow')}</span>
            <Title level={2} className="browsing-history__sectionTitle">{t('pages.browsingHistory.assistantTitle')}</Title>
            <Paragraph className="browsing-history__sectionText">
              {hasStaleHistoryData
                ? t('pages.browsingHistory.assistantSubtitleStale')
                : historyInsights.topBrand
                ? t('pages.browsingHistory.assistantSubtitleBrand', { brand: historyInsights.topBrand })
                : t('pages.browsingHistory.assistantSubtitle')}
            </Paragraph>
          </div>
          <div className="browsing-history__assistant-actions">
            <button
              type="button"
              className={quickFilter === 'all' ? 'is-active' : ''}
              aria-pressed={quickFilter === 'all'}
              aria-label={`${t('pages.browsingHistory.allViewed')}: ${historyDisplayCount}`}
              title={`${t('pages.browsingHistory.allViewed')}: ${historyDisplayCount}`}
              onClick={() => setQuickFilter('all')}
            >
              <HistoryOutlined />
              <strong>{historyDisplayCount}</strong>
              <span>{t('pages.browsingHistory.allViewed')}</span>
            </button>
            <button
              type="button"
              className={quickFilter === 'recent' ? 'is-active' : ''}
              aria-pressed={quickFilter === 'recent'}
              aria-label={`${t('pages.browsingHistory.viewedToday')}: ${hasStaleHistoryData ? 0 : historyInsights.viewedToday}`}
              title={`${t('pages.browsingHistory.viewedToday')}: ${hasStaleHistoryData ? 0 : historyInsights.viewedToday}`}
              onClick={() => setQuickFilter('recent')}
              disabled={hasStaleHistoryData}
            >
              <ClockCircleOutlined />
              <strong>{hasStaleHistoryData ? 0 : historyInsights.viewedToday}</strong>
              <span>{t('pages.browsingHistory.viewedToday')}</span>
            </button>
            <button
              type="button"
              className={quickFilter === 'deals' ? 'is-active' : ''}
              aria-pressed={quickFilter === 'deals'}
              aria-label={`${t('pages.browsingHistory.dealWatch')}: ${hasStaleHistoryData ? 0 : historyInsights.deals}`}
              title={`${t('pages.browsingHistory.dealWatch')}: ${hasStaleHistoryData ? 0 : historyInsights.deals}`}
              onClick={() => setQuickFilter('deals')}
              disabled={hasStaleHistoryData}
            >
              <ThunderboltOutlined />
              <strong>{hasStaleHistoryData ? 0 : historyInsights.deals}</strong>
              <span>{t('pages.browsingHistory.dealWatch')}</span>
            </button>
            <button
              type="button"
              className={quickFilter === 'lowStock' ? 'is-active' : ''}
              aria-pressed={quickFilter === 'lowStock'}
              aria-label={`${t('pages.browsingHistory.lowStockWatch')}: ${hasStaleHistoryData ? 0 : historyInsights.lowStock}`}
              title={`${t('pages.browsingHistory.lowStockWatch')}: ${hasStaleHistoryData ? 0 : historyInsights.lowStock}`}
              onClick={() => setQuickFilter('lowStock')}
              disabled={hasStaleHistoryData}
            >
              <FireOutlined />
              <strong>{hasStaleHistoryData ? 0 : historyInsights.lowStock}</strong>
              <span>{t('pages.browsingHistory.lowStockWatch')}</span>
            </button>
          </div>
        </section>
      ) : null}

      {hasHistory && historyInsights.bestRecovery && !hasStaleHistoryData ? (
        (() => {
          const productName = historyProductName(historyInsights.bestRecovery!);
          const resumeActionLabel = `${t('pages.browsingHistory.resumeProduct')}: ${productName}`;
          return (
        <section className="browsing-history__recovery" aria-label={t('pages.browsingHistory.recoveryTitle')}>
          <div>
            <span className="browsing-history__recovery-eyebrow">{t('pages.browsingHistory.recoveryEyebrow')}</span>
            <Title level={2} className="browsing-history__sectionTitle">{t('pages.browsingHistory.recoveryTitle')}</Title>
            <Paragraph className="browsing-history__sectionText">
              {t('pages.browsingHistory.recoverySubtitle', {
                name: productName,
                price: formatMoney(historyInsights.bestRecovery.effectivePrice ?? historyInsights.bestRecovery.price),
              })}
            </Paragraph>
          </div>
          <div className="browsing-history__recovery-tags">
            {isDealProduct(historyInsights.bestRecovery) ? <Tag color="volcano">{t('pages.browsingHistory.recoveryDeal')}</Tag> : null}
            {getLowStockCount(historyInsights.bestRecovery.stock, 1) !== null ? <Tag color="orange">{t('pages.browsingHistory.recoveryLowStock')}</Tag> : null}
            <Tag color="blue">{formatViewedAt(viewedAtById.get(historyInsights.bestRecovery.id))}</Tag>
          </div>
          <Button type="primary" icon={<ShoppingOutlined />} aria-label={resumeActionLabel} title={resumeActionLabel} onClick={() => navigate(`/products/${historyInsights.bestRecovery!.id}`)}>
            {t('pages.browsingHistory.resumeProduct')}
          </Button>
        </section>
          );
        })()
      ) : null}

      {hasHistory ? (
        <section className={`browsing-history__nextAction browsing-history__nextAction--${historyNextAction.tone}`} aria-label={t('pages.browsingHistory.nextActionEyebrow')}>
          <div>
            <span>{t('pages.browsingHistory.nextActionEyebrow')}</span>
            <Title level={2} className="browsing-history__sectionTitle">{historyNextAction.title}</Title>
            <Paragraph className="browsing-history__sectionText">{historyNextAction.text}</Paragraph>
          </div>
          <div className="browsing-history__nextActionStats">
            <Tag color={hasStaleHistoryData ? 'warning' : 'green'}>
              {hasStaleHistoryData
                ? t('pages.browsingHistory.staleDataTag', { count: historyDisplayCount })
                : t('pages.browsingHistory.readyToCart', { count: historyInsights.readyToCart })}
            </Tag>
            <Tag color={!hasStaleHistoryData && historyInsights.deals > 0 ? 'volcano' : 'default'}>{t('pages.browsingHistory.dealWatchCount', { count: hasStaleHistoryData ? 0 : historyInsights.deals })}</Tag>
            <Tag color={!hasStaleHistoryData && historyInsights.lowStock > 0 ? 'orange' : 'default'}>{t('pages.browsingHistory.lowStockWatchCount', { count: hasStaleHistoryData ? 0 : historyInsights.lowStock })}</Tag>
          </div>
          <Button
            type={historyNextAction.tone === 'ready' ? 'primary' : 'default'}
            icon={hasStaleHistoryData ? <ReloadOutlined /> : historyNextAction.tone === 'ready' ? <ShoppingCartOutlined /> : <ShoppingOutlined />}
            aria-label={historyNextActionLabel}
            title={historyNextActionLabel}
            onClick={historyNextAction.action}
          >
            {historyNextAction.label}
          </Button>
        </section>
      ) : null}

      {loadError ? (
        <section className="browsing-history__loadError" aria-live="polite">
          {hasStaleHistoryData ? (
            <Alert
              type="warning"
              showIcon
              message={t('messages.loadFailed')}
              description={hasStaleHistoryData ? t('pages.browsingHistory.staleDataWarning') : t('messages.loadFailedRetry')}
              action={(
                <Button size="small" onClick={() => setReloadToken((current) => current + 1)}>
                  {t('messages.retry')}
                </Button>
              )}
            />
          ) : (
            <PageError
              title={t('messages.loadFailed')}
              description={t('messages.loadFailedRetry')}
              retryLabel={t('messages.retry')}
              onRetry={() => setReloadToken((current) => current + 1)}
              homeLabel={t('pages.browsingHistory.browse')}
              onHome={() => navigate('/products')}
            />
          )}
        </section>
      ) : null}

      {filteredProducts.length ? (
        <section className="browsing-history__grid">
          {filteredProducts.map((product) => {
            const productName = historyProductName(product);
            const price = product.effectivePrice ?? product.price;
            const viewedAt = viewedAtById.get(product.id);
            const productReadyToCart = isPurchasable(product) && !needsOptionSelection(product);
            const productNeedsOptions = isPurchasable(product) && needsOptionSelection(product);
            const productLowStock = getLowStockCount(product.stock, 1) !== null;
            const productDeal = isDealProduct(product);
            const originalPrice = Number(product.originalPrice || 0);
            const addActionLabel = `${t('pages.browsingHistory.addToCart')}: ${productName}`;
            const viewActionLabel = `${productNeedsOptions ? t('pages.browsingHistory.resumeProduct') : t('pages.browsingHistory.viewProduct')}: ${productName}`;
            const deleteActionLabel = `${t('common.delete')}: ${productName}`;
            return (
              <article className={`browsing-history__item${productReadyToCart ? ' browsing-history__item--ready' : ''}${productLowStock ? ' browsing-history__item--urgent' : ''}`} key={product.id}>
                <button type="button" className="browsing-history__image" aria-label={viewActionLabel} title={viewActionLabel} onClick={() => navigate(`/products/${product.id}`)}>
                  <img
                    src={resolveHistoryImage(product.imageUrl)}
                    alt={productName}
                    onError={(event) => {
                      if (event.currentTarget.src !== fallbackImage) {
                        event.currentTarget.src = fallbackImage;
                      }
                    }}
                  />
                </button>
                <div className="browsing-history__content">
                  <div>
                    <button type="button" className="browsing-history__name" aria-label={viewActionLabel} title={viewActionLabel} onClick={() => navigate(`/products/${product.id}`)}>
                      {productName}
                    </button>
                    <div className="browsing-history__meta">
                      <span>{formatViewedAt(viewedAt)}</span>
                      {product.brand ? <Tag>{product.brand}</Tag> : null}
                    </div>
                    <div className="browsing-history__signals">
                      {productDeal ? <Tag color="volcano">{t('pages.browsingHistory.recoveryDeal')}</Tag> : null}
                      {productLowStock ? <Tag color="orange">{t('pages.browsingHistory.recoveryLowStock')}</Tag> : null}
                      {productNeedsOptions ? <Tag color="blue">{t('pages.browsingHistory.resumeProduct')}</Tag> : null}
                      {!isPurchasable(product) ? <Tag color="red">{t('pages.browsingHistory.unavailable')}</Tag> : null}
                    </div>
                  </div>
                  <div className="browsing-history__footer">
                    <span className="browsing-history__priceStack">
                      <strong className="commerce-money">{formatMoney(price)}</strong>
                      {originalPrice > Number(price || 0) ? <span className="commerce-money">{formatMoney(originalPrice)}</span> : null}
                    </span>
                    <div>
                      {productReadyToCart ? (
                        <Button type="primary" icon={<ShoppingCartOutlined />} disabled={hasStaleHistoryData} aria-label={addActionLabel} title={addActionLabel} onClick={() => addHistoryProductToCart(product)}>
                          {t('pages.browsingHistory.addToCart')}
                        </Button>
                      ) : null}
                      <Button type={productNeedsOptions ? 'primary' : 'default'} icon={<ShoppingOutlined />} aria-label={viewActionLabel} title={viewActionLabel} onClick={() => navigate(`/products/${product.id}`)}>
                        {productNeedsOptions ? t('pages.browsingHistory.resumeProduct') : t('pages.browsingHistory.viewProduct')}
                      </Button>
                      <Popconfirm
                        title={t('pages.browsingHistory.removeConfirm')}
                        okText={t('common.delete')}
                        cancelText={t('common.cancel')}
                        onConfirm={() => removeItem(product.id)}
                      >
                        <Button type="text" danger icon={<DeleteOutlined />} aria-label={deleteActionLabel} title={deleteActionLabel} />
                      </Popconfirm>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="browsing-history__empty">
          <Empty
            description={
              loadError && hasHistory
                ? t('pages.browsingHistory.emptyLoadFailed')
                : historyProducts.length
                  ? t('pages.browsingHistory.noSearchResults')
                  : t('pages.browsingHistory.empty')
            }
          >
            {loadError && hasHistory ? (
              <div className="browsing-history__emptyActions">
                <Button type="primary" icon={<ReloadOutlined />} onClick={() => setReloadToken((current) => current + 1)}>
                  {t('messages.retry')}
                </Button>
                <Button icon={<ShoppingOutlined />} aria-label={historyBrowseActionLabel} title={historyBrowseActionLabel} onClick={() => navigate('/products')}>
                  {t('pages.browsingHistory.browse')}
                </Button>
              </div>
            ) : historyProducts.length ? (
              <div className="browsing-history__emptyActions">
                <Button type="primary" icon={<ShoppingOutlined />} aria-label={historyBrowseActionLabel} title={historyBrowseActionLabel} onClick={() => navigate('/products')}>
                  {t('pages.browsingHistory.browse')}
                </Button>
                <Button aria-label={resetHistoryFiltersLabel} title={resetHistoryFiltersLabel} onClick={() => {
                  setKeyword('');
                  setQuickFilter('all');
                }}>
                  {t('pages.productList.resetFilters')}
                </Button>
              </div>
            ) : (
              <div className="browsing-history__emptyActions browsing-history__emptyActions--guide">
                {emptyQuickActions.map((action) => (
                  <Button
                    key={action.key}
                    type={action.type}
                    icon={action.icon}
                    aria-label={action.label}
                    title={action.label}
                    onClick={action.action}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            )}
          </Empty>
        </section>
      )}
      <div className={`browsing-history__mobileAction browsing-history__mobileAction--${historyNextAction.tone}`} aria-label={t('pages.browsingHistory.nextActionEyebrow')}>
        <span>
          <span>{t('pages.browsingHistory.nextActionEyebrow')}</span>
          <strong>{historyNextAction.title}</strong>
          <small>
            {hasStaleHistoryData
              ? t('pages.browsingHistory.staleDataTag', { count: historyDisplayCount })
              : t('pages.browsingHistory.readyToCart', { count: historyInsights.readyToCart })}
          </small>
        </span>
        <Button
          type={historyNextAction.tone === 'ready' ? 'primary' : 'default'}
          icon={hasStaleHistoryData ? <ReloadOutlined /> : historyNextAction.tone === 'ready' ? <ShoppingCartOutlined /> : <ShoppingOutlined />}
          aria-label={historyNextActionLabel}
          title={historyNextActionLabel}
          onClick={historyNextAction.action}
        >
          {historyNextAction.label}
        </Button>
      </div>
    </main>
  );
};

export default BrowsingHistory;
