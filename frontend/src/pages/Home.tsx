import React, { useEffect, useMemo, useState } from 'react';
import { Button, Carousel, Col, Empty, Row, Spin, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  AppstoreOutlined,
  CameraOutlined,
  CheckCircleOutlined,
  FireOutlined,
  GiftOutlined,
  MobileOutlined,
  SearchOutlined,
  ShopOutlined,
  ShoppingOutlined,
  SafetyCertificateOutlined,
  StarFilled,
  TruckOutlined,
} from '@ant-design/icons';
import { categoryApi, productApi } from '../api';
import { useLanguage } from '../i18n';
import type { Category, Product } from '../types';
import { useMarket } from '../hooks/useMarket';
import { localizeProduct } from '../utils/localizedProduct';
import { getLocalizedCategoryValue } from '../utils/categoryTree';
import { clearProductViewHistory, loadProductViewPreferences } from '../utils/productViewPreferences';
import './Home.css';

const { Text } = Typography;
const DISCOVERY_BATCH_SIZE = 12;

const fallbackImages = [
  'https://images.unsplash.com/photo-1601758125946-6ec2ef64daf8?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1592194996308-7b43878e84a6?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1601758177266-bc599de87707?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1544568100-847a948585b9?auto=format&fit=crop&w=900&q=80',
];

const ugcImages = [
  'https://images.unsplash.com/photo-1537151672256-6caf2e9f8c95?auto=format&fit=crop&w=500&q=80',
  'https://images.unsplash.com/photo-1568572933382-74d440642117?auto=format&fit=crop&w=500&q=80',
  'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&w=500&q=80',
  'https://images.unsplash.com/photo-1583512603805-3cc6b41f3edb?auto=format&fit=crop&w=500&q=80',
  'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=500&q=80',
  'https://images.unsplash.com/photo-1596854407944-bf87f6fdd49e?auto=format&fit=crop&w=500&q=80',
];

const parseImageList = (value: unknown): string[] => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const normalizeProductImages = (product: Product, index: number) => {
  const rawImages = parseImageList(product.images);
  const images = [product.imageUrl, ...rawImages]
    .map((image) => String(image || '').trim())
    .filter(Boolean);
  return Array.from(new Set(images)).concat(fallbackImages[index % fallbackImages.length]).slice(0, 6);
};

