import React, { useEffect, useMemo, useState } from 'react';
import { Button, Empty, Input, message, Popconfirm, Spin, Tag } from 'antd';
import { ClockCircleOutlined, DeleteOutlined, FireOutlined, HistoryOutlined, SearchOutlined, ShoppingCartOutlined, ShoppingOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { apiBaseUrl, cartApi, productApi } from '../api';
import { useLanguage } from '../i18n';
import { useMarket } from '../hooks/useMarket';
import type { Product } from '../types';
import { localizeProduct } from '../utils/localizedProduct';
import { getLowStockCount } from '../utils/conversionConfig';
import { addGuestCartItem } from '../utils/guestCart';
import { needsOptionSelection } from '../utils/productOptions';
import {
  clearProductViewHistory,
  loadProductViewPreferences,
  removeProductViewHistoryItem,
} from '../utils/productViewPreferences';
import './BrowsingHistory.css';

const fallbackImage = 'https://images.unsplash.com/photo-1601758125946-6ec2ef64daf8?auto=format&fit=crop&w=900&q=80';
type HistoryQuickFilter = 'all' | 'recent' | 'deals' | 'lowStock';

const resolveHistoryImage = (imageUrl?: string) => {
  if (!imageUrl) return fallbackImage;
  if (/^(https?:|data:|blob:)/i.test(imageUrl)) return imageUrl;
  return `${apiBaseUrl}${imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`}`;
};

const isDealProduct = (product: Product) => {
  const activePrice = Number(product.effectivePrice ?? product.price ?? 0);
  const originalPrice = Number(product.originalPrice ?? 0);
  return Number(product.discount || product.effectiveDiscountPercent || 0) > 0 || (originalPrice > activePrice && activePrice > 0);
};

const isPurchasable = (product: Product) =>
  (product.status || 'ACTIVE') === 'ACTIVE' && (product.stock === undefined || product.stock > 0);

const BrowsingHistory: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [quickFilter, setQuickFilter] = useState<HistoryQuickFilter>('all');
  const [preferences, setPreferences] = useState(() => loadProductViewPreferences());
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { formatMoney } = useMarket();
  const hasHistory = preferences.recent.length > 0;

  useEffect(() => {
    const fetchProducts = async () => {
      if (!hasHistory) {
        setProducts([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const response = await productApi.getByIds(preferences.recent);
        setProducts(response.data.map((product) => localizeProduct(product, language)));
      } catch {
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [hasHistory, language, preferences.recent]);

  useEffect(() => {
    const syncPreferences = () => setPreferences(loadProductViewPreferences());
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
          return recencyBoost + dealBoost + stockBoost + Math.min(Number(product.averageRating || product.rating || 0), 5) * 5;
        };
        return score(b) - score(a);
      })[0];
    return { viewedToday, deals, lowStock, readyToCart, topBrand, bestRecovery };
  }, [historyProducts, viewedAtById]);

  const filteredProducts = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    const keywordMatched = !query ? historyProducts : historyProducts.filter((product) =>
      [product.name, product.brand, product.categoryName, product.description]
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
    const token = localStorage.getItem('token');
    const userId = Number(localStorage.getItem('userId') || 0);
    try {
      if (token && userId) {
        await cartApi.addItem(userId, product.id, 1);
      } else {
        addGuestCartItem(product, 1, undefined, product.effectivePrice ?? product.price);
      }
      message.success(t('messages.addCartSuccess'));
      window.dispatchEvent(new Event('shop:cart-updated'));
      window.dispatchEvent(new Event('shop:open-cart'));
    } catch (err: any) {
      message.error(err?.response?.data?.error || t('messages.addFailed'));
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
    if (historyInsights.bestRecovery && isPurchasable(historyInsights.bestRecovery) && !needsOptionSelection(historyInsights.bestRecovery)) {
      return {
        tone: 'ready',
        title: t('pages.browsingHistory.nextActionAddTitle'),
        text: t('pages.browsingHistory.nextActionAddText', { name: historyInsights.bestRecovery.name }),
        label: t('pages.browsingHistory.addBestToCart'),
        action: () => addHistoryProductToCart(historyInsights.bestRecovery!),
      };
    }
    if (historyInsights.bestRecovery && needsOptionSelection(historyInsights.bestRecovery)) {
      return {
        tone: 'options',
        title: t('pages.browsingHistory.nextActionOptionsTitle'),
        text: t('pages.browsingHistory.nextActionOptionsText', { name: historyInsights.bestRecovery.name }),
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

  if (loading) {
    return (
      <main className="browsing-history browsing-history--loading">
        <Spin size="large" />
      </main>
    );
  }

  return (
    <main className="browsing-history">
      <section className="browsing-history__hero">
        <div>
          <span className="browsing-history__eyebrow">
            <HistoryOutlined /> {t('pages.browsingHistory.eyebrow')}
          </span>
          <h1>{t('pages.browsingHistory.title')}</h1>
          <p>{t('pages.browsingHistory.subtitle', { count: historyProducts.length })}</p>
        </div>
        <div className="browsing-history__tools">
          <Input
            allowClear
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={t('pages.browsingHistory.searchPlaceholder')}
          />
          <Popconfirm
            title={t('pages.browsingHistory.clearConfirm')}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
            onConfirm={clearHistory}
            disabled={!hasHistory}
          >
            <Button danger icon={<DeleteOutlined />} disabled={!hasHistory}>
              {t('pages.browsingHistory.clear')}
            </Button>
          </Popconfirm>
        </div>
      </section>

      {hasHistory ? (
        <section className="browsing-history__assistant">
          <div className="browsing-history__assistant-copy">
            <span>{t('pages.browsingHistory.assistantEyebrow')}</span>
            <h2>{t('pages.browsingHistory.assistantTitle')}</h2>
            <p>
              {historyInsights.topBrand
                ? t('pages.browsingHistory.assistantSubtitleBrand', { brand: historyInsights.topBrand })
                : t('pages.browsingHistory.assistantSubtitle')}
            </p>
          </div>
          <div className="browsing-history__assistant-actions">
            <button type="button" className={quickFilter === 'all' ? 'is-active' : ''} onClick={() => setQuickFilter('all')}>
              <HistoryOutlined />
              <strong>{historyProducts.length}</strong>
              <span>{t('pages.browsingHistory.allViewed')}</span>
            </button>
            <button type="button" className={quickFilter === 'recent' ? 'is-active' : ''} onClick={() => setQuickFilter('recent')}>
              <ClockCircleOutlined />
              <strong>{historyInsights.viewedToday}</strong>
              <span>{t('pages.browsingHistory.viewedToday')}</span>
            </button>
            <button type="button" className={quickFilter === 'deals' ? 'is-active' : ''} onClick={() => setQuickFilter('deals')}>
              <ThunderboltOutlined />
              <strong>{historyInsights.deals}</strong>
              <span>{t('pages.browsingHistory.dealWatch')}</span>
            </button>
            <button type="button" className={quickFilter === 'lowStock' ? 'is-active' : ''} onClick={() => setQuickFilter('lowStock')}>
              <FireOutlined />
              <strong>{historyInsights.lowStock}</strong>
              <span>{t('pages.browsingHistory.lowStockWatch')}</span>
            </button>
          </div>
        </section>
      ) : null}

      {hasHistory && historyInsights.bestRecovery ? (
        <section className="browsing-history__recovery" aria-label={t('pages.browsingHistory.recoveryTitle')}>
          <div>
            <span className="browsing-history__recovery-eyebrow">{t('pages.browsingHistory.recoveryEyebrow')}</span>
            <h2>{t('pages.browsingHistory.recoveryTitle')}</h2>
            <p>
              {t('pages.browsingHistory.recoverySubtitle', {
                name: historyInsights.bestRecovery.name,
                price: formatMoney(historyInsights.bestRecovery.effectivePrice ?? historyInsights.bestRecovery.price),
              })}
            </p>
          </div>
          <div className="browsing-history__recovery-tags">
            {isDealProduct(historyInsights.bestRecovery) ? <Tag color="volcano">{t('pages.browsingHistory.recoveryDeal')}</Tag> : null}
            {getLowStockCount(historyInsights.bestRecovery.stock, 1) !== null ? <Tag color="orange">{t('pages.browsingHistory.recoveryLowStock')}</Tag> : null}
            <Tag color="blue">{formatViewedAt(viewedAtById.get(historyInsights.bestRecovery.id))}</Tag>
          </div>
          <Button type="primary" icon={<ShoppingOutlined />} onClick={() => navigate(`/products/${historyInsights.bestRecovery!.id}`)}>
            {t('pages.browsingHistory.resumeProduct')}
          </Button>
        </section>
      ) : null}

      <section className={`browsing-history__nextAction browsing-history__nextAction--${historyNextAction.tone}`} aria-label={t('pages.browsingHistory.nextActionEyebrow')}>
        <div>
          <span>{t('pages.browsingHistory.nextActionEyebrow')}</span>
          <h2>{historyNextAction.title}</h2>
          <p>{historyNextAction.text}</p>
        </div>
        <div className="browsing-history__nextActionStats">
          <Tag color="green">{t('pages.browsingHistory.readyToCart', { count: historyInsights.readyToCart })}</Tag>
          <Tag color={historyInsights.deals > 0 ? 'volcano' : 'default'}>{t('pages.browsingHistory.dealWatchCount', { count: historyInsights.deals })}</Tag>
          <Tag color={historyInsights.lowStock > 0 ? 'orange' : 'default'}>{t('pages.browsingHistory.lowStockWatchCount', { count: historyInsights.lowStock })}</Tag>
        </div>
        <Button
          type={historyNextAction.tone === 'ready' ? 'primary' : 'default'}
          icon={historyNextAction.tone === 'ready' ? <ShoppingCartOutlined /> : <ShoppingOutlined />}
          onClick={historyNextAction.action}
        >
          {historyNextAction.label}
        </Button>
      </section>

      {filteredProducts.length ? (
        <section className="browsing-history__grid">
          {filteredProducts.map((product) => {
            const price = product.effectivePrice ?? product.price;
            const viewedAt = viewedAtById.get(product.id);
            return (
              <article className="browsing-history__item" key={product.id}>
                <button type="button" className="browsing-history__image" onClick={() => navigate(`/products/${product.id}`)}>
                  <img
                    src={resolveHistoryImage(product.imageUrl)}
                    alt={product.name}
                    onError={(event) => {
                      if (event.currentTarget.src !== fallbackImage) {
                        event.currentTarget.src = fallbackImage;
                      }
                    }}
                  />
                </button>
                <div className="browsing-history__content">
                  <div>
                    <button type="button" className="browsing-history__name" onClick={() => navigate(`/products/${product.id}`)}>
                      {product.name}
                    </button>
                    <div className="browsing-history__meta">
                      <span>{formatViewedAt(viewedAt)}</span>
                      {product.brand ? <Tag>{product.brand}</Tag> : null}
                    </div>
                  </div>
                  <div className="browsing-history__footer">
                    <strong>{formatMoney(price)}</strong>
                    <div>
                      {isPurchasable(product) && !needsOptionSelection(product) ? (
                        <Button type="primary" icon={<ShoppingCartOutlined />} onClick={() => addHistoryProductToCart(product)}>
                          {t('pages.browsingHistory.addToCart')}
                        </Button>
                      ) : null}
                      <Button icon={<ShoppingOutlined />} onClick={() => navigate(`/products/${product.id}`)}>
                        {t('pages.browsingHistory.viewProduct')}
                      </Button>
                      <Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeItem(product.id)} />
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="browsing-history__empty">
          <Empty description={historyProducts.length ? t('pages.browsingHistory.noSearchResults') : t('pages.browsingHistory.empty')}>
            <Button type="primary" onClick={() => navigate('/products')}>
              {t('pages.browsingHistory.browse')}
            </Button>
          </Empty>
        </section>
      )}
    </main>
  );
};

export default BrowsingHistory;
