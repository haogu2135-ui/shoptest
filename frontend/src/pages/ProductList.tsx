import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, Row, Col, Button, Input, Select, Pagination, Tag, message, Empty, Spin, Typography, Slider, Checkbox, Modal, Space } from 'antd';
import { BarChartOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { productApi, cartApi, categoryApi } from '../api';
import type { Product, Category, ProductVariant } from '../types';
import { buildCategoryTree, flattenCategoryTree, getLocalizedCategoryValue } from '../utils/categoryTree';
import { useLanguage } from '../i18n';
import { useMarket } from '../hooks/useMarket';
import { localizeProduct } from '../utils/localizedProduct';
import { addGuestCartItem } from '../utils/guestCart';
import { buildBundleSpecs, getBundleInfo } from '../utils/bundle';
import { addCompareProduct, isProductCompared, MAX_COMPARE_ITEMS } from '../utils/productCompare';

const { Text } = Typography;
const SEARCH_HISTORY_KEY = 'shop-product-search-history';
const MAX_SEARCH_HISTORY = 6;
const DEFAULT_PRICE_RANGE: [number, number] = [0, 10000];

type OptionGroup = {
  name: string;
  values: string[];
};

const splitOptionValues = (value: unknown) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const getProductOptionGroups = (product?: Product | null): OptionGroup[] => {
  if (!product) return [];
  const specs = product.specifications || {};
  const configured = Object.entries(specs)
    .filter(([key]) => key.startsWith('options.'))
    .map(([key, value]) => ({
      name: key.replace(/^options\./, ''),
      values: splitOptionValues(value),
    }))
    .filter((group) => group.name && group.values.length > 0);

  if (configured.length > 0) return configured;

  const fallback: OptionGroup[] = [];
  if (Array.isArray(product.sizes) && product.sizes.length > 0) fallback.push({ name: 'Size', values: product.sizes });
  if (Array.isArray(product.colors) && product.colors.length > 0) fallback.push({ name: 'Color', values: product.colors });
  return fallback;
};

const getProductVariants = (product?: Product | null): ProductVariant[] => {
  if (!product) return [];
  const rawVariants = (product as any).variants;
  if (Array.isArray(rawVariants)) return rawVariants;
  if (typeof rawVariants !== 'string' || !rawVariants.trim()) return [];
  try {
    const parsed = JSON.parse(rawVariants);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const readSearchHistory = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean).slice(0, MAX_SEARCH_HISTORY) : [];
  } catch {
    return [];
  }
};

const writeSearchHistory = (history: string[]) => {
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_SEARCH_HISTORY)));
};

