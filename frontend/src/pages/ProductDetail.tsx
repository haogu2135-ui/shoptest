import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { ShopIcon, SI } from '../components/ShopIcon';
import { useParams, useSearchParams } from 'react-router-dom';
import { productApi, wishlistApi } from '../api';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n';
import type { CartItem, ProductPublic as Product, PublicReview, ProductQuestionPublic, ReviewableOrder } from '../types';
import { useMarket } from '../hooks/useMarket';
import { localizeProduct } from '../utils/localizedProduct';
import { getLocalizedOptionLabel, isSizeOptionName } from '../utils/localizedProductOptions';
import { getBundleInfo } from '../utils/bundle';
import { recordProductView } from '../utils/productViewPreferences';
import { hasStockAlert } from '../utils/stockAlerts';
import { conversionConfig, estimatePetSize, getDeliveryPromise, getLowStockCount } from '../utils/conversionConfig';
import { getProductOptionGroups, getProductVariants, needsOptionSelection, selectCompatibleProductOption, variantMatchesSelectedOptions } from '../utils/productOptions';
import { dispatchDomEvent } from '../utils/domEvents';
import { buildResponsiveImageSrcSet, getOptimizedImageUrl } from '../utils/mediaAssets';
import { getLocalStorageItem, hasStoredValue } from '../utils/safeStorage';
import { getLimitedTimeEndMs, getLimitedTimeRemainingMs, shouldRunLimitedTimeTicker } from '../utils/limitedTimeCountdown';
import { getApiErrorMessage, getApiErrorStatus } from '../utils/apiError';
import { buildBreadcrumbStructuredData, buildProductStructuredData } from '../utils/structuredData';
import { isProductCompared } from '../utils/productCompare';
import { addAppScrollListener } from '../utils/nativeScroll';
import { useNativeBackHandler } from '../utils/nativeBack';
import { AUTH_SESSION_CHANGED_EVENT } from '../utils/authEvents';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import PageEmpty from '../components/PageEmpty';
import ShopBreadcrumb from '../components/ShopBreadcrumb';
import PageError from '../components/PageError';
import { usePageTitle } from '../hooks/usePageTitle';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import {
  buildSelectedSpecsPayload,
  clearProductDetailSessionCaches,
  fallbackProductImage,
  findFallbackProductById,
  findSelectedProductVariant,
  normalizeProductImages,
  normalizeProductDetailTab,
  PRODUCT_SIZE_CALCULATOR_MAX_WEIGHT_KG,
  resolveProductPrimaryImage,
  buildCompleteSetItems,
  buildRelatedRecommendations,
} from './productDetailHelpers';
import type {
  PendingProductQuestion,
  ProductDetailTabKey,
  ProductRecommendationCandidate,
} from './productDetailHelpers';
import { ProductDetailSkeleton } from './productDetailShell';
import { ProductDetailRecommendations } from './productDetailRecommendations';
import { ProductDetailGallery, ProductDetailImagePreviewModal } from './productDetailGallery';
import { ProductDetailSummary, ProductDetailSizeGuideModal } from './productDetailSummary';
import { ProductDetailContent } from './productDetailContent';
import { useProductDetailNonCriticalContent } from '../hooks/useProductDetailNonCriticalContent';
import { useProductDetailGallery } from '../hooks/useProductDetailGallery';
import { useProductDetailPurchaseActions } from '../hooks/useProductDetailPurchaseActions';
import { useProductDetailEngagementActions } from '../hooks/useProductDetailEngagementActions';
import { useProductDetailCommunityActions } from '../hooks/useProductDetailCommunityActions';
import { useProductDetailRecommendationActions } from '../hooks/useProductDetailRecommendationActions';
import './ProductDetail.css';
import '../styles/mobile-page-contrast.css';


