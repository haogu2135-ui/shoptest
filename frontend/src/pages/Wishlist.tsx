import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Button, Empty, Spin, Typography, message, Popconfirm, Tag } from 'antd';
import { ShoppingCartOutlined, DeleteOutlined, HeartFilled } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { wishlistApi, cartApi } from '../api';
import type { WishlistItem } from '../types';
import { useLanguage } from '../i18n';
import { useMarket } from '../hooks/useMarket';

const { Text, Title } = Typography;
const isPurchasable = (item: WishlistItem) =>
  (item.productStatus || 'ACTIVE') === 'ACTIVE' && (item.stock ?? 0) > 0;

const Wishlist: React.FC = () => {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const userId = Number(localStorage.getItem('userId'));
  const { t } = useLanguage();
  const { formatMoney } = useMarket();

  useEffect(() => {
    if (!userId) {
      message.warning(t('messages.loginRequired'));
      navigate('/login');
      return;
    }
    fetchWishlist();
  }, [userId, navigate]);

  const fetchWishlist = async () => {
    try {
      const res = await wishlistApi.getByUser(userId);
      setItems(res.data);
    } catch {
      message.error(t('pages.wishlist.fetchFailed'));
    } finally {
      setLoading(false);
    }
  };

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
    } catch (err: any) {
      message.error(err.response?.data?.error || t('messages.addFailed'));
    }
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
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
        <HeartFilled style={{ color: '#ee4d2d', fontSize: 24, marginRight: 8 }} />
        <Title level={3} style={{ margin: 0 }}>{t('pages.wishlist.title', { count: items.length })}</Title>
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
                <Button
                  type="primary"
                  icon={<ShoppingCartOutlined />}
                  size="small"
                  disabled={!isPurchasable(item)}
                  onClick={() => handleAddToCart(item.productId)}
                >
                  {t('pages.productList.addToCart')}
                </Button>,
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
