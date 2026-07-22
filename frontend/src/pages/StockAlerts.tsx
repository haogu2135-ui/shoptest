import React, { useEffect, useMemo, useState } from 'react';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { ShopIcon, SI } from '../components/ShopIcon';
import { Alert, Button, Card, List, Popconfirm, Tag } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import { cartApi, productApi } from '../api';
import { useLanguage } from '../i18n';
import { usePageTitle } from '../hooks/usePageTitle';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useMarket } from '../hooks/useMarket';
import type { ProductPublic as Product } from '../types';
import { addGuestCartItem } from '../utils/guestCart';
import { clearStockAlerts, readStockAlerts, removeStockAlert, type StockAlertItem } from '../utils/stockAlerts';
import { localizeProduct } from '../utils/localizedProduct';
import { needsOptionSelection } from '../utils/productOptions';
import { productImageFallback, resolveProductImage } from '../utils/productMedia';
import { dispatchDomEvent } from '../utils/domEvents';
import { getLocalStorageItem } from '../utils/safeStorage';
import { allSettledWithConcurrency } from '../utils/asyncBatch';
import { getApiErrorMessage } from '../utils/apiError';
import PageError from '../components/PageError';
import PageEmpty from '../components/PageEmpty';
import './StockAlerts.css';
import '../styles/mobile-page-contrast.css';

const stockAlertImageFallback = productImageFallback;
const resolveStockAlertImage = resolveProductImage;

const isBackInStock = (product?: Product) => Boolean(product && (product.stock === undefined || product.stock > 0));

