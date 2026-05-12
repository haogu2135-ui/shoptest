import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Empty, Image, message, Rate, Space, Spin, Table, Tag, Typography } from 'antd';
import { DeleteOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { cartApi, productApi } from '../api';
import { useLanguage } from '../i18n';
import { useMarket } from '../hooks/useMarket';
import type { Product } from '../types';
import { addGuestCartItem } from '../utils/guestCart';
import { localizeProduct } from '../utils/localizedProduct';
import { clearCompareProducts, readCompareProductIds, removeCompareProduct } from '../utils/productCompare';

const { Title, Text } = Typography;

const getPrice = (product: Product) => product.effectivePrice ?? product.price;

const ProductCompare: React.FC = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { formatMoney } = useMarket();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchComparedProducts = useCallback(async () => {
    const ids = readCompareProductIds();
    if (ids.length === 0) {
      setProducts([]);
      return;
    }
    try {
      setLoading(true);
      const responses = await Promise.allSettled(ids.map((id) => productApi.getById(id)));
      const nextProducts = responses.reduce<Product[]>((acc, result) => {
        if (result.status === 'fulfilled') {
          acc.push(localizeProduct(result.value.data, language));
        }
        return acc;
      }, []);
      ids
        .filter((id) => !nextProducts.some((product) => product.id === id))
        .forEach((id) => removeCompareProduct(id));
      setProducts(nextProducts);
    } catch {
      message.error(t('pages.compare.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [language, t]);

  useEffect(() => {
    fetchComparedProducts();
  }, [fetchComparedProducts]);

  const comparedIds = useMemo(() => products.map((product) => product.id), [products]);

  const removeProduct = (productId: number) => {
    removeCompareProduct(productId);
    setProducts((current) => current.filter((product) => product.id !== productId));
  };

  const clearAll = () => {
    clearCompareProducts();
    setProducts([]);
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
        addGuestCartItem(product, 1, undefined, getPrice(product));
      }
      message.success(t('messages.addCartSuccess'));
      window.dispatchEvent(new Event('shop:cart-updated'));
      window.dispatchEvent(new Event('shop:open-cart'));
    } catch {
      message.error(t('messages.addFailed'));
    }
  };

  const rows = [
    {
      key: 'image',
      label: t('common.image'),
      render: (product: Product) => (
        <Link to={`/products/${product.id}`}>
          <Image src={product.imageUrl} alt={product.name} width={120} height={120} preview={false} style={{ objectFit: 'cover', borderRadius: 8 }} />
        </Link>
      ),
    },
    {
      key: 'name',
      label: t('pages.compare.product'),
      render: (product: Product) => <Link to={`/products/${product.id}`}>{product.name}</Link>,
    },
    {
      key: 'price',
      label: t('pages.compare.price'),
      render: (product: Product) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ color: '#ee4d2d' }}>{formatMoney(getPrice(product))}</Text>
          {product.originalPrice && product.originalPrice > getPrice(product) ? (
            <Text delete type="secondary">{formatMoney(product.originalPrice)}</Text>
          ) : null}
        </Space>
      ),
    },
    {
      key: 'rating',
      label: t('pages.compare.rating'),
      render: (product: Product) => (
        <Space direction="vertical" size={0}>
          <Rate disabled allowHalf value={Number(product.averageRating || product.rating || 0)} />
          <Text type="secondary">{t('pages.productList.positiveRate', { rate: (product.positiveRate || 0).toFixed(1), count: product.reviewCount || 0 })}</Text>
        </Space>
      ),
    },
    {
      key: 'brand',
      label: t('pages.productDetail.brand'),
      render: (product: Product) => product.brand || t('common.unset'),
    },
    {
      key: 'stock',
      label: t('pages.productDetail.stock'),
      render: (product: Product) => product.stock === undefined ? t('pages.productDetail.enough') : product.stock > 0 ? product.stock : <Tag color="red">{t('pages.productList.soldOut')}</Tag>,
    },
    {
      key: 'shipping',
      label: t('pages.productDetail.shipping'),
      render: (product: Product) => product.freeShipping ? t('pages.productDetail.freeShipping') : product.shipping || t('pages.productDetail.defaultShipping'),
    },
    {
      key: 'actions',
      label: t('common.actions'),
      render: (product: Product) => (
        <Space direction="vertical">
          <Button type="primary" icon={<ShoppingCartOutlined />} onClick={() => addToCart(product)} disabled={product.stock !== undefined && product.stock <= 0}>
            {t('pages.productList.addToCart')}
          </Button>
          <Button icon={<DeleteOutlined />} onClick={() => removeProduct(product.id)}>
            {t('pages.compare.remove')}
          </Button>
        </Space>
      ),
    },
  ];

  const dataSource = rows.map((row) => ({
    key: row.key,
    attribute: row.label,
    ...Object.fromEntries(products.map((product) => [`product-${product.id}`, row.render(product)])),
  }));

  const columns = [
    {
      title: t('pages.compare.attribute'),
      dataIndex: 'attribute',
      key: 'attribute',
      fixed: 'left' as const,
      width: 150,
      render: (value: React.ReactNode) => <Text strong>{value}</Text>,
    },
    ...products.map((product) => ({
      title: product.name,
      dataIndex: `product-${product.id}`,
      key: `product-${product.id}`,
      width: 240,
    })),
  ];

  return (
    <div style={{ width: 'min(1200px, calc(100% - 24px))', margin: '0 auto', padding: '24px 0' }}>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
          <div>
            <Title level={2} style={{ margin: 0 }}>{t('pages.compare.title')}</Title>
            <Text type="secondary">{t('pages.compare.subtitle', { count: comparedIds.length })}</Text>
          </div>
          <Space wrap>
            <Button onClick={() => navigate('/products')}>{t('pages.compare.addMore')}</Button>
            <Button danger disabled={products.length === 0} onClick={clearAll}>{t('pages.compare.clear')}</Button>
          </Space>
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
        ) : products.length === 0 ? (
          <Empty description={t('pages.compare.empty')}>
            <Button type="primary" onClick={() => navigate('/products')}>{t('pages.compare.browse')}</Button>
          </Empty>
        ) : (
          <Table
            bordered
            pagination={false}
            columns={columns}
            dataSource={dataSource}
            scroll={{ x: 150 + products.length * 240 }}
          />
        )}
      </Card>
    </div>
  );
};

export default ProductCompare;