const ProductList: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState(searchParams.get('keyword') || '');
  const [categoryId, setCategoryId] = useState<number | undefined>(
    searchParams.get('categoryId') ? Number(searchParams.get('categoryId')) : undefined
  );
  const [sortBy, setSortBy] = useState<string>('default');
  const [priceRange, setPriceRange] = useState<[number, number]>(DEFAULT_PRICE_RANGE);
  const [petSizes, setPetSizes] = useState<string[]>([]);
  const [materials, setMaterials] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [quickAddProduct, setQuickAddProduct] = useState<Product | null>(null);
  const [quickAddOptions, setQuickAddOptions] = useState<Record<string, string>>({});
  const [searchHistory, setSearchHistory] = useState<string[]>(() => readSearchHistory());
  const [currentPage, setCurrentPage] = useState(1);
  const { t, language } = useLanguage();
  const { formatMoney } = useMarket();
  const pageSize = 12;
  const getPrice = (product: Product) => product.effectivePrice ?? product.price;
  const getDiscountPercent = (product: Product) => product.effectiveDiscountPercent || product.discount || 0;
  const getPositiveRate = (product: Product) => product.positiveRate ?? 0;
  const activeFilterCount = [
    priceRange[0] !== DEFAULT_PRICE_RANGE[0] || priceRange[1] !== DEFAULT_PRICE_RANGE[1],
    petSizes.length > 0,
    materials.length > 0,
    colors.length > 0,
  ].filter(Boolean).length;

  useEffect(() => {
    categoryApi.getAll().then(res => setCategories(res.data)).catch(() => {});
  }, []);

  const categoryTree = useMemo(() => buildCategoryTree(categories), [categories]);
  const categoryRows = useMemo(() => flattenCategoryTree(categoryTree), [categoryTree]);
  const quickAddOptionGroups = useMemo(() => getProductOptionGroups(quickAddProduct), [quickAddProduct]);
  const quickAddVariants = useMemo(() => getProductVariants(quickAddProduct), [quickAddProduct]);
  const quickAddBundleInfo = useMemo(() => getBundleInfo(quickAddProduct), [quickAddProduct]);
  const quickAddVariant = useMemo(() => {
    if (!quickAddVariants.length) return undefined;
    return quickAddVariants.find((variant) =>
      Object.entries(variant.options || {}).every(([key, value]) => quickAddOptions[key] === value),
    );
  }, [quickAddOptions, quickAddVariants]);

  const fetchProducts = useCallback(async (kw?: string, cid?: number) => {
    try {
      setLoading(true);
      const res = await productApi.getAll(kw || undefined, cid);
      setProducts(res.data.map((product) => localizeProduct(product, language)));
      setCurrentPage(1);
    } catch {
      message.error(t('pages.productList.fetchFailed'));
    } finally {
      setLoading(false);
    }
  }, [language, t]);

  useEffect(() => {
    const kw = searchParams.get('keyword') || '';
    const cid = searchParams.get('categoryId') ? Number(searchParams.get('categoryId')) : undefined;
    setKeyword(kw);
    setCategoryId(cid);
    fetchProducts(kw, cid);
  }, [fetchProducts, searchParams, language]);

  const handleSearch = (value: string) => {
    const trimmed = value.trim();
    if (trimmed) {
      const nextHistory = [trimmed, ...searchHistory.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_SEARCH_HISTORY);
      setSearchHistory(nextHistory);
      writeSearchHistory(nextHistory);
    }
    const params = new URLSearchParams();
    if (trimmed) params.set('keyword', trimmed);
    if (categoryId) params.set('categoryId', categoryId.toString());
    navigate(`/products${params.toString() ? '?' + params.toString() : ''}`);
  };

  const clearSearchHistory = () => {
    setSearchHistory([]);
    writeSearchHistory([]);
  };

  const handleCompare = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    const result = addCompareProduct(product);
    if (result.status === 'full') {
      message.warning(t('pages.productList.compareFull', { count: MAX_COMPARE_ITEMS }));
      return;
    }
    message.success(result.status === 'exists' ? t('pages.productList.compareExists') : t('pages.productList.compareAdded'));
    navigate('/compare');
  };

  const resetFilters = () => {
    setPriceRange(DEFAULT_PRICE_RANGE);
    setPetSizes([]);
    setMaterials([]);
    setColors([]);
    setCurrentPage(1);
  };

  const handleCategoryChange = (cid: number | undefined) => {
    setCategoryId(cid);
    const params = new URLSearchParams();
    if (keyword) params.set('keyword', keyword);
    if (cid) params.set('categoryId', cid.toString());
    navigate(`/products${params.toString() ? '?' + params.toString() : ''}`);
  };

  const openQuickAdd = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    setQuickAddProduct(product);
    setQuickAddOptions({});
  };

  const submitQuickAdd = async () => {
    if (!quickAddProduct) return;
    const missingOption = quickAddOptionGroups.find((group) => !quickAddOptions[group.name]);
    if (missingOption) {
      message.warning(t('pages.productDetail.selectOption', { option: missingOption.name }));
      return;
    }
    if (quickAddVariants.length > 0 && !quickAddVariant) {
      message.warning(t('pages.productDetail.variantUnavailable'));
      return;
    }
    const selectedStock = quickAddVariant?.stock ?? quickAddProduct.stock;
    if (selectedStock !== undefined && selectedStock <= 0) {
      message.error(t('pages.productDetail.insufficientStock'));
      return;
    }
    const bundleInfo = getBundleInfo(quickAddProduct);
    if (bundleInfo) {
      const token = localStorage.getItem('token');
      const userId = localStorage.getItem('userId');
      const selectedSpecs = buildBundleSpecs(quickAddProduct, quickAddOptions, quickAddVariant?.sku);
      try {
        if (token && userId) {
          await cartApi.addItem(Number(userId), quickAddProduct.id, 1, selectedSpecs);
        } else {
          addGuestCartItem(quickAddProduct, 1, selectedSpecs, bundleInfo.price);
        }
        message.success(t('messages.addCartSuccess'));
        setQuickAddProduct(null);
        window.dispatchEvent(new Event('shop:cart-updated'));
        window.dispatchEvent(new Event('shop:open-cart'));
      } catch {
        message.error(t('messages.addFailed'));
      }
      return;
    }
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    const selectedSpecs = quickAddOptionGroups.length
      ? JSON.stringify({
        ...quickAddOptions,
        ...(quickAddVariant?.sku ? { _variantSku: quickAddVariant.sku } : {}),
      })
      : undefined;
    const selectedPrice = quickAddVariant?.price ?? getPrice(quickAddProduct);
    try {
      if (token && userId) {
        await cartApi.addItem(Number(userId), quickAddProduct.id, 1, selectedSpecs);
      } else {
        addGuestCartItem(quickAddProduct, 1, selectedSpecs, selectedPrice);
      }
      message.success(t('messages.addCartSuccess'));
      setQuickAddProduct(null);
      window.dispatchEvent(new Event('shop:cart-updated'));
      window.dispatchEvent(new Event('shop:open-cart'));
    } catch {
      message.error(t('messages.addFailed'));
    }
  };

  const filteredProducts = products.filter((product) => {
    const price = getPrice(product);
    const specs = product.specifications || {};
    const specText = Object.values(specs).join(' ').toLowerCase();
    const priceFilterActive = priceRange[0] !== DEFAULT_PRICE_RANGE[0] || priceRange[1] !== DEFAULT_PRICE_RANGE[1];
    const matchPrice = !priceFilterActive || (price >= priceRange[0] && price <= priceRange[1]);
    const matchSize = petSizes.length === 0 || petSizes.some((size) => specText.includes(size.toLowerCase()));
    const matchMaterial = materials.length === 0 || materials.some((material) => specText.includes(material.toLowerCase()));
    const matchColor = colors.length === 0 || colors.some((color) => specText.includes(color.toLowerCase()) || product.name.toLowerCase().includes(color.toLowerCase()));
    return matchPrice && matchSize && matchMaterial && matchColor;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortBy === 'price-asc') return getPrice(a) - getPrice(b);
    if (sortBy === 'price-desc') return getPrice(b) - getPrice(a);
    if (sortBy === 'discount-desc') return getDiscountPercent(b) - getDiscountPercent(a);
    if (sortBy === 'positive-rate-desc') {
      const rateDiff = getPositiveRate(b) - getPositiveRate(a);
      if (rateDiff !== 0) return rateDiff;
      return (b.reviewCount || 0) - (a.reviewCount || 0);
    }
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    return 0;
  });

  const paginatedProducts = sortedProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const renderBadges = (product: Product) => {
    const badges: Array<{ label: string; color: string }> = [];
    if (getDiscountPercent(product) > 0) badges.push({ label: t('pages.productList.sale'), color: 'volcano' });
    if (product.tag === 'new') badges.push({ label: t('pages.productList.new'), color: 'blue' });
    if (product.isFeatured) badges.push({ label: t('pages.productList.bestSeller'), color: 'gold' });
    if ((product.stock || 0) > 0 && (product.stock || 0) <= 5) badges.push({ label: t('pages.productList.runningLow'), color: 'red' });
    return badges;
  };

  return (
    <div style={{ padding: '24px 12px', maxWidth: 1200, margin: '0 auto', overflow: 'hidden' }}>
      <Row gutter={24}>
        <Col xs={0} sm={0} md={5} lg={4}>
          <Card title={t('pages.productList.title')} size="small" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Button type={!categoryId ? 'primary' : 'text'} block onClick={() => handleCategoryChange(undefined)} style={{ textAlign: 'left' }}>
                {t('pages.productList.allCategories')}
              </Button>
              {categoryRows.map(cat => (
                <Button
                  key={cat.id}
                  type={categoryId === cat.id ? 'primary' : 'text'}
                  block
                  onClick={() => handleCategoryChange(cat.id)}
                  style={{ textAlign: 'left', paddingLeft: 12 + ((cat.level || 1) - 1) * 14 }}
                >
                  {cat.level && cat.level > 1 ? '  ' : ''}{getLocalizedCategoryValue(cat, language, 'name')}
                </Button>
              ))}
            </div>
          </Card>
          <Card
            title={
              <Space>
                <span>{t('pages.productList.filters')}</span>
                {activeFilterCount > 0 ? <Tag color="blue">{t('pages.productList.activeFilters', { count: activeFilterCount })}</Tag> : null}
              </Space>
            }
            size="small"
            extra={
              <Button type="link" size="small" disabled={activeFilterCount === 0} onClick={resetFilters}>
                {t('pages.productList.resetFilters')}
              </Button>
            }
          >
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <div>
                <Text strong>{t('pages.productList.price')}</Text>
                <Slider range min={0} max={10000} step={50} value={priceRange} onChange={(value) => setPriceRange(value as [number, number])} />
                <Text type="secondary">{formatMoney(priceRange[0])} - {formatMoney(priceRange[1])}</Text>
              </div>
              <Checkbox.Group
                value={petSizes}
                onChange={(value) => setPetSizes(value.map(String))}
                options={['Small', 'Medium', 'Large']}
              />
              <Checkbox.Group
                value={materials}
                onChange={(value) => setMaterials(value.map(String))}
                options={['Cotton', 'Nylon', 'Silicone', 'Wood']}
              />
              <Checkbox.Group
                value={colors}
                onChange={(value) => setColors(value.map(String))}
                options={['Black', 'Blue', 'Green', 'Pink']}
              />
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={24} md={19} lg={20}>
          <Card style={{ marginBottom: 16 }}>
            <Row gutter={[12, 12]} align="middle">
              <Col xs={24} sm={16} md={14} flex="auto">
                <Input.Search placeholder={t('pages.productList.searchPlaceholder')} value={keyword} onChange={e => setKeyword(e.target.value)} onSearch={handleSearch} style={{ width: '100%', maxWidth: 400 }} />
              </Col>
              <Col xs={16} sm={5} md={6}>
                <Select value={sortBy} onChange={setSortBy} style={{ width: '100%' }}
                  options={[
                    { value: 'default', label: t('pages.productList.defaultSort') },
                    { value: 'price-asc', label: t('pages.productList.priceAsc') },
                    { value: 'price-desc', label: t('pages.productList.priceDesc') },
                    { value: 'discount-desc', label: t('pages.productList.discountDesc') },
                    { value: 'positive-rate-desc', label: t('pages.productList.positiveRateDesc') },
                    { value: 'name', label: t('pages.productList.byName') },
                  ]}
                />
              </Col>
              <Col xs={8} sm={3} md={4}><Text type="secondary">{t('pages.productList.count', { count: filteredProducts.length })}</Text></Col>
            </Row>
            {searchHistory.length > 0 && (
              <Space wrap size={[8, 8]} style={{ marginTop: 12 }}>
                <Text type="secondary">{t('pages.productList.recentSearches')}</Text>
                {searchHistory.map((term) => (
                  <Tag key={term} style={{ cursor: 'pointer' }} onClick={() => handleSearch(term)}>
                    {term}
                  </Tag>
                ))}
                <Button type="link" size="small" onClick={clearSearchHistory}>
                  {t('pages.productList.clearSearches')}
                </Button>
              </Space>
            )}
          </Card>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
          ) : paginatedProducts.length === 0 ? (
            <Empty description={t('pages.productList.empty')} style={{ padding: 80 }} />
          ) : (
            <>
              <Row gutter={[16, 16]}>
                {paginatedProducts.map(product => (
                  <Col key={product.id} xs={24} sm={12} md={8} lg={6}>
                    <Card
                      hoverable
                      cover={
                        <div style={{ position: 'relative' }}>
                          <img alt={product.name} src={product.imageUrl} style={{ width: '100%', height: 200, objectFit: 'cover' }}
                            onClick={() => navigate(`/products/${product.id}`)} />
                          <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {renderBadges(product).map((badge) => <Tag key={badge.label} color={badge.color}>{badge.label}</Tag>)}
                          </div>
                          {product.stock !== undefined && product.stock <= 0 && (
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18, fontWeight: 600 }}>
                              {t('pages.productList.soldOut')}
                            </div>
                          )}
                        </div>
                      }
                      actions={[
                        <Button type="primary" icon={<ShoppingCartOutlined />} size="small"
                          disabled={product.stock !== undefined && product.stock <= 0}
                          onClick={(e) => openQuickAdd(e, product)}>
                          {t('pages.productList.quickAdd')}
                        </Button>,
                        <Button icon={<BarChartOutlined />} size="small" onClick={(e) => handleCompare(e, product)}>
                          {isProductCompared(product.id) ? t('pages.productList.viewCompare') : t('pages.productList.compare')}
                        </Button>,
                      ]}
                    >
                      <Card.Meta
                        title={<Text ellipsis={{ tooltip: product.name }}>{product.name}</Text>}
                        description={
                          <div>
                            <div style={{ color: '#ff5722', fontWeight: 600, fontSize: 16 }}>
                              {formatMoney(getPrice(product))}
                              {product.originalPrice && product.originalPrice > getPrice(product) && (
                                <Text delete type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>{formatMoney(product.originalPrice)}</Text>
                              )}
                              {product.activeLimitedTimeDiscount && <Tag color="red" style={{ marginLeft: 8 }}>{t('pages.productList.limitedTime')}</Tag>}
                            </div>
                            <div style={{ marginTop: 4 }}>
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                {t('pages.productList.positiveRate', { rate: (product.positiveRate || 0).toFixed(1), count: product.reviewCount || 0 })}
                              </Text>
                            </div>
                            {product.brand && <Text type="secondary" style={{ fontSize: 12 }}>{product.brand}</Text>}
                          </div>
                        }
                      />
                    </Card>
                  </Col>
                ))}
              </Row>
              {sortedProducts.length > pageSize && (
                <div style={{ textAlign: 'center', marginTop: 24 }}>
                  <Pagination current={currentPage} total={sortedProducts.length} pageSize={pageSize} onChange={setCurrentPage} showTotal={(total) => t('pages.productList.count', { count: total })} />
                </div>
              )}
            </>
          )}
        </Col>
      </Row>
      <Modal
        title={quickAddProduct ? t('pages.productList.quickAddTitle', { name: quickAddProduct.name }) : t('pages.productList.quickAdd')}
        open={!!quickAddProduct}
        onCancel={() => setQuickAddProduct(null)}
        onOk={submitQuickAdd}
        okText={t('pages.productList.addToCart')}
        cancelText={t('common.cancel')}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          {quickAddBundleInfo ? (
            <>
              {quickAddOptionGroups.length > 0 ? (
                <>
                  <Text type="secondary">{t('pages.productList.quickAddHint')}</Text>
                  {quickAddOptionGroups.map((group) => (
                    <Select
                      key={group.name}
                      placeholder={group.name}
                      value={quickAddOptions[group.name] || undefined}
                      onChange={(value) => setQuickAddOptions((current) => ({ ...current, [group.name]: value }))}
                      options={group.values.map((value) => ({ value, label: value }))}
                      style={{ width: '100%' }}
                    />
                  ))}
                </>
              ) : null}
              <Text type="secondary">{t('bundle.includes')}</Text>
              <Space wrap size={[6, 6]}>
                {quickAddBundleInfo.items.map((item) => (
                  <Tag key={item.name}>{item.name} x{item.quantity || 1}</Tag>
                ))}
              </Space>
              <Text>{t('pages.productList.quickAddPrice')}: {formatMoney(quickAddBundleInfo.price)}</Text>
            </>
          ) : quickAddOptionGroups.length > 0 ? (
            <>
              <Text type="secondary">{t('pages.productList.quickAddHint')}</Text>
              {quickAddOptionGroups.map((group) => (
                <Select
                  key={group.name}
                  placeholder={group.name}
                  value={quickAddOptions[group.name] || undefined}
                  onChange={(value) => setQuickAddOptions((current) => ({ ...current, [group.name]: value }))}
                  options={group.values.map((value) => ({ value, label: value }))}
                  style={{ width: '100%' }}
                />
              ))}
              <Text>
                {t('pages.productList.quickAddPrice')}: {formatMoney(quickAddVariant?.price ?? (quickAddProduct ? getPrice(quickAddProduct) : 0))}
              </Text>
              {quickAddVariant?.stock !== undefined && (
                <Text type="secondary">{t('pages.productDetail.stock')}: {quickAddVariant.stock}</Text>
              )}
            </>
          ) : (
            <Text type="secondary">{t('pages.productList.quickAddNoOptions')}</Text>
          )}
        </Space>
      </Modal>
    </div>
  );
};

export default ProductList;

