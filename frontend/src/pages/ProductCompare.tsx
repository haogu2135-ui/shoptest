import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { ShopIcon, SI } from '../components/ShopIcon';
import ShopRate from '../components/ShopRate';
import ShopSwitch from '../components/ShopSwitch';
import ShopPopconfirm from '../components/ShopPopconfirm';
import { Link, useNavigate } from 'react-router-dom';
import { cartApi, productApi } from '../api';
import { useLanguage } from '../i18n';
import { usePageTitle } from '../hooks/usePageTitle';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useMarket } from '../hooks/useMarket';
import type { ProductPublic as Product } from '../types';
import { addGuestCartItem } from '../utils/guestCart';
import { localizeProduct } from '../utils/localizedProduct';
import { clearCompareProducts, readCompareProductIds, removeCompareProduct } from '../utils/productCompare';
import { needsOptionSelection } from '../utils/productOptions';
import { productImageFallback, resolveProductImage } from '../utils/productMedia';
import { dispatchDomEvent } from '../utils/domEvents';
import { getLocalStorageItem } from '../utils/safeStorage';
import { allSettledWithConcurrency } from '../utils/asyncBatch';
import { formatProductSpecLabel } from '../utils/productSpecLabels';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import PageError from '../components/PageError';
import PageEmpty from '../components/PageEmpty';
import './ProductCompare.css';
import ShopButton from '../components/ShopButton';

import ShopTag from '../components/ShopTag';
import ShopAlert from '../components/ShopAlert';
const compareImageFallback = productImageFallback;
const resolveCompareImage = resolveProductImage;

const getPrice = (product: Product) => product.effectivePrice ?? product.price;
const HIDDEN_SPEC_PREFIXES = ['options.', 'i18n.', 'bundle.'];
const PRIORITY_SPEC_KEYS = [
  'Pet Size',
  'Capacity',
  'Material',
  'Color',
  'Size',
  'Weight',
  'Volume',
  'Pack',
  'Filter',
  'Formula',
  'Closure',
  'Care',
  'Flavor',
  'Life Stage',
  'Coat Type',
];

type CompareRow = {
  key: string;
  label: React.ReactNode;
  rawLabel?: string;
  isDifferent?: boolean;
  alwaysVisible?: boolean;
  render: (product: Product) => React.ReactNode;
};

const isHiddenSpecKey = (key: string) => {
  const normalized = key.trim().toLowerCase();
  return HIDDEN_SPEC_PREFIXES.some((prefix) => normalized.startsWith(prefix));
};

const normalizeSpecValue = (value?: string | null) =>
  String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();

const valuesDiffer = (products: Product[], getValue: (product: Product) => string | number | undefined | null) =>
  products.length > 1 && new Set(products.map((product) => normalizeSpecValue(String(getValue(product) ?? '')))).size > 1;

const getSpecValue = (product: Product, specKey: string) => {
  const normalizedKey = specKey.trim().toLowerCase();
  const matchedEntry = Object.entries(product.specifications || {}).find(([key]) =>
    !isHiddenSpecKey(key) && key.trim().toLowerCase() === normalizedKey
  );
  return matchedEntry ? String(matchedEntry[1] || '').trim() : '';
};

