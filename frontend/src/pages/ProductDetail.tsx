import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Row, Col, Card, Button, Tag, Divider, Typography, Spin, Radio, Rate, Carousel, Modal, Space, Breadcrumb, Tabs, message, List, Input, Segmented } from 'antd';
import { HomeOutlined, ShoppingCartOutlined, HeartOutlined, HeartFilled, CheckCircleOutlined, TruckOutlined, SafetyCertificateOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { productApi, cartApi, reviewApi, wishlistApi, questionApi } from '../api';
import { useNavigate } from 'react-router-dom';
import { ProductReview } from '../components/ProductReview';
import { useLanguage } from '../i18n';
import type { Order, Product } from '../types';
import type { ProductVariant } from '../types';
import type { ProductQuestion } from '../types';
import { useMarket } from '../hooks/useMarket';
import ProductRichDetail from '../components/ProductRichDetail';
import { localizeProduct } from '../utils/localizedProduct';
import { addGuestCartItem } from '../utils/guestCart';
import './ProductDetail.css';

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const subscriptionOptions = [
  { label: 'Every 2 weeks', value: '2w' },
  { label: 'Every month', value: '4w' },
  { label: 'Every 2 months', value: '8w' },
];

interface Review {
  id: number;
  userId: number;
  productId: number;
  rating: number;
  comment: string;
  username: string;
  createdAt: string;
  orderId?: number;
  adminReply?: string;
  repliedAt?: string;
}

const fallbackProductImage = 'https://images.unsplash.com/photo-1607083206968-13611e3d76db?auto=format&fit=crop&w=900&q=80';

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

const normalizeProductImages = (product: any) => {
  const rawImages = parseImageList(product?.images);
  const images = [product?.imageUrl, ...rawImages]
    .map((image) => String(image || '').trim())
    .filter(Boolean);
  return Array.from(new Set(images)).concat(fallbackProductImage);
};

const handleGalleryZoomMove = (event: React.MouseEvent<HTMLImageElement>) => {
  const rect = event.currentTarget.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;
  event.currentTarget.style.transformOrigin = `${x}% ${y}%`;
};

const handleGalleryZoomLeave = (event: React.MouseEvent<HTMLImageElement>) => {
  event.currentTarget.style.transformOrigin = 'center center';
};

const getTouchDistance = (first: React.Touch, second: React.Touch) =>
  Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);

const clampZoom = (value: number) => Math.min(3, Math.max(1, value));

const getTouchPair = (touches: React.TouchList) => {
  const first = touches.item(0);
  const second = touches.item(1);
  if (!first || !second) return null;
  return { first, second };
};

const recordProductView = (product: any) => {
  const key = 'shop-product-view-preferences';
  try {
    const preferences = JSON.parse(localStorage.getItem(key) || '{"categories":{},"brands":{},"tags":{},"recent":[]}');
    const bump = (bucket: Record<string, number>, value?: string | number) => {
      if (value === undefined || value === null || value === '') return;
      const id = String(value);
      bucket[id] = (bucket[id] || 0) + 1;
    };
    preferences.categories = preferences.categories || {};
    preferences.brands = preferences.brands || {};
    preferences.tags = preferences.tags || {};
    preferences.recent = Array.isArray(preferences.recent) ? preferences.recent : [];
    bump(preferences.categories, product.categoryId);
    bump(preferences.brands, product.brand);
    bump(preferences.tags, product.tag);
    preferences.recent = [product.id, ...preferences.recent.filter((id: number) => id !== product.id)].slice(0, 30);
    preferences.updatedAt = Date.now();
    localStorage.setItem(key, JSON.stringify(preferences));
  } catch {
    // Preference tracking is best-effort only.
  }
};

const getProductOptionGroups = (product: any): Array<{ name: string; values: string[] }> => {
  const specs = product?.specifications || {};
  const configured = Object.entries(specs)
    .filter(([key]) => key.startsWith('options.'))
    .map(([key, value]) => ({
      name: key.replace(/^options\./, ''),
      values: String(value || '').split(',').map((item) => item.trim()).filter(Boolean),
    }))
    .filter((group) => group.name && group.values.length > 0);
  if (configured.length > 0) return configured;
  const fallback = [];
  if (Array.isArray(product?.sizes) && product.sizes.length > 0) fallback.push({ name: 'Size', values: product.sizes });
  if (Array.isArray(product?.colors) && product.colors.length > 0) fallback.push({ name: 'Color', values: product.colors });
  return fallback;
};

