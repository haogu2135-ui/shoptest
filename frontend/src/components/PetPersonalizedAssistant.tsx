import React, { useEffect, useMemo, useState } from 'react';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { ShopIcon, SI } from './ShopIcon';
import { Alert, Button, Skeleton, Tag, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { petProfileApi, productApi } from '../api';
import type { PetProfile, ProductPublic as Product } from '../types';
import { useLanguage } from '../i18n';
import { useMarket } from '../hooks/useMarket';
import { localizeProduct } from '../utils/localizedProduct';
import { buildResponsiveImageSrcSet, getOptimizedImageUrl } from '../utils/mediaAssets';
import { needsOptionSelection } from '../utils/productOptions';
import { productImageFallback, resolveProductImage } from '../utils/productMedia';
import { hasStoredValue } from '../utils/safeStorage';
import { getApiErrorMessage } from '../utils/apiError';
import './PetPersonalizedAssistant.css';
import '../styles/mobile-page-contrast.css';

const { Text, Title } = Typography;

const isDealProduct = (product: Product) =>
  Boolean(product.activeLimitedTimeDiscount) ||
  Number(product.effectiveDiscountPercent || product.discount || 0) > 0 ||
  (product.originalPrice !== undefined && Number(product.originalPrice) > Number(product.effectivePrice ?? product.price ?? 0));

interface PetPersonalizedAssistantProps {
  onAdd?: (product: Product) => Promise<void>;
  excludedProductIds?: number[];
  variant?: 'default' | 'compact';
}

const PetPersonalizedAssistant: React.FC<PetPersonalizedAssistantProps> = ({
  onAdd,
  excludedProductIds = [],
  variant = 'default',
}) => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { formatMoney } = useMarket();
  const [products, setProducts] = useState<Product[]>([]);
  const [petProfiles, setPetProfiles] = useState<PetProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<number | null>(null);
  const isAuthenticated = hasStoredValue('token');
  const excludedKey = useMemo(
    () => Array.from(new Set(excludedProductIds.map(Number).filter(Boolean))).sort((left, right) => left - right).join(','),
    [excludedProductIds],
  );

  useEffect(() => {
    let cancelled = false;
    if (!isAuthenticated) {
      setProducts([]);
      setPetProfiles([]);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    Promise.allSettled([
      petProfileApi.getMine(),
      productApi.getPersonalizedRecommendations(),
    ])
      .then(([petProfilesResult, recommendationsResult]) => {
        if (cancelled) return;
        const excludedSet = new Set(
          excludedKey
            ? excludedKey.split(',').map((value) => Number(value)).filter(Boolean)
            : [],
        );
        const nextPetProfiles = petProfilesResult.status === 'fulfilled' ? (petProfilesResult.value.data || []) : [];
        const nextProducts = recommendationsResult.status === 'fulfilled'
          ? (recommendationsResult.value.data || [])
            .map((product) => localizeProduct(product, language))
            .filter((product) => !excludedSet.has(product.id))
            .filter((product) => product.stock === undefined || product.stock > 0)
          : [];
        setPetProfiles(nextPetProfiles);
        setProducts(nextProducts);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [excludedKey, isAuthenticated, language]);

  const displayProducts = useMemo(
    () => products.slice(0, variant === 'compact' ? 2 : 3),
    [products, variant],
  );
  const leadPet = petProfiles[0];
  const quickAddReadyCount = products.filter((product) => !needsOptionSelection(product)).length;
  const dealCount = products.filter(isDealProduct).length;

  const openPetProfiles = () => navigate('/profile?tab=pets');
  const browseProducts = () => navigate('/products');
  const leadPetName = leadPet?.name?.trim();
  const petRecommendationContextLabel = leadPetName
    ? `${t('home.petRecommendations')}: ${leadPetName}`
    : t('home.petRecommendations');
  const addPetProfileActionLabel = `${t('pages.profile.addPet')}: ${t('home.petRecommendations')}`;
  const browsePersonalizedActionLabel = `${t('pages.cart.browse')}: ${t('home.petRecommendations')}`;
  const managePetProfileActionLabel = `${t('pages.productList.managePetProfile')}: ${petRecommendationContextLabel}`;
  const viewPetPicksActionLabel = `${t('pages.productList.viewPick')}: ${petRecommendationContextLabel}`;

  const handlePrimaryAction = async (product: Product) => {
    if (needsOptionSelection(product) || !onAdd) {
      navigate(`/products/${product.id}`);
      return;
    }
    setAddingId(product.id);
    try {
      await onAdd(product);
      setProducts((current) => current.filter((item) => item.id !== product.id));
      announceAccessibleMessage(t('messages.addCartSuccess'), 'success');
    } catch (error: unknown) {
      announceAccessibleMessage(getApiErrorMessage(error, t('messages.addFailed'), language), 'error');
    } finally {
      setAddingId(null);
    }
  };

  if (!isAuthenticated) return null;

  if (loading) {
    return (
      <section
        className={`pet-personalized-assistant pet-personalized-assistant--${variant}`}
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={`${t('home.petRecommendations')}: ${t('common.loading')}`}
      >
        <Skeleton active paragraph={{ rows: variant === 'compact' ? 3 : 4 }} />
      </section>
    );
  }

  if (petProfiles.length === 0) {
    return (
      <section className={`pet-personalized-assistant pet-personalized-assistant--${variant}`} aria-label={t('home.petRecommendations')}>
        <div className="pet-personalized-assistant__header">
          <div>
            <span className="pet-personalized-assistant__eyebrow">{t('home.petRecommendations')}</span>
            <Title level={variant === 'compact' ? 5 : 4}>{t('home.managePetProfiles')}</Title>
            <Text type="secondary">{t('pages.productList.personalGuideEmpty')}</Text>
          </div>
          <div className="pet-personalized-assistant__actions">
            <Button
              type="primary"
              aria-label={addPetProfileActionLabel}
              title={addPetProfileActionLabel}
              onClick={openPetProfiles}
            >
              {t('pages.profile.addPet')}
            </Button>
            {variant === 'default' ? (
              <Button aria-label={browsePersonalizedActionLabel} title={browsePersonalizedActionLabel} onClick={browseProducts}>
                {t('pages.cart.browse')}
              </Button>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  if (displayProducts.length === 0) return null;

  return (
    <section className={`pet-personalized-assistant pet-personalized-assistant--${variant}`} aria-label={petRecommendationContextLabel}>
      <div className="pet-personalized-assistant__header">
        <div>
          <span className="pet-personalized-assistant__eyebrow">
            <ShopIcon path={SI.compass} /> {t('home.petRecommendations')}
          </span>
          <Title level={variant === 'compact' ? 5 : 4}>
            {leadPet
              ? t('pages.profile.petShopPathTitleWithName', { name: leadPet.name })
              : t('home.petRecommendations')}
          </Title>
          <Text type="secondary">{t('home.petRecommendationsHint')}</Text>
        </div>
        <div className="pet-personalized-assistant__actions">
          <Button aria-label={managePetProfileActionLabel} title={managePetProfileActionLabel} onClick={openPetProfiles}>
            {t('pages.productList.managePetProfile')}
          </Button>
          {variant === 'default' ? (
            <Button type="primary" ghost aria-label={viewPetPicksActionLabel} title={viewPetPicksActionLabel} onClick={browseProducts}>
              {t('pages.productList.viewPick')}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="pet-personalized-assistant__stats">
        <span>{t('home.petRecommendationInsightPetProfile')}</span>
        <Tag>{t('home.petRecommendationReady', { count: quickAddReadyCount })}</Tag>
        <Tag>{t('home.petRecommendationDeals', { count: dealCount })}</Tag>
      </div>

      <div className="pet-personalized-assistant__list">
        {displayProducts.map((product) => {
          const productName = (product.name || '').trim() || t('pages.profile.productFallback', { id: product.id });
          const hasOptions = needsOptionSelection(product);
          const showDeal = isDealProduct(product);
          const price = Number(product.effectivePrice ?? product.price ?? 0);
          const rating = Number(product.averageRating || 0);
          const productViewActionLabel = `${t('pages.productList.viewPick')}: ${productName} - ${petRecommendationContextLabel}`;
          const productPrimaryActionLabel = `${hasOptions ? t('pages.wishlist.selectOptions') : t('pages.productList.quickAdd')}: ${productName} - ${petRecommendationContextLabel}`;
          return (
            <article key={product.id} className="pet-personalized-assistant__card">
              <button
                type="button"
                className="pet-personalized-assistant__media"
                aria-label={productViewActionLabel}
                title={productViewActionLabel}
                onClick={() => navigate(`/products/${product.id}`)}
              >
                <img
                  src={getOptimizedImageUrl(resolveProductImage(product.imageUrl), variant === 'compact' ? 176 : 420)}
                  srcSet={buildResponsiveImageSrcSet(resolveProductImage(product.imageUrl), variant === 'compact' ? [88, 176, 264] : [240, 360, 480])}
                  sizes={variant === 'compact' ? '88px' : '(max-width: 900px) calc(100vw - 72px), 33vw'}
                  alt={productName}
                  width={variant === 'compact' ? 88 : 320}
                  height={variant === 'compact' ? 88 : 320}
                  loading="lazy"
                  decoding="async"
                  onError={(event) => {
                    if (event.currentTarget.src !== productImageFallback) {
                      event.currentTarget.removeAttribute('srcset');
                      event.currentTarget.src = productImageFallback;
                    }
                  }}
                />
              </button>
              <div className="pet-personalized-assistant__body">
                <button
                  type="button"
                  className="pet-personalized-assistant__name"
                  aria-label={productViewActionLabel}
                  title={productViewActionLabel}
                  onClick={() => navigate(`/products/${product.id}`)}
                >
                  {productName}
                </button>
                <div className="pet-personalized-assistant__meta">
                  <Text strong className="pet-personalized-assistant__price commerce-money">{formatMoney(price)}</Text>
                  {rating > 0 ? (
                    <Text type="secondary">{rating.toFixed(1)}</Text>
                  ) : null}
                  {showDeal ? (
                    <Tag color="gold">{t('home.flashOffers')}</Tag>
                  ) : null}
                </div>
                <div className="pet-personalized-assistant__foot">
                  <Alert
                    className="pet-personalized-assistant__insight"
                    type="info"
                    showIcon={false}
                    message={t('home.petRecommendationInsightTitle')}
                    description={t('home.petRecommendationInsightPetProfile')}
                  />
                  <Button
                    type="primary"
                    icon={hasOptions ? undefined : <ShopIcon path={SI.cart} />}
                    loading={addingId === product.id}
                    aria-label={productPrimaryActionLabel}
                    title={productPrimaryActionLabel}
                    onClick={() => handlePrimaryAction(product)}
                  >
                    {hasOptions ? t('pages.wishlist.selectOptions') : t('pages.productList.quickAdd')}
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default PetPersonalizedAssistant;
