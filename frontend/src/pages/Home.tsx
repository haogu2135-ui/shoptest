import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { useNavigate } from 'react-router-dom';
import { cartApi, categoryApi, petGalleryApi, productApi, wishlistApi } from '../api';
import { useLanguage } from '../i18n';
import type { Language } from '../i18n';
import type { CategoryPublic, PetGalleryPhotoPublic, PetGalleryQuota, ProductPublic as Product } from '../types';
import { useMarket } from '../hooks/useMarket';
import { localizeProduct } from '../utils/localizedProduct';
import { getDisplayCategoryRoots, getLocalizedCategoryValue } from '../utils/categoryTree';
import { clearProductViewHistory, loadProductViewPreferences, PRODUCT_VIEW_PREFERENCES_KEY } from '../utils/productViewPreferences';
import { addGuestCartItem } from '../utils/guestCart';
import { needsOptionSelection } from '../utils/productOptions';
import { getApiErrorMessage } from '../utils/apiError';
import { buildLoginUrlFromWindow } from '../utils/authRedirect';
import { dispatchDomEvent } from '../utils/domEvents';
import { loadGuestSupportContext } from '../utils/guestSupportContext';
import { addAppScrollListener, getAppScrollMetrics } from '../utils/nativeScroll';
import { hasStoredValue } from '../utils/safeStorage';
import { cancelIdleTask, scheduleIdleTask } from '../utils/idleScheduler';
import { openCartDrawerWithSnapshot } from '../utils/cartDrawer';
import { usePageTitle } from '../hooks/usePageTitle';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { allSettledWithConcurrency } from '../utils/asyncBatch';
import { buildProductCatalogFallbackCategories, loadFallbackProductCatalog, loadProductCatalogSnapshot, saveProductCatalogSnapshot } from '../utils/productCatalogSnapshot';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import { buildWebsiteStructuredData } from '../utils/structuredData';
import { resolveDefaultSocialImageUrl } from '../utils/documentMeta';
import { isSupportedPetGalleryImageFile } from '../utils/petGalleryUpload';
import type { HomePetGalleryItem } from '../components/HomePetGallery';
import './Home.css';
import '../styles/mobile-page-contrast.css';

import {
  DISCOVERY_BATCH_SIZE,
  HOME_FEATURED_LIMIT,
  HOME_PRODUCT_PAGE_SIZE,
  PET_GALLERY_MAX_FILE_SIZE,
  petGalleryImageFallback,
  publicAssetUrl,
  mergeProductsById,
  ugcImages,
  readLocalPetGalleryLikes,
  writeLocalPetGalleryLikes,
  resolvePetGalleryImage,
  resolveHomeCatalogBootstrap,
  HomeIcon,
  HI,
  type HomeCatalogBootstrap,
} from './homeHelpers';
import {
  HomeLoadingShell,
  HomeLoadRecoveryShell,
} from './homeShellStates';
import {
  HomeHeroSection,
  HomeMobileQuickPanel,
  HomeTrustStrip,
  HomeConversionActionsSection,
  HomeStoryGrid,
  homeSectionActionLabel,
} from './homeFirstFoldPanels';
import {
  HomeBestSellersSection,
  HomeEditorialBand,
  HomePersonalizedProductsSection,
  HomeCategoriesSection,
  HomeRecentlyViewedSection,
  HomeFlashOffersSection,
  HomeDiscoverySection,
} from './homeProductPanels';

