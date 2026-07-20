import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Image, Row, Select, Slider, Space, Spin, Tag, Typography } from 'antd';
import { FireOutlined, GiftOutlined, ReloadOutlined, SearchOutlined, StarOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { productApi } from '../api';
import { useLanguage } from '../i18n';
import { usePageTitle } from '../hooks/usePageTitle';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useMarket } from '../hooks/useMarket';
import type { ProductPublic as Product } from '../types';
import { localizeProduct } from '../utils/localizedProduct';
import { productImageFallback, resolveProductImage } from '../utils/productMedia';
import { loadFallbackProductCatalog, loadProductCatalogSnapshot, saveProductCatalogSnapshot } from '../utils/productCatalogSnapshot';
import { getLocalStorageItem, setLocalStorageItem } from '../utils/safeStorage';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import PageError from '../components/PageError';
import PageEmpty from '../components/PageEmpty';
import './PetFinder.css';
import '../styles/mobile-page-contrast.css';

const { Title, Text, Paragraph } = Typography;

type PetType = 'all' | 'dog' | 'cat' | 'small';
type NeedType = 'all' | 'play' | 'walk' | 'sleep' | 'smart' | 'groom' | 'food';
type Priority = 'best' | 'rating' | 'deal' | 'budget';

const FINDER_STORAGE_KEY = 'shop-pet-finder-preferences';
const DEFAULT_BUDGET: [number, number] = [0, 500];
const FINDER_CANDIDATE_KEYWORDS = [
  'dog', 'cat', 'small pet', 'toy', 'leash', 'bed', 'smart', 'groom', 'food', 'feeder', 'water', 'litter',
];

const normalizeBudget = (value: unknown, maxBudget = DEFAULT_BUDGET[1]): [number, number] => {
  if (!Array.isArray(value)) {
    return DEFAULT_BUDGET;
  }
  const lower = Math.max(0, Math.min(Number(value[0]) || 0, maxBudget));
  const upper = Math.max(0, Math.min(Number(value[1]) || DEFAULT_BUDGET[1], maxBudget));
  return lower <= upper ? [lower, upper] : [upper, lower];
};

const keywordMap: Record<Exclude<PetType, 'all'> | Exclude<NeedType, 'all'>, string[]> = {
  dog: ['dog', 'puppy', 'canine', 'leash', 'harness', 'collar'],
  cat: ['cat', 'kitten', 'litter', 'scratcher', 'feline'],
  small: ['small pet', 'rabbit', 'hamster', 'guinea', 'bird'],
  play: ['toy', 'play', 'ball', 'chew', 'interactive', 'scratch'],
  walk: ['walk', 'leash', 'harness', 'collar', 'travel', 'carrier'],
  sleep: ['bed', 'blanket', 'sleep', 'mat', 'cushion', 'house'],
  smart: ['smart', 'automatic', 'camera', 'tracker', 'sensor', 'device'],
  groom: ['groom', 'brush', 'clean', 'shampoo', 'nail', 'comb'],
  food: ['food', 'treat', 'bowl', 'feeder', 'water', 'litter'],
};

const uniqueFinderKeywords = (keywords: string[]) => Array.from(new Set(
  keywords.map((keyword) => keyword.trim()).filter(Boolean),
)).slice(0, 12);

const finderCandidateKeywords = (petType: PetType, need: NeedType) => {
  const selectedKeywords = [
    ...(petType === 'all' ? [] : keywordMap[petType]),
    ...(need === 'all' ? [] : keywordMap[need]),
  ];
  return uniqueFinderKeywords(selectedKeywords.length > 0 ? selectedKeywords : FINDER_CANDIDATE_KEYWORDS);
};

const loadLiveFinderProducts = async (petType: PetType, need: NeedType) => {
  try {
    const res = await productApi.getFinderCandidates(finderCandidateKeywords(petType, need), 36);
    if (res.data.length > 0) {
      return res.data;
    }
  } catch (error) {
    reportNonBlockingError('PetFinder.loadOptimizedCandidates', error);
  }
  const res = await productApi.getAll();
  return res.data;
};

const readPreferences = () => {
  try {
    const parsed = JSON.parse(getLocalStorageItem(FINDER_STORAGE_KEY) || '{}');
    return {
      petType: (parsed.petType || 'all') as PetType,
      need: (parsed.need || 'all') as NeedType,
      priority: (parsed.priority || 'best') as Priority,
      budget: normalizeBudget(parsed.budget),
    };
  } catch (error) {
    reportNonBlockingError('PetFinder.readPreferences', error);
    return { petType: 'all' as PetType, need: 'all' as NeedType, priority: 'best' as Priority, budget: DEFAULT_BUDGET };
  }
};

