import React from 'react';
import type { NavigateFunction } from 'react-router-dom';
import ShopAlert from '../components/ShopAlert';
import ShopButton from '../components/ShopButton';
import ShopPopconfirm from '../components/ShopPopconfirm';
import ShopTag from '../components/ShopTag';
import { ShopIcon, SI } from '../components/ShopIcon';
import type { CartItem, ProductPublic as Product } from '../types';
import { needsOptionSelection } from '../utils/productOptions';
import {
  cartImageFallback,
  resolveCartImage,
} from '../utils/cartUi';

type Translate = (key: string, params?: Record<string, string | number>) => string;

export type CartNextActionModel = {
  key: string;
  tone: string;
  title: string;
  text: React.ReactNode;
  label: string;
  action: () => void;
};

export type CartHighlightCard = {
  key: string;
  title: React.ReactNode;
  text: React.ReactNode;
};

export type CartHeroOverviewProps = {
  browseAllProductsActionLabel: string;
  cartHeroHighlights: CartHighlightCard[];
  cartItemsCount: number;
  cartNextAction: CartNextActionModel;
  cartNextActionLabel: string;
  cartSummaryCards: CartHighlightCard[];
  cartTopNextActionLabel: string;
  emptyBrowseActionLabel: string;
  emptyCouponsActionLabel: string;
  emptyHistoryActionLabel: string;
  emptyPetFinderActionLabel: string;
  hasStaleCartData: boolean;
  loadErrorMessage: string | null;
  navigate: NavigateFunction;
  refreshCartItems: () => void;
  retryCartLoadActionLabel: string;
  t: Translate;
  unavailableCount: number;
};

