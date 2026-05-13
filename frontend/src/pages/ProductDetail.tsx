import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Row, Col, Card, Button, Tag, Typography, Spin, Radio, Rate, Carousel, Modal, Space, Breadcrumb, Tabs, message, List, Input, Segmented, Empty, Alert } from 'antd';
import { HomeOutlined, ShoppingCartOutlined, HeartOutlined, HeartFilled, CheckCircleOutlined, TruckOutlined, SafetyCertificateOutlined, ThunderboltOutlined, BellOutlined } from '@ant-design/icons';
import { productApi, cartApi, reviewApi, wishlistApi, questionApi } from '../api';
import { useNavigate } from 'react-router-dom';
import { ProductReview } from '../components/ProductReview';
import { useLanguage } from '../i18n';
import type { CartItem, Order, Product } from '../types';
import type { ProductQuestion } from '../types';
import { useMarket } from '../hooks/useMarket';
import ProductRichDetail from '../components/ProductRichDetail';
import { localizeProduct } from '../utils/localizedProduct';
import { addGuestCartItem } from '../utils/guestCart';
import { getBundleInfo } from '../utils/bundle';
import { recordProductView } from '../utils/productViewPreferences';
import { addStockAlert, hasStockAlert, removeStockAlert } from '../utils/stockAlerts';
import { conversionConfig, estimatePetSize, getDeliveryPromise } from '../utils/conversionConfig';
import { getProductOptionGroups, getProductVariants, needsOptionSelection, optionValueHasVariant, selectCompatibleProductOption, variantMatchesSelectedOptions } from '../utils/productOptions';
import { clearCheckoutCartItemIds, syncCheckoutCartItemIds } from '../utils/cartSession';
import './ProductDetail.css';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

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
  const uniqueImages = Array.from(new Set(images));
  return uniqueImages.length > 0
    ? uniqueImages.concat(fallbackProductImage)
    : [fallbackProductImage, fallbackProductImage];
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

