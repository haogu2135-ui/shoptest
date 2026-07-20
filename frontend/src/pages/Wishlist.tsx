import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Card, Row, Col, Button, Spin, Typography, message, Popconfirm, Tag, Space } from 'antd';
import { ShoppingCartOutlined, DeleteOutlined, HeartFilled, SettingOutlined, ThunderboltOutlined, CheckCircleOutlined, FireOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { wishlistApi, cartApi } from '../api';
import type { WishlistItem } from '../types';
import { useLanguage } from '../i18n';
import { usePageTitle } from '../hooks/usePageTitle';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { buildLoginUrlFromWindow } from '../utils/authRedirect';
import { useMarket } from '../hooks/useMarket';
import { productImageFallback, resolveProductImage } from '../utils/productMedia';
import { dispatchDomEvent } from '../utils/domEvents';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import { hasStoredValue } from '../utils/safeStorage';
import { allSettledWithConcurrency } from '../utils/asyncBatch';
import { getApiErrorMessage } from '../utils/apiError';
import PageError from '../components/PageError';
import PageEmpty from '../components/PageEmpty';
import './Wishlist.css';
import '../styles/mobile-page-contrast.css';

const { Text, Title } = Typography;
const WISHLIST_LOGIN_REQUIRED_MESSAGE_KEY = 'wishlist-login-required';
const wishlistImageFallback = productImageFallback;
const resolveWishlistImage = resolveProductImage;

const isPurchasable = (item: WishlistItem) =>
  (item.productStatus || 'ACTIVE') === 'ACTIVE' && (item.stock === undefined || item.stock > 0);

const getLowStockCount = (item: WishlistItem) =>
  item.stock !== undefined && item.stock > 0 && item.stock <= 5 ? item.stock : undefined;

const Wishlist: React.FC = () => {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [removingProductIds, setRemovingProductIds] = useState<number[]>([]);
  const [addingAllToCart, setAddingAllToCart] = useState(false);
  const mountedRef = useRef(true);
  const wishlistFetchSeqRef = useRef(0);
  const removingProductIdsRef = useRef(new Set<number>());
  const addingAllToCartRef = useRef(false);
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  usePageTitle(t('pages.wishlist.pageTitle'));
  useDocumentMeta({
    title: t('pages.wishlist.pageTitle'),
    description: t('common.siteDescription'),
    path: '/wishlist',
    type: 'website',
    noIndex: true,
    siteName: t('common.siteTitle'),
  });
  const { formatMoney } = useMarket();
  const actionsDisabledByStaleData = Boolean(loadError);
  const wishlistProductName = useCallback((item: WishlistItem) =>
    (item.productName || '').trim() || t('pages.profile.productFallback', { id: item.productId }), [t]);
  const wishlistGroups = useMemo(() => {
    const directAddItems: WishlistItem[] = [];
    const optionItems: WishlistItem[] = [];
    const lowStockItems: WishlistItem[] = [];
    const unavailableItems: WishlistItem[] = [];
    let readyValue = 0;

    items.forEach((item) => {
      const purchasable = isPurchasable(item);
      if (!purchasable) {
        unavailableItems.push(item);
        return;
      }
      if (getLowStockCount(item) !== undefined) lowStockItems.push(item);
      if (item.requiresSelection) {
        optionItems.push(item);
      } else {
        directAddItems.push(item);
        readyValue += Number(item.productPrice || 0);
      }
    });

    return { directAddItems, optionItems, lowStockItems, unavailableItems, readyValue };
  }, [items]);
  const directAddItems = wishlistGroups.directAddItems;
  const wishlistStats = {
    optionCount: wishlistGroups.optionItems.length,
    lowStockCount: wishlistGroups.lowStockItems.length,
    unavailableCount: wishlistGroups.unavailableItems.length,
    readyValue: wishlistGroups.readyValue,
  };
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
    const requestSeq = wishlistFetchSeqRef.current + 1;
    wishlistFetchSeqRef.current = requestSeq;
    const isCurrentRequest = () => mountedRef.current && wishlistFetchSeqRef.current === requestSeq;
    try {
      const res = await wishlistApi.getByUser(0);
      if (!isCurrentRequest()) return;
      setItems(res.data);
      setLoadError(null);
    } catch (error) {
      if (!isCurrentRequest()) return;
      const errorMessage = getApiErrorMessage(error, t('pages.wishlist.fetchFailed'), language);
      setLoadError(errorMessage);
      reportNonBlockingError('Wishlist.fetchWishlist', error);
      message.error(errorMessage);
    } finally {
      if (!isCurrentRequest()) return;
      setLoading(false);
    }
  }, [language, t]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      wishlistFetchSeqRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (!hasStoredValue('token')) {
      message.open({
        key: WISHLIST_LOGIN_REQUIRED_MESSAGE_KEY,
        type: 'warning',
        content: t('messages.loginRequired'),
      });
      navigate(buildLoginUrlFromWindow());
      return;
    }
    fetchWishlist();
  }, [fetchWishlist, navigate, t]);

  const handleRemove = async (productId: number) => {
    if (actionsDisabledByStaleData) {
      message.warning(t('pages.wishlist.staleActionBlocked'));
      return;
    }
    if (removingProductIdsRef.current.has(productId)) return;
    removingProductIdsRef.current.add(productId);
    setRemovingProductIds((current) => current.includes(productId) ? current : [...current, productId]);
    try {
      await wishlistApi.remove(0, productId);
      if (!mountedRef.current) return;
      setItems((current) => current.filter(item => item.productId !== productId));
      dispatchDomEvent('shop:wishlist-updated');
      message.success(t('pages.wishlist.removed'));
    } catch (error) {
      reportNonBlockingError('Wishlist.handleRemove', error);
      if (mountedRef.current) {
        message.error(t('messages.operationFailed'));
      }
    } finally {
      removingProductIdsRef.current.delete(productId);
      if (mountedRef.current) {
        setRemovingProductIds((current) => current.filter((id) => id !== productId));
      }
    }
  };

  const handleAddToCart = async (productId: number) => {
    if (actionsDisabledByStaleData) {
      message.warning(t('pages.wishlist.staleActionBlocked'));
      return;
    }
    try {
      await cartApi.addItem(0, productId, 1);
      if (!mountedRef.current) return;
      message.success(t('messages.addCartSuccess'));
      dispatchDomEvent('shop:cart-updated');
      dispatchDomEvent('shop:open-cart');
    } catch (err: unknown) {
      if (mountedRef.current) {
        message.error(getApiErrorMessage(err, t('messages.addFailed'), language));
      }
    }
  };

  const handleAddAllToCart = async () => {
    if (actionsDisabledByStaleData) {
      message.warning(t('pages.wishlist.staleActionBlocked'));
      return;
    }
    if (addingAllToCartRef.current) return;
    if (directAddItems.length === 0) {
      message.info(t('pages.wishlist.noDirectAdd'));
      return;
    }
    addingAllToCartRef.current = true;
    setAddingAllToCart(true);
    try {
      const results = await allSettledWithConcurrency(
        directAddItems,
        (item) => cartApi.addItem(0, item.productId, 1),
      );
      if (!mountedRef.current) return;
      const added = results.filter((result) => result.status === 'fulfilled').length;
      if (added > 0) {
        message.success(t('pages.wishlist.addedAllToCart', { count: added }));
        dispatchDomEvent('shop:cart-updated');
        dispatchDomEvent('shop:open-cart');
      } else {
        message.error(t('messages.addFailed'));
      }
    } finally {
      addingAllToCartRef.current = false;
      if (mountedRef.current) {
        setAddingAllToCart(false);
      }
    }
  };

  const clearUnavailableItems = async () => {
    if (actionsDisabledByStaleData) {
      message.warning(t('pages.wishlist.staleActionBlocked'));
      return;
    }
    if (wishlistGroups.unavailableItems.length === 0) return;
    const results = await allSettledWithConcurrency(
      wishlistGroups.unavailableItems,
      (item) => wishlistApi.remove(0, item.productId),
    );
    if (!mountedRef.current) return;
    const removedProductIds = new Set(
      wishlistGroups.unavailableItems
        .filter((_, index) => results[index]?.status === 'fulfilled')
        .map((item) => item.productId),
    );
    if (removedProductIds.size > 0) {
      setItems((current) => current.filter((item) => !removedProductIds.has(item.productId)));
      dispatchDomEvent('shop:wishlist-updated');
      message.success(t('pages.cart.clearedUnavailable', { count: removedProductIds.size }));
      return;
    }
    message.error(t('messages.operationFailed'));
  };

  const recoveryAction = directAddItems.length > 0
    ? { label: t('pages.wishlist.addAllToCart'), action: handleAddAllToCart, disabled: addingAllToCart || actionsDisabledByStaleData }
    : wishlistStats.optionCount > 0
      ? { label: t('pages.wishlist.resolveOptions'), action: () => {
        const nextItem = items.find((item) => item.requiresSelection && isPurchasable(item));
        if (nextItem) navigate(`/products/${nextItem.productId}`);
      }, disabled: false }
      : { label: t('pages.wishlist.browse'), action: () => navigate('/products'), disabled: false };

  const wishlistNextAction = (() => {
    if (directAddItems.length > 0) {
      return {
        tone: 'ready',
        title: t('pages.wishlist.nextActionReadyTitle'),
        text: t('pages.wishlist.nextActionReadyText', {
          count: directAddItems.length,
          amount: formatMoney(wishlistStats.readyValue),
        }),
        label: t('pages.wishlist.addAllToCart'),
        action: handleAddAllToCart,
        disabled: addingAllToCart || actionsDisabledByStaleData,
      };
    }
    if (wishlistStats.optionCount > 0) {
      return {
        tone: 'options',
        title: t('pages.wishlist.nextActionOptionsTitle'),
        text: t('pages.wishlist.nextActionOptionsText', { count: wishlistStats.optionCount }),
        label: t('pages.wishlist.resolveOptions'),
        action: recoveryAction.action,
        disabled: false,
      };
    }
    if (wishlistStats.lowStockCount > 0 && featuredWishlistItem) {
      const featuredName = wishlistProductName(featuredWishlistItem);
      return {
        tone: 'urgent',
        title: t('pages.wishlist.nextActionLowStockTitle'),
        text: t('pages.wishlist.nextActionLowStockText', { name: featuredName }),
        label: t('pages.wishlist.viewBestPick'),
        action: () => navigate(`/products/${featuredWishlistItem.productId}`),
        disabled: false,
      };
    }
    return {
      tone: 'browse',
      title: t('pages.wishlist.nextActionBrowseTitle'),
      text: t('pages.wishlist.nextActionBrowseText'),
      label: t('pages.wishlist.browsePersonalized'),
      action: () => navigate('/products?sort=personalized-desc'),
      disabled: false,
    };
  })();
  const addAllToCartActionLabel = `${t('pages.wishlist.addAllToCart')}: ${directAddItems.length}`;
  const clearUnavailableActionLabel = `${t('pages.cart.clearUnavailable')}: ${wishlistStats.unavailableCount}`;
  const recoveryActionLabel = `${recoveryAction.label}: ${recoveryText}`;
  const wishlistNextActionLabel = `${wishlistNextAction.label}: ${wishlistNextAction.title}`;
  const wishlistBrowseActionLabel = t('pages.wishlist.browse');

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
    const productName = wishlistProductName(item);
    if (item.requiresSelection) {
      const selectActionLabel = `${t('pages.wishlist.selectOptions')}: ${productName}`;
      return (
        <Button
          type="primary"
          icon={<SettingOutlined />}
          className="wishlist-page__primaryAction"
          block
          disabled={!isPurchasable(item) || actionsDisabledByStaleData}
          aria-label={selectActionLabel}
          title={selectActionLabel}
          onClick={() => navigate(`/products/${item.productId}`)}
        >
          {t('pages.wishlist.selectOptions')}
        </Button>
      );
    }
    const addActionLabel = `${t('pages.productList.addToCart')}: ${productName}`;
    return (
      <Button
        type="primary"
        icon={<ShoppingCartOutlined />}
        className="wishlist-page__primaryAction"
        block
        disabled={!isPurchasable(item) || actionsDisabledByStaleData}
        aria-label={addActionLabel}
        title={addActionLabel}
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
    return (
      <div
        className="wishlist-page__loading"
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={t('common.loading')}
      >
        <Spin size="large" />
      </div>
    );
  }

  if (items.length === 0 && loadError) {
    return (
      <div className={`wishlist-page wishlist-page--${language} wishlist-page--empty`}>
        <PageError
          className="wishlist-page__loadAlert"
          title={t('pages.wishlist.loadErrorTitle')}
          description={loadError}
          retryLabel={t('common.retry')}
          onRetry={fetchWishlist}
          homeLabel={wishlistBrowseActionLabel}
          onHome={() => navigate('/products')}
        />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className={`wishlist-page wishlist-page--${language} wishlist-page--empty`}>
        <PageEmpty
          description={t('pages.wishlist.empty')}
          primaryAction={{
            key: 'browse',
            label: wishlistBrowseActionLabel,
            onClick: () => navigate('/products'),
          }}
          secondaryAction={{
            key: 'home',
            label: t('nav.ariaHome'),
            onClick: () => navigate('/'),
            type: 'default',
          }}
        />
      </div>
    );
  }

  return (
    <div className={`wishlist-page wishlist-page--${language} wishlist-page--withMobileAction`}>
      {loadError ? (
        <Alert
          className="wishlist-page__loadAlert"
          type="warning"
          showIcon
          message={t('pages.wishlist.loadErrorTitle')}
          description={t('pages.wishlist.staleDataWarning')}
          action={(
            <Button size="small" onClick={fetchWishlist} loading={loading}>
              {t('common.retry')}
            </Button>
          )}
        />
      ) : null}
      <div className="wishlist-page__header">
        <Space align="center">
          <HeartFilled style={{ color: '#ee4d2d', fontSize: 24 }} />
          <Title level={3} style={{ margin: 0 }}>{t('pages.wishlist.title', { count: items.length })}</Title>
        </Space>
        <Button
          type="primary"
          icon={<ShoppingCartOutlined />}
          loading={addingAllToCart}
          disabled={addingAllToCart || directAddItems.length === 0 || actionsDisabledByStaleData}
          aria-label={addAllToCartActionLabel}
          title={addAllToCartActionLabel}
          onClick={handleAddAllToCart}
        >
          {t('pages.wishlist.addAllToCart')}
        </Button>
        {wishlistStats.unavailableCount > 0 ? (
          <Popconfirm
            classNames={{ root: 'shop-mobile-popup-layer wishlist-clear-unavailable-popconfirm' }}
            title={t('pages.cart.clearUnavailableConfirm', { count: wishlistStats.unavailableCount })}
            onConfirm={clearUnavailableItems}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
            okButtonProps={{ danger: true, disabled: actionsDisabledByStaleData, 'aria-label': clearUnavailableActionLabel, title: clearUnavailableActionLabel }}
            cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${clearUnavailableActionLabel}`, title: `${t('common.cancel')}: ${clearUnavailableActionLabel}` }}
          >
            <Button danger icon={<DeleteOutlined />} aria-label={clearUnavailableActionLabel} title={clearUnavailableActionLabel} disabled={actionsDisabledByStaleData}>
              {t('pages.cart.clearUnavailable')}
            </Button>
          </Popconfirm>
        ) : null}
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
        <Button
          type="primary"
          icon={<ShoppingCartOutlined />}
          loading={addingAllToCart && directAddItems.length > 0}
          disabled={recoveryAction.disabled}
          aria-label={recoveryActionLabel}
          title={recoveryActionLabel}
          onClick={recoveryAction.action}
        >
          {recoveryAction.label}
        </Button>
      </div>
      <div className={`wishlist-page__nextAction wishlist-page__nextAction--${wishlistNextAction.tone}`}>
        <div>
          <Text type="secondary">{t('pages.wishlist.nextActionEyebrow')}</Text>
          <Text strong>{wishlistNextAction.title}</Text>
          <Text type="secondary">{wishlistNextAction.text}</Text>
        </div>
        <Space wrap className="wishlist-page__nextActionMeta">
          <Tag color="green"><span className="commerce-atomic">{t('pages.wishlist.readyValue', { amount: formatMoney(wishlistStats.readyValue) })}</span></Tag>
          <Tag color={wishlistStats.lowStockCount > 0 ? 'orange' : 'default'}>
            {t('pages.wishlist.lowStockItems', { count: wishlistStats.lowStockCount })}
          </Tag>
        </Space>
        <Button
          type={wishlistNextAction.tone === 'ready' ? 'primary' : 'default'}
          icon={wishlistNextAction.tone === 'options' ? <SettingOutlined /> : <ShoppingCartOutlined />}
          loading={wishlistNextAction.tone === 'ready' && addingAllToCart}
          disabled={wishlistNextAction.disabled}
          aria-label={wishlistNextActionLabel}
          title={wishlistNextActionLabel}
          onClick={wishlistNextAction.action}
        >
          {wishlistNextAction.label}
        </Button>
      </div>
      {featuredWishlistItem ? (
        (() => {
          const productName = wishlistProductName(featuredWishlistItem);
          const viewActionLabel = `${t('pages.productList.viewPick')}: ${productName}`;
          const selectActionLabel = `${t('pages.wishlist.selectOptions')}: ${productName}`;
          const addActionLabel = `${t('pages.productList.addToCart')}: ${productName}`;
          return (
            <div className="wishlist-page__bestPick">
              <button
                type="button"
                className="wishlist-page__bestPickImageButton"
                onClick={() => navigate(`/products/${featuredWishlistItem.productId}`)}
                aria-label={viewActionLabel}
                title={viewActionLabel}
              >
                <img
                  alt={productName}
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
                  aria-label={viewActionLabel}
                  title={productName}
                >
                  {productName}
                </button>
                <Text type="secondary">{getFeaturedReason(featuredWishlistItem)}</Text>
                {renderReadiness(featuredWishlistItem)}
              </div>
              <div className="wishlist-page__bestPickAction">
                <Text className="wishlist-page__price commerce-money">{formatMoney(featuredWishlistItem.productPrice)}</Text>
                {featuredWishlistItem.requiresSelection ? (
                  <Button type="primary" icon={<SettingOutlined />} aria-label={selectActionLabel} title={selectActionLabel} onClick={() => navigate(`/products/${featuredWishlistItem.productId}`)}>
                    {t('pages.wishlist.selectOptions')}
                  </Button>
                ) : (
                  <Button type="primary" icon={<ShoppingCartOutlined />} aria-label={addActionLabel} title={addActionLabel} onClick={() => handleAddToCart(featuredWishlistItem.productId)} disabled={actionsDisabledByStaleData}>
                    {t('pages.productList.addToCart')}
                  </Button>
                )}
              </div>
            </div>
          );
        })()
      ) : null}
      <Row gutter={[16, 16]}>
        {items.map(item => {
          const lowStockCount = getLowStockCount(item);
          const productName = wishlistProductName(item);
          const viewActionLabel = `${t('pages.productList.viewPick')}: ${productName}`;
          const removeActionLabel = `${t('pages.wishlist.remove')}: ${productName}`;
          const removing = removingProductIds.includes(item.productId);
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
                  aria-label={viewActionLabel}
                  title={viewActionLabel}
                >
                  <img
                    alt={productName}
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
                aria-label={viewActionLabel}
                title={productName}
              >
                {productName}
              </button>
              <div className="wishlist-page__meta">
                <Text className="wishlist-page__price commerce-money">{formatMoney(item.productPrice)}</Text>
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
                <Popconfirm
                  classNames={{ root: 'shop-mobile-popup-layer wishlist-remove-popconfirm' }}
                  title={t('pages.wishlist.removeConfirm')}
                  onConfirm={() => handleRemove(item.productId)}
                  okText={t('common.confirm')}
                  cancelText={t('common.cancel')}
                  okButtonProps={{ danger: true, disabled: actionsDisabledByStaleData, 'aria-label': removeActionLabel, title: removeActionLabel }}
                  cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${removeActionLabel}`, title: `${t('common.cancel')}: ${removeActionLabel}` }}
                >
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    className="wishlist-page__removeAction"
                    block
                    loading={removing}
                    disabled={removing || actionsDisabledByStaleData}
                    aria-label={removeActionLabel}
                    title={removeActionLabel}
                  >
                    {t('pages.wishlist.remove')}
                  </Button>
                </Popconfirm>
              </div>
            </Card>
          </Col>
          );
        })}
      </Row>
      <div className={`wishlist-page__mobileAction wishlist-page__mobileAction--${wishlistNextAction.tone}`} aria-label={t('pages.wishlist.nextActionEyebrow')}>
        <span>
          <Text type="secondary">{t('pages.wishlist.nextActionEyebrow')}</Text>
          <Text strong>{wishlistNextAction.title}</Text>
          <Text type="secondary">{t('pages.wishlist.readyValue', { amount: formatMoney(wishlistStats.readyValue) })}</Text>
        </span>
        <Button
          type={wishlistNextAction.tone === 'ready' ? 'primary' : 'default'}
          icon={wishlistNextAction.tone === 'options' ? <SettingOutlined /> : <ShoppingCartOutlined />}
          loading={wishlistNextAction.tone === 'ready' && addingAllToCart}
          disabled={wishlistNextAction.disabled}
          aria-label={wishlistNextActionLabel}
          title={wishlistNextActionLabel}
          onClick={wishlistNextAction.action}
        >
          {wishlistNextAction.label}
        </Button>
      </div>
    </div>
  );
};

export default Wishlist;
