import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, Row, Col, Button, Input, Select, Pagination, Tag, message, Empty, Spin, Typography, Slider, Checkbox, Modal, Space } from 'antd';
import { ShoppingCartOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { productApi, cartApi, categoryApi } from '../api';
import type { Product, Category } from '../types';
import { buildCategoryTree, flattenCategoryTree, getLocalizedCategoryValue } from '../utils/categoryTree';
import { useLanguage } from '../i18n';
import { useMarket } from '../hooks/useMarket';
import { localizeProduct } from '../utils/localizedProduct';
import { addGuestCartItem } from '../utils/guestCart';

const { Text } = Typography;

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
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 500]);
  const [petSizes, setPetSizes] = useState<string[]>([]);
  const [materials, setMaterials] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [quickAddProduct, setQuickAddProduct] = useState<Product | null>(null);
  const [quickAddOptions, setQuickAddOptions] = useState({ size: '', color: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const { t, language } = useLanguage();
  const { formatMoney } = useMarket();
  const pageSize = 12;
  const getPrice = (product: Product) => product.effectivePrice ?? product.price;
  const getDiscountPercent = (product: Product) => product.effectiveDiscountPercent || product.discount || 0;
  const getPositiveRate = (product: Product) => product.positiveRate ?? 0;

  useEffect(() => {
    categoryApi.getAll().then(res => setCategories(res.data)).catch(() => {});
  }, []);

  const categoryTree = useMemo(() => buildCategoryTree(categories), [categories]);
  const categoryRows = useMemo(() => flattenCategoryTree(categoryTree), [categoryTree]);

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
    const params = new URLSearchParams();
    if (value.trim()) params.set('keyword', value.trim());
    if (categoryId) params.set('categoryId', categoryId.toString());
    navigate(`/products${params.toString() ? '?' + params.toString() : ''}`);
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
    setQuickAddOptions({ size: '', color: '' });
  };

  const submitQuickAdd = async () => {
    if (!quickAddProduct) return;
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    try {
      if (token && userId) {
        await cartApi.addItem(Number(userId), quickAddProduct.id, 1);
      } else {
        addGuestCartItem(quickAddProduct, 1);
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
    const matchPrice = price >= priceRange[0] && price <= priceRange[1];
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
          <Card title={t('pages.productList.filters')} size="small">
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <div>
                <Text strong>{t('pages.productList.price')}</Text>
                <Slider range min={0} max={500} value={priceRange} onChange={(value) => setPriceRange(value as [number, number])} />
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
                          Quick Add
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
        title={quickAddProduct ? `Quick Add: ${quickAddProduct.name}` : 'Quick Add'}
        open={!!quickAddProduct}
        onCancel={() => setQuickAddProduct(null)}
        onOk={submitQuickAdd}
        okText="Add to cart"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>Select preferred options before adding. Variant-specific inventory can be connected later through SKU management.</Text>
          <Select
            placeholder="Size"
            value={quickAddOptions.size || undefined}
            onChange={(size) => setQuickAddOptions((current) => ({ ...current, size }))}
            options={['Small', 'Medium', 'Large'].map((size) => ({ value: size, label: size }))}
          />
          <Select
            placeholder="Color"
            value={quickAddOptions.color || undefined}
            onChange={(color) => setQuickAddOptions((current) => ({ ...current, color }))}
            options={['Black', 'Blue', 'Green', 'Pink'].map((color) => ({ value: color, label: color }))}
          />
        </Space>
      </Modal>
    </div>
  );
};

export default ProductList;

