import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Empty, Image, Row, Select, Slider, Space, Spin, Tag, Typography, message } from 'antd';
import { GiftOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { productApi } from '../api';
import { useLanguage } from '../i18n';
import { useMarket } from '../hooks/useMarket';
import type { Product } from '../types';
import { localizeProduct } from '../utils/localizedProduct';

const { Title, Text, Paragraph } = Typography;

type PetType = 'all' | 'dog' | 'cat' | 'small';
type NeedType = 'all' | 'play' | 'walk' | 'sleep' | 'smart' | 'groom' | 'food';
type Priority = 'best' | 'rating' | 'deal' | 'budget';

const FINDER_STORAGE_KEY = 'shop-pet-finder-preferences';

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

const readPreferences = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(FINDER_STORAGE_KEY) || '{}');
    return {
      petType: (parsed.petType || 'all') as PetType,
      need: (parsed.need || 'all') as NeedType,
      priority: (parsed.priority || 'best') as Priority,
      budget: Array.isArray(parsed.budget) ? parsed.budget as [number, number] : [0, 500] as [number, number],
    };
  } catch {
    return { petType: 'all' as PetType, need: 'all' as NeedType, priority: 'best' as Priority, budget: [0, 500] as [number, number] };
  }
};

const productText = (product: Product) => [
  product.name,
  product.description,
  product.brand,
  product.categoryName,
  product.tag,
  ...Object.entries(product.specifications || {}).flatMap(([key, value]) => [key, value]),
].join(' ').toLowerCase();

const productPrice = (product: Product) => product.effectivePrice ?? product.price;
const isInStock = (product: Product) => product.stock === undefined || product.stock > 0;

const PetFinder: React.FC = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { formatMoney } = useMarket();
  const stored = useMemo(() => readPreferences(), []);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [petType, setPetType] = useState<PetType>(stored.petType);
  const [need, setNeed] = useState<NeedType>(stored.need);
  const [budget, setBudget] = useState<[number, number]>(stored.budget);
  const [priority, setPriority] = useState<Priority>(stored.priority);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const res = await productApi.getAll();
        setProducts(res.data.map((product) => localizeProduct(product, language)));
      } catch {
        message.error(t('pages.petFinder.loadFailed'));
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [language, t]);

  useEffect(() => {
    localStorage.setItem(FINDER_STORAGE_KEY, JSON.stringify({ petType, need, budget, priority }));
  }, [budget, need, petType, priority]);

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
      const rating = Number(product.averageRating || product.rating || 0);
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
      .filter((item) => item.budgetFit || item.keywordHits > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
  }, [budget, need, petType, priority, products]);

  const applyAsSearch = () => {
    const terms = [
      petType !== 'all' ? t(`pages.petFinder.petTypes.${petType}`) : '',
      need !== 'all' ? t(`pages.petFinder.needs.${need}`) : '',
    ].filter(Boolean).join(' ');
    navigate(`/products${terms ? `?keyword=${encodeURIComponent(terms)}` : ''}`);
  };

  return (
    <div style={{ width: 'min(1200px, calc(100% - 24px))', margin: '0 auto', padding: '24px 0' }}>
      <div style={{ display: 'grid', gap: 18 }}>
        <Card>
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
                <Col xs={24} sm={12}>
                  <Text strong>{t('pages.petFinder.petType')}</Text>
                  <Select
                    value={petType}
                    onChange={setPetType}
                    style={{ width: '100%', marginTop: 6 }}
                    options={(['all', 'dog', 'cat', 'small'] as PetType[]).map((value) => ({ value, label: t(`pages.petFinder.petTypes.${value}`) }))}
                  />
                </Col>
                <Col xs={24} sm={12}>
                  <Text strong>{t('pages.petFinder.need')}</Text>
                  <Select
                    value={need}
                    onChange={setNeed}
                    style={{ width: '100%', marginTop: 6 }}
                    options={(['all', 'play', 'walk', 'sleep', 'smart', 'groom', 'food'] as NeedType[]).map((value) => ({ value, label: t(`pages.petFinder.needs.${value}`) }))}
                  />
                </Col>
                <Col xs={24} sm={12}>
                  <Text strong>{t('pages.petFinder.budget')}</Text>
                  <Slider range min={0} max={500} value={budget} onChange={(value) => setBudget(value as [number, number])} />
                  <Text type="secondary">{formatMoney(budget[0])} - {formatMoney(budget[1])}</Text>
                </Col>
                <Col xs={24} sm={12}>
                  <Text strong>{t('pages.petFinder.priority')}</Text>
                  <Select
                    value={priority}
                    onChange={setPriority}
                    style={{ width: '100%', marginTop: 6 }}
                    options={(['best', 'rating', 'deal', 'budget'] as Priority[]).map((value) => ({ value, label: t(`pages.petFinder.priorities.${value}`) }))}
                  />
                </Col>
              </Row>
            </Col>
          </Row>
        </Card>

        <Card
          title={t('pages.petFinder.results', { count: matches.length })}
          extra={<Button icon={<SearchOutlined />} onClick={applyAsSearch}>{t('pages.petFinder.searchAll')}</Button>}
        >
          {loading ? (
            <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
          ) : matches.length === 0 ? (
            <Empty description={t('pages.petFinder.empty')} />
          ) : (
            <Row gutter={[16, 16]}>
              {matches.map(({ product, score }) => (
                <Col key={product.id} xs={24} sm={12} md={8} lg={6}>
                  <Card
                    hoverable
                    cover={
                      <Image
                        src={product.imageUrl}
                        alt={product.name}
                        preview={false}
                        height={180}
                        style={{ objectFit: 'cover' }}
                        onClick={() => navigate(`/products/${product.id}`)}
                      />
                    }
                    actions={[
                      <Button type="link" onClick={() => navigate(`/products/${product.id}`)}>
                        {t('pages.petFinder.view')}
                      </Button>,
                    ]}
                  >
                    <Space direction="vertical" size={6} style={{ width: '100%' }}>
                      <Text strong ellipsis={{ tooltip: product.name }}>{product.name}</Text>
                      <Text strong style={{ color: '#ee4d2d' }}>{formatMoney(productPrice(product))}</Text>
                      <Space wrap size={[4, 4]}>
                        {isInStock(product) ? <Tag color="green">{t('pages.productDetail.enough')}</Tag> : <Tag color="red">{t('pages.productList.soldOut')}</Tag>}
                        {(product.effectiveDiscountPercent || product.discount || 0) > 0 ? <Tag color="volcano">{t('pages.productList.sale')}</Tag> : null}
                        <Tag color="blue">{t('pages.petFinder.matchScore', { score: Math.max(0, Math.round(score)) })}</Tag>
                      </Space>
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </Card>
      </div>
    </div>
  );
};

export default PetFinder;
