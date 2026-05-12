import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, Row, Col, Button, Empty, Spin, Typography, message, Popconfirm, Tag, Space } from 'antd';
import { ShoppingCartOutlined, DeleteOutlined, HeartFilled, SettingOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { wishlistApi, cartApi } from '../api';
import type { WishlistItem } from '../types';
import { useLanguage } from '../i18n';
import { useMarket } from '../hooks/useMarket';

const { Text, Title } = Typography;
const isPurchasable = (item: WishlistItem) =>
  (item.productStatus || 'ACTIVE') === 'ACTIVE' && (item.stock === undefined || item.stock > 0);

const Wishlist: React.FC = () => {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const userId = Number(localStorage.getItem('userId'));
  const { t } = useLanguage();
  const { formatMoney } = useMarket();
  const directAddItems = useMemo(
    () => items.filter((item) => isPurchasable(item) && !item.requiresSelection),
    [items],
  );

  const fetchWishlist = useCallback(async () => {
    try {
      const res = await wishlistApi.getByUser(userId);
      setItems(res.data);
    } catch {
      message.error(t('pages.wishlist.fetchFailed'));
    } finally {
      setLoading(false);
    }
  }, [t, userId]);

  useEffect(() => {
    if (!userId) {
      message.warning(t('messages.loginRequired'));
      navigate('/login');
      return;
    }
    fetchWishlist();
  }, [fetchWishlist, userId, navigate, t]);

  const handleRemove = async (productId: number) => {
    try {
      await wishlistApi.remove(userId, productId);
      setItems(items.filter(item => item.productId !== productId));
      message.success(t('pages.wishlist.removed'));
    } catch {
      message.error(t('messages.operationFailed'));
    }
  };

  const handleAddToCart = async (productId: number) => {
    try {
      await cartApi.addItem(userId, productId, 1);
      message.success(t('messages.addCartSuccess'));
      window.dispatchEvent(new Event('shop:cart-updated'));
      window.dispatchEvent(new Event('shop:open-cart'));
    } catch (err: any) {
      message.error(err.response?.data?.error || t('messages.addFailed'));
    }
  };

  const handleAddAllToCart = async () => {
    if (directAddItems.length === 0) {
      message.info(t('pages.wishlist.noDirectAdd'));
      return;
    }
    let added = 0;
    for (const item of directAddItems) {
      try {
        await cartApi.addItem(userId, item.productId, 1);
        added += 1;
      } catch {
        // Continue with the rest of the wishlist items.
      }
    }
    if (added > 0) {
      message.success(t('pages.wishlist.addedAllToCart', { count: added }));
      window.dispatchEvent(new Event('shop:cart-updated'));
      window.dispatchEvent(new Event('shop:open-cart'));
    } else {
      message.error(t('messages.addFailed'));
    }
  };

  const primaryAction = (item: WishlistItem) => {
    if (item.requiresSelection) {
      return (
        <Button
          type="primary"
          icon={<SettingOutlined />}
          size="small"
          disabled={!isPurchasable(item)}
          onClick={() => navigate(`/products/${item.productId}`)}
        >
          {t('pages.wishlist.selectOptions')}
        </Button>
      );
    }
    return (
      <Button
        type="primary"
        icon={<ShoppingCartOutlined />}
        size="small"
        disabled={!isPurchasable(item)}
        onClick={() => handleAddToCart(item.productId)}
      >
        {t('pages.productList.addToCart')}
      </Button>
    );
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  }

  if (items.length === 0) {
    return (
      <div style={{ padding: '80px 24px', textAlign: 'center' }}>
        <Empty description={t('pages.wishlist.empty')} />
        <Button type="primary" style={{ marginTop: 16 }} onClick={() => navigate('/products')}>{t('pages.wishlist.browse')}</Button>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <Space align="center">
          <HeartFilled style={{ color: '#ee4d2d', fontSize: 24 }} />
          <Title level={3} style={{ margin: 0 }}>{t('pages.wishlist.title', { count: items.length })}</Title>
        </Space>
        <Button type="primary" disabled={directAddItems.length === 0} onClick={handleAddAllToCart}>
          {t('pages.wishlist.addAllToCart')}
        </Button>
      </div>
      <Row gutter={[16, 16]}>
        {items.map(item => (
          <Col key={item.id} xs={24} sm={12} md={8} lg={6}>
            <Card
              hoverable
              cover={
                <img
                  alt={item.productName}
                  src={item.imageUrl}
                  style={{ height: 200, objectFit: 'cover' }}
                  onClick={() => navigate(`/products/${item.productId}`)}
                />
              }
              actions={[
                primaryAction(item),
                <Popconfirm title={t('pages.wishlist.removeConfirm')} onConfirm={() => handleRemove(item.productId)}>
                  <Button danger icon={<DeleteOutlined />} size="small">{t('pages.wishlist.remove')}</Button>
                </Popconfirm>,
              ]}
            >
              <Card.Meta
                title={<Text ellipsis={{ tooltip: item.productName }}>{item.productName}</Text>}
                description={
                  <>
                    <Text style={{ color: '#ee4d2d', fontWeight: 600, fontSize: 16 }}>{formatMoney(item.productPrice)}</Text>
                    {!isPurchasable(item) && <div style={{ marginTop: 8 }}><Tag color="red">Out of stock</Tag></div>}
                  </>
                }
              />
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default Wishlist;