const ProductCompare: React.FC = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  usePageTitle(t('pages.compare.title'));
  useDocumentMeta({
    title: t('pages.compare.title'),
    description: t('common.siteDescription'),
    path: '/compare',
    type: 'website',
    noIndex: true,
    siteName: t('common.siteTitle'),
  });
  const { formatMoney } = useMarket();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [compareLoadError, setCompareLoadError] = useState(false);
  const [compareLoadAttemptCount, setCompareLoadAttemptCount] = useState(0);
  const [showOnlyDifferences, setShowOnlyDifferences] = useState(false);
  const compareCopy = useMemo(() => ({
    detailDifferences: t('pages.compare.detailDifferences'),
    different: t('pages.compare.different'),
    missing: t('pages.compare.missing'),
    noDifferences: t('pages.compare.noDifferences'),
    onlyDifferent: t('pages.compare.onlyDifferent'),
    summary: (count: number) => t('pages.compare.summary', { count }),
  }), [t]);
  const compareProductName = useCallback((product: Product) =>
    (product.name || '').trim() || t('pages.profile.productFallback', { id: product.id }), [t]);

  const fetchComparedProducts = useCallback(async () => {
    const ids = readCompareProductIds();
    setCompareLoadAttemptCount(ids.length);
    if (ids.length === 0) {
      setProducts([]);
      setCompareLoadError(false);
      return;
    }
    try {
      setLoading(true);
      const response = await productApi.getByIds(ids);
      const nextProducts = response.data.map((product) => localizeProduct(product, language));
      ids
        .filter((id) => !nextProducts.some((product) => product.id === id))
        .forEach((id) => removeCompareProduct(id));
      setProducts(nextProducts);
      setCompareLoadError(false);
    } catch (error) {
      reportNonBlockingError('ProductCompare.fetchComparedProducts', error);
      setCompareLoadError(true);
      announceAccessibleMessage(t('pages.compare.loadFailed'), 'error');
    } finally {
      setLoading(false);
    }
  }, [language, t]);

  useEffect(() => {
    fetchComparedProducts();
    const refreshComparedProducts = () => fetchComparedProducts();
    const refreshComparedProductsFromStorage = (event: StorageEvent) => {
      if (event.key === 'shop-product-compare') {
        fetchComparedProducts();
      }
    };
    window.addEventListener('shop:compare-updated', refreshComparedProducts);
    window.addEventListener('storage', refreshComparedProductsFromStorage);
    return () => {
      window.removeEventListener('shop:compare-updated', refreshComparedProducts);
      window.removeEventListener('storage', refreshComparedProductsFromStorage);
    };
  }, [fetchComparedProducts]);

  const comparedIds = useMemo(() => products.map((product) => product.id), [products]);
  const directReadyProducts = useMemo(
    () => products.filter((product) => (product.stock === undefined || product.stock > 0) && !needsOptionSelection(product)),
    [products],
  );
  const compareDecision = useMemo(() => {
    const readyProducts = products.filter((product) => product.stock === undefined || product.stock > 0);
    const bestValue = readyProducts
      .slice()
      .sort((left, right) => getPrice(left) - getPrice(right))[0];
    const topRated = readyProducts
      .slice()
      .sort((left, right) => Number(right.averageRating || 0) - Number(left.averageRating || 0))[0];
    const lowStock = readyProducts.filter((product) => product.stock !== undefined && product.stock > 0 && product.stock <= 5).length;
    const needsSelection = readyProducts.filter(needsOptionSelection).length;
    const priceSpread = readyProducts.length > 1
      ? Math.max(...readyProducts.map(getPrice)) - Math.min(...readyProducts.map(getPrice))
      : 0;
    const recommended = readyProducts
      .slice()
      .sort((left, right) => {
        const ratingDelta = Number(right.averageRating || 0) - Number(left.averageRating || 0);
        const priceDelta = getPrice(left) - getPrice(right);
        const stockDelta = (right.stock ?? 999) - (left.stock ?? 999);
        return ratingDelta * 8 + priceDelta * 0.08 + stockDelta * 0.01;
      })[0];
    const recommendedNeedsSelection = recommended ? needsOptionSelection(recommended) : false;
    const recommendedLowStock = recommended?.stock !== undefined && recommended.stock > 0 && recommended.stock <= 5;
    return {
      readyCount: readyProducts.length,
      bestValue,
      topRated,
      lowStock,
      needsSelection,
      priceSpread,
      recommended,
      recommendedNeedsSelection,
      recommendedLowStock,
    };
  }, [products]);
  const compareActionsDisabled = compareLoadError;

  const removeProduct = (productId: number) => {
    removeCompareProduct(productId);
    setProducts((current) => current.filter((product) => product.id !== productId));
  };

  const clearAll = () => {
    clearCompareProducts();
    setProducts([]);
    setCompareLoadAttemptCount(0);
    setCompareLoadError(false);
  };

  const addToCart = async (product: Product) => {
    if (compareActionsDisabled) {
      announceAccessibleMessage(t('pages.compare.staleDataWarning'), 'warning');
      return;
    }
    if (product.stock !== undefined && product.stock <= 0) {
      announceAccessibleMessage(t('pages.productDetail.insufficientStock'), 'error');
      return;
    }
    const token = getLocalStorageItem('token');
    try {
      if (token) {
        await cartApi.addItem(0, product.id, 1);
        dispatchDomEvent('shop:cart-updated');
      } else {
        addGuestCartItem({ ...product, imageUrl: resolveCompareImage(product.imageUrl) }, 1, undefined, getPrice(product));
      }
      announceAccessibleMessage(t('messages.addCartSuccess'), 'success');
      dispatchDomEvent('shop:open-cart');
    } catch (error) {
      reportNonBlockingError('ProductCompare.addToCart', error);
      announceAccessibleMessage(t('messages.addFailed'), 'error');
    }
  };

  const addDirectReadyProductsToCart = async () => {
    if (compareActionsDisabled) {
      announceAccessibleMessage(t('pages.compare.staleDataWarning'), 'warning');
      return;
    }
    if (directReadyProducts.length === 0) {
      announceAccessibleMessage(t('pages.compare.recommendationEmpty'), 'info');
      return;
    }
    const token = getLocalStorageItem('token');
    try {
      if (token) {
        const results = await allSettledWithConcurrency(
          directReadyProducts,
          (product) => cartApi.addItem(0, product.id, 1),
        );
        const added = results.filter((result) => result.status === 'fulfilled').length;
        if (added === 0) {
          announceAccessibleMessage(t('messages.addFailed'), 'error');
          return;
        }
        dispatchDomEvent('shop:cart-updated');
        announceAccessibleMessage(t('pages.wishlist.addedAllToCart', { count: added }), 'success');
      } else {
        directReadyProducts.forEach((product) => {
          addGuestCartItem({ ...product, imageUrl: resolveCompareImage(product.imageUrl) }, 1, undefined, getPrice(product));
        });
        announceAccessibleMessage(t('pages.wishlist.addedAllToCart', { count: directReadyProducts.length }), 'success');
      }
      dispatchDomEvent('shop:open-cart');
    } catch (error) {
      reportNonBlockingError('ProductCompare.addDirectReadyProductsToCart', error);
      announceAccessibleMessage(t('messages.addFailed'), 'error');
    }
  };

  const specKeys = useMemo(() => {
    const keyByNormalized = new Map<string, string>();
    products.forEach((product) => {
      Object.keys(product.specifications || {}).forEach((rawKey) => {
        const key = rawKey.trim();
        if (!key || isHiddenSpecKey(key)) return;
        const normalized = key.toLowerCase();
        if (!keyByNormalized.has(normalized)) {
          keyByNormalized.set(normalized, key);
        }
      });
    });
    return Array.from(keyByNormalized.values()).sort((left, right) => {
      const leftPriority = PRIORITY_SPEC_KEYS.findIndex((key) => key.toLowerCase() === left.toLowerCase());
      const rightPriority = PRIORITY_SPEC_KEYS.findIndex((key) => key.toLowerCase() === right.toLowerCase());
      if (leftPriority !== -1 || rightPriority !== -1) {
        return (leftPriority === -1 ? Number.MAX_SAFE_INTEGER : leftPriority)
          - (rightPriority === -1 ? Number.MAX_SAFE_INTEGER : rightPriority);
      }
      return left.localeCompare(right);
    });
  }, [products]);

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
          <span className="product-compare-page__text product-compare-page__text--strong commerce-money" style={{ color: '#ee4d2d' }}>{formatMoney(getPrice(product))}</span>
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
  const compareAddAllActionLabel = `${t('pages.wishlist.addAllToCart')}: ${directReadyProducts.length}`;
  const selectedCompareCount = compareLoadError && products.length === 0 ? compareLoadAttemptCount : comparedIds.length;
  const compareAddMoreActionLabel = `${t('pages.compare.addMore')}: ${selectedCompareCount}`;
  const compareClearActionLabel = `${t('pages.compare.clear')}: ${products.length}`;
  const compareBrowseActionLabel = t('pages.compare.browse');
  const compareDifferenceToggleLabel = `${compareCopy.onlyDifferent}: ${differentRows.length}`;

  const compareAttributeHeader = t('pages.compare.attribute');
  const tableMinWidth = 150 + products.length * 240;

  return (
    <div className="product-compare-page">
      <section className="product-compare-page__shell" aria-label={t('pages.compare.title')}>
        <div className="product-compare__header">
          <div>
            <h1 className="product-compare-page__title" style={{ margin: 0 }}>{t('pages.compare.title')}</h1>
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

export default ProductCompare;
