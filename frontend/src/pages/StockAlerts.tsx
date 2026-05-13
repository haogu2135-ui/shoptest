import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Empty, Image, List, Popconfirm, Space, Tag, Typography, message } from 'antd';
import { BellOutlined, CheckCircleOutlined, DeleteOutlined, FireOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { apiBaseUrl, cartApi, productApi } from '../api';
import { useLanguage } from '../i18n';
import { useMarket } from '../hooks/useMarket';
import type { Product } from '../types';
import { addGuestCartItem } from '../utils/guestCart';
import { clearStockAlerts, readStockAlerts, removeStockAlert, type StockAlertItem } from '../utils/stockAlerts';
import { localizeProduct } from '../utils/localizedProduct';
import './StockAlerts.css';

const { Title, Text } = Typography;
const stockAlertImageFallback = 'https://images.unsplash.com/photo-1601758125946-6ec2ef64daf8?auto=format&fit=crop&w=900&q=80';

const resolveStockAlertImage = (imageUrl?: string) => {
  if (!imageUrl) return stockAlertImageFallback;
  if (/^(https?:|data:|blob:)/i.test(imageUrl)) {
    return imageUrl;
  }
  return `${apiBaseUrl}${imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`}`;
};

const isBackInStock = (product?: Product) => Boolean(product && (product.stock === undefined || product.stock > 0));

const StockAlerts: React.FC = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { formatMoney } = useMarket();
  const [alerts, setAlerts] = useState<StockAlertItem[]>(() => readStockAlerts());
  const [products, setProducts] = useState<Record<number, Product>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const refresh = () => setAlerts(readStockAlerts());
    window.addEventListener('shop:stock-alerts-updated', refresh);
    return () => window.removeEventListener('shop:stock-alerts-updated', refresh);
  }, []);

  useEffect(() => {
    const loadProducts = async () => {
      if (alerts.length === 0) {
        setProducts({});
        return;
      }
      try {
        setLoading(true);
        const productIds = Array.from(new Set(alerts.map((alert) => alert.productId)));
        const responses = await Promise.allSettled(productIds.map((productId) => productApi.getById(productId)));
        const nextProducts = responses.reduce<Record<number, Product>>((acc, result) => {
          if (result.status === 'fulfilled') {
            const product = localizeProduct(result.value.data, language);
            acc[product.id] = product;
          }
          return acc;
        }, {});
        setProducts(nextProducts);
      } catch {
        message.error(t('pages.stockAlerts.loadFailed'));
      } finally {
        setLoading(false);
      }
    };
    loadProducts();
  }, [alerts, language, t]);

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
      message.error(t('pages.productDetail.insufficientStock'));
      return false;
    }
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    try {
      if (token && userId) {
        await cartApi.addItem(Number(userId), product.id, 1);
        window.dispatchEvent(new Event('shop:cart-updated'));
      } else {
        addGuestCartItem({ ...product, imageUrl: resolveStockAlertImage(product.imageUrl) }, 1, undefined, product.effectivePrice ?? product.price);
      }
      if (!quiet) {
        message.success(t('messages.addCartSuccess'));
        window.dispatchEvent(new Event('shop:open-cart'));
      }
      return true;
    } catch {
      message.error(t('messages.addFailed'));
      return false;
    }
  };

  const stockAlertInsights = useMemo(() => {
    const items = alerts.map((alert) => ({
      ...alert,
      product: products[alert.productId],
    }));
    const backInStockItems = items.filter((item) => isBackInStock(item.product));
    const waitingItems = items.length - backInStockItems.length;
    const urgentItems = backInStockItems.filter((item) => {
      const stock = item.product?.stock;
      return stock !== undefined && stock > 0 && stock <= 5;
    });
    const bestReadyItem = backInStockItems
      .filter((item) => item.product)
      .sort((a, b) => (a.product?.effectivePrice ?? a.product?.price ?? 0) - (b.product?.effectivePrice ?? b.product?.price ?? 0))[0];
    return { items, backInStockItems, waitingItems, urgentItems, bestReadyItem };
  }, [alerts, products]);

  const addReadyItemsToCart = async () => {
    const readyProducts = stockAlertInsights.backInStockItems
      .map((item) => item.product)
      .filter(Boolean) as Product[];
    if (readyProducts.length === 0) {
      message.info(t('pages.stockAlerts.noReadyToCart'));
      return;
    }
    const results = await Promise.all(readyProducts.map((product) => addToCart(product, true)));
    const added = results.filter(Boolean).length;
    if (added > 0) {
      message.success(t('pages.stockAlerts.addedReadyCount', { count: added }));
      window.dispatchEvent(new Event('shop:open-cart'));
    }
  };

  return (
    <div className="stock-alerts">
      <Card>
        <div className="stock-alerts__header">
          <div>
            <Title level={2} style={{ margin: 0 }}>
              <BellOutlined /> {t('pages.stockAlerts.title')}
            </Title>
            <Text type="secondary">
              {t('pages.stockAlerts.subtitle', { count: loading ? 0 : stockAlertInsights.backInStockItems.length, saved: alerts.length })}
            </Text>
          </div>
          <Space wrap>
            <Button onClick={() => navigate('/products')}>{t('pages.stockAlerts.browse')}</Button>
            <Button danger disabled={alerts.length === 0} onClick={clearAll}>{t('pages.stockAlerts.clear')}</Button>
          </Space>
        </div>

        {alerts.length > 0 ? (
          <section className="stock-alerts__assistant" aria-label={t('pages.stockAlerts.assistantTitle')}>
            <div className="stock-alerts__assistantCopy">
              <Text className="stock-alerts__eyebrow">{t('pages.stockAlerts.assistantEyebrow')}</Text>
              <Title level={4}>{t('pages.stockAlerts.assistantTitle')}</Title>
              <Text type="secondary">
                {stockAlertInsights.bestReadyItem?.product
                  ? t('pages.stockAlerts.assistantSubtitleBest', { name: stockAlertInsights.bestReadyItem.product.name })
                  : t('pages.stockAlerts.assistantSubtitle')}
              </Text>
            </div>
            <div className="stock-alerts__signalGrid">
              <div className="stock-alerts__signal is-ok">
                <CheckCircleOutlined />
                <strong>{stockAlertInsights.backInStockItems.length}</strong>
                <span>{t('pages.stockAlerts.readyNow')}</span>
              </div>
              <div className={`stock-alerts__signal ${stockAlertInsights.urgentItems.length ? 'is-risk' : 'is-ok'}`}>
                <FireOutlined />
                <strong>{stockAlertInsights.urgentItems.length}</strong>
                <span>{t('pages.stockAlerts.lowStockReady')}</span>
              </div>
              <div className={`stock-alerts__signal ${stockAlertInsights.waitingItems ? '' : 'is-ok'}`}>
                <BellOutlined />
                <strong>{stockAlertInsights.waitingItems}</strong>
                <span>{t('pages.stockAlerts.stillWatching')}</span>
              </div>
            </div>
          </section>
        ) : null}

        {stockAlertInsights.backInStockItems.length > 0 ? (
          <section className="stock-alerts__recovery" aria-label={t('pages.stockAlerts.recoveryTitle')}>
            <div>
              <Text className="stock-alerts__eyebrow">{t('pages.stockAlerts.recoveryEyebrow')}</Text>
              <Title level={4}>{t('pages.stockAlerts.recoveryTitle')}</Title>
              <Text type="secondary">
                {stockAlertInsights.bestReadyItem?.product
                  ? t('pages.stockAlerts.recoverySubtitleBest', {
                    name: stockAlertInsights.bestReadyItem.product.name,
                    price: formatMoney(stockAlertInsights.bestReadyItem.product.effectivePrice ?? stockAlertInsights.bestReadyItem.product.price),
                  })
                  : t('pages.stockAlerts.recoverySubtitle', { count: stockAlertInsights.backInStockItems.length })}
              </Text>
            </div>
            <Space wrap className="stock-alerts__recoveryActions">
              {stockAlertInsights.bestReadyItem?.product ? (
                <Button onClick={() => navigate(`/products/${stockAlertInsights.bestReadyItem!.productId}`)}>
                  {t('pages.stockAlerts.viewBestReady')}
                </Button>
              ) : null}
              <Button type="primary" icon={<ShoppingCartOutlined />} onClick={addReadyItemsToCart}>
                {t('pages.stockAlerts.addReadyToCart')}
              </Button>
            </Space>
          </section>
        ) : null}

        {alerts.length === 0 ? (
          <Empty description={t('pages.stockAlerts.empty')}>
            <Button type="primary" onClick={() => navigate('/products')}>{t('pages.stockAlerts.browse')}</Button>
          </Empty>
        ) : (
          <List
            loading={loading}
            dataSource={stockAlertInsights.items}
            renderItem={(item) => {
              const product = item.product;
              const ready = isBackInStock(product);
              return (
                <List.Item
                  className={ready ? 'stock-alerts__item' : 'stock-alerts__item stock-alerts__item--waiting'}
                  actions={[
                    <Button
                      key="add"
                      type="primary"
                      icon={<ShoppingCartOutlined />}
                      className={ready ? undefined : 'stock-alerts__soldoutButton'}
                      onClick={() => product && addToCart(product)}
                      disabled={!ready}
                    >
                      {ready ? t('pages.stockAlerts.addToCart') : t('pages.productList.soldOut')}
                    </Button>,
                    <Popconfirm
                      key="remove"
                      title={t('pages.stockAlerts.removeConfirm')}
                      onConfirm={() => removeAlert(item.productId)}
                    >
                      <Button icon={<DeleteOutlined />}>{t('pages.stockAlerts.remove')}</Button>
                    </Popconfirm>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={
                      <Link to={`/products/${item.productId}`}>
                        <Image
                          src={resolveStockAlertImage(product?.imageUrl || item.imageUrl)}
                          fallback={stockAlertImageFallback}
                          width={72}
                          height={72}
                          preview={false}
                          style={{ objectFit: 'cover', borderRadius: 8 }}
                        />
                      </Link>
                    }
                    title={<Link to={`/products/${item.productId}`}>{product?.name || item.productName}</Link>}
                    description={
                      <Space direction="vertical" size={4}>
                        <Text type="secondary">{t('pages.stockAlerts.createdAt', { time: new Date(item.createdAt).toLocaleString() })}</Text>
                        {product ? (
                          <>
                            <Text strong className="stock-alerts__price">{formatMoney(product.effectivePrice ?? product.price)}</Text>
                            <Tag color={ready ? 'green' : 'default'}>
                              {ready ? t('pages.productDetail.enough') : t('pages.productList.soldOut')}
                            </Tag>
                          </>
                        ) : null}
                      </Space>
                    }
                  />
                </List.Item>
              );
            }}
          />
        )}
      </Card>
    </div>
  );
};

export default StockAlerts;
