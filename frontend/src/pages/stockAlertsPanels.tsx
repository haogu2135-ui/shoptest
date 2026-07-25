import React from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { ShopIcon, SI } from '../components/ShopIcon';
import ShopPopconfirm from '../components/ShopPopconfirm';
import type { ProductPublic as Product } from '../types';
import type { StockAlertItem } from '../utils/stockAlerts';
import { needsOptionSelection } from '../utils/productOptions';
import { dispatchDomEvent } from '../utils/domEvents';
import PageError from '../components/PageError';
import PageEmpty from '../components/PageEmpty';
import ShopButton from '../components/ShopButton';
import ShopTag from '../components/ShopTag';
import ShopAlert from '../components/ShopAlert';
import {
  buildStockAlertItemActionLabels,
  isBackInStock,
  resolveStockAlertImage,
  stockAlertImageFallback,
  type StockAlertInsights,
  type StockAlertListItem,
  type StockAlertsTranslate,
} from './stockAlertsHelpers';

export type StockAlertsNextAction = {
  tone: 'stale' | 'ready' | 'options' | 'waiting' | 'browse';
  title: string;
  text: string;
  label: string;
  action: () => void;
};

export type StockAlertsPanelsProps = {
  t: StockAlertsTranslate;
  language: string;
  navigate: NavigateFunction;
  formatMoney: (value?: number | null) => string;
  dateLocale: string;
  alerts: StockAlertItem[];
  loading: boolean;
  loadError: string;
  hasStaleProductData: boolean;
  visibleStockAlertInsights: StockAlertInsights;
  assistantSubtitle: string;
  restockNextAction: StockAlertsNextAction;
  mobileNextActionStatus: string;
  addReadyActionLabel: string;
  restockNextActionLabel: string;
  browseStockAlertsActionLabel: string;
  clearStockAlertsActionLabel: string;
  addingReady: boolean;
  isAddingProduct: (productId: number) => boolean;
  stockAlertProductName: (item: StockAlertListItem) => string;
  setReloadKey: React.Dispatch<React.SetStateAction<number>>;
  clearAll: () => void;
  removeAlert: (productId: number) => void;
  addToCart: (product: Product, quiet?: boolean) => Promise<boolean> | boolean | void;
  addReadyItemsToCart: () => void;
};

