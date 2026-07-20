import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Row, Col, Card, Button, Tag, Typography, Radio, Rate, Carousel, Modal, Space, Breadcrumb, Tabs, message, List, Input, Segmented, Alert } from 'antd';
import { BarChartOutlined, HomeOutlined, ShoppingCartOutlined, HeartOutlined, HeartFilled, CheckCircleOutlined, TruckOutlined, SafetyCertificateOutlined, ThunderboltOutlined, BellOutlined, MinusOutlined, PlusOutlined, EllipsisOutlined } from '@ant-design/icons';
import { productApi, cartApi, reviewApi, wishlistApi, questionApi } from '../api';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n';
import type { CartItem, ProductPublic as Product, PublicReview, ProductQuestionPublic, ReviewableOrder } from '../types';
import { useMarket } from '../hooks/useMarket';
import { localizeProduct } from '../utils/localizedProduct';
import { getLocalizedOptionLabel, isSizeOptionName } from '../utils/localizedProductOptions';
import { addGuestCartItem } from '../utils/guestCart';
import { getBundleInfo } from '../utils/bundle';
import { recordProductView } from '../utils/productViewPreferences';
import { addStockAlert, hasStockAlert, removeStockAlert } from '../utils/stockAlerts';
import { conversionConfig, estimatePetSize, getDeliveryPromise, getLowStockCount } from '../utils/conversionConfig';
import { getProductOptionGroups, getProductVariants, needsOptionSelection, optionValueIsCompatible, selectCompatibleProductOption, variantMatchesSelectedOptions } from '../utils/productOptions';
import { clearCheckoutCartItemIds, syncCheckoutCartItemIds } from '../utils/cartSession';
import { dispatchDomEvent } from '../utils/domEvents';
import { buildResponsiveImageSrcSet, getOptimizedImageUrl } from '../utils/mediaAssets';
import { buildLoginUrlFromWindow } from '../utils/authRedirect';
import { getLocalStorageItem, hasStoredValue, removeSessionStorageItem } from '../utils/safeStorage';
import { getLimitedTimeEndMs, getLimitedTimeRemainingMs, shouldRunLimitedTimeTicker } from '../utils/limitedTimeCountdown';
import { getApiErrorMessage, getApiErrorStatus } from '../utils/apiError';
import { addCompareProduct, isProductCompared, MAX_COMPARE_ITEMS } from '../utils/productCompare';
import { addAppScrollListener } from '../utils/nativeScroll';
import { useNativeBackHandler } from '../utils/nativeBack';
import { AUTH_SESSION_CHANGED_EVENT } from '../utils/authEvents';
import { formatProductSpecLabel } from '../utils/productSpecLabels';
import { syncHiddenCarouselSlideFocus } from '../utils/carouselAccessibility';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import PageEmpty from '../components/PageEmpty';
import PageError from '../components/PageError';
import { usePageTitle } from '../hooks/usePageTitle';
import {
  applyImageFallback,
  cacheProductRecommendations,
  clampZoom,
  clearProductDetailSessionCaches,
  fallbackProductImage,
  findFallbackProductById,
  getCachedProductRecommendations,
  getTouchDistance,
  getTouchPair,
  handleGalleryZoomLeave,
  handleGalleryZoomMove,
  normalizeProductImages,
  renderTrustIcon,
  resolveProductPrimaryImage,
  scoreRelatedRecommendation,
} from './productDetailHelpers';
import type { GalleryTouchPoint, ProductRecommendationCandidate } from './productDetailHelpers';
import './ProductDetail.css';
import '../styles/mobile-page-contrast.css';

const { Title, Text } = Typography;
const ProductRichDetail = React.lazy(() => import('../components/ProductRichDetail'));
const ProductReview = React.lazy(() => import('../components/ProductReview').then((module) => ({ default: module.ProductReview })));

interface PendingProductQuestion {
  id: string;
  question: string;
  createdAt: string;
}
const eagerImagePriorityProps = { fetchpriority: 'high' } as unknown as React.ImgHTMLAttributes<HTMLImageElement>;
const lazyImagePriorityProps = { fetchpriority: 'auto' } as unknown as React.ImgHTMLAttributes<HTMLImageElement>;

const PRODUCT_QUESTION_MAX_LENGTH = 500;
const PRODUCT_SIZE_CALCULATOR_MAX_WEIGHT_KG = 200;

const stripQuestionControlChars = (value: string) =>
  Array.from(value, (char) => {
    const code = char.charCodeAt(0);
    return code <= 31 || code === 127 ? ' ' : char;
  }).join('');

const normalizeQuestionText = (value: string) => (
  stripQuestionControlChars(value).trim().replace(/\s+/g, ' ').slice(0, PRODUCT_QUESTION_MAX_LENGTH)
);

const normalizeSizeCalculatorWeight = (value: string) => {
  if (!value.trim()) return '';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '';
  return String(Math.min(PRODUCT_SIZE_CALCULATOR_MAX_WEIGHT_KG, Math.max(0, numeric)));
};