const renderTrustIcon = (icon: string) => {
  switch (icon) {
    case 'truck':
      return <TruckOutlined />;
    case 'shield':
    case 'support':
      return <SafetyCertificateOutlined />;
    default:
      return <CheckCircleOutlined />;
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
  const [recommendationAddingId, setRecommendationAddingId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<ProductQuestion[]>([]);
  const [questionText, setQuestionText] = useState('');
  const [answerDrafts, setAnswerDrafts] = useState<Record<number, string>>({});
  const [questionSubmitting, setQuestionSubmitting] = useState(false);
  const [answerSubmitting, setAnswerSubmitting] = useState<Record<number, boolean>>({});
  const [now, setNow] = useState(() => Date.now());
  const [imagePaused, setImagePaused] = useState(false);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [sizeCalculatorBreed, setSizeCalculatorBreed] = useState('');
  const [sizeCalculatorWeight, setSizeCalculatorWeight] = useState('');
  const [purchaseMode, setPurchaseMode] = useState<'once' | 'subscribe' | 'bundle'>('once');
  const [subscriptionInterval, setSubscriptionInterval] = useState(conversionConfig.subscription.defaultInterval);
  const [purchaseSubmitting, setPurchaseSubmitting] = useState<'cart' | 'buy' | null>(null);
  const [pinchZoom, setPinchZoom] = useState({ active: false, scale: 1, originX: 50, originY: 50 });
  const [isAlerted, setIsAlerted] = useState(false);
  const mobileGalleryRef = useRef<HTMLDivElement | null>(null);
  const detailContentRef = useRef<HTMLDivElement | null>(null);
  const nonCriticalLoadedRef = useRef(false);
  const pinchStartRef = useRef<{ distance: number; scale: number } | null>(null);
  const imageResumeTimerRef = useRef<number | null>(null);
  const { t, language } = useLanguage();
  const { currency, market, formatMoney } = useMarket();
  const subscriptionDiscountPercent = conversionConfig.subscription.discountPercent;
  const subscriptionOptions = useMemo(() => conversionConfig.subscription.intervals.map((interval) => ({
    label: t(`subscription.interval${interval}`),
    value: interval,
  })), [t]);
  const trustBadges = conversionConfig.productTrustBadges.enabled ? conversionConfig.productTrustBadges.badges : [];
  const deliveryPromise = useMemo(
    () => getDeliveryPromise({ currency, locale: market.locale }),
    [currency, market.locale],
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const clearImageResumeTimer = useCallback(() => {
    if (imageResumeTimerRef.current !== null) {
      window.clearTimeout(imageResumeTimerRef.current);
      imageResumeTimerRef.current = null;
    }
  }, []);

  const pauseImageRotation = useCallback(() => {
    clearImageResumeTimer();
    setImagePaused(true);
  }, [clearImageResumeTimer]);

  const resumeImageRotation = useCallback(() => {
    clearImageResumeTimer();
    setImagePaused(false);
  }, [clearImageResumeTimer]);

  const scheduleImageRotationResume = useCallback((delay = 2600) => {
    clearImageResumeTimer();
    imageResumeTimerRef.current = window.setTimeout(() => {
      setImagePaused(false);
      imageResumeTimerRef.current = null;
    }, delay);
  }, [clearImageResumeTimer]);

  useEffect(() => clearImageResumeTimer, [clearImageResumeTimer]);

  const productImages = useMemo(() => product ? normalizeProductImages(product) : [], [product]);
  const galleryImages = useMemo(() => productImages.slice(0, -1), [productImages]);
  const optionGroups = useMemo(() => getProductOptionGroups(product), [product]);
  const variants = useMemo(() => getProductVariants(product), [product]);
  const bundleInfo = useMemo(() => getBundleInfo(product), [product]);
  const selectedVariant = useMemo(() => {
    if (!variants.length) return undefined;
    return variants.find((variant) => Object.entries(variant.options || {}).every(([key, value]) => selectedOptions[key] === value));
  }, [selectedOptions, variants]);
  const currentStock = selectedVariant?.stock ?? product?.stock;
  const selectedSpecsPayload = useMemo(() => JSON.stringify({
    ...selectedOptions,
    ...(selectedVariant?.sku ? { _variantSku: selectedVariant.sku } : {}),
    ...(purchaseMode === 'subscribe' ? {
      _purchaseMode: 'subscribe',
      _subscriptionInterval: subscriptionInterval,
      _subscriptionDiscountPercent: String(subscriptionDiscountPercent),
    } : {}),
    ...(purchaseMode === 'bundle' && bundleInfo ? {
      _purchaseMode: 'bundle',
      _bundleTitle: bundleInfo.title,
      _bundleItems: bundleInfo.items.map((item) => `${item.name} x${item.quantity || 1}`).join(', '),
    } : {}),
  }), [bundleInfo, purchaseMode, selectedOptions, selectedVariant, subscriptionDiscountPercent, subscriptionInterval]);

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

  useEffect(() => {
    if (currentStock === undefined || quantity <= currentStock) return;
    const nextQuantity = Math.max(1, currentStock);
    if (quantity !== nextQuantity) {
      setQuantity(nextQuantity);
    }
  }, [currentStock, quantity]);

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

  const warmNonCriticalContent = useCallback(() => {
    if (nonCriticalLoadedRef.current) return;
    nonCriticalLoadedRef.current = true;
    const token = localStorage.getItem('token');
    const uid = localStorage.getItem('userId');
    fetchReviews();
    fetchQuestions();
    fetchRecommendations();
    if (token && uid) {
      fetchReviewableOrders();
    }
  }, [fetchQuestions, fetchRecommendations, fetchReviewableOrders, fetchReviews]);

  useEffect(() => {
    nonCriticalLoadedRef.current = false;
    setReviews([]);
    setQuestions([]);
    setRecommendations([]);
    setReviewableOrders([]);
    setAverageRating(0);
    const token = localStorage.getItem('token');
    const uid = localStorage.getItem('userId');
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
    if (token && uid) {
      wishlistApi.check(Number(uid), Number(id))
        .then(res => setIsWishlisted(res.data.wishlisted))
        .catch(() => {});
    }
    setIsAlerted(hasStockAlert(Number(id)));

    const fallbackTimer = window.setTimeout(warmNonCriticalContent, 1800);
    const target = detailContentRef.current;
    let observer: IntersectionObserver | null = null;
    if (target && 'IntersectionObserver' in window) {
      observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          warmNonCriticalContent();
          observer?.disconnect();
        }
      }, { rootMargin: '520px 0px' });
      observer.observe(target);
    } else {
      const scrollWarmup = () => {
        const nextTarget = detailContentRef.current;
        if (!nextTarget || nextTarget.getBoundingClientRect().top < window.innerHeight + 520) {
          warmNonCriticalContent();
          window.removeEventListener('scroll', scrollWarmup);
        }
      };
      window.addEventListener('scroll', scrollWarmup, { passive: true });
      scrollWarmup();
      return () => {
        window.clearTimeout(fallbackTimer);
        window.removeEventListener('scroll', scrollWarmup);
        observer?.disconnect();
      }
    }

    return () => {
      window.clearTimeout(fallbackTimer);
      observer?.disconnect();
    };
  }, [id, language, warmNonCriticalContent]);

  useEffect(() => {
    const syncStockAlert = () => setIsAlerted(hasStockAlert(Number(id)));
    window.addEventListener('shop:stock-alerts-updated', syncStockAlert);
    window.addEventListener('storage', syncStockAlert);
    return () => {
      window.removeEventListener('shop:stock-alerts-updated', syncStockAlert);
      window.removeEventListener('storage', syncStockAlert);
    };
  }, [id]);

  const handleAddToCart = async () => {
    if (purchaseSubmitting) return;
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    try {
      if (!validateOptions()) return;
      if (selectedStock !== undefined && selectedStock < quantity) {
        message.error(t('pages.productDetail.insufficientStock'));
        return;
      }
      setPurchaseSubmitting('cart');
      const specs = optionGroups.length || purchaseMode !== 'once' ? selectedSpecsPayload : undefined;
      if (token && userId) {
        await cartApi.addItem(Number(userId), Number(id), quantity, specs);
        window.dispatchEvent(new Event('shop:cart-updated'));
      } else {
        addGuestCartItem(buildCartProductSnapshot(), quantity, specs, displayPrice);
      }
      message.success(t('messages.addCartSuccess'));
      window.dispatchEvent(new Event('shop:open-cart'));
    } catch (err: any) {
      message.error(err.response?.data?.error || t('messages.addFailed'));
    } finally {
      setPurchaseSubmitting(null);
    }
  };

  const findCheckoutCartItem = (items: CartItem[], specs?: string) => {
    const normalizedSpecs = specs || '';
    return [...items]
      .filter((item) => item.productId === Number(id) && (item.selectedSpecs || '') === normalizedSpecs)
      .sort((left, right) => Number(right.id || 0) - Number(left.id || 0))[0];
  };

  const handleBuyNow = async () => {
    if (purchaseSubmitting) return;
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    try {
      if (!validateOptions()) return;
      if (selectedStock !== undefined && selectedStock < quantity) {
        message.error(t('pages.productDetail.insufficientStock'));
        return;
      }
      setPurchaseSubmitting('buy');
      const specs = optionGroups.length || purchaseMode !== 'once' ? selectedSpecsPayload : undefined;
      if (token && userId) {
        await cartApi.addItem(Number(userId), Number(id), quantity, specs);
        window.dispatchEvent(new Event('shop:cart-updated'));
        const cartRes = await cartApi.getItems(Number(userId));
        const cartItem = findCheckoutCartItem(cartRes.data, specs);
        if (cartItem) {
          syncCheckoutCartItemIds([cartItem]);
        } else {
          clearCheckoutCartItemIds();
          message.error(t('messages.operationFailed'));
          return;
        }
      } else {
        const cartItem = addGuestCartItem(buildCartProductSnapshot(), quantity, specs, displayPrice);
        syncCheckoutCartItemIds([cartItem]);
      }
      sessionStorage.removeItem('checkoutPaymentMethod');
      navigate('/checkout');
    } catch (err: any) {
      message.error(err.response?.data?.error || t('messages.operationFailed'));
    } finally {
      setPurchaseSubmitting(null);
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
      window.dispatchEvent(new Event('shop:wishlist-updated'));
      message.success(res.data.wishlisted ? t('pages.productDetail.favoritedMsg') : t('pages.productDetail.unfavoritedMsg'));
    } catch {
      message.error(t('messages.operationFailed'));
    }
  };

  const handleStockAlert = () => {
    if (isAlerted) {
      removeStockAlert(Number(id));
      setIsAlerted(false);
      message.success(t('pages.stockAlerts.removed'));
      return;
    }
    const result = addStockAlert(product);
    setIsAlerted(true);
    message.success(result.status === 'exists' ? t('pages.stockAlerts.exists') : t('pages.stockAlerts.added'));
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
    return (
      <div className="product-detail-empty">
        <Empty description={t('pages.productDetail.notFound')}>
          <Button type="primary" onClick={() => navigate('/products')}>{t('pages.productList.title')}</Button>
        </Empty>
      </div>
    );
  }

  const selectedStock = currentStock;
  const isOutOfStock = selectedStock !== undefined && selectedStock <= 0;
  const stockLabel = selectedStock !== undefined ? selectedStock : t('pages.productDetail.enough');
  const displayedRating = Number(averageRating || product.rating || 0);
  const activePrice = selectedVariant?.price ?? product.effectivePrice ?? product.price;
  const subscribePrice = Math.round(activePrice * (100 - subscriptionDiscountPercent)) / 100;
  const displayPrice = purchaseMode === 'bundle' && bundleInfo ? bundleInfo.price : purchaseMode === 'subscribe' ? subscribePrice : activePrice;
  const subscriptionSavings = Math.max(0, activePrice - subscribePrice);
  const bundleSavings = bundleInfo ? Math.max(0, activePrice - bundleInfo.price) : 0;
  const purchaseSubtotal = displayPrice * quantity;
  const purchaseSavings = purchaseMode === 'subscribe'
    ? subscriptionSavings * quantity
    : purchaseMode === 'bundle'
      ? bundleSavings * quantity
      : 0;
  const purchaseModeLabel = purchaseMode === 'subscribe'
    ? t('subscription.subscribeSave', { percent: subscriptionDiscountPercent })
    : purchaseMode === 'bundle'
      ? t('bundle.bundleDeal')
      : t('pages.productDetail.oneTimePurchase');
  const replenishmentIntervalLabel = t(`subscription.interval${subscriptionInterval}`);
  const replenishmentNudgeText = purchaseMode === 'subscribe'
    ? t('pages.productDetail.replenishmentActiveText', {
      interval: replenishmentIntervalLabel,
      amount: formatMoney(subscriptionSavings * quantity),
    })
    : t('pages.productDetail.replenishmentPassiveText', {
      interval: replenishmentIntervalLabel,
      percent: subscriptionDiscountPercent,
    });
  const discountPercent = product.effectiveDiscountPercent || product.discount || 0;
  const limitedTimeEnd = product.limitedTimeEndAt ? new Date(product.limitedTimeEndAt).getTime() : 0;
  const limitedTimeRemaining = product.activeLimitedTimeDiscount && limitedTimeEnd > now ? limitedTimeEnd - now : 0;
  const hasCompleteOptions = optionGroups.every((group) => selectedOptions[group.name]);
  const hasUnavailableSelectedVariant = variants.length > 0 && hasCompleteOptions && !selectedVariant;
  const selectedOptionTags = optionGroups
    .map((group) => ({ name: group.name, value: selectedOptions[group.name] }))
    .filter((item) => item.value);
  const sizeOptionGroup = optionGroups.find((group) => group.name.toLowerCase().includes('size') || group.name.includes('尺码'));
  const recommendedSize = estimatePetSize(sizeCalculatorBreed, Number(sizeCalculatorWeight || 0));
  const recommendedSizeValue = sizeOptionGroup?.values.find((value) => value.toLowerCase() === String(recommendedSize || '').toLowerCase());
  const fitConfidenceText = sizeOptionGroup
    ? recommendedSizeValue
      ? t('pages.productDetail.fitConfidenceMatched', { size: recommendedSizeValue })
      : hasCompleteOptions
        ? t('pages.productDetail.fitConfidenceSelected')
        : t('pages.productDetail.fitConfidenceNeedSize')
    : t('pages.productDetail.fitConfidenceNoSize');
  const selectOptionValue = (groupName: string, value: string) => {
    const nextOptions = selectCompatibleProductOption(optionGroups, variants, selectedOptions, groupName, value);
    setSelectedOptions(nextOptions);
    const variantImage = variants.find((variant) =>
      variantMatchesSelectedOptions([variant], nextOptions),
    )?.imageUrl;
    if (variantImage) {
      const imageIndex = galleryImages.indexOf(variantImage);
      if (imageIndex >= 0) {
        selectGalleryImage(variantImage, imageIndex);
      } else {
        setSelectedImage(variantImage);
      }
    }
  };
  const formatCountdown = (milliseconds: number) => {
    const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const time = [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
    return days > 0 ? `${days}d ${time}` : time;
  };
  const decisionChecklist = [
    {
      key: 'options',
      icon: <CheckCircleOutlined />,
      ready: optionGroups.length === 0 || (hasCompleteOptions && !hasUnavailableSelectedVariant),
      title: optionGroups.length === 0
        ? t('pages.productDetail.decisionNoOptionsTitle')
        : hasCompleteOptions && !hasUnavailableSelectedVariant
          ? t('pages.productDetail.decisionOptionsReadyTitle')
          : t('pages.productDetail.decisionOptionsMissingTitle'),
      text: optionGroups.length === 0
        ? t('pages.productDetail.decisionNoOptionsText')
        : hasCompleteOptions && !hasUnavailableSelectedVariant
          ? t('pages.productDetail.decisionOptionsReadyText')
          : t('pages.productDetail.decisionOptionsMissingText'),
    },
    {
      key: 'stock',
      icon: <SafetyCertificateOutlined />,
      ready: !isOutOfStock,
      title: isOutOfStock ? t('pages.productDetail.decisionStockOutTitle') : t('pages.productDetail.decisionStockReadyTitle'),
      text: isOutOfStock
        ? t('pages.productDetail.decisionStockOutText')
        : t('pages.productDetail.decisionStockReadyText', { stock: stockLabel }),
    },
    {
      key: 'delivery',
      icon: <TruckOutlined />,
      ready: Boolean(deliveryPromise.enabled),
      title: t('pages.productDetail.decisionDeliveryTitle'),
      text: deliveryPromise.enabled
        ? t('pages.productDetail.decisionDeliveryText', { window: deliveryPromise.windowText })
        : t('pages.productDetail.defaultShipping'),
    },
    {
      key: 'value',
      icon: purchaseSavings > 0 || discountPercent > 0 ? <ThunderboltOutlined /> : <CheckCircleOutlined />,
      ready: true,
      title: purchaseSavings > 0 || discountPercent > 0
        ? t('pages.productDetail.decisionValueDealTitle')
        : t('pages.productDetail.decisionValueStableTitle'),
      text: purchaseSavings > 0
        ? t('pages.productDetail.decisionValueSavingsText', { amount: formatMoney(purchaseSavings) })
        : discountPercent > 0
          ? t('pages.productDetail.decisionValueDiscountText', { percent: discountPercent })
          : t('pages.productDetail.decisionValueStableText'),
    },
  ];
  const routineCarePattern = /food|feed|litter|filter|refill|supplement|treat|wipes|shampoo|alimento|arena|filtro|recarga|suplemento/i;
  const isRoutineCareProduct = routineCarePattern.test(`${product.name || ''} ${product.description || ''} ${product.tag || ''}`);
  const recommendedPurchaseMode: 'once' | 'subscribe' | 'bundle' = bundleInfo && bundleSavings > subscriptionSavings
    ? 'bundle'
    : conversionConfig.subscription.enabled && isRoutineCareProduct && subscriptionSavings > 0
      ? 'subscribe'
      : 'once';
  const recommendedPathTitle = recommendedPurchaseMode === 'bundle'
    ? t('pages.productDetail.pathBundleTitle')
    : recommendedPurchaseMode === 'subscribe'
      ? t('pages.productDetail.pathSubscribeTitle')
      : t('pages.productDetail.pathOnceTitle');
  const recommendedPathText = recommendedPurchaseMode === 'bundle' && bundleInfo
    ? t('pages.productDetail.pathBundleText', { amount: formatMoney(bundleSavings * quantity) })
    : recommendedPurchaseMode === 'subscribe'
      ? t('pages.productDetail.pathSubscribeText', { amount: formatMoney(subscriptionSavings * quantity), interval: replenishmentIntervalLabel })
      : t('pages.productDetail.pathOnceText');

  const handleQuantityChange = (value: number) => {
    const maxQuantity = selectedStock !== undefined ? selectedStock : 999;
    if (value > 0 && value <= maxQuantity) {
      setQuantity(value);
    }
  };

  const buildCartProductSnapshot = () => ({
    ...product,
    stock: selectedStock,
    price: displayPrice,
    effectivePrice: displayPrice,
    imageUrl: selectedVariant?.imageUrl || product.imageUrl,
  });

  const isRecommendationUnavailable = (item: Product | any) => {
    const hasStockValue = item.stock !== undefined && item.stock !== null;
    const isInactive = item.status && item.status !== 'ACTIVE';
    return Boolean(isInactive || (hasStockValue && Number(item.stock) <= 0));
  };

  const handleAddRecommendationToCart = async (event: React.MouseEvent<HTMLElement>, item: Product | any) => {
    event.stopPropagation();
    if (isRecommendationUnavailable(item)) {
      message.warning(t('pages.productDetail.soldOut'));
      return;
    }
    if (needsOptionSelection(item)) {
      message.info(t('pages.wishlist.selectOptions'));
      navigate(`/products/${item.id}`);
      return;
    }

    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    try {
      setRecommendationAddingId(item.id);
      if (token && userId) {
        await cartApi.addItem(Number(userId), Number(item.id), 1);
        window.dispatchEvent(new Event('shop:cart-updated'));
      } else {
        addGuestCartItem(item, 1, undefined, item.effectivePrice ?? item.price);
      }
      message.success(t('messages.addCartSuccess'));
      window.dispatchEvent(new Event('shop:open-cart'));
    } catch (err: any) {
      message.error(err?.response?.data?.error || t('messages.addFailed'));
    } finally {
      setRecommendationAddingId(null);
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
    scheduleImageRotationResume();
  };

  return (
    <div className="product-detail-page" style={{ background: '#f7f4ee', minHeight: '100vh', padding: '24px' }}>
      <div className="product-detail-shell" style={{ maxWidth: 1200, margin: '0 auto' }}>
        <Breadcrumb style={{ marginBottom: 24 }}>
          <Breadcrumb.Item>
            <button type="button" className="product-detail-breadcrumb__link" onClick={() => navigate('/')}>
              <HomeOutlined />
            </button>
          </Breadcrumb.Item>
          <Breadcrumb.Item>
            <button type="button" className="product-detail-breadcrumb__link" onClick={() => navigate('/products')}>
              {t('pages.productDetail.product')}
            </button>
          </Breadcrumb.Item>
          <Breadcrumb.Item>{product.name}</Breadcrumb.Item>
        </Breadcrumb>

        <Row gutter={24}>
          {/* 商品图片区 */}
          <Col span={12}>
            <Card className="product-gallery-card">
              <div
                className="product-detail-main-image"
                onMouseEnter={pauseImageRotation}
                onMouseLeave={resumeImageRotation}
              >
                <div
                  ref={mobileGalleryRef}
                  className="product-mobile-gallery"
                  onScroll={handleMobileGalleryScroll}
                  onPointerDown={pauseImageRotation}
                  onPointerUp={() => scheduleImageRotationResume()}
                  onPointerCancel={() => scheduleImageRotationResume()}
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
                            pauseImageRotation();
                            scheduleImageRotationResume(5000);
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
                    <span>{t('pages.productDetail.stock')}: {stockLabel}</span>
                  </div>
                  {limitedTimeRemaining > 0 && (
                    <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 4, background: '#fff7e6', color: '#124734', fontWeight: 600 }}>
                      <span>{t('pages.productDetail.limitedTimeCountdown')}</span>
                      <span>{formatCountdown(limitedTimeRemaining)}</span>
                    </div>
                  )}
                  <div className="product-compact-signals">
                    <span>{t('pages.productDetail.stock')}: {stockLabel}</span>
                    {deliveryPromise.enabled ? <span>{t('pages.productDetail.deliveryPromise', { window: deliveryPromise.windowText })}</span> : null}
                    {purchaseSavings > 0 ? <span>{t('pages.productDetail.purchaseSavings')}: {formatMoney(purchaseSavings)}</span> : null}
                  </div>
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
                      onChange={e => selectOptionValue(group.name, e.target.value)}
                      style={{ marginTop: 8 }}
                    >
                      {group.values.map((value) => {
                        const disabled = !optionValueHasVariant(variants, group.name, value);
                        return (
                          <Radio.Button key={value} value={value} disabled={disabled}>
                            {value}
                          </Radio.Button>
                        );
                      })}
                    </Radio.Group>
                  </div>
                ))}

                {optionGroups.length > 0 && (
                  <div className={`product-selected-summary${hasUnavailableSelectedVariant ? ' product-selected-summary--warning' : ''}`}>
                    <div className="product-selected-summary__header">
                      <Text strong>{t('pages.productDetail.selectedOptionsTitle')}</Text>
                      <Space size={8} wrap>
                        <Text type={hasUnavailableSelectedVariant ? 'danger' : 'secondary'}>
                          {hasUnavailableSelectedVariant
                            ? t('pages.productDetail.selectedVariantUnavailable')
                            : hasCompleteOptions
                              ? t('pages.productDetail.selectedVariantStock', { stock: stockLabel })
                              : t('pages.productDetail.selectedOptionsEmpty')}
                        </Text>
                        {selectedOptionTags.length > 0 ? (
                          <Button size="small" type="link" onClick={() => setSelectedOptions({})}>
                            {t('pages.productList.resetFilters')}
                          </Button>
                        ) : null}
                      </Space>
                    </div>
                    <Space wrap size={[6, 6]}>
                      {selectedOptionTags.length > 0 ? selectedOptionTags.map((item) => (
                        <Tag key={item.name}>{item.name}: {item.value}</Tag>
                      )) : (
                        <Tag>{t('pages.productDetail.selectedOptionsEmpty')}</Tag>
                      )}
                      {selectedVariant?.sku ? <Tag>{t('pages.productDetail.selectedVariantSku', { sku: selectedVariant.sku })}</Tag> : null}
                      {hasCompleteOptions && !hasUnavailableSelectedVariant ? (
                        <Tag color="green">{t('pages.productDetail.selectedVariantPrice', { price: formatMoney(displayPrice) })}</Tag>
                      ) : null}
                    </Space>
                  </div>
                )}

                {sizeOptionGroup ? (
                  <details className="product-detail-disclosure">
                    <summary>
                      <span>{t('pages.productDetail.sizeCalculatorTitle')}</span>
                      <Text type="secondary">{fitConfidenceText}</Text>
                    </summary>
                    <div className="product-size-calculator">
                    <div className="product-size-calculator__header">
                      <Text strong>{t('pages.productDetail.sizeCalculatorTitle')}</Text>
                      <Button size="small" type="link" onClick={() => setSizeGuideOpen(true)}>{t('pages.productDetail.sizeGuide')}</Button>
                    </div>
                    <div className="product-size-calculator__inputs">
                      <Input
                        value={sizeCalculatorBreed}
                        onChange={(event) => setSizeCalculatorBreed(event.target.value)}
                        placeholder={t('pages.productDetail.sizeCalculatorBreed')}
                      />
                      <Input
                        value={sizeCalculatorWeight}
                        type="number"
                        min={0}
                        onChange={(event) => setSizeCalculatorWeight(event.target.value)}
                        placeholder={t('pages.productDetail.sizeCalculatorWeight')}
                      />
                    </div>
                    {recommendedSize ? (
                      <Alert
                        type={recommendedSizeValue ? 'success' : 'info'}
                        showIcon
                        message={t('pages.productDetail.sizeCalculatorResult', { size: recommendedSize })}
                        description={recommendedSizeValue
                          ? t('pages.productDetail.sizeCalculatorMatch')
                          : t('pages.productDetail.sizeCalculatorNoMatch')}
                        action={recommendedSizeValue ? (
                          <Button
                            size="small"
                            type="primary"
                            onClick={() => selectOptionValue(sizeOptionGroup.name, recommendedSizeValue)}
                          >
                            {t('pages.productDetail.sizeCalculatorApply')}
                          </Button>
                        ) : undefined}
                      />
                    ) : (
                      <Text type="secondary">{t('pages.productDetail.sizeCalculatorHint')}</Text>
                    )}
                    </div>
                  </details>
                ) : null}

                <div className="product-value-callout">
                  <span className="product-value-callout__icon"><ThunderboltOutlined /></span>
                  <div className="product-value-callout__copy">
                    <Text strong>{recommendedPathTitle}</Text>
                    <Text type="secondary">{recommendedPathText}</Text>
                  </div>
                  {purchaseMode !== recommendedPurchaseMode ? (
                    <Button size="small" type="primary" onClick={() => setPurchaseMode(recommendedPurchaseMode)}>
                      {t('pages.productDetail.useRecommendedPath')}
                    </Button>
                  ) : (
                    <Tag color="green">{t('pages.productDetail.decisionReady')}</Tag>
                  )}
                </div>

                <div className="product-purchase-mode">
                  <Segmented
                    block
                    value={purchaseMode}
                    onChange={(value) => setPurchaseMode(value as 'once' | 'subscribe' | 'bundle')}
                    options={[
                      { label: t('pages.productDetail.oneTimePurchase'), value: 'once' },
                      ...(conversionConfig.subscription.enabled ? [{ label: t('subscription.subscribeSave', { percent: subscriptionDiscountPercent }), value: 'subscribe' }] : []),
                      ...(bundleInfo ? [{ label: t('bundle.bundleDeal'), value: 'bundle' }] : []),
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
                        <Text strong>{t('pages.productDetail.subscriptionSavings', { amount: formatMoney(subscriptionSavings), percent: subscriptionDiscountPercent })}</Text>
                        <Text type="secondary">{t('pages.productDetail.subscriptionHint')}</Text>
                        <Space wrap size={[6, 6]}>
                          <Tag color="green">{t('pages.productDetail.subscriptionSkip')}</Tag>
                          <Tag color="green">{t('pages.productDetail.subscriptionCancel')}</Tag>
                        </Space>
                      </div>
                    </div>
                  ) : purchaseMode === 'bundle' && bundleInfo ? (
                    <div className="product-purchase-mode__details">
                      <div className="product-purchase-mode__summary">
                        <Text strong>{t('bundle.includes')}</Text>
                        <Space wrap size={[6, 6]}>
                          {bundleInfo.items.map((item) => (
                            <Tag key={item.name}>{item.name} x{item.quantity || 1}</Tag>
                          ))}
                        </Space>
                        <Text type="secondary">
                          {bundleSavings > 0
                            ? t('bundle.saveWithBundle', { amount: formatMoney(bundleSavings) })
                            : t('bundle.bundleHint')}
                        </Text>
                      </div>
                    </div>
                  ) : (
                    <Text type="secondary">{t('pages.productDetail.oneTimeHint')}</Text>
                  )}
                </div>

                <div>
                  <Text strong style={{ fontSize: 16 }}>{t('pages.productDetail.quantity')}</Text>
                  <div className="product-quantity-row">
                    <Button.Group>
                      <Button onClick={() => handleQuantityChange(quantity - 1)} disabled={quantity <= 1}>-</Button>
                      <Button className="product-quantity__value">{quantity}</Button>
                      <Button onClick={() => handleQuantityChange(quantity + 1)} disabled={selectedStock !== undefined && quantity >= selectedStock}>+</Button>
                    </Button.Group>
                    <Text type="secondary">
                      {t('pages.productDetail.stock')}: {stockLabel}
                    </Text>
                  </div>
                </div>

                <div className="product-purchase-summary">
                  <div className="product-purchase-summary__line">
                    <Text type="secondary">{t('pages.productDetail.purchaseMode')}</Text>
                    <Text strong>{purchaseModeLabel}</Text>
                  </div>
                  <div className="product-purchase-summary__line">
                    <Text type="secondary">{t('pages.productDetail.unitPrice')}</Text>
                    <Text>{formatMoney(displayPrice)}</Text>
                  </div>
                  <div className="product-purchase-summary__line">
                    <Text type="secondary">{t('pages.productDetail.purchaseQuantity')}</Text>
                    <Text>{quantity}</Text>
                  </div>
                  {purchaseSavings > 0 ? (
                    <div className="product-purchase-summary__line product-purchase-summary__line--saving">
                      <Text>{t('pages.productDetail.purchaseSavings')}</Text>
                      <Text strong>{formatMoney(purchaseSavings)}</Text>
                    </div>
                  ) : null}
                  <div className="product-purchase-summary__total">
                    <Text strong>{t('pages.productDetail.purchaseSubtotal')}</Text>
                    <Text strong>{formatMoney(purchaseSubtotal)}</Text>
                  </div>
                </div>

                <details className="product-detail-disclosure">
                  <summary>
                    <span>{t('pages.productDetail.decisionTitle')}</span>
                    <Tag color={isOutOfStock || hasUnavailableSelectedVariant ? 'orange' : 'green'}>
                      {isOutOfStock || hasUnavailableSelectedVariant
                        ? t('pages.productDetail.decisionNeedsReview')
                        : t('pages.productDetail.decisionReady')}
                    </Tag>
                  </summary>
                  <div className="product-conversion-nudges">
                    <div className="product-conversion-nudge">
                      <span className="product-conversion-nudge__icon"><ThunderboltOutlined /></span>
                      <span>
                        <Text strong>{t('pages.productDetail.replenishmentTitle')}</Text>
                        <Text type="secondary">{replenishmentNudgeText}</Text>
                      </span>
                    </div>
                    <div className="product-conversion-nudge">
                      <span className="product-conversion-nudge__icon"><SafetyCertificateOutlined /></span>
                      <span>
                        <Text strong>{t('pages.productDetail.fitConfidenceTitle')}</Text>
                        <Text type="secondary">{fitConfidenceText}</Text>
                      </span>
                    </div>
                  </div>
                  <div className="product-decision-card">
                    <div className="product-decision-card__grid">
                      {decisionChecklist.map((item) => (
                        <div className={`product-decision-item${item.ready ? ' product-decision-item--ready' : ' product-decision-item--pending'}`} key={item.key}>
                          <span className="product-decision-item__icon">{item.icon}</span>
                          <span>
                            <Text strong>{item.title}</Text>
                            <Text type="secondary">{item.text}</Text>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </details>

                {isOutOfStock && (
                  <Space wrap>
                    <Tag color="red" style={{ fontSize: 16, padding: '4px 12px' }}>{t('pages.productDetail.soldOut')}</Tag>
                    <Button icon={<BellOutlined />} onClick={handleStockAlert}>
                      {isAlerted ? t('pages.stockAlerts.remove') : t('pages.stockAlerts.notifyMe')}
                    </Button>
                  </Space>
                )}
                <Space size="middle" wrap className="product-actions">
                  <Button
                    type="primary"
                    size="large"
                    icon={<ShoppingCartOutlined />}
                    className={isOutOfStock ? 'product-detail__soldoutButton' : undefined}
                    onClick={handleAddToCart}
                    loading={purchaseSubmitting === 'cart'}
                    disabled={isOutOfStock || purchaseSubmitting !== null}
                  >
                    {isOutOfStock ? t('pages.productDetail.soldOut') : t('pages.productDetail.addCart')}
                  </Button>
                  <Button
                    type="primary"
                    size="large"
                    icon={<ThunderboltOutlined />}
                    className={isOutOfStock ? 'product-detail__soldoutButton' : undefined}
                    onClick={handleBuyNow}
                    loading={purchaseSubmitting === 'buy'}
                    disabled={isOutOfStock || purchaseSubmitting !== null}
                    ghost
                  >
                    {t('pages.productDetail.buyNow')}
                  </Button>
                  {isOutOfStock ? (
                    <Button size="large" icon={<BellOutlined />} onClick={handleStockAlert}>
                      {isAlerted ? t('pages.stockAlerts.remove') : t('pages.stockAlerts.notifyMe')}
                    </Button>
                  ) : null}
                  <Button size="large" icon={isWishlisted ? <HeartFilled style={{ color: '#ee4d2d' }} /> : <HeartOutlined />} onClick={handleFavorite}>
                    {isWishlisted ? t('pages.productDetail.favorited') : t('pages.productDetail.favorite')}
                  </Button>
                </Space>

                <details className="product-detail-disclosure product-detail-disclosure--service">
                  <summary>
                    <span>{t('pages.productDetail.service')}</span>
                    {deliveryPromise.enabled ? <Text type="secondary">{t('pages.productDetail.deliveryPromise', { window: deliveryPromise.windowText })}</Text> : null}
                  </summary>
                  <div className="product-service-list">
                  <Space direction="vertical" size="middle">
                    {deliveryPromise.enabled ? (
                      <div className="product-delivery-promise">
                        <TruckOutlined className="product-delivery-promise__icon" />
                        <div>
                          <Text strong>
                            {t('pages.productDetail.deliveryPromise', { window: deliveryPromise.windowText })}
                          </Text>
                          <Text type="secondary">
                            {deliveryPromise.shipsToday
                              ? t('pages.productDetail.shipsToday', { cutoff: `${deliveryPromise.cutoffHour}:00` })
                              : t('pages.productDetail.shipsNextBusinessDay')}
                          </Text>
                        </div>
                      </div>
                    ) : null}
                    {trustBadges.length > 0 ? (
                      <div className="product-trust-grid">
                        {trustBadges.map((badge) => (
                          <div className="product-trust-card" key={badge.titleKey}>
                            <span className="product-trust-card__icon">{renderTrustIcon(badge.icon)}</span>
                            <span>
                              <Text strong>{t(badge.titleKey)}</Text>
                              <Text type="secondary">{t(badge.textKey)}</Text>
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </Space>
                  </div>
                </details>
              </Space>
            </Card>
          </Col>
        </Row>

        {/* 商品详情和规格参数 */}
        <div ref={detailContentRef} className="product-detail-content-anchor" />
        <Card className="product-tabs-card" id="product-service-tabs" style={{ marginTop: 24 }}>
          <Tabs defaultActiveKey="1">
            <TabPane tab={t('pages.productDetail.details')} key="1">
              <div style={{ padding: '24px 0' }}>
                <ProductRichDetail detailContent={product.detailContent} fallback={product.description} />
              </div>
            </TabPane>
            <TabPane tab={t('pages.productDetail.specs')} key="2">
              <div style={{ padding: '24px 0' }}>
                {product.specifications && Object.entries(product.specifications)
                  .filter(([key]) => !key.startsWith('options.') && !key.startsWith('i18n.') && !key.startsWith('bundle.'))
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
        <Card className="product-review-card" id="product-reviews-card" style={{ marginTop: 24 }}>
          <ProductReview
            productId={Number(id)}
            reviews={reviews}
            reviewableOrders={reviewableOrders}
            onAddReview={handleAddReview}
          />
        </Card>

        <Card className="product-qa-card" id="product-qa-card" style={{ marginTop: 24 }}>
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
                    {q.username} - {new Date(q.createdAt).toLocaleString(language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US')}
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
          <div className="product-recommendations" style={{ marginTop: 24 }}>
            <Title level={3}>{t('pages.productDetail.recommendations')}</Title>
            <Carousel
              slidesToShow={4}
              dots={false}
              arrows
              responsive={[
                { breakpoint: 1024, settings: { slidesToShow: 3 } },
                { breakpoint: 768, settings: { slidesToShow: 2 } },
                { breakpoint: 520, settings: { slidesToShow: 1 } },
              ]}
            >
              {recommendations.map((rec: any) => {
                const needsOptions = needsOptionSelection(rec);
                const isRecommendationSoldOut = isRecommendationUnavailable(rec);
                return (
                  <div key={rec.id} style={{ padding: '0 8px' }}>
                    <Card
                      hoverable
                      cover={
                        <img
                          alt={rec.name}
                          src={rec.imageUrl || fallbackProductImage}
                          className="product-recommendations__image"
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate(`/products/${rec.id}`);
                          }}
                          onError={(event) => {
                            if (event.currentTarget.src !== fallbackProductImage) {
                              event.currentTarget.src = fallbackProductImage;
                            }
                          }}
                        />
                      }
                      className="product-recommendations__card"
                      onClick={() => navigate(`/products/${rec.id}`)}
                    >
                      <div className="product-recommendations__content">
                        <Text strong className="product-recommendations__name">{rec.name}</Text>
                        <div className="product-recommendations__meta">
                          <span className="product-recommendations__price">{formatMoney(rec.effectivePrice ?? rec.price)}</span>
                          {rec.reviewCount > 0 && (
                            <span className="product-recommendations__proof">
                              {rec.reviewCount} {t('adminLayout.reviews')}
                            </span>
                          )}
                        </div>
                        <Button
                          block
                          size="small"
                          type={needsOptions ? 'default' : 'primary'}
                          icon={<ShoppingCartOutlined />}
                          loading={recommendationAddingId === rec.id}
                          disabled={isRecommendationSoldOut}
                          onClick={(event) => handleAddRecommendationToCart(event, rec)}
                        >
                          {isRecommendationSoldOut
                            ? t('pages.productDetail.soldOut')
                            : needsOptions
                              ? t('pages.wishlist.selectOptions')
                              : t('pages.productDetail.addCart')}
                        </Button>
                      </div>
                    </Card>
                  </div>
                );
              })}
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
        <Button
          className="product-mobile-buybar__cart"
          icon={isOutOfStock ? <BellOutlined /> : <ShoppingCartOutlined />}
          onClick={isOutOfStock ? handleStockAlert : handleAddToCart}
          loading={purchaseSubmitting === 'cart'}
          disabled={!isOutOfStock && purchaseSubmitting !== null}
        >
          {isOutOfStock ? (isAlerted ? t('pages.stockAlerts.remove') : t('pages.stockAlerts.notifyMe')) : t('pages.productDetail.addCart')}
        </Button>
        <Button className="product-mobile-buybar__buy" type="primary" icon={<ThunderboltOutlined />} onClick={handleBuyNow} loading={purchaseSubmitting === 'buy'} disabled={isOutOfStock || purchaseSubmitting !== null}>
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
        title={t('pages.productDetail.sizeGuideTitle')}
        open={sizeGuideOpen}
        onCancel={() => setSizeGuideOpen(false)}
        footer={<Button type="primary" onClick={() => setSizeGuideOpen(false)}>{t('pages.productDetail.sizeGuideGotIt')}</Button>}
      >
        <div className="pet-size-guide">
          <div>
            <strong>{t('pages.productDetail.sizeGuideNeck')}</strong>
            <span>{t('pages.productDetail.sizeGuideNeckText')}</span>
          </div>
          <div>
            <strong>{t('pages.productDetail.sizeGuideChest')}</strong>
            <span>{t('pages.productDetail.sizeGuideChestText')}</span>
          </div>
          <div>
            <strong>{t('pages.productDetail.sizeGuideBack')}</strong>
            <span>{t('pages.productDetail.sizeGuideBackText')}</span>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ProductDetail;