const LazyHomePetGallery = React.lazy(() => import(/* webpackChunkName: "home-pet-gallery" */ '../components/HomePetGallery'));
const LazySocialProofToast = React.lazy(() => import(/* webpackChunkName: "social-proof-toast" */ '../components/SocialProofToast'));

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { formatMoney: formatPrice, market } = useMarket();
  const homeCatalogBootstrapRef = useRef<HomeCatalogBootstrap | null | undefined>(undefined);
  if (homeCatalogBootstrapRef.current === undefined) {
    homeCatalogBootstrapRef.current = resolveHomeCatalogBootstrap(language);
  }
  const homeCatalogBootstrap = homeCatalogBootstrapRef.current;
  const catalogReadyRef = useRef(Boolean(homeCatalogBootstrap));
  const [featured, setFeatured] = useState<Product[]>(() => homeCatalogBootstrap?.featured || []);
  const [products, setProducts] = useState<Product[]>(() => homeCatalogBootstrap?.products || []);
  const [personalizedProducts, setPersonalizedProducts] = useState<Product[]>([]);
  const [recentlyViewedDetails, setRecentlyViewedDetails] = useState<Product[]>([]);
  const [recentlyViewedHydrated, setRecentlyViewedHydrated] = useState(true);
  const [categories, setCategories] = useState<CategoryPublic[]>(() => homeCatalogBootstrap?.categories || []);
  // Commercial CLS: skip full-page skeleton when bootstrap catalog can paint immediately.
  const [loading, setLoading] = useState(() => !homeCatalogBootstrap);
  const [loadError, setLoadError] = useState(false);
  const [usingCatalogSnapshot, setUsingCatalogSnapshot] = useState(false);
  const [visibleCount, setVisibleCount] = useState(DISCOVERY_BATCH_SIZE);
  const [viewPreferences, setViewPreferences] = useState(() => loadProductViewPreferences());
  const [petGalleryPhotos, setPetGalleryPhotos] = useState<PetGalleryPhotoPublic[]>([]);
  const [petGalleryQuota, setPetGalleryQuota] = useState<PetGalleryQuota | null>(null);
  const [uploadingPetPhoto, setUploadingPetPhoto] = useState(false);
  const [localPetGalleryLikes, setLocalPetGalleryLikes] = useState<string[]>(() => readLocalPetGalleryLikes());
  const [wishlistedProductIds, setWishlistedProductIds] = useState<Set<number>>(new Set());
  const [petPreviewItem, setPetPreviewItem] = useState<HomePetGalleryItem | null>(null);
  const petUploadInputRef = useRef<HTMLInputElement>(null);
  usePageTitle(); // commercial home SEO: bare site title, not "Brand | Brand Site"
  const homeJsonLd = useMemo(() => buildWebsiteStructuredData({
    name: t('common.siteTitle'),
    description: t('common.siteDescription'),
    path: '/',
    searchPathTemplate: '/products?keyword={search_term_string}',
  }), [t]);
  useDocumentMeta({
    title: t('common.siteTitle'),
    description: t('common.siteDescription'),
    imageUrl: resolveDefaultSocialImageUrl() || publicAssetUrl('/logo512.png'),
    path: '/',
    type: 'website',
    siteName: t('common.siteTitle'),
    jsonLdId: 'website-home',
    jsonLd: homeJsonLd,
  });
  const getPrice = (product: Product) => product.effectivePrice ?? product.price;
  const getDiscountPercent = (product: Product) => product.effectiveDiscountPercent || product.discount || 0;
  const homeProductName = (product: Pick<Product, 'id' | 'name'>) =>
    (product.name || '').trim() || t('pages.profile.productFallback', { id: product.id });

  const openDiscountProducts = () => navigate('/products?discount=true');
  const isAuthenticated = hasStoredValue('token');
  const homeLanguageClass = `shopee-home shopee-home--${language}`;
  const openSupport = () => {
    if (!isAuthenticated) {
      const guestContext = loadGuestSupportContext();
      if (guestContext) {
        dispatchDomEvent('shop:open-support', guestContext);
        return;
      }
      dispatchDomEvent('shop:open-support');
      return;
    }
    dispatchDomEvent('shop:open-support');
  };
  const prefetchProduct = useCallback((productId: number) => {
    void productApi.prefetchById(productId);
  }, []);
  const openProduct = (productId: number) => navigate(`/products/${productId}`);
  const openCartWithSnapshot = useCallback(() => openCartDrawerWithSnapshot({ authenticated: isAuthenticated }), [isAuthenticated]);
  const guestJourneyActions = !isAuthenticated
    ? [
      {
        key: 'register',
        icon: <HomeIcon path={HI.heart} />,
        title: t('nav.register'),
        text: t('pages.auth.registerHeroSubtitle'),
        actionLabel: t('nav.register'),
        action: () => navigate('/register'),
      },
      {
        key: 'login',
        icon: <HomeIcon path={HI.check} />,
        title: t('nav.login'),
        text: t('pages.auth.loginTrustTitle'),
        actionLabel: t('nav.login'),
        action: () => navigate(buildLoginUrlFromWindow()),
      },
      {
        key: 'track',
        icon: <HomeIcon path={HI.truck} />,
        title: t('nav.trackOrder'),
        text: t('home.viewDeals'),
        actionLabel: t('nav.trackOrder'),
        action: () => navigate('/track-order'),
      },
    ]
    : [];
  const mobileQuickActions = [
    {
      key: 'orders',
      icon: <HomeIcon path={HI.file} />,
      label: t('pages.profile.allOrders'),
      onClick: () => navigate(isAuthenticated ? '/profile?tab=orders' : buildLoginUrlFromWindow()),
    },
    {
      key: 'cart',
      icon: <HomeIcon path={HI.cart} />,
      label: t('pages.cart.title'),
      onClick: openCartWithSnapshot,
    },
    {
      key: 'coupons',
      icon: <HomeIcon path={HI.gift} />,
      label: t('nav.coupons'),
      onClick: () => navigate('/coupons'),
    },
    {
      key: 'wishlist',
      icon: <HomeIcon path={HI.heart} />,
      label: t('nav.ariaFavorites'),
      onClick: () => navigate(isAuthenticated ? '/wishlist' : buildLoginUrlFromWindow()),
    },
    {
      key: 'track',
      icon: <HomeIcon path={HI.truck} />,
      label: t('nav.trackOrder'),
      onClick: () => navigate('/track-order'),
    },
    {
      key: 'support',
      icon: <HomeIcon path={HI.support} />,
      label: t('nav.help'),
      onClick: openSupport,
    },
    {
      key: 'finder',
      icon: <HomeIcon path={HI.compass} />,
      label: t('nav.petFinder'),
      onClick: () => navigate('/pet-finder'),
    },
    {
      key: 'history',
      icon: <HomeIcon path={HI.history} />,
      label: t('nav.history'),
      onClick: () => navigate('/history'),
    },
  ];

  useEffect(() => {
    if (!isAuthenticated) {
      setWishlistedProductIds(new Set());
      return;
    }
    let disposed = false;
    wishlistApi.getByUser(0)
      .then((response) => {
        if (!disposed) setWishlistedProductIds(new Set(response.data.map((item) => item.productId)));
      })
      .catch(() => {
        if (!disposed) setWishlistedProductIds(new Set());
      });
    return () => {
      disposed = true;
    };
  }, [isAuthenticated]);

  const refreshPetGallery = useCallback(async () => {
    try {
      const [photosRes, quotaRes] = await Promise.all([
        petGalleryApi.getAll(),
        isAuthenticated
          ? petGalleryApi.getQuota().catch((error) => {
            reportNonBlockingError('Home.refreshPetGalleryQuota', error);
            return null;
          })
          : Promise.resolve(null),
      ]);
      setPetGalleryPhotos(photosRes.data);
      setPetGalleryQuota(quotaRes?.data || null);
    } catch (error) {
      reportNonBlockingError('Home.refreshPetGallery', error);
      setPetGalleryPhotos([]);
      setPetGalleryQuota(null);
    }
  }, [isAuthenticated]);

  const handlePetUploadClick = () => {
    if (!isAuthenticated) {
      announceAccessibleMessage(t('messages.loginRequired'), 'warning');
      navigate(buildLoginUrlFromWindow());
      return;
    }
    if (petGalleryQuota && !petGalleryQuota.canUpload) {
      announceAccessibleMessage(t('home.petUgcLimitReached'), 'warning');
      return;
    }
    petUploadInputRef.current?.click();
  };

  const handlePetPhotoSelected: React.ChangeEventHandler<HTMLInputElement> = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const isSupportedImage = isSupportedPetGalleryImageFile(file);
    if (!isSupportedImage) {
      announceAccessibleMessage(t('home.petUgcInvalidType'), 'error');
      return;
    }
    if (file.size > PET_GALLERY_MAX_FILE_SIZE) {
      announceAccessibleMessage(t('home.petUgcTooLarge'), 'error');
      return;
    }

    setUploadingPetPhoto(true);
    try {
      const response = await petGalleryApi.upload(file);
      setPetGalleryPhotos((current) => [response.data, ...current.filter((photo) => photo.id !== response.data.id)].slice(0, 24));
      announceAccessibleMessage(t('home.petUgcUploadSuccess'), 'success');
      await refreshPetGallery();
    } catch (error) {
      announceAccessibleMessage(getApiErrorMessage(error, t('home.petUgcUploadFailed'), language), 'error');
    } finally {
      setUploadingPetPhoto(false);
    }
  };

  const handlePetGalleryLike = async (item: HomePetGalleryItem) => {
    if (!item.photo) {
      if (localPetGalleryLikes.includes(item.key)) {
        announceAccessibleMessage(t('home.petUgcAlreadyLiked'), 'info');
        return;
      }
      const nextLikes = [...localPetGalleryLikes, item.key];
      setLocalPetGalleryLikes(nextLikes);
      writeLocalPetGalleryLikes(nextLikes);
      announceAccessibleMessage(t('home.petUgcLiked'), 'success');
      return;
    }
    if (item.photo.likedByMe) {
      announceAccessibleMessage(t('home.petUgcAlreadyLiked'), 'info');
      return;
    }
    try {
      const response = await petGalleryApi.like(item.photo.id);
      setPetGalleryPhotos((current) => current.map((photo) => photo.id === response.data.id ? response.data : photo));
      announceAccessibleMessage(t('home.petUgcLiked'), 'success');
    } catch (error) {
      announceAccessibleMessage(getApiErrorMessage(error, t('home.petUgcLikeFailed'), language), 'error');
    }
  };

  const handleDeletePetPhoto = async (photo: PetGalleryPhotoPublic) => {
    try {
      await petGalleryApi.delete(photo.id);
      setPetGalleryPhotos((current) => current.filter((item) => item.id !== photo.id));
      announceAccessibleMessage(t('home.petUgcDeleted'), 'success');
      await refreshPetGallery();
    } catch (error) {
      announceAccessibleMessage(getApiErrorMessage(error, t('home.petUgcDeleteFailed'), language), 'error');
    }
  };

  const handleQuickAddToCart = async (event: React.MouseEvent | undefined, product: Product) => {
    event?.stopPropagation();
    if (product.stock !== undefined && product.stock <= 0) {
      announceAccessibleMessage(t('pages.productList.soldOut'), 'warning');
      return;
    }
    if (needsOptionSelection(product)) {
      announceAccessibleMessage(t('pages.wishlist.selectOptions'), 'info');
      openProduct(product.id);
      return;
    }

    try {
      if (isAuthenticated) {
        await cartApi.addItem(0, product.id, 1);
        dispatchDomEvent('shop:cart-updated');
      } else {
        addGuestCartItem(product, 1);
      }
      await openCartWithSnapshot();
      announceAccessibleMessage(t('messages.addCartSuccess'), 'success');
    } catch (error) {
      announceAccessibleMessage(getApiErrorMessage(error, t('messages.addFailed'), language), 'error');
    }
  };

  const handleQuickWishlist = async (event: React.MouseEvent, product: Product) => {
    event.stopPropagation();
    if (!isAuthenticated) {
      announceAccessibleMessage(t('messages.loginRequired'), 'warning');
      navigate(buildLoginUrlFromWindow());
      return;
    }

    try {
      const response = await wishlistApi.toggle(0, product.id);
      setWishlistedProductIds((current) => {
        const next = new Set(current);
        if (response.data.wishlisted) {
          next.add(product.id);
        } else {
          next.delete(product.id);
        }
        return next;
      });
      dispatchDomEvent('shop:wishlist-updated');
      announceAccessibleMessage(response.data.wishlisted ? t('pages.productDetail.favoritedMsg') : t('pages.productDetail.unfavoritedMsg'), 'success');
    } catch (error) {
      announceAccessibleMessage(getApiErrorMessage(error, t('messages.operationFailed'), language), 'error');
    }
  };

  useEffect(() => {
    const task = scheduleIdleTask(() => {
      void refreshPetGallery();
    }, 1600);
    return () => cancelIdleTask(task);
  }, [refreshPetGallery]);

  const formatViewedAt = (viewedAt?: number) => {
    if (!viewedAt) return '';
    return new Date(viewedAt).toLocaleString(language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  useEffect(() => {
    let disposed = false;
    const fetchHome = async () => {
      // Stale-while-revalidate: only blank to skeleton when nothing is paintable yet.
      if (!catalogReadyRef.current) {
        setLoading(true);
      }
      setLoadError(false);
      try {
        const [productsRes, featuredRes, categoriesRes] = await Promise.all([
          productApi.getAll(undefined, undefined, undefined, { page: 0, size: HOME_PRODUCT_PAGE_SIZE }),
          productApi.getFeatured(HOME_FEATURED_LIMIT),
          categoryApi.getTopLevel(),
        ]);
        if (disposed) return;
        const boundedCatalog = mergeProductsById(featuredRes.data, productsRes.data);
        saveProductCatalogSnapshot(boundedCatalog);
        const localizedProducts = boundedCatalog.map((product) => localizeProduct(product, language));
        const featuredProducts = featuredRes.data.map((product) => localizeProduct(product, language)).slice(0, HOME_FEATURED_LIMIT);
        setFeatured(featuredProducts.length ? featuredProducts : localizedProducts.slice(0, HOME_FEATURED_LIMIT));
        setProducts(localizedProducts);
        setCategories(categoriesRes.data);
        setVisibleCount(DISCOVERY_BATCH_SIZE);
        setUsingCatalogSnapshot(false);
        setLoadError(false);
        catalogReadyRef.current = true;
      } catch (error) {
        reportNonBlockingError('Home.fetchHome', error);
        if (disposed) return;
        const fallbackSourceProducts = loadProductCatalogSnapshot()?.products || loadFallbackProductCatalog();
        const fallbackProducts = fallbackSourceProducts.map((product) => localizeProduct(product, language));
        if (fallbackProducts.length > 0) {
          // Keep already-painted bootstrap content when possible; only replace if empty or hard failure.
          if (!catalogReadyRef.current) {
            const featuredFallback = fallbackProducts.filter((product) => product.isFeatured).slice(0, HOME_FEATURED_LIMIT);
            setFeatured(featuredFallback.length ? featuredFallback : fallbackProducts.slice(0, HOME_FEATURED_LIMIT));
            setProducts(fallbackProducts);
            setCategories(buildProductCatalogFallbackCategories(fallbackSourceProducts));
            setVisibleCount(DISCOVERY_BATCH_SIZE);
          }
          setLoadError(false);
          setUsingCatalogSnapshot(true);
          catalogReadyRef.current = true;
          return;
        }
        if (!catalogReadyRef.current) {
          setLoadError(true);
          setFeatured([]);
          setProducts([]);
          setCategories([]);
        }
      } finally {
        if (!disposed) setLoading(false);
      }
    };

    fetchHome();
    return () => {
      disposed = true;
    };
  }, [language, t]);

  useEffect(() => {
    let disposed = false;
    const fetchPersonalizedProducts = async () => {
      if (!isAuthenticated) {
        setPersonalizedProducts([]);
        return;
      }
      try {
        const response = await productApi.getPersonalizedRecommendations();
        if (!disposed) setPersonalizedProducts(response.data.map((product) => localizeProduct(product, language)));
      } catch (error) {
        reportNonBlockingError('Home.fetchPersonalizedProducts', error);
        if (!disposed) setPersonalizedProducts([]);
      }
    };

    if (!isAuthenticated) {
      setPersonalizedProducts([]);
      return;
    }
    const task = scheduleIdleTask(fetchPersonalizedProducts, 1500);
    return () => {
      disposed = true;
      cancelIdleTask(task);
    };
  }, [isAuthenticated, language]);

  useEffect(() => {
    const handlePreferencesUpdated = (event?: Event) => {
      if (event instanceof StorageEvent && event.key && event.key !== PRODUCT_VIEW_PREFERENCES_KEY) return;
      setViewPreferences(loadProductViewPreferences());
    };
    window.addEventListener('shop:product-view-preferences-updated', handlePreferencesUpdated);
    window.addEventListener('storage', handlePreferencesUpdated);
    return () => {
      window.removeEventListener('shop:product-view-preferences-updated', handlePreferencesUpdated);
      window.removeEventListener('storage', handlePreferencesUpdated);
    };
  }, []);

  useEffect(() => {
    if (viewPreferences.recent.length === 0) {
      setRecentlyViewedDetails([]);
      setRecentlyViewedHydrated(true);
      return;
    }
    let disposed = false;
    setRecentlyViewedHydrated(false);
    const recentProductIds = viewPreferences.recent.slice(0, 8);
    const task = scheduleIdleTask(() => {
      productApi.getByIds(recentProductIds)
        .then((response) => {
          if (!disposed) {
            setRecentlyViewedDetails(response.data.map((product) => localizeProduct(product, language)));
            setRecentlyViewedHydrated(true);
          }
        })
        .catch((error) => {
          reportNonBlockingError('Home.fetchRecentlyViewedDetails', error);
          if (!disposed) {
            setRecentlyViewedDetails([]);
            setRecentlyViewedHydrated(true);
          }
        });
    }, 1900);
    return () => {
      disposed = true;
      cancelIdleTask(task);
    };
  }, [language, viewPreferences.recent]);

  const promoProducts = useMemo(
    () =>
      products
        .filter((product) =>
          product.activeLimitedTimeDiscount ||
          getDiscountPercent(product) > 0 ||
          product.tag === 'discount' ||
          (product.originalPrice !== undefined && product.originalPrice > getPrice(product))
        )
        .slice(0, 6),
    [products],
  );

  const bestSellers = useMemo(
    () =>
      [...products]
        .sort((left, right) => (right.reviewCount || 0) - (left.reviewCount || 0) || (right.positiveRate || 0) - (left.positiveRate || 0))
        .slice(0, 8),
    [products],
  );

  const recentlyViewedProducts = useMemo(() => {
    const productById = new Map(recentlyViewedDetails.map((product) => [product.id, product]));
    const viewedAtById = new Map(viewPreferences.recentEntries.map((entry) => [entry.productId, entry.viewedAt]));
    return viewPreferences.recent
      .map((productId: number) => {
        const product = productById.get(productId);
        return product ? { product, viewedAt: viewedAtById.get(productId) } : undefined;
      })
      .filter(Boolean)
      .slice(0, 8) as Array<{ product: Product; viewedAt?: number }>;
  }, [recentlyViewedDetails, viewPreferences]);

  // Reserve rail space while history ids exist but product payloads are still hydrating (CLS).
  const recentlyViewedPending = !loading && viewPreferences.recent.length > 0 && !recentlyViewedHydrated;

  const discoveryProducts = useMemo(() => {
    const merged = [...featured, ...products];
    const uniqueProducts = Array.from(new Map(merged.map((product) => [product.id, product])).values());
    const recentSet = new Set(viewPreferences.recent);
    return uniqueProducts
      .map((product, index) => ({
        product,
        index,
        score:
          (viewPreferences.categories[String(product.categoryId)] || 0) * 8 +
          (product.brand ? (viewPreferences.brands[String(product.brand)] || 0) * 4 : 0) +
          (product.tag ? (viewPreferences.tags[String(product.tag)] || 0) * 3 : 0) +
          (recentSet.has(product.id) ? 2 : 0) +
          (product.isFeatured ? 1 : 0),
      }))
      .sort((left, right) => right.score - left.score || left.index - right.index)
      .map((entry) => entry.product);
  }, [featured, products, viewPreferences]);

  const localPersonalizedProducts = useMemo(() => {
    const recentSet = new Set(viewPreferences.recent);
    return products
      .map((product, index) => ({
        product,
        index,
        score:
          (viewPreferences.categories[String(product.categoryId)] || 0) * 8 +
          (product.brand ? (viewPreferences.brands[String(product.brand)] || 0) * 4 : 0) +
          (product.tag ? (viewPreferences.tags[String(product.tag)] || 0) * 3 : 0) +
          (getDiscountPercent(product) > 0 ? 1 : 0),
      }))
      .filter((entry) => entry.score > 0 && !recentSet.has(entry.product.id))
      .sort((left, right) => right.score - left.score || left.index - right.index)
      .map((entry) => entry.product)
      .slice(0, 8);
  }, [products, viewPreferences]);

  const personalizedDisplayProducts = useMemo(
    () => (personalizedProducts.length > 0 ? personalizedProducts : localPersonalizedProducts),
    [localPersonalizedProducts, personalizedProducts],
  );
  const personalizedRecommendationSource = personalizedProducts.length > 0 ? 'petProfile' : 'recentViews';
  const personalizedReadyProducts = useMemo(
    () =>
      personalizedDisplayProducts
        .filter((product) => !needsOptionSelection(product) && (product.stock === undefined || product.stock > 0))
        .slice(0, 4),
    [personalizedDisplayProducts],
  );
  const personalizedReadyCount = personalizedReadyProducts.length;
  const personalizedDealCount = useMemo(
    () => personalizedDisplayProducts.filter((product) => getDiscountPercent(product) > 0 || product.activeLimitedTimeDiscount).length,
    [personalizedDisplayProducts],
  );
  const personalizedPreferenceLabel = useMemo(() => {
    const topCategory = Object.entries(viewPreferences.categories).sort((left, right) => right[1] - left[1])[0];
    if (topCategory) {
      const category = categories.find((item) => String(item.id) === topCategory[0]);
      if (category) return getLocalizedCategoryValue(category, language, 'name');
    }
    const topBrand = Object.entries(viewPreferences.brands).sort((left, right) => right[1] - left[1])[0];
    if (topBrand) return topBrand[0];
    const topTag = Object.entries(viewPreferences.tags).sort((left, right) => right[1] - left[1])[0];
    return topTag?.[0] || '';
  }, [categories, language, viewPreferences]);

  const visibleDiscoveryProducts = useMemo(
    () => discoveryProducts.slice(0, visibleCount),
    [discoveryProducts, visibleCount],
  );
  const hasMoreDiscoveryProducts = visibleCount < discoveryProducts.length;

  useEffect(() => {
    let frameId: number | null = null;
    const updateVisibleCount = () => {
      frameId = null;
      const { scrollHeight, viewportHeight, scrollTop } = getAppScrollMetrics();
      const distanceToBottom = scrollHeight - viewportHeight - scrollTop;
      if (distanceToBottom < 420) {
        setVisibleCount((count) => Math.min(count + DISCOVERY_BATCH_SIZE, discoveryProducts.length));
      }
    };
    const handleScroll = () => {
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(updateVisibleCount);
    };
    const removeScrollListener = addAppScrollListener(handleScroll, { passive: true });
    updateVisibleCount();
    return () => {
      removeScrollListener();
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [discoveryProducts.length]);

  const displayCategoryRoots = useMemo(() => getDisplayCategoryRoots(categories), [categories]);
  const categoryTiles = useMemo(() => displayCategoryRoots.slice(0, 8), [displayCategoryRoots]);
  const heroCategoryTiles = useMemo(() => categoryTiles.slice(0, 4), [categoryTiles]);
  const petUploadRemaining = petGalleryQuota ? Math.max(0, petGalleryQuota.remaining) : 3;
  const petUploadButtonLabel = uploadingPetPhoto
    ? t('home.petUgcUploading')
    : !isAuthenticated
      ? t('home.petUgcLoginToUpload')
      : t('home.petUgcUploadRemaining', { count: petUploadRemaining });
  const petGalleryItems = useMemo<HomePetGalleryItem[]>(() => {
    const photoItems = petGalleryPhotos.map((photo) => {
      return {
        key: `photo-${photo.id}`,
        image: resolvePetGalleryImage(photo.imageUrl),
        label: `@${photo.username || 'pet_parent'}`,
        likeCount: photo.likeCount || 0,
        likedByMe: Boolean(photo.likedByMe),
        canDelete: Boolean(photo.canDelete),
        photo,
      };
    });
    const existingImages = new Set(photoItems.map((item) => item.image));
    const existingLabels = new Set(photoItems.map((item) => item.label.toLowerCase()));
    const fallbackItems = ugcImages
      .filter((item) => !existingImages.has(item.image) && !existingLabels.has(item.label.toLowerCase()))
      .map((item) => ({
        ...item,
        likeCount: item.likeCount + (localPetGalleryLikes.includes(item.key) ? 1 : 0),
        likedByMe: localPetGalleryLikes.includes(item.key),
        canDelete: false,
      }));
    return [...photoItems, ...fallbackItems]
      .sort((left, right) => right.likeCount - left.likeCount || left.label.localeCompare(right.label))
      .slice(0, 24);
  }, [localPetGalleryLikes, petGalleryPhotos]);
  const addPersonalizedReadyProducts = async () => {
    if (personalizedReadyProducts.length === 0) {
      announceAccessibleMessage(t('pages.compare.recommendationEmpty'), 'info');
      return;
    }
    try {
      if (isAuthenticated) {
        const results = await allSettledWithConcurrency(
          personalizedReadyProducts,
          (product) => cartApi.addItem(0, product.id, 1),
        );
        const added = results.filter((result) => result.status === 'fulfilled').length;
        if (added === 0) {
          announceAccessibleMessage(t('messages.addFailed'), 'error');
          return;
        }
        dispatchDomEvent('shop:cart-updated');
        await openCartWithSnapshot();
        announceAccessibleMessage(t('pages.wishlist.addedAllToCart', { count: added }), 'success');
      } else {
        personalizedReadyProducts.forEach((product) => addGuestCartItem(product, 1));
        await openCartWithSnapshot();
        announceAccessibleMessage(t('pages.wishlist.addedAllToCart', { count: personalizedReadyProducts.length }), 'success');
      }
    } catch (error) {
      announceAccessibleMessage(getApiErrorMessage(error, t('messages.addFailed'), language), 'error');
    }
  };
  const heroSpotlights = [
    {
      key: 'recommendations',
      icon: <HomeIcon path={HI.compass} />,
      title: t('home.petRecommendations'),
      summary: personalizedRecommendationSource === 'petProfile'
        ? t('home.petRecommendationReady', { count: personalizedReadyCount })
        : personalizedPreferenceLabel
          ? t('home.petRecommendationInsightPreference', { value: personalizedPreferenceLabel })
          : t('home.petRecommendationsHint'),
      actionLabel: personalizedDisplayProducts.length > 0 ? t('pages.wishlist.addAllToCart') : t('home.managePetProfiles'),
      action: personalizedDisplayProducts.length > 0 ? addPersonalizedReadyProducts : () => navigate('/profile?tab=pets'),
      disabled: personalizedDisplayProducts.length > 0 && personalizedReadyProducts.length === 0,
    },
    {
      key: 'deals',
      icon: <HomeIcon path={HI.fire} />,
      title: t('home.flashOffers'),
      summary: t('home.petRecommendationDeals', { count: personalizedDealCount || promoProducts.length }),
      actionLabel: t('home.viewDeals'),
      action: openDiscountProducts,
      disabled: false,
    },
    {
      key: 'catalog',
      icon: <HomeIcon path={HI.appstore} />,
      title: t('home.categories'),
      summary: heroCategoryTiles.map((category) => getLocalizedCategoryValue(category, language, 'name')).join(' / '),
      actionLabel: t('home.viewAll'),
      action: () => navigate('/products'),
      disabled: false,
    },
  ];
  const heroFeaturedProduct = personalizedDisplayProducts[0] || bestSellers[0] || promoProducts[0] || featured[0] || products[0] || null;
  const heroFeaturedProductName = heroFeaturedProduct ? homeProductName(heroFeaturedProduct) : '';
  const heroFeaturedTag = heroFeaturedProduct
    ? [
      heroFeaturedProduct.brand,
      getDiscountPercent(heroFeaturedProduct) > 0 ? t('home.flashOffers') : '',
      heroFeaturedProduct.stock !== undefined && heroFeaturedProduct.stock > 0
        ? t('home.stockAvailable', { count: heroFeaturedProduct.stock })
        : '',
    ].filter(Boolean).join(' / ')
    : '';
  const conversionHighlights = [
    {
      key: 'deals',
      value: `${promoProducts.length || bestSellers.length}+`,
      label: t('home.flashOffers'),
    },
    {
      key: 'personalized',
      value: `${personalizedReadyCount}`,
      label: t('home.petRecommendationReady', { count: personalizedReadyCount }),
    },
    {
      key: 'community',
      value: `${petGalleryItems.length}+`,
      label: t('home.petUgcTitle'),
    },
  ];
  const curatedStoryCards = [
    {
      key: 'starter',
      icon: <HomeIcon path={HI.gift} />,
      title: t('home.couponsExtra'),
      summary: `${promoProducts.length || bestSellers.length} ${t('home.flashOffers').toLowerCase()}`,
      actionLabel: t('home.viewDeals'),
      action: openDiscountProducts,
    },
    {
      key: 'routine',
      icon: <HomeIcon path={HI.truck} />,
      title: t('home.trust.freeShipping', { amount: formatPrice(market.freeShippingThreshold) }),
      summary: t('home.trust.fastDispatch'),
      actionLabel: t('home.shopAll'),
      action: () => navigate('/products'),
    },
    {
      key: 'ugc',
      icon: <HomeIcon path={HI.camera} />,
      title: t('home.petUgcTitle'),
      summary: t('home.petUgcStoriesSummary', { count: petGalleryItems.length }),
      actionLabel: t('nav.petGallery'),
      action: () => navigate('/pet-gallery'),
    },
  ];
  const productCardCommonProps = {
    t,
    formatPrice,
    formatViewedAt,
    prefetchProduct,
    openProduct,
    handleQuickAddToCart,
    handleQuickWishlist,
    wishlistedProductIds,
  };

  if (loading) {
    return <HomeLoadingShell homeLanguageClass={homeLanguageClass} t={t} />;
  }

  if (loadError) {
    return <HomeLoadRecoveryShell homeLanguageClass={homeLanguageClass} navigate={navigate} t={t} />;
  }

  const petGalleryActionLabel = homeSectionActionLabel(t('home.petUgcTitle'), t('nav.petGallery'), petGalleryItems.length);

  return (
    <main className={homeLanguageClass}>
      <HomeHeroSection
        bestSellersCount={bestSellers.length}
        displayCategoryRootsCount={displayCategoryRoots.length}
        formatPrice={formatPrice}
        freeShippingThreshold={market.freeShippingThreshold}
        heroCategoryTiles={heroCategoryTiles}
        heroFeaturedProduct={heroFeaturedProduct}
        heroFeaturedProductName={heroFeaturedProductName}
        heroFeaturedTag={heroFeaturedTag}
        heroSpotlights={heroSpotlights}
        isAuthenticated={isAuthenticated}
        language={language}
        navigate={navigate}
        onQuickAdd={handleQuickAddToCart}
        onOpenProduct={openProduct}
        onPrefetchProduct={prefetchProduct}
        promoProductsCount={promoProducts.length}
        t={t}
      />

      <HomeMobileQuickPanel actions={mobileQuickActions} t={t} />

      <div className="shopee-container">
        <HomeTrustStrip
          formatPrice={formatPrice}
          freeShippingThreshold={market.freeShippingThreshold}
          t={t}
        />

        <HomeConversionActionsSection
          conversionHighlights={conversionHighlights}
          guestJourneyActions={guestJourneyActions}
          isAuthenticated={isAuthenticated}
          navigate={navigate}
          onOpenDiscountProducts={openDiscountProducts}
          t={t}
          usingCatalogSnapshot={usingCatalogSnapshot}
        />

        <HomeStoryGrid cards={curatedStoryCards} t={t} />

        <HomeBestSellersSection
          bestSellers={bestSellers}
          navigate={navigate}
          productCardCommonProps={productCardCommonProps}
          t={t}
        />

        <HomeEditorialBand
          bestSellers={bestSellers}
          formatPrice={formatPrice}
          navigate={navigate}
          onOpenProduct={openProduct}
          onQuickAdd={handleQuickAddToCart}
          t={t}
        />

        <HomePersonalizedProductsSection
          navigate={navigate}
          onAddPersonalizedReady={addPersonalizedReadyProducts}
          personalizedDealCount={personalizedDealCount}
          personalizedDisplayProducts={personalizedDisplayProducts}
          personalizedPreferenceLabel={personalizedPreferenceLabel}
          personalizedReadyCount={personalizedReadyCount}
          personalizedReadyProducts={personalizedReadyProducts}
          personalizedRecommendationSource={personalizedRecommendationSource}
          productCardCommonProps={productCardCommonProps}
          t={t}
        />

        <HomeCategoriesSection
          categoryTiles={categoryTiles}
          language={language}
          navigate={navigate}
          t={t}
        />

        <HomeRecentlyViewedSection
          navigate={navigate}
          onClearRecentlyViewed={() => {
            if (!window.confirm(t('home.clearRecentlyViewedConfirm'))) return;
            clearProductViewHistory();
            setViewPreferences(loadProductViewPreferences());
          }}
          productCardCommonProps={productCardCommonProps}
          recentlyViewedPending={recentlyViewedPending}
          recentlyViewedProducts={recentlyViewedProducts}
          t={t}
        />

        <HomeFlashOffersSection
          onOpenDiscountProducts={openDiscountProducts}
          productCardCommonProps={productCardCommonProps}
          promoProducts={promoProducts}
          t={t}
        />

        <HomeDiscoverySection
          discoveryProducts={discoveryProducts}
          hasMoreDiscoveryProducts={hasMoreDiscoveryProducts}
          navigate={navigate}
          onLoadMore={() => setVisibleCount((count) => Math.min(count + DISCOVERY_BATCH_SIZE, discoveryProducts.length))}
          productCardCommonProps={productCardCommonProps}
          t={t}
          visibleDiscoveryProducts={visibleDiscoveryProducts}
        />

        <React.Suspense fallback={null}>
          <LazyHomePetGallery
            t={t}
            items={petGalleryItems}
            previewItem={petPreviewItem}
            uploadInputRef={petUploadInputRef}
            uploadButtonLabel={petUploadButtonLabel}
            uploading={uploadingPetPhoto}
            uploadDisabled={Boolean(petGalleryQuota && !petGalleryQuota.canUpload)}
            galleryActionLabel={petGalleryActionLabel}
            onUploadClick={handlePetUploadClick}
            onPhotoSelected={handlePetPhotoSelected}
            onOpenGallery={() => navigate('/pet-gallery')}
            onPreviewItem={setPetPreviewItem}
            onClosePreview={() => setPetPreviewItem(null)}
            onLike={handlePetGalleryLike}
            onDeletePhoto={handleDeletePetPhoto}
          />
        </React.Suspense>
      </div>
      <React.Suspense fallback={null}>
        <LazySocialProofToast />
      </React.Suspense>
    </main>
  );
};

export default Home;