const ProductDetailSkeleton: React.FC<{ label: string }> = ({ label }) => (
  <div className="product-detail-page product-detail-page--loading">
    <div className="product-detail-shell">
      <div
        className="product-detail-skeleton"
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={label}
        data-testid="product-detail-skeleton"
      >
        <span className="product-detail-skeleton__sr">{label}</span>
        <div className="product-detail-skeleton__breadcrumb" aria-hidden="true">
          <span className="product-detail-skeleton__block product-detail-skeleton__block--crumb" />
          <span className="product-detail-skeleton__block product-detail-skeleton__block--crumb product-detail-skeleton__block--crumbLong" />
          <span className="product-detail-skeleton__block product-detail-skeleton__block--crumb product-detail-skeleton__block--crumbShort" />
        </div>

        <div className="product-detail-skeleton__main">
          <section className="product-detail-skeleton__media" aria-hidden="true" data-testid="product-detail-skeleton-gallery">
            <div className="product-detail-skeleton__imageFrame">
              <span className="product-detail-skeleton__block product-detail-skeleton__block--image" />
            </div>
            <div className="product-detail-skeleton__thumbs">
              {Array.from({ length: 4 }).map((_, index) => (
                <span key={index} className="product-detail-skeleton__block product-detail-skeleton__block--thumb" />
              ))}
            </div>
          </section>

          <section className="product-detail-skeleton__summary" aria-hidden="true" data-testid="product-detail-skeleton-summary">
            <span className="product-detail-skeleton__block product-detail-skeleton__block--brand" />
            <span className="product-detail-skeleton__block product-detail-skeleton__block--title" />
            <span className="product-detail-skeleton__block product-detail-skeleton__block--subtitle" />
            <span className="product-detail-skeleton__block product-detail-skeleton__block--price" />
            <div className="product-detail-skeleton__signals">
              {Array.from({ length: 3 }).map((_, index) => (
                <span key={index} className="product-detail-skeleton__block product-detail-skeleton__block--signal" />
              ))}
            </div>
            <div className="product-detail-skeleton__options">
              {Array.from({ length: 2 }).map((_, index) => (
                <div key={index} className="product-detail-skeleton__optionGroup">
                  <span className="product-detail-skeleton__block product-detail-skeleton__block--optionLabel" />
                  <div className="product-detail-skeleton__optionPills">
                    {Array.from({ length: 3 }).map((__, pillIndex) => (
                      <span key={pillIndex} className="product-detail-skeleton__block product-detail-skeleton__block--pill" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="product-detail-skeleton__actions">
              <span className="product-detail-skeleton__block product-detail-skeleton__block--action" />
              <span className="product-detail-skeleton__block product-detail-skeleton__block--action product-detail-skeleton__block--actionPrimary" />
            </div>
          </section>
        </div>

        <div className="product-detail-skeleton__afterfold" aria-hidden="true" data-testid="product-detail-skeleton-afterfold">
          <div className="product-detail-skeleton__tabs">
            <span className="product-detail-skeleton__block product-detail-skeleton__block--tab" />
            <span className="product-detail-skeleton__block product-detail-skeleton__block--tab" />
            <span className="product-detail-skeleton__block product-detail-skeleton__block--tab" />
          </div>
          <div className="product-detail-skeleton__detailRows">
            <span className="product-detail-skeleton__block product-detail-skeleton__block--detail product-detail-skeleton__block--detailLong" />
            <span className="product-detail-skeleton__block product-detail-skeleton__block--detail" />
            <span className="product-detail-skeleton__block product-detail-skeleton__block--detail product-detail-skeleton__block--detailShort" />
          </div>
          <div className="product-detail-skeleton__recommendations">
            {Array.from({ length: 3 }).map((_, index) => (
              <span key={index} className="product-detail-skeleton__block product-detail-skeleton__block--recommendation" />
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

const ProductDetailLazyFallback: React.FC<{ label: string; variant: 'rich' | 'review' }> = ({ label, variant }) => (
  <div
    className={`product-detail-lazy-skeleton product-detail-lazy-skeleton--${variant}`}
    role="status"
    aria-live="polite"
    aria-busy="true"
    aria-label={label}
    data-testid={`product-detail-lazy-${variant}-fallback`}
  >
    <span className="product-detail-skeleton__sr">{label}</span>
    {variant === 'rich' ? (
      <>
        <span className="product-detail-skeleton__block product-detail-lazy-skeleton__line product-detail-lazy-skeleton__line--wide" />
        <span className="product-detail-skeleton__block product-detail-lazy-skeleton__line" />
        <span className="product-detail-skeleton__block product-detail-lazy-skeleton__media" />
      </>
    ) : (
      <>
        <span className="product-detail-skeleton__block product-detail-lazy-skeleton__title" />
        <div className="product-detail-lazy-skeleton__composer">
          <span className="product-detail-skeleton__block product-detail-lazy-skeleton__select" />
          <span className="product-detail-skeleton__block product-detail-lazy-skeleton__textarea" />
          <span className="product-detail-skeleton__block product-detail-lazy-skeleton__button" />
        </div>
        <div className="product-detail-lazy-skeleton__reviewRows">
          {Array.from({ length: 2 }).map((_, index) => (
            <div className="product-detail-lazy-skeleton__reviewRow" key={index}>
              <span className="product-detail-skeleton__block product-detail-lazy-skeleton__avatar" />
              <span className="product-detail-skeleton__block product-detail-lazy-skeleton__line" />
            </div>
          ))}
        </div>
      </>
    )}
  </div>
);

const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [activeMobileImageIndex, setActiveMobileImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [reviewableOrders, setReviewableOrders] = useState<ReviewableOrder[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [recommendations, setRecommendations] = useState<Product[]>([]);
  const [recommendationAddingId, setRecommendationAddingId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<ProductQuestionPublic[]>([]);
  const [pendingQuestions, setPendingQuestions] = useState<PendingProductQuestion[]>([]);
  const [questionText, setQuestionText] = useState('');
  const [questionSubmitting, setQuestionSubmitting] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [documentHidden, setDocumentHidden] = useState(typeof document !== 'undefined' ? document.hidden : false);
  const [imagePaused, setImagePaused] = useState(false);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  useNativeBackHandler(isModalVisible, () => {
    setIsModalVisible(false);
    return true;
  });
  useNativeBackHandler(sizeGuideOpen, () => {
    setSizeGuideOpen(false);
    return true;
  });
  const [sizeCalculatorBreed, setSizeCalculatorBreed] = useState('');
  const [sizeCalculatorWeight, setSizeCalculatorWeight] = useState('');
  const [purchaseMode, setPurchaseMode] = useState<'once' | 'bundle'>('once');
  const [purchaseSubmitting, setPurchaseSubmitting] = useState<'cart' | 'buy' | null>(null);
  const [pinchZoom, setPinchZoom] = useState({ active: false, scale: 1, originX: 50, originY: 50 });
  const [isAlerted, setIsAlerted] = useState(false);
  const [isCompared, setIsCompared] = useState(false);
  const [authSessionVersion, setAuthSessionVersion] = useState(0);
  const mobileGalleryRef = useRef<HTMLDivElement | null>(null);
  const detailContentRef = useRef<HTMLDivElement | null>(null);
  const optionsSectionRef = useRef<HTMLDivElement | null>(null);
  const nonCriticalLoadedRef = useRef(false);
  const nonCriticalRequestSeqRef = useRef(0);
  const pinchStartRef = useRef<{ distance: number; scale: number } | null>(null);
  const imageResumeTimerRef = useRef<number | null>(null);
  const purchaseRequestKeyRef = useRef<string | null>(null);
  const recommendationRequestIdsRef = useRef<Set<number>>(new Set());
  const galleryScrollRafRef = useRef<number | null>(null);
  const recommendationCarouselRef = useRef<HTMLDivElement | null>(null);
  const { t, language } = useLanguage();
  const productDetailLocalizationRef = useRef({ t, language });
  productDetailLocalizationRef.current = { t, language };
  const pageTitle = product?.name?.trim() || (loadError ? t('pages.productDetail.loadFailed') : '');
  usePageTitle(pageTitle || t('pages.productDetail.product'));
  const { currency, market, formatMoney } = useMarket();
  const detailProductName = useCallback((item: Pick<Product, 'id' | 'name'>) =>
    (item.name || '').trim() || t('pages.profile.productFallback', { id: item.id }), [t]);
  const trustBadges = conversionConfig.productTrustBadges.enabled ? conversionConfig.productTrustBadges.badges : [];
  const deliveryPromise = useMemo(
    () => getDeliveryPromise({ currency, locale: market.locale }),
    [currency, market.locale],
  );
  const heroImage = useMemo(() => getOptimizedImageUrl(selectedImage || fallbackProductImage, 900), [selectedImage]);
  const heroImageSrcSet = useMemo(() => buildResponsiveImageSrcSet(selectedImage || fallbackProductImage, [480, 720, 900, 1200]), [selectedImage]);
  const shouldPreloadHeroImage = Boolean(selectedImage);
  const heroImageSizes = '(max-width: 768px) 100vw, 560px';

  const syncRecommendationCarouselFocus = useCallback(() => {
    syncHiddenCarouselSlideFocus(recommendationCarouselRef.current);
  }, []);

  useEffect(() => {
    syncRecommendationCarouselFocus();
    if (process.env.NODE_ENV === 'test') return;
    const frameId = window.requestAnimationFrame(syncRecommendationCarouselFocus);
    const timeoutId = window.setTimeout(syncRecommendationCarouselFocus, 80);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [recommendations, syncRecommendationCarouselFocus]);

  useEffect(() => {
    const links: HTMLLinkElement[] = [];
    const addLink = (attributes: Record<string, string>) => {
      const link = document.createElement('link');
      Object.entries(attributes).forEach(([key, value]) => link.setAttribute(key, value));
      document.head.appendChild(link);
      links.push(link);
      return link;
    };

    const pushPreconnect = (assetUrl: string) => {
      try {
        const origin = new URL(assetUrl, window.location.origin).origin;
        if (!origin || origin === window.location.origin) return;
        if (!Array.from(document.head.querySelectorAll('link[rel="preconnect"]')).some((link) => link.getAttribute('href') === origin)) {
          addLink({ rel: 'preconnect', href: origin, crossOrigin: 'anonymous' });
        }
      } catch (error) {
        reportNonBlockingError('ProductDetail.preconnectHeroImage', error);
      }
    };

    if (shouldPreloadHeroImage && heroImage) {
      pushPreconnect(heroImage);
      addLink({
        rel: 'preload',
        as: 'image',
        href: heroImage,
        ...(heroImageSrcSet ? { imagesrcset: heroImageSrcSet, imagesizes: heroImageSizes } : {}),
      });
    }

    return () => {
      links.forEach((link) => link.remove());
    };
  }, [heroImage, heroImageSrcSet, shouldPreloadHeroImage]);

  const limitedTimeEnd = useMemo(() => getLimitedTimeEndMs(product?.limitedTimeEndAt), [product?.limitedTimeEndAt]);
  const limitedTimeTickerActive = shouldRunLimitedTimeTicker(product, now);

  useEffect(() => {
    if (!limitedTimeTickerActive) return;
    // Keep Jest free of perpetual 1s timers that retain the page and open handles.
    if (process.env.NODE_ENV === 'test') return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [limitedTimeTickerActive, limitedTimeEnd]);

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

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
    const handleVisibilityChange = () => {
      setDocumentHidden(document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => () => {
    if (galleryScrollRafRef.current !== null) {
      window.cancelAnimationFrame(galleryScrollRafRef.current);
      galleryScrollRafRef.current = null;
    }
  }, []);

  const productImages = useMemo(() => product ? normalizeProductImages(product) : [], [product]);
  const galleryImages = useMemo(() => productImages.slice(0, -1), [productImages]);
  const optionGroups = useMemo(() => getProductOptionGroups(product), [product]);
  const variants = useMemo(() => getProductVariants(product), [product]);
  const bundleInfo = useMemo(() => getBundleInfo(product), [product]);
  const selectedVariant = useMemo(() => {
    if (!variants.length) return undefined;
    return variants.find((variant) => {
      const variantOptions = variant.options || {};
      const variantKeys = Object.keys(variantOptions);
      const selectedKeys = Object.keys(selectedOptions).filter((key) => selectedOptions[key]);
      return variantKeys.length === selectedKeys.length
        && variantKeys.every((key) => selectedOptions[key] === variantOptions[key])
        && selectedKeys.every((key) => Object.prototype.hasOwnProperty.call(variantOptions, key));
    });
  }, [selectedOptions, variants]);
  const currentStock = selectedVariant?.stock ?? product?.stock;
  const selectedSpecsPayload = useMemo(() => JSON.stringify({
    ...selectedOptions,
    ...(selectedVariant?.sku ? { _variantSku: selectedVariant.sku } : {}),
    ...(purchaseMode === 'bundle' && bundleInfo ? {
      _purchaseMode: 'bundle',
      _bundleTitle: bundleInfo.title,
      _bundleItems: bundleInfo.items.map((item) => `${item.name} x${item.quantity || 1}`).join(', '),
    } : {}),
  }), [bundleInfo, purchaseMode, selectedOptions, selectedVariant]);

  const focusOptionsSection = () => {
    optionsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const validateOptions = () => {
    const missing = optionGroups.find((group) => !selectedOptions[group.name]);
    if (missing) {
      message.warning(t('pages.productDetail.selectOption', { option: missing.name }));
      focusOptionsSection();
      return false;
    }
    if (variants.length > 0 && !selectedVariant) {
      message.warning(t('pages.productDetail.variantUnavailable'));
      focusOptionsSection();
      return false;
    }
    return true;
  };

  useEffect(() => {
    if (loading || !product || imagePaused || galleryImages.length <= 1 || isModalVisible) return;
    // Avoid background carousel timers in tests and when the tab is hidden.
    if (process.env.NODE_ENV === 'test') return;
    if (documentHidden) return;
    const timer = window.setInterval(() => {
      if (documentHidden) return;
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
  }, [documentHidden, galleryImages, imagePaused, isModalVisible, loading, product]);

  useEffect(() => {
    if (currentStock === undefined || quantity <= currentStock) return;
    const nextQuantity = Math.max(1, currentStock);
    if (quantity !== nextQuantity) {
      setQuantity(nextQuantity);
    }
  }, [currentStock, quantity]);

  useEffect(() => {
    const handleAuthSessionChanged = () => {
      nonCriticalRequestSeqRef.current += 1;
      clearProductDetailSessionCaches();
      nonCriticalLoadedRef.current = false;
      setIsWishlisted(false);
      setReviewableOrders([]);
      setRecommendations([]);
      setRecommendationAddingId(null);
      setAuthSessionVersion((version) => version + 1);
    };
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, handleAuthSessionChanged);
    return () => {
      window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, handleAuthSessionChanged);
    };
  }, []);

  const isCurrentNonCriticalRequest = useCallback((requestSeq: number) => (
    nonCriticalRequestSeqRef.current === requestSeq
  ), []);

  const fetchReviews = useCallback(async (requestSeq: number) => {
    try {
      const res = await reviewApi.getAll(Number(id));
      if (!isCurrentNonCriticalRequest(requestSeq)) return;
      setReviews(res.data.reviews || []);
      setAverageRating(Number(res.data.averageRating || 0));
    } catch (error) {
      if (!isCurrentNonCriticalRequest(requestSeq)) return;
      reportNonBlockingError('ProductDetail.fetchReviews', error);
    }
  }, [id, isCurrentNonCriticalRequest]);

  const fetchRecommendations = useCallback(async (requestSeq: number) => {
    try {
      const cacheKey = `${language}|${id}`;
      const cached = getCachedProductRecommendations(cacheKey);
      if (cached) {
        if (!isCurrentNonCriticalRequest(requestSeq)) return;
        setRecommendations(cached);
        return;
      }
      const res = await productApi.getRecommendations(Number(id));
      const items = res.data.map((item: Product) => localizeProduct(item, language));
      if (!isCurrentNonCriticalRequest(requestSeq)) return;
      cacheProductRecommendations(cacheKey, items);
      setRecommendations(items);
    } catch (error) {
      if (!isCurrentNonCriticalRequest(requestSeq)) return;
      reportNonBlockingError('ProductDetail.fetchRecommendations', error);
    }
  }, [id, isCurrentNonCriticalRequest, language]);

  const fetchQuestions = useCallback(async (requestSeq: number) => {
    try {
      const res = await questionApi.getByProduct(Number(id));
      if (!isCurrentNonCriticalRequest(requestSeq)) return;
      const answeredQuestions = res.data || [];
      setQuestions(answeredQuestions);
      setPendingQuestions((current) => current.filter((pendingQuestion) => (
        !answeredQuestions.some((question) => normalizeQuestionText(question.question) === normalizeQuestionText(pendingQuestion.question))
      )));
    } catch (error) {
      if (!isCurrentNonCriticalRequest(requestSeq)) return;
      reportNonBlockingError('ProductDetail.fetchQuestions', error);
      setQuestions([]);
    }
  }, [id, isCurrentNonCriticalRequest]);

  const fetchReviewableOrders = useCallback(async (requestSeq: number) => {
    try {
      const ordersRes = await reviewApi.getReviewableOrders(Number(id));
      if (!isCurrentNonCriticalRequest(requestSeq)) return;
      setReviewableOrders(ordersRes.data || []);
    } catch (error) {
      if (!isCurrentNonCriticalRequest(requestSeq)) return;
      reportNonBlockingError('ProductDetail.fetchReviewableOrders', error);
      setReviewableOrders([]);
    }
  }, [id, isCurrentNonCriticalRequest]);

  const warmNonCriticalContent = useCallback((requestSeq: number) => {
    if (!isCurrentNonCriticalRequest(requestSeq)) return;
    if (nonCriticalLoadedRef.current) return;
    nonCriticalLoadedRef.current = true;
    const token = getLocalStorageItem('token');
    fetchReviews(requestSeq);
    fetchQuestions(requestSeq);
    fetchRecommendations(requestSeq);
    if (token) {
      fetchReviewableOrders(requestSeq);
    }
  }, [fetchQuestions, fetchRecommendations, fetchReviewableOrders, fetchReviews, isCurrentNonCriticalRequest]);

  useEffect(() => {
    let disposed = false;
    const nonCriticalRequestSeq = nonCriticalRequestSeqRef.current + 1;
    nonCriticalRequestSeqRef.current = nonCriticalRequestSeq;
    nonCriticalLoadedRef.current = false;
    setReviews([]);
    setQuestions([]);
    setPendingQuestions([]);
    setQuestionText('');
    setRecommendations([]);
    setReviewableOrders([]);
    setAverageRating(0);
    setQuestionSubmitting(false);
    const token = getLocalStorageItem('token');
    const fetchProduct = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await productApi.getById(Number(id));
        if (disposed) return;
        setProduct(localizeProduct(res.data as Product, language));
        setSelectedImage(normalizeProductImages(res.data)[0]);
        setActiveMobileImageIndex(0);
        recordProductView(res.data);
        setLoadError(null);
      } catch (error) {
        if (disposed) return;
        reportNonBlockingError('ProductDetail.fetchProduct', error);
        const fallbackProduct = findFallbackProductById(Number(id));
        if (fallbackProduct) {
          setProduct(localizeProduct(fallbackProduct as Product, language));
          setSelectedImage(normalizeProductImages(fallbackProduct)[0]);
          setActiveMobileImageIndex(0);
          setLoadError(null);
          return;
        }
        const status = getApiErrorStatus(error);
        if (status === 404) {
          setLoadError(null);
        } else {
          const { t: latestT, language: latestLanguage } = productDetailLocalizationRef.current;
          setLoadError(getApiErrorMessage(error, latestT('pages.productDetail.loadFailed'), latestLanguage));
        }
        setProduct(null);
      } finally {
        if (disposed) return;
        setLoading(false);
      }
    };
    fetchProduct();
    if (token) {
      wishlistApi.check(0, Number(id))
        .then(res => {
          if (!disposed) setIsWishlisted(res.data.wishlisted);
        })
        .catch((error) => {
          if (!disposed) reportNonBlockingError('ProductDetail.checkWishlist', error);
        });
    }
    setIsAlerted(hasStockAlert(Number(id)));
    setIsCompared(isProductCompared(Number(id)));

    const fallbackTimer = process.env.NODE_ENV === 'test'
      ? null
      : window.setTimeout(() => warmNonCriticalContent(nonCriticalRequestSeq), 1800);
    const target = detailContentRef.current;
    let observer: IntersectionObserver | null = null;
    if (target && 'IntersectionObserver' in window) {
      observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          warmNonCriticalContent(nonCriticalRequestSeq);
          observer?.disconnect();
        }
      }, { rootMargin: '520px 0px' });
      observer.observe(target);
    } else {
      let removeScrollWarmup: () => void = () => undefined;
      const detachScrollWarmup = () => {
        removeScrollWarmup();
        removeScrollWarmup = () => undefined;
      };
      const scrollWarmup = () => {
        const nextTarget = detailContentRef.current;
        if (!nextTarget) return;
        if (nextTarget.getBoundingClientRect().top < window.innerHeight + 520) {
          warmNonCriticalContent(nonCriticalRequestSeq);
          detachScrollWarmup();
        }
      };
      const scrollWarmupCleanup = addAppScrollListener(scrollWarmup, { passive: true });
      removeScrollWarmup = typeof scrollWarmupCleanup === 'function'
        ? scrollWarmupCleanup
        : () => undefined;
      scrollWarmup();
      return () => {
        disposed = true;
        nonCriticalRequestSeqRef.current += 1;
        if (fallbackTimer !== null) {
          window.clearTimeout(fallbackTimer);
        }
        detachScrollWarmup();
        observer?.disconnect();
      }
    }

    return () => {
      disposed = true;
      nonCriticalRequestSeqRef.current += 1;
      if (fallbackTimer !== null) {
        window.clearTimeout(fallbackTimer);
      }
      observer?.disconnect();
    };
  }, [authSessionVersion, id, language, reloadToken, warmNonCriticalContent]);

  useEffect(() => {
    const syncStockAlert = () => setIsAlerted(hasStockAlert(Number(id)));
    window.addEventListener('shop:stock-alerts-updated', syncStockAlert);
    window.addEventListener('storage', syncStockAlert);
    return () => {
      window.removeEventListener('shop:stock-alerts-updated', syncStockAlert);
      window.removeEventListener('storage', syncStockAlert);
    };
  }, [id]);

  useEffect(() => {
    const syncCompareState = () => setIsCompared(isProductCompared(Number(id)));
    window.addEventListener('shop:compare-updated', syncCompareState);
    window.addEventListener('storage', syncCompareState);
    return () => {
      window.removeEventListener('shop:compare-updated', syncCompareState);
      window.removeEventListener('storage', syncCompareState);
    };
  }, [id]);

  const getPinchOrigin = useCallback((first: GalleryTouchPoint, second: GalleryTouchPoint) => {
    const gallery = mobileGalleryRef.current;
    if (!gallery) return { originX: 50, originY: 50 };
    const rect = gallery.getBoundingClientRect();
    const centerX = (first.clientX + second.clientX) / 2;
    const centerY = (first.clientY + second.clientY) / 2;
    return {
      originX: Math.min(100, Math.max(0, ((centerX - rect.left) / rect.width) * 100)),
      originY: Math.min(100, Math.max(0, ((centerY - rect.top) / rect.height) * 100)),
    };
  }, []);

  const handleGalleryTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 2) return;
    const pair = getTouchPair(event.touches);
    if (!pair) return;
    setImagePaused(true);
    pinchStartRef.current = { distance: getTouchDistance(pair.first, pair.second), scale: pinchZoom.scale };
    setPinchZoom({ active: true, scale: 1, ...getPinchOrigin(pair.first, pair.second) });
  };

  const handleGalleryTouchMove = useCallback((event: TouchEvent) => {
    if (event.touches.length !== 2 || !pinchStartRef.current) return;
    const pair = getTouchPair(event.touches);
    if (!pair) return;
    event.preventDefault();
    const nextScale = clampZoom((getTouchDistance(pair.first, pair.second) / pinchStartRef.current.distance) * pinchStartRef.current.scale);
    setPinchZoom({ active: true, scale: nextScale, ...getPinchOrigin(pair.first, pair.second) });
  }, [getPinchOrigin]);

  useEffect(() => {
    const gallery = mobileGalleryRef.current;
    if (!gallery) return;
    gallery.addEventListener('touchmove', handleGalleryTouchMove, { passive: false });
    return () => {
      gallery.removeEventListener('touchmove', handleGalleryTouchMove);
    };
  }, [handleGalleryTouchMove, loading]);

  const resetGalleryPinch = () => {
    if (!pinchStartRef.current && !pinchZoom.active) return;
    pinchStartRef.current = null;
    setPinchZoom((current) => ({ ...current, active: false, scale: 1 }));
    scheduleImageRotationResume();
  };

  const handleAddToCart = async () => {
    if (purchaseSubmitting || purchaseRequestKeyRef.current) return;
    const token = getLocalStorageItem('token');
    try {
      if (!validateOptions()) return;
      if (selectedStock !== undefined && selectedStock < quantity) {
        message.error(t('pages.productDetail.insufficientStock'));
        return;
      }
      const specs = optionGroups.length || purchaseMode !== 'once' ? selectedSpecsPayload : undefined;
      purchaseRequestKeyRef.current = `cart:${id}:${quantity}:${specs || ''}`;
      setPurchaseSubmitting('cart');
      if (token) {
        await cartApi.addItem(0, Number(id), quantity, specs);
        dispatchDomEvent('shop:cart-updated');
      } else {
        const cartItem = addGuestCartItem(buildCartProductSnapshot(), quantity, specs, displayPrice);
        if (!cartItem) {
          message.error(t('messages.addFailed'));
          return;
        }
      }
      message.success(t('messages.addCartSuccess'));
      dispatchDomEvent('shop:open-cart');
    } catch (err: unknown) {
      message.error(getApiErrorMessage(err, t('messages.addFailed'), language));
    } finally {
      purchaseRequestKeyRef.current = null;
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
    if (purchaseSubmitting || purchaseRequestKeyRef.current) return;
    const token = getLocalStorageItem('token');
    try {
      if (!validateOptions()) return;
      if (selectedStock !== undefined && selectedStock < quantity) {
        message.error(t('pages.productDetail.insufficientStock'));
        return;
      }
      const specs = optionGroups.length || purchaseMode !== 'once' ? selectedSpecsPayload : undefined;
      purchaseRequestKeyRef.current = `buy:${id}:${quantity}:${specs || ''}`;
      setPurchaseSubmitting('buy');
      if (token) {
        await cartApi.addItem(0, Number(id), quantity, specs);
        dispatchDomEvent('shop:cart-updated');
        const cartRes = await cartApi.getItems(0);
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
        if (!cartItem) {
          message.error(t('messages.operationFailed'));
          return;
        }
        syncCheckoutCartItemIds([cartItem]);
      }
      removeSessionStorageItem('checkoutPaymentMethod');
      navigate('/checkout');
    } catch (err: unknown) {
      message.error(getApiErrorMessage(err, t('messages.operationFailed'), language));
    } finally {
      purchaseRequestKeyRef.current = null;
      setPurchaseSubmitting(null);
    }
  };

  const handleFavorite = async () => {
    const token = getLocalStorageItem('token');
    if (!token) {
      message.warning(t('messages.loginRequired'));
      navigate(buildLoginUrlFromWindow());
      return;
    }
    try {
      const res = await wishlistApi.toggle(0, Number(id));
      setIsWishlisted(res.data.wishlisted);
      dispatchDomEvent('shop:wishlist-updated');
      message.success(res.data.wishlisted ? t('pages.productDetail.favoritedMsg') : t('pages.productDetail.unfavoritedMsg'));
    } catch (err: unknown) {
      message.error(getApiErrorMessage(err, t('messages.operationFailed'), language));
    }
  };

  const handleStockAlert = () => {
    const currentProduct = product;
    if (!currentProduct) {
      return;
    }
    if (isAlerted) {
      removeStockAlert(Number(id));
      setIsAlerted(false);
      message.success(t('pages.stockAlerts.removed'));
      return;
    }
    const result = addStockAlert(currentProduct);
    setIsAlerted(true);
    message.success(result.status === 'exists' ? t('pages.stockAlerts.exists') : t('pages.stockAlerts.added'));
  };

  const handleCompare = () => {
    const currentProduct = product;
    if (!currentProduct) {
      return;
    }
    const result = addCompareProduct(currentProduct);
    if (result.status === 'full') {
      message.warning(t('pages.productList.compareFull', { count: MAX_COMPARE_ITEMS }));
      return;
    }
    setIsCompared(true);
    message.success(result.status === 'exists' ? t('pages.productList.compareExists') : t('pages.productList.compareAdded'));
    navigate('/compare');
  };

  const handleAddReview = async (orderId: number, rating: number, comment: string, imageUrls: string[] = []) => {
    const requestSeq = nonCriticalRequestSeqRef.current;
    await reviewApi.create(Number(id), orderId, rating, comment, imageUrls);
    if (!isCurrentNonCriticalRequest(requestSeq)) return;
    await fetchReviews(requestSeq);
    const token = getLocalStorageItem('token');
    if (token) {
      await fetchReviewableOrders(requestSeq);
    }
  };

  const handleAskQuestion = async () => {
    if (!hasStoredValue('token')) {
      message.warning(t('messages.loginRequired'));
      navigate(buildLoginUrlFromWindow());
      return;
    }
    if (!normalizeQuestionText(questionText)) {
      message.warning(t('pages.ask.emptyQuestion'));
      return;
    }
    const requestSeq = nonCriticalRequestSeqRef.current;
    try {
      setQuestionSubmitting(true);
      const submittedQuestion = normalizeQuestionText(questionText);
      await questionApi.ask(Number(id), submittedQuestion);
      if (!isCurrentNonCriticalRequest(requestSeq)) return;
      setPendingQuestions((current) => [
        {
          id: `${Date.now()}`,
          question: submittedQuestion,
          createdAt: new Date().toISOString(),
        },
        ...current.filter((pendingQuestion) => normalizeQuestionText(pendingQuestion.question) !== submittedQuestion).slice(0, 4),
      ]);
      setQuestionText('');
      await fetchQuestions(requestSeq);
      message.success(t('pages.ask.pendingTitle'));
    } catch (err: unknown) {
      if (!isCurrentNonCriticalRequest(requestSeq)) return;
      message.error(getApiErrorMessage(err, t('pages.ask.askFailed'), language));
    } finally {
      if (isCurrentNonCriticalRequest(requestSeq)) {
        setQuestionSubmitting(false);
      }
    }
  };

  if (loading) {
    return <ProductDetailSkeleton label={t('common.loading')} />;
  }

  if (!product) {
    if (loadError) {
      return (
        <div className="product-detail-empty">
          <PageError
            title={t('pages.productDetail.loadFailed')}
            description={loadError || t('pages.productDetail.loadFailedDescription')}
            retryLabel={t('common.refresh')}
            onRetry={() => setReloadToken((value) => value + 1)}
            homeLabel={t('pages.productList.title')}
            onHome={() => navigate('/products')}
          />
        </div>
      );
    }
    return (
      <div className="product-detail-empty">
        <PageEmpty
          description={t('pages.productDetail.notFound')}
          primaryAction={{
            key: 'browse',
            label: t('pages.productList.title'),
            onClick: () => navigate('/products'),
          }}
          secondaryAction={{
            key: 'home',
            label: t('nav.ariaHome'),
            onClick: () => navigate('/'),
            type: 'default',
          }}
        />
      </div>
    );
  }

  const productName = detailProductName(product);
  const addCartActionLabel = `${t('pages.productDetail.addCart')}: ${productName}`;
  const buyNowActionLabel = `${t('pages.productDetail.buyNow')}: ${productName}`;
  const selectOptionsActionLabel = `${t('pages.wishlist.selectOptions')}: ${productName}`;
  const questionInputLabel = `${t('pages.ask.title')}: ${productName}`;
  const questionSubmitActionLabel = `${t('pages.ask.submit')}: ${productName}`;
  const stockAlertActionLabel = `${isAlerted ? t('pages.stockAlerts.remove') : t('pages.stockAlerts.notifyMe')}: ${productName}`;
  const favoriteActionLabel = `${isWishlisted ? t('pages.productDetail.favorited') : t('pages.productDetail.favorite')}: ${productName}`;
  const compareActionLabel = `${isCompared ? t('pages.productList.viewCompare') : t('pages.productList.compare')}: ${productName}`;
  const homeActionLabel = `${t('nav.ariaHome')}: ${productName}`;
  const mainImagePreviewActionLabel = `${t('pages.productList.quickPreview')}: ${productName}`;
  const galleryRegionLabel = `${productName}: ${t('pages.productDetail.product')} ${t('common.image')}`;
  const getGalleryImageLabel = (index: number) => t('pages.productDetail.imageThumb', { index: index + 1, total: galleryImages.length, name: productName });
  const sizeGuideActionLabel = `${t('pages.productDetail.sizeGuide')}: ${productName}`;
  const resetSelectedOptionsActionLabel = `${t('pages.productList.resetFilters')}: ${productName}`;
  const sizeBreedInputLabel = `${t('pages.productDetail.sizeCalculatorBreed')}: ${productName}`;
  const sizeWeightInputLabel = `${t('pages.productDetail.sizeCalculatorWeight')}: ${productName}`;
  const purchaseModeActionLabel = `${t('pages.productDetail.purchaseMode')}: ${productName}`;
  const useRecommendedPathActionLabel = `${t('pages.productDetail.useRecommendedPath')}: ${productName}`;
  const sizeGuideConfirmActionLabel = `${t('pages.productDetail.sizeGuideGotIt')}: ${t('pages.productDetail.sizeGuideTitle')}, ${productName}`;
  const selectedStock = currentStock;
  const isOutOfStock = selectedStock !== undefined && selectedStock <= 0;
  const stockLabel = selectedStock !== undefined ? selectedStock : t('pages.productDetail.enough');
  const lowStockCount = getLowStockCount(selectedStock, quantity);
  const isLowStock = !isOutOfStock && lowStockCount !== null && lowStockCount > 0;
  const lowStockUrgencyLabel = isLowStock
    ? t('pages.productDetail.lowStockUrgency', { count: lowStockCount })
    : '';
  const displayedRating = Number(averageRating || product.averageRating || 0);
  const activePrice = selectedVariant?.price ?? product.effectivePrice ?? product.price;
  const displayPrice = purchaseMode === 'bundle' && bundleInfo ? bundleInfo.price : activePrice;
  const bundleSavings = bundleInfo ? Math.max(0, activePrice - bundleInfo.price) : 0;
  const purchaseSubtotal = displayPrice * quantity;
  const purchaseSavings = purchaseMode === 'bundle'
    ? bundleSavings * quantity
    : 0;
  const renderProductDetailAmountText = (label: string, amount: string) => {
    const parts = label.split(amount);
    if (parts.length <= 1) return label;
    return (
      <span className="product-detail__amountPhrase commerce-atomic">
        {parts.map((part, index) => (
          <React.Fragment key={`${part}-${index}`}>
            {part}
            {index < parts.length - 1 ? <span className="commerce-money">{amount}</span> : null}
          </React.Fragment>
        ))}
      </span>
    );
  };
  const freeShippingThresholdAmount = formatMoney(market.freeShippingThreshold);
  const productFreeShippingText = market.freeShippingThreshold > 0
    ? renderProductDetailAmountText(
      t('pages.productDetail.freeShippingOver', { amount: freeShippingThresholdAmount }),
      freeShippingThresholdAmount,
    )
    : t('pages.productDetail.freeShipping');
  const productShippingText = product.freeShipping
    ? t('pages.productDetail.freeShipping')
    : product.shipping || productFreeShippingText;
  const purchaseModeLabel = purchaseMode === 'bundle'
      ? t('bundle.bundleDeal')
      : t('pages.productDetail.oneTimePurchase');
  const discountPercent = product.effectiveDiscountPercent || product.discount || 0;
  const originalReferencePrice = product.originalPrice && product.originalPrice > displayPrice ? product.originalPrice : undefined;
  const priceSavingsAmount = originalReferencePrice ? Math.max(0, originalReferencePrice - displayPrice) : 0;
  const priceSavingsPercent = originalReferencePrice
    ? Math.max(1, Math.round((priceSavingsAmount / originalReferencePrice) * 100))
    : discountPercent;
  const limitedTimeRemaining = getLimitedTimeRemainingMs(product, now);
  const limitedTimePromoActive = limitedTimeRemaining > 0;
  const hasCompleteOptions = optionGroups.every((group) => selectedOptions[group.name]);
  const hasUnavailableSelectedVariant = variants.length > 0 && hasCompleteOptions && !selectedVariant;
  const optionsMissing = optionGroups.length > 0 && !hasCompleteOptions;
  const purchaseSelectionBlocked = optionsMissing || hasUnavailableSelectedVariant;
  const addToCartActionLabel = purchaseSelectionBlocked ? selectOptionsActionLabel : addCartActionLabel;
  const addToCartBlocked = isOutOfStock || purchaseSelectionBlocked || purchaseSubmitting !== null;
  const mobileAddToCartBlocked = !isOutOfStock && (purchaseSelectionBlocked || purchaseSubmitting !== null);
  const buyNowBlocked = isOutOfStock || purchaseSelectionBlocked || purchaseSubmitting !== null;
  const buyNowBlockedReason = isOutOfStock
    ? `${t('pages.productDetail.soldOut')}: ${productName}`
    : purchaseSelectionBlocked
      ? selectOptionsActionLabel
      : buyNowActionLabel;
  const mobileCartBlockedReason = purchaseSelectionBlocked
    ? selectOptionsActionLabel
    : addToCartActionLabel;
  const selectedOptionTags = optionGroups
    .map((group) => ({
      name: group.name,
      label: getLocalizedOptionLabel(group.name, language),
      value: selectedOptions[group.name],
      valueLabel: getLocalizedOptionLabel(selectedOptions[group.name] || '', language),
    }))
    .filter((item) => item.value);
  const sizeOptionGroup = optionGroups.find((group) => isSizeOptionName(group.name));
  const sizeCalculatorWeightKg = Math.min(
    PRODUCT_SIZE_CALCULATOR_MAX_WEIGHT_KG,
    Math.max(0, Number(sizeCalculatorWeight || 0)),
  );
  const recommendedSize = estimatePetSize(sizeCalculatorBreed, sizeCalculatorWeightKg);
  const recommendedSizeValue = sizeOptionGroup?.values.find((value) => value.toLowerCase() === String(recommendedSize || '').toLowerCase());
  const recommendedSizeLabel = recommendedSizeValue
    ? getLocalizedOptionLabel(recommendedSizeValue, language)
    : getLocalizedOptionLabel(String(recommendedSize || ''), language);
  const fitConfidenceText = sizeOptionGroup
    ? recommendedSizeValue
      ? t('pages.productDetail.fitConfidenceMatched', { size: recommendedSizeLabel })
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
    return days > 0 ? `${t('pages.productDetail.limitedTimeDays', { count: days })} ${time}` : time;
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
      ready: !isOutOfStock && !isLowStock,
      title: isOutOfStock
        ? t('pages.productDetail.decisionStockOutTitle')
        : isLowStock
          ? t('pages.productDetail.decisionStockLowTitle')
          : t('pages.productDetail.decisionStockReadyTitle'),
      text: isOutOfStock
        ? t('pages.productDetail.decisionStockOutText')
        : isLowStock
          ? t('pages.productDetail.decisionStockLowText', { count: lowStockCount, stock: stockLabel })
          : t('pages.productDetail.decisionStockReadyText', { stock: stockLabel }),
    },
    {
      key: 'delivery',
      icon: <TruckOutlined />,
      ready: Boolean(deliveryPromise.enabled),
      title: t('pages.productDetail.decisionDeliveryTitle'),
      text: deliveryPromise.enabled
        ? t('pages.productDetail.decisionDeliveryText', { window: deliveryPromise.windowText })
        : productShippingText,
    },
    {
      key: 'value',
      icon: purchaseSavings > 0 || discountPercent > 0 ? <ThunderboltOutlined /> : <CheckCircleOutlined />,
      ready: true,
      title: purchaseSavings > 0 || discountPercent > 0
        ? t('pages.productDetail.decisionValueDealTitle')
        : t('pages.productDetail.decisionValueStableTitle'),
      text: purchaseSavings > 0
        ? renderProductDetailAmountText(t('pages.productDetail.decisionValueSavingsText', { amount: formatMoney(purchaseSavings) }), formatMoney(purchaseSavings))
        : discountPercent > 0
          ? t('pages.productDetail.decisionValueDiscountText', { percent: discountPercent })
          : t('pages.productDetail.decisionValueStableText'),
    },
  ];
  const recommendedPurchaseMode: 'once' | 'bundle' = bundleInfo && bundleSavings > 0
    ? 'bundle'
    : 'once';
  const recommendedPathTitle = recommendedPurchaseMode === 'bundle'
    ? t('pages.productDetail.pathBundleTitle')
    : t('pages.productDetail.pathOnceTitle');
  const recommendedPathText = recommendedPurchaseMode === 'bundle' && bundleInfo
    ? renderProductDetailAmountText(t('pages.productDetail.pathBundleText', { amount: formatMoney(bundleSavings * quantity) }), formatMoney(bundleSavings * quantity))
    : t('pages.productDetail.pathOnceText');
  const quantityValueLabel = t('pages.productDetail.quantityValue', { quantity });
  const decreaseQuantityLabel = t('pages.productDetail.decreaseQuantity', { quantity });
  const increaseQuantityLabel = t('pages.productDetail.increaseQuantity', { quantity });

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
    imageUrl: selectedVariant?.imageUrl || resolveProductPrimaryImage(product),
  });

  const isRecommendationUnavailable = (item: ProductRecommendationCandidate) => {
    const hasStockValue = item.stock !== undefined && item.stock !== null;
    return Boolean(hasStockValue && Number(item.stock) <= 0);
  };

  const handleAddRecommendationToCart = async (event: React.MouseEvent<HTMLElement>, item: Product) => {
    event.stopPropagation();
    const recommendationId = Number(item.id);
    if (!Number.isFinite(recommendationId) || recommendationRequestIdsRef.current.has(recommendationId)) {
      return;
    }
    if (isRecommendationUnavailable(item)) {
      message.warning(t('pages.productDetail.soldOut'));
      return;
    }
    if (needsOptionSelection(item)) {
      message.info(t('pages.wishlist.selectOptions'));
      navigate(`/products/${item.id}`);
      return;
    }

    const token = getLocalStorageItem('token');
    try {
      recommendationRequestIdsRef.current.add(recommendationId);
      setRecommendationAddingId(recommendationId);
      if (token) {
        await cartApi.addItem(0, recommendationId, 1);
        dispatchDomEvent('shop:cart-updated');
      } else {
        addGuestCartItem(item, 1, undefined, item.effectivePrice ?? item.price);
      }
      message.success(t('messages.addCartSuccess'));
      dispatchDomEvent('shop:open-cart');
    } catch (err: unknown) {
      message.error(getApiErrorMessage(err, t('messages.addFailed'), language));
    } finally {
      recommendationRequestIdsRef.current.delete(recommendationId);
      setRecommendationAddingId(null);
    }
  };

  const relatedRecommendations: Product[] = (Array.from(
    recommendations
      .filter((item) => Number(item.id) !== Number(product.id))
      .reduce((itemsById, item) => {
        const recommendationId = Number(item.id);
        if (Number.isFinite(recommendationId) && !itemsById.has(recommendationId)) {
          itemsById.set(recommendationId, item);
        }
        return itemsById;
      }, new Map<number, Product>())
      .values(),
  ) as Product[])
    .map((item, index) => ({ item, index, score: scoreRelatedRecommendation(product, item) }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((entry) => entry.item);
  const completeSetItems = relatedRecommendations
    .filter((item) => !isRecommendationUnavailable(item))
    .slice(0, 2);
  const mobilePurchaseStatus = isOutOfStock
    ? t('pages.productDetail.soldOut')
    : hasUnavailableSelectedVariant
      ? t('pages.productDetail.selectedVariantUnavailable')
      : optionsMissing
        ? t('pages.productDetail.decisionOptionsMissingText')
        : isLowStock
          ? lowStockUrgencyLabel
          : t('pages.productDetail.decisionReady');
  const mobileBuybarPrice = formatMoney(displayPrice);
  const mobileBuybarStatus = mobilePurchaseStatus;
  const shouldShowDecisionChecklist = optionsMissing || hasUnavailableSelectedVariant || isOutOfStock || isLowStock;
  const purchaseReadinessItems = [
    {
      key: 'selection',
      icon: <CheckCircleOutlined />,
      ready: !purchaseSelectionBlocked,
      title: optionGroups.length === 0
        ? t('pages.productDetail.decisionNoOptionsTitle')
        : purchaseSelectionBlocked
          ? t('pages.productDetail.decisionOptionsMissingTitle')
          : t('pages.productDetail.decisionOptionsReadyTitle'),
      text: optionGroups.length === 0
        ? t('pages.productDetail.decisionNoOptionsText')
        : hasUnavailableSelectedVariant
          ? t('pages.productDetail.selectedVariantUnavailable')
          : hasCompleteOptions
            ? t('pages.productDetail.selectedVariantStock', { stock: stockLabel })
            : t('pages.productDetail.selectedOptionsEmpty'),
    },
    {
      key: 'stock',
      icon: <SafetyCertificateOutlined />,
      ready: !isOutOfStock && !isLowStock,
      title: isOutOfStock
        ? t('pages.productDetail.decisionStockOutTitle')
        : isLowStock
          ? t('pages.productDetail.decisionStockLowTitle')
          : t('pages.productDetail.decisionStockReadyTitle'),
      text: isOutOfStock
        ? t('pages.productDetail.decisionStockOutText')
        : isLowStock
          ? t('pages.productDetail.decisionStockLowText', { count: lowStockCount, stock: stockLabel })
          : t('pages.productDetail.decisionStockReadyText', { stock: stockLabel }),
    },
    {
      key: 'delivery',
      icon: <TruckOutlined />,
      ready: Boolean(deliveryPromise.enabled),
      title: t('pages.productDetail.trustShippingTitle'),
      text: deliveryPromise.enabled
        ? t('pages.productDetail.deliveryPromise', { window: deliveryPromise.windowText })
        : productShippingText,
    },
    {
      key: 'value',
      icon: <ThunderboltOutlined />,
      ready: true,
      title: purchaseSavings > 0 ? t('pages.productDetail.purchaseSavings') : t('pages.productDetail.purchaseSubtotal'),
      text: purchaseSavings > 0 ? formatMoney(purchaseSavings) : formatMoney(purchaseSubtotal),
    },
  ];
  const productFaqItems = [
    {
      question: t('pages.productDetail.faqQuietQuestion'),
      answer: t('pages.productDetail.faqQuietAnswer'),
    },
    {
      question: t('pages.productDetail.faqFilterQuestion'),
      answer: t('pages.productDetail.faqFilterAnswer'),
    },
    {
      question: t('pages.productDetail.faqReplaceQuestion'),
      answer: t('pages.productDetail.faqReplaceAnswer'),
    },
  ];

  const selectGalleryImage = (image: string, index: number) => {
    setSelectedImage(image);
    setActiveMobileImageIndex(index);
    const gallery = mobileGalleryRef.current;
    if (gallery) {
      gallery.scrollTo({ left: index * gallery.clientWidth, behavior: 'smooth' });
    }
  };

  const getActiveGalleryImageIndex = () => {
    const selectedIndex = galleryImages.findIndex((image) => image === selectedImage);
    if (selectedIndex >= 0) return selectedIndex;
    return Math.min(Math.max(activeMobileImageIndex, 0), Math.max(galleryImages.length - 1, 0));
  };

  const selectAdjacentGalleryImage = (direction: -1 | 1, fromIndex = getActiveGalleryImageIndex()) => {
    if (galleryImages.length <= 1) return;
    const nextIndex = (fromIndex + direction + galleryImages.length) % galleryImages.length;
    const nextImage = galleryImages[nextIndex];
    if (!nextImage) return;
    selectGalleryImage(nextImage, nextIndex);
    pauseImageRotation();
    scheduleImageRotationResume(5000);
  };

  const handleGalleryKeyDown = (event: React.KeyboardEvent<HTMLElement>, fromIndex?: number) => {
    if (galleryImages.length <= 1) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      selectAdjacentGalleryImage(-1, fromIndex);
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      selectAdjacentGalleryImage(1, fromIndex);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      selectGalleryImage(galleryImages[0], 0);
      pauseImageRotation();
      scheduleImageRotationResume(5000);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      const lastIndex = galleryImages.length - 1;
      selectGalleryImage(galleryImages[lastIndex], lastIndex);
      pauseImageRotation();
      scheduleImageRotationResume(5000);
    }
  };

  const handleMobileGalleryScroll = () => {
    if (galleryScrollRafRef.current !== null) return;
    galleryScrollRafRef.current = window.requestAnimationFrame(() => {
      galleryScrollRafRef.current = null;
      const gallery = mobileGalleryRef.current;
      if (!gallery || galleryImages.length <= 1) return;
      const index = Math.round(gallery.scrollLeft / gallery.clientWidth);
      const safeIndex = Math.min(Math.max(index, 0), galleryImages.length - 1);
      const image = galleryImages[safeIndex];
      setActiveMobileImageIndex(safeIndex);
      if (image) {
        setSelectedImage((currentImage) => (image === currentImage ? currentImage : image));
      }
    });
  };

  return (
    <div className={`product-detail-page product-detail-page--${language}`}>
      <div className="product-detail-shell">
        <Breadcrumb
          className="product-detail-breadcrumb"
          items={[
            {
              title: (
                <button
                  type="button"
                  className="product-detail-breadcrumb__link"
                  aria-label={t('nav.ariaHome')}
                  title={t('nav.ariaHome')}
                  onClick={() => navigate('/')}
                >
                  <HomeOutlined />
                </button>
              ),
            },
            {
              title: (
                <button type="button" className="product-detail-breadcrumb__link" onClick={() => navigate('/products')}>
                  {t('pages.productDetail.product')}
                </button>
              ),
            },
            { title: productName },
          ]}
        />

        <Row gutter={24}>
          {/* Product media gallery */}
          <Col span={12}>
            <Card className="product-gallery-card">
              <div
                className="product-detail-main-image"
                role="region"
                aria-roledescription="carousel"
                aria-label={galleryRegionLabel}
                tabIndex={0}
                onMouseEnter={pauseImageRotation}
                onMouseLeave={resumeImageRotation}
                onKeyDown={handleGalleryKeyDown}
              >
                <div
                  ref={mobileGalleryRef}
                  className="product-mobile-gallery"
                  onScroll={handleMobileGalleryScroll}
                  onPointerDown={pauseImageRotation}
                  onPointerUp={() => scheduleImageRotationResume()}
                  onPointerCancel={() => scheduleImageRotationResume()}
                  onTouchStart={handleGalleryTouchStart}
                  onTouchEnd={resetGalleryPinch}
                  onTouchCancel={resetGalleryPinch}
                >
                  {galleryImages.map((image: string, index: number) => (
                    <div
                      key={`${image}-${index}`}
                      className="product-mobile-gallery__slide"
                      role="group"
                      aria-roledescription="slide"
                      aria-label={getGalleryImageLabel(index)}
                      aria-hidden={index === activeMobileImageIndex ? undefined : true}
                    >
                      <img
                        src={getOptimizedImageUrl(image, index === 0 ? 720 : 540)}
                        srcSet={buildResponsiveImageSrcSet(image, [360, 540, 720, 900])}
                        sizes="100vw"
                        alt={getGalleryImageLabel(index)}
                        className="product-mobile-gallery__img"
                        width={900}
                        height={900}
                        loading={index === 0 ? 'eager' : 'lazy'}
                        decoding="async"
                        {...(index === 0 ? eagerImagePriorityProps : lazyImagePriorityProps)}
                        style={pinchZoom.active && index === activeMobileImageIndex ? {
                          transform: `scale(${pinchZoom.scale})`,
                          transformOrigin: `${pinchZoom.originX}% ${pinchZoom.originY}%`,
                          transition: 'none',
                        } : undefined}
                        onError={(event) => {
                          applyImageFallback(event, productImages[productImages.length - 1]);
                        }}
                      />
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="product-detail-main-image__button"
                  aria-label={mainImagePreviewActionLabel}
                  title={mainImagePreviewActionLabel}
                  onClick={() => setIsModalVisible(true)}
                >
                  <img
                    src={heroImage}
                    srcSet={heroImageSrcSet}
                    sizes={heroImageSizes}
                    alt={productName}
                    className="product-detail-main-image__img"
                    width={900}
                    height={900}
                    loading="eager"
                    decoding="async"
                    {...eagerImagePriorityProps}
                    onMouseMove={handleGalleryZoomMove}
                    onMouseLeave={handleGalleryZoomLeave}
                    onError={(event) => {
                      const fallback = productImages[productImages.length - 1];
                      applyImageFallback(event, fallback);
                      setSelectedImage(fallback);
                    }}
                  />
                </button>
                {discountPercent > 0 && (
                  <Tag color="gold" className="product-gallery-discount">
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
                    {galleryImages.map((image: string, index: number) => {
                      const thumbLabel = getGalleryImageLabel(index);
                      const selectThumb = () => {
                        selectGalleryImage(image, index);
                        pauseImageRotation();
                        scheduleImageRotationResume(5000);
                      };
                      return (
                        <div key={index} className="product-detail-thumbs__slide">
                          <button
                            type="button"
                            className={`product-detail-thumbs__button${selectedImage === image ? ' product-detail-thumbs__button--active' : ''}`}
                            aria-pressed={selectedImage === image}
                            aria-label={thumbLabel}
                            title={thumbLabel}
                            onClick={selectThumb}
                            onKeyDown={(event) => handleGalleryKeyDown(event, index)}
                          >
                            <img
                              src={getOptimizedImageUrl(image, 144)}
                              srcSet={buildResponsiveImageSrcSet(image, [96, 144, 192, 288])}
                              sizes="120px"
                              alt=""
                              className="product-detail-thumbs__img"
                              width={160}
                              height={160}
                              loading="lazy"
                              decoding="async"
                              onError={(event) => {
                                applyImageFallback(event, productImages[productImages.length - 1]);
                              }}
                            />
                          </button>
                        </div>
                      );
                    })}
                  </Carousel>
                </div>
              )}
              {galleryImages.length > 1 && (
                <div className="product-mobile-thumbs" aria-label={`${t('pages.productDetail.product')} ${t('common.image')}`}>
                  {galleryImages.map((image: string, index: number) => (
                    <button
                      key={`mobile-thumb-${image}-${index}`}
                      type="button"
                      className={`product-mobile-thumbs__button${activeMobileImageIndex === index ? ' product-mobile-thumbs__button--active' : ''}`}
                      aria-pressed={activeMobileImageIndex === index}
                      aria-label={getGalleryImageLabel(index)}
                      title={getGalleryImageLabel(index)}
                      onClick={() => selectGalleryImage(image, index)}
                    >
                      <img
                        src={getOptimizedImageUrl(image, 96)}
                        srcSet={buildResponsiveImageSrcSet(image, [96, 144, 192, 288])}
                        sizes="56px"
                        alt={getGalleryImageLabel(index)}
                        className="product-mobile-thumbs__img"
                        width={96}
                        height={96}
                        loading="lazy"
                        decoding="async"
                        onError={(event) => {
                          applyImageFallback(event, productImages[productImages.length - 1]);
                        }}
                      />
                    </button>
                  ))}
                </div>
              )}
            </Card>
          </Col>

          {/* Product purchase summary */}
          <Col span={12}>
            <Card className="product-summary-card">
              <Space direction="vertical" size="large" className="product-summary-space">
                <div className="product-title-block">
                  <Title level={2}>{productName}</Title>
                  {product.brand && (
                    <Text type="secondary" className="product-brand-text">{t('pages.productDetail.brand')}: {product.brand}</Text>
                  )}
                </div>

                <div className="product-price-panel">
                  <div className="product-rating-row">
                    <Rate disabled allowHalf value={displayedRating} />
                    <Text>{displayedRating.toFixed(1)} {t('pages.productDetail.rating')}</Text>
                  </div>
                  <div className="product-price-line">
                    <span className="product-price-line__current commerce-money">{formatMoney(displayPrice)}</span>
                    {originalReferencePrice ? (
                      <Text delete className="product-price-line__original commerce-money">
                        {formatMoney(originalReferencePrice)}
                      </Text>
                    ) : null}
                    {priceSavingsPercent > 0 && (
                      <Tag color="gold" className="product-price-line__discount">
                        {t('pages.productDetail.savePercent', { defaultValue: 'Save {percent}%', percent: priceSavingsPercent })}
                      </Tag>
                    )}
                  </div>
                  <div className="product-price-delivery">
                    <span><TruckOutlined /> {deliveryPromise.enabled ? t('pages.productDetail.deliveryPromise', { window: deliveryPromise.windowText }) : productShippingText}</span>
                    <span><CheckCircleOutlined /> {productFreeShippingText}</span>
                  </div>
                  <div
                    className="product-mobile-promo"
                    role={limitedTimePromoActive ? 'status' : undefined}
                    aria-live={limitedTimePromoActive ? 'polite' : undefined}
                    aria-atomic={limitedTimePromoActive ? 'true' : undefined}
                  >
                    <span>{limitedTimePromoActive ? t('pages.productDetail.limitedTimeCountdown') : productFreeShippingText}</span>
                    <strong>{limitedTimePromoActive ? formatCountdown(limitedTimeRemaining) : t('pages.productDetail.authentic')}</strong>
                  </div>

	                  <div className="product-compact-signals">
	                    <span className={isLowStock ? 'product-detail__stockMeta product-detail__stockMeta--low' : 'product-detail__stockMeta'}>
                      {t('pages.productDetail.stock')}: {stockLabel}
                      {isLowStock ? <Tag color="orange">{lowStockUrgencyLabel}</Tag> : null}
                    </span>
	                    {priceSavingsAmount > 0 ? <span>{t('pages.productDetail.purchaseSavings')}: <span className="commerce-money">{formatMoney(priceSavingsAmount * quantity)}</span></span> : null}
	                  </div>
	                </div>

                <div className="product-mobile-buybar">
                  <div className="product-mobile-buybar__meta" title={`${mobileBuybarPrice} - ${mobileBuybarStatus}`}>
                    <strong>{mobileBuybarPrice}</strong>
                    <span className={`product-mobile-buybar__status${purchaseSelectionBlocked || isOutOfStock ? ' product-mobile-buybar__status--attention' : ''}`}>
                      {purchaseSelectionBlocked || isOutOfStock ? <BellOutlined /> : <CheckCircleOutlined />}
                      {mobileBuybarStatus}
                    </span>
                  </div>
                  <button type="button" className="product-mobile-buybar__tool product-mobile-buybar__tool--home" aria-label={homeActionLabel} title={homeActionLabel} onClick={() => navigate('/')}>
                    <HomeOutlined />
                    <span>{t('nav.ariaHome')}</span>
                  </button>
                  <button type="button" className="product-mobile-buybar__tool product-mobile-buybar__tool--favorite" aria-label={favoriteActionLabel} title={favoriteActionLabel} onClick={handleFavorite}>
                    {isWishlisted ? <HeartFilled /> : <HeartOutlined />}
                    <span>{isWishlisted ? t('pages.productDetail.favorited') : t('pages.productDetail.favorite')}</span>
                  </button>
                  <button type="button" className="product-mobile-buybar__tool product-mobile-buybar__tool--compare" aria-label={compareActionLabel} title={compareActionLabel} onClick={handleCompare}>
                    <BarChartOutlined />
                    <span>{isCompared ? t('pages.productList.viewCompare') : t('pages.productList.compare')}</span>
                  </button>
                  <Button
                    className="product-mobile-buybar__cart"
                    icon={isOutOfStock ? <BellOutlined /> : <ShoppingCartOutlined />}
                    aria-label={isOutOfStock ? stockAlertActionLabel : mobileCartBlockedReason}
                    title={isOutOfStock ? stockAlertActionLabel : mobileCartBlockedReason}
                    onClick={isOutOfStock ? handleStockAlert : handleAddToCart}
                    loading={purchaseSubmitting === 'cart'}
                    disabled={mobileAddToCartBlocked}
                  >
                    {isOutOfStock ? (isAlerted ? t('pages.stockAlerts.remove') : t('pages.stockAlerts.notifyMe')) : t('pages.productDetail.addCart')}
                  </Button>
                  <Button className="product-mobile-buybar__buy" type="primary" icon={<ThunderboltOutlined />} aria-label={buyNowBlockedReason} title={buyNowBlockedReason} onClick={handleBuyNow} loading={purchaseSubmitting === 'buy'} disabled={buyNowBlocked}>
                    {t('pages.productDetail.buyNow')}
                  </Button>
                </div>

	                <div className="product-purchase-readiness" role="list" aria-label={t('pages.productDetail.decisionTitle')}>
	                  {purchaseReadinessItems.map((item) => (
                    <div
                      key={item.key}
                      role="listitem"
                      className={`product-purchase-readiness__item${item.ready ? ' product-purchase-readiness__item--ready' : ' product-purchase-readiness__item--pending'}`}
                    >
                      <span className="product-purchase-readiness__icon">{item.icon}</span>
                      <span className="product-purchase-readiness__copy">
                        <Text strong>{item.title}</Text>
                        <Text type="secondary">{item.text}</Text>
                      </span>
                    </div>
                  ))}
                </div>

                <div
                  ref={optionsSectionRef}
                  className={purchaseSelectionBlocked ? 'product-options-anchor product-options-anchor--attention' : 'product-options-anchor'}
                >
                  {optionGroups.map((group) => {
                    const optionGroupLabel = `${getLocalizedOptionLabel(group.name, language)}: ${productName}`;
                    return (
                      <div key={group.name} role="group" aria-label={optionGroupLabel} title={optionGroupLabel}>
                        <div className="product-option-header">
                          <Text strong>{getLocalizedOptionLabel(group.name, language)}</Text>
                          {isSizeOptionName(group.name) ? (
                            <Button
                              size="small"
                              type="link"
                              aria-label={sizeGuideActionLabel}
                              title={sizeGuideActionLabel}
                              onClick={() => setSizeGuideOpen(true)}
                            >
                              {t('pages.productDetail.sizeGuide')}
                            </Button>
                          ) : null}
                        </div>
                        <Radio.Group
                          value={selectedOptions[group.name]}
                          onChange={e => selectOptionValue(group.name, e.target.value)}
                          className="product-option-radio"
                          aria-label={optionGroupLabel}
                        >
                          {group.values.map((value) => {
                            const disabled = !optionValueIsCompatible(variants, selectedOptions, group.name, value);
                            const selected = selectedOptions[group.name] === value;
                            return (
                              <Radio.Button key={value} value={value} disabled={disabled}>
                                {selected ? <CheckCircleOutlined className="product-option-radio__check" /> : null}
                                <span>{getLocalizedOptionLabel(value, language)}</span>
                              </Radio.Button>
                            );
                          })}
                        </Radio.Group>
                      </div>
                    );
                  })}
                </div>

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
                          <Button
                            size="small"
                            type="link"
                            aria-label={resetSelectedOptionsActionLabel}
                            title={resetSelectedOptionsActionLabel}
                            onClick={() => setSelectedOptions({})}
                          >
                            {t('pages.productList.resetFilters')}
                          </Button>
                        ) : null}
                      </Space>
                    </div>
                    <Space wrap size={[6, 6]}>
                      {selectedOptionTags.length > 0 ? selectedOptionTags.map((item) => (
                        <Tag key={item.name}>{item.label}: {item.valueLabel}</Tag>
                      )) : (
                        <Tag>{t('pages.productDetail.selectedOptionsEmpty')}</Tag>
                      )}
                      {selectedVariant?.sku ? <Tag>{t('pages.productDetail.selectedVariantSku', { sku: selectedVariant.sku })}</Tag> : null}
                      {hasCompleteOptions && !hasUnavailableSelectedVariant ? (
                        <Tag color="green">{renderProductDetailAmountText(t('pages.productDetail.selectedVariantPrice', { price: formatMoney(displayPrice) }), formatMoney(displayPrice))}</Tag>
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
                      <Button
                        size="small"
                        type="link"
                        aria-label={sizeGuideActionLabel}
                        title={sizeGuideActionLabel}
                        onClick={() => setSizeGuideOpen(true)}
                      >
                        {t('pages.productDetail.sizeGuide')}
                      </Button>
                    </div>
                    <div className="product-size-calculator__inputs">
                      <Input
                        value={sizeCalculatorBreed}
                        onChange={(event) => setSizeCalculatorBreed(event.target.value)}
                        placeholder={t('pages.productDetail.sizeCalculatorBreed')}
                        aria-label={sizeBreedInputLabel}
                        title={sizeBreedInputLabel}
                      />
                      <Input
                        value={sizeCalculatorWeight}
                        type="number"
                        min={0}
                        max={PRODUCT_SIZE_CALCULATOR_MAX_WEIGHT_KG}
                        onChange={(event) => setSizeCalculatorWeight(normalizeSizeCalculatorWeight(event.target.value))}
                        placeholder={t('pages.productDetail.sizeCalculatorWeight')}
                        aria-label={sizeWeightInputLabel}
                        title={sizeWeightInputLabel}
                      />
                    </div>
                    {recommendedSize ? (
                      <Alert
                        type={recommendedSizeValue ? 'success' : 'info'}
                        showIcon
                        message={t('pages.productDetail.sizeCalculatorResult', { size: recommendedSizeLabel })}
                        description={recommendedSizeValue
                          ? t('pages.productDetail.sizeCalculatorMatch')
                          : t('pages.productDetail.sizeCalculatorNoMatch')}
                        action={recommendedSizeValue ? (
                          <Button
                            size="small"
                            type="primary"
                            aria-label={`${t('pages.productDetail.sizeCalculatorApply')}: ${recommendedSizeLabel}, ${productName}`}
                            title={`${t('pages.productDetail.sizeCalculatorApply')}: ${recommendedSizeLabel}, ${productName}`}
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

                {bundleInfo ? (
                <div className="product-value-callout">
                  <span className="product-value-callout__icon"><ThunderboltOutlined /></span>
                  <div className="product-value-callout__copy">
                    <Text strong>{recommendedPathTitle}</Text>
                    <Text type="secondary">{recommendedPathText}</Text>
                  </div>
                  {purchaseMode !== recommendedPurchaseMode ? (
                    <Button
                      size="small"
                      type="primary"
                      aria-label={useRecommendedPathActionLabel}
                      title={useRecommendedPathActionLabel}
                      onClick={() => setPurchaseMode(recommendedPurchaseMode)}
                    >
                      {t('pages.productDetail.useRecommendedPath')}
                    </Button>
                  ) : (
                    <Tag color="green">{t('pages.productDetail.decisionReady')}</Tag>
                  )}
                </div>
                ) : null}

                {bundleInfo ? (
                  <div className="product-purchase-mode">
                    <Segmented
                      block
                      value={purchaseMode}
                      onChange={(value) => setPurchaseMode(value as 'once' | 'bundle')}
                      aria-label={purchaseModeActionLabel}
                      title={purchaseModeActionLabel}
                      options={[
                        { label: t('pages.productDetail.oneTimePurchase'), value: 'once' },
                        { label: t('bundle.bundleDeal'), value: 'bundle' },
                      ]}
                    />
                    {purchaseMode === 'bundle' ? (
                      <div className="product-purchase-mode__details">
                        <div className="product-purchase-mode__summary">
                          <Text strong>{t('bundle.includes')}</Text>
                          <Space wrap size={[6, 6]}>
                            {bundleInfo.items.map((item) => (
                              <Tag key={item.name} className="commerce-atomic">{item.name} <span className="commerce-quantity">x{item.quantity || 1}</span></Tag>
                            ))}
                          </Space>
                          <Text type="secondary">
                            {bundleSavings > 0
                              ? t('bundle.saveWithBundle', { amount: formatMoney(bundleSavings) })
                              : t('bundle.bundleHint')}
                          </Text>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div>
                  <Text strong className="product-quantity-label">{t('pages.productDetail.quantity')}</Text>
                  <div className="product-quantity-row" role="group" aria-label={t('pages.productDetail.quantity')}>
                    <Button
                      icon={<MinusOutlined />}
                      aria-label={decreaseQuantityLabel}
                      title={decreaseQuantityLabel}
                      onClick={() => handleQuantityChange(quantity - 1)}
                      disabled={quantity <= 1}
                    />
                    <span className="product-quantity__value" role="status" aria-live="polite" aria-label={quantityValueLabel}>
                      {quantity}
                    </span>
                    <Button
                      icon={<PlusOutlined />}
                      aria-label={increaseQuantityLabel}
                      title={increaseQuantityLabel}
                      onClick={() => handleQuantityChange(quantity + 1)}
                      disabled={selectedStock !== undefined && quantity >= selectedStock}
                    />
                  </div>
                </div>

                <div className="product-purchase-summary">
                  {bundleInfo ? (
                    <div className="product-purchase-summary__line">
                      <Text type="secondary">{t('pages.productDetail.purchaseMode')}</Text>
                      <Text strong>{purchaseModeLabel}</Text>
                    </div>
                  ) : null}
                  <div className="product-purchase-summary__line">
                    <Text type="secondary">{t('pages.productDetail.unitPrice')}</Text>
                      <Text className="commerce-money">{formatMoney(displayPrice)}</Text>
                  </div>
                  <div className="product-purchase-summary__line">
                    <Text type="secondary">{t('pages.productDetail.purchaseQuantity')}</Text>
                      <Text className="commerce-quantity">{quantity}</Text>
                  </div>
                  {purchaseSavings > 0 ? (
                    <div className="product-purchase-summary__line product-purchase-summary__line--saving">
                      <Text>{t('pages.productDetail.purchaseSavings')}</Text>
                      <Text strong className="commerce-money">{formatMoney(purchaseSavings)}</Text>
                    </div>
                  ) : null}
                  <div className="product-purchase-summary__total">
                    <Text strong>{t('pages.productDetail.purchaseSubtotal')}</Text>
                    <Text strong className="commerce-money">{formatMoney(purchaseSubtotal)}</Text>
                  </div>
                </div>

                {completeSetItems.length > 0 ? (
                  <div className="product-complete-set">
                    <div className="product-complete-set__header">
                      <Text strong>{t('pages.productDetail.completeSetTitle')}</Text>
                      <Text type="secondary">{t('pages.productDetail.completeSetText')}</Text>
                    </div>
                    <div className="product-complete-set__items">
                      {completeSetItems.map((item) => {
                        const itemName = detailProductName(item);
                        const needsOptions = needsOptionSelection(item);
                        const addSetActionLabel = `${needsOptions ? t('pages.wishlist.selectOptions') : t('pages.productDetail.completeSetAdd')}: ${itemName}`;
                        return (
                          <div
                            key={item.id}
                            role="button"
                            tabIndex={0}
                            className="product-complete-set__item"
                            onClick={() => navigate(`/products/${item.id}`)}
                            onKeyDown={(event) => {
                              if (event.target !== event.currentTarget) {
                                return;
                              }
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                navigate(`/products/${item.id}`);
                              }
                            }}
                          >
                            <img
                              src={getOptimizedImageUrl(resolveProductPrimaryImage(item), 144)}
                              srcSet={buildResponsiveImageSrcSet(resolveProductPrimaryImage(item), [96, 144, 192, 288])}
                              sizes="48px"
                              alt={itemName}
                              width={96}
                              height={96}
                              loading="lazy"
                              decoding="async"
                              onError={(event) => {
                                applyImageFallback(event, fallbackProductImage);
                              }}
                            />
                            <span className="product-complete-set__copy">
                              <strong>{itemName}</strong>
                              <span className="commerce-money">{formatMoney(item.effectivePrice ?? item.price)}</span>
                            </span>
                            <Button
                              size="small"
                              type={needsOptions ? 'default' : 'primary'}
                              icon={<ShoppingCartOutlined />}
                              loading={recommendationAddingId === item.id}
                              aria-label={addSetActionLabel}
                              title={addSetActionLabel}
                              onClick={(event) => handleAddRecommendationToCart(event, item)}
                              onKeyDown={(event) => event.stopPropagation()}
                            >
                              {needsOptions ? t('pages.wishlist.selectOptions') : t('pages.productDetail.completeSetAdd')}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {shouldShowDecisionChecklist ? (
                  <details className="product-detail-disclosure">
                    <summary>
                      <span>{t('pages.productDetail.decisionTitle')}</span>
                      <Tag color="orange">{t('pages.productDetail.decisionNeedsReview')}</Tag>
                    </summary>
                    <div className="product-conversion-nudges">
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
                ) : null}

                {isLowStock ? (
                  <Alert
                    className="product-detail__lowStockAlert"
                    type="warning"
                    showIcon
                    message={lowStockUrgencyLabel}
                    description={t('pages.productDetail.lowStockUrgencyText', { count: lowStockCount })}
                  />
                ) : null}
                {isOutOfStock && (
                  <Space wrap>
                    <Tag color="red" style={{ fontSize: 16, padding: '4px 12px' }}>{t('pages.productDetail.soldOut')}</Tag>
                    <Button icon={<BellOutlined />} aria-label={stockAlertActionLabel} title={stockAlertActionLabel} onClick={handleStockAlert}>
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
                    aria-label={isOutOfStock ? `${t('pages.productDetail.soldOut')}: ${productName}` : addToCartActionLabel}
                    title={isOutOfStock ? `${t('pages.productDetail.soldOut')}: ${productName}` : addToCartActionLabel}
                    onClick={handleAddToCart}
                    loading={purchaseSubmitting === 'cart'}
                    disabled={addToCartBlocked}
                  >
                    {isOutOfStock ? t('pages.productDetail.soldOut') : t('pages.productDetail.addCart')}
                  </Button>
                  <Button
                    type="primary"
                    size="large"
                    icon={<ThunderboltOutlined />}
                    className={isOutOfStock ? 'product-detail__soldoutButton' : undefined}
                    aria-label={buyNowBlockedReason}
                    title={buyNowBlockedReason}
                    onClick={handleBuyNow}
                    loading={purchaseSubmitting === 'buy'}
                    disabled={buyNowBlocked}
                    ghost
                  >
                    {t('pages.productDetail.buyNow')}
                  </Button>
                  {isOutOfStock ? (
                    <Button size="large" icon={<BellOutlined />} aria-label={stockAlertActionLabel} title={stockAlertActionLabel} onClick={handleStockAlert}>
                      {isAlerted ? t('pages.stockAlerts.remove') : t('pages.stockAlerts.notifyMe')}
                    </Button>
                  ) : null}
                  <Button size="large" icon={isWishlisted ? <HeartFilled style={{ color: '#ee4d2d' }} /> : <HeartOutlined />} aria-label={favoriteActionLabel} title={favoriteActionLabel} onClick={handleFavorite}>
                    {isWishlisted ? t('pages.productDetail.favorited') : t('pages.productDetail.favorite')}
                  </Button>
                  <Button size="large" icon={<BarChartOutlined />} aria-label={compareActionLabel} title={compareActionLabel} onClick={handleCompare}>
                    {isCompared ? t('pages.productList.viewCompare') : t('pages.productList.compare')}
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

        {/* Product details and specifications */}
        <div ref={detailContentRef} className="product-detail-content-anchor" />
        <Card className="product-tabs-card" id="product-service-tabs">
          <Tabs
            className="product-detail-tabs"
            defaultActiveKey="1"
            tabBarGutter={10}
            more={{
              icon: (
                <span className="product-detail-tabs__moreIcon">
                  <EllipsisOutlined aria-hidden="true" />
                  <span className="product-detail-tabs__srText">
                    {t('pages.productDetail.moreTabs', { defaultValue: `${t('common.more')}: ${t('pages.productDetail.service')}` })}
                  </span>
                </span>
              ),
            }}
            items={[
              {
                key: '1',
                label: t('pages.productDetail.details'),
                children: (
                  <div className="product-tab-content">
                    <Suspense fallback={<ProductDetailLazyFallback label={t('common.loading')} variant="rich" />}>
                      <ProductRichDetail
                        detailContent={product.detailContent}
                        fallback={product.description}
                        emptyText={t('pages.productDetail.noDetails')}
                        labels={{
                          imageAlt: t('pages.productDetail.richImageAlt'),
                          videoTitle: (index) => t('pages.productDetail.richVideoTitle', { index }),
                          openVideo: t('pages.productDetail.openRichVideo'),
                          unsupported: t('pages.productDetail.unsupportedRichContent'),
                        }}
                      />
                    </Suspense>
                  </div>
                ),
              },
              {
                key: '2',
                label: t('pages.productDetail.specs'),
                children: (
                  <div className="product-tab-content">
                    {product.specifications && Object.entries(product.specifications)
                      .filter(([key]) => !key.startsWith('options.') && !key.startsWith('i18n.') && !key.startsWith('bundle.'))
                      .map(([key, value]) => (
                        <div key={key} className="product-spec-row">
                          <Text strong>{formatProductSpecLabel(key, t)}: </Text>
                          <Text>{value as string}</Text>
                        </div>
                      ))}
                  </div>
                ),
              },
              {
                key: '3',
                label: t('pages.productDetail.service'),
                children: (
                  <div className="product-tab-content">
                    <div className="product-warranty-row">
                      <Text strong>{t('pages.productDetail.warranty')}</Text>
                      <Text>{product.warranty || t('pages.productDetail.defaultWarranty')}</Text>
                    </div>
                    <div>
                      <Text strong>{t('pages.productDetail.shipping')}</Text>
                      <Text>{productShippingText}</Text>
                    </div>
                  </div>
                ),
              },
            ]}
          />
        </Card>

        {/* Product reviews */}
        <Card className="product-review-card" id="product-reviews-card">
          <Suspense fallback={<ProductDetailLazyFallback label={t('common.loading')} variant="review" />}>
            <ProductReview
              productId={Number(id)}
              reviews={reviews}
              reviewableOrders={reviewableOrders}
              onAddReview={handleAddReview}
            />
          </Suspense>
        </Card>

        <Card className="product-qa-card" id="product-qa-card">
          <Title level={4} style={{ marginBottom: 16 }}>{t('pages.ask.title')}</Title>
          <Space direction="vertical" className="product-qa-space">
            <Input.TextArea
              rows={3}
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder={t('pages.ask.placeholder')}
              maxLength={PRODUCT_QUESTION_MAX_LENGTH}
              showCount
              aria-label={questionInputLabel}
              title={questionInputLabel}
            />
            <Button type="primary" aria-label={questionSubmitActionLabel} title={questionSubmitActionLabel} onClick={handleAskQuestion} loading={questionSubmitting}>
              {t('pages.ask.submit')}
            </Button>
          </Space>
          {pendingQuestions.length > 0 ? (
            <div className="product-qa-pending" role="status" aria-live="polite" aria-label={t('pages.ask.pendingTitle')}>
              <Alert
                type="success"
                showIcon
                message={t('pages.ask.pendingTitle')}
                description={t('pages.ask.pendingDescription')}
              />
              <List
                className="product-qa-pending-list"
                dataSource={pendingQuestions}
                renderItem={(pendingQuestion) => (
                  <List.Item key={pendingQuestion.id}>
                    <div className="product-question-item product-question-item--pending">
                      <div className="product-question-text">{pendingQuestion.question}</div>
                      <div className="product-question-meta">
                        {new Date(pendingQuestion.createdAt).toLocaleString(language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US')}
                      </div>
                      <div className="product-answer-box product-answer-box--pending">
                        <Text strong>{t('pages.ask.answerLabel')}: </Text>
                        <Text>{t('pages.ask.pendingAnswer')}</Text>
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            </div>
          ) : null}
          {questions.length === 0 ? (
            <div className="product-qa-faq" aria-label={t('pages.ask.empty')}>
              <Text strong>{t('pages.productDetail.faqTitle', { defaultValue: 'Frequently asked questions' })}</Text>
              <div className="product-qa-faq__list">
                {productFaqItems.map((item) => (
                  <div key={item.question} className="product-qa-faq__item">
                    <strong>{item.question}</strong>
                    <span>{item.answer}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <List
              dataSource={questions}
              renderItem={(q) => (
                <List.Item key={q.id}>
                  <div className="product-question-item">
                    <div className="product-question-text">{q.question}</div>
                    <div className="product-question-meta">
                      {new Date(q.createdAt).toLocaleString(language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US')}
                    </div>
                    <div className="product-answer-box">
                      <Text strong>{t('pages.ask.answerLabel')}: </Text>
                      <Text>{q.answer}</Text>
                    </div>
                  </div>
                </List.Item>
              )}
            />
          )}
        </Card>

        {/* Related recommendations */}
        {relatedRecommendations.length > 0 && (
          <div className="product-recommendations" ref={recommendationCarouselRef}>
            <Title level={3}>{t('pages.productDetail.boughtTogether', { defaultValue: t('pages.productDetail.recommendations') })}</Title>
            <Carousel
              slidesToShow={4}
              dots={false}
              arrows
              afterChange={syncRecommendationCarouselFocus}
              responsive={[
                { breakpoint: 1024, settings: { slidesToShow: 3 } },
                { breakpoint: 768, settings: { slidesToShow: 2 } },
                { breakpoint: 520, settings: { slidesToShow: 1 } },
              ]}
            >
              {relatedRecommendations.map((rec) => {
                const recName = detailProductName(rec);
                const needsOptions = needsOptionSelection(rec);
                const isRecommendationSoldOut = isRecommendationUnavailable(rec);
                const recommendationReviewCount = Number(rec.reviewCount || 0);
                const recommendationActionLabel = `${isRecommendationSoldOut
                  ? t('pages.productDetail.soldOut')
                  : needsOptions
                    ? t('pages.wishlist.selectOptions')
                    : t('pages.productDetail.addCart')}: ${recName}`;
                const recommendationViewLabel = `${t('pages.productList.viewDetails')}: ${recName}`;
                return (
                  <div key={rec.id} className="product-recommendations__slide">
                    <Card
                      hoverable
                      cover={
                        <button
                          type="button"
                          className="product-recommendations__imageButton"
                          aria-label={recommendationViewLabel}
                          title={recommendationViewLabel}
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate(`/products/${rec.id}`);
                          }}
                        >
                          <img
                            alt={recName}
                            src={getOptimizedImageUrl(resolveProductPrimaryImage(rec), 520)}
                            srcSet={buildResponsiveImageSrcSet(resolveProductPrimaryImage(rec), [240, 360, 520, 720])}
                            sizes="(max-width: 520px) 90vw, (max-width: 768px) 45vw, 260px"
                            className="product-recommendations__image"
                            width={520}
                            height={360}
                            loading="lazy"
                            decoding="async"
                            onError={(event) => {
                              applyImageFallback(event, fallbackProductImage);
                            }}
                          />
                        </button>
                      }
                      className="product-recommendations__card"
                      role="button"
                      tabIndex={0}
                      aria-label={recommendationViewLabel}
                      title={recommendationViewLabel}
                      onClick={() => navigate(`/products/${rec.id}`)}
                      onKeyDown={(event) => {
                        if (event.target !== event.currentTarget) return;
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          navigate(`/products/${rec.id}`);
                        }
                      }}
                    >
                      <div className="product-recommendations__content">
                        <Text strong className="product-recommendations__name">{recName}</Text>
                        <div className="product-recommendations__meta">
                          <span className="product-recommendations__price commerce-money">{formatMoney(rec.effectivePrice ?? rec.price)}</span>
                          {recommendationReviewCount > 0 && (
                            <span className="product-recommendations__proof">
                              {recommendationReviewCount} {t('adminLayout.reviews')}
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
                          aria-label={recommendationActionLabel}
                          title={recommendationActionLabel}
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

	      {/* Image preview modal */}
      <Modal
        open={isModalVisible}
        footer={null}
        onCancel={() => setIsModalVisible(false)}
        width="min(800px, calc(100vw - 24px))"
        centered
        className="profile-mobile-safe-modal product-detail__imageModal"
      >
        <img
          src={getOptimizedImageUrl(selectedImage, 1200)}
          srcSet={buildResponsiveImageSrcSet(selectedImage, [480, 720, 960, 1200, 1600])}
          sizes="min(800px, calc(100vw - 24px))"
          alt={productName}
          width={1200}
          height={1200}
          decoding="async"
          style={{ width: '100%', height: 'auto' }}
          onError={(event) => {
            applyImageFallback(event, productImages[productImages.length - 1]);
          }}
        />
      </Modal>

      <Modal
        title={t('pages.productDetail.sizeGuideTitle')}
        open={sizeGuideOpen}
        onCancel={() => setSizeGuideOpen(false)}
        footer={<Button type="primary" aria-label={sizeGuideConfirmActionLabel} title={sizeGuideConfirmActionLabel} onClick={() => setSizeGuideOpen(false)}>{t('pages.productDetail.sizeGuideGotIt')}</Button>}
        className="profile-mobile-safe-modal product-detail__sizeGuideModal"
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
