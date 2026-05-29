import React, { useEffect, useMemo, useState } from 'react';
import { Button, Skeleton, Typography, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { productApi } from '../api';
import type { Product } from '../types';
import { useLanguage } from '../i18n';
import { useMarket } from '../hooks/useMarket';
import { localizeProduct } from '../utils/localizedProduct';
import { conversionConfig } from '../utils/conversionConfig';
import { buildResponsiveImageSrcSet, getOptimizedImageUrl } from '../utils/mediaAssets';
import { needsOptionSelection } from '../utils/productOptions';
import { productImageFallback, resolveProductImage } from '../utils/productMedia';
import { getApiErrorMessage } from '../utils/apiError';
import './AddOnAssistant.css';

const { Text } = Typography;

const getAddOnPrice = (product: Product) => Number(product.effectivePrice ?? product.price ?? 0);
const ADD_ON_CACHE_TTL_MS = 2 * 60 * 1000;
const addOnCandidateCache = new Map<string, { expiresAt: number; products: Product[] }>();

interface AddOnAssistantProps {
  cartProductIds: number[];
  remainingAmount: number;
  reason: 'shipping' | 'gift';
  onAdd: (product: Product) => Promise<void>;
}

const AddOnAssistant: React.FC<AddOnAssistantProps> = ({ cartProductIds, remainingAmount, reason, onAdd }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<number | null>(null);
  const { t, language } = useLanguage();
  const { formatMoney } = useMarket();
  const shouldLoadProducts = conversionConfig.addOnAssistant.enabled && remainingAmount > 0;
  const excludedKey = useMemo(
    () => Array.from(new Set(cartProductIds.map(Number).filter(Boolean))).sort((left, right) => left - right).join(','),
    [cartProductIds],
  );
  const excludedProductIds = useMemo(
    () => (excludedKey ? excludedKey.split(',').map((value) => Number(value)).filter(Boolean) : []),
    [excludedKey],
  );

  useEffect(() => {
    if (!shouldLoadProducts) return;
    const cacheKey = `${language}|${remainingAmount}|${excludedKey}`;
    const cached = addOnCandidateCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      setProducts(cached.products);
      return;
    }
    setLoading(true);
    productApi.getAddOnCandidates(
      remainingAmount,
      excludedProductIds,
      conversionConfig.addOnAssistant.maxSuggestions + conversionConfig.addOnAssistant.maxFallbackSuggestions,
    )
      .then((response) => {
        const localizedProducts = response.data
          .map((product) => localizeProduct(product, language))
          .filter((product) => !needsOptionSelection(product))
          .filter((product) => (product.status || 'ACTIVE') === 'ACTIVE' && (product.stock === undefined || product.stock > 0));
        addOnCandidateCache.set(cacheKey, {
          expiresAt: Date.now() + ADD_ON_CACHE_TTL_MS,
          products: localizedProducts,
        });
        setProducts(localizedProducts);
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [excludedKey, excludedProductIds, language, remainingAmount, shouldLoadProducts]);

  const suggestions = useMemo(() => {
    if (!conversionConfig.addOnAssistant.enabled || remainingAmount <= 0) return [];
    return products.slice(0, conversionConfig.addOnAssistant.maxSuggestions);
  }, [products, remainingAmount]);
  const insightBadges = [
    reason === 'gift' ? t('pages.addOnAssistant.giftBadge') : t('pages.addOnAssistant.shippingBadge'),
    t('pages.addOnAssistant.quickAddBadge'),
  ];

  const handleAdd = async (product: Product) => {
    setAddingId(product.id);
    try {
      await onAdd(product);
      setProducts((current) => current.filter((item) => item.id !== product.id));
      message.success(t('pages.addOnAssistant.added'));
    } catch (error: any) {
      message.error(getApiErrorMessage(error, t('messages.addFailed'), language));
    } finally {
      setAddingId(null);
    }
  };

  if (!conversionConfig.addOnAssistant.enabled || remainingAmount <= 0) return null;
  if (loading) {
    return (
      <section className="add-on-assistant">
        <Skeleton active paragraph={{ rows: 2 }} />
      </section>
    );
  }
  if (suggestions.length === 0) return null;

  return (
    <section className="add-on-assistant">
      <div className="add-on-assistant__header">
        <div>
          <Text strong>{t('pages.addOnAssistant.title')}</Text>
          <Text type="secondary">
            {reason === 'gift'
              ? t('pages.addOnAssistant.giftHint', { amount: formatMoney(remainingAmount) })
              : t('pages.addOnAssistant.shippingHint', { amount: formatMoney(remainingAmount) })}
          </Text>
        </div>
        <span className="add-on-assistant__target commerce-money">{formatMoney(remainingAmount)}</span>
      </div>
      <div className="add-on-assistant__badges">
        {insightBadges.map((badge) => <span key={badge}>{badge}</span>)}
      </div>
      <div className="add-on-assistant__list">
        {suggestions.map((product) => (
          <article key={product.id} className="add-on-assistant__item">
            <img
              src={getOptimizedImageUrl(resolveProductImage(product.imageUrl), 112)}
              srcSet={buildResponsiveImageSrcSet(resolveProductImage(product.imageUrl), [80, 112, 160])}
              sizes="56px"
              alt={product.name}
              width={56}
              height={56}
              loading="lazy"
              decoding="async"
              onError={(event) => {
                if (event.currentTarget.src !== productImageFallback) {
                  event.currentTarget.removeAttribute('srcset');
                  event.currentTarget.src = productImageFallback;
                }
              }}
            />
            <div className="add-on-assistant__body">
              <Text className="add-on-assistant__name">{product.name}</Text>
              <div className="add-on-assistant__meta">
                <Text strong className="add-on-assistant__price commerce-money">{formatMoney(getAddOnPrice(product))}</Text>
                {getAddOnPrice(product) >= remainingAmount ? (
                  <Text className="add-on-assistant__fit">{t('pages.addOnAssistant.coversGap')}</Text>
                ) : null}
              </div>
            </div>
            <Button
              size="small"
              type="primary"
              icon={<PlusOutlined />}
              loading={addingId === product.id}
              onClick={() => handleAdd(product)}
            >
              {t('pages.addOnAssistant.add')}
            </Button>
          </article>
        ))}
      </div>
    </section>
  );
};

export default AddOnAssistant;
