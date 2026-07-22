import React, { useEffect, useMemo, useState } from 'react';
import { ShopIcon, SI } from '../components/ShopIcon';
import { Alert, Button, Tag } from 'antd';
import ShopSelect from '../components/ShopSelect';
import ShopRangeSlider from '../components/ShopRangeSlider';
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
import { dispatchDomEvent } from '../utils/domEvents';
import './PetFinder.css';
import '../styles/mobile-page-contrast.css';


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
        <section className="pet-finder-page__finderCard" aria-label={t('pages.petFinder.title')}>
          <div className="pet-finder-page__finderShell">
            <div className="pet-finder-page__finderIntro">
              <div className="pet-finder-page__introStack">
                <h1 className="pet-finder-page__title" style={{ margin: 0 }}>
                  <ShopIcon path={SI.gift} /> {t('pages.petFinder.title')}
                </h1>
                <p className="pet-finder-page__text pet-finder-page__paragraph pet-finder-page__text--secondary" style={{ margin: 0 }}>{t('pages.petFinder.subtitle')}</p>
              </div>
            </div>
            <div className="pet-finder-page__finderControls">
              <div className="pet-finder-page__control pet-finder-page__budgetControl">
                <span className="pet-finder-page__text pet-finder-page__text--strong">{t('pages.petFinder.petType')}</span>
                <ShopSelect
                  value={petType}
                  onChange={(value) => setPetType(value as PetType)}
                  className="pet-finder-page__fieldControl"
                  ariaLabel={t('pages.petFinder.petType')}
                  title={t('pages.petFinder.petType')}
                  popupClassName="shop-mobile-popup-layer"
                  popupZIndex={1100}
                  options={(['all', 'dog', 'cat', 'small'] as PetType[]).map((value) => ({ value, label: t(`pages.petFinder.petTypes.${value}`) }))}
                />
              </div>
              <div className="pet-finder-page__control">
                <span className="pet-finder-page__text pet-finder-page__text--strong">{t('pages.petFinder.need')}</span>
                <ShopSelect
                  value={need}
                  onChange={(value) => setNeed(value as NeedType)}
                  className="pet-finder-page__fieldControl"
                  ariaLabel={t('pages.petFinder.need')}
                  title={t('pages.petFinder.need')}
                  popupClassName="shop-mobile-popup-layer"
                  popupZIndex={1100}
                  options={(['all', 'play', 'walk', 'sleep', 'smart', 'groom', 'food'] as NeedType[]).map((value) => ({ value, label: t(`pages.petFinder.needs.${value}`) }))}
                />
              </div>
              <div className="pet-finder-page__control">
                <span className="pet-finder-page__text pet-finder-page__text--strong">{t('pages.petFinder.budget')}</span>
                <ShopRangeSlider
                  className="pet-finder-page__budgetSlider"
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
                <span className="pet-finder-page__text pet-finder-page__text--secondary commerce-atomic">{formatMoney(budget[0])} - {formatMoney(budget[1])}</span>
              </div>
              <div className="pet-finder-page__control">
                <span className="pet-finder-page__text pet-finder-page__text--strong">{t('pages.petFinder.priority')}</span>
                <ShopSelect
                  value={priority}
                  onChange={(value) => setPriority(value as Priority)}
                  className="pet-finder-page__fieldControl"
                  ariaLabel={t('pages.petFinder.priority')}
                  title={t('pages.petFinder.priority')}
                  popupClassName="shop-mobile-popup-layer"
                  popupZIndex={1100}
                  options={(['best', 'rating', 'deal', 'budget'] as Priority[]).map((value) => ({ value, label: t(`pages.petFinder.priorities.${value}`) }))}
                />
              </div>
            </div>
          </div>
        </section>

        <section
          className="pet-finder-page__resultsCard"
          aria-label={t('pages.petFinder.results', { count: matches.length })}
        >
          <div className="shop-panel__head">
            <h2 className="shop-panel__title">{t('pages.petFinder.results', { count: matches.length })}</h2>
            <div className="shop-panel__extra">
              <Button className="pet-finder-page__searchAllButton" icon={<ShopIcon path={SI.search} />} aria-label={t('pages.petFinder.searchAll')} title={t('pages.petFinder.searchAll')} onClick={applyAsSearch}>{t('pages.petFinder.searchAll')}</Button>
            </div>
          </div>
          {(loadError || usingCatalogFallback) && !loading ? (
            <Alert
              type={loadError ? 'warning' : 'info'}
              showIcon
              message={loadError ? t('pages.petFinder.loadFailed') : t('pages.petFinder.catalogFallback')}
              description={loadError ? t('pages.petFinder.loadFailedDescription') : t('pages.petFinder.catalogFallbackDescription')}
              action={(
                <div className="pet-finder-page__chipRow">
                  <Button size="small" icon={<ShopIcon path={SI.reload} />} onClick={retryFinderProducts}>
                    {t('messages.retry')}
                  </Button>
                  <Button size="small" type="link" icon={<ShopIcon path={SI.search} />} onClick={() => navigate('/products')}>
                    {t('pages.petFinder.browseAll')}
                  </Button>
                </div>
              )}
              className="pet-finder-page__loadAlert"
            />
          ) : null}
          {!loading && matches.length > 0 ? (
            <section className="pet-finder-page__insights" aria-label={t('pages.petFinder.insightTitle')}>
              <div className="pet-finder-page__insightCopy">
                <span className="pet-finder-page__text pet-finder-page__eyebrow">{t('pages.petFinder.insightEyebrow')}</span>
                <h4 className="pet-finder-page__title">{t('pages.petFinder.insightTitle')}</h4>
                <span className="pet-finder-page__text pet-finder-page__text--secondary">
                  {finderInsights.bestMatch
                    ? t('pages.petFinder.insightBest', { name: finderProductName(finderInsights.bestMatch) })
                    : t('pages.petFinder.insightSubtitle')}
                </span>
              </div>
              <div className="pet-finder-page__signalGrid">
                <div className="pet-finder-page__signal is-ok">
                  <ShopIcon path={SI.thunder} />
                  <strong>{finderInsights.readyMatches}</strong>
                  <span>{t('pages.petFinder.readyMatches')}</span>
                </div>
                <div className={`pet-finder-page__signal ${finderInsights.dealMatches ? 'is-warm' : 'is-ok'}`}>
                  <ShopIcon path={SI.fire} />
                  <strong>{finderInsights.dealMatches}</strong>
                  <span>{t('pages.petFinder.dealMatches')}</span>
                </div>
                <div className="pet-finder-page__signal is-ok">
                  <ShopIcon path={SI.starOutline} />
                  <strong>{finderInsights.topRatedMatches}</strong>
                  <span>{t('pages.petFinder.topRatedMatches')}</span>
                </div>
              </div>
            </section>
          ) : null}
          {!loading && matches.length > 0 ? (
            <section className="pet-finder-page__nextStep" aria-label={t('pages.petFinder.nextStepTitle')}>
              <div className="pet-finder-page__nextStepCopy">
                <span className="pet-finder-page__text pet-finder-page__eyebrow">{t('pages.petFinder.nextStepEyebrow')}</span>
                <h4 className="pet-finder-page__title">{t('pages.petFinder.nextStepTitle')}</h4>
                <span className="pet-finder-page__text pet-finder-page__text--secondary">
                  {finderInsights.bestMatch
                    ? t('pages.petFinder.nextStepBest', {
                      name: finderProductName(finderInsights.bestMatch),
                      price: formatMoney(finderInsights.bestMatchPrice),
                    })
                    : t('pages.petFinder.nextStepSearch')}
                </span>
              </div>
              <div className="pet-finder-page__nextStepMeta">
                <Tag color="blue">{t(`pages.petFinder.petTypes.${petType}`)}</Tag>
                <Tag color="green">{t(`pages.petFinder.needs.${need}`)}</Tag>
                <Tag color="orange"><span className="commerce-atomic"><span className="commerce-money">{formatMoney(budget[0])}</span> - <span className="commerce-money">{formatMoney(budget[1])}</span></span></Tag>
              </div>
              <div className="pet-finder-page__nextStepActions">
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
                <Button className="pet-finder-page__searchAllButton" icon={<ShopIcon path={SI.search} />} aria-label={t('pages.petFinder.searchAll')} title={t('pages.petFinder.searchAll')} onClick={applyAsSearch}>
                  {t('pages.petFinder.searchAll')}
                </Button>
              </div>
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
              <div className="pet-finder-page__spinner" role="status" aria-label={t('common.loading')} />
            </div>
          ) : matches.length === 0 ? (
            loadError ? (
              <PageError
                className="pet-finder-page__empty pet-finder-page__empty--loadFailed" data-pet-finder-load-recovery="true"
                title={t('pages.petFinder.emptyAfterLoadFailure')}
                description={t('pages.petFinder.loadFailedDescription')}
                actions={[
                  {
                    key: 'retry',
                    label: t('messages.retry'),
                    onClick: retryFinderProducts,
                    type: 'primary',
                  },
                  {
                    key: 'browse',
                    label: t('pages.petFinder.browseAll'),
                    onClick: () => navigate('/products'),
                    type: 'default',
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
                  {
                    key: 'support',
                    label: t('pages.productList.loadRecoverySupport'),
                    onClick: () => dispatchDomEvent('shop:open-support'),
                    type: 'default',
                  },
                ]}
              />
            ) : (
              <PageEmpty
                className="pet-finder-page__empty"
                data-pet-finder-empty-actions="true"
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
                    icon: <ShopIcon path={SI.search} />,
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
            <div className="pet-finder-page__recommendationGrid">
              {matches.map(({ product, score }) => {
                const productName = finderProductName(product);
                const viewLabel = `${t('pages.petFinder.view')}: ${productName}`;
                return (
                  <div key={product.id} className="pet-finder-page__recommendationItem">
                    <article className="pet-finder-page__productCard" aria-label={viewLabel}>
                      <div className="pet-finder-page__productCover">
                        <button type="button" className="pet-finder-page__productImageButton" aria-label={viewLabel} title={viewLabel} onClick={() => navigate(`/products/${product.id}`)}>
                          <img
                            className="pet-finder-page__productImage"
                            src={resolveProductImage(product.imageUrl)}
                            alt={productName}
                            height={180}
                            loading="lazy"
                            decoding="async"
                            onError={(event) => {
                              if (event.currentTarget.src !== productImageFallback) {
                                event.currentTarget.src = productImageFallback;
                              }
                            }}
                          />
                        </button>
                      </div>
                      <div className="pet-finder-page__productBody">
                        <span className="pet-finder-page__text pet-finder-page__text--strong pet-finder-page__productName" title={productName}>{productName}</span>
                        <span className="pet-finder-page__text pet-finder-page__text--strong commerce-money pet-finder-page__productPrice">{formatMoney(productPrice(product))}</span>
                        <div className="pet-finder-page__productTags">
                          {isInStock(product) ? <Tag color="green">{t('pages.productDetail.enough')}</Tag> : <Tag color="red">{t('pages.productList.soldOut')}</Tag>}
                          {(product.effectiveDiscountPercent || product.discount || 0) > 0 ? <Tag color="volcano">{t('pages.productList.sale')}</Tag> : null}
                          <Tag color="blue">{t('pages.petFinder.matchScore', { score: Math.max(0, Math.round(score)) })}</Tag>
                        </div>
                      </div>
                      <div className="pet-finder-page__productActions">
                        <Button type="link" onClick={() => navigate(`/products/${product.id}`)} aria-label={viewLabel} title={viewLabel}>
                          {t('pages.petFinder.view')}
                        </Button>
                      </div>
                    </article>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default PetFinder;
