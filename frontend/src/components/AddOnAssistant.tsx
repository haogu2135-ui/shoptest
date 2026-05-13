import React, { useEffect, useMemo, useState } from 'react';
import { Button, Skeleton, Typography, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { apiBaseUrl, productApi } from '../api';
import type { Product } from '../types';
import { useLanguage } from '../i18n';
import { useMarket } from '../hooks/useMarket';
import { localizeProduct } from '../utils/localizedProduct';
import { conversionConfig } from '../utils/conversionConfig';
import './AddOnAssistant.css';

const { Text } = Typography;

const addOnImageFallback = 'https://images.unsplash.com/photo-1601758125946-6ec2ef64daf8?auto=format&fit=crop&w=900&q=80';
const ADD_ON_PRODUCT_CACHE_MS = 60_000;
let addOnProductCache: { products: Product[]; expiresAt: number } | null = null;
let addOnProductRequest: Promise<Product[]> | null = null;

const loadAddOnProducts = async () => {
  const now = Date.now();
  if (addOnProductCache && addOnProductCache.expiresAt > now) {
    return addOnProductCache.products;
  }
  if (!addOnProductRequest) {
    addOnProductRequest = productApi.getAll()
      .then((response) => {
        addOnProductCache = {
          products: response.data,
          expiresAt: Date.now() + ADD_ON_PRODUCT_CACHE_MS,
        };
        return response.data;
      })
      .finally(() => {
        addOnProductRequest = null;
      });
  }
  return addOnProductRequest;
};

const resolveImage = (imageUrl?: string) => {
  if (!imageUrl) return addOnImageFallback;
  if (/^(https?:|data:|blob:)/i.test(imageUrl)) return imageUrl;
  return `${apiBaseUrl}${imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`}`;
};

const needsOptionSelection = (product: Product) =>
  Boolean((product.variants && product.variants.length > 0) || (product.sizes && product.sizes.length > 0) || (product.colors && product.colors.length > 0));

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

  useEffect(() => {
    if (!shouldLoadProducts) return;
    setLoading(true);
    loadAddOnProducts()
      .then((items) => setProducts(items.map((product) => localizeProduct(product, language))))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [language, shouldLoadProducts]);

  const suggestions = useMemo(() => {
    if (!conversionConfig.addOnAssistant.enabled || remainingAmount <= 0) return [];
    const cartIds = new Set(cartProductIds);
    const floor = Math.max(0, remainingAmount * conversionConfig.addOnAssistant.priceFloorRatio);
    const ceiling = Math.max(
      conversionConfig.addOnAssistant.priceCeilingMxn,
      remainingAmount * conversionConfig.addOnAssistant.priceCeilingRatio,
    );
    return products
      .filter((product) => {
        const price = product.effectivePrice ?? product.price;
        return !cartIds.has(product.id)
          && (product.status || 'ACTIVE') === 'ACTIVE'
          && (product.stock === undefined || product.stock > 0)
          && !needsOptionSelection(product)
          && price >= floor
          && price <= ceiling;
      })
      .sort((left, right) => {
        const leftPrice = left.effectivePrice ?? left.price;
        const rightPrice = right.effectivePrice ?? right.price;
        return Math.abs(leftPrice - remainingAmount) - Math.abs(rightPrice - remainingAmount)
          || (right.reviewCount || 0) - (left.reviewCount || 0)
          || leftPrice - rightPrice;
      })
      .slice(0, conversionConfig.addOnAssistant.maxSuggestions);
  }, [cartProductIds, products, remainingAmount]);

  const handleAdd = async (product: Product) => {
    setAddingId(product.id);
    try {
      await onAdd(product);
      message.success(t('pages.addOnAssistant.added'));
    } catch (error: any) {
      message.error(error?.response?.data?.error || t('messages.addFailed'));
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
      </div>
      <div className="add-on-assistant__list">
        {suggestions.map((product) => (
          <article key={product.id} className="add-on-assistant__item">
            <img
              src={resolveImage(product.imageUrl)}
              alt={product.name}
              onError={(event) => {
                if (event.currentTarget.src !== addOnImageFallback) {
                  event.currentTarget.src = addOnImageFallback;
                }
              }}
            />
            <div className="add-on-assistant__body">
              <Text className="add-on-assistant__name">{product.name}</Text>
              <Text strong className="add-on-assistant__price">{formatMoney(product.effectivePrice ?? product.price)}</Text>
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
