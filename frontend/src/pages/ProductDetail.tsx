import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { useParams, useSearchParams } from 'react-router-dom';
import { productApi, wishlistApi } from '../api';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n';
import type { CartItem, ProductPublic as Product, PublicReview, ProductQuestionPublic, ReviewableOrder } from '../types';
import { useMarket } from '../hooks/useMarket';
import { localizeProduct } from '../utils/localizedProduct';
import { getBundleInfo } from '../utils/bundle';
import { recordProductView } from '../utils/productViewPreferences';
import { hasStockAlert } from '../utils/stockAlerts';
import { conversionConfig, getDeliveryPromise } from '../utils/conversionConfig';
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
import { usePageTitle } from '../hooks/usePageTitle';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useDocumentVisibility } from '../hooks/useDocumentVisibility';
import {
  buildSelectedSpecsPayload,
  clearProductDetailSessionCaches,
  fallbackProductImage,
  findFallbackProductById,
  findSelectedProductVariant,
  normalizeProductImages,
  normalizeProductDetailTab,
  resolveProductPrimaryImage,
  buildCompleteSetItems,
  buildRelatedRecommendations,
  buildProductDetailActionLabels,
  buildProductDetailDecisionChecklistData,
  buildProductDetailFaqItems,
  buildProductDetailFitGuidance,
  buildProductDetailMainShellProps,
  buildProductDetailLoadingShellProps,
  buildProductDetailLoadErrorShellProps,
  buildProductDetailNotFoundShellProps,
  buildProductDetailMobileBuybarPresentation,
  resolveProductDetailPageTitle,
  resolveProductDetailSeoDescription,
  resolveProductDetailSeoImage,
  resolveProductDetailVariantGallerySelection,
  buildProductDetailPurchaseReadinessData,
  buildProductDetailQuantityLabels,
  buildProductDetailSelectedOptionTags,
  buildProductDetailShippingCopy,
  buildRecommendedPurchasePath,
  deriveProductDetailActionBlockState,
  deriveProductDetailPricing,
  deriveProductDetailSelectionState,
  formatLimitedTimeCountdown,
  renderProductDetailAmountText,
  resolveBuyNowBlockedReason,
  resolveMobilePurchaseStatus,
  resolveProductDetailCartActionLabels,
  resolveProductDetailLowStockUrgencyLabel,
  resolveProductDetailPurchaseModeLabel,
  resolveRecommendedPurchaseMode,
  shouldShowProductDetailDecisionChecklist,
  withProductDetailChecklistIcons,
} from './productDetailHelpers';
import type {
  PendingProductQuestion,
  ProductDetailTabKey,
  ProductRecommendationCandidate,
} from './productDetailHelpers';
import {
  ProductDetailSkeleton,
  ProductDetailLoadErrorShell,
  ProductDetailNotFoundShell,
  ProductDetailMainShell,
} from './productDetailShell';
import { ProductDetailSizeGuideModal } from './productDetailSummary';
import { useProductDetailNonCriticalContent } from '../hooks/useProductDetailNonCriticalContent';
import { useProductDetailGallery } from '../hooks/useProductDetailGallery';
import { useProductDetailPurchaseActions } from '../hooks/useProductDetailPurchaseActions';
import { useProductDetailEngagementActions } from '../hooks/useProductDetailEngagementActions';
import { useProductDetailCommunityActions } from '../hooks/useProductDetailCommunityActions';
import { useProductDetailRecommendationActions } from '../hooks/useProductDetailRecommendationActions';
import './ProductDetail.css';


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
    cancelNonCriticalContent,
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
  const pageTitle = resolveProductDetailPageTitle({
    t,
    productName: product?.name,
    loadError,
  });
  usePageTitle(pageTitle || t('pages.productDetail.product'));
  const { currency, market, formatMoney } = useMarket();
  const productSeoDescription = useMemo(
    () => resolveProductDetailSeoDescription({
      t,
      productDescription: product?.description,
      loadError,
    }),
    [loadError, product?.description, t],
  );
  const productSeoImage = resolveProductDetailSeoImage({
    selectedImage,
    productImageUrl: product?.imageUrl,
    productImages: product?.images,
  });
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
    if (typeof document === 'undefined' || loading) return;
    const hash = String(window.location.hash || '').replace(/^#/, '').toLowerCase();
    if (!hash) return;
    const targetId = hash === 'reviews' || hash === 'review'
      ? 'product-reviews-card'
      : hash === 'qa' || hash === 'questions' || hash === 'ask'
        ? 'product-qa-card'
        : hash === 'specs' || hash === 'service' || hash === 'details'
          ? 'product-service-tabs'
          : '';
    if (!targetId) return;
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
  const documentVisible = useDocumentVisibility();

  useEffect(() => {
    if (!limitedTimeTickerActive || !documentVisible) return;
    // Keep Jest free of perpetual 1s timers that retain the page and open handles.
    if (process.env.NODE_ENV === 'test') return;
    const timer = window.setTimeout(() => setNow(Date.now()), 1000);
    return () => window.clearTimeout(timer);
  }, [documentVisible, limitedTimeEnd, limitedTimeTickerActive]);

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
    scopeKey: id,
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
      cancelNonCriticalContent();
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
  }, [cancelNonCriticalContent, resetRecommendationCartState]);

  useEffect(() => {
    let disposed = false;
    const abortController = new AbortController();
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
        const res = await productApi.getById(Number(id), { signal: abortController.signal });
        if (disposed || abortController.signal.aborted) return;
        setProduct(localizeProduct(res.data as Product, language));
        setSelectedImage(normalizeProductImages(res.data)[0]);
        setActiveMobileImageIndex(0);
        recordProductView(res.data);
        setLoadError(null);
      } catch (error) {
        if (disposed || abortController.signal.aborted) return;
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
        if (disposed || abortController.signal.aborted) return;
        setLoading(false);
      }
    };
    fetchProduct();
    if (token) {
      wishlistApi.check(0, Number(id), { signal: abortController.signal })
        .then(res => {
          if (!disposed && !abortController.signal.aborted) setIsWishlisted(res.data.wishlisted);
        })
        .catch((error) => {
          if (!disposed && !abortController.signal.aborted) reportNonBlockingError('ProductDetail.checkWishlist', error);
        });
    }
    setIsAlerted(hasStockAlert(Number(id)));
    setIsCompared(isProductCompared(Number(id)));

    let fallbackTimer: number | null = null;
    const warmNonCritical = () => {
      if (fallbackTimer !== null) {
        window.clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
      warmNonCriticalContent(nonCriticalRequestSeq);
    };
    if (process.env.NODE_ENV !== 'test') {
      fallbackTimer = window.setTimeout(warmNonCritical, 1800);
    }
    const target = detailContentRef.current;
    let observer: IntersectionObserver | null = null;
    if (target && 'IntersectionObserver' in window) {
      observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          warmNonCritical();
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
          warmNonCritical();
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
        abortController.abort();
        cancelNonCriticalContent();
        if (fallbackTimer !== null) {
          window.clearTimeout(fallbackTimer);
        }
        detachScrollWarmup();
        observer?.disconnect();
      }
    }

    return () => {
      disposed = true;
      abortController.abort();
      cancelNonCriticalContent();
      if (fallbackTimer !== null) {
        window.clearTimeout(fallbackTimer);
      }
      observer?.disconnect();
    };
  }, [authSessionVersion, cancelNonCriticalContent, id, language, reloadToken, warmNonCriticalContent]);

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
    return (
      <ProductDetailSkeleton
        {...buildProductDetailLoadingShellProps({
          label: t('common.loading'),
        })}
      />
    );
  }

  if (!product) {
    if (loadError) {
      return (
        <ProductDetailLoadErrorShell
          {...buildProductDetailLoadErrorShellProps({
            t,
            loadError,
            onRetry: () => setReloadToken((value) => value + 1),
            onBrowse: () => navigate('/products'),
            onCoupons: () => navigate('/coupons'),
            onPetFinder: () => navigate('/pet-finder'),
            onSupport: () => dispatchDomEvent('shop:open-support'),
          })}
        />
      );
    }
    return (
      <ProductDetailNotFoundShell
        {...buildProductDetailNotFoundShellProps({
          t,
          onBrowse: () => navigate('/products'),
          onWishlist: () => navigate('/wishlist'),
          onCoupons: () => navigate('/coupons'),
          onPetFinder: () => navigate('/pet-finder'),
        })}
      />
    );
  }

  const productName = detailProductName(product);
  const {
    addCartActionLabel,
    buyNowActionLabel,
    selectOptionsActionLabel,
    questionInputLabel,
    questionSubmitActionLabel,
    stockAlertActionLabel,
    favoriteActionLabel,
    compareActionLabel,
    homeActionLabel,
    sizeGuideActionLabel,
    resetSelectedOptionsActionLabel,
    sizeBreedInputLabel,
    sizeWeightInputLabel,
    purchaseModeActionLabel,
    useRecommendedPathActionLabel,
    sizeGuideConfirmActionLabel,
  } = buildProductDetailActionLabels({
    t,
    productName,
    isAlerted,
    isWishlisted,
    isCompared,
  });
  const {
    selectedStock,
    isOutOfStock,
    stockLabel,
    lowStockCount,
    isLowStock,
    hasCompleteOptions,
    hasUnavailableSelectedVariant,
    optionsMissing,
    purchaseSelectionBlocked,
  } = deriveProductDetailSelectionState({
    selectedStock: currentStock,
    quantity,
    optionGroups,
    variantsLength: variants.length,
    selectedVariant,
    selectedOptions,
    enoughStockLabel: t('pages.productDetail.enough'),
  });
  const lowStockUrgencyLabel = resolveProductDetailLowStockUrgencyLabel({
    t,
    isLowStock,
    lowStockCount: Number(lowStockCount || 0),
  });
  const displayedRating = Number(averageRating || product.averageRating || 0);
  const {
    activePrice,
    displayPrice,
    bundleSavings,
    purchaseSubtotal,
    purchaseSavings,
    discountPercent,
    originalReferencePrice,
    priceSavingsAmount,
    priceSavingsPercent,
  } = deriveProductDetailPricing({
    product,
    selectedVariant,
    purchaseMode,
    bundleInfo,
    quantity,
  });
  const {
    productFreeShippingText,
    productShippingText,
  } = buildProductDetailShippingCopy({
    t,
    freeShippingThreshold: market.freeShippingThreshold,
    formatMoney,
    productFreeShipping: product.freeShipping,
    productShipping: product.shipping,
  });
  const purchaseModeLabel = resolveProductDetailPurchaseModeLabel(purchaseMode, t);
  const limitedTimeRemaining = getLimitedTimeRemainingMs(product, now);
  const limitedTimePromoActive = limitedTimeRemaining > 0;
  const {
    addToCartBlocked,
    mobileAddToCartBlocked,
    buyNowBlocked,
  } = deriveProductDetailActionBlockState({
    isOutOfStock,
    purchaseSelectionBlocked,
    purchaseSubmitting,
  });
  const {
    addToCartActionLabel,
    mobileCartBlockedReason,
  } = resolveProductDetailCartActionLabels({
    purchaseSelectionBlocked,
    selectOptionsActionLabel,
    addCartActionLabel,
  });
  const buyNowBlockedReason = resolveBuyNowBlockedReason({
    t,
    productName,
    isOutOfStock,
    purchaseSelectionBlocked,
    selectOptionsActionLabel,
    buyNowActionLabel,
  });
  const selectedOptionTags = buildProductDetailSelectedOptionTags(optionGroups, selectedOptions, language);
  const {
    sizeOptionGroup,
    recommendedSize,
    recommendedSizeValue,
    recommendedSizeLabel,
    fitConfidenceText,
  } = buildProductDetailFitGuidance({
    t,
    language,
    optionGroups,
    sizeCalculatorBreed,
    sizeCalculatorWeight,
    hasCompleteOptions,
  });
  const selectOptionValue = (groupName: string, value: string) => {
    const nextOptions = selectCompatibleProductOption(optionGroups, variants, selectedOptions, groupName, value);
    setSelectedOptions(nextOptions);
    const variantImage = variants.find((variant) =>
      variantMatchesSelectedOptions([variant], nextOptions),
    )?.imageUrl;
    const gallerySelection = resolveProductDetailVariantGallerySelection({
      galleryImages,
      variantImageUrl: variantImage,
    });
    if (!gallerySelection) return;
    if (gallerySelection.galleryIndex >= 0) {
      selectGalleryImage(gallerySelection.imageUrl, gallerySelection.galleryIndex);
      return;
    }
    setSelectedImage(gallerySelection.imageUrl);
  };
  const formatCountdown = (milliseconds: number) => formatLimitedTimeCountdown(milliseconds, t);
  const decisionChecklist = withProductDetailChecklistIcons(buildProductDetailDecisionChecklistData({
    t,
    isOutOfStock,
    isLowStock,
    optionGroupsLength: optionGroups.length,
    hasCompleteOptions,
    hasUnavailableSelectedVariant,
    lowStockCount,
    stockLabel,
    deliveryEnabled: Boolean(deliveryPromise.enabled),
    deliveryWindowText: deliveryPromise.windowText,
    productShippingText,
  }));
  const recommendedPurchaseMode = resolveRecommendedPurchaseMode({ bundleInfo, bundleSavings });
  const {
    recommendedPathTitle,
    recommendedPathText,
  } = buildRecommendedPurchasePath({
    recommendedPurchaseMode,
    bundleInfo,
    bundleSavings,
    quantity,
    t,
    formatMoney,
    renderAmountText: renderProductDetailAmountText,
  });
  const {
    quantityValueLabel,
    decreaseQuantityLabel,
    increaseQuantityLabel,
  } = buildProductDetailQuantityLabels(t, quantity);

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
  const mobilePurchaseStatus = resolveMobilePurchaseStatus({
    t,
    isOutOfStock,
    hasUnavailableSelectedVariant,
    optionsMissing,
    isLowStock,
    lowStockUrgencyLabel,
  });
  const {
    mobileBuybarPrice,
    mobileBuybarStatus,
  } = buildProductDetailMobileBuybarPresentation({
    displayPrice,
    formatMoney,
    mobilePurchaseStatus,
  });
  const shouldShowDecisionChecklist = shouldShowProductDetailDecisionChecklist({
    optionsMissing,
    hasUnavailableSelectedVariant,
    isOutOfStock,
    isLowStock,
  });
  const purchaseReadinessItems = withProductDetailChecklistIcons(buildProductDetailPurchaseReadinessData({
    t,
    isOutOfStock,
    isLowStock,
    purchaseSelectionBlocked,
    optionGroupsLength: optionGroups.length,
    hasUnavailableSelectedVariant,
    hasCompleteOptions,
    stockLabel,
    lowStockCount,
    deliveryEnabled: Boolean(deliveryPromise.enabled),
    deliveryWindowText: deliveryPromise.windowText,
    productShippingText,
    purchaseSavings,
    purchaseSubtotal,
    formatMoney,
  }));
  const productFaqItems = buildProductDetailFaqItems(t);

  const shellProps = buildProductDetailMainShellProps({
    activeMobileImageIndex,
    addToCartActionLabel,
    addToCartBlocked,
    bundleInfo,
    bundleSavings,
    buyNowBlocked,
    buyNowBlockedReason,
    compareActionLabel,
    completeSetItems,
    decisionChecklist,
    decreaseQuantityLabel,
    deliveryPromise,
    detailActiveTab,
    detailContentRef,
    detailProductName,
    discountPercent,
    displayPrice,
    displayedRating,
    favoriteActionLabel,
    fitConfidenceText,
    formatCountdown,
    formatMoney,
    galleryImages,
    handleAddRecommendationToCart,
    handleAddReview,
    handleAddToCart,
    handleAskQuestion,
    handleBuyNow,
    handleCompare,
    handleFavorite,
    handleGalleryKeyDown,
    handleGalleryTouchStart,
    handleMobileGalleryScroll,
    handleQuantityChange,
    handleStockAlert,
    hasCompleteOptions,
    hasUnavailableSelectedVariant,
    heroImage,
    heroImageSizes,
    heroImageSrcSet,
    homeActionLabel,
    id,
    imagePaused,
    increaseQuantityLabel,
    isAlerted,
    isCompared,
    isLowStock,
    isModalVisible,
    isOutOfStock,
    isWishlisted,
    language,
    limitedTimePromoActive,
    limitedTimeRemaining,
    lowStockCount,
    lowStockUrgencyLabel,
    mobileAddToCartBlocked,
    mobileBuybarPrice,
    mobileBuybarStatus,
    mobileCartBlockedReason,
    mobileGalleryRef,
    navigate,
    openProductDetailTab,
    optionGroups,
    optionsSectionRef,
    originalReferencePrice,
    pauseImageRotation,
    pendingQuestions,
    pinchZoom,
    priceSavingsAmount,
    priceSavingsPercent,
    product,
    productFaqItems,
    productFreeShippingText,
    productImages,
    productName,
    productShippingText,
    purchaseMode,
    purchaseModeActionLabel,
    purchaseModeLabel,
    purchaseReadinessItems,
    purchaseSavings,
    purchaseSelectionBlocked,
    purchaseSubmitting,
    purchaseSubtotal,
    quantity,
    quantityValueLabel,
    questionInputLabel,
    questionSubmitActionLabel,
    questionSubmitting,
    questionText,
    questions,
    recommendationAddingId,
    recommendationsLoadFailed,
    recommendationsLoading,
    recommendedPathText,
    recommendedPathTitle,
    recommendedPurchaseMode,
    recommendedSize,
    recommendedSizeLabel,
    recommendedSizeValue,
    relatedRecommendations,
    renderProductDetailAmountText,
    resetGalleryPinch,
    resetSelectedOptionsActionLabel,
    resumeImageRotation,
    retryRecommendations,
    reviewableOrders,
    reviews,
    scheduleImageRotationResume,
    selectGalleryImage,
    selectOptionValue,
    selectedImage,
    selectedOptionTags,
    selectedOptions,
    selectedStock,
    selectedVariant,
    setImagePaused,
    setIsModalVisible,
    setPurchaseMode,
    setQuestionText,
    setSelectedImage,
    setSelectedOptions,
    setSizeCalculatorBreed,
    setSizeCalculatorWeight,
    setSizeGuideOpen,
    shouldShowDecisionChecklist,
    sizeBreedInputLabel,
    sizeCalculatorBreed,
    sizeCalculatorWeight,
    sizeGuideActionLabel,
    sizeOptionGroup,
    sizeWeightInputLabel,
    stockAlertActionLabel,
    stockLabel,
    t,
    trustBadges,
    useRecommendedPathActionLabel,
    variants,
  });

  return (
    <>
      <ProductDetailMainShell {...shellProps} />
      <ProductDetailSizeGuideModal
        open={sizeGuideOpen}
        setOpen={setSizeGuideOpen}
        sizeGuideConfirmActionLabel={sizeGuideConfirmActionLabel}
        t={t}
      />
    </>
  );

};

export default ProductDetail;
