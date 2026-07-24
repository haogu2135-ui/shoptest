import React from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { ShopIcon, SI } from '../components/ShopIcon';
import ShopPopconfirm from '../components/ShopPopconfirm';
import type { WishlistItem } from '../types';
import { buildLoginUrl } from '../utils/authRedirect';
import { dispatchDomEvent } from '../utils/domEvents';
import PageError from '../components/PageError';
import PageEmpty from '../components/PageEmpty';
import ShopButton from '../components/ShopButton';
import ShopTag from '../components/ShopTag';
import ShopAlert from '../components/ShopAlert';
import {
  WISHLIST_LOGIN_REQUIRED_MESSAGE_KEY,
  getLowStockCount,
  isPurchasable,
  resolveWishlistImage,
  wishlistImageFallback,
  type WishlistStats,
  type WishlistTranslate,
} from './wishlistHelpers';

export type WishlistAction = {
  tone?: string;
  title?: string;
  text?: string;
  label: string;
  action: () => void;
  disabled: boolean;
};

export type WishlistPanelsProps = {
  t: WishlistTranslate;
  language: string;
  navigate: NavigateFunction;
  formatMoney: (value?: number | null) => string;
  items: WishlistItem[];
  loading: boolean;
  loadError: string | null;
  directAddItems: WishlistItem[];
  wishlistStats: WishlistStats;
  featuredWishlistItem?: WishlistItem;
  recoveryText: string;
  recoveryAction: WishlistAction;
  wishlistNextAction: WishlistAction;
  addAllToCartActionLabel: string;
  clearUnavailableActionLabel: string;
  recoveryActionLabel: string;
  wishlistNextActionLabel: string;
  wishlistBrowseActionLabel: string;
  addingAllToCart: boolean;
  actionsDisabledByStaleData: boolean;
  removingProductIds: number[];
  wishlistProductName: (item: WishlistItem) => string;
  fetchWishlist: () => void;
  handleAddAllToCart: () => void;
  handleAddToCart: (productId: number) => void;
  handleRemove: (productId: number) => void;
  clearUnavailableItems: () => void;
};

const getFeaturedReason = (item: WishlistItem, t: WishlistTranslate) => {
  const lowStockCount = getLowStockCount(item);
  if (lowStockCount !== undefined) {
    return t('pages.wishlist.bestPickLowStock', { count: lowStockCount });
  }
  return item.requiresSelection
    ? t('pages.wishlist.bestPickOptions')
    : t('pages.wishlist.bestPickReady');
};

