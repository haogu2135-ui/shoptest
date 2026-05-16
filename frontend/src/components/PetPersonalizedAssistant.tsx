import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Skeleton, Tag, Typography, message } from 'antd';
import { CompassOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { apiBaseUrl, petProfileApi, productApi } from '../api';
import type { PetProfile, Product } from '../types';
import { useLanguage } from '../i18n';
import { useMarket } from '../hooks/useMarket';
import { localizeProduct } from '../utils/localizedProduct';
import { needsOptionSelection } from '../utils/productOptions';
import './PetPersonalizedAssistant.css';

const { Text, Title } = Typography;

const personalizedImageFallback = 'https://images.unsplash.com/photo-1601758125946-6ec2ef64daf8?auto=format&fit=crop&w=900&q=80';

const resolveAssistantImage = (imageUrl?: string) => {
  if (!imageUrl) return personalizedImageFallback;
  if (/^(https?:|data:|blob:)/i.test(imageUrl)) return imageUrl;
  return `${apiBaseUrl}${imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`}`;
};

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
  const isAuthenticated = Boolean(localStorage.getItem('token'));
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
            .filter((product) => (product.status || 'ACTIVE') === 'ACTIVE' && (product.stock === undefined || product.stock > 0))
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

  const handlePrimaryAction = async (product: Product) => {
    if (needsOptionSelection(product) || !onAdd) {
      navigate(`/products/${product.id}`);
      return;
    }
    setAddingId(product.id);
    try {
      await onAdd(product);
      setProducts((current) => current.filter((item) => item.id !== product.id));
      message.success(t('messages.addCartSuccess'));
    } catch (error: any) {
      message.error(error?.response?.data?.error || t('messages.addFailed'));
    } finally {
      setAddingId(null);
    }
  };

  if (!isAuthenticated) return null;

  if (loading) {
    return (
      <section className={`pet-personalized-assistant pet-personalized-assistant--${variant}`}>
        <Skeleton active paragraph={{ rows: variant === 'compact' ? 3 : 4 }} />
      </section>
    );
  }

  if (petProfiles.length === 0) {
    return (
      <section className={`pet-personalized-assistant pet-personalized-assistant--${variant}`}>
        <div className="pet-personalized-assistant__header">
          <div>
            <span className="pet-personalized-assistant__eyebrow">{t('home.petRecommendations')}</span>
            <Title level={variant === 'compact' ? 5 : 4}>{t('home.managePetProfiles')}</Title>
            <Text type="secondary">{t('pages.productList.personalGuideEmpty')}</Text>
          </div>
          <div className="pet-personalized-assistant__actions">
            <Button type="primary" onClick={openPetProfiles}>
              {t('pages.profile.addPet')}
            </Button>
            {variant === 'default' ? (
              <Button onClick={browseProducts}>{t('pages.cart.browse')}</Button>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  if (displayProducts.length === 0) return null;

  return (
    <section className={`pet-personalized-assistant pet-personalized-assistant--${variant}`}>
      <div className="pet-personalized-assistant__header">
        <div>
          <span className="pet-personalized-assistant__eyebrow">
            <CompassOutlined /> {t('home.petRecommendations')}
          </span>
          <Title level={variant === 'compact' ? 5 : 4}>
            {leadPet
              ? t('pages.profile.petShopPathTitleWithName', { name: leadPet.name })
              : t('home.petRecommendations')}
          </Title>
          <Text type="secondary">{t('home.petRecommendationsHint')}</Text>
        </div>
        <div className="pet-personalized-assistant__actions">
          <Button onClick={openPetProfiles}>{t('pages.productList.managePetProfile')}</Button>
          {variant === 'default' ? (
            <Button type="primary" ghost onClick={browseProducts}>
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
          const hasOptions = needsOptionSelection(product);
          const showDeal = isDealProduct(product);
          const price = Number(product.effectivePrice ?? product.price ?? 0);
          const rating = Number(product.averageRating || product.rating || 0);
          return (
            <article key={product.id} className="pet-personalized-assistant__card">
              <button
                type="button"
                className="pet-personalized-assistant__media"
                onClick={() => navigate(`/products/${product.id}`)}
              >
                <img
                  src={resolveAssistantImage(product.imageUrl)}
                  alt={product.name}
                  loading="lazy"
                  decoding="async"
                  onError={(event) => {
                    if (event.currentTarget.src !== personalizedImageFallback) {
                      event.currentTarget.src = personalizedImageFallback;
                    }
                  }}
                />
              </button>
              <div className="pet-personalized-assistant__body">
                <button
                  type="button"
                  className="pet-personalized-assistant__name"
                  onClick={() => navigate(`/products/${product.id}`)}
                >
                  {product.name}
                </button>
                <div className="pet-personalized-assistant__meta">
                  <Text strong className="pet-personalized-assistant__price">{formatMoney(price)}</Text>
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
                    icon={hasOptions ? undefined : <ShoppingCartOutlined />}
                    loading={addingId === product.id}
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
