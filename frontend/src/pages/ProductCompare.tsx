import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, Image, message, Popconfirm, Rate, Space, Spin, Switch, Table, Tag, Typography } from 'antd';
import { CheckCircleOutlined, DeleteOutlined, FireOutlined, SettingOutlined, ShoppingCartOutlined, StarOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { cartApi, productApi } from '../api';
import { useLanguage } from '../i18n';
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
import './ProductCompare.css';

const { Title, Text } = Typography;

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
      message.error(t('pages.compare.loadFailed'));
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
      message.warning(t('pages.compare.staleDataWarning'));
      return;
    }
    if (product.stock !== undefined && product.stock <= 0) {
      message.error(t('pages.productDetail.insufficientStock'));
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
      message.success(t('messages.addCartSuccess'));
      dispatchDomEvent('shop:open-cart');
    } catch (error) {
      reportNonBlockingError('ProductCompare.addToCart', error);
      message.error(t('messages.addFailed'));
    }
  };

  const addDirectReadyProductsToCart = async () => {
    if (compareActionsDisabled) {
      message.warning(t('pages.compare.staleDataWarning'));
      return;
    }
    if (directReadyProducts.length === 0) {
      message.info(t('pages.compare.recommendationEmpty'));
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
          message.error(t('messages.addFailed'));
          return;
        }
        dispatchDomEvent('shop:cart-updated');
        message.success(t('pages.wishlist.addedAllToCart', { count: added }));
      } else {
        directReadyProducts.forEach((product) => {
          addGuestCartItem({ ...product, imageUrl: resolveCompareImage(product.imageUrl) }, 1, undefined, getPrice(product));
        });
        message.success(t('pages.wishlist.addedAllToCart', { count: directReadyProducts.length }));
      }
      dispatchDomEvent('shop:open-cart');
    } catch (error) {
      reportNonBlockingError('ProductCompare.addDirectReadyProductsToCart', error);
      message.error(t('messages.addFailed'));
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
        <Space size={6} wrap>
          <span>{specLabel}</span>
          {isDifferent ? <Tag color="red">{compareCopy.different}</Tag> : null}
        </Space>
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
    <Space size={6} wrap>
      <span>{label}</span>
      {isDifferent ? <Tag color="red">{compareCopy.different}</Tag> : null}
    </Space>
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
          <Image
            src={resolveCompareImage(product.imageUrl)}
            alt={compareProductName(product)}
            width={120}
            height={120}
            preview={false}
            fallback={compareImageFallback}
            className="product-compare__image"
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
        <Space direction="vertical" size={0}>
          <Text strong className="commerce-money" style={{ color: '#ee4d2d' }}>{formatMoney(getPrice(product))}</Text>
          {product.originalPrice && product.originalPrice > getPrice(product) ? (
            <Text delete type="secondary" className="commerce-money">{formatMoney(product.originalPrice)}</Text>
          ) : null}
        </Space>
      ),
    },
    {
      key: 'rating',
      label: renderAttributeLabel(t('pages.compare.rating'), ratingDifferent),
      isDifferent: ratingDifferent,
      render: (product: Product) => (
        <Space direction="vertical" size={0}>
          <Rate disabled allowHalf value={Number(product.averageRating || 0)} />
          <Text type="secondary">{t('pages.productList.positiveRate', { rate: (product.positiveRate || 0).toFixed(1), count: product.reviewCount || 0 })}</Text>
        </Space>
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
      render: (product: Product) => product.stock === undefined ? t('pages.productDetail.enough') : product.stock > 0 ? product.stock : <Tag color="red">{t('pages.productList.soldOut')}</Tag>,
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
          <Space direction="vertical">
            {needsSelection && !isSoldOut ? (
              <Button
                type="primary"
                icon={<SettingOutlined />}
                aria-label={selectActionLabel}
                title={selectActionLabel}
                disabled={compareActionsDisabled}
                onClick={() => navigate(`/products/${product.id}`)}
              >
                {t('pages.wishlist.selectOptions')}
              </Button>
            ) : (
              <Button
                type="primary"
                icon={<ShoppingCartOutlined />}
                className={isSoldOut ? 'product-compare__soldoutButton' : undefined}
                aria-label={addActionLabel}
                title={addActionLabel}
                onClick={() => addToCart(product)}
                disabled={isSoldOut || compareActionsDisabled}
              >
                {addActionText}
              </Button>
            )}
            <Button icon={<DeleteOutlined />} aria-label={removeActionLabel} title={removeActionLabel} onClick={() => removeProduct(product.id)}>
              {t('pages.compare.remove')}
            </Button>
          </Space>
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

  const dataSource = visibleRows.map((row) => ({
    key: row.key,
    attribute: row.label,
    isDifferent: row.isDifferent,
    ...Object.fromEntries(products.map((product) => [`product-${product.id}`, row.render(product)])),
  }));

  const compareAttributeHeader = t('pages.compare.attribute');

  const columns = [
    {
      title: compareAttributeHeader,
      dataIndex: 'attribute',
      key: 'attribute',
      fixed: 'left' as const,
      width: 150,
      onCell: () => ({ 'data-label': compareAttributeHeader } as React.TdHTMLAttributes<HTMLElement>),
      render: (value: React.ReactNode) => <Text strong className="product-compare__attribute">{value}</Text>,
    },
    ...products.map((product) => {
      const productName = compareProductName(product);
      return {
        title: productName,
        dataIndex: `product-${product.id}`,
        key: `product-${product.id}`,
        width: 240,
        onCell: () => ({ 'data-label': productName } as React.TdHTMLAttributes<HTMLElement>),
      };
    }),
  ];

  return (
    <div className="product-compare-page">
      <Card>
        <div className="product-compare__header">
          <div>
            <Title level={2} style={{ margin: 0 }}>{t('pages.compare.title')}</Title>
            <Text type="secondary">{t('pages.compare.subtitle', { count: selectedCompareCount })}</Text>
          </div>
          <Space wrap className="product-compare__headerActions">
            <Button
              type="primary"
              icon={<ShoppingCartOutlined />}
              disabled={directReadyProducts.length === 0 || compareActionsDisabled}
              aria-label={compareAddAllActionLabel}
              title={compareAddAllActionLabel}
              onClick={addDirectReadyProductsToCart}
            >
              {t('pages.wishlist.addAllToCart')}
            </Button>
            <Button aria-label={compareAddMoreActionLabel} title={compareAddMoreActionLabel} onClick={() => navigate('/products')}>{t('pages.compare.addMore')}</Button>
            <Popconfirm
              classNames={{ root: 'shop-mobile-popup-layer product-compare-clear-popconfirm' }}
              title={t('pages.compare.clearConfirm')}
              onConfirm={clearAll}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
              okButtonProps={{ danger: true, 'aria-label': compareClearActionLabel, title: compareClearActionLabel }}
              cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${compareClearActionLabel}`, title: `${t('common.cancel')}: ${compareClearActionLabel}` }}
            >
              <Button danger disabled={products.length === 0 && compareLoadAttemptCount === 0} aria-label={compareClearActionLabel} title={compareClearActionLabel}>{t('pages.compare.clear')}</Button>
            </Popconfirm>
          </Space>
        </div>
        {loading ? (
          <div
            className="product-compare__loading"
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label={t('common.loading')}
          >
            <Spin size="large" />
          </div>
        ) : compareLoadError && products.length === 0 ? (
          <div className="product-compare__loadError">
            <Alert
              type="error"
              showIcon
              message={t('pages.compare.loadErrorTitle')}
              description={t('pages.compare.loadErrorDescription', { count: compareLoadAttemptCount })}
              action={(
                <Space wrap>
                  <Button size="small" onClick={fetchComparedProducts} loading={loading}>
                    {t('common.retry')}
                  </Button>
                  <Button size="small" onClick={() => navigate('/products')}>
                    {t('pages.compare.browse')}
                  </Button>
                  <Button size="small" danger onClick={clearAll}>
                    {t('pages.compare.clear')}
                  </Button>
                </Space>
              )}
            />
          </div>
        ) : products.length === 0 ? (
          <Empty description={t('pages.compare.empty')}>
            <Button type="primary" aria-label={compareBrowseActionLabel} title={compareBrowseActionLabel} onClick={() => navigate('/products')}>{t('pages.compare.browse')}</Button>
          </Empty>
        ) : (
          <>
            {compareLoadError ? (
              <Alert
                className="product-compare__loadError"
                type="warning"
                showIcon
                message={t('pages.compare.loadErrorTitle')}
                description={t('pages.compare.staleDataWarning')}
                action={(
                  <Button size="small" onClick={fetchComparedProducts} loading={loading}>
                    {t('common.retry')}
                  </Button>
                )}
              />
            ) : null}
            <div className="product-compare__toolbar">
              <div className="product-compare__diff-summary">
                <Text strong>{compareCopy.detailDifferences}</Text>
                <Text type="secondary">
                  {differentRows.length > 0
                    ? compareCopy.summary(differentRows.length)
                    : compareCopy.noDifferences}
                </Text>
                {differentSpecNames.length > 0 ? (
                  <div className="product-compare__diff-tags">
                    {differentSpecNames.slice(0, 8).map((name) => <Tag key={name} color="red">{name}</Tag>)}
                  </div>
                ) : null}
              </div>
              <Space className="product-compare__difference-toggle">
                <Text>{compareCopy.onlyDifferent}</Text>
                <Switch
                  checked={showOnlyDifferences}
                  aria-label={compareDifferenceToggleLabel}
                  title={compareDifferenceToggleLabel}
                  onChange={setShowOnlyDifferences}
                />
              </Space>
            </div>
            <section className="product-compare__decision" aria-label={t('pages.compare.decisionTitle')}>
              <div className="product-compare__decisionCopy">
                <Text className="product-compare__eyebrow">{t('pages.compare.decisionEyebrow')}</Text>
                <Title level={4}>{t('pages.compare.decisionTitle')}</Title>
                <Text type="secondary">
                  {compareDecision.bestValue
                    ? t('pages.compare.decisionSubtitleBest', { name: compareProductName(compareDecision.bestValue) })
                    : t('pages.compare.decisionSubtitle')}
                </Text>
              </div>
              <div className="product-compare__decisionGrid">
                <div className="product-compare__decisionItem is-ok">
                  <CheckCircleOutlined />
                  <strong>{compareDecision.readyCount}</strong>
                  <span>{t('pages.compare.readyToBuy')}</span>
                </div>
                <div className="product-compare__decisionItem is-warm">
                  <FireOutlined />
                  <strong className="commerce-money">{compareDecision.bestValue ? formatMoney(getPrice(compareDecision.bestValue)) : '-'}</strong>
                  <span>{t('pages.compare.bestValue')}</span>
                </div>
                <div className="product-compare__decisionItem is-ok">
                  <StarOutlined />
                  <strong>{compareDecision.topRated ? Number(compareDecision.topRated.averageRating || 0).toFixed(1) : '-'}</strong>
                  <span>{t('pages.compare.topRated')}</span>
                </div>
                <div className={`product-compare__decisionItem ${compareDecision.lowStock ? 'is-risk' : 'is-ok'}`}>
                  <FireOutlined />
                  <strong>{compareDecision.lowStock}</strong>
                  <span>{t('pages.compare.lowStock')}</span>
                </div>
              </div>
            </section>
            <section className="product-compare__recommendation" aria-label={t('pages.compare.recommendationTitle')}>
              <div className="product-compare__recommendationMain">
                <Text className="product-compare__eyebrow">{t('pages.compare.recommendationEyebrow')}</Text>
                <Title level={4}>
                  {compareDecision.recommended
                    ? t('pages.compare.recommendationTitleWithName', { name: compareProductName(compareDecision.recommended) })
                    : t('pages.compare.recommendationTitle')}
                </Title>
                <Text type="secondary">
                  {compareDecision.recommended
                    ? t('pages.compare.recommendationSubtitle', {
                      price: formatMoney(getPrice(compareDecision.recommended)),
                      rating: Number(compareDecision.recommended.averageRating || 0).toFixed(1),
                    })
                    : t('pages.compare.recommendationEmpty')}
                </Text>
                <Space wrap>
                  {compareDecision.recommended ? (
                    (() => {
                      const recommended = compareDecision.recommended!;
                      const productName = compareProductName(recommended);
                      const selectActionLabel = `${t('pages.wishlist.selectOptions')}: ${productName}`;
                      const addActionLabel = `${t('pages.compare.addRecommended')}: ${productName}`;
                      return needsOptionSelection(recommended) ? (
                        <Button type="primary" icon={<SettingOutlined />} aria-label={selectActionLabel} title={selectActionLabel} disabled={compareActionsDisabled} onClick={() => navigate(`/products/${recommended.id}`)}>
                          {t('pages.wishlist.selectOptions')}
                        </Button>
                      ) : (
                        <Button type="primary" icon={<ShoppingCartOutlined />} aria-label={addActionLabel} title={addActionLabel} disabled={compareActionsDisabled} onClick={() => addToCart(recommended)}>
                          {t('pages.compare.addRecommended')}
                        </Button>
                      );
                    })()
                  ) : null}
                  {directReadyProducts.length > 1 ? (
                    <Button
                      icon={<ShoppingCartOutlined />}
                      aria-label={compareAddAllActionLabel}
                      title={compareAddAllActionLabel}
                      disabled={compareActionsDisabled}
                      onClick={addDirectReadyProductsToCart}
                    >
                      {t('pages.wishlist.addAllToCart')}
                    </Button>
                  ) : null}
                  <Button aria-label={compareAddMoreActionLabel} title={compareAddMoreActionLabel} onClick={() => navigate('/products')}>{t('pages.compare.addMore')}</Button>
                </Space>
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
                  <Text className="product-compare__eyebrow">{t('pages.compare.checkoutPathEyebrow')}</Text>
                  <Title level={4}>{t('pages.compare.checkoutPathTitle')}</Title>
                  <Text type="secondary">
                    {t('pages.compare.checkoutPathSubtitle', { name: compareProductName(compareDecision.recommended) })}
                  </Text>
                </div>
                <div className="product-compare__checkoutSteps">
                  <span className="is-ready"><CheckCircleOutlined /> {t('pages.compare.checkoutStepAvailable')}</span>
                  <span className={compareDecision.recommendedNeedsSelection ? 'is-warm' : 'is-ready'}>
                    {compareDecision.recommendedNeedsSelection ? <SettingOutlined /> : <CheckCircleOutlined />}
                    {compareDecision.recommendedNeedsSelection ? t('pages.compare.checkoutStepOptions') : t('pages.compare.checkoutStepNoOptions')}
                  </span>
                  <span className={compareDecision.recommendedLowStock ? 'is-risk' : 'is-ready'}>
                    {compareDecision.recommendedLowStock ? <FireOutlined /> : <CheckCircleOutlined />}
                    {compareDecision.recommendedLowStock ? t('pages.compare.checkoutStepLowStock') : t('pages.compare.checkoutStepStock')}
                  </span>
                </div>
                {compareDecision.recommendedNeedsSelection ? (
                  (() => {
                    const productName = compareProductName(compareDecision.recommended!);
                    const selectActionLabel = `${t('pages.wishlist.selectOptions')}: ${productName}`;
                    return (
                      <Button type="primary" icon={<SettingOutlined />} aria-label={selectActionLabel} title={selectActionLabel} disabled={compareActionsDisabled} onClick={() => navigate(`/products/${compareDecision.recommended!.id}`)}>
                        {t('pages.wishlist.selectOptions')}
                      </Button>
                    );
                  })()
                ) : (
                  (() => {
                    const productName = compareProductName(compareDecision.recommended!);
                    const addActionLabel = `${t('pages.compare.checkoutPathCta')}: ${productName}`;
                    return (
                      <Button type="primary" icon={<ShoppingCartOutlined />} aria-label={addActionLabel} title={addActionLabel} disabled={compareActionsDisabled} onClick={() => addToCart(compareDecision.recommended!)}>
                        {t('pages.compare.checkoutPathCta')}
                      </Button>
                    );
                  })()
                )}
              </section>
            ) : null}
            <Table
              className="product-compare__table"
              bordered
              pagination={false}
              columns={columns}
              dataSource={dataSource}
              rowClassName={(record) => record.isDifferent ? 'product-compare__row--different' : ''}
              scroll={{ x: 150 + products.length * 240 }}
            />
          </>
        )}
      </Card>
    </div>
  );
};

export default ProductCompare;