const renderReadiness = (item: WishlistItem, t: WishlistTranslate) => {
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

const primaryAction = (
  item: WishlistItem,
  t: WishlistTranslate,
  navigate: NavigateFunction,
  actionsDisabledByStaleData: boolean,
  handleAddToCart: (productId: number) => void,
  wishlistProductName: (item: WishlistItem) => string,
) => {
  const productName = wishlistProductName(item);
  if (item.requiresSelection) {
    const selectActionLabel = `${t('pages.wishlist.selectOptions')}: ${productName}`;
    return (
      <ShopButton
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
      </ShopButton>
    );
  }
  const addActionLabel = `${t('pages.productList.addToCart')}: ${productName}`;
  return (
    <ShopButton
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
    </ShopButton>
  );
};

export const WishlistAuthGate: React.FC<{
  t: WishlistTranslate;
  language: string;
  navigate: NavigateFunction;
  wishlistBrowseActionLabel: string;
}> = ({ t, language, navigate, wishlistBrowseActionLabel }) => {
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
};

export const WishlistLoadingShell: React.FC<{ t: WishlistTranslate }> = ({ t }) => (
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

export const WishlistLoadErrorShell: React.FC<{
  t: WishlistTranslate;
  language: string;
  loadError: string;
  wishlistBrowseActionLabel: string;
  fetchWishlist: () => void;
  navigate: NavigateFunction;
}> = ({ t, language, loadError, wishlistBrowseActionLabel, fetchWishlist, navigate }) => (
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

export const WishlistEmptyShell: React.FC<{
  t: WishlistTranslate;
  language: string;
  wishlistBrowseActionLabel: string;
  navigate: NavigateFunction;
}> = ({ t, language, wishlistBrowseActionLabel, navigate }) => (
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

export const WishlistMainPanels: React.FC<WishlistPanelsProps> = ({
  t,
  language,
  navigate,
  formatMoney,
  items,
  loading,
  loadError,
  directAddItems,
  wishlistStats,
  featuredWishlistItem,
  recoveryText,
  recoveryAction,
  wishlistNextAction,
  addAllToCartActionLabel,
  clearUnavailableActionLabel,
  recoveryActionLabel,
  wishlistNextActionLabel,
  addingAllToCart,
  actionsDisabledByStaleData,
  removingProductIds,
  wishlistProductName,
  fetchWishlist,
  handleAddAllToCart,
  handleAddToCart,
  handleRemove,
  clearUnavailableItems,
}) => (
  <div className={`wishlist-page wishlist-page--${language} wishlist-page--withMobileAction`}>
    {loadError ? (
      <ShopAlert
        className="wishlist-page__loadAlert"
        type="warning"
        showIcon
        message={t('pages.wishlist.loadErrorTitle')}
        description={t('pages.wishlist.staleDataWarning')}
        action={(
          <ShopButton size="small" onClick={fetchWishlist} loading={loading}>
            {t('common.retry')}
          </ShopButton>
        )}
      />
    ) : null}
    <div className="wishlist-page__header">
      <div className="wishlist-page__headerActions">
        <ShopIcon path={SI.heartFill} className="wishlist-page__headerIcon" aria-hidden="true" />
        <h1 className="wishlist-page__title">{t('pages.wishlist.title', { count: items.length })}</h1>
      </div>
      <ShopButton
        type="primary"
        icon={<ShopIcon path={SI.cart} />}
        loading={addingAllToCart}
        disabled={addingAllToCart || directAddItems.length === 0 || actionsDisabledByStaleData}
        aria-label={addAllToCartActionLabel}
        title={addAllToCartActionLabel}
        onClick={handleAddAllToCart}
      >
        {t('pages.wishlist.addAllToCart')}
      </ShopButton>
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
          <ShopButton danger icon={<ShopIcon path={SI.delete} />} aria-label={clearUnavailableActionLabel} title={clearUnavailableActionLabel} disabled={actionsDisabledByStaleData}>
            {t('pages.cart.clearUnavailable')}
          </ShopButton>
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
        <ShopTag color="green">{t('pages.wishlist.readyToCart', { count: directAddItems.length })}</ShopTag>
        <ShopTag color="blue">{t('pages.wishlist.needOptions', { count: wishlistStats.optionCount })}</ShopTag>
        <ShopTag color="orange">{t('pages.wishlist.lowStockItems', { count: wishlistStats.lowStockCount })}</ShopTag>
        {wishlistStats.unavailableCount > 0 ? (
          <ShopTag color="red">{t('pages.wishlist.unavailableItems', { count: wishlistStats.unavailableCount })}</ShopTag>
        ) : null}
      </div>
    </div>
    <div className="wishlist-page__recovery">
      <div>
        <span className="wishlist-page__text wishlist-page__text--strong">{t('pages.wishlist.recoveryTitle')}</span>
        <span className="wishlist-page__text wishlist-page__text--secondary">{recoveryText}</span>
      </div>
      <ShopButton
        type="primary"
        icon={<ShopIcon path={SI.cart} />}
        loading={addingAllToCart && directAddItems.length > 0}
        disabled={recoveryAction.disabled}
        aria-label={recoveryActionLabel}
        title={recoveryActionLabel}
        onClick={recoveryAction.action}
      >
        {recoveryAction.label}
      </ShopButton>
    </div>
    <div className={`wishlist-page__nextAction wishlist-page__nextAction--${wishlistNextAction.tone}`}>
      <div>
        <span className="wishlist-page__text wishlist-page__text--secondary">{t('pages.wishlist.nextActionEyebrow')}</span>
        <span className="wishlist-page__text wishlist-page__text--strong">{wishlistNextAction.title}</span>
        <span className="wishlist-page__text wishlist-page__text--secondary">{wishlistNextAction.text}</span>
      </div>
      <div className="wishlist-page__nextActionMeta">
        <ShopTag color="green"><span className="commerce-atomic">{t('pages.wishlist.readyValue', { amount: formatMoney(wishlistStats.readyValue) })}</span></ShopTag>
        <ShopTag color={wishlistStats.lowStockCount > 0 ? 'orange' : 'default'}>
          {t('pages.wishlist.lowStockItems', { count: wishlistStats.lowStockCount })}
        </ShopTag>
      </div>
      <ShopButton
        type={wishlistNextAction.tone === 'ready' ? 'primary' : 'default'}
        icon={wishlistNextAction.tone === 'options' ? <ShopIcon path={SI.settings} /> : <ShopIcon path={SI.cart} />}
        loading={wishlistNextAction.tone === 'ready' && addingAllToCart}
        disabled={wishlistNextAction.disabled}
        aria-label={wishlistNextActionLabel}
        title={wishlistNextActionLabel}
        onClick={wishlistNextAction.action}
      >
        {wishlistNextAction.label}
      </ShopButton>
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
              <span className="wishlist-page__text wishlist-page__text--secondary">{getFeaturedReason(featuredWishlistItem, t)}</span>
              {renderReadiness(featuredWishlistItem, t)}
            </div>
            <div className="wishlist-page__bestPickAction">
              <span className="wishlist-page__text wishlist-page__price commerce-money">{formatMoney(featuredWishlistItem.productPrice)}</span>
              {featuredWishlistItem.requiresSelection ? (
                <ShopButton type="primary" icon={<ShopIcon path={SI.settings} />} aria-label={selectActionLabel} title={selectActionLabel} onClick={() => navigate(`/products/${featuredWishlistItem.productId}`)}>
                  {t('pages.wishlist.selectOptions')}
                </ShopButton>
              ) : (
                <ShopButton type="primary" icon={<ShopIcon path={SI.cart} />} aria-label={addActionLabel} title={addActionLabel} onClick={() => handleAddToCart(featuredWishlistItem.productId)} disabled={actionsDisabledByStaleData}>
                  {t('pages.productList.addToCart')}
                </ShopButton>
              )}
            </div>
          </div>
        );
      })()
    ) : null}
    <div className="wishlist-page__grid">
      {items.map((item) => {
        const removing = removingProductIds.includes(item.productId);
        const lowStockCount = getLowStockCount(item);
        const productName = wishlistProductName(item);
        const viewActionLabel = `${t('pages.productList.viewPick')}: ${productName}`;
        const removeActionLabel = `${t('pages.wishlist.remove')}: ${productName}`;
        return (
          <div key={item.id} className="wishlist-page__gridItem">
            <article className="wishlist-page__card">
              <button
                type="button"
                className="wishlist-page__coverButton"
                onClick={() => navigate(`/products/${item.productId}`)}
                aria-label={viewActionLabel}
                title={viewActionLabel}
              >
                <img
                  alt={productName}
                  src={resolveWishlistImage(item.imageUrl)}
                  className="wishlist-page__cover"
                  onError={(event) => {
                    if (event.currentTarget.src !== wishlistImageFallback) {
                      event.currentTarget.src = wishlistImageFallback;
                    }
                  }}
                />
              </button>
              <div className="wishlist-page__body">
                <button
                  type="button"
                  className="wishlist-page__name"
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
                      <ShopTag color="orange">{t('pages.wishlist.lowStockLeft', { count: lowStockCount })}</ShopTag>
                    ) : null}
                    {!isPurchasable(item) && <ShopTag color="red">{t('pages.wishlist.outOfStock')}</ShopTag>}
                  </div>
                </div>
                {renderReadiness(item, t)}
                <div className="wishlist-page__actions">
                  {primaryAction(item, t, navigate, actionsDisabledByStaleData, handleAddToCart, wishlistProductName)}
                  <ShopPopconfirm
                    rootClassName='shop-mobile-popup-layer wishlist-remove-popconfirm'
                    title={t('pages.wishlist.removeConfirm')}
                    onConfirm={() => handleRemove(item.productId)}
                    okText={t('common.confirm')}
                    cancelText={t('common.cancel')}
                    okButtonProps={{ danger: true, disabled: actionsDisabledByStaleData, 'aria-label': removeActionLabel, title: removeActionLabel }}
                    cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${removeActionLabel}`, title: `${t('common.cancel')}: ${removeActionLabel}` }}
                  >
                    <ShopButton
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
                    </ShopButton>
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
      <ShopButton
        type={wishlistNextAction.tone === 'ready' ? 'primary' : 'default'}
        icon={wishlistNextAction.tone === 'options' ? <ShopIcon path={SI.settings} /> : <ShopIcon path={SI.cart} />}
        loading={wishlistNextAction.tone === 'ready' && addingAllToCart}
        disabled={wishlistNextAction.disabled}
        aria-label={wishlistNextActionLabel}
        title={wishlistNextActionLabel}
        onClick={wishlistNextAction.action}
      >
        {wishlistNextAction.label}
      </ShopButton>
    </div>
  </div>
);