export const StockAlertsMainPanels: React.FC<StockAlertsPanelsProps> = ({
  t,
  language,
  navigate,
  formatMoney,
  dateLocale,
  alerts,
  loading,
  loadError,
  hasStaleProductData,
  visibleStockAlertInsights,
  assistantSubtitle,
  restockNextAction,
  mobileNextActionStatus,
  addReadyActionLabel,
  restockNextActionLabel,
  browseStockAlertsActionLabel,
  clearStockAlertsActionLabel,
  addingReady,
  isAddingProduct,
  stockAlertProductName,
  setReloadKey,
  clearAll,
  removeAlert,
  addToCart,
  addReadyItemsToCart,
}) => {
  const restockNextActionIcon = restockNextAction.tone === 'stale' ? <ShopIcon path={SI.reload} /> : <ShopIcon path={SI.cart} />;
  const isAddingReady = restockNextAction.tone === 'ready' && addingReady;

  return (
    <div className={`stock-alerts stock-alerts-page stock-alerts--${language}`}>
      <section className="stock-alerts__shell" aria-label={t('pages.stockAlerts.title')}>
        <div className="stock-alerts__header">
          <div>
            <h1 className="stock-alerts-page__title">
              <ShopIcon path={SI.bell} /> {t('pages.stockAlerts.title')}
            </h1>
            <span className="stock-alerts-page__text stock-alerts-page__text--secondary">
              {t('pages.stockAlerts.subtitle', { count: loading || hasStaleProductData ? 0 : visibleStockAlertInsights.backInStockItems.length, saved: alerts.length })}
            </span>
          </div>
          <div className="stock-alerts__actionRow">
            <ShopButton aria-label={browseStockAlertsActionLabel} title={browseStockAlertsActionLabel} onClick={() => navigate('/products')}>{t('pages.stockAlerts.browse')}</ShopButton>
            <ShopPopconfirm
              rootClassName='shop-mobile-popup-layer stock-alerts-popconfirm'
              title={t('pages.stockAlerts.clearConfirm')}
              onConfirm={clearAll}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
              okButtonProps={{ danger: true, 'aria-label': clearStockAlertsActionLabel, title: clearStockAlertsActionLabel }}
              cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${clearStockAlertsActionLabel}`, title: `${t('common.cancel')}: ${clearStockAlertsActionLabel}` }}
            >
              <ShopButton danger disabled={alerts.length === 0} aria-label={clearStockAlertsActionLabel} title={clearStockAlertsActionLabel}>{t('pages.stockAlerts.clear')}</ShopButton>
            </ShopPopconfirm>
          </div>
        </div>

        {alerts.length > 0 ? (
          <section className="stock-alerts__assistant" aria-label={t('pages.stockAlerts.assistantTitle')}>
            <div className="stock-alerts__assistantCopy">
              <span className="stock-alerts-page__text stock-alerts__eyebrow">{t('pages.stockAlerts.assistantEyebrow')}</span>
              <h4 className="stock-alerts-page__title">{t('pages.stockAlerts.assistantTitle')}</h4>
              <span className="stock-alerts-page__text stock-alerts-page__text--secondary">{assistantSubtitle}</span>
            </div>
            <div className="stock-alerts__signalGrid">
              <div className="stock-alerts__signal is-ok">
                <ShopIcon path={SI.checkCircle} />
                <strong>{visibleStockAlertInsights.backInStockItems.length}</strong>
                <span>{t('pages.stockAlerts.readyNow')}</span>
              </div>
              <div className={`stock-alerts__signal ${visibleStockAlertInsights.urgentItems.length ? 'is-risk' : 'is-ok'}`}>
                <ShopIcon path={SI.fire} />
                <strong>{visibleStockAlertInsights.urgentItems.length}</strong>
                <span>{t('pages.stockAlerts.lowStockReady')}</span>
              </div>
              <div className={`stock-alerts__signal ${visibleStockAlertInsights.waitingItems ? '' : 'is-ok'}`}>
                <ShopIcon path={SI.bell} />
                <strong>{visibleStockAlertInsights.waitingItems}</strong>
                <span>{t('pages.stockAlerts.stillWatching')}</span>
              </div>
            </div>
          </section>
        ) : null}

        {visibleStockAlertInsights.backInStockItems.length > 0 ? (
          <section className="stock-alerts__recovery" aria-label={t('pages.stockAlerts.recoveryTitle')}>
            <div>
              <span className="stock-alerts-page__text stock-alerts__eyebrow">{t('pages.stockAlerts.recoveryEyebrow')}</span>
              <h4 className="stock-alerts-page__title">{t('pages.stockAlerts.recoveryTitle')}</h4>
              <span className="stock-alerts-page__text stock-alerts-page__text--secondary">
                {visibleStockAlertInsights.bestReadyItem?.product
                  ? t('pages.stockAlerts.recoverySubtitleBest', {
                    name: stockAlertProductName(visibleStockAlertInsights.bestReadyItem),
                    price: formatMoney(visibleStockAlertInsights.bestReadyItem.product.effectivePrice ?? visibleStockAlertInsights.bestReadyItem.product.price),
                  })
                  : t('pages.stockAlerts.recoverySubtitle', { count: visibleStockAlertInsights.backInStockItems.length })}
              </span>
            </div>
            <div className="stock-alerts__recoveryActions">
              {visibleStockAlertInsights.bestReadyItem?.product ? (
                <ShopButton
                  onClick={() => navigate(`/products/${visibleStockAlertInsights.bestReadyItem!.productId}`)}
                  aria-label={`${t('pages.stockAlerts.viewBestReady')}: ${stockAlertProductName(visibleStockAlertInsights.bestReadyItem)}`}
                  title={`${t('pages.stockAlerts.viewBestReady')}: ${stockAlertProductName(visibleStockAlertInsights.bestReadyItem)}`}
                >
                  {t('pages.stockAlerts.viewBestReady')}
                </ShopButton>
              ) : null}
              <ShopButton
                type="primary"
                icon={<ShopIcon path={SI.cart} />}
                aria-label={addReadyActionLabel}
                title={addReadyActionLabel}
                onClick={addReadyItemsToCart}
                loading={addingReady}
                disabled={addingReady || hasStaleProductData}
              >
                {t('pages.stockAlerts.addReadyToCart')}
              </ShopButton>
            </div>
          </section>
        ) : null}

        {alerts.length > 0 ? (
          <section className={`stock-alerts__nextAction stock-alerts__nextAction--${restockNextAction.tone}`} aria-label={t('pages.stockAlerts.nextActionEyebrow')}>
            <div>
              <span className="stock-alerts-page__text stock-alerts__eyebrow">{t('pages.stockAlerts.nextActionEyebrow')}</span>
              <h4 className="stock-alerts-page__title">{restockNextAction.title}</h4>
              <span className="stock-alerts-page__text stock-alerts-page__text--secondary">{restockNextAction.text}</span>
            </div>
            <div className="stock-alerts__nextActionMeta">
              <ShopTag color="green">{t('pages.stockAlerts.directReady', { count: visibleStockAlertInsights.directAddItems.length })}</ShopTag>
              <ShopTag color={visibleStockAlertInsights.optionItems.length > 0 ? 'gold' : 'default'}>
                {t('pages.stockAlerts.optionReady', { count: visibleStockAlertInsights.optionItems.length })}
              </ShopTag>
              <ShopTag color={visibleStockAlertInsights.waitingItems > 0 ? 'blue' : 'default'}>
                {t('pages.stockAlerts.stillWatchingCount', { count: visibleStockAlertInsights.waitingItems })}
              </ShopTag>
            </div>
            <ShopButton
              type={restockNextAction.tone === 'ready' ? 'primary' : 'default'}
              icon={restockNextActionIcon}
              aria-label={restockNextActionLabel}
              title={restockNextActionLabel}
              onClick={restockNextAction.action}
              loading={isAddingReady}
              disabled={isAddingReady}
            >
              {restockNextAction.label}
            </ShopButton>
          </section>
        ) : null}

        {alerts.length > 0 ? (
          <div
            className={`stock-alerts__mobileAction stock-alerts__mobileAction--${restockNextAction.tone}`}
            role="region"
            aria-label={t('pages.stockAlerts.nextActionEyebrow')}
          >
            <div className="stock-alerts__mobileActionCopy">
              <span>{restockNextAction.title}</span>
              <strong>{mobileNextActionStatus}</strong>
            </div>
            <ShopButton
              type={restockNextAction.tone === 'ready' ? 'primary' : 'default'}
              icon={restockNextActionIcon}
              aria-label={restockNextActionLabel}
              title={restockNextActionLabel}
              onClick={restockNextAction.action}
              loading={isAddingReady}
              disabled={isAddingReady}
            >
              {restockNextAction.label}
            </ShopButton>
          </div>
        ) : null}

        {loadError && hasStaleProductData ? (
          <ShopAlert
            type="warning"
            showIcon
            message={t('pages.stockAlerts.loadFailed')}
            description={hasStaleProductData ? t('pages.stockAlerts.staleDataWarning') : t('common.loadFailedRetry')}
            action={<ShopButton size="small" onClick={() => setReloadKey((value) => value + 1)}>{t('common.retry')}</ShopButton>}
          />
        ) : null}

        {loadError && !hasStaleProductData ? (
          <div data-stock-alerts-load-recovery="true">
            <PageError
              className="stock-alerts__loadError"
              title={t('pages.stockAlerts.loadFailed')}
              description={t('common.loadFailedRetry')}
              actions={[
                {
                  key: 'retry',
                  label: t('common.retry'),
                  onClick: () => setReloadKey((value) => value + 1),
                  type: 'primary',
                },
                {
                  key: 'browse',
                  label: browseStockAlertsActionLabel,
                  onClick: () => navigate('/products'),
                  type: 'default',
                },
                {
                  key: 'wishlist',
                  label: t('pages.compare.emptyWishlist'),
                  onClick: () => navigate('/wishlist'),
                  type: 'default',
                },
                {
                  key: 'coupons',
                  label: t('pages.productList.loadRecoveryCoupons'),
                  onClick: () => navigate('/coupons'),
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
        ) : alerts.length === 0 ? (
          <PageEmpty
            className="stock-alerts__emptyPanel"
            data-stock-alerts-empty-actions="true"
            description={(
              <div className="stock-alerts__emptyCopy">
                <div>{t('pages.stockAlerts.empty')}</div>
                <div className="stock-alerts__emptyHint">{t('pages.stockAlerts.emptyHint')}</div>
              </div>
            )}
            actions={[
              {
                key: 'browse',
                label: browseStockAlertsActionLabel,
                onClick: () => navigate('/products'),
              },
              {
                key: 'wishlist',
                label: t('pages.stockAlerts.emptyWishlist'),
                onClick: () => navigate('/wishlist'),
                type: 'default',
              },
              {
                key: 'coupons',
                label: t('pages.stockAlerts.emptyCoupons'),
                onClick: () => navigate('/coupons'),
                type: 'default',
              },
              {
                key: 'pet-finder',
                label: t('pages.stockAlerts.emptyPetFinder'),
                onClick: () => navigate('/pet-finder'),
                type: 'default',
              },
            ]}
          />
        ) : (
          <div className={`stock-alerts__listWrap${loading ? ' stock-alerts__listWrap--loading' : ''}`}>
            {loading ? (
              <div className="stock-alerts__spinnerOverlay" role="status" aria-live="polite" aria-label={t('common.loading')}>
                <span className="stock-alerts__spinner" aria-hidden="true" />
              </div>
            ) : null}
            <ul className="stock-alerts__itemList" role="list">
              {visibleStockAlertInsights.items.map((item) => {
                const product = item.product;
                const productName = stockAlertProductName(item);
                const ready = isBackInStock(product);
                const addingProduct = isAddingProduct(item.productId);
                const needsSelection = Boolean(product && needsOptionSelection(product));
                const lowStock = Boolean(ready && product?.stock !== undefined && product.stock > 0 && product.stock <= 5);
                const {
                  addActionText,
                  addActionLabel,
                  removeActionLabel,
                  productLinkLabel,
                } = buildStockAlertItemActionLabels({
                  t,
                  productName,
                  ready,
                  needsSelection,
                });
                return (
                  <li
                    key={item.productId}
                    className={[
                      'stock-alerts__item',
                      ready ? 'stock-alerts__item--ready' : 'stock-alerts__item--waiting',
                      lowStock ? 'stock-alerts__item--lowStock' : '',
                      needsSelection ? 'stock-alerts__item--options' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <div className="stock-alerts__itemMeta">
                      <Link className="stock-alerts__imageLink stock-alerts__itemAvatar" to={`/products/${item.productId}`} aria-label={productLinkLabel} title={productLinkLabel}>
                        <img
                          className="stock-alerts__image"
                          src={resolveStockAlertImage(product?.imageUrl || item.imageUrl)}
                          alt={productName}
                          width={72}
                          height={72}
                          loading="lazy"
                          decoding="async"
                          onError={(event) => {
                            if (event.currentTarget.src !== stockAlertImageFallback) {
                              event.currentTarget.src = stockAlertImageFallback;
                            }
                          }}
                        />
                      </Link>
                      <div className="stock-alerts__itemBody">
                        <Link className="stock-alerts__productLink" to={`/products/${item.productId}`} aria-label={productLinkLabel} title={productLinkLabel}>{productName}</Link>
                        <div className="stock-alerts__itemDetails">
                          <span className="stock-alerts-page__text stock-alerts-page__text--secondary stock-alerts__watchTime">
                            {t('pages.stockAlerts.createdAt', { time: new Date(item.createdAt).toLocaleString(dateLocale) })}
                          </span>
                          {product ? (
                            <div className="stock-alerts__itemSignalRow">
                              <span className="stock-alerts-page__text stock-alerts-page__text--strong stock-alerts__price commerce-money">{formatMoney(product.effectivePrice ?? product.price)}</span>
                              <ShopTag color={ready ? 'green' : 'default'}>
                                {ready ? t('pages.productDetail.enough') : t('pages.productList.soldOut')}
                              </ShopTag>
                              {lowStock ? <ShopTag color="volcano">{t('pages.stockAlerts.lowStockReady')}</ShopTag> : null}
                              {ready && needsSelection ? <ShopTag color="gold">{t('pages.stockAlerts.selectOptions')}</ShopTag> : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="stock-alerts__itemActions">
                      <ShopButton
                        type="primary"
                        icon={<ShopIcon path={SI.cart} />}
                        className={ready ? undefined : 'stock-alerts__soldoutButton'}
                        aria-label={addActionLabel}
                        title={addActionLabel}
                        onClick={() => product && addToCart(product)}
                        loading={addingProduct}
                        disabled={hasStaleProductData || !ready || addingProduct}
                      >
                        {addActionText}
                      </ShopButton>
                      <ShopPopconfirm
                        rootClassName='shop-mobile-popup-layer stock-alerts-popconfirm'
                        title={t('pages.stockAlerts.removeConfirm')}
                        onConfirm={() => removeAlert(item.productId)}
                        okText={t('common.confirm')}
                        cancelText={t('common.cancel')}
                        okButtonProps={{ danger: true, 'aria-label': removeActionLabel, title: removeActionLabel }}
                        cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${removeActionLabel}`, title: `${t('common.cancel')}: ${removeActionLabel}` }}
                      >
                        <ShopButton icon={<ShopIcon path={SI.delete} />} aria-label={removeActionLabel} title={removeActionLabel}>{t('pages.stockAlerts.remove')}</ShopButton>
                      </ShopPopconfirm>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
};