const StockAlerts: React.FC = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  usePageTitle(t('pages.stockAlerts.title'));
  useDocumentMeta({
    title: t('pages.stockAlerts.title'),
    description: t('common.siteDescription'),
    path: '/stock-alerts',
    type: 'website',
    noIndex: true,
    siteName: t('common.siteTitle'),
  });
  const { formatMoney } = useMarket();
  const dateLocale = language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US';
  const [alerts, setAlerts] = useState<StockAlertItem[]>(() => readStockAlerts());
  const [products, setProducts] = useState<Record<number, Product>>({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const stockAlertProductName = (item: { productId: number; productName?: string; product?: Pick<Product, 'id' | 'name'> }) => (
    (item.product?.name || item.productName || '').trim() || t('pages.profile.productFallback', { id: item.product?.id || item.productId })
  );

  useEffect(() => {
    const refresh = () => setAlerts(readStockAlerts());
    window.addEventListener('shop:stock-alerts-updated', refresh);
    return () => window.removeEventListener('shop:stock-alerts-updated', refresh);
  }, []);

  useEffect(() => {
    let disposed = false;
    const loadProducts = async () => {
      if (alerts.length === 0) {
        setProducts({});
        setLoadError('');
        return;
      }
      try {
        setLoading(true);
        const productIds = Array.from(new Set(alerts.map((alert) => alert.productId)));
        const response = await productApi.getByIds(productIds);
        if (disposed) return;
        const nextProducts = response.data.reduce<Record<number, Product>>((acc, item) => {
          const product = localizeProduct(item, language);
          acc[product.id] = product;
          return acc;
        }, {});
        setProducts(nextProducts);
        setLoadError('');
      } catch (error: unknown) {
        if (disposed) return;
        const localizedError = getApiErrorMessage(error, t('pages.stockAlerts.loadFailed'), language);
        setLoadError(localizedError);
        announceAccessibleMessage(localizedError, 'error');
      } finally {
        if (!disposed) setLoading(false);
      }
    };
    loadProducts();
    return () => {
      disposed = true;
    };
  }, [alerts, language, reloadKey, t]);

  const removeAlert = (productId: number) => {
    removeStockAlert(productId);
    setAlerts(readStockAlerts());
  };

  const clearAll = () => {
    clearStockAlerts();
    setAlerts([]);
    setProducts({});
  };

  const addToCart = async (product: Product, quiet = false) => {
    if (product.stock !== undefined && product.stock <= 0) {
      announceAccessibleMessage(t('pages.productDetail.insufficientStock'), 'error');
      return false;
    }
    if (needsOptionSelection(product)) {
      navigate(`/products/${product.id}`);
      return false;
    }
    const token = getLocalStorageItem('token');
    try {
      if (token) {
        await cartApi.addItem(0, product.id, 1);
        dispatchDomEvent('shop:cart-updated');
      } else {
        addGuestCartItem({ ...product, imageUrl: resolveStockAlertImage(product.imageUrl) }, 1, undefined, product.effectivePrice ?? product.price);
      }
      if (!quiet) {
        announceAccessibleMessage(t('messages.addCartSuccess'), 'success');
        dispatchDomEvent('shop:open-cart');
      }
      return true;
    } catch (error: unknown) {
      announceAccessibleMessage(getApiErrorMessage(error, t('messages.addFailed'), language), 'error');
      return false;
    }
  };

  const stockAlertInsights = useMemo(() => {
    const items = alerts.map((alert) => ({
      ...alert,
      product: products[alert.productId],
    }));
    const backInStockItems = items.filter((item) => isBackInStock(item.product));
    const directAddItems = backInStockItems.filter((item) => item.product && !needsOptionSelection(item.product));
    const optionItems = backInStockItems.filter((item) => item.product && needsOptionSelection(item.product));
    const waitingItems = items.length - backInStockItems.length;
    const urgentItems = backInStockItems.filter((item) => {
      const stock = item.product?.stock;
      return stock !== undefined && stock > 0 && stock <= 5;
    });
    const bestReadyItem = backInStockItems
      .filter((item) => item.product)
      .sort((a, b) => (a.product?.effectivePrice ?? a.product?.price ?? 0) - (b.product?.effectivePrice ?? b.product?.price ?? 0))[0];
    return { items, backInStockItems, directAddItems, optionItems, waitingItems, urgentItems, bestReadyItem };
  }, [alerts, products]);
  const hasStaleProductData = Boolean(loadError && alerts.length > 0);
  const visibleStockAlertInsights = hasStaleProductData
    ? {
      ...stockAlertInsights,
      backInStockItems: [],
      directAddItems: [],
      optionItems: [],
      urgentItems: [],
      waitingItems: stockAlertInsights.items.length,
      bestReadyItem: undefined,
    }
    : stockAlertInsights;
  const assistantSubtitle = hasStaleProductData
    ? t('pages.stockAlerts.staleDataWarning')
    : visibleStockAlertInsights.bestReadyItem?.product
      ? t('pages.stockAlerts.assistantSubtitleBest', { name: stockAlertProductName(visibleStockAlertInsights.bestReadyItem) })
      : t('pages.stockAlerts.assistantSubtitle');

  const addReadyItemsToCart = async () => {
    if (hasStaleProductData) {
      setReloadKey((value) => value + 1);
      return;
    }
    const readyProducts = visibleStockAlertInsights.directAddItems
      .map((item) => item.product)
      .filter(Boolean) as Product[];
    if (readyProducts.length === 0) {
      announceAccessibleMessage(t('pages.stockAlerts.noReadyToCart'), 'info');
      return;
    }
    const results = await allSettledWithConcurrency(
      readyProducts,
      (product) => addToCart(product, true),
    );
    const added = results.filter((result) => result.status === 'fulfilled' && result.value).length;
    if (added > 0) {
      announceAccessibleMessage(t('pages.stockAlerts.addedReadyCount', { count: added }), 'success');
      dispatchDomEvent('shop:open-cart');
    }
  };

  const restockNextAction = (() => {
    if (hasStaleProductData) {
      return {
        tone: 'stale',
        title: t('pages.stockAlerts.nextActionStaleTitle'),
        text: t('pages.stockAlerts.nextActionStaleText'),
        label: t('common.retry'),
        action: () => setReloadKey((value) => value + 1),
      };
    }
    if (visibleStockAlertInsights.directAddItems.length > 0) {
      return {
        tone: 'ready',
        title: t('pages.stockAlerts.nextActionReadyTitle'),
        text: t('pages.stockAlerts.nextActionReadyText', { count: visibleStockAlertInsights.directAddItems.length }),
        label: t('pages.stockAlerts.addReadyToCart'),
        action: addReadyItemsToCart,
      };
    }
    if (visibleStockAlertInsights.optionItems.length > 0) {
      const nextItem = visibleStockAlertInsights.optionItems[0];
      return {
        tone: 'options',
        title: t('pages.stockAlerts.nextActionOptionsTitle'),
        text: t('pages.stockAlerts.nextActionOptionsText', { name: stockAlertProductName(nextItem) }),
        label: t('pages.stockAlerts.selectOptions'),
        action: () => navigate(`/products/${nextItem.productId}`),
      };
    }
    if (visibleStockAlertInsights.waitingItems > 0) {
      return {
        tone: 'waiting',
        title: t('pages.stockAlerts.nextActionWaitingTitle'),
        text: t('pages.stockAlerts.nextActionWaitingText', { count: visibleStockAlertInsights.waitingItems }),
        label: t('pages.stockAlerts.browsePersonalized'),
        action: () => navigate('/products?sort=personalized-desc'),
      };
    }
    return {
      tone: 'browse',
      title: t('pages.stockAlerts.nextActionBrowseTitle'),
      text: t('pages.stockAlerts.nextActionBrowseText'),
      label: t('pages.stockAlerts.browse'),
      action: () => navigate('/products?sort=personalized-desc'),
    };
  })();
  const addReadyActionLabel = `${t('pages.stockAlerts.addReadyToCart')}: ${t('pages.stockAlerts.directReady', { count: visibleStockAlertInsights.directAddItems.length })}`;
  const restockNextActionLabel = `${restockNextAction.label}: ${restockNextAction.title}`;
  const restockNextActionIcon = restockNextAction.tone === 'stale' ? <ShopIcon path={SI.reload} /> : <ShopIcon path={SI.cart} />;
  const mobileNextActionStatus = restockNextAction.tone === 'ready'
    ? t('pages.stockAlerts.directReady', { count: visibleStockAlertInsights.directAddItems.length })
    : restockNextAction.tone === 'options'
      ? t('pages.stockAlerts.optionReady', { count: visibleStockAlertInsights.optionItems.length })
      : restockNextAction.tone === 'stale'
        ? t('pages.stockAlerts.loadFailed')
        : t('pages.stockAlerts.stillWatchingCount', { count: visibleStockAlertInsights.waitingItems });
  const browseStockAlertsActionLabel = `${t('pages.stockAlerts.browse')}: ${t('pages.stockAlerts.title')}`;
  const clearStockAlertsActionLabel = `${t('pages.stockAlerts.clear')}: ${alerts.length}`;

  return (
    <div className={`stock-alerts stock-alerts-page stock-alerts--${language}`}>
      <Card>
        <div className="stock-alerts__header">
          <div>
            <h1 className="stock-alerts-page__title" style={{ margin: 0 }}>
              <ShopIcon path={SI.bell} /> {t('pages.stockAlerts.title')}
            </h1>
            <span className="stock-alerts-page__text stock-alerts-page__text--secondary">
              {t('pages.stockAlerts.subtitle', { count: loading || hasStaleProductData ? 0 : visibleStockAlertInsights.backInStockItems.length, saved: alerts.length })}
            </span>
          </div>
          <div className="stock-alerts__actionRow">
            <Button aria-label={browseStockAlertsActionLabel} title={browseStockAlertsActionLabel} onClick={() => navigate('/products')}>{t('pages.stockAlerts.browse')}</Button>
            <Popconfirm
              classNames={{ root: 'shop-mobile-popup-layer stock-alerts-popconfirm' }}
              title={t('pages.stockAlerts.clearConfirm')}
              onConfirm={clearAll}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
              okButtonProps={{ danger: true, 'aria-label': clearStockAlertsActionLabel, title: clearStockAlertsActionLabel }}
              cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${clearStockAlertsActionLabel}`, title: `${t('common.cancel')}: ${clearStockAlertsActionLabel}` }}
            >
              <Button danger disabled={alerts.length === 0} aria-label={clearStockAlertsActionLabel} title={clearStockAlertsActionLabel}>{t('pages.stockAlerts.clear')}</Button>
            </Popconfirm>
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
                <Button
                  onClick={() => navigate(`/products/${visibleStockAlertInsights.bestReadyItem!.productId}`)}
                  aria-label={`${t('pages.stockAlerts.viewBestReady')}: ${stockAlertProductName(visibleStockAlertInsights.bestReadyItem)}`}
                  title={`${t('pages.stockAlerts.viewBestReady')}: ${stockAlertProductName(visibleStockAlertInsights.bestReadyItem)}`}
                >
                  {t('pages.stockAlerts.viewBestReady')}
                </Button>
              ) : null}
              <Button
                type="primary"
                icon={<ShopIcon path={SI.cart} />}
                aria-label={addReadyActionLabel}
                title={addReadyActionLabel}
                onClick={addReadyItemsToCart}
              >
                {t('pages.stockAlerts.addReadyToCart')}
              </Button>
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
              <Tag color="green">{t('pages.stockAlerts.directReady', { count: visibleStockAlertInsights.directAddItems.length })}</Tag>
              <Tag color={visibleStockAlertInsights.optionItems.length > 0 ? 'gold' : 'default'}>
                {t('pages.stockAlerts.optionReady', { count: visibleStockAlertInsights.optionItems.length })}
              </Tag>
              <Tag color={visibleStockAlertInsights.waitingItems > 0 ? 'blue' : 'default'}>
                {t('pages.stockAlerts.stillWatchingCount', { count: visibleStockAlertInsights.waitingItems })}
              </Tag>
            </div>
            <Button
              type={restockNextAction.tone === 'ready' ? 'primary' : 'default'}
              icon={restockNextActionIcon}
              aria-label={restockNextActionLabel}
              title={restockNextActionLabel}
              onClick={restockNextAction.action}
            >
              {restockNextAction.label}
            </Button>
          </section>
        ) : null}

        {alerts.length > 0 ? (
          <div className={`stock-alerts__mobileAction stock-alerts__mobileAction--${restockNextAction.tone}`}>
            <div className="stock-alerts__mobileActionCopy">
              <span>{restockNextAction.title}</span>
              <strong>{mobileNextActionStatus}</strong>
            </div>
            <Button
              type={restockNextAction.tone === 'ready' ? 'primary' : 'default'}
              icon={restockNextActionIcon}
              aria-label={restockNextActionLabel}
              title={restockNextActionLabel}
              onClick={restockNextAction.action}
            >
              {restockNextAction.label}
            </Button>
          </div>
        ) : null}

        {loadError && hasStaleProductData ? (
          <Alert
            type="warning"
            showIcon
            message={t('pages.stockAlerts.loadFailed')}
            description={hasStaleProductData ? t('pages.stockAlerts.staleDataWarning') : t('common.loadFailedRetry')}
            action={<Button size="small" onClick={() => setReloadKey((value) => value + 1)}>{t('common.retry')}</Button>}
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
          <List
            loading={loading}
            dataSource={visibleStockAlertInsights.items}
            renderItem={(item) => {
              const product = item.product;
              const productName = stockAlertProductName(item);
              const productLinkLabel = `${t('pages.productList.viewDetails')}: ${productName}`;
              const ready = isBackInStock(product);
              const needsSelection = Boolean(product && needsOptionSelection(product));
              const lowStock = Boolean(ready && product?.stock !== undefined && product.stock > 0 && product.stock <= 5);
              const addActionText = ready
                ? needsSelection
                  ? t('pages.stockAlerts.selectOptions')
                  : t('pages.stockAlerts.addToCart')
                : t('pages.productList.soldOut');
              const addActionLabel = `${addActionText}: ${productName}`;
              const removeActionLabel = `${t('pages.stockAlerts.remove')}: ${productName}`;
              return (
                <List.Item
                  className={[
                    'stock-alerts__item',
                    ready ? 'stock-alerts__item--ready' : 'stock-alerts__item--waiting',
                    lowStock ? 'stock-alerts__item--lowStock' : '',
                    needsSelection ? 'stock-alerts__item--options' : '',
                  ].filter(Boolean).join(' ')}
                  actions={[
                    <Button
                      key="add"
                      type="primary"
                      icon={<ShopIcon path={SI.cart} />}
                      className={ready ? undefined : 'stock-alerts__soldoutButton'}
                      aria-label={addActionLabel}
                      title={addActionLabel}
                      onClick={() => product && addToCart(product)}
                      disabled={hasStaleProductData || !ready}
                    >
                      {addActionText}
                    </Button>,
                    <Popconfirm
                      key="remove"
                      classNames={{ root: 'shop-mobile-popup-layer stock-alerts-popconfirm' }}
                      title={t('pages.stockAlerts.removeConfirm')}
                      onConfirm={() => removeAlert(item.productId)}
                      okText={t('common.confirm')}
                      cancelText={t('common.cancel')}
                      okButtonProps={{ danger: true, 'aria-label': removeActionLabel, title: removeActionLabel }}
                      cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${removeActionLabel}`, title: `${t('common.cancel')}: ${removeActionLabel}` }}
                    >
                      <Button icon={<ShopIcon path={SI.delete} />} aria-label={removeActionLabel} title={removeActionLabel}>{t('pages.stockAlerts.remove')}</Button>
                    </Popconfirm>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={
                      <Link className="stock-alerts__imageLink" to={`/products/${item.productId}`} aria-label={productLinkLabel} title={productLinkLabel}>
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
                    }
                    title={<Link className="stock-alerts__productLink" to={`/products/${item.productId}`} aria-label={productLinkLabel} title={productLinkLabel}>{productName}</Link>}
                    description={
                      <div className="stock-alerts__itemDetails">
                        <span className="stock-alerts-page__text stock-alerts-page__text--secondary stock-alerts__watchTime">
                          {t('pages.stockAlerts.createdAt', { time: new Date(item.createdAt).toLocaleString(dateLocale) })}
                        </span>
                        {product ? (
                          <div className="stock-alerts__itemSignalRow">
                            <span className="stock-alerts-page__text stock-alerts-page__text--strong stock-alerts__price commerce-money">{formatMoney(product.effectivePrice ?? product.price)}</span>
                            <Tag color={ready ? 'green' : 'default'}>
                              {ready ? t('pages.productDetail.enough') : t('pages.productList.soldOut')}
                            </Tag>
                            {lowStock ? <Tag color="volcano">{t('pages.stockAlerts.lowStockReady')}</Tag> : null}
                            {ready && needsSelection ? <Tag color="gold">{t('pages.stockAlerts.selectOptions')}</Tag> : null}
                          </div>
                        ) : null}
                      </div>
                    }
                  />
                </List.Item>
              );
            }}
          />
        )}
      </Card>
    </div>
  );
};

export default StockAlerts;
