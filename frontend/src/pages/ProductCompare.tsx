import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Empty, Image, message, Rate, Space, Spin, Switch, Table, Tag, Typography } from 'antd';
import { CheckCircleOutlined, DeleteOutlined, FireOutlined, SettingOutlined, ShoppingCartOutlined, StarOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { apiBaseUrl, cartApi, productApi } from '../api';
import { useLanguage } from '../i18n';
import { useMarket } from '../hooks/useMarket';
import type { Product } from '../types';
import { addGuestCartItem } from '../utils/guestCart';
import { localizeProduct } from '../utils/localizedProduct';
import { clearCompareProducts, readCompareProductIds, removeCompareProduct } from '../utils/productCompare';
import './ProductCompare.css';

const { Title, Text } = Typography;

const compareImageFallback = 'https://images.unsplash.com/photo-1601758125946-6ec2ef64daf8?auto=format&fit=crop&w=900&q=80';
const resolveCompareImage = (imageUrl?: string) => {
  if (!imageUrl) return compareImageFallback;
  if (/^(https?:|data:|blob:)/i.test(imageUrl)) {
    return imageUrl;
  }
  return `${apiBaseUrl}${imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`}`;
};

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

const productRequiresSelection = (product: Product) => {
  const specs = product.specifications || {};
  const hasConfiguredOptions = Object.keys(specs).some((key) => key.startsWith('options.'));
  const hasLegacyOptions = (Array.isArray(product.sizes) && product.sizes.length > 0) || (Array.isArray(product.colors) && product.colors.length > 0);
  const rawVariants = (product as any).variants;
  const hasVariants = Array.isArray(rawVariants)
    ? rawVariants.length > 0
    : typeof rawVariants === 'string' && rawVariants.trim().length > 0;
  return hasConfiguredOptions || hasLegacyOptions || hasVariants;
};

const ProductCompare: React.FC = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { formatMoney } = useMarket();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [showOnlyDifferences, setShowOnlyDifferences] = useState(false);
  const compareCopy = useMemo(() => ({
    detailDifferences: t('pages.compare.detailDifferences'),
    different: t('pages.compare.different'),
    missing: t('pages.compare.missing'),
    noDifferences: t('pages.compare.noDifferences'),
    onlyDifferent: t('pages.compare.onlyDifferent'),
    summary: (count: number) => t('pages.compare.summary', { count }),
  }), [t]);

  const fetchComparedProducts = useCallback(async () => {
    const ids = readCompareProductIds();
    if (ids.length === 0) {
      setProducts([]);
      return;
    }
    try {
      setLoading(true);
      const responses = await Promise.allSettled(ids.map((id) => productApi.getById(id)));
      const nextProducts = responses.reduce<Product[]>((acc, result) => {
        if (result.status === 'fulfilled') {
          acc.push(localizeProduct(result.value.data, language));
        }
        return acc;
      }, []);
      ids
        .filter((id) => !nextProducts.some((product) => product.id === id))
        .forEach((id) => removeCompareProduct(id));
      setProducts(nextProducts);
    } catch {
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
  const compareDecision = useMemo(() => {
    const readyProducts = products.filter((product) => product.stock === undefined || product.stock > 0);
    const bestValue = readyProducts
      .slice()
      .sort((left, right) => getPrice(left) - getPrice(right))[0];
    const topRated = readyProducts
      .slice()
      .sort((left, right) => Number(right.averageRating || right.rating || 0) - Number(left.averageRating || left.rating || 0))[0];
    const lowStock = readyProducts.filter((product) => product.stock !== undefined && product.stock > 0 && product.stock <= 5).length;
    const needsSelection = readyProducts.filter(productRequiresSelection).length;
    const priceSpread = readyProducts.length > 1
      ? Math.max(...readyProducts.map(getPrice)) - Math.min(...readyProducts.map(getPrice))
      : 0;
    const recommended = readyProducts
      .slice()
      .sort((left, right) => {
        const ratingDelta = Number(right.averageRating || right.rating || 0) - Number(left.averageRating || left.rating || 0);
        const priceDelta = getPrice(left) - getPrice(right);
        const stockDelta = (right.stock ?? 999) - (left.stock ?? 999);
        return ratingDelta * 8 + priceDelta * 0.08 + stockDelta * 0.01;
      })[0];
    const recommendedNeedsSelection = recommended ? productRequiresSelection(recommended) : false;
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

  const removeProduct = (productId: number) => {
    removeCompareProduct(productId);
    setProducts((current) => current.filter((product) => product.id !== productId));
  };

  const clearAll = () => {
    clearCompareProducts();
    setProducts([]);
  };

  const addToCart = async (product: Product) => {
    if (product.stock !== undefined && product.stock <= 0) {
      message.error(t('pages.productDetail.insufficientStock'));
      return;
    }
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    try {
      if (token && userId) {
        await cartApi.addItem(Number(userId), product.id, 1);
        window.dispatchEvent(new Event('shop:cart-updated'));
      } else {
        addGuestCartItem({ ...product, imageUrl: resolveCompareImage(product.imageUrl) }, 1, undefined, getPrice(product));
      }
      message.success(t('messages.addCartSuccess'));
      window.dispatchEvent(new Event('shop:open-cart'));
    } catch {
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
    return {
      key: `spec-${specKey}`,
      rawLabel: specKey,
      label: (
        <Space size={6} wrap>
          <span>{specKey}</span>
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
  }), [compareCopy.different, compareCopy.missing, products, specKeys]);

  const renderAttributeLabel = (label: React.ReactNode, isDifferent?: boolean) => (
    <Space size={6} wrap>
      <span>{label}</span>
      {isDifferent ? <Tag color="red">{compareCopy.different}</Tag> : null}
    </Space>
  );

  const priceDifferent = valuesDiffer(products, (product) => getPrice(product));
  const ratingDifferent = valuesDiffer(products, (product) => product.averageRating || product.rating || 0);
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
            alt={product.name}
            width={120}
            height={120}
            preview={false}
            fallback={compareImageFallback}
            style={{ objectFit: 'cover', borderRadius: 8 }}
          />
        </Link>
      ),
    },
    {
      key: 'name',
      label: t('pages.compare.product'),
      alwaysVisible: true,
      render: (product: Product) => <Link className="product-compare__productLink" to={`/products/${product.id}`}>{product.name}</Link>,
    },
    {
      key: 'price',
      label: renderAttributeLabel(t('pages.compare.price'), priceDifferent),
      isDifferent: priceDifferent,
      render: (product: Product) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ color: '#ee4d2d' }}>{formatMoney(getPrice(product))}</Text>
          {product.originalPrice && product.originalPrice > getPrice(product) ? (
            <Text delete type="secondary">{formatMoney(product.originalPrice)}</Text>
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
          <Rate disabled allowHalf value={Number(product.averageRating || product.rating || 0)} />
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
        const needsSelection = productRequiresSelection(product);
        return (
          <Space direction="vertical">
            {needsSelection && !isSoldOut ? (
              <Button
                type="primary"
                icon={<SettingOutlined />}
                onClick={() => navigate(`/products/${product.id}`)}
              >
                {t('pages.wishlist.selectOptions')}
              </Button>
            ) : (
              <Button
                type="primary"
                icon={<ShoppingCartOutlined />}
                className={isSoldOut ? 'product-compare__soldoutButton' : undefined}
                onClick={() => addToCart(product)}
                disabled={isSoldOut}
              >
                {isSoldOut ? t('pages.productList.soldOut') : t('pages.productList.addToCart')}
              </Button>
            )}
            <Button icon={<DeleteOutlined />} onClick={() => removeProduct(product.id)}>
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

  const dataSource = visibleRows.map((row) => ({
    key: row.key,
    attribute: row.label,
    isDifferent: row.isDifferent,
    ...Object.fromEntries(products.map((product) => [`product-${product.id}`, row.render(product)])),
  }));

  const columns = [
    {
      title: t('pages.compare.attribute'),
      dataIndex: 'attribute',
      key: 'attribute',
      fixed: 'left' as const,
      width: 150,
      render: (value: React.ReactNode) => <Text strong className="product-compare__attribute">{value}</Text>,
    },
    ...products.map((product) => ({
      title: product.name,
      dataIndex: `product-${product.id}`,
      key: `product-${product.id}`,
      width: 240,
    })),
  ];

  return (
    <div className="product-compare-page" style={{ width: 'min(1200px, calc(100% - 24px))', margin: '0 auto', padding: '24px 0' }}>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
          <div>
            <Title level={2} style={{ margin: 0 }}>{t('pages.compare.title')}</Title>
            <Text type="secondary">{t('pages.compare.subtitle', { count: comparedIds.length })}</Text>
          </div>
          <Space wrap>
            <Button onClick={() => navigate('/products')}>{t('pages.compare.addMore')}</Button>
            <Button danger disabled={products.length === 0} onClick={clearAll}>{t('pages.compare.clear')}</Button>
          </Space>
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
        ) : products.length === 0 ? (
          <Empty description={t('pages.compare.empty')}>
            <Button type="primary" onClick={() => navigate('/products')}>{t('pages.compare.browse')}</Button>
          </Empty>
        ) : (
          <>
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
                <Switch checked={showOnlyDifferences} onChange={setShowOnlyDifferences} />
              </Space>
            </div>
            <section className="product-compare__decision" aria-label={t('pages.compare.decisionTitle')}>
              <div className="product-compare__decisionCopy">
                <Text className="product-compare__eyebrow">{t('pages.compare.decisionEyebrow')}</Text>
                <Title level={4}>{t('pages.compare.decisionTitle')}</Title>
                <Text type="secondary">
                  {compareDecision.bestValue
                    ? t('pages.compare.decisionSubtitleBest', { name: compareDecision.bestValue.name })
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
                  <strong>{compareDecision.bestValue ? formatMoney(getPrice(compareDecision.bestValue)) : '-'}</strong>
                  <span>{t('pages.compare.bestValue')}</span>
                </div>
                <div className="product-compare__decisionItem is-ok">
                  <StarOutlined />
                  <strong>{compareDecision.topRated ? Number(compareDecision.topRated.averageRating || compareDecision.topRated.rating || 0).toFixed(1) : '-'}</strong>
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
                    ? t('pages.compare.recommendationTitleWithName', { name: compareDecision.recommended.name })
                    : t('pages.compare.recommendationTitle')}
                </Title>
                <Text type="secondary">
                  {compareDecision.recommended
                    ? t('pages.compare.recommendationSubtitle', {
                      price: formatMoney(getPrice(compareDecision.recommended)),
                      rating: Number(compareDecision.recommended.averageRating || compareDecision.recommended.rating || 0).toFixed(1),
                    })
                    : t('pages.compare.recommendationEmpty')}
                </Text>
                <Space wrap>
                  {compareDecision.recommended ? (
                    productRequiresSelection(compareDecision.recommended) ? (
                      <Button type="primary" icon={<SettingOutlined />} onClick={() => navigate(`/products/${compareDecision.recommended!.id}`)}>
                        {t('pages.wishlist.selectOptions')}
                      </Button>
                    ) : (
                      <Button type="primary" icon={<ShoppingCartOutlined />} onClick={() => addToCart(compareDecision.recommended!)}>
                        {t('pages.compare.addRecommended')}
                      </Button>
                    )
                  ) : null}
                  <Button onClick={() => navigate('/products')}>{t('pages.compare.addMore')}</Button>
                </Space>
              </div>
              <div className="product-compare__riskGrid">
                <div>
                  <strong>{formatMoney(compareDecision.priceSpread)}</strong>
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
                    {t('pages.compare.checkoutPathSubtitle', { name: compareDecision.recommended.name })}
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
                  <Button type="primary" icon={<SettingOutlined />} onClick={() => navigate(`/products/${compareDecision.recommended!.id}`)}>
                    {t('pages.wishlist.selectOptions')}
                  </Button>
                ) : (
                  <Button type="primary" icon={<ShoppingCartOutlined />} onClick={() => addToCart(compareDecision.recommended!)}>
                    {t('pages.compare.checkoutPathCta')}
                  </Button>
                )}
              </section>
            ) : null}
            <Table
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