const getProductVariants = (product: any): ProductVariant[] => {
  if (Array.isArray(product?.variants)) return product.variants;
  if (typeof product?.variants !== 'string' || !product.variants.trim()) return [];
  try {
    const parsed = JSON.parse(product.variants);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [activeMobileImageIndex, setActiveMobileImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewableOrders, setReviewableOrders] = useState<Order[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [questions, setQuestions] = useState<ProductQuestion[]>([]);
  const [questionText, setQuestionText] = useState('');
  const [answerDrafts, setAnswerDrafts] = useState<Record<number, string>>({});
  const [questionSubmitting, setQuestionSubmitting] = useState(false);
  const [answerSubmitting, setAnswerSubmitting] = useState<Record<number, boolean>>({});
  const [now, setNow] = useState(() => Date.now());
  const [imagePaused, setImagePaused] = useState(false);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [purchaseMode, setPurchaseMode] = useState<'once' | 'subscribe'>('once');
  const [subscriptionInterval, setSubscriptionInterval] = useState('4w');
  const [pinchZoom, setPinchZoom] = useState({ active: false, scale: 1, originX: 50, originY: 50 });
  const mobileGalleryRef = useRef<HTMLDivElement | null>(null);
  const pinchStartRef = useRef<{ distance: number; scale: number } | null>(null);
  const { t, language } = useLanguage();
  const { formatMoney } = useMarket();

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const productImages = useMemo(() => product ? normalizeProductImages(product) : [], [product]);
  const galleryImages = useMemo(() => productImages.slice(0, -1), [productImages]);
  const optionGroups = useMemo(() => getProductOptionGroups(product), [product]);
  const variants = useMemo(() => getProductVariants(product), [product]);
  const selectedVariant = useMemo(() => {
    if (!variants.length) return undefined;
    return variants.find((variant) => Object.entries(variant.options || {}).every(([key, value]) => selectedOptions[key] === value));
  }, [selectedOptions, variants]);
  const selectedSpecsPayload = useMemo(() => JSON.stringify({
    ...selectedOptions,
    ...(selectedVariant?.sku ? { _variantSku: selectedVariant.sku } : {}),
    ...(purchaseMode === 'subscribe' ? {
      _purchaseMode: 'subscribe',
      _subscriptionInterval: subscriptionInterval,
      _subscriptionDiscountPercent: '20',
    } : {}),
  }), [purchaseMode, selectedOptions, selectedVariant, subscriptionInterval]);

  const validateOptions = () => {
    const missing = optionGroups.find((group) => !selectedOptions[group.name]);
    if (missing) {
      message.warning(t('pages.productDetail.selectOption', { option: missing.name }));
      return false;
    }
    if (variants.length > 0 && !selectedVariant) {
      message.warning(t('pages.productDetail.variantUnavailable'));
      return false;
    }
    return true;
  };

  useEffect(() => {
    if (loading || !product || imagePaused || galleryImages.length <= 1 || isModalVisible) return;
    const timer = window.setInterval(() => {
      setActiveMobileImageIndex((currentIndex) => {
        const nextIndex = (currentIndex + 1) % galleryImages.length;
        const nextImage = galleryImages[nextIndex] || galleryImages[0];
        setSelectedImage(nextImage);
        const gallery = mobileGalleryRef.current;
        if (gallery) {
          gallery.scrollTo({ left: nextIndex * gallery.clientWidth, behavior: 'smooth' });
        }
        return nextIndex;
      });
    }, 3200);
    return () => window.clearInterval(timer);
  }, [galleryImages, imagePaused, isModalVisible, loading, product]);

  const fetchReviews = useCallback(async () => {
    try {
      const res = await reviewApi.getAll(Number(id));
      setReviews(res.data.reviews || []);
      setAverageRating(Number(res.data.averageRating || 0));
    } catch {
      // ignore
    }
  }, [id]);

  const fetchRecommendations = useCallback(async () => {
    try {
      const res = await productApi.getRecommendations(Number(id));
      setRecommendations(res.data.map((item: Product) => localizeProduct(item, language)));
    } catch {
      // ignore
    }
  }, [id, language]);

  const fetchQuestions = useCallback(async () => {
    try {
      const res = await questionApi.getByProduct(Number(id));
      setQuestions(res.data || []);
    } catch {
      setQuestions([]);
    }
  }, [id]);

  const fetchReviewableOrders = useCallback(async () => {
    try {
      const ordersRes = await reviewApi.getReviewableOrders(Number(id));
      setReviewableOrders(ordersRes.data || []);
    } catch {
      setReviewableOrders([]);
    }
  }, [id]);

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true);
      try {
        const res = await productApi.getById(Number(id));
        setProduct(localizeProduct(res.data as Product, language));
        setSelectedImage(normalizeProductImages(res.data)[0]);
        setActiveMobileImageIndex(0);
        recordProductView(res.data);
      } catch {
        setProduct(null);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
    fetchReviews();
    fetchQuestions();
    fetchRecommendations();
    const token = localStorage.getItem('token');
    const uid = localStorage.getItem('userId');
    if (token && uid) {
      wishlistApi.check(Number(uid), Number(id))
        .then(res => setIsWishlisted(res.data.wishlisted))
        .catch(() => {});
      fetchReviewableOrders();
    }
  }, [fetchQuestions, fetchRecommendations, fetchReviewableOrders, fetchReviews, id, language]);

  const handleAddToCart = async () => {
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    try {
      if (!validateOptions()) return;
      if (product.stock === undefined || product.stock < quantity) {
        message.error(t('pages.productDetail.insufficientStock'));
        return;
      }
      if (selectedVariant && selectedVariant.stock !== undefined && selectedVariant.stock < quantity) {
        message.error(t('pages.productDetail.insufficientStock'));
        return;
      }
      const specs = optionGroups.length || purchaseMode === 'subscribe' ? selectedSpecsPayload : undefined;
      if (token && userId) {
        await cartApi.addItem(Number(userId), Number(id), quantity, specs);
      } else {
        addGuestCartItem(product, quantity, specs, displayPrice);
      }
      message.success(t('messages.addCartSuccess'));
      window.dispatchEvent(new Event('shop:cart-updated'));
      window.dispatchEvent(new Event('shop:open-cart'));
    } catch (err: any) {
      message.error(err.response?.data?.error || t('messages.addFailed'));
    }
  };

  const handleBuyNow = async () => {
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    try {
      if (!validateOptions()) return;
      if (product.stock === undefined || product.stock < quantity) {
        message.error(t('pages.productDetail.insufficientStock'));
        return;
      }
      if (selectedVariant && selectedVariant.stock !== undefined && selectedVariant.stock < quantity) {
        message.error(t('pages.productDetail.insufficientStock'));
        return;
      }
      const specs = optionGroups.length || purchaseMode === 'subscribe' ? selectedSpecsPayload : undefined;
      if (token && userId) {
        await cartApi.addItem(Number(userId), Number(id), quantity, specs);
        const cartRes = await cartApi.getItems(Number(userId));
        const cartItem = cartRes.data.find((item: any) => item.productId === Number(id) && (optionGroups.length || purchaseMode === 'subscribe' ? item.selectedSpecs === selectedSpecsPayload : !item.selectedSpecs));
        if (cartItem) {
          sessionStorage.setItem('checkoutCartItemIds', JSON.stringify([cartItem.id]));
        }
      } else {
        const cartItem = addGuestCartItem(product, quantity, specs, displayPrice);
        sessionStorage.setItem('checkoutCartItemIds', JSON.stringify([cartItem.id]));
      }
      navigate('/checkout');
    } catch (err: any) {
      message.error(err.response?.data?.error || t('messages.operationFailed'));
    }
  };

  const handleFavorite = async () => {
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    if (!token || !userId) {
      message.warning(t('messages.loginRequired'));
      navigate('/login');
      return;
    }
    try {
      const res = await wishlistApi.toggle(Number(userId), Number(id));
      setIsWishlisted(res.data.wishlisted);
      message.success(res.data.wishlisted ? t('pages.productDetail.favoritedMsg') : t('pages.productDetail.unfavoritedMsg'));
    } catch {
      message.error(t('messages.operationFailed'));
    }
  };

  const handleAddReview = async (orderId: number, rating: number, comment: string) => {
    await reviewApi.create(Number(id), orderId, rating, comment);
    await fetchReviews();
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    if (token && userId) {
      await fetchReviewableOrders();
    }
  };

  const handleAskQuestion = async () => {
    if (!localStorage.getItem('token')) {
      message.warning(t('messages.loginRequired'));
      navigate('/login');
      return;
    }
    if (!questionText.trim()) {
      message.warning(t('pages.ask.emptyQuestion'));
      return;
    }
    try {
      setQuestionSubmitting(true);
      await questionApi.ask(Number(id), questionText);
      setQuestionText('');
      await fetchQuestions();
      message.success(t('pages.ask.askSuccess'));
    } catch (err: any) {
      message.error(err?.response?.data?.error || t('pages.ask.askFailed'));
    } finally {
      setQuestionSubmitting(false);
    }
  };

  const handleAnswerQuestion = async (questionId: number) => {
    const text = (answerDrafts[questionId] || '').trim();
    if (!localStorage.getItem('token')) {
      message.warning(t('messages.loginRequired'));
      navigate('/login');
      return;
    }
    if (!text) {
      message.warning(t('pages.ask.emptyAnswer'));
      return;
    }
    try {
      setAnswerSubmitting((prev) => ({ ...prev, [questionId]: true }));
      await questionApi.answer(questionId, text);
      setAnswerDrafts((prev) => ({ ...prev, [questionId]: '' }));
      await fetchQuestions();
      message.success(t('pages.ask.answerSuccess'));
    } catch (err: any) {
      message.error(err?.response?.data?.error || t('pages.ask.answerFailed'));
    } finally {
      setAnswerSubmitting((prev) => ({ ...prev, [questionId]: false }));
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!product) {
    return <div>{t('pages.productDetail.notFound')}</div>;
  }

  const selectedStock = selectedVariant?.stock ?? product.stock;
  const isOutOfStock = selectedStock !== undefined && selectedStock <= 0;
  const displayedRating = Number(averageRating || product.rating || 0);
  const activePrice = selectedVariant?.price ?? product.effectivePrice ?? product.price;
  const subscribePrice = Math.round(activePrice * 80) / 100;
  const displayPrice = purchaseMode === 'subscribe' ? subscribePrice : activePrice;
  const subscriptionSavings = Math.max(0, activePrice - subscribePrice);
  const discountPercent = product.effectiveDiscountPercent || product.discount || 0;
  const limitedTimeEnd = product.limitedTimeEndAt ? new Date(product.limitedTimeEndAt).getTime() : 0;
  const limitedTimeRemaining = product.activeLimitedTimeDiscount && limitedTimeEnd > now ? limitedTimeEnd - now : 0;
  const formatCountdown = (milliseconds: number) => {
    const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const time = [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
    return days > 0 ? `${days}d ${time}` : time;
  };

  const handleQuantityChange = (value: number) => {
    if (value > 0 && value <= (product.stock || 999)) {
      setQuantity(value);
    }
  };

  const selectGalleryImage = (image: string, index: number) => {
    setSelectedImage(image);
    setActiveMobileImageIndex(index);
    const gallery = mobileGalleryRef.current;
    if (gallery) {
      gallery.scrollTo({ left: index * gallery.clientWidth, behavior: 'smooth' });
    }
  };

  const handleMobileGalleryScroll = () => {
    const gallery = mobileGalleryRef.current;
    if (!gallery || galleryImages.length <= 1) return;
    const index = Math.round(gallery.scrollLeft / gallery.clientWidth);
    const safeIndex = Math.min(Math.max(index, 0), galleryImages.length - 1);
    const image = galleryImages[safeIndex];
    setActiveMobileImageIndex(safeIndex);
    if (image && image !== selectedImage) {
      setSelectedImage(image);
    }
  };

  const getPinchOrigin = (first: React.Touch, second: React.Touch) => {
    const gallery = mobileGalleryRef.current;
    if (!gallery) return { originX: 50, originY: 50 };
    const rect = gallery.getBoundingClientRect();
    const centerX = (first.clientX + second.clientX) / 2;
    const centerY = (first.clientY + second.clientY) / 2;
    return {
      originX: Math.min(100, Math.max(0, ((centerX - rect.left) / rect.width) * 100)),
      originY: Math.min(100, Math.max(0, ((centerY - rect.top) / rect.height) * 100)),
    };
  };

  const handleGalleryTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 2) return;
    const pair = getTouchPair(event.touches);
    if (!pair) return;
    setImagePaused(true);
    pinchStartRef.current = { distance: getTouchDistance(pair.first, pair.second), scale: pinchZoom.scale };
    setPinchZoom({ active: true, scale: 1, ...getPinchOrigin(pair.first, pair.second) });
  };

  const handleGalleryTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 2 || !pinchStartRef.current) return;
    const pair = getTouchPair(event.touches);
    if (!pair) return;
    event.preventDefault();
    const nextScale = clampZoom((getTouchDistance(pair.first, pair.second) / pinchStartRef.current.distance) * pinchStartRef.current.scale);
    setPinchZoom({ active: true, scale: nextScale, ...getPinchOrigin(pair.first, pair.second) });
  };

  const resetGalleryPinch = () => {
    if (!pinchStartRef.current && !pinchZoom.active) return;
    pinchStartRef.current = null;
    setPinchZoom((current) => ({ ...current, active: false, scale: 1 }));
    window.setTimeout(() => setImagePaused(false), 2600);
  };

  return (
    <div className="product-detail-page" style={{ background: '#f7f4ee', minHeight: '100vh', padding: '24px' }}>
      <div className="product-detail-shell" style={{ maxWidth: 1200, margin: '0 auto' }}>
        <Breadcrumb style={{ marginBottom: 24 }}>
          <Breadcrumb.Item href="/">
            <HomeOutlined />
          </Breadcrumb.Item>
          <Breadcrumb.Item href="/products">{t('pages.productDetail.product')}</Breadcrumb.Item>
          <Breadcrumb.Item>{product.name}</Breadcrumb.Item>
        </Breadcrumb>

        <Row gutter={24}>
          {/* 商品图片区 */}
          <Col span={12}>
            <Card className="product-gallery-card">
              <div
                className="product-detail-main-image"
                onMouseEnter={() => setImagePaused(true)}
                onMouseLeave={() => setImagePaused(false)}
              >
                <div
                  ref={mobileGalleryRef}
                  className="product-mobile-gallery"
                  onScroll={handleMobileGalleryScroll}
                  onPointerDown={() => setImagePaused(true)}
                  onPointerUp={() => window.setTimeout(() => setImagePaused(false), 2600)}
                  onPointerCancel={() => window.setTimeout(() => setImagePaused(false), 2600)}
                  onTouchStart={handleGalleryTouchStart}
                  onTouchMove={handleGalleryTouchMove}
                  onTouchEnd={resetGalleryPinch}
                  onTouchCancel={resetGalleryPinch}
                >
                  {galleryImages.map((image: string, index: number) => (
                    <div
                      key={`${image}-${index}`}
                      className="product-mobile-gallery__slide"
                    >
                      <img
                        src={image}
                        alt={`${product.name} - ${index + 1}`}
                        className="product-mobile-gallery__img"
                        style={pinchZoom.active && index === activeMobileImageIndex ? {
                          transform: `scale(${pinchZoom.scale})`,
                          transformOrigin: `${pinchZoom.originX}% ${pinchZoom.originY}%`,
                          transition: 'none',
                        } : undefined}
                        onError={(event) => {
                          event.currentTarget.src = productImages[productImages.length - 1];
                        }}
                      />
                    </div>
                  ))}
                </div>
                <img
                  src={selectedImage}
                  alt={product.name}
                  className="product-detail-main-image__img"
                  onClick={() => setIsModalVisible(true)}
                  onMouseMove={handleGalleryZoomMove}
                  onMouseLeave={handleGalleryZoomLeave}
                  onError={() => {
                    setSelectedImage(productImages[productImages.length - 1]);
                  }}
                />
                {discountPercent > 0 && (
                  <Tag color="gold" style={{ position: 'absolute', top: 16, right: 16, fontSize: 16, padding: '4px 8px' }}>
                    -{discountPercent}%
                  </Tag>
                )}
                {galleryImages.length > 1 && (
                  <span className="product-mobile-gallery__count">
                    {activeMobileImageIndex + 1}/{galleryImages.length}
                  </span>
                )}
              </div>

              {galleryImages.length > 1 && (
                <div className="product-detail-thumbs">
                  <Carousel autoplay={!imagePaused} autoplaySpeed={3200} slidesToShow={4} dots={false} responsive={[
                    { breakpoint: 768, settings: { slidesToShow: 3 } },
                    { breakpoint: 480, settings: { slidesToShow: 2 } },
                  ]}>
                    {galleryImages.map((image: string, index: number) => (
                      <div key={index} className="product-detail-thumbs__slide">
                        <img
                          src={image}
                          alt={`${product.name} - ${index + 1}`}
                          className={`product-detail-thumbs__img${selectedImage === image ? ' product-detail-thumbs__img--active' : ''}`}
                          onClick={() => {
                            selectGalleryImage(image, index);
                            setImagePaused(true);
                            window.setTimeout(() => setImagePaused(false), 5000);
                          }}
                          onError={(event) => {
                            event.currentTarget.src = productImages[productImages.length - 1];
                          }}
                        />
                      </div>
                    ))}
                  </Carousel>
                </div>
              )}
              {galleryImages.length > 1 && (
                <div className="product-mobile-thumbs" aria-label="Product image thumbnails">
                  {galleryImages.map((image: string, index: number) => (
                    <button
                      key={`mobile-thumb-${image}-${index}`}
                      type="button"
                      className={`product-mobile-thumbs__button${activeMobileImageIndex === index ? ' product-mobile-thumbs__button--active' : ''}`}
                      onClick={() => selectGalleryImage(image, index)}
                    >
                      <img
                        src={image}
                        alt={`${product.name} - ${index + 1}`}
                        className="product-mobile-thumbs__img"
                        onError={(event) => {
                          event.currentTarget.src = productImages[productImages.length - 1];
                        }}
                      />
                    </button>
                  ))}
                </div>
              )}
            </Card>
          </Col>

          {/* 商品信息区 */}
          <Col span={12}>
            <Card className="product-summary-card">
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <div className="product-title-block">
                  <Title level={2} style={{ marginBottom: 8 }}>{product.name}</Title>
                  {product.brand && (
                    <Text type="secondary" style={{ fontSize: 16 }}>{t('pages.productDetail.brand')}: {product.brand}</Text>
                  )}
                </div>

                <div className="product-price-panel">
                  <div className="product-rating-row" style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                    <Rate disabled allowHalf value={displayedRating} />
                    <Text style={{ marginLeft: 8 }}>{displayedRating.toFixed(1)} {t('pages.productDetail.rating')}</Text>
                  </div>
                  <div className="product-price-line" style={{ fontSize: 32, color: '#ee4d2d', fontWeight: 600 }}>
                    {formatMoney(displayPrice)}
                    {purchaseMode === 'subscribe' && (
                      <Text delete style={{ fontSize: 16, color: '#999', marginLeft: 8 }}>
                        {formatMoney(activePrice)}
                      </Text>
                    )}
                    {purchaseMode !== 'subscribe' && product.originalPrice && product.originalPrice > activePrice && (
                      <Text delete style={{ fontSize: 16, color: '#999', marginLeft: 8 }}>
                        {formatMoney(product.originalPrice)}
                      </Text>
                    )}
                    {discountPercent > 0 && (
                      <Tag color="gold" style={{ marginLeft: 8, fontSize: 14 }}>-{discountPercent}%</Tag>
                    )}
                  </div>
                  <div className="product-mobile-promo">
                    <span>{limitedTimeRemaining > 0 ? t('pages.productDetail.limitedTimeCountdown') : t('pages.productDetail.freeShipping')}</span>
                    <strong>{limitedTimeRemaining > 0 ? formatCountdown(limitedTimeRemaining) : t('pages.productDetail.authentic')}</strong>
                    <span>{t('pages.productDetail.stock')}: {selectedStock || t('pages.productDetail.enough')}</span>
                  </div>
                  {limitedTimeRemaining > 0 && (
                    <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 4, background: '#fff7e6', color: '#124734', fontWeight: 600 }}>
                      <span>{t('pages.productDetail.limitedTimeCountdown')}</span>
                      <span>{formatCountdown(limitedTimeRemaining)}</span>
                    </div>
                  )}
                </div>

                {optionGroups.map((group) => (
                  <div key={group.name}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <Text strong style={{ fontSize: 16 }}>{group.name}</Text>
                      {group.name.toLowerCase().includes('size') ? (
                        <Button size="small" type="link" onClick={() => setSizeGuideOpen(true)}>{t('pages.productDetail.sizeGuide')}</Button>
                      ) : null}
                    </div>
                    <Radio.Group
                      value={selectedOptions[group.name]}
                      onChange={e => {
                        const next = { ...selectedOptions, [group.name]: e.target.value };
                        setSelectedOptions(next);
                        const variantImage = variants.find((variant) => Object.entries(variant.options || {}).every(([key, value]) => next[key] === value))?.imageUrl;
                        if (variantImage) {
                          const imageIndex = galleryImages.indexOf(variantImage);
                          if (imageIndex >= 0) {
                            selectGalleryImage(variantImage, imageIndex);
                          } else {
                            setSelectedImage(variantImage);
                          }
                        }
                      }}
                      style={{ marginTop: 8 }}
                    >
                      {group.values.map((value) => (
                        <Radio.Button key={value} value={value}>{value}</Radio.Button>
                      ))}
                    </Radio.Group>
                  </div>
                ))}

                <div className="product-purchase-mode">
                  <Segmented
                    block
                    value={purchaseMode}
                    onChange={(value) => setPurchaseMode(value as 'once' | 'subscribe')}
                    options={[
                      { label: t('pages.productDetail.oneTimePurchase'), value: 'once' },
                      { label: t('subscription.subscribeSave'), value: 'subscribe' },
                    ]}
                  />
                  {purchaseMode === 'subscribe' ? (
                    <div className="product-purchase-mode__details">
                      <Radio.Group
                        value={subscriptionInterval}
                        onChange={(event) => setSubscriptionInterval(event.target.value)}
                        optionType="button"
                        buttonStyle="solid"
                        options={subscriptionOptions}
                      />
                      <div className="product-purchase-mode__summary">
                        <Text strong>{t('pages.productDetail.subscriptionSavings', { amount: formatMoney(subscriptionSavings) })}</Text>
                        <Text type="secondary">{t('pages.productDetail.subscriptionHint')}</Text>
                      </div>
                    </div>
                  ) : (
                    <Text type="secondary">{t('pages.productDetail.oneTimeHint')}</Text>
                  )}
                </div>

                <div>
                  <Text strong style={{ fontSize: 16 }}>{t('pages.productDetail.quantity')}</Text>
                  <div style={{ marginTop: 8 }}>
                    <Button.Group>
                      <Button onClick={() => handleQuantityChange(quantity - 1)}>-</Button>
                      <Button>{quantity}</Button>
                      <Button onClick={() => handleQuantityChange(quantity + 1)}>+</Button>
                    </Button.Group>
                    <Text type="secondary" style={{ marginLeft: 16 }}>
                      {t('pages.productDetail.stock')}: {selectedStock || t('pages.productDetail.enough')}
                    </Text>
                  </div>
                </div>

                {isOutOfStock && (
                  <Tag color="red" style={{ fontSize: 16, padding: '4px 12px' }}>{t('pages.productDetail.soldOut')}</Tag>
                )}
                <Space size="middle" className="product-actions">
                  <Button type="primary" size="large" icon={<ShoppingCartOutlined />} onClick={handleAddToCart} disabled={isOutOfStock}>
                    {t('pages.productDetail.addCart')}
                  </Button>
                  <Button type="primary" size="large" icon={<ThunderboltOutlined />} onClick={handleBuyNow} disabled={isOutOfStock} ghost>
                    {t('pages.productDetail.buyNow')}
                  </Button>
                  <Button size="large" icon={isWishlisted ? <HeartFilled style={{ color: '#ee4d2d' }} /> : <HeartOutlined />} onClick={handleFavorite}>
                    {isWishlisted ? t('pages.productDetail.favorited') : t('pages.productDetail.favorite')}
                  </Button>
                </Space>

                <Divider style={{ margin: '16px 0' }} />

                <div className="product-service-list">
                  <Space direction="vertical" size="small">
                    <div>
                      <CheckCircleOutlined style={{ color: '#124734', marginRight: 8 }} />
                      <Text>{t('pages.productDetail.authentic')}</Text>
                    </div>
                    <div>
                      <TruckOutlined style={{ color: '#124734', marginRight: 8 }} />
                      <Text>{t('pages.productDetail.freeShipping')}</Text>
                    </div>
                    <div>
                      <SafetyCertificateOutlined style={{ color: '#124734', marginRight: 8 }} />
                      <Text>{t('pages.productDetail.returns')}</Text>
                    </div>
                  </Space>
                </div>
              </Space>
            </Card>
          </Col>
        </Row>

        {/* 商品详情和规格参数 */}
        <Card className="product-tabs-card" style={{ marginTop: 24 }}>
          <Tabs defaultActiveKey="1">
            <TabPane tab={t('pages.productDetail.details')} key="1">
              <div style={{ padding: '24px 0' }}>
                <ProductRichDetail detailContent={product.detailContent} fallback={product.description} />
              </div>
            </TabPane>
            <TabPane tab={t('pages.productDetail.specs')} key="2">
              <div style={{ padding: '24px 0' }}>
                {product.specifications && Object.entries(product.specifications)
                  .filter(([key]) => !key.startsWith('options.') && !key.startsWith('i18n.'))
                  .map(([key, value]) => (
                  <div key={key} style={{ marginBottom: 16 }}>
                    <Text strong>{key}: </Text>
                    <Text>{value as string}</Text>
                  </div>
                ))}
              </div>
            </TabPane>
            <TabPane tab={t('pages.productDetail.service')} key="3">
              <div style={{ padding: '24px 0' }}>
                <div style={{ marginBottom: 16 }}>
                  <Text strong>{t('pages.productDetail.warranty')}</Text>
                  <Text>{product.warranty || t('pages.productDetail.defaultWarranty')}</Text>
                </div>
                <div>
                  <Text strong>{t('pages.productDetail.shipping')}</Text>
                  <Text>{product.shipping || t('pages.productDetail.defaultShipping')}</Text>
                </div>
              </div>
            </TabPane>
          </Tabs>
        </Card>

        {/* 商品评价 */}
        <Card className="product-review-card" style={{ marginTop: 24 }}>
          <ProductReview
            productId={Number(id)}
            reviews={reviews}
            reviewableOrders={reviewableOrders}
            onAddReview={handleAddReview}
          />
        </Card>

        <Card className="product-qa-card" style={{ marginTop: 24 }}>
          <Title level={4} style={{ marginBottom: 16 }}>{t('pages.ask.title')}</Title>
          <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
            <Input.TextArea
              rows={3}
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder={t('pages.ask.placeholder')}
            />
            <Button type="primary" onClick={handleAskQuestion} loading={questionSubmitting}>
              {t('pages.ask.submit')}
            </Button>
          </Space>
          <List
            dataSource={questions}
            locale={{ emptyText: t('pages.ask.empty') }}
            renderItem={(q) => (
              <List.Item key={q.id}>
                <div style={{ width: '100%' }}>
                  <div style={{ marginBottom: 8, fontWeight: 500 }}>{q.question}</div>
                  <div style={{ fontSize: 12, color: '#999', marginBottom: 10 }}>
                    {q.username} · {new Date(q.createdAt).toLocaleString(language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US')}
                  </div>
                  {q.answer ? (
                    <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6, padding: 10 }}>
                      <Text strong>{t('pages.ask.answerLabel')}: </Text>
                      <Text>{q.answer}</Text>
                    </div>
                  ) : (
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Input.TextArea
                        rows={2}
                        value={answerDrafts[q.id] || ''}
                        onChange={(e) => setAnswerDrafts((prev) => ({ ...prev, [q.id]: e.target.value }))}
                        placeholder={t('pages.ask.answerPlaceholder')}
                      />
                      <Button
                        onClick={() => handleAnswerQuestion(q.id)}
                        loading={!!answerSubmitting[q.id]}
                        size="small"
                      >
                        {t('pages.ask.answerAction')}
                      </Button>
                    </Space>
                  )}
                </div>
              </List.Item>
            )}
          />
        </Card>

        {/* 相关推荐 */}
        {recommendations.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <Title level={3}>{t('pages.productDetail.recommendations')}</Title>
            <Carousel slidesToShow={4} dots={false} arrows>
              {recommendations.map((rec: any) => (
                <div key={rec.id} style={{ padding: '0 8px' }}>
                  <Card
                    hoverable
                    cover={
                      <img
                        alt={rec.name}
                        src={rec.imageUrl}
                        style={{ height: 180, objectFit: 'cover', borderRadius: 8 }}
                        onClick={() => navigate(`/products/${rec.id}`)}
                      />
                    }
                    style={{ width: 260, margin: '0 auto' }}
                    onClick={() => navigate(`/products/${rec.id}`)}
                  >
                    <Card.Meta
                      title={rec.name}
                      description={
                        <div style={{ color: '#ee4d2d', fontWeight: 600 }}>
                          {formatMoney(rec.effectivePrice ?? rec.price)}
                        </div>
                      }
                    />
                  </Card>
                </div>
              ))}
            </Carousel>
          </div>
        )}
      </div>

      <div className="product-mobile-buybar">
        <button type="button" className="product-mobile-buybar__tool" onClick={() => navigate('/')}>
          <HomeOutlined />
          <span>{t('nav.ariaHome')}</span>
        </button>
        <button type="button" className="product-mobile-buybar__tool" onClick={handleFavorite}>
          {isWishlisted ? <HeartFilled /> : <HeartOutlined />}
          <span>{isWishlisted ? t('pages.productDetail.favorited') : t('pages.productDetail.favorite')}</span>
        </button>
        <Button className="product-mobile-buybar__cart" icon={<ShoppingCartOutlined />} onClick={handleAddToCart} disabled={isOutOfStock}>
          {t('pages.productDetail.addCart')}
        </Button>
        <Button className="product-mobile-buybar__buy" type="primary" icon={<ThunderboltOutlined />} onClick={handleBuyNow} disabled={isOutOfStock}>
          {t('pages.productDetail.buyNow')}
        </Button>
      </div>

      {/* 图片放大Modal */}
      <Modal
        open={isModalVisible}
        footer={null}
        onCancel={() => setIsModalVisible(false)}
        width={800}
        centered
      >
        <img
          src={selectedImage}
          alt={product.name}
          style={{ width: '100%', height: 'auto' }}
        />
      </Modal>

      <Modal
        title="Pet size guide"
        open={sizeGuideOpen}
        onCancel={() => setSizeGuideOpen(false)}
        footer={<Button type="primary" onClick={() => setSizeGuideOpen(false)}>Got it</Button>}
      >
        <div className="pet-size-guide">
          <div>
            <strong>Neck</strong>
            <span>Measure where the collar naturally sits. Leave two fingers of room.</span>
          </div>
          <div>
            <strong>Chest</strong>
            <span>Measure the widest part behind the front legs for harnesses and apparel.</span>
          </div>
          <div>
            <strong>Back length</strong>
            <span>Measure from the base of the neck to the base of the tail for coats and pajamas.</span>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ProductDetail;
