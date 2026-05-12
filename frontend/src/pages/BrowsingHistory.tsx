import React, { useEffect, useMemo, useState } from 'react';
import { Button, Empty, Input, Popconfirm, Spin, Tag } from 'antd';
import { DeleteOutlined, HistoryOutlined, SearchOutlined, ShoppingOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { productApi } from '../api';
import { useLanguage } from '../i18n';
import { useMarket } from '../hooks/useMarket';
import type { Product } from '../types';
import { localizeProduct } from '../utils/localizedProduct';
import {
  clearProductViewHistory,
  loadProductViewPreferences,
  removeProductViewHistoryItem,
} from '../utils/productViewPreferences';
import './BrowsingHistory.css';

const fallbackImage = 'https://images.unsplash.com/photo-1601758125946-6ec2ef64daf8?auto=format&fit=crop&w=900&q=80';

const BrowsingHistory: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [preferences, setPreferences] = useState(() => loadProductViewPreferences());
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { formatMoney } = useMarket();
  const hasHistory = preferences.recent.length > 0;

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const response = await productApi.getAll();
        setProducts(response.data.map((product) => localizeProduct(product, language)));
      } catch {
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [language]);

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

  const filteredProducts = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    if (!query) return historyProducts;
    return historyProducts.filter((product) =>
      [product.name, product.brand, product.categoryName, product.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [historyProducts, keyword]);

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

      {filteredProducts.length ? (
        <section className="browsing-history__grid">
          {filteredProducts.map((product) => {
            const price = product.effectivePrice ?? product.price;
            const viewedAt = viewedAtById.get(product.id);
            return (
              <article className="browsing-history__item" key={product.id}>
                <button className="browsing-history__image" onClick={() => navigate(`/products/${product.id}`)}>
                  <img
                    src={product.imageUrl || fallbackImage}
                    alt={product.name}
                    onError={(event) => {
                      event.currentTarget.src = fallbackImage;
                    }}
                  />
                </button>
                <div className="browsing-history__content">
                  <div>
                    <button className="browsing-history__name" onClick={() => navigate(`/products/${product.id}`)}>
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
