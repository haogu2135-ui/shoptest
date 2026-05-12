import React, { useEffect, useState } from 'react';
import { Button, Card, Empty, Image, List, Popconfirm, Space, Typography, message } from 'antd';
import { BellOutlined, DeleteOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { cartApi, productApi } from '../api';
import { useLanguage } from '../i18n';
import { useMarket } from '../hooks/useMarket';
import type { Product } from '../types';
import { addGuestCartItem } from '../utils/guestCart';
import { clearStockAlerts, readStockAlerts, removeStockAlert, type StockAlertItem } from '../utils/stockAlerts';
import { localizeProduct } from '../utils/localizedProduct';

const { Title, Text } = Typography;

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
        const responses = await Promise.allSettled(alerts.map((alert) => productApi.getById(alert.productId)));
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

  const addToCart = async (product: Product) => {
    if (product.stock !== undefined && product.stock <= 0) {
      message.error(t('pages.productDetail.insufficientStock'));
      return;
    }
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    try {
      if (token && userId) {
        await cartApi.addItem(Number(userId), product.id, 1);
      } else {
        addGuestCartItem(product, 1, undefined, product.effectivePrice ?? product.price);
      }
      message.success(t('messages.addCartSuccess'));
      window.dispatchEvent(new Event('shop:cart-updated'));
      window.dispatchEvent(new Event('shop:open-cart'));
    } catch {
      message.error(t('messages.addFailed'));
    }
  };

  const items = alerts.map((alert) => ({
    ...alert,
    product: products[alert.productId],
  }));

  return (
    <div style={{ width: 'min(1200px, calc(100% - 24px))', margin: '0 auto', padding: '24px 0' }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
          <div>
            <Title level={2} style={{ margin: 0 }}>
              <BellOutlined /> {t('pages.stockAlerts.title')}
            </Title>
            <Text type="secondary">{t('pages.stockAlerts.subtitle', { count: alerts.length })}</Text>
          </div>
          <Space wrap>
            <Button onClick={() => navigate('/products')}>{t('pages.stockAlerts.browse')}</Button>
            <Button danger disabled={alerts.length === 0} onClick={clearAll}>{t('pages.stockAlerts.clear')}</Button>
          </Space>
        </div>

        {alerts.length === 0 ? (
          <Empty description={t('pages.stockAlerts.empty')}>
            <Button type="primary" onClick={() => navigate('/products')}>{t('pages.stockAlerts.browse')}</Button>
          </Empty>
        ) : (
          <List
            loading={loading}
            dataSource={items}
            renderItem={(item) => {
              const product = item.product;
              return (
                <List.Item
                  actions={[
                    <Button key="add" type="primary" icon={<ShoppingCartOutlined />} onClick={() => product && addToCart(product)} disabled={!product || (product.stock !== undefined && product.stock <= 0)}>
                      {t('pages.stockAlerts.addToCart')}
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
                          src={product?.imageUrl || item.imageUrl}
                          width={72}
                          height={72}
                          preview={false}
                          style={{ objectFit: 'cover', borderRadius: 8 }}
                        />
                      </Link>
                    }
                    title={<Link to={`/products/${item.productId}`}>{item.productName}</Link>}
                    description={
                      <Space direction="vertical" size={0}>
                        <Text type="secondary">{t('pages.stockAlerts.createdAt', { time: new Date(item.createdAt).toLocaleString() })}</Text>
                        {product ? (
                          <Text strong style={{ color: '#ee4d2d' }}>{formatMoney(product.effectivePrice ?? product.price)}</Text>
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