/** Commercial cart hero, summary strip, and stale-data recovery alert. */
export const CartHeroOverview: React.FC<CartHeroOverviewProps> = ({
  browseAllProductsActionLabel,
  cartHeroHighlights,
  cartItemsCount,
  cartNextAction,
  cartNextActionLabel,
  cartSummaryCards,
  cartTopNextActionLabel,
  emptyBrowseActionLabel,
  emptyCouponsActionLabel,
  emptyHistoryActionLabel,
  emptyPetFinderActionLabel,
  hasStaleCartData,
  loadErrorMessage,
  navigate,
  refreshCartItems,
  retryCartLoadActionLabel,
  t,
  unavailableCount,
}) => (
  <>
    <section className="cart-page__hero">
      <div className="cart-page__heroContent">
        <span className="cart-page__heroEyebrow">{t('pages.cart.nextActionEyebrow')}</span>
        <h1 className="cart-page__title">{t('pages.cart.title')}</h1>
        <span className="cart-page__text">{cartItemsCount > 0 ? cartNextAction.text : t('pages.cart.empty')}</span>
        <div className="cart-page__heroActions">
          {cartItemsCount > 0 && cartNextAction.key === 'clear' ? (
            <ShopPopconfirm
              rootClassName='shop-mobile-popup-layer cart-page-popconfirm'
              title={t('pages.cart.clearUnavailableConfirm', { count: unavailableCount })}
              onConfirm={cartNextAction.action}
              okText={cartNextAction.label}
              cancelText={t('common.cancel')}
              okButtonProps={{ danger: true, 'aria-label': cartNextActionLabel, title: cartNextActionLabel }}
              cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${cartNextActionLabel}`, title: `${t('common.cancel')}: ${cartNextActionLabel}` }}
            >
              <ShopButton type="primary" aria-label={cartNextActionLabel} title={cartNextActionLabel}>
                {cartNextAction.label}
              </ShopButton>
            </ShopPopconfirm>
          ) : (
            <ShopButton
              type={cartItemsCount > 0 ? 'primary' : 'default'}
              icon={cartNextAction.key === 'refresh' ? <ShopIcon path={SI.reload} /> : undefined}
              aria-label={cartItemsCount > 0 ? cartTopNextActionLabel : emptyBrowseActionLabel}
              title={cartItemsCount > 0 ? cartTopNextActionLabel : emptyBrowseActionLabel}
              onClick={cartItemsCount > 0 ? cartNextAction.action : () => navigate('/products')}
            >
              {cartItemsCount > 0 ? cartNextAction.label : t('pages.cart.browse')}
            </ShopButton>
          )}
          <ShopButton
            aria-label={cartItemsCount > 0 ? browseAllProductsActionLabel : emptyCouponsActionLabel}
            title={cartItemsCount > 0 ? browseAllProductsActionLabel : emptyCouponsActionLabel}
            onClick={() => navigate(cartItemsCount > 0 ? '/products' : '/coupons')}
          >
            {cartItemsCount > 0 ? t('pages.cart.browse') : t('nav.coupons')}
          </ShopButton>
          {cartItemsCount === 0 ? (
            <>
              <ShopButton
                icon={<ShopIcon path={SI.shopping} />}
                aria-label={emptyPetFinderActionLabel}
                title={emptyPetFinderActionLabel}
                onClick={() => navigate('/pet-finder')}
              >
                {t('nav.petFinder')}
              </ShopButton>
              <ShopButton
                icon={<ShopIcon path={SI.clock} />}
                aria-label={emptyHistoryActionLabel}
                title={emptyHistoryActionLabel}
                onClick={() => navigate('/history')}
              >
                {t('nav.history')}
              </ShopButton>
            </>
          ) : null}
        </div>
      </div>
      <div className="cart-page__heroStats">
        {cartHeroHighlights.map((item) => (
          <article key={item.key} className="cart-page__heroStat">
            <strong>{item.title}</strong>
            <span>{item.text}</span>
          </article>
        ))}
      </div>
    </section>
    <section className="cart-page__summaryStrip">
      {cartSummaryCards.map((item) => (
        <article key={item.key} className="cart-page__summaryStripCard">
          <strong>{item.title}</strong>
          <span>{item.text}</span>
        </article>
      ))}
    </section>
    {hasStaleCartData ? (
      <ShopAlert
        className="cart-page__loadErrorAlert"
        type="warning"
        showIcon
        role="alert"
        aria-live="assertive"
        message={t('pages.cart.staleDataTitle')}
        description={loadErrorMessage || t('pages.cart.staleDataWarning')}
        action={
          <ShopButton type="primary" icon={<ShopIcon path={SI.reload} />} aria-label={retryCartLoadActionLabel} title={retryCartLoadActionLabel} onClick={refreshCartItems}>
            {t('messages.retry')}
          </ShopButton>
        }
      />
    ) : null}
  </>
);

export type CartRecentRecoveryPanelProps = {
  addRecentProduct: (product: Product) => void;
  addingRecentId: number | null;
  formatMoney: (amount?: number | null) => string;
  getCartProductName: (product: Pick<Product, 'id' | 'name'>) => string;
  hasStaleCartData: boolean;
  navigate: NavigateFunction;
  recentProducts: Product[];
  recentRecoveryBrowseActionLabel: string;
  showRecentlyViewedRecovery: boolean;
  t: Translate;
};

/** Commercial recently-viewed recovery grid for empty or blocked carts. */
export const CartRecentRecoveryPanel: React.FC<CartRecentRecoveryPanelProps> = ({
  addRecentProduct,
  addingRecentId,
  formatMoney,
  getCartProductName,
  hasStaleCartData,
  navigate,
  recentProducts,
  recentRecoveryBrowseActionLabel,
  showRecentlyViewedRecovery,
  t,
}) => {
  if (!showRecentlyViewedRecovery) return null;
  return (
    <section className="cart-page__recentRecovery" aria-label={t('pages.cart.recentRecoveryTitle')}>
      <div className="cart-page__recentRecoveryHeader">
        <div>
          <span className="cart-page__text cart-page__text--strong">{t('pages.cart.recentRecoveryTitle')}</span>
          <span className="cart-page__text cart-page__text--secondary">{t('pages.cart.recentRecoverySubtitle')}</span>
        </div>
        <ShopButton size="small" aria-label={recentRecoveryBrowseActionLabel} title={recentRecoveryBrowseActionLabel} onClick={() => navigate('/products')}>{t('pages.cart.browse')}</ShopButton>
      </div>
      <div className="cart-page__recentGrid">
        {recentProducts.map((product) => {
          const productName = getCartProductName(product);
          const recentLinkLabel = `${t('pages.productList.viewPick')}: ${productName}`;
          const recentActionText = needsOptionSelection(product) ? t('pages.wishlist.selectOptions') : t('pages.cart.recentAddToCart');
          const recentActionLabel = `${recentActionText}: ${productName}`;
          return (
            <article
              key={product.id}
              className="cart-page__recentItem"
            >
              <button type="button" className="cart-page__recentLink" aria-label={recentLinkLabel} title={recentLinkLabel} onClick={() => navigate(`/products/${product.id}`)}>
                <img
                  src={resolveCartImage(product.imageUrl)}
                  alt={productName}
                  loading="lazy"
                  decoding="async"
                  onError={(event) => {
                    if (event.currentTarget.src !== cartImageFallback) {
                      event.currentTarget.src = cartImageFallback;
                    }
                  }}
                />
                <span>
                  <span className="cart-page__text cart-page__text--strong">{productName}</span>
                  <span className="cart-page__text cart-page__text--secondary commerce-money">{formatMoney(product.effectivePrice ?? product.price)}</span>
                </span>
              </button>
              <ShopButton
                size="small"
                type={needsOptionSelection(product) ? 'default' : 'primary'}
                icon={<ShopIcon path={SI.cart} />}
                loading={addingRecentId === product.id}
                disabled={hasStaleCartData}
                aria-label={recentActionLabel}
                title={recentActionLabel}
                onClick={() => addRecentProduct(product)}
              >
                {recentActionText}
              </ShopButton>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export type CartBulkReadinessPanelProps = {
  allSelected: boolean;
  cartNextAction: CartNextActionModel;
  cartNextActionLabel: string;
  checkoutBlocked: boolean;
  clearUnavailableActionLabel: string;
  clearUnavailableItems: () => void;
  deleteSelectedActionLabel: string;
  freeShippingGapTitle: React.ReactNode;
  freeShippingRemaining: number;
  freeShippingUnlocked: boolean;
  giftUnlocked: boolean;
  hasStaleCartData: boolean;
  purchasableItemsCount: number;
  purchasableUnitCount: number;
  removeSelectedItems: () => void;
  removingItemIds: number[];
  restoringSaved: boolean;
  selectReadyActionLabel: string;
  selectedIds: number[];
  selectedPurchasableCount: number;
  selectedUnitCount: number;
  t: Translate;
  toggleAll: (checked: boolean) => void;
  unavailableItems: CartItem[];
};

/** Commercial bulk actions, checkout readiness strip, and next-action coach. */
export const CartBulkReadinessPanel: React.FC<CartBulkReadinessPanelProps> = ({
  allSelected,
  cartNextAction,
  cartNextActionLabel,
  checkoutBlocked,
  clearUnavailableActionLabel,
  clearUnavailableItems,
  deleteSelectedActionLabel,
  freeShippingGapTitle,
  freeShippingRemaining,
  freeShippingUnlocked,
  giftUnlocked,
  hasStaleCartData,
  purchasableItemsCount,
  purchasableUnitCount,
  removeSelectedItems,
  removingItemIds,
  restoringSaved,
  selectReadyActionLabel,
  selectedIds,
  selectedPurchasableCount,
  selectedUnitCount,
  t,
  toggleAll,
  unavailableItems,
}) => (
  <>
    <section className="cart-page__bulkActions" aria-label={t('pages.cart.chooseItems')}>
      <div className="cart-page__bulkActionsRow">
        <ShopPopconfirm
          rootClassName='shop-mobile-popup-layer cart-page-popconfirm'
          title={t('pages.cart.deleteSelectedConfirm', { count: selectedIds.length })}
          disabled={hasStaleCartData || selectedIds.length === 0}
          onConfirm={removeSelectedItems}
          okText={t('common.confirm')}
          cancelText={t('common.cancel')}
          okButtonProps={{ danger: true, 'aria-label': deleteSelectedActionLabel, title: deleteSelectedActionLabel }}
          cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${deleteSelectedActionLabel}`, title: `${t('common.cancel')}: ${deleteSelectedActionLabel}` }}
        >
          <ShopButton
            danger
            icon={<ShopIcon path={SI.delete} />}
            disabled={hasStaleCartData || selectedIds.length === 0}
            loading={selectedIds.some((id) => removingItemIds.includes(id))}
            aria-label={deleteSelectedActionLabel}
            title={deleteSelectedActionLabel}
          >
            {t('pages.cart.deleteSelected')}
          </ShopButton>
        </ShopPopconfirm>
        <ShopPopconfirm
          rootClassName='shop-mobile-popup-layer cart-page-popconfirm'
          title={t('pages.cart.clearUnavailableConfirm', { count: unavailableItems.length })}
          disabled={hasStaleCartData || unavailableItems.length === 0}
          onConfirm={clearUnavailableItems}
          okText={t('common.confirm')}
          cancelText={t('common.cancel')}
          okButtonProps={{ danger: true, 'aria-label': clearUnavailableActionLabel, title: clearUnavailableActionLabel }}
          cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${clearUnavailableActionLabel}`, title: `${t('common.cancel')}: ${clearUnavailableActionLabel}` }}
        >
          <ShopButton
            disabled={hasStaleCartData || unavailableItems.length === 0}
            loading={unavailableItems.some((item) => removingItemIds.includes(item.id))}
            aria-label={clearUnavailableActionLabel}
            title={clearUnavailableActionLabel}
          >
            {t('pages.cart.clearUnavailable')}
          </ShopButton>
        </ShopPopconfirm>
        <span className="cart-page__text cart-page__text--secondary">{t('pages.cart.unavailableSummary', { count: unavailableItems.length })}</span>
      </div>
    </section>
    <div className={checkoutBlocked ? 'cart-page__readiness cart-page__readiness--warning' : 'cart-page__readiness'}>
      <div className="cart-page__readinessIntro">
        {checkoutBlocked ? <ShopIcon path={SI.exclamation} /> : <ShopIcon path={SI.check} />}
        <div>
          <span className="cart-page__text cart-page__text--strong">{checkoutBlocked ? t('pages.cart.readinessNeedsAction') : t('pages.cart.readinessReady')}</span>
          <span className="cart-page__text cart-page__text--secondary">
            {t('pages.cart.readinessSubtitle', {
              selected: selectedUnitCount,
              available: purchasableUnitCount,
            })}
          </span>
        </div>
      </div>
      <div className="cart-page__readinessStats">
        <ShopTag color="green">{t('pages.cart.readyItems', { count: selectedPurchasableCount })}</ShopTag>
        <ShopTag color={unavailableItems.length > 0 ? 'red' : 'default'}>{t('pages.cart.blockedItems', { count: unavailableItems.length })}</ShopTag>
        <ShopTag color={freeShippingUnlocked ? 'green' : freeShippingRemaining > 0 ? 'orange' : 'default'}>
          {freeShippingGapTitle}
        </ShopTag>
        {giftUnlocked ? (
          <ShopTag color="green">{t('pages.cart.drawerGiftUnlocked')}</ShopTag>
        ) : null}
      </div>
      <div className="cart-page__readinessActions">
        <ShopButton
          size="small"
          aria-label={selectReadyActionLabel}
          title={selectReadyActionLabel}
          onClick={() => toggleAll(true)}
          disabled={hasStaleCartData || purchasableItemsCount === 0 || allSelected}
        >
          {t('pages.cart.selectCheckoutReady')}
        </ShopButton>
        {unavailableItems.length > 0 ? (
          <ShopPopconfirm
            rootClassName='shop-mobile-popup-layer cart-page-popconfirm'
            title={t('pages.cart.clearUnavailableConfirm', { count: unavailableItems.length })}
            disabled={hasStaleCartData}
            onConfirm={clearUnavailableItems}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
            okButtonProps={{ danger: true, 'aria-label': clearUnavailableActionLabel, title: clearUnavailableActionLabel }}
            cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${clearUnavailableActionLabel}`, title: `${t('common.cancel')}: ${clearUnavailableActionLabel}` }}
          >
            <ShopButton
              size="small"
              disabled={hasStaleCartData}
              loading={unavailableItems.some((item) => removingItemIds.includes(item.id))}
              aria-label={clearUnavailableActionLabel}
              title={clearUnavailableActionLabel}
            >
              {t('pages.cart.clearUnavailable')}
            </ShopButton>
          </ShopPopconfirm>
        ) : null}
      </div>
    </div>
    {cartNextAction.tone !== 'ready' ? (
      <div className={`cart-page__nextAction cart-page__nextAction--${cartNextAction.tone}`}>
        <span>
          <span className="cart-page__text cart-page__text--secondary">{t('pages.cart.nextActionEyebrow')}</span>
          <span className="cart-page__text cart-page__text--strong">{cartNextAction.title}</span>
          <span className="cart-page__text cart-page__text--secondary">{cartNextAction.text}</span>
        </span>
        {cartNextAction.key === 'clear' ? (
          <ShopPopconfirm
            rootClassName='shop-mobile-popup-layer cart-page-popconfirm'
            title={t('pages.cart.clearUnavailableConfirm', { count: unavailableItems.length })}
            onConfirm={cartNextAction.action}
            okText={cartNextAction.label}
            cancelText={t('common.cancel')}
            okButtonProps={{ danger: true, 'aria-label': cartNextActionLabel, title: cartNextActionLabel }}
            cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${cartNextActionLabel}`, title: `${t('common.cancel')}: ${cartNextActionLabel}` }}
          >
            <ShopButton type="default" aria-label={cartNextActionLabel} title={cartNextActionLabel}>
              {cartNextAction.label}
            </ShopButton>
          </ShopPopconfirm>
        ) : (
          <ShopButton
            type="default"
            icon={cartNextAction.key === 'refresh' ? <ShopIcon path={SI.reload} /> : undefined}
            aria-label={cartNextActionLabel}
            title={cartNextActionLabel}
            onClick={cartNextAction.action}
            loading={cartNextAction.key === 'saved' && restoringSaved}
          >
            {cartNextAction.label}
          </ShopButton>
        )}
      </div>
    ) : null}
  </>
);
