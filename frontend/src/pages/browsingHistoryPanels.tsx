import React from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { ShopIcon, SI } from '../components/ShopIcon';
import ShopInput from '../components/ShopInput';
import ShopPopconfirm from '../components/ShopPopconfirm';
import type { ProductPublic as Product } from '../types';
import { getLowStockCount } from '../utils/conversionConfig';
import { needsOptionSelection } from '../utils/productOptions';
import { dispatchDomEvent } from '../utils/domEvents';
import PageError from '../components/PageError';
import ShopButton from '../components/ShopButton';
import ShopTag from '../components/ShopTag';
import ShopAlert from '../components/ShopAlert';
import {
  buildBrowsingHistoryItemActionLabels,
  fallbackImage,
  formatHistoryViewedAt,
  isDealProduct,
  isPurchasable,
  resolveHistoryImage,
  type BrowsingHistoryTranslate,
  type HistoryInsights,
  type HistoryQuickFilter,
} from './browsingHistoryHelpers';

export type BrowsingHistoryNextAction = {
  tone: 'browse' | 'stale' | 'ready' | 'options' | 'urgent';
  title: string;
  text: string;
  label: string;
  action: () => void;
};

export type BrowsingHistoryPanelsProps = {
  t: BrowsingHistoryTranslate;
  language: string;
  navigate: NavigateFunction;
  formatMoney: (value?: number | null) => string;
  hasHistory: boolean;
  hasStaleHistoryData: boolean;
  historyDisplayCount: number;
  historyInsights: HistoryInsights;
  filteredProducts: Product[];
  historyProducts: Product[];
  viewedAtById: Map<number, number>;
  keyword: string;
  setKeyword: React.Dispatch<React.SetStateAction<string>>;
  quickFilter: HistoryQuickFilter;
  setQuickFilter: React.Dispatch<React.SetStateAction<HistoryQuickFilter>>;
  loadError: boolean;
  setReloadToken: React.Dispatch<React.SetStateAction<number>>;
  historyNextAction: BrowsingHistoryNextAction;
  clearHistoryActionLabel: string;
  historyBrowseActionLabel: string;
  historyNextActionLabel: string;
  resetHistoryFiltersLabel: string;
  historyProductName: (product: Pick<Product, 'id' | 'name'>) => string;
  clearHistory: () => void;
  removeItem: (productId: number) => void;
  addHistoryProductToCart: (product: Product) => void;
};

export const BrowsingHistoryLoadingShell: React.FC<{
  t: BrowsingHistoryTranslate;
  language: string;
}> = ({ t, language }) => (
  <main
    className={`browsing-history browsing-history--${language} browsing-history--loading`}
    role="status"
    aria-live="polite"
    aria-busy="true"
    aria-label={t('common.loading')}
  >
    <span className="browsing-history__spinner" aria-hidden="true" />
  </main>
);

