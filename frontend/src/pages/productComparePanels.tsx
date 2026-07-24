import React, { useMemo } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { ShopIcon, SI } from '../components/ShopIcon';
import ShopRate from '../components/ShopRate';
import ShopSwitch from '../components/ShopSwitch';
import ShopPopconfirm from '../components/ShopPopconfirm';
import { Link } from 'react-router-dom';
import type { ProductPublic as Product } from '../types';
import { needsOptionSelection } from '../utils/productOptions';
import { formatProductSpecLabel } from '../utils/productSpecLabels';
import { dispatchDomEvent } from '../utils/domEvents';
import PageError from '../components/PageError';
import PageEmpty from '../components/PageEmpty';
import ShopButton from '../components/ShopButton';
import ShopTag from '../components/ShopTag';
import ShopAlert from '../components/ShopAlert';
import {
  compareImageFallback,
  collectCompareSpecKeys,
  getPrice,
  getSpecValue,
  normalizeSpecValue,
  resolveCompareImage,
  valuesDiffer,
  type CompareDecision,
  type CompareRow,
  type CompareTranslate,
} from './productCompareHelpers';

export type ProductCompareCopy = {
  detailDifferences: string;
  different: string;
  missing: string;
  noDifferences: string;
  onlyDifferent: string;
  summary: (count: number) => string;
};

export type ProductComparePanelsProps = {
  t: CompareTranslate;
  navigate: NavigateFunction;
  formatMoney: (value?: number | null) => string;
  products: Product[];
  loading: boolean;
  compareLoadError: boolean;
  compareLoadAttemptCount: number;
  showOnlyDifferences: boolean;
  setShowOnlyDifferences: React.Dispatch<React.SetStateAction<boolean>>;
  compareCopy: ProductCompareCopy;
  compareProductName: (product: Product) => string;
  compareDecision: CompareDecision;
  compareActionsDisabled: boolean;
  directReadyProducts: Product[];
  comparedIds: number[];
  fetchComparedProducts: () => void;
  removeProduct: (productId: number) => void;
  clearAll: () => void;
  addToCart: (product: Product) => void;
  addDirectReadyProductsToCart: () => void;
  compareAddAllActionLabel: string;
  selectedCompareCount: number;
  compareAddMoreActionLabel: string;
  compareClearActionLabel: string;
  compareBrowseActionLabel: string;
  compareAttributeHeader: string;
  tableMinWidth: number;
};

