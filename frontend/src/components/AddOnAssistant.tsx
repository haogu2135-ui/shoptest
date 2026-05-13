import React, { useEffect, useMemo, useState } from 'react';
import { Button, Skeleton, Typography, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { apiBaseUrl, productApi } from '../api';
import type { Product } from '../types';
import { useLanguage } from '../i18n';
import { useMarket } from '../hooks/useMarket';
import { localizeProduct } from '../utils/localizedProduct';
import { conversionConfig } from '../utils/conversionConfig';
import { needsOptionSelection } from '../utils/productOptions';
import './AddOnAssistant.css';

const { Text } = Typography;

const addOnImageFallback = 'https://images.unsplash.com/photo-1601758125946-6ec2ef64daf8?auto=format&fit=crop&w=900&q=80';
const ADD_ON_PRODUCT_CACHE_MS = 60_000;
let addOnProductCache: { products: Product[]; expiresAt: number } | null = null;
let addOnProductRequest: Promise<Product[]> | null = null;

const getAddOnPrice = (product: Product) => Number(product.effectivePrice ?? product.price ?? 0);

const isReadyAddOnProduct = (product: Product) =>
  (product.status || 'ACTIVE') === 'ACTIVE'
  && (product.stock === undefined || product.stock > 0)
  && !needsOptionSelection(product)
  && getAddOnPrice(product) > 0;

const loadAddOnProducts = async () => {
  const now = Date.now();
  if (addOnProductCache && addOnProductCache.expiresAt > now) {
    return addOnProductCache.products;
  }
  if (!addOnProductRequest) {
    addOnProductRequest = productApi.getAll()
      .then((response) => {
        const products = response.data.filter(isReadyAddOnProduct);
        addOnProductCache = {
          products,
          expiresAt: Date.now() + ADD_ON_PRODUCT_CACHE_MS,
        };
        return products;
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
    const cartFilteredProducts = products.filter((product) => !cartIds.has(product.id));
    const targetWindowProducts = cartFilteredProducts
      .filter((product) => {
        const price = getAddOnPrice(product);
        return price >= floor && price <= ceiling;
      });
    const fallbackProducts = cartFilteredProducts
      .filter((product) => getAddOnPrice(product) >= remainingAmount)
      .sort((left, right) => getAddOnPrice(left) - getAddOnPrice(right))
      .slice(0, conversionConfig.addOnAssistant.maxFallbackSuggestions || 1);
    const uniqueProducts = [...targetWindowProducts, ...fallbackProducts]
      .filter((product, index, list) => list.findIndex((item) => item.id === product.id) === index);
    return uniqueProducts
      .sort((left, right) => {
        const leftPrice = getAddOnPrice(left);
        const rightPrice = getAddOnPrice(right);
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
              <Text strong className="add-on-assistant__price">{formatMoney(getAddOnPrice(product))}</Text>
              {getAddOnPrice(product) >= remainingAmount ? (
                <Text className="add-on-assistant__fit">{t('pages.addOnAssistant.coversGap')}</Text>
              ) : null}
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