export const BrowsingHistoryMainPanels: React.FC<BrowsingHistoryPanelsProps> = ({
  t,
  language,
  navigate,
  formatMoney,
  hasHistory,
  hasStaleHistoryData,
  historyDisplayCount,
  historyInsights,
  filteredProducts,
  historyProducts,
  viewedAtById,
  keyword,
  setKeyword,
  quickFilter,
  setQuickFilter,
  loadError,
  setReloadToken,
  historyNextAction,
  clearHistoryActionLabel,
  historyBrowseActionLabel,
  historyNextActionLabel,
  resetHistoryFiltersLabel,
  historyProductName,
  clearHistory,
  removeItem,
  addHistoryProductToCart,
}) => {
  const emptyQuickActions = [
    {
      key: 'browse',
      icon: <ShopIcon path={SI.shopping} />,
      label: t('pages.browsingHistory.browse'),
      action: () => navigate('/products'),
      type: 'primary' as const,
    },
    {
      key: 'personalized',
      icon: <ShopIcon path={SI.thunder} />,
      label: t('pages.browsingHistory.browsePersonalized'),
      action: () => navigate('/products?sort=personalized-desc'),
    },
    {
      key: 'coupons',
      icon: <ShopIcon path={SI.fire} />,
      label: t('nav.coupons'),
      action: () => navigate('/coupons'),
    },
    {
      key: 'petFinder',
      icon: <ShopIcon path={SI.search} />,
      label: t('nav.petFinder'),
      action: () => navigate('/pet-finder'),
    },
  ];

  const formatViewedAt = (value?: number) => formatHistoryViewedAt(value, language, t);

  return (
    <main className={`browsing-history browsing-history--${language}${!hasHistory ? ' browsing-history--empty' : ''}`}>
      <section className="browsing-history__hero">
        <div>
          <span className="browsing-history__eyebrow">
            <ShopIcon path={SI.history} /> {t('pages.browsingHistory.eyebrow')}
          </span>
          <h1 className="browsing-history__title">{t('pages.browsingHistory.title')}</h1>
          <p className="browsing-history__text browsing-history__paragraph browsing-history__subtitle">{t('pages.browsingHistory.subtitle', { count: historyDisplayCount })}</p>
        </div>
        <div className="browsing-history__tools">
          <ShopInput
            allowClear
            prefix={<ShopIcon path={SI.search} />}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={t('pages.browsingHistory.searchPlaceholder')}
            aria-label={t('pages.browsingHistory.searchPlaceholder')}
            title={t('pages.browsingHistory.searchPlaceholder')}
          />
          <ShopPopconfirm
            rootClassName='shop-mobile-popup-layer browsing-history-clear-popconfirm'
            title={t('pages.browsingHistory.clearConfirm')}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
            okButtonProps={{ danger: true, 'aria-label': clearHistoryActionLabel, title: clearHistoryActionLabel }}
            cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${clearHistoryActionLabel}`, title: `${t('common.cancel')}: ${clearHistoryActionLabel}` }}
            onConfirm={clearHistory}
            disabled={!hasHistory}
          >
            <ShopButton danger icon={<ShopIcon path={SI.delete} />} disabled={!hasHistory} aria-label={clearHistoryActionLabel} title={clearHistoryActionLabel}>
              {t('pages.browsingHistory.clear')}
            </ShopButton>
          </ShopPopconfirm>
        </div>
      </section>

      {hasHistory ? (
        <section className="browsing-history__assistant">
          <div className="browsing-history__assistant-copy">
            <span>{t('pages.browsingHistory.assistantEyebrow')}</span>
            <h2 className="browsing-history__title browsing-history__sectionTitle">{t('pages.browsingHistory.assistantTitle')}</h2>
            <p className="browsing-history__text browsing-history__paragraph browsing-history__sectionText">
              {hasStaleHistoryData
                ? t('pages.browsingHistory.assistantSubtitleStale')
                : historyInsights.topBrand
                ? t('pages.browsingHistory.assistantSubtitleBrand', { brand: historyInsights.topBrand })
                : t('pages.browsingHistory.assistantSubtitle')}
            </p>
          </div>
          <div className="browsing-history__assistant-actions">
            <button
              type="button"
              className={quickFilter === 'all' ? 'is-active' : ''}
              aria-pressed={quickFilter === 'all'}
              aria-label={`${t('pages.browsingHistory.allViewed')}: ${historyDisplayCount}`}
              title={`${t('pages.browsingHistory.allViewed')}: ${historyDisplayCount}`}
              onClick={() => setQuickFilter('all')}
            >
              <ShopIcon path={SI.history} />
              <strong>{historyDisplayCount}</strong>
              <span>{t('pages.browsingHistory.allViewed')}</span>
            </button>
            <button
              type="button"
              className={quickFilter === 'recent' ? 'is-active' : ''}
              aria-pressed={quickFilter === 'recent'}
              aria-label={`${t('pages.browsingHistory.viewedToday')}: ${hasStaleHistoryData ? 0 : historyInsights.viewedToday}`}
              title={`${t('pages.browsingHistory.viewedToday')}: ${hasStaleHistoryData ? 0 : historyInsights.viewedToday}`}
              onClick={() => setQuickFilter('recent')}
              disabled={hasStaleHistoryData}
            >
              <ShopIcon path={SI.clock} />
              <strong>{hasStaleHistoryData ? 0 : historyInsights.viewedToday}</strong>
              <span>{t('pages.browsingHistory.viewedToday')}</span>
            </button>
            <button
              type="button"
              className={quickFilter === 'deals' ? 'is-active' : ''}
              aria-pressed={quickFilter === 'deals'}
              aria-label={`${t('pages.browsingHistory.dealWatch')}: ${hasStaleHistoryData ? 0 : historyInsights.deals}`}
              title={`${t('pages.browsingHistory.dealWatch')}: ${hasStaleHistoryData ? 0 : historyInsights.deals}`}
              onClick={() => setQuickFilter('deals')}
              disabled={hasStaleHistoryData}
            >
              <ShopIcon path={SI.thunder} />
              <strong>{hasStaleHistoryData ? 0 : historyInsights.deals}</strong>
              <span>{t('pages.browsingHistory.dealWatch')}</span>
            </button>
            <button
              type="button"
              className={quickFilter === 'lowStock' ? 'is-active' : ''}
              aria-pressed={quickFilter === 'lowStock'}
              aria-label={`${t('pages.browsingHistory.lowStockWatch')}: ${hasStaleHistoryData ? 0 : historyInsights.lowStock}`}
              title={`${t('pages.browsingHistory.lowStockWatch')}: ${hasStaleHistoryData ? 0 : historyInsights.lowStock}`}
              onClick={() => setQuickFilter('lowStock')}
              disabled={hasStaleHistoryData}
            >
              <ShopIcon path={SI.fire} />
              <strong>{hasStaleHistoryData ? 0 : historyInsights.lowStock}</strong>
              <span>{t('pages.browsingHistory.lowStockWatch')}</span>
            </button>
          </div>
        </section>
      ) : null}

      {hasHistory && historyInsights.bestRecovery && !hasStaleHistoryData ? (
        (() => {
          const productName = historyProductName(historyInsights.bestRecovery!);
          const resumeActionLabel = `${t('pages.browsingHistory.resumeProduct')}: ${productName}`;
          return (
        <section className="browsing-history__recovery" aria-label={t('pages.browsingHistory.recoveryTitle')}>
          <div>
            <span className="browsing-history__recovery-eyebrow">{t('pages.browsingHistory.recoveryEyebrow')}</span>
            <h2 className="browsing-history__title browsing-history__sectionTitle">{t('pages.browsingHistory.recoveryTitle')}</h2>
            <p className="browsing-history__text browsing-history__paragraph browsing-history__sectionText">
              {t('pages.browsingHistory.recoverySubtitle', {
                name: productName,
                price: formatMoney(historyInsights.bestRecovery.effectivePrice ?? historyInsights.bestRecovery.price),
              })}
            </p>
          </div>
          <div className="browsing-history__recovery-tags">
            {isDealProduct(historyInsights.bestRecovery) ? <ShopTag color="volcano">{t('pages.browsingHistory.recoveryDeal')}</ShopTag> : null}
            {getLowStockCount(historyInsights.bestRecovery.stock, 1) !== null ? <ShopTag color="orange">{t('pages.browsingHistory.recoveryLowStock')}</ShopTag> : null}
            <ShopTag color="blue">{formatViewedAt(viewedAtById.get(historyInsights.bestRecovery.id))}</ShopTag>
          </div>
          <ShopButton type="primary" icon={<ShopIcon path={SI.shopping} />} aria-label={resumeActionLabel} title={resumeActionLabel} onClick={() => navigate(`/products/${historyInsights.bestRecovery!.id}`)}>
            {t('pages.browsingHistory.resumeProduct')}
          </ShopButton>
        </section>
          );
        })()
      ) : null}

      {hasHistory ? (
        <section className={`browsing-history__nextAction browsing-history__nextAction--${historyNextAction.tone}`} aria-label={t('pages.browsingHistory.nextActionEyebrow')}>
          <div>
            <span>{t('pages.browsingHistory.nextActionEyebrow')}</span>
            <h2 className="browsing-history__title browsing-history__sectionTitle">{historyNextAction.title}</h2>
            <p className="browsing-history__text browsing-history__paragraph browsing-history__sectionText">{historyNextAction.text}</p>
          </div>
          <div className="browsing-history__nextActionStats">
            <ShopTag color={hasStaleHistoryData ? 'warning' : 'green'}>
              {hasStaleHistoryData
                ? t('pages.browsingHistory.staleDataTag', { count: historyDisplayCount })
                : t('pages.browsingHistory.readyToCart', { count: historyInsights.readyToCart })}
            </ShopTag>
            <ShopTag color={!hasStaleHistoryData && historyInsights.deals > 0 ? 'volcano' : 'default'}>{t('pages.browsingHistory.dealWatchCount', { count: hasStaleHistoryData ? 0 : historyInsights.deals })}</ShopTag>
            <ShopTag color={!hasStaleHistoryData && historyInsights.lowStock > 0 ? 'orange' : 'default'}>{t('pages.browsingHistory.lowStockWatchCount', { count: hasStaleHistoryData ? 0 : historyInsights.lowStock })}</ShopTag>
          </div>
          <ShopButton
            type={historyNextAction.tone === 'ready' ? 'primary' : 'default'}
            icon={hasStaleHistoryData ? <ShopIcon path={SI.reload} /> : historyNextAction.tone === 'ready' ? <ShopIcon path={SI.cart} /> : <ShopIcon path={SI.shopping} />}
            aria-label={historyNextActionLabel}
            title={historyNextActionLabel}
            onClick={historyNextAction.action}
          >
            {historyNextAction.label}
          </ShopButton>
        </section>
      ) : null}

      {loadError ? (
        <section className="browsing-history__loadError" aria-live="polite" data-history-load-recovery="true">
          {hasStaleHistoryData ? (
            <ShopAlert
              type="warning"
              showIcon
              message={t('messages.loadFailed')}
              description={hasStaleHistoryData ? t('pages.browsingHistory.staleDataWarning') : t('messages.loadFailedRetry')}
              action={(
                <div className="browsing-history__emptyActions" data-history-stale-recovery="true">
                  <ShopButton size="small" type="primary" onClick={() => setReloadToken((current) => current + 1)}>
                    {t('messages.retry')}
                  </ShopButton>
                  <ShopButton size="small" onClick={() => navigate('/products')}>
                    {t('pages.browsingHistory.browse')}
                  </ShopButton>
                  <ShopButton size="small" onClick={() => navigate('/coupons')}>
                    {t('nav.coupons')}
                  </ShopButton>
                  <ShopButton size="small" onClick={() => navigate('/pet-finder')}>
                    {t('nav.petFinder')}
                  </ShopButton>
                </div>
              )}
            />
          ) : (
            <PageError
              className="browsing-history__loadErrorPanel"
              title={t('messages.loadFailed')}
              description={t('messages.loadFailedRetry')}
              actions={[
                {
                  key: 'retry',
                  label: t('messages.retry'),
                  onClick: () => setReloadToken((current) => current + 1),
                  type: 'primary',
                },
                {
                  key: 'browse',
                  label: t('pages.browsingHistory.browse'),
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
          )}
        </section>
      ) : null}

      {filteredProducts.length ? (
        <section className="browsing-history__grid">
          {filteredProducts.map((product) => {
            const productName = historyProductName(product);
            const price = product.effectivePrice ?? product.price;
            const viewedAt = viewedAtById.get(product.id);
            const productReadyToCart = isPurchasable(product) && !needsOptionSelection(product);
            const productNeedsOptions = isPurchasable(product) && needsOptionSelection(product);
            const productLowStock = getLowStockCount(product.stock, 1) !== null;
            const productDeal = isDealProduct(product);
            const originalPrice = Number(product.originalPrice || 0);
            const {
              addActionLabel,
              viewActionLabel,
              deleteActionLabel,
            } = buildBrowsingHistoryItemActionLabels({
              t,
              productName,
              productNeedsOptions,
            });
            return (
              <article className={`browsing-history__item${productReadyToCart ? ' browsing-history__item--ready' : ''}${productLowStock ? ' browsing-history__item--urgent' : ''}`} key={product.id}>
                <button type="button" className="browsing-history__image" aria-label={viewActionLabel} title={viewActionLabel} onClick={() => navigate(`/products/${product.id}`)}>
                  <img
                    src={resolveHistoryImage(product.imageUrl)}
                    alt={productName}
                    onError={(event) => {
                      if (event.currentTarget.src !== fallbackImage) {
                        event.currentTarget.src = fallbackImage;
                      }
                    }}
                  />
                </button>
                <div className="browsing-history__content">
                  <div>
                    <button type="button" className="browsing-history__name" aria-label={viewActionLabel} title={viewActionLabel} onClick={() => navigate(`/products/${product.id}`)}>
                      {productName}
                    </button>
                    <div className="browsing-history__meta">
                      <span>{formatViewedAt(viewedAt)}</span>
                      {product.brand ? <ShopTag>{product.brand}</ShopTag> : null}
                    </div>
                    <div className="browsing-history__signals">
                      {productDeal ? <ShopTag color="volcano">{t('pages.browsingHistory.recoveryDeal')}</ShopTag> : null}
                      {productLowStock ? <ShopTag color="orange">{t('pages.browsingHistory.recoveryLowStock')}</ShopTag> : null}
                      {productNeedsOptions ? <ShopTag color="blue">{t('pages.browsingHistory.resumeProduct')}</ShopTag> : null}
                      {!isPurchasable(product) ? <ShopTag color="red">{t('pages.browsingHistory.unavailable')}</ShopTag> : null}
                    </div>
                  </div>
                  <div className="browsing-history__footer">
                    <span className="browsing-history__priceStack">
                      <strong className="commerce-money">{formatMoney(price)}</strong>
                      {originalPrice > Number(price || 0) ? <span className="commerce-money">{formatMoney(originalPrice)}</span> : null}
                    </span>
                    <div>
                      {productReadyToCart ? (
                        <ShopButton type="primary" icon={<ShopIcon path={SI.cart} />} disabled={hasStaleHistoryData} aria-label={addActionLabel} title={addActionLabel} onClick={() => addHistoryProductToCart(product)}>
                          {t('pages.browsingHistory.addToCart')}
                        </ShopButton>
                      ) : null}
                      <ShopButton type={productNeedsOptions ? 'primary' : 'default'} icon={<ShopIcon path={SI.shopping} />} aria-label={viewActionLabel} title={viewActionLabel} onClick={() => navigate(`/products/${product.id}`)}>
                        {productNeedsOptions ? t('pages.browsingHistory.resumeProduct') : t('pages.browsingHistory.viewProduct')}
                      </ShopButton>
                      <ShopPopconfirm
                        title={t('pages.browsingHistory.removeConfirm')}
                        okText={t('common.delete')}
                        cancelText={t('common.cancel')}
                        onConfirm={() => removeItem(product.id)}
                      >
                        <ShopButton type="text" danger icon={<ShopIcon path={SI.delete} />} aria-label={deleteActionLabel} title={deleteActionLabel} />
                      </ShopPopconfirm>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="browsing-history__empty" role="status" aria-live="polite">
          <div className="browsing-history__emptyPanel">
            <div className="browsing-history__emptyDescription">
              {loadError && hasHistory
                ? t('pages.browsingHistory.emptyLoadFailed')
                : historyProducts.length
                  ? t('pages.browsingHistory.noSearchResults')
                  : t('pages.browsingHistory.empty')}
            </div>
            {loadError && hasHistory ? (
              <div className="browsing-history__emptyActions" data-history-empty-load-actions="true">
                <ShopButton type="primary" icon={<ShopIcon path={SI.reload} />} onClick={() => setReloadToken((current) => current + 1)}>
                  {t('messages.retry')}
                </ShopButton>
                <ShopButton icon={<ShopIcon path={SI.shopping} />} aria-label={historyBrowseActionLabel} title={historyBrowseActionLabel} onClick={() => navigate('/products')}>
                  {t('pages.browsingHistory.browse')}
                </ShopButton>
                <ShopButton aria-label={t('nav.coupons')} title={t('nav.coupons')} onClick={() => navigate('/coupons')}>
                  {t('nav.coupons')}
                </ShopButton>
                <ShopButton aria-label={t('nav.petFinder')} title={t('nav.petFinder')} onClick={() => navigate('/pet-finder')}>
                  {t('nav.petFinder')}
                </ShopButton>
                <ShopButton aria-label={t('pages.productList.loadRecoverySupport')} title={t('pages.productList.loadRecoverySupport')} onClick={() => dispatchDomEvent('shop:open-support')}>
                  {t('pages.productList.loadRecoverySupport')}
                </ShopButton>
              </div>
            ) : historyProducts.length ? (
              <div className="browsing-history__emptyActions" data-history-empty-filter-actions="true">
                <ShopButton type="primary" icon={<ShopIcon path={SI.shopping} />} aria-label={historyBrowseActionLabel} title={historyBrowseActionLabel} onClick={() => navigate('/products')}>
                  {t('pages.browsingHistory.browse')}
                </ShopButton>
                <ShopButton aria-label={resetHistoryFiltersLabel} title={resetHistoryFiltersLabel} onClick={() => {
                  setKeyword('');
                  setQuickFilter('all');
                }}>
                  {t('pages.productList.resetFilters')}
                </ShopButton>
                <ShopButton aria-label={t('nav.coupons')} title={t('nav.coupons')} onClick={() => navigate('/coupons')}>
                  {t('nav.coupons')}
                </ShopButton>
                <ShopButton aria-label={t('nav.petFinder')} title={t('nav.petFinder')} onClick={() => navigate('/pet-finder')}>
                  {t('nav.petFinder')}
                </ShopButton>
              </div>
            ) : (
              <div className="browsing-history__emptyActions browsing-history__emptyActions--guide" data-history-empty-actions="true">
                {emptyQuickActions.map((action) => (
                  <ShopButton
                    key={action.key}
                    type={action.type}
                    icon={action.icon}
                    aria-label={action.label}
                    title={action.label}
                    onClick={action.action}
                  >
                    {action.label}
                  </ShopButton>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
      <div className={`browsing-history__mobileAction browsing-history__mobileAction--${historyNextAction.tone}`} aria-label={t('pages.browsingHistory.nextActionEyebrow')}>
        <span>
          <span>{t('pages.browsingHistory.nextActionEyebrow')}</span>
          <strong>{historyNextAction.title}</strong>
          <small>
            {hasStaleHistoryData
              ? t('pages.browsingHistory.staleDataTag', { count: historyDisplayCount })
              : t('pages.browsingHistory.readyToCart', { count: historyInsights.readyToCart })}
          </small>
        </span>
        <ShopButton
          type={historyNextAction.tone === 'ready' ? 'primary' : 'default'}
          icon={hasStaleHistoryData ? <ShopIcon path={SI.reload} /> : historyNextAction.tone === 'ready' ? <ShopIcon path={SI.cart} /> : <ShopIcon path={SI.shopping} />}
          aria-label={historyNextActionLabel}
          title={historyNextActionLabel}
          onClick={historyNextAction.action}
        >
          {historyNextAction.label}
        </ShopButton>
      </div>
    </main>
  );
};
