import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { ShopIcon, SI } from '../components/ShopIcon';
import { Alert, Button, Tag } from 'antd';
import ShopPopconfirm from '../components/ShopPopconfirm';
import { useNavigate } from 'react-router-dom';
import { wishlistApi, cartApi } from '../api';
import type { WishlistItem } from '../types';
import { useLanguage } from '../i18n';
import { usePageTitle } from '../hooks/usePageTitle';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { buildLoginUrl } from '../utils/authRedirect';
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

const WISHLIST_LOGIN_REQUIRED_MESSAGE_KEY = 'wishlist-login-required';
const wishlistImageFallback = productImageFallback;
const resolveWishlistImage = resolveProductImage;

const isPurchasable = (item: WishlistItem) =>
  (item.productStatus || 'ACTIVE') === 'ACTIVE' && (item.stock === undefined || item.stock > 0);

const getLowStockCount = (item: WishlistItem) =>
  item.stock !== undefined && item.stock > 0 && item.stock <= 5 ? item.stock : undefined;

const Wishlist: React.FC = () => {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(() => hasStoredValue('token'));
  const [authRequired, setAuthRequired] = useState(() => !hasStoredValue('token'));
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
      announceAccessibleMessage(errorMessage, 'error');
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
      setAuthRequired(true);
      setLoading(false);
      setItems([]);
      setLoadError(null);
      return;
    }
    setAuthRequired(false);
    setLoading(true);
    fetchWishlist();
  }, [fetchWishlist]);

  const handleRemove = async (productId: number) => {
    if (actionsDisabledByStaleData) {
      announceAccessibleMessage(t('pages.wishlist.staleActionBlocked'), 'warning');
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
      announceAccessibleMessage(t('pages.wishlist.removed'), 'success');
    } catch (error) {
      reportNonBlockingError('Wishlist.handleRemove', error);
      if (mountedRef.current) {
        announceAccessibleMessage(t('messages.operationFailed'), 'error');
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
      announceAccessibleMessage(t('pages.wishlist.staleActionBlocked'), 'warning');
      return;
    }
    try {
      await cartApi.addItem(0, productId, 1);
      if (!mountedRef.current) return;
      announceAccessibleMessage(t('messages.addCartSuccess'), 'success');
      dispatchDomEvent('shop:cart-updated');
      dispatchDomEvent('shop:open-cart');
    } catch (err: unknown) {
      if (mountedRef.current) {
        announceAccessibleMessage(getApiErrorMessage(err, t('messages.addFailed'), language), 'error');
      }
    }
  };

  const handleAddAllToCart = async () => {
    if (actionsDisabledByStaleData) {
      announceAccessibleMessage(t('pages.wishlist.staleActionBlocked'), 'warning');
      return;
    }
    if (addingAllToCartRef.current) return;
    if (directAddItems.length === 0) {
      announceAccessibleMessage(t('pages.wishlist.noDirectAdd'), 'info');
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
        announceAccessibleMessage(t('pages.wishlist.addedAllToCart', { count: added }), 'success');
        dispatchDomEvent('shop:cart-updated');
        dispatchDomEvent('shop:open-cart');
      } else {
        announceAccessibleMessage(t('messages.addFailed'), 'error');
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
      announceAccessibleMessage(t('pages.wishlist.staleActionBlocked'), 'warning');
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
      announceAccessibleMessage(t('pages.cart.clearedUnavailable', { count: removedProductIds.size }), 'success');
      return;
    }
    announceAccessibleMessage(t('messages.operationFailed'), 'error');
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
          icon={<ShopIcon path={SI.settings} />}
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
        icon={<ShopIcon path={SI.cart} />}
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
          <ShopIcon path={SI.checkCircle} />
          {ready ? t('pages.wishlist.cardReady') : item.requiresSelection ? t('pages.wishlist.cardNeedsOptions') : t('pages.wishlist.cardUnavailable')}
        </span>
        {lowStockCount !== undefined ? (
          <span className="wishlist-page__readinessPill wishlist-page__readinessPill--alert">
            <ShopIcon path={SI.thunder} />
            {t('pages.wishlist.lowStockLeft', { count: lowStockCount })}
          </span>
        ) : null}
      </div>
    );
  };

  if (authRequired) {
    const loginLabel = t('pages.wishlist.authGateLogin');
    const registerLabel = t('pages.wishlist.authGateRegister');
    return (
      <div
        className={`wishlist-page wishlist-page--${language} wishlist-page--empty wishlist-page--authGate`}
        data-auth-gate={WISHLIST_LOGIN_REQUIRED_MESSAGE_KEY}
      >
        <PageEmpty
          className="wishlist-page__authGate"
          description={(
            <div className="wishlist-page__emptyCopy">
              <h1 className="wishlist-page__title">{t('pages.wishlist.authGateTitle')}</h1>
              <div className="wishlist-page__emptyHint">{t('pages.wishlist.authGateHint')}</div>
            </div>
          )}
          actions={[
            {
              key: 'login',
              label: loginLabel,
              onClick: () => navigate(buildLoginUrl('/wishlist')),
            },
            {
              key: 'register',
              label: registerLabel,
              onClick: () => navigate('/register?redirect=%2Fwishlist'),
              type: 'default',
            },
            {
              key: 'browse',
              label: wishlistBrowseActionLabel,
              onClick: () => navigate('/products'),
              type: 'default',
            },
            {
              key: 'coupons',
              label: t('pages.wishlist.emptyCoupons'),
              onClick: () => navigate('/coupons'),
              type: 'default',
            },
          ]}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className="wishlist-page__loading"
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={t('common.loading')}
      >
        <h1 className="wishlist-page__title">{t('pages.wishlist.pageTitle')}</h1>
        <span className="wishlist-page__spinner" aria-hidden="true" />
      </div>
    );
  }

  if (items.length === 0 && loadError) {
    return (
      <div className={`wishlist-page wishlist-page--${language} wishlist-page--empty`}>
        <h1 className="wishlist-page__title">{t('pages.wishlist.pageTitle')}</h1>
        <div data-wishlist-load-recovery="true">
          <PageError
            className="wishlist-page__loadAlert"
            title={t('pages.wishlist.loadErrorTitle')}
            description={loadError}
            actions={[
              {
                key: 'retry',
                label: t('common.retry'),
                onClick: fetchWishlist,
                type: 'primary',
              },
              {
                key: 'browse',
                label: wishlistBrowseActionLabel,
                onClick: () => navigate('/products'),
                type: 'default',
              },
              {
                key: 'coupons',
                label: t('pages.productList.loadRecoveryCoupons'),
                onClick: () => navigate('/coupons'),
                type: 'default',
              },
              {
                key: 'pet-finder',
                label: t('pages.productDetail.notFoundPetFinder'),
                onClick: () => navigate('/pet-finder'),
                type: 'default',
              },
              {
                key: 'support',
                label: t('pages.productList.loadRecoverySupport'),
                onClick: () => dispatchDomEvent('shop:open-support'),
                type: 'default',
              },
            ]}
          />
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className={`wishlist-page wishlist-page--${language} wishlist-page--empty`}>
        <PageEmpty
          className="wishlist-page__emptyPanel"
          description={(
            <div className="wishlist-page__emptyCopy">
              <h1 className="wishlist-page__title">{t('pages.wishlist.empty')}</h1>
              <div className="wishlist-page__emptyHint">{t('pages.wishlist.emptyHint')}</div>
            </div>
          )}
          actions={[
            {
              key: 'browse',
              label: wishlistBrowseActionLabel,
              onClick: () => navigate('/products'),
            },
            {
              key: 'coupons',
              label: t('pages.wishlist.emptyCoupons'),
              onClick: () => navigate('/coupons'),
              type: 'default',
            },
            {
              key: 'pet-finder',
              label: t('pages.wishlist.emptyPetFinder'),
              onClick: () => navigate('/pet-finder'),
              type: 'default',
            },
          ]}
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
        <div className="wishlist-page__headerActions">
          <ShopIcon path={SI.heartFill} style={{ color: '#ee4d2d', fontSize: 24 }} />
          <h1 className="wishlist-page__title" style={{ margin: 0 }}>{t('pages.wishlist.title', { count: items.length })}</h1>
        </div>
        <Button
          type="primary"
          icon={<ShopIcon path={SI.cart} />}
          loading={addingAllToCart}
          disabled={addingAllToCart || directAddItems.length === 0 || actionsDisabledByStaleData}
          aria-label={addAllToCartActionLabel}
          title={addAllToCartActionLabel}
          onClick={handleAddAllToCart}
        >
          {t('pages.wishlist.addAllToCart')}
        </Button>
        {wishlistStats.unavailableCount > 0 ? (
          <ShopPopconfirm
            rootClassName='shop-mobile-popup-layer wishlist-clear-unavailable-popconfirm'
            title={t('pages.cart.clearUnavailableConfirm', { count: wishlistStats.unavailableCount })}
            onConfirm={clearUnavailableItems}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
            okButtonProps={{ danger: true, disabled: actionsDisabledByStaleData, 'aria-label': clearUnavailableActionLabel, title: clearUnavailableActionLabel }}
            cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${clearUnavailableActionLabel}`, title: `${t('common.cancel')}: ${clearUnavailableActionLabel}` }}
          >
            <Button danger icon={<ShopIcon path={SI.delete} />} aria-label={clearUnavailableActionLabel} title={clearUnavailableActionLabel} disabled={actionsDisabledByStaleData}>
              {t('pages.cart.clearUnavailable')}
            </Button>
          </ShopPopconfirm>
        ) : null}
      </div>
      <div className="wishlist-page__insightBar" aria-label={t('pages.wishlist.insightTitle')}>
        <div className="wishlist-page__insightIntro">
          <ShopIcon path={SI.thunder} />
          <div>
            <span className="wishlist-page__text wishlist-page__text--strong">{t('pages.wishlist.insightTitle')}</span>
            <span className="wishlist-page__text wishlist-page__text--secondary">{t('pages.wishlist.insightSubtitle')}</span>
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
          <span className="wishlist-page__text wishlist-page__text--strong">{t('pages.wishlist.recoveryTitle')}</span>
          <span className="wishlist-page__text wishlist-page__text--secondary">{recoveryText}</span>
        </div>
        <Button
          type="primary"
          icon={<ShopIcon path={SI.cart} />}
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
          <span className="wishlist-page__text wishlist-page__text--secondary">{t('pages.wishlist.nextActionEyebrow')}</span>
          <span className="wishlist-page__text wishlist-page__text--strong">{wishlistNextAction.title}</span>
          <span className="wishlist-page__text wishlist-page__text--secondary">{wishlistNextAction.text}</span>
        </div>
        <div className="wishlist-page__nextActionMeta">
          <Tag color="green"><span className="commerce-atomic">{t('pages.wishlist.readyValue', { amount: formatMoney(wishlistStats.readyValue) })}</span></Tag>
          <Tag color={wishlistStats.lowStockCount > 0 ? 'orange' : 'default'}>
            {t('pages.wishlist.lowStockItems', { count: wishlistStats.lowStockCount })}
          </Tag>
        </div>
        <Button
          type={wishlistNextAction.tone === 'ready' ? 'primary' : 'default'}
          icon={wishlistNextAction.tone === 'options' ? <ShopIcon path={SI.settings} /> : <ShopIcon path={SI.cart} />}
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
                <span className="wishlist-page__text wishlist-page__bestPickEyebrow">
                  <ShopIcon path={SI.fire} /> {t('pages.wishlist.bestPickEyebrow')}
                </span>
                <button
                  type="button"
                  className="wishlist-page__bestPickName"
                  onClick={() => navigate(`/products/${featuredWishlistItem.productId}`)}
                  aria-label={viewActionLabel}
                  title={productName}
                >
                  {productName}
                </button>
                <span className="wishlist-page__text wishlist-page__text--secondary">{getFeaturedReason(featuredWishlistItem)}</span>
                {renderReadiness(featuredWishlistItem)}
              </div>
              <div className="wishlist-page__bestPickAction">
                <span className="wishlist-page__text wishlist-page__price commerce-money">{formatMoney(featuredWishlistItem.productPrice)}</span>
                {featuredWishlistItem.requiresSelection ? (
                  <Button type="primary" icon={<ShopIcon path={SI.settings} />} aria-label={selectActionLabel} title={selectActionLabel} onClick={() => navigate(`/products/${featuredWishlistItem.productId}`)}>
                    {t('pages.wishlist.selectOptions')}
                  </Button>
                ) : (
                  <Button type="primary" icon={<ShopIcon path={SI.cart} />} aria-label={addActionLabel} title={addActionLabel} onClick={() => handleAddToCart(featuredWishlistItem.productId)} disabled={actionsDisabledByStaleData}>
                    {t('pages.productList.addToCart')}
                  </Button>
                )}
              </div>
            </div>
          );
        })()
      ) : null}
      <div className="wishlist-page__grid">
        {items.map(item => {
          const lowStockCount = getLowStockCount(item);
          const productName = wishlistProductName(item);
          const viewActionLabel = `${t('pages.productList.viewPick')}: ${productName}`;
          const removeActionLabel = `${t('pages.wishlist.remove')}: ${productName}`;
          const removing = removingProductIds.includes(item.productId);
          return (
          <div key={item.id} className="wishlist-page__gridItem">
            <article className="wishlist-page__card">
              <div className="wishlist-page__cover">
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
              </div>
              <div className="wishlist-page__body">
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
                  <span className="wishlist-page__text wishlist-page__price commerce-money">{formatMoney(item.productPrice)}</span>
                  <div className="wishlist-page__metaTags">
                    {lowStockCount !== undefined ? (
                      <Tag color="orange">{t('pages.wishlist.lowStockLeft', { count: lowStockCount })}</Tag>
                    ) : null}
                    {!isPurchasable(item) && <Tag color="red">{t('pages.wishlist.outOfStock')}</Tag>}
                  </div>
                </div>
                {renderReadiness(item)}
                <div className="wishlist-page__actions">
                  {primaryAction(item)}
                  <ShopPopconfirm
                    rootClassName='shop-mobile-popup-layer wishlist-remove-popconfirm'
                    title={t('pages.wishlist.removeConfirm')}
                    onConfirm={() => handleRemove(item.productId)}
                    okText={t('common.confirm')}
                    cancelText={t('common.cancel')}
                    okButtonProps={{ danger: true, disabled: actionsDisabledByStaleData, 'aria-label': removeActionLabel, title: removeActionLabel }}
                    cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${removeActionLabel}`, title: `${t('common.cancel')}: ${removeActionLabel}` }}
                  >
                    <Button
                      danger
                      icon={<ShopIcon path={SI.delete} />}
                      className="wishlist-page__removeAction"
                      block
                      loading={removing}
                      disabled={removing || actionsDisabledByStaleData}
                      aria-label={removeActionLabel}
                      title={removeActionLabel}
                    >
                      {t('pages.wishlist.remove')}
                    </Button>
                  </ShopPopconfirm>
                </div>
              </div>
            </article>
          </div>
          );
        })}
      </div>
      <div className={`wishlist-page__mobileAction wishlist-page__mobileAction--${wishlistNextAction.tone}`} aria-label={t('pages.wishlist.nextActionEyebrow')}>
        <span>
          <span className="wishlist-page__text wishlist-page__text--secondary">{t('pages.wishlist.nextActionEyebrow')}</span>
          <span className="wishlist-page__text wishlist-page__text--strong">{wishlistNextAction.title}</span>
          <span className="wishlist-page__text wishlist-page__text--secondary">{t('pages.wishlist.readyValue', { amount: formatMoney(wishlistStats.readyValue) })}</span>
        </span>
        <Button
          type={wishlistNextAction.tone === 'ready' ? 'primary' : 'default'}
          icon={wishlistNextAction.tone === 'options' ? <ShopIcon path={SI.settings} /> : <ShopIcon path={SI.cart} />}
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