const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedDetailTab = normalizeProductDetailTab(searchParams.get('tab'));
  const [detailActiveTab, setDetailActiveTab] = useState<ProductDetailTabKey>(requestedDetailTab);
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
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [recommendationsLoadFailed, setRecommendationsLoadFailed] = useState(false);
  const [questions, setQuestions] = useState<ProductQuestionPublic[]>([]);
  const [pendingQuestions, setPendingQuestions] = useState<PendingProductQuestion[]>([]);
  const [questionText, setQuestionText] = useState('');
  const [questionSubmitting, setQuestionSubmitting] = useState(false);
  const [now, setNow] = useState(() => Date.now());
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
  const [isAlerted, setIsAlerted] = useState(false);
  const [isCompared, setIsCompared] = useState(false);
  const [authSessionVersion, setAuthSessionVersion] = useState(0);
  const detailContentRef = useRef<HTMLDivElement | null>(null);
  const optionsSectionRef = useRef<HTMLDivElement | null>(null);
  const { t, language } = useLanguage();
  const productDetailLocalizationRef = useRef({ t, language });
  productDetailLocalizationRef.current = { t, language };
  const {
    fetchQuestions,
    fetchReviewableOrders,
    fetchReviews,
    isCurrentNonCriticalRequest,
    nonCriticalLoadedRef,
    nonCriticalRequestSeqRef,
    warmNonCriticalContent,
  } = useProductDetailNonCriticalContent({
    id,
    language,
    setAverageRating,
    setPendingQuestions,
    setQuestions,
    setRecommendations,
    setRecommendationsLoadFailed,
    setRecommendationsLoading,
    setReviewableOrders,
    setReviews,
  });
  const pageTitle = product?.name?.trim() || (loadError ? t('pages.productDetail.loadFailed') : '');
  usePageTitle(pageTitle || t('pages.productDetail.product'));
  const { currency, market, formatMoney } = useMarket();
  const productSeoDescription = useMemo(() => {
    const raw = String(product?.description || '').replace(/\s+/g, ' ').trim();
    if (raw) return raw.slice(0, 300);
    if (loadError) return t('pages.productDetail.loadFailedDescription');
    return t('common.siteDescription');
  }, [loadError, product?.description, t]);
  const productSeoImage = selectedImage || product?.imageUrl || product?.images?.[0] || '';
  const productJsonLd = useMemo(() => {
    if (!product) return null;
    const productData = buildProductStructuredData({
      id: product.id,
      name: product.name,
      description: product.description,
      imageUrl: productSeoImage || product.imageUrl,
      images: product.images,
      brand: product.brand,
      price: product.effectivePrice ?? product.price,
      currency,
      stock: product.stock,
      path: `/products/${product.id}`,
      averageRating: product.averageRating,
      reviewCount: product.reviewCount,
    });
    const breadcrumbData = buildBreadcrumbStructuredData([
      { name: t('nav.ariaHome'), path: '/' },
      { name: t('pages.productList.title'), path: '/products' },
      { name: product.name },
    ]);
    return [productData, breadcrumbData].filter(Boolean) as Array<Record<string, unknown>>;
  }, [currency, product, productSeoImage, t]);
  useDocumentMeta({
    enabled: Boolean(product) || Boolean(loadError),
    title: pageTitle || t('pages.productDetail.product'),
    description: productSeoDescription,
    imageUrl: product ? productSeoImage : undefined,
    path: product ? `/products/${product.id}` : '/products',
    type: product ? 'product' : 'website',
    noIndex: Boolean(loadError) || (!product && !loadError),
    siteName: t('common.siteTitle'),
    jsonLdId: product ? `product-${product.id}` : 'product-detail',
    jsonLd: productJsonLd,
  });

  useEffect(() => {
    const nextTab = normalizeProductDetailTab(searchParams.get('tab'));
    setDetailActiveTab((current) => (current === nextTab ? current : nextTab));
  }, [searchParams]);

  const openProductDetailTab = useCallback((tabKey: string) => {
    const nextTab = normalizeProductDetailTab(tabKey);
    setDetailActiveTab(nextTab);
    const nextParams = new URLSearchParams(searchParams);
    if (nextTab === 'details') {
      nextParams.delete('tab');
    } else {
      nextParams.set('tab', nextTab);
    }
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (typeof document === 'undefined' || loading) return undefined;
    const hash = String(window.location.hash || '').replace(/^#/, '').toLowerCase();
    if (!hash) return undefined;
    const targetId = hash === 'reviews' || hash === 'review'
      ? 'product-reviews-card'
      : hash === 'qa' || hash === 'questions' || hash === 'ask'
        ? 'product-qa-card'
        : hash === 'specs' || hash === 'service' || hash === 'details'
          ? 'product-service-tabs'
          : '';
    if (!targetId) return undefined;
    if (hash === 'specs' || hash === 'service' || hash === 'details') {
      openProductDetailTab(hash);
    }
    const frameId = window.requestAnimationFrame(() => {
      const target = document.getElementById(targetId);
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [id, loading, openProductDetailTab, product?.id]);

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

  const productImages = useMemo(() => product ? normalizeProductImages(product) : [], [product]);
  const galleryImages = useMemo(() => productImages.slice(0, -1), [productImages]);
  const {
    handleGalleryKeyDown,
    handleGalleryTouchStart,
    handleMobileGalleryScroll,
    imagePaused,
    mobileGalleryRef,
    pauseImageRotation,
    pinchZoom,
    resetGalleryPinch,
    resumeImageRotation,
    scheduleImageRotationResume,
    selectAdjacentGalleryImage,
    selectGalleryImage,
    setImagePaused,
  } = useProductDetailGallery({
    activeMobileImageIndex,
    galleryImages,
    isModalVisible,
    loading,
    product,
    selectedImage,
    setActiveMobileImageIndex,
    setSelectedImage,
  });
  const optionGroups = useMemo(() => getProductOptionGroups(product), [product]);
  const variants = useMemo(() => getProductVariants(product), [product]);
  const bundleInfo = useMemo(() => getBundleInfo(product), [product]);
  const selectedVariant = useMemo(
    () => findSelectedProductVariant(variants, selectedOptions),
    [selectedOptions, variants],
  );
  const currentStock = selectedVariant?.stock ?? product?.stock;
  const selectedSpecsPayload = useMemo(
    () => buildSelectedSpecsPayload(selectedOptions, selectedVariant, purchaseMode, bundleInfo),
    [bundleInfo, purchaseMode, selectedOptions, selectedVariant],
  );

  const focusOptionsSection = () => {
    optionsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const validateOptions = () => {
    const missing = optionGroups.find((group) => !selectedOptions[group.name]);
    if (missing) {
      announceAccessibleMessage(t('pages.productDetail.selectOption', { option: missing.name }), 'warning');
      focusOptionsSection();
      return false;
    }
    if (variants.length > 0 && !selectedVariant) {
      announceAccessibleMessage(t('pages.productDetail.variantUnavailable'), 'warning');
      focusOptionsSection();
      return false;
    }
    return true;
  };

  const { handleAddToCart, handleBuyNow } = useProductDetailPurchaseActions({
    bundleInfo,
    id,
    language,
    navigate,
    optionGroupsLength: optionGroups.length,
    product,
    purchaseMode,
    purchaseSubmitting,
    quantity,
    selectedSpecsPayload,
    selectedStock: currentStock,
    selectedVariant,
    setPurchaseSubmitting,
    t,
    validateOptions,
  });

  const {
    handleAddRecommendationToCart,
    recommendationAddingId,
    resetRecommendationCartState,
  } = useProductDetailRecommendationActions({
    language,
    navigate,
    t,
  });

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
      setRecommendationsLoading(false);
      setRecommendationsLoadFailed(false);
      resetRecommendationCartState();
      setAuthSessionVersion((version) => version + 1);
    };
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, handleAuthSessionChanged);
    return () => {
      window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, handleAuthSessionChanged);
    };
  }, [resetRecommendationCartState]);

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
    setRecommendationsLoading(false);
    setRecommendationsLoadFailed(false);
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

  const {
    handleCompare,
    handleFavorite,
    handleStockAlert,
  } = useProductDetailEngagementActions({
    id,
    isAlerted,
    language,
    navigate,
    product,
    setIsAlerted,
    setIsCompared,
    setIsWishlisted,
    t,
  });

  const {
    handleAddReview,
    handleAskQuestion,
  } = useProductDetailCommunityActions({
    fetchQuestions,
    fetchReviewableOrders,
    fetchReviews,
    id,
    isCurrentNonCriticalRequest,
    language,
    navigate,
    nonCriticalRequestSeqRef,
    questionText,
    setPendingQuestions,
    setQuestionSubmitting,
    setQuestionText,
    t,
  });


  if (loading) {
    return <ProductDetailSkeleton label={t('common.loading')} />;
  }

  if (!product) {
    if (loadError) {
      return (
        <div className="product-detail-empty" data-product-detail-load-recovery="true">
          <PageError
            className="product-detail-empty__panel product-detail-empty__panel--error"
            title={t('pages.productDetail.loadFailed')}
            description={loadError || t('pages.productDetail.loadFailedDescription')}
            actions={[
              {
                key: 'retry',
                label: t('common.refresh'),
                onClick: () => setReloadToken((value) => value + 1),
                type: 'primary',
              },
              {
                key: 'browse',
                label: t('pages.productList.title'),
                onClick: () => navigate('/products'),
                type: 'default',
              },
              {
                key: 'coupons',
                label: t('pages.productDetail.notFoundCoupons'),
                onClick: () => navigate('/coupons'),
                type: 'default',
              },
              {
                key: 'pet-finder',
                label: t('pages.productDetail.notFoundPetFinder'),
                onClick: () => navigate('/pet-finder'),
                type: 'default',
              },
              {
                key: 'support',
                label: t('nav.support'),
                onClick: () => dispatchDomEvent('shop:open-support'),
                type: 'default',
              },
            ]}
          />
        </div>
      );
    }
    return (
      <div className="product-detail-empty">
        <PageEmpty
          className="product-detail-empty__panel"
          data-product-not-found-actions="true"
          description={(
            <div className="product-detail-empty__copy">
              <div>{t('pages.productDetail.notFound')}</div>
              <div className="product-detail-empty__hint">{t('pages.productDetail.notFoundHint')}</div>
            </div>
          )}
          actions={[
            {
              key: 'browse',
              label: t('pages.productList.title'),
              onClick: () => navigate('/products'),
            },
            {
              key: 'wishlist',
              label: t('pages.productDetail.notFoundWishlist'),
              onClick: () => navigate('/wishlist'),
              type: 'default',
            },
            {
              key: 'coupons',
              label: t('pages.productDetail.notFoundCoupons'),
              onClick: () => navigate('/coupons'),
              type: 'default',
            },
            {
              key: 'pet-finder',
              label: t('pages.productDetail.notFoundPetFinder'),
              onClick: () => navigate('/pet-finder'),
              type: 'default',
            },
          ]}
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
      icon: <ShopIcon path={SI.checkCircle} />,
      // Commercial trust: never mark options "ready to add" when the SKU is sold out.
      ready: !isOutOfStock && (optionGroups.length === 0 || (hasCompleteOptions && !hasUnavailableSelectedVariant)),
      title: isOutOfStock
        ? t('pages.productDetail.decisionStockOutTitle')
        : optionGroups.length === 0
          ? t('pages.productDetail.decisionNoOptionsTitle')
          : hasCompleteOptions && !hasUnavailableSelectedVariant
            ? t('pages.productDetail.decisionOptionsReadyTitle')
            : t('pages.productDetail.decisionOptionsMissingTitle'),
      text: isOutOfStock
        ? t('pages.productDetail.decisionStockOutText')
        : optionGroups.length === 0
          ? t('pages.productDetail.decisionNoOptionsText')
          : hasCompleteOptions && !hasUnavailableSelectedVariant
            ? t('pages.productDetail.decisionOptionsReadyText')
            : t('pages.productDetail.decisionOptionsMissingText'),
    },
    {
      key: 'stock',
      icon: <ShopIcon path={SI.safety} />,
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
      icon: <ShopIcon path={SI.truck} />,
      ready: Boolean(deliveryPromise.enabled),
      title: t('pages.productDetail.decisionDeliveryTitle'),
      text: deliveryPromise.enabled
        ? t('pages.productDetail.decisionDeliveryText', { window: deliveryPromise.windowText })
        : productShippingText,
    },
    {
      key: 'value',
      icon: purchaseSavings > 0 || discountPercent > 0 ? <ShopIcon path={SI.thunder} /> : <ShopIcon path={SI.checkCircle} />,
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


  const relatedRecommendations = buildRelatedRecommendations(product, recommendations);
  const completeSetItems = buildCompleteSetItems(relatedRecommendations);
  const retryRecommendations = () => {
    const requestSeq = nonCriticalRequestSeqRef.current + 1;
    nonCriticalRequestSeqRef.current = requestSeq;
    nonCriticalLoadedRef.current = false;
    warmNonCriticalContent(requestSeq);
  };
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
      icon: <ShopIcon path={SI.checkCircle} />,
      // Commercial trust: sold-out SKUs must never claim "ready to add" / direct-add copy.
      ready: !isOutOfStock && !purchaseSelectionBlocked,
      title: isOutOfStock
        ? t('pages.productDetail.decisionStockOutTitle')
        : optionGroups.length === 0
          ? t('pages.productDetail.decisionNoOptionsTitle')
          : purchaseSelectionBlocked
            ? t('pages.productDetail.decisionOptionsMissingTitle')
            : t('pages.productDetail.decisionOptionsReadyTitle'),
      text: isOutOfStock
        ? t('pages.productDetail.decisionStockOutText')
        : optionGroups.length === 0
          ? t('pages.productDetail.decisionNoOptionsText')
          : hasUnavailableSelectedVariant
            ? t('pages.productDetail.selectedVariantUnavailable')
            : hasCompleteOptions
              ? t('pages.productDetail.selectedVariantStock', { stock: stockLabel })
              : t('pages.productDetail.selectedOptionsEmpty'),
    },
    {
      key: 'stock',
      icon: <ShopIcon path={SI.safety} />,
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
      icon: <ShopIcon path={SI.truck} />,
      ready: Boolean(deliveryPromise.enabled),
      title: t('pages.productDetail.trustShippingTitle'),
      text: deliveryPromise.enabled
        ? t('pages.productDetail.deliveryPromise', { window: deliveryPromise.windowText })
        : productShippingText,
    },
    {
      key: 'value',
      icon: <ShopIcon path={SI.thunder} />,
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

  return (
    <div className={`product-detail-page product-detail-page--${language}`}>
      <div className="product-detail-shell">
        <ShopBreadcrumb
          className="product-detail-breadcrumb"
          ariaLabel={productName}
          items={[
            {
              key: 'home',
              path: '/',
              ariaLabel: t('nav.ariaHome'),
              label: <ShopIcon path={SI.home} />,
            },
            {
              key: 'products',
              path: '/products',
              label: t('pages.productList.title'),
            },
            {
              key: 'product',
              label: productName,
            },
          ]}
        />

        <div className="product-detail__layout">
          {/* Product media gallery */}
          <ProductDetailGallery
            activeMobileImageIndex={activeMobileImageIndex}
            discountPercent={discountPercent}
            galleryImages={galleryImages}
            handleGalleryKeyDown={handleGalleryKeyDown}
            handleGalleryTouchStart={handleGalleryTouchStart}
            handleMobileGalleryScroll={handleMobileGalleryScroll}
            heroImage={heroImage}
            heroImageSizes={heroImageSizes}
            heroImageSrcSet={heroImageSrcSet}
            imagePaused={imagePaused}
            mobileGalleryRef={mobileGalleryRef}
            pauseImageRotation={pauseImageRotation}
            pinchZoom={pinchZoom}
            productImages={productImages}
            productName={productName}
            resetGalleryPinch={resetGalleryPinch}
            resumeImageRotation={resumeImageRotation}
            scheduleImageRotationResume={scheduleImageRotationResume}
            selectGalleryImage={selectGalleryImage}
            selectedImage={selectedImage}
            setImagePaused={setImagePaused}
            setIsModalVisible={setIsModalVisible}
            setSelectedImage={setSelectedImage}
            t={t}
          />

          {/* Product purchase summary */}
          <ProductDetailSummary
            addToCartActionLabel={addToCartActionLabel}
            addToCartBlocked={addToCartBlocked}
            bundleInfo={bundleInfo}
            bundleSavings={bundleSavings}
            buyNowBlocked={buyNowBlocked}
            buyNowBlockedReason={buyNowBlockedReason}
            compareActionLabel={compareActionLabel}
            completeSetItems={completeSetItems}
            decisionChecklist={decisionChecklist}
            decreaseQuantityLabel={decreaseQuantityLabel}
            deliveryPromise={deliveryPromise}
            detailProductName={detailProductName}
            displayPrice={displayPrice}
            displayedRating={displayedRating}
            favoriteActionLabel={favoriteActionLabel}
            fitConfidenceText={fitConfidenceText}
            formatCountdown={formatCountdown}
            formatMoney={formatMoney}
            handleAddRecommendationToCart={handleAddRecommendationToCart}
            handleAddToCart={handleAddToCart}
            handleBuyNow={handleBuyNow}
            handleCompare={handleCompare}
            handleFavorite={handleFavorite}
            handleQuantityChange={handleQuantityChange}
            handleStockAlert={handleStockAlert}
            hasCompleteOptions={hasCompleteOptions}
            hasUnavailableSelectedVariant={hasUnavailableSelectedVariant}
            homeActionLabel={homeActionLabel}
            increaseQuantityLabel={increaseQuantityLabel}
            isAlerted={isAlerted}
            isCompared={isCompared}
            isLowStock={isLowStock}
            isOutOfStock={isOutOfStock}
            isWishlisted={isWishlisted}
            language={language}
            limitedTimePromoActive={limitedTimePromoActive}
            limitedTimeRemaining={limitedTimeRemaining}
            lowStockCount={lowStockCount}
            lowStockUrgencyLabel={lowStockUrgencyLabel}
            mobileAddToCartBlocked={mobileAddToCartBlocked}
            mobileBuybarPrice={mobileBuybarPrice}
            mobileBuybarStatus={mobileBuybarStatus}
            mobileCartBlockedReason={mobileCartBlockedReason}
            navigate={navigate}
            optionGroups={optionGroups}
            optionsSectionRef={optionsSectionRef}
            originalReferencePrice={originalReferencePrice}
            priceSavingsAmount={priceSavingsAmount}
            priceSavingsPercent={priceSavingsPercent}
            product={product}
            productFreeShippingText={productFreeShippingText}
            productName={productName}
            productShippingText={productShippingText}
            purchaseMode={purchaseMode}
            purchaseModeActionLabel={purchaseModeActionLabel}
            purchaseModeLabel={purchaseModeLabel}
            purchaseReadinessItems={purchaseReadinessItems}
            purchaseSavings={purchaseSavings}
            purchaseSelectionBlocked={purchaseSelectionBlocked}
            purchaseSubmitting={purchaseSubmitting}
            purchaseSubtotal={purchaseSubtotal}
            quantity={quantity}
            quantityValueLabel={quantityValueLabel}
            recommendationAddingId={recommendationAddingId}
            recommendedPathText={recommendedPathText}
            recommendedPathTitle={recommendedPathTitle}
            recommendedPurchaseMode={recommendedPurchaseMode}
            recommendedSize={recommendedSize}
            recommendedSizeLabel={recommendedSizeLabel}
            recommendedSizeValue={recommendedSizeValue}
            renderProductDetailAmountText={renderProductDetailAmountText}
            resetSelectedOptionsActionLabel={resetSelectedOptionsActionLabel}
            selectOptionValue={selectOptionValue}
            selectedOptionTags={selectedOptionTags}
            selectedOptions={selectedOptions}
            selectedStock={selectedStock}
            selectedVariant={selectedVariant}
            setPurchaseMode={setPurchaseMode}
            setSelectedOptions={setSelectedOptions}
            setSizeCalculatorBreed={setSizeCalculatorBreed}
            setSizeCalculatorWeight={setSizeCalculatorWeight}
            setSizeGuideOpen={setSizeGuideOpen}
            shouldShowDecisionChecklist={shouldShowDecisionChecklist}
            sizeBreedInputLabel={sizeBreedInputLabel}
            sizeCalculatorBreed={sizeCalculatorBreed}
            sizeCalculatorWeight={sizeCalculatorWeight}
            sizeGuideActionLabel={sizeGuideActionLabel}
            sizeOptionGroup={sizeOptionGroup}
            sizeWeightInputLabel={sizeWeightInputLabel}
            stockAlertActionLabel={stockAlertActionLabel}
            stockLabel={stockLabel}
            t={t}
            trustBadges={trustBadges}
            useRecommendedPathActionLabel={useRecommendedPathActionLabel}
            variants={variants}
          />
        </div>

        {/* Product details and specifications */}
        <ProductDetailContent
          detailActiveTab={detailActiveTab}
          detailContentRef={detailContentRef}
          handleAddReview={handleAddReview}
          handleAskQuestion={handleAskQuestion}
          id={id}
          language={language}
          openProductDetailTab={openProductDetailTab}
          pendingQuestions={pendingQuestions}
          product={product}
          productFaqItems={productFaqItems}
          productShippingText={productShippingText}
          questionInputLabel={questionInputLabel}
          questionSubmitActionLabel={questionSubmitActionLabel}
          questionSubmitting={questionSubmitting}
          questionText={questionText}
          questions={questions}
          reviewableOrders={reviewableOrders}
          reviews={reviews}
          setQuestionText={setQuestionText}
          t={t}
        />

        <ProductDetailRecommendations
          detailProductName={detailProductName}
          formatMoney={formatMoney}
          handleAddRecommendationToCart={handleAddRecommendationToCart}
          navigate={navigate}
          recommendationAddingId={recommendationAddingId}
          recommendationsLoadFailed={recommendationsLoadFailed}
          recommendationsLoading={recommendationsLoading}
          relatedRecommendations={relatedRecommendations}
          retryRecommendations={retryRecommendations}
          t={t}
        />
      </div>

      {/* Image preview modal */}
      <ProductDetailImagePreviewModal
        isModalVisible={isModalVisible}
        productImages={productImages}
        productName={productName}
        selectedImage={selectedImage}
        setIsModalVisible={setIsModalVisible}
        t={t}
      />

      <ProductDetailSizeGuideModal
        open={sizeGuideOpen}
        setOpen={setSizeGuideOpen}
        sizeGuideConfirmActionLabel={sizeGuideConfirmActionLabel}
        t={t}
      />
    </div>
  );
};

export default ProductDetail;
