import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, Row, Col, Button, Empty, Spin, Typography, message, Popconfirm, Tag, Space } from 'antd';
import { ShoppingCartOutlined, DeleteOutlined, HeartFilled, SettingOutlined, ThunderboltOutlined, CheckCircleOutlined, FireOutlined } from '@ant-design/icons';
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

const getLowStockCount = (item: WishlistItem) =>
  item.stock !== undefined && item.stock > 0 && item.stock <= 5 ? item.stock : undefined;

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
  const wishlistStats = useMemo(() => {
    const optionCount = items.filter((item) => item.requiresSelection && isPurchasable(item)).length;
    const lowStockCount = items.filter((item) => getLowStockCount(item) !== undefined).length;
    const unavailableCount = items.filter((item) => !isPurchasable(item)).length;
    return { optionCount, lowStockCount, unavailableCount };
  }, [items]);
  const featuredWishlistItem = useMemo(() => {
    return [...items]
      .filter(isPurchasable)
      .sort((a, b) => {
        const score = (item: WishlistItem) => {
          const lowStockBoost = getLowStockCount(item) !== undefined ? 48 : 0;
          const readyBoost = item.requiresSelection ? 12 : 36;
          const priceBoost = Math.min(Number(item.productPrice) || 0, 120) / 4;
          return lowStockBoost + readyBoost + priceBoost;
        };
        return score(b) - score(a);
      })[0];
  }, [items]);
  const recoveryText = directAddItems.length > 0
    ? t('pages.wishlist.recoveryDirectText', { count: directAddItems.length })
    : wishlistStats.optionCount > 0
      ? t('pages.wishlist.recoveryOptionsText', { count: wishlistStats.optionCount })
      : wishlistStats.unavailableCount > 0
        ? t('pages.wishlist.recoveryUnavailableText')
        : t('pages.wishlist.recoveryBrowseText');

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
    const results = await Promise.allSettled(
      directAddItems.map((item) => cartApi.addItem(userId, item.productId, 1)),
    );
    const added = results.filter((result) => result.status === 'fulfilled').length;
    if (added > 0) {
      message.success(t('pages.wishlist.addedAllToCart', { count: added }));
      window.dispatchEvent(new Event('shop:cart-updated'));
      window.dispatchEvent(new Event('shop:open-cart'));
    } else {
      message.error(t('messages.addFailed'));
    }
  };

  const recoveryAction = directAddItems.length > 0
    ? { label: t('pages.wishlist.addAllToCart'), action: handleAddAllToCart, disabled: false }
    : wishlistStats.optionCount > 0
      ? { label: t('pages.wishlist.resolveOptions'), action: () => {
        const nextItem = items.find((item) => item.requiresSelection && isPurchasable(item));
        if (nextItem) navigate(`/products/${nextItem.productId}`);
      }, disabled: false }
      : { label: t('pages.wishlist.browse'), action: () => navigate('/products'), disabled: false };

  const getFeaturedReason = (item: WishlistItem) => {
    const lowStockCount = getLowStockCount(item);
    if (lowStockCount !== undefined) {
      return t('pages.wishlist.bestPickLowStock', { count: lowStockCount });
    }
    return item.requiresSelection
      ? t('pages.wishlist.bestPickOptions')
      : t('pages.wishlist.bestPickReady');
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
  const renderReadiness = (item: WishlistItem) => {
    const purchasable = isPurchasable(item);
    const lowStockCount = getLowStockCount(item);
    const ready = purchasable && !item.requiresSelection;
    return (
      <div className="wishlist-page__readiness">
        <span className={ready ? 'wishlist-page__readinessPill wishlist-page__readinessPill--ready' : 'wishlist-page__readinessPill'}>
          <CheckCircleOutlined />
          {ready ? t('pages.wishlist.cardReady') : item.requiresSelection ? t('pages.wishlist.cardNeedsOptions') : t('pages.wishlist.cardUnavailable')}
        </span>
        {lowStockCount !== undefined ? (
          <span className="wishlist-page__readinessPill wishlist-page__readinessPill--alert">
            <ThunderboltOutlined />
            {t('pages.wishlist.lowStockLeft', { count: lowStockCount })}
          </span>
        ) : null}
      </div>
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
      <div className="wishlist-page__insightBar" aria-label={t('pages.wishlist.insightTitle')}>
        <div className="wishlist-page__insightIntro">
          <ThunderboltOutlined />
          <div>
            <Text strong>{t('pages.wishlist.insightTitle')}</Text>
            <Text type="secondary">{t('pages.wishlist.insightSubtitle')}</Text>
          </div>
        </div>
        <div className="wishlist-page__insightStats">
          <Tag color="green">{t('pages.wishlist.readyToCart', { count: directAddItems.length })}</Tag>
          <Tag color="blue">{t('pages.wishlist.needOptions', { count: wishlistStats.optionCount })}</Tag>
          <Tag color="orange">{t('pages.wishlist.lowStockItems', { count: wishlistStats.lowStockCount })}</Tag>
          {wishlistStats.unavailableCount > 0 ? (
            <Tag color="red">{t('pages.wishlist.unavailableItems', { count: wishlistStats.unavailableCount })}</Tag>
          ) : null}
        </div>
      </div>
      <div className="wishlist-page__recovery">
        <div>
          <Text strong>{t('pages.wishlist.recoveryTitle')}</Text>
          <Text type="secondary">{recoveryText}</Text>
        </div>
        <Button type="primary" icon={<ShoppingCartOutlined />} disabled={recoveryAction.disabled} onClick={recoveryAction.action}>
          {recoveryAction.label}
        </Button>
      </div>
      {featuredWishlistItem ? (
        <div className="wishlist-page__bestPick">
          <button
            type="button"
            className="wishlist-page__bestPickImageButton"
            onClick={() => navigate(`/products/${featuredWishlistItem.productId}`)}
            aria-label={featuredWishlistItem.productName}
          >
            <img
              alt={featuredWishlistItem.productName}
              src={resolveWishlistImage(featuredWishlistItem.imageUrl)}
              className="wishlist-page__bestPickImage"
              onError={(event) => {
                if (event.currentTarget.src !== wishlistImageFallback) {
                  event.currentTarget.src = wishlistImageFallback;
                }
              }}
            />
          </button>
          <div className="wishlist-page__bestPickBody">
            <Text className="wishlist-page__bestPickEyebrow">
              <FireOutlined /> {t('pages.wishlist.bestPickEyebrow')}
            </Text>
            <button
              type="button"
              className="wishlist-page__bestPickName"
              onClick={() => navigate(`/products/${featuredWishlistItem.productId}`)}
              title={featuredWishlistItem.productName}
            >
              {featuredWishlistItem.productName}
            </button>
            <Text type="secondary">{getFeaturedReason(featuredWishlistItem)}</Text>
            {renderReadiness(featuredWishlistItem)}
          </div>
          <div className="wishlist-page__bestPickAction">
            <Text className="wishlist-page__price">{formatMoney(featuredWishlistItem.productPrice)}</Text>
            {featuredWishlistItem.requiresSelection ? (
              <Button type="primary" icon={<SettingOutlined />} onClick={() => navigate(`/products/${featuredWishlistItem.productId}`)}>
                {t('pages.wishlist.selectOptions')}
              </Button>
            ) : (
              <Button type="primary" icon={<ShoppingCartOutlined />} onClick={() => handleAddToCart(featuredWishlistItem.productId)}>
                {t('pages.productList.addToCart')}
              </Button>
            )}
          </div>
        </div>
      ) : null}
      <Row gutter={[16, 16]}>
        {items.map(item => {
          const lowStockCount = getLowStockCount(item);
          return (
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
                <Space size={4} wrap>
                  {lowStockCount !== undefined ? (
                    <Tag color="orange">{t('pages.wishlist.lowStockLeft', { count: lowStockCount })}</Tag>
                  ) : null}
                  {!isPurchasable(item) && <Tag color="red">{t('pages.wishlist.outOfStock')}</Tag>}
                </Space>
              </div>
              {renderReadiness(item)}
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
          );
        })}
      </Row>
    </div>
  );
};

export default Wishlist;