const Home: React.FC = () => {
  const [featured, setFeatured] = useState<Product[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(DISCOVERY_BATCH_SIZE);
  const [viewPreferences, setViewPreferences] = useState(() => loadProductViewPreferences());
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { formatMoney: formatPrice, market } = useMarket();
  const getPrice = (product: Product) => product.effectivePrice ?? product.price;
  const getDiscountPercent = (product: Product) => product.effectiveDiscountPercent || product.discount || 0;

  const searchKeyword = (keyword: string) => navigate(`/products?keyword=${encodeURIComponent(keyword)}`);

  const formatViewedAt = (viewedAt?: number) => {
    if (!viewedAt) return '';
    return new Date(viewedAt).toLocaleString(language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  useEffect(() => {
    const fetchHome = async () => {
      setLoading(true);
      try {
        const [featuredRes, productsRes, categoriesRes] = await Promise.all([
          productApi.getFeatured(),
          productApi.getAll(),
          categoryApi.getTopLevel(),
        ]);
        setFeatured(featuredRes.data.map((product) => localizeProduct(product, language)));
        setProducts(productsRes.data.map((product) => localizeProduct(product, language)));
        setCategories(categoriesRes.data);
        setVisibleCount(DISCOVERY_BATCH_SIZE);
      } catch {
        setFeatured([]);
        setProducts([]);
        setCategories([]);
      } finally {
        setLoading(false);
      }
    };

    fetchHome();
  }, [language]);

  useEffect(() => {
    const handlePreferencesUpdated = () => setViewPreferences(loadProductViewPreferences());
    window.addEventListener('shop:product-view-preferences-updated', handlePreferencesUpdated);
    window.addEventListener('storage', handlePreferencesUpdated);
    return () => {
      window.removeEventListener('shop:product-view-preferences-updated', handlePreferencesUpdated);
      window.removeEventListener('storage', handlePreferencesUpdated);
    };
  }, []);

  const promoProducts = useMemo(
    () =>
      products
        .filter((product) =>
          product.activeLimitedTimeDiscount ||
          getDiscountPercent(product) > 0 ||
          product.tag === 'discount' ||
          (product.originalPrice !== undefined && product.originalPrice > getPrice(product))
        )
        .slice(0, 6),
    [products],
  );

  const bestSellers = useMemo(
    () =>
      [...products]
        .sort((left, right) => (right.reviewCount || 0) - (left.reviewCount || 0) || (right.positiveRate || 0) - (left.positiveRate || 0))
        .slice(0, 8),
    [products],
  );

  const recentlyViewedProducts = useMemo(() => {
    const productById = new Map(products.map((product) => [product.id, product]));
    const viewedAtById = new Map(viewPreferences.recentEntries.map((entry) => [entry.productId, entry.viewedAt]));
    return viewPreferences.recent
      .map((productId: number) => {
        const product = productById.get(productId);
        return product ? { product, viewedAt: viewedAtById.get(productId) } : undefined;
      })
      .filter(Boolean)
      .slice(0, 8) as Array<{ product: Product; viewedAt?: number }>;
  }, [products, viewPreferences]);

  const discoveryProducts = useMemo(() => {
    const merged = [...featured, ...products];
    const uniqueProducts = Array.from(new Map(merged.map((product) => [product.id, product])).values());
    const recentSet = new Set(viewPreferences.recent);
    return uniqueProducts
      .map((product, index) => ({
        product,
        index,
        score:
          (viewPreferences.categories[String(product.categoryId)] || 0) * 8 +
          (product.brand ? (viewPreferences.brands[String(product.brand)] || 0) * 4 : 0) +
          (product.tag ? (viewPreferences.tags[String(product.tag)] || 0) * 3 : 0) +
          (recentSet.has(product.id) ? 2 : 0) +
          (product.isFeatured ? 1 : 0),
      }))
      .sort((left, right) => right.score - left.score || left.index - right.index)
      .map((entry) => entry.product);
  }, [featured, products, viewPreferences]);

  const visibleDiscoveryProducts = discoveryProducts.slice(0, visibleCount);
  const hasMoreDiscoveryProducts = visibleCount < discoveryProducts.length;

  useEffect(() => {
    const handleScroll = () => {
      const distanceToBottom = document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
      if (distanceToBottom < 420) {
        setVisibleCount((count) => Math.min(count + DISCOVERY_BATCH_SIZE, discoveryProducts.length));
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [discoveryProducts.length]);

  const categoryTiles = categories.slice(0, 8);

  const ProductTile: React.FC<{ product: Product; index: number; compact?: boolean; viewedAt?: number }> = ({
    product,
    index,
    compact = false,
    viewedAt,
  }) => {
    const images = normalizeProductImages(product, index);
    const isSoldOut = product.stock !== undefined && product.stock <= 0;
    return (
    <button className="shopee-product" onClick={() => navigate(`/products/${product.id}`)}>
      <span className="shopee-product__imageWrap">
        {images.length > 2 ? (
          <Carousel autoplay dots={false} autoplaySpeed={2600 + (index % 4) * 350} className="shopee-product__carousel">
            {images.slice(0, -1).map((image, imageIndex) => (
              <img
                key={`${image}-${imageIndex}`}
                src={image}
                alt={`${product.name} ${imageIndex + 1}`}
                className="shopee-product__image"
                onError={(event) => {
                  event.currentTarget.src = images[images.length - 1];
                }}
              />
            ))}
          </Carousel>
        ) : (
          <img
            src={images[0]}
            alt={product.name}
            className="shopee-product__image"
            onError={(event) => {
              event.currentTarget.src = images[images.length - 1];
            }}
          />
        )}
        {getDiscountPercent(product) > 0 ? (
          <span className="shopee-product__discount">-{getDiscountPercent(product)}%</span>
        ) : null}
        {product.isFeatured ? <span className="shopee-product__mall">{t('common.mall')}</span> : null}
        {isSoldOut ? <span className="shopee-product__soldOut">{t('pages.productList.soldOut')}</span> : null}
      </span>
      <span className="shopee-product__body">
        <span className="shopee-product__name">{product.name}</span>
        <span className="shopee-product__meta">
          <span className="shopee-product__price">{formatPrice(getPrice(product))}</span>
          {!compact ? <span className="shopee-product__sold">{t('home.sold')} {Math.max(12, product.stock || 42)}</span> : null}
        </span>
        {product.originalPrice && product.originalPrice > getPrice(product) ? (
          <span className="shopee-product__original">{formatPrice(product.originalPrice)}</span>
        ) : null}
        {viewedAt ? (
          <span className="shopee-product__lastViewed">{t('home.viewedAt', { time: formatViewedAt(viewedAt) })}</span>
        ) : null}
      </span>
    </button>
    );
  };

  if (loading) {
    return (
      <div className="shopee-loading">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <main className="shopee-home">
      <section className="shopee-hero">
        <div className="shopee-container shopee-hero__grid">
          <div className="shopee-hero__main">
            <div>
              <span className="shopee-hero__eyebrow">{t('home.heroEyebrow')}</span>
              <h1>{t('home.heroTitle')}</h1>
              <p>{t('home.heroText')}</p>
              <div className="shopee-hero__actions">
                <Button size="large" icon={<ShoppingOutlined />} onClick={() => navigate('/products')}>
                  {t('home.shopBestSellers')}
                </Button>
                <Button size="large" ghost icon={<SearchOutlined />} onClick={() => searchKeyword('dog walking')}>
                  {t('home.findWalkingGear')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="shopee-container">
        <section className="pet-trust-strip">
          <div><TruckOutlined /><strong>{t('home.trust.freeShipping', { amount: formatPrice(market.freeShippingThreshold) })}</strong><span>{t('home.trust.fastDispatch')}</span></div>
          <div><SafetyCertificateOutlined /><strong>{t('home.trust.petSafe')}</strong><span>{t('home.trust.nonToxic')}</span></div>
          <div><CheckCircleOutlined /><strong>{t('home.trust.easyReturns')}</strong><span>{t('home.trust.betterFit')}</span></div>
          <div><StarFilled /><strong>{t('home.trust.loved')}</strong><span>{t('home.trust.happyTails')}</span></div>
        </section>

        <section className="shopee-home-actions" aria-label={t('home.couponsExtra')}>
          <button className="shopee-coupon-entry" onClick={() => navigate('/coupons')}>
            <span className="shopee-coupon-entry__icon"><GiftOutlined /></span>
            <span>
              <strong>{t('home.couponsExtra')}</strong>
              <Text>{t('nav.coupons')}</Text>
            </span>
          </button>
          <button className="shopee-coupon-entry shopee-coupon-entry--deal" onClick={() => searchKeyword(t('home.keywords.deal'))}>
            <span className="shopee-coupon-entry__icon"><FireOutlined /></span>
            <span>
              <strong>{t('home.flashOffers')}</strong>
              <Text>{t('home.viewDeals')}</Text>
            </span>
          </button>
        </section>

        {bestSellers.length ? (
          <section className="shopee-section shopee-promo-products">
            <div className="shopee-section__header">
              <h2>
                <StarFilled /> {t('home.bestSellers')}
              </h2>
              <button onClick={() => navigate('/products')}>{t('home.shopAll')}</button>
            </div>
            <Row gutter={[12, 12]}>
              {bestSellers.map((product, index) => (
                <Col key={product.id} xs={12} sm={8} md={6} lg={4}>
                  <ProductTile product={product} index={index} compact />
                </Col>
              ))}
            </Row>
          </section>
        ) : null}

        <section className="shopee-section">
          <div className="shopee-section__header">
            <h2>{t('home.categories')}</h2>
            <button onClick={() => navigate('/products')}>{t('home.viewAll')}</button>
          </div>
          {categoryTiles.length ? (
            <div className="shopee-categories">
              {categoryTiles.map((category, index) => (
                <button key={category.id} onClick={() => navigate(`/products?categoryId=${category.id}`)}>
                  <span>
                    {category.imageUrl ? (
                      <img src={category.imageUrl} alt={getLocalizedCategoryValue(category, language, 'name')} style={{ width: 34, height: 34, objectFit: 'cover', borderRadius: 6 }} />
                    ) : (
                      [<AppstoreOutlined />, <MobileOutlined />, <ShopOutlined />, <GiftOutlined />, <StarFilled />][index % 5]
                    )}
                  </span>
                  <Text ellipsis>{getLocalizedCategoryValue(category, language, 'name')}</Text>
                </button>
              ))}
            </div>
          ) : (
            <Empty description={t('home.noCategories')} />
          )}
        </section>

        {recentlyViewedProducts.length ? (
          <section className="shopee-section shopee-promo-products">
            <div className="shopee-section__header shopee-section__header--with-actions">
              <h2>{t('home.recentlyViewed')}</h2>
              <div className="shopee-section__actions">
                <button onClick={() => navigate('/products')}>{t('home.moreProducts')}</button>
                <button
                  onClick={() => {
                    clearProductViewHistory();
                    setViewPreferences(loadProductViewPreferences());
                  }}
                >
                  {t('home.clearRecentlyViewed')}
                </button>
              </div>
            </div>
            <Row gutter={[12, 12]}>
              {recentlyViewedProducts.map(({ product, viewedAt }, index) => (
                <Col key={product.id} xs={12} sm={8} md={6} lg={4}>
                  <ProductTile product={product} index={index} compact viewedAt={viewedAt} />
                </Col>
              ))}
            </Row>
          </section>
        ) : null}

        {promoProducts.length ? (
          <section className="shopee-section shopee-promo-products">
            <div className="shopee-section__header">
              <h2>
                <FireOutlined /> {t('home.flashOffers')}
              </h2>
              <button onClick={() => searchKeyword(t('home.keywords.deal'))}>{t('home.viewAll')}</button>
            </div>
            <Row gutter={[12, 12]}>
              {promoProducts.map((product, index) => (
                <Col key={product.id} xs={12} sm={8} md={6} lg={4}>
                  <ProductTile product={product} index={index} compact />
                </Col>
              ))}
            </Row>
          </section>
        ) : null}

        <section className="shopee-section shopee-discovery">
          <div className="shopee-section__header shopee-section__header--accent">
            <h2>{t('home.dailyDiscovery')}</h2>
            <button onClick={() => navigate('/products')}>{t('home.moreProducts')}</button>
          </div>
          {discoveryProducts.length ? (
            <>
            <Row gutter={[12, 12]}>
              {visibleDiscoveryProducts.map((product, index) => (
                <Col key={product.id} xs={12} sm={8} md={6} lg={4}>
                  <ProductTile product={product} index={index} />
                </Col>
              ))}
            </Row>
            {hasMoreDiscoveryProducts ? (
              <div className="shopee-load-more">
                <Spin size="small" />
              </div>
            ) : null}
            </>
          ) : (
            <Empty description={t('home.noProducts')} />
          )}
        </section>

        <section className="shopee-section pet-ugc">
          <div className="shopee-section__header">
            <h2><CameraOutlined /> Real pets, real homes</h2>
            <button onClick={() => navigate('/products?keyword=pet')}>Shop the feed</button>
          </div>
          <div className="pet-ugc__grid">
            {ugcImages.map((image, index) => (
              <button key={image} onClick={() => navigate(index % 2 === 0 ? '/products?keyword=toys' : '/products?keyword=bed')}>
                <img src={image} alt={`Pet customer story ${index + 1}`} />
                <span>@happy_pet_{index + 1}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
};

export default Home;