const productText = (product: Product) => [
  product.name,
  product.description,
  product.brand,
  product.tag,
  ...Object.entries(product.specifications || {}).flatMap(([key, value]) => [key, value]),
].join(' ').toLowerCase();

const productPrice = (product: Product) => product.effectivePrice ?? product.price;
const isInStock = (product: Product) => product.stock === undefined || product.stock > 0;

const PetFinder: React.FC = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  usePageTitle(t('pages.petFinder.title'));
  useDocumentMeta({
    title: t('pages.petFinder.title'),
    description: t('pages.petFinder.seoDescription'),
    path: '/pet-finder',
    type: 'website',
    siteName: t('common.siteTitle'),
  });
  const { formatMoney } = useMarket();
  const stored = useMemo(() => readPreferences(), []);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [usingCatalogFallback, setUsingCatalogFallback] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [petType, setPetType] = useState<PetType>(stored.petType);
  const [need, setNeed] = useState<NeedType>(stored.need);
  const [budget, setBudget] = useState<[number, number]>(stored.budget);
  const [priority, setPriority] = useState<Priority>(stored.priority);
  const maxBudget = useMemo(() => {
    const highestPrice = products.reduce((max, product) => Math.max(max, productPrice(product)), DEFAULT_BUDGET[1]);
    return Math.max(DEFAULT_BUDGET[1], Math.ceil(highestPrice / 50) * 50);
  }, [products]);
  const finderProductName = (product: Pick<Product, 'id' | 'name'>) => (
    (product.name || '').trim() || t('pages.profile.productFallback', { id: product.id })
  );

  const retryFinderProducts = () => {
    setReloadKey((value) => value + 1);
  };

  useEffect(() => {
    let isCurrent = true;
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const liveProducts = await loadLiveFinderProducts(petType, need);
        if (!isCurrent) return;
        const localizedProducts = liveProducts.map((product) => localizeProduct(product, language));
        if (localizedProducts.length > 0) {
          saveProductCatalogSnapshot(liveProducts);
          setProducts(localizedProducts);
          setUsingCatalogFallback(false);
        } else {
          const snapshot = loadProductCatalogSnapshot();
          const fallbackProducts = snapshot?.products?.length
            ? snapshot.products
            : loadFallbackProductCatalog();
          setProducts(fallbackProducts.map((product) => localizeProduct(product, language)));
          setUsingCatalogFallback(fallbackProducts.length > 0);
        }
        setLoadError(false);
      } catch (error) {
        reportNonBlockingError('PetFinder.loadProducts', error);
        if (!isCurrent) return;
        const snapshot = loadProductCatalogSnapshot();
        const fallbackProducts = snapshot?.products?.length
          ? snapshot.products
          : loadFallbackProductCatalog();
        setProducts(fallbackProducts.map((product) => localizeProduct(product, language)));
        setUsingCatalogFallback(fallbackProducts.length > 0);
        setLoadError(fallbackProducts.length === 0);
      } finally {
        if (isCurrent) {
          setLoading(false);
        }
      }
    };
    fetchProducts();
    return () => {
      isCurrent = false;
    };
  }, [language, need, petType, reloadKey]);

  useEffect(() => {
    setLocalStorageItem(FINDER_STORAGE_KEY, JSON.stringify({ petType, need, budget, priority }));
  }, [budget, need, petType, priority]);

  useEffect(() => {
    setBudget((current) => normalizeBudget(current, maxBudget));
  }, [maxBudget]);

  const matches = useMemo(() => {
    const selectedKeywords = [
      ...(petType === 'all' ? [] : keywordMap[petType]),
      ...(need === 'all' ? [] : keywordMap[need]),
    ];
    const scored = products.map((product) => {
      const text = productText(product);
      const price = productPrice(product);
      const keywordHits = selectedKeywords.filter((keyword) => text.includes(keyword)).length;
      const budgetFit = price >= budget[0] && price <= budget[1];
      const rating = Number(product.averageRating || 0);
      const discount = product.effectiveDiscountPercent || product.discount || 0;
      const stockBonus = isInStock(product) ? 10 : -20;
      let score = keywordHits * 18 + (budgetFit ? 24 : -18) + rating * 4 + Math.min(discount, 40) * 0.6 + stockBonus;
      if (product.isFeatured) score += 8;
      if (priority === 'rating') score += rating * 8;
      if (priority === 'deal') score += discount * 1.2;
      if (priority === 'budget') score += Math.max(0, budget[1] - price) / 12;
      return { product, score, keywordHits, budgetFit };
    });
    return scored
      .filter((item) => item.budgetFit && (selectedKeywords.length === 0 || item.keywordHits > 0))
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
  }, [budget, need, petType, priority, products]);

  const finderInsights = useMemo(() => {
    const readyMatches = matches.filter(({ product }) => isInStock(product)).length;
    const dealMatches = matches.filter(({ product }) => (product.effectiveDiscountPercent || product.discount || 0) > 0).length;
    const topRatedMatches = matches.filter(({ product }) => Number(product.averageRating || 0) >= 4.5).length;
    const bestMatch = matches[0]?.product;
    const bestMatchPrice = bestMatch ? productPrice(bestMatch) : 0;
    const nextAction = bestMatch
      ? isInStock(bestMatch)
        ? 'view'
        : 'search'
      : 'search';
    return {
      readyMatches,
      dealMatches,
      topRatedMatches,
      bestMatch,
      bestMatchPrice,
      nextAction,
    };
  }, [matches]);

  const applyAsSearch = () => {
    const terms = [
      petType !== 'all' ? t(`pages.petFinder.petTypes.${petType}`) : '',
      need !== 'all' ? t(`pages.petFinder.needs.${need}`) : '',
    ].filter(Boolean).join(' ');
    navigate(`/products${terms ? `?keyword=${encodeURIComponent(terms)}` : ''}`);
  };

  return (
    <div className="pet-finder-page">
      <div className="pet-finder-page__layout">
        <Card className="pet-finder-page__finderCard">
          <Row gutter={[20, 20]} align="middle">
            <Col xs={24} md={9}>
              <Space direction="vertical" size={6}>
                <Title level={2} style={{ margin: 0 }}>
                  <GiftOutlined /> {t('pages.petFinder.title')}
                </Title>
                <Paragraph type="secondary" style={{ margin: 0 }}>{t('pages.petFinder.subtitle')}</Paragraph>
              </Space>
            </Col>
            <Col xs={24} md={15}>
              <Row gutter={[12, 12]}>
                <Col xs={24} sm={12} className="pet-finder-page__budgetControl">
                  <Text strong>{t('pages.petFinder.petType')}</Text>
                  <Select
                    value={petType}
                    onChange={setPetType}
                    className="pet-finder-page__fieldControl"
                    aria-label={t('pages.petFinder.petType')}
                    title={t('pages.petFinder.petType')}
                    classNames={{ popup: { root: 'shop-mobile-popup-layer' } }}
                    getPopupContainer={() => document.body}
                    options={(['all', 'dog', 'cat', 'small'] as PetType[]).map((value) => ({ value, label: t(`pages.petFinder.petTypes.${value}`) }))}
                  />
                </Col>
                <Col xs={24} sm={12}>
                  <Text strong>{t('pages.petFinder.need')}</Text>
                  <Select
                    value={need}
                    onChange={setNeed}
                    className="pet-finder-page__fieldControl"
                    aria-label={t('pages.petFinder.need')}
                    title={t('pages.petFinder.need')}
                    classNames={{ popup: { root: 'shop-mobile-popup-layer' } }}
                    getPopupContainer={() => document.body}
                    options={(['all', 'play', 'walk', 'sleep', 'smart', 'groom', 'food'] as NeedType[]).map((value) => ({ value, label: t(`pages.petFinder.needs.${value}`) }))}
                  />
                </Col>
                <Col xs={24} sm={12}>
                  <Text strong>{t('pages.petFinder.budget')}</Text>
                  <Slider
                    range
                    min={0}
                    max={maxBudget}
                    step={maxBudget > 1000 ? 50 : 10}
                    value={budget}
                    ariaLabelForHandle={[
                      `${t('pages.petFinder.budget')} ${formatMoney(budget[0])}`,
                      `${t('pages.petFinder.budget')} ${formatMoney(budget[1])}`,
                    ]}
                    onChange={(value) => setBudget(normalizeBudget(value, maxBudget))}
                  />
                  <Text type="secondary" className="commerce-atomic">{formatMoney(budget[0])} - {formatMoney(budget[1])}</Text>
                </Col>
                <Col xs={24} sm={12}>
                  <Text strong>{t('pages.petFinder.priority')}</Text>
                  <Select
                    value={priority}
                    onChange={setPriority}
                    className="pet-finder-page__fieldControl"
                    aria-label={t('pages.petFinder.priority')}
                    title={t('pages.petFinder.priority')}
                    classNames={{ popup: { root: 'shop-mobile-popup-layer' } }}
                    getPopupContainer={() => document.body}
                    options={(['best', 'rating', 'deal', 'budget'] as Priority[]).map((value) => ({ value, label: t(`pages.petFinder.priorities.${value}`) }))}
                  />
                </Col>
              </Row>
            </Col>
          </Row>
        </Card>

        <Card
          title={t('pages.petFinder.results', { count: matches.length })}
          extra={<Button className="pet-finder-page__searchAllButton" icon={<SearchOutlined />} aria-label={t('pages.petFinder.searchAll')} title={t('pages.petFinder.searchAll')} onClick={applyAsSearch}>{t('pages.petFinder.searchAll')}</Button>}
        >
          {(loadError || usingCatalogFallback) && !loading ? (
            <Alert
              type={loadError ? 'warning' : 'info'}
              showIcon
              message={loadError ? t('pages.petFinder.loadFailed') : t('pages.petFinder.catalogFallback')}
              description={loadError ? t('pages.petFinder.loadFailedDescription') : t('pages.petFinder.catalogFallbackDescription')}
              action={(
                <Space wrap>
                  <Button size="small" icon={<ReloadOutlined />} onClick={retryFinderProducts}>
                    {t('messages.retry')}
                  </Button>
                  <Button size="small" type="link" icon={<SearchOutlined />} onClick={() => navigate('/products')}>
                    {t('pages.petFinder.browseAll')}
                  </Button>
                </Space>
              )}
              className="pet-finder-page__loadAlert"
            />
          ) : null}
          {!loading && matches.length > 0 ? (
            <section className="pet-finder-page__insights" aria-label={t('pages.petFinder.insightTitle')}>
              <div className="pet-finder-page__insightCopy">
                <Text className="pet-finder-page__eyebrow">{t('pages.petFinder.insightEyebrow')}</Text>
                <Title level={4}>{t('pages.petFinder.insightTitle')}</Title>
                <Text type="secondary">
                  {finderInsights.bestMatch
                    ? t('pages.petFinder.insightBest', { name: finderProductName(finderInsights.bestMatch) })
                    : t('pages.petFinder.insightSubtitle')}
                </Text>
              </div>
              <div className="pet-finder-page__signalGrid">
                <div className="pet-finder-page__signal is-ok">
                  <ThunderboltOutlined />
                  <strong>{finderInsights.readyMatches}</strong>
                  <span>{t('pages.petFinder.readyMatches')}</span>
                </div>
                <div className={`pet-finder-page__signal ${finderInsights.dealMatches ? 'is-warm' : 'is-ok'}`}>
                  <FireOutlined />
                  <strong>{finderInsights.dealMatches}</strong>
                  <span>{t('pages.petFinder.dealMatches')}</span>
                </div>
                <div className="pet-finder-page__signal is-ok">
                  <StarOutlined />
                  <strong>{finderInsights.topRatedMatches}</strong>
                  <span>{t('pages.petFinder.topRatedMatches')}</span>
                </div>
              </div>
            </section>
          ) : null}
          {!loading && matches.length > 0 ? (
            <section className="pet-finder-page__nextStep" aria-label={t('pages.petFinder.nextStepTitle')}>
              <div className="pet-finder-page__nextStepCopy">
                <Text className="pet-finder-page__eyebrow">{t('pages.petFinder.nextStepEyebrow')}</Text>
                <Title level={4}>{t('pages.petFinder.nextStepTitle')}</Title>
                <Text type="secondary">
                  {finderInsights.bestMatch
                    ? t('pages.petFinder.nextStepBest', {
                      name: finderProductName(finderInsights.bestMatch),
                      price: formatMoney(finderInsights.bestMatchPrice),
                    })
                    : t('pages.petFinder.nextStepSearch')}
                </Text>
              </div>
              <div className="pet-finder-page__nextStepMeta">
                <Tag color="blue">{t(`pages.petFinder.petTypes.${petType}`)}</Tag>
                <Tag color="green">{t(`pages.petFinder.needs.${need}`)}</Tag>
                <Tag color="orange"><span className="commerce-atomic"><span className="commerce-money">{formatMoney(budget[0])}</span> - <span className="commerce-money">{formatMoney(budget[1])}</span></span></Tag>
              </div>
              <Space wrap className="pet-finder-page__nextStepActions">
                {finderInsights.bestMatch && finderInsights.nextAction === 'view' ? (
                  <Button
                    type="primary"
                    onClick={() => navigate(`/products/${finderInsights.bestMatch!.id}`)}
                    aria-label={`${t('pages.petFinder.viewBest')}: ${finderProductName(finderInsights.bestMatch)}`}
                    title={`${t('pages.petFinder.viewBest')}: ${finderProductName(finderInsights.bestMatch)}`}
                  >
                    {t('pages.petFinder.viewBest')}
                  </Button>
                ) : null}
                <Button className="pet-finder-page__searchAllButton" icon={<SearchOutlined />} aria-label={t('pages.petFinder.searchAll')} title={t('pages.petFinder.searchAll')} onClick={applyAsSearch}>
                  {t('pages.petFinder.searchAll')}
                </Button>
              </Space>
            </section>
          ) : null}
          {loading ? (
            <div
              className="pet-finder-page__loading"
              role="status"
              aria-live="polite"
              aria-busy="true"
              aria-label={t('common.loading')}
            >
              <Spin size="large" />
            </div>
          ) : matches.length === 0 ? (
            loadError ? (
              <PageError
                className="pet-finder-page__empty pet-finder-page__empty--loadFailed"
                title={t('pages.petFinder.emptyAfterLoadFailure')}
                description={t('pages.petFinder.loadFailedDescription')}
                retryLabel={t('messages.retry')}
                onRetry={retryFinderProducts}
                homeLabel={t('pages.petFinder.browseAll')}
                onHome={() => navigate('/products')}
              />
            ) : (
              <PageEmpty
                className="pet-finder-page__empty"
                description={(
                  <div className="pet-finder-page__emptyCopy">
                    <div>{t('pages.petFinder.empty')}</div>
                    <div className="pet-finder-page__emptyHint">{t('pages.petFinder.emptyHint')}</div>
                  </div>
                )}
                actions={[
                  {
                    key: 'browse',
                    label: t('pages.petFinder.browseAll'),
                    onClick: () => navigate('/products'),
                    icon: <SearchOutlined />,
                  },
                  {
                    key: 'coupons',
                    label: t('pages.petFinder.emptyCoupons'),
                    onClick: () => navigate('/coupons'),
                    type: 'default',
                  },
                  {
                    key: 'gallery',
                    label: t('nav.petGallery'),
                    onClick: () => navigate('/pet-gallery'),
                    type: 'default',
                  },
                ]}
              />
            )
          ) : (
            <Row gutter={[16, 16]} className="pet-finder-page__recommendationGrid">
              {matches.map(({ product, score }) => {
                const productName = finderProductName(product);
                const viewLabel = `${t('pages.petFinder.view')}: ${productName}`;
                return (
                  <Col key={product.id} xs={12} sm={12} md={8} lg={6}>
                    <Card
                      hoverable
                      className="pet-finder-page__productCard"
                      cover={
                        <button type="button" className="pet-finder-page__productImageButton" aria-label={viewLabel} title={viewLabel} onClick={() => navigate(`/products/${product.id}`)}>
                          <Image
                            className="pet-finder-page__productImage"
                            src={resolveProductImage(product.imageUrl)}
                            alt={productName}
                            preview={false}
                            height={180}
                            fallback={productImageFallback}
                          />
                        </button>
                      }
                      actions={[
                        <Button type="link" onClick={() => navigate(`/products/${product.id}`)} aria-label={viewLabel} title={viewLabel}>
                          {t('pages.petFinder.view')}
                        </Button>,
                      ]}
                    >
                      <Space direction="vertical" size={6} className="pet-finder-page__productBody">
                        <Text strong className="pet-finder-page__productName" title={productName}>{productName}</Text>
                        <Text strong className="commerce-money pet-finder-page__productPrice">{formatMoney(productPrice(product))}</Text>
                        <Space wrap size={[4, 4]}>
                          {isInStock(product) ? <Tag color="green">{t('pages.productDetail.enough')}</Tag> : <Tag color="red">{t('pages.productList.soldOut')}</Tag>}
                          {(product.effectiveDiscountPercent || product.discount || 0) > 0 ? <Tag color="volcano">{t('pages.productList.sale')}</Tag> : null}
                          <Tag color="blue">{t('pages.petFinder.matchScore', { score: Math.max(0, Math.round(score)) })}</Tag>
                        </Space>
                      </Space>
                    </Card>
                  </Col>
                );
              })}
            </Row>
          )}
        </Card>
      </div>
    </div>
  );
};

export default PetFinder;