export const ProductCompareMainPanels: React.FC<ProductComparePanelsProps> = ({
  t,
  navigate,
  formatMoney,
  products,
  loading,
  compareLoadError,
  compareLoadAttemptCount,
  showOnlyDifferences,
  setShowOnlyDifferences,
  compareCopy,
  compareProductName,
  compareDecision,
  compareActionsDisabled,
  directReadyProducts,
  fetchComparedProducts,
  removeProduct,
  clearAll,
  addToCart,
  addDirectReadyProductsToCart,
  compareAddAllActionLabel,
  selectedCompareCount,
  compareAddMoreActionLabel,
  compareClearActionLabel,
  compareBrowseActionLabel,
  compareAttributeHeader,
  tableMinWidth,
}) => {
  const specKeys = useMemo(() => collectCompareSpecKeys(products), [products]);

  const specRows = useMemo<CompareRow[]>(() => specKeys.map((specKey) => {
    const normalizedValues = products.map((product) => normalizeSpecValue(getSpecValue(product, specKey)));
    const isDifferent = products.length > 1 && new Set(normalizedValues).size > 1;
    const specLabel = formatProductSpecLabel(specKey, t);
    return {
      key: `spec-${specKey}`,
      rawLabel: specLabel,
      label: (
        <div className="product-compare__chipRow">
          <span>{specLabel}</span>
          {isDifferent ? <ShopTag color="red">{compareCopy.different}</ShopTag> : null}
        </div>
      ),
      isDifferent,
      render: (product: Product) => {
        const value = getSpecValue(product, specKey);
        const hasValue = normalizeSpecValue(value).length > 0;
        return (
          <span
            className={[
              'product-compare__spec-value',
              isDifferent ? 'product-compare__spec-value--different' : '',
              !hasValue ? 'product-compare__spec-value--missing' : '',
            ].filter(Boolean).join(' ')}
          >
            {hasValue ? value : compareCopy.missing}
          </span>
        );
      },
    };
  }), [compareCopy.different, compareCopy.missing, products, specKeys, t]);

  const renderAttributeLabel = (label: React.ReactNode, isDifferent?: boolean) => (
    <div className="product-compare__chipRow">
      <span>{label}</span>
      {isDifferent ? <ShopTag color="red">{compareCopy.different}</ShopTag> : null}
    </div>
  );

  const priceDifferent = valuesDiffer(products, (product) => getPrice(product));
  const ratingDifferent = valuesDiffer(products, (product) => product.averageRating || 0);
  const brandDifferent = valuesDiffer(products, (product) => product.brand || '');
  const stockDifferent = valuesDiffer(products, (product) => product.stock ?? '');
  const shippingDifferent = valuesDiffer(products, (product) => product.freeShipping ? 'free-shipping' : product.shipping || 'default-shipping');

  const rows: CompareRow[] = [
    {
      key: 'image',
      label: t('common.image'),
      alwaysVisible: true,
      render: (product: Product) => (
        <Link to={`/products/${product.id}`}>
          <img
            className="product-compare__image"
            src={resolveCompareImage(product.imageUrl)}
            alt={compareProductName(product)}
            width={120}
            height={120}
            loading="lazy"
            decoding="async"
            onError={(event) => {
              if (event.currentTarget.src !== compareImageFallback) {
                event.currentTarget.src = compareImageFallback;
              }
            }}
          />
        </Link>
      ),
    },
    {
      key: 'name',
      label: t('pages.compare.product'),
      alwaysVisible: true,
      render: (product: Product) => {
        const productName = compareProductName(product);
        return <Link className="product-compare__productLink" to={`/products/${product.id}`}>{productName}</Link>;
      },
    },
    {
      key: 'price',
      label: renderAttributeLabel(t('pages.compare.price'), priceDifferent),
      isDifferent: priceDifferent,
      render: (product: Product) => (
        <div className="product-compare__stackTight">
          <span className="product-compare-page__text product-compare-page__text--strong commerce-money commerce-money--accent">{formatMoney(getPrice(product))}</span>
          {product.originalPrice && product.originalPrice > getPrice(product) ? (
            <span className="product-compare-page__text product-compare-page__text--delete product-compare-page__text--secondary commerce-money">{formatMoney(product.originalPrice)}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'rating',
      label: renderAttributeLabel(t('pages.compare.rating'), ratingDifferent),
      isDifferent: ratingDifferent,
      render: (product: Product) => (
        <div className="product-compare__stackTight">
          <ShopRate
            disabled
            allowHalf
            value={Number(product.averageRating || 0)}
            ariaLabel={`${Number(product.averageRating || 0).toFixed(1)}`}
          />
          <span className="product-compare-page__text product-compare-page__text--secondary">{t('pages.productList.positiveRate', { rate: (product.positiveRate || 0).toFixed(1), count: product.reviewCount || 0 })}</span>
        </div>
      ),
    },
    {
      key: 'brand',
      label: renderAttributeLabel(t('pages.productDetail.brand'), brandDifferent),
      isDifferent: brandDifferent,
      render: (product: Product) => product.brand || t('common.unset'),
    },
    {
      key: 'stock',
      label: renderAttributeLabel(t('pages.productDetail.stock'), stockDifferent),
      isDifferent: stockDifferent,
      render: (product: Product) => product.stock === undefined ? t('pages.productDetail.enough') : product.stock > 0 ? product.stock : <ShopTag color="red">{t('pages.productList.soldOut')}</ShopTag>,
    },
    {
      key: 'shipping',
      label: renderAttributeLabel(t('pages.productDetail.shipping'), shippingDifferent),
      isDifferent: shippingDifferent,
      render: (product: Product) => product.freeShipping ? t('pages.productDetail.freeShipping') : product.shipping || t('pages.productDetail.defaultShipping'),
    },
    {
      key: 'actions',
      label: t('common.actions'),
      alwaysVisible: true,
      render: (product: Product) => {
        const isSoldOut = product.stock !== undefined && product.stock <= 0;
        const needsSelection = needsOptionSelection(product);
        const productName = compareProductName(product);
        const selectActionLabel = `${t('pages.wishlist.selectOptions')}: ${productName}`;
        const addActionText = isSoldOut ? t('pages.productList.soldOut') : t('pages.productList.addToCart');
        const addActionLabel = `${addActionText}: ${productName}`;
        const removeActionLabel = `${t('pages.compare.remove')}: ${productName}`;
        return (
          <div className="product-compare__stack">
            {needsSelection && !isSoldOut ? (
              <ShopButton
                type="primary"
                icon={<ShopIcon path={SI.settings} />}
                aria-label={selectActionLabel}
                title={selectActionLabel}
                disabled={compareActionsDisabled}
                onClick={() => navigate(`/products/${product.id}`)}
              >
                {t('pages.wishlist.selectOptions')}
              </ShopButton>
            ) : (
              <ShopButton
                type="primary"
                icon={<ShopIcon path={SI.cart} />}
                className={isSoldOut ? 'product-compare__soldoutButton' : undefined}
                aria-label={addActionLabel}
                title={addActionLabel}
                onClick={() => addToCart(product)}
                disabled={isSoldOut || compareActionsDisabled}
              >
                {addActionText}
              </ShopButton>
            )}
            <ShopButton icon={<ShopIcon path={SI.delete} />} aria-label={removeActionLabel} title={removeActionLabel} onClick={() => removeProduct(product.id)}>
              {t('pages.compare.remove')}
            </ShopButton>
          </div>
        );
      },
    },
    ...specRows,
  ];

  const visibleRows = showOnlyDifferences
    ? rows.filter((row) => row.alwaysVisible || row.isDifferent)
    : rows;
  const differentRows = rows.filter((row) => row.isDifferent);
  const differentSpecNames = specRows
    .filter((row) => row.isDifferent && row.rawLabel)
    .map((row) => row.rawLabel as string);
  const compareDifferenceToggleLabel = `${compareCopy.onlyDifferent}: ${differentRows.length}`;

  return (
    <div className="product-compare-page">
      <section className="product-compare-page__shell" aria-label={t('pages.compare.title')}>
        <div className="product-compare__header">
          <div>
            <h1 className="product-compare-page__title">{t('pages.compare.title')}</h1>
            <span className="product-compare-page__text product-compare-page__text--secondary">{t('pages.compare.subtitle', { count: selectedCompareCount })}</span>
          </div>
          <div className="product-compare__headerActions">
            <ShopButton
              type="primary"
              icon={<ShopIcon path={SI.cart} />}
              disabled={directReadyProducts.length === 0 || compareActionsDisabled}
              aria-label={compareAddAllActionLabel}
              title={compareAddAllActionLabel}
              onClick={addDirectReadyProductsToCart}
            >
              {t('pages.wishlist.addAllToCart')}
            </ShopButton>
            <ShopButton aria-label={compareAddMoreActionLabel} title={compareAddMoreActionLabel} onClick={() => navigate('/products')}>{t('pages.compare.addMore')}</ShopButton>
            <ShopPopconfirm
              rootClassName='shop-mobile-popup-layer product-compare-clear-popconfirm'
              title={t('pages.compare.clearConfirm')}
              onConfirm={clearAll}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
              okButtonProps={{ danger: true, 'aria-label': compareClearActionLabel, title: compareClearActionLabel }}
              cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${compareClearActionLabel}`, title: `${t('common.cancel')}: ${compareClearActionLabel}` }}
            >
              <ShopButton danger disabled={products.length === 0 && compareLoadAttemptCount === 0} aria-label={compareClearActionLabel} title={compareClearActionLabel}>{t('pages.compare.clear')}</ShopButton>
            </ShopPopconfirm>
          </div>
        </div>
        {loading ? (
          <div
            className="product-compare__loading product-compare__spinnerWrap"
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label={t('common.loading')}
          >
            <span className="product-compare__spinner" aria-hidden="true" />
            <span className="product-compare__spinnerTip">{t('common.loading')}</span>
          </div>
        ) : compareLoadError && products.length === 0 ? (
          <PageError
            className="product-compare__loadError" data-compare-load-recovery="true"
            title={t('pages.compare.loadErrorTitle')}
            description={t('pages.compare.loadErrorDescription', { count: compareLoadAttemptCount })}
            actions={[
              {
                key: 'retry',
                label: t('common.retry'),
                onClick: fetchComparedProducts,
                type: 'primary',
              },
              {
                key: 'browse',
                label: compareBrowseActionLabel,
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
                label: t('pages.compare.emptyCoupons'),
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
        ) : products.length === 0 ? (
          <PageEmpty
            className="product-compare__emptyPanel"
            data-compare-empty-actions="true"
            description={(
              <div className="product-compare__emptyCopy">
                <div>{t('pages.compare.empty')}</div>
                <div className="product-compare__emptyHint">{t('pages.compare.emptyHint')}</div>
              </div>
            )}
            actions={[
              {
                key: 'browse',
                label: compareBrowseActionLabel,
                onClick: () => navigate('/products'),
              },
              {
                key: 'wishlist',
                label: t('pages.compare.emptyWishlist'),
                onClick: () => navigate('/wishlist'),
                type: 'default',
              },
              {
                key: 'coupons',
                label: t('pages.compare.emptyCoupons'),
                onClick: () => navigate('/coupons'),
                type: 'default',
              },
              {
                key: 'pet-finder',
                label: t('nav.petFinder'),
                onClick: () => navigate('/pet-finder'),
                type: 'default',
              },
            ]}
          />
        ) : (
          <>
            {compareLoadError ? (
              <ShopAlert
                className="product-compare__loadError"
                type="warning"
                showIcon
                data-compare-stale-recovery="true"
                message={t('pages.compare.loadErrorTitle')}
                description={t('pages.compare.staleDataWarning')}
                action={(
                  <div className="product-compare__staleActions" data-compare-stale-actions="true">
                    <ShopButton size="small" type="primary" onClick={fetchComparedProducts} loading={loading}>
                      {t('common.retry')}
                    </ShopButton>
                    <ShopButton size="small" onClick={() => navigate('/products')}>
                      {compareBrowseActionLabel}
                    </ShopButton>
                    <ShopButton size="small" onClick={() => navigate('/wishlist')}>
                      {t('pages.compare.emptyWishlist')}
                    </ShopButton>
                    <ShopButton size="small" onClick={() => navigate('/coupons')}>
                      {t('pages.compare.emptyCoupons')}
                    </ShopButton>
                  </div>
                )}
              />
            ) : null}
            <div className="product-compare__toolbar">
              <div className="product-compare__diff-summary">
                <span className="product-compare-page__text product-compare-page__text--strong">{compareCopy.detailDifferences}</span>
                <span className="product-compare-page__text product-compare-page__text--secondary">
                  {differentRows.length > 0
                    ? compareCopy.summary(differentRows.length)
                    : compareCopy.noDifferences}
                </span>
                {differentSpecNames.length > 0 ? (
                  <div className="product-compare__diff-tags">
                    {differentSpecNames.slice(0, 8).map((name) => <ShopTag key={name} color="red">{name}</ShopTag>)}
                  </div>
                ) : null}
              </div>
              <div className="product-compare__difference-toggle">
                <span className="product-compare-page__text">{compareCopy.onlyDifferent}</span>
                <ShopSwitch
                  checked={showOnlyDifferences}
                  aria-label={compareDifferenceToggleLabel}
                  title={compareDifferenceToggleLabel}
                  onChange={setShowOnlyDifferences}
                />
              </div>
            </div>
            <section className="product-compare__decision" aria-label={t('pages.compare.decisionTitle')}>
              <div className="product-compare__decisionCopy">
                <span className="product-compare-page__text product-compare__eyebrow">{t('pages.compare.decisionEyebrow')}</span>
                <h4 className="product-compare-page__title">{t('pages.compare.decisionTitle')}</h4>
                <span className="product-compare-page__text product-compare-page__text--secondary">
                  {compareDecision.bestValue
                    ? t('pages.compare.decisionSubtitleBest', { name: compareProductName(compareDecision.bestValue) })
                    : t('pages.compare.decisionSubtitle')}
                </span>
              </div>
              <div className="product-compare__decisionGrid">
                <div className="product-compare__decisionItem is-ok">
                  <ShopIcon path={SI.checkCircle} />
                  <strong>{compareDecision.readyCount}</strong>
                  <span>{t('pages.compare.readyToBuy')}</span>
                </div>
                <div className="product-compare__decisionItem is-warm">
                  <ShopIcon path={SI.fire} />
                  <strong className="commerce-money">{compareDecision.bestValue ? formatMoney(getPrice(compareDecision.bestValue)) : '-'}</strong>
                  <span>{t('pages.compare.bestValue')}</span>
                </div>
                <div className="product-compare__decisionItem is-ok">
                  <ShopIcon path={SI.starOutline} />
                  <strong>{compareDecision.topRated ? Number(compareDecision.topRated.averageRating || 0).toFixed(1) : '-'}</strong>
                  <span>{t('pages.compare.topRated')}</span>
                </div>
                <div className={`product-compare__decisionItem ${compareDecision.lowStock ? 'is-risk' : 'is-ok'}`}>
                  <ShopIcon path={SI.fire} />
                  <strong>{compareDecision.lowStock}</strong>
                  <span>{t('pages.compare.lowStock')}</span>
                </div>
              </div>
            </section>
            <section className="product-compare__recommendation" aria-label={t('pages.compare.recommendationTitle')}>
              <div className="product-compare__recommendationMain">
                <span className="product-compare-page__text product-compare__eyebrow">{t('pages.compare.recommendationEyebrow')}</span>
                <h4 className="product-compare-page__title">
                  {compareDecision.recommended
                    ? t('pages.compare.recommendationTitleWithName', { name: compareProductName(compareDecision.recommended) })
                    : t('pages.compare.recommendationTitle')}
                </h4>
                <span className="product-compare-page__text product-compare-page__text--secondary">
                  {compareDecision.recommended
                    ? t('pages.compare.recommendationSubtitle', {
                      price: formatMoney(getPrice(compareDecision.recommended)),
                      rating: Number(compareDecision.recommended.averageRating || 0).toFixed(1),
                    })
                    : t('pages.compare.recommendationEmpty')}
                </span>
                <div className="product-compare__chipRow">
                  {compareDecision.recommended ? (
                    (() => {
                      const recommended = compareDecision.recommended!;
                      const productName = compareProductName(recommended);
                      const selectActionLabel = `${t('pages.wishlist.selectOptions')}: ${productName}`;
                      const addActionLabel = `${t('pages.compare.addRecommended')}: ${productName}`;
                      return needsOptionSelection(recommended) ? (
                        <ShopButton type="primary" icon={<ShopIcon path={SI.settings} />} aria-label={selectActionLabel} title={selectActionLabel} disabled={compareActionsDisabled} onClick={() => navigate(`/products/${recommended.id}`)}>
                          {t('pages.wishlist.selectOptions')}
                        </ShopButton>
                      ) : (
                        <ShopButton type="primary" icon={<ShopIcon path={SI.cart} />} aria-label={addActionLabel} title={addActionLabel} disabled={compareActionsDisabled} onClick={() => addToCart(recommended)}>
                          {t('pages.compare.addRecommended')}
                        </ShopButton>
                      );
                    })()
                  ) : null}
                  {directReadyProducts.length > 1 ? (
                    <ShopButton
                      icon={<ShopIcon path={SI.cart} />}
                      aria-label={compareAddAllActionLabel}
                      title={compareAddAllActionLabel}
                      disabled={compareActionsDisabled}
                      onClick={addDirectReadyProductsToCart}
                    >
                      {t('pages.wishlist.addAllToCart')}
                    </ShopButton>
                  ) : null}
                  <ShopButton aria-label={compareAddMoreActionLabel} title={compareAddMoreActionLabel} onClick={() => navigate('/products')}>{t('pages.compare.addMore')}</ShopButton>
                </div>
              </div>
              <div className="product-compare__riskGrid">
                <div>
                  <strong className="commerce-money">{formatMoney(compareDecision.priceSpread)}</strong>
                  <span>{t('pages.compare.priceSpread')}</span>
                </div>
                <div>
                  <strong>{compareDecision.needsSelection}</strong>
                  <span>{t('pages.compare.needsOptions')}</span>
                </div>
                <div className={compareDecision.lowStock ? 'is-risk' : ''}>
                  <strong>{compareDecision.lowStock}</strong>
                  <span>{t('pages.compare.lowStockRisk')}</span>
                </div>
              </div>
            </section>
            {compareDecision.recommended ? (
              <section className="product-compare__checkoutPath" aria-label={t('pages.compare.checkoutPathTitle')}>
                <div className="product-compare__checkoutCopy">
                  <span className="product-compare-page__text product-compare__eyebrow">{t('pages.compare.checkoutPathEyebrow')}</span>
                  <h4 className="product-compare-page__title">{t('pages.compare.checkoutPathTitle')}</h4>
                  <span className="product-compare-page__text product-compare-page__text--secondary">
                    {t('pages.compare.checkoutPathSubtitle', { name: compareProductName(compareDecision.recommended) })}
                  </span>
                </div>
                <div className="product-compare__checkoutSteps">
                  <span className="is-ready"><ShopIcon path={SI.checkCircle} /> {t('pages.compare.checkoutStepAvailable')}</span>
                  <span className={compareDecision.recommendedNeedsSelection ? 'is-warm' : 'is-ready'}>
                    {compareDecision.recommendedNeedsSelection ? <ShopIcon path={SI.settings} /> : <ShopIcon path={SI.checkCircle} />}
                    {compareDecision.recommendedNeedsSelection ? t('pages.compare.checkoutStepOptions') : t('pages.compare.checkoutStepNoOptions')}
                  </span>
                  <span className={compareDecision.recommendedLowStock ? 'is-risk' : 'is-ready'}>
                    {compareDecision.recommendedLowStock ? <ShopIcon path={SI.fire} /> : <ShopIcon path={SI.checkCircle} />}
                    {compareDecision.recommendedLowStock ? t('pages.compare.checkoutStepLowStock') : t('pages.compare.checkoutStepStock')}
                  </span>
                </div>
                {compareDecision.recommendedNeedsSelection ? (
                  (() => {
                    const productName = compareProductName(compareDecision.recommended!);
                    const selectActionLabel = `${t('pages.wishlist.selectOptions')}: ${productName}`;
                    return (
                      <ShopButton type="primary" icon={<ShopIcon path={SI.settings} />} aria-label={selectActionLabel} title={selectActionLabel} disabled={compareActionsDisabled} onClick={() => navigate(`/products/${compareDecision.recommended!.id}`)}>
                        {t('pages.wishlist.selectOptions')}
                      </ShopButton>
                    );
                  })()
                ) : (
                  (() => {
                    const productName = compareProductName(compareDecision.recommended!);
                    const addActionLabel = `${t('pages.compare.checkoutPathCta')}: ${productName}`;
                    return (
                      <ShopButton type="primary" icon={<ShopIcon path={SI.cart} />} aria-label={addActionLabel} title={addActionLabel} disabled={compareActionsDisabled} onClick={() => addToCart(compareDecision.recommended!)}>
                        {t('pages.compare.checkoutPathCta')}
                      </ShopButton>
                    );
                  })()
                )}
              </section>
            ) : null}
            <div
              className="product-compare__table"
              role="region"
              aria-label={t('pages.compare.title')}
            >
              <div className="product-compare__tableContainer product-compare__tableScroll">
                <table
                  className="product-compare__tableMatrix"
                  style={{ minWidth: tableMinWidth }}
                >
                  <thead>
                    <tr>
                      <th
                        scope="col"
                        className="product-compare__tableCell product-compare__tableSticky"
                        data-label={compareAttributeHeader}
                      >
                        <span className="product-compare-page__text product-compare-page__text--strong product-compare__attribute">
                          {compareAttributeHeader}
                        </span>
                      </th>
                      {products.map((product) => {
                        const productName = compareProductName(product);
                        return (
                          <th
                            key={product.id}
                            scope="col"
                            className="product-compare__tableCell"
                            data-label={productName}
                          >
                            {productName}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row) => (
                      <tr
                        key={row.key}
                        className={row.isDifferent ? 'product-compare__row--different' : undefined}
                      >
                        <th
                          scope="row"
                          className="product-compare__tableCell product-compare__tableSticky"
                          data-label={compareAttributeHeader}
                        >
                          <span className="product-compare-page__text product-compare-page__text--strong product-compare__attribute">
                            {row.label}
                          </span>
                        </th>
                        {products.map((product) => (
                          <td
                            key={product.id}
                            className="product-compare__tableCell"
                            data-label={compareProductName(product)}
                          >
                            {row.render(product)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
};
