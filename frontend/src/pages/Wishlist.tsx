import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, Row, Col, Button, Empty, Spin, Typography, message, Popconfirm, Tag, Space } from 'antd';
import { ShoppingCartOutlined, DeleteOutlined, HeartFilled, SettingOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { apiBaseUrl, wishlistApi, cartApi } from '../api';
import type { WishlistItem } from '../types';
import { useLanguage } from '../i18n';
import { useMarket } from '../hooks/useMarket';
import './Wishlist.css';

const { Text, Title } = Typography;
const wishlistImageFallback = 'https://images.unsplash.com/photo-1601758125946-6ec2ef64daf8?auto=format&fit=crop&w=900&q=80';

const resolveWishlistImage = (imageUrl?: string) => {
  if (!imageUrl) return wishlistImageFallback;
  if (/^(https?:|data:|blob:)/i.test(imageUrl)) {
    return imageUrl;
  }
  return `${apiBaseUrl}${imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`}`;
};

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
      setItems((current) => current.filter(item => item.productId !== productId));
      window.dispatchEvent(new Event('shop:wishlist-updated'));
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
          className="wishlist-page__primaryAction"
          block
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
        className="wishlist-page__primaryAction"
        block
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
      <div className="wishlist-page wishlist-page--empty">
        <Empty description={t('pages.wishlist.empty')} />
        <Button type="primary" style={{ marginTop: 16 }} onClick={() => navigate('/products')}>{t('pages.wishlist.browse')}</Button>
      </div>
    );
  }

  return (
    <div className="wishlist-page">
      <div className="wishlist-page__header">
        <Space align="center">
          <HeartFilled style={{ color: '#ee4d2d', fontSize: 24 }} />
          <Title level={3} style={{ margin: 0 }}>{t('pages.wishlist.title', { count: items.length })}</Title>
        </Space>
        <Button type="primary" icon={<ShoppingCartOutlined />} disabled={directAddItems.length === 0} onClick={handleAddAllToCart}>
          {t('pages.wishlist.addAllToCart')}
        </Button>
      </div>
      <Row gutter={[16, 16]}>
        {items.map(item => (
          <Col key={item.id} xs={24} sm={12} md={8} lg={6}>
            <Card
              className="wishlist-page__card"
              hoverable
              cover={
                <button
                  type="button"
                  className="wishlist-page__imageButton"
                  onClick={() => navigate(`/products/${item.productId}`)}
                  aria-label={item.productName}
                >
                  <img
                    alt={item.productName}
                    src={resolveWishlistImage(item.imageUrl)}
                    className="wishlist-page__image"
                    onError={(event) => {
                      if (event.currentTarget.src !== wishlistImageFallback) {
                        event.currentTarget.src = wishlistImageFallback;
                      }
                    }}
                  />
                </button>
              }
            >
              <button
                type="button"
                className="wishlist-page__productName"
                onClick={() => navigate(`/products/${item.productId}`)}
                title={item.productName}
              >
                {item.productName}
              </button>
              <div className="wishlist-page__meta">
                <Text className="wishlist-page__price">{formatMoney(item.productPrice)}</Text>
                {!isPurchasable(item) && <Tag color="red">{t('pages.wishlist.outOfStock')}</Tag>}
              </div>
              <div className="wishlist-page__actions">
                {primaryAction(item)}
                <Popconfirm title={t('pages.wishlist.removeConfirm')} onConfirm={() => handleRemove(item.productId)}>
                  <Button danger icon={<DeleteOutlined />} className="wishlist-page__removeAction" block>
                    {t('pages.wishlist.remove')}
                  </Button>
                </Popconfirm>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default Wishlist;
