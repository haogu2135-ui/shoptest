import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Col, Empty, Popconfirm, Row, Spin, Typography, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  AppstoreOutlined,
  CameraOutlined,
  CheckCircleOutlined,
  CompassOutlined,
  CustomerServiceOutlined,
  FileDoneOutlined,
  FireOutlined,
  GiftOutlined,
  HeartOutlined,
  HistoryOutlined,
  MobileOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  ShoppingOutlined,
  SafetyCertificateOutlined,
  StarFilled,
  TruckOutlined,
} from '@ant-design/icons';
import { cartApi, categoryApi, petGalleryApi, productApi, wishlistApi } from '../api';
import { useLanguage } from '../i18n';
import type { CategoryPublic, PetGalleryPhotoPublic, PetGalleryQuota, ProductPublic as Product } from '../types';
import { useMarket } from '../hooks/useMarket';
import { localizeProduct } from '../utils/localizedProduct';
import { getDisplayCategoryRoots, getLocalizedCategoryValue } from '../utils/categoryTree';
import { clearProductViewHistory, loadProductViewPreferences, PRODUCT_VIEW_PREFERENCES_KEY } from '../utils/productViewPreferences';
import { addGuestCartItem } from '../utils/guestCart';
import { needsOptionSelection } from '../utils/productOptions';
import { buildResponsiveImageSrcSet, getOptimizedImageUrl, imageFallbacks, resolveApiAssetUrl } from '../utils/mediaAssets';
import { getApiErrorMessage } from '../utils/apiError';
import { buildLoginUrlFromWindow } from '../utils/authRedirect';
import { dispatchDomEvent } from '../utils/domEvents';
import { loadGuestSupportContext } from '../utils/guestSupportContext';
import { addAppScrollListener, getAppScrollMetrics } from '../utils/nativeScroll';
import { getLocalStorageItem, hasStoredValue, setLocalStorageItem } from '../utils/safeStorage';
import { cancelIdleTask, scheduleIdleTask } from '../utils/idleScheduler';
import { openCartDrawerWithSnapshot } from '../utils/cartDrawer';
import { allSettledWithConcurrency } from '../utils/asyncBatch';
import { buildProductCatalogFallbackCategories, loadFallbackProductCatalog, loadProductCatalogSnapshot, saveProductCatalogSnapshot } from '../utils/productCatalogSnapshot';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import { isSupportedPetGalleryImageFile } from '../utils/petGalleryUpload';
import HomePetGallery, { type HomePetGalleryItem } from '../components/HomePetGallery';
import HomeProductCard from '../components/HomeProductCard';
import SocialProofToast from '../components/SocialProofToast';
import { HeroSkeleton, ProductCardSkeleton, StatsStripSkeleton } from '../components/SkeletonLoader';
import './Home.css';
import '../styles/mobile-page-contrast.css';

const { Text } = Typography;
const DISCOVERY_BATCH_SIZE = 12;
const HOME_FEATURED_LIMIT = 12;
const HOME_PRODUCT_PAGE_SIZE = 48;
const PET_GALLERY_MAX_FILE_SIZE = 5 * 1024 * 1024;
const PET_GALLERY_LOCAL_LIKES_KEY = 'shop-pet-gallery-local-likes';

const categoryImageFallback = imageFallbacks.category;
const petGalleryImageFallback = imageFallbacks.media;

const mergeProductsById = (...groups: Product[][]) => {
  const productsById = new Map<number, Product>();
  groups.flat().forEach((product) => {
    if (Number.isSafeInteger(product.id) && !productsById.has(product.id)) {
      productsById.set(product.id, product);
    }
  });
  return Array.from(productsById.values());
};

const ugcImages = [
  { key: 'happy_pet_1', image: 'https://images.unsplash.com/photo-1537151672256-6caf2e9f8c95?auto=format&fit=crop&w=700&q=80', label: '@happy_pet_1', likeCount: 42 },
  { key: 'cozy_paws', image: 'https://images.unsplash.com/photo-1568572933382-74d440642117?auto=format&fit=crop&w=700&q=80', label: '@cozy_paws', likeCount: 36 },
  { key: 'cat_window_club', image: 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&w=700&q=80', label: '@cat_window_club', likeCount: 31 },
  { key: 'weekend_walks', image: 'https://images.unsplash.com/photo-1583512603805-3cc6b41f3edb?auto=format&fit=crop&w=700&q=80', label: '@weekend_walks', likeCount: 27 },
  { key: 'tailwag_home', image: 'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=700&q=80', label: '@tailwag_home', likeCount: 22 },
  { key: 'softnap_cat', image: 'https://images.unsplash.com/photo-1596854407944-bf87f6fdd49e?auto=format&fit=crop&w=700&q=80', label: '@softnap_cat', likeCount: 19 },
];

const readLocalPetGalleryLikes = () => {
  try {
    const parsed = JSON.parse(getLocalStorageItem(PET_GALLERY_LOCAL_LIKES_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch (error) {
    reportNonBlockingError('Home.readLocalPetGalleryLikes', error);
    return [];
  }
};

const writeLocalPetGalleryLikes = (keys: string[]) => {
  setLocalStorageItem(PET_GALLERY_LOCAL_LIKES_KEY, JSON.stringify(Array.from(new Set(keys))));
};

const resolveAssetImage = (imageUrl: string, fallback = '') => resolveApiAssetUrl(imageUrl, fallback);

const resolvePetGalleryImage = (imageUrl: string) => {
  if (!imageUrl) return petGalleryImageFallback;
  return resolveAssetImage(imageUrl, petGalleryImageFallback) || petGalleryImageFallback;
};

const applyHomeImageFallback = (event: React.SyntheticEvent<HTMLImageElement>, fallback: string) => {
  if (event.currentTarget.src !== fallback) {
    event.currentTarget.removeAttribute('srcset');
    event.currentTarget.src = fallback;
  }
};

const Home: React.FC = () => {
  const [featured, setFeatured] = useState<Product[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [personalizedProducts, setPersonalizedProducts] = useState<Product[]>([]);
  const [recentlyViewedDetails, setRecentlyViewedDetails] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CategoryPublic[]>([]);
  const [loading, setLoading] = useState(true);
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
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { formatMoney: formatPrice, market } = useMarket();
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
        icon: <HeartOutlined />,
        title: t('nav.register'),
        text: t('pages.auth.registerHeroSubtitle'),
        actionLabel: t('nav.register'),
        action: () => navigate('/register'),
      },
      {
        key: 'login',
        icon: <CheckCircleOutlined />,
        title: t('nav.login'),
        text: t('pages.auth.loginTrustTitle'),
        actionLabel: t('nav.login'),
        action: () => navigate(buildLoginUrlFromWindow()),
      },
      {
        key: 'track',
        icon: <TruckOutlined />,
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
      icon: <FileDoneOutlined />,
      label: t('pages.profile.allOrders'),
      onClick: () => navigate(isAuthenticated ? '/profile?tab=orders' : buildLoginUrlFromWindow()),
    },
    {
      key: 'cart',
      icon: <ShoppingCartOutlined />,
      label: t('pages.cart.title'),
      onClick: openCartWithSnapshot,
    },
    {
      key: 'coupons',
      icon: <GiftOutlined />,
      label: t('nav.coupons'),
      onClick: () => navigate('/coupons'),
    },
    {
      key: 'wishlist',
      icon: <HeartOutlined />,
      label: t('nav.ariaFavorites'),
      onClick: () => navigate(isAuthenticated ? '/wishlist' : buildLoginUrlFromWindow()),
    },
    {
      key: 'track',
      icon: <TruckOutlined />,
      label: t('nav.trackOrder'),
      onClick: () => navigate('/track-order'),
    },
    {
      key: 'support',
      icon: <CustomerServiceOutlined />,
      label: t('nav.help'),
      onClick: openSupport,
    },
    {
      key: 'finder',
      icon: <CompassOutlined />,
      label: t('nav.petFinder'),
      onClick: () => navigate('/pet-finder'),
    },
    {
      key: 'history',
      icon: <HistoryOutlined />,
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
      message.warning(t('messages.loginRequired'));
      navigate(buildLoginUrlFromWindow());
      return;
    }
    if (petGalleryQuota && !petGalleryQuota.canUpload) {
      message.warning(t('home.petUgcLimitReached'));
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
      message.error(t('home.petUgcInvalidType'));
      return;
    }
    if (file.size > PET_GALLERY_MAX_FILE_SIZE) {
      message.error(t('home.petUgcTooLarge'));
      return;
    }

    setUploadingPetPhoto(true);
    try {
      const response = await petGalleryApi.upload(file);
      setPetGalleryPhotos((current) => [response.data, ...current.filter((photo) => photo.id !== response.data.id)].slice(0, 24));
      message.success(t('home.petUgcUploadSuccess'));
      await refreshPetGallery();
    } catch (error) {
      message.error(getApiErrorMessage(error, t('home.petUgcUploadFailed'), language));
    } finally {
      setUploadingPetPhoto(false);
    }
  };

  const handlePetGalleryLike = async (item: HomePetGalleryItem) => {
    if (!item.photo) {
      if (localPetGalleryLikes.includes(item.key)) {
        message.info(t('home.petUgcAlreadyLiked'));
        return;
      }
      const nextLikes = [...localPetGalleryLikes, item.key];
      setLocalPetGalleryLikes(nextLikes);
      writeLocalPetGalleryLikes(nextLikes);
      message.success(t('home.petUgcLiked'));
      return;
    }
    if (item.photo.likedByMe) {
      message.info(t('home.petUgcAlreadyLiked'));
      return;
    }
    try {
      const response = await petGalleryApi.like(item.photo.id);
      setPetGalleryPhotos((current) => current.map((photo) => photo.id === response.data.id ? response.data : photo));
      message.success(t('home.petUgcLiked'));
    } catch (error) {
      message.error(getApiErrorMessage(error, t('home.petUgcLikeFailed'), language));
    }
  };

  const handleDeletePetPhoto = async (photo: PetGalleryPhotoPublic) => {
    try {
      await petGalleryApi.delete(photo.id);
      setPetGalleryPhotos((current) => current.filter((item) => item.id !== photo.id));
      message.success(t('home.petUgcDeleted'));
      await refreshPetGallery();
    } catch (error) {
      message.error(getApiErrorMessage(error, t('home.petUgcDeleteFailed'), language));
    }
  };

  const handleQuickAddToCart = async (event: React.MouseEvent | undefined, product: Product) => {
    event?.stopPropagation();
    if (product.stock !== undefined && product.stock <= 0) {
      message.warning(t('pages.productList.soldOut'));
      return;
    }
    if (needsOptionSelection(product)) {
      message.info(t('pages.wishlist.selectOptions'));
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
      message.success(t('messages.addCartSuccess'));
    } catch (error) {
      message.error(getApiErrorMessage(error, t('messages.addFailed'), language));
    }
  };

  const handleQuickWishlist = async (event: React.MouseEvent, product: Product) => {
    event.stopPropagation();
    if (!isAuthenticated) {
      message.warning(t('messages.loginRequired'));
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
      message.success(response.data.wishlisted ? t('pages.productDetail.favoritedMsg') : t('pages.productDetail.unfavoritedMsg'));
    } catch (error) {
      message.error(getApiErrorMessage(error, t('messages.operationFailed'), language));
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
      setLoading(true);
      setLoadError(false);
      setUsingCatalogSnapshot(false);
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
        setFeatured(featuredRes.data.map((product) => localizeProduct(product, language)).slice(0, HOME_FEATURED_LIMIT));
        setProducts(localizedProducts);
        setCategories(categoriesRes.data);
        setVisibleCount(DISCOVERY_BATCH_SIZE);
      } catch (error) {
        reportNonBlockingError('Home.fetchHome', error);
        if (disposed) return;
        const fallbackSourceProducts = loadProductCatalogSnapshot()?.products || loadFallbackProductCatalog();
        const fallbackProducts = fallbackSourceProducts.map((product) => localizeProduct(product, language));
        if (fallbackProducts.length > 0) {
          setFeatured(fallbackProducts.filter((product) => product.isFeatured).slice(0, HOME_FEATURED_LIMIT));
          setProducts(fallbackProducts);
          setCategories(buildProductCatalogFallbackCategories(fallbackSourceProducts));
          setVisibleCount(DISCOVERY_BATCH_SIZE);
          setLoadError(false);
          setUsingCatalogSnapshot(true);
          return;
        }
        setLoadError(true);
        setFeatured([]);
        setProducts([]);
        setCategories([]);
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
      return;
    }
    let disposed = false;
    const recentProductIds = viewPreferences.recent.slice(0, 8);
    const task = scheduleIdleTask(() => {
      productApi.getByIds(recentProductIds)
        .then((response) => {
          if (!disposed) setRecentlyViewedDetails(response.data.map((product) => localizeProduct(product, language)));
        })
        .catch((error) => {
          reportNonBlockingError('Home.fetchRecentlyViewedDetails', error);
          if (!disposed) setRecentlyViewedDetails([]);
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
      message.info(t('pages.compare.recommendationEmpty'));
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
          message.error(t('messages.addFailed'));
          return;
        }
        dispatchDomEvent('shop:cart-updated');
        await openCartWithSnapshot();
        message.success(t('pages.wishlist.addedAllToCart', { count: added }));
      } else {
        personalizedReadyProducts.forEach((product) => addGuestCartItem(product, 1));
        await openCartWithSnapshot();
        message.success(t('pages.wishlist.addedAllToCart', { count: personalizedReadyProducts.length }));
      }
    } catch (error) {
      message.error(getApiErrorMessage(error, t('messages.addFailed'), language));
    }
  };
  const heroSpotlights = [
    {
      key: 'recommendations',
      icon: <CompassOutlined />,
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
      icon: <FireOutlined />,
      title: t('home.flashOffers'),
      summary: t('home.petRecommendationDeals', { count: personalizedDealCount || promoProducts.length }),
      actionLabel: t('home.viewDeals'),
      action: openDiscountProducts,
      disabled: false,
    },
    {
      key: 'catalog',
      icon: <AppstoreOutlined />,
      title: t('home.categories'),
      summary: heroCategoryTiles.map((category) => getLocalizedCategoryValue(category, language, 'name')).join(' / '),
      actionLabel: t('home.viewAll'),
      action: () => navigate('/products'),
      disabled: false,
    },
  ];
  const heroFeaturedProduct = personalizedDisplayProducts[0] || bestSellers[0] || promoProducts[0] || featured[0] || products[0] || null;
  const heroFeaturedProductName = heroFeaturedProduct ? homeProductName(heroFeaturedProduct) : '';
  const editorialFeatureProduct = bestSellers[0] || null;
  const editorialFeatureName = editorialFeatureProduct ? homeProductName(editorialFeatureProduct) : '';
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
      icon: <GiftOutlined />,
      title: t('home.couponsExtra'),
      summary: `${promoProducts.length || bestSellers.length} ${t('home.flashOffers').toLowerCase()}`,
      actionLabel: t('home.viewDeals'),
      action: openDiscountProducts,
    },
    {
      key: 'routine',
      icon: <TruckOutlined />,
      title: t('home.trust.freeShipping', { amount: formatPrice(market.freeShippingThreshold) }),
      summary: t('home.trust.fastDispatch'),
      actionLabel: t('home.shopAll'),
      action: () => navigate('/products'),
    },
    {
      key: 'ugc',
      icon: <CameraOutlined />,
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
    return (
      <main className={homeLanguageClass} aria-busy="true">
        <div role="status" aria-live="polite" aria-busy="true" aria-label={t('common.loading')}>
          <section className="shopee-hero">
            <div className="shopee-container shopee-hero__grid">
              <HeroSkeleton />
              <div className="shopee-hero__aside" aria-hidden="true">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="shopee-hero__asideSkeleton shimmer" />
                ))}
              </div>
            </div>
          </section>
          <div className="shopee-container">
            <StatsStripSkeleton />
            <div className="shopee-loading-products">
              <ProductCardSkeleton count={8} />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className={homeLanguageClass}>
        <div className="shopee-container" style={{ padding: '80px 24px', textAlign: 'center' }}>
          <Alert
            type="error"
            showIcon
            message={t('messages.loadFailed')}
            description={t('messages.loadFailedRetry')}
            style={{ maxWidth: 480, margin: '0 auto 24px' }}
            action={
              <Button type="primary" onClick={() => window.location.reload()}>
                {t('messages.retry')}
              </Button>
            }
          />
        </div>
      </main>
    );
  }

  const homeSectionActionLabel = (section: string, action: string, detail?: string | number) => (
    detail !== undefined && String(detail).trim()
      ? `${section}: ${action}, ${detail}`
      : `${section}: ${action}`
  );
  const clearRecentlyViewedActionLabel = `${t('home.clearRecentlyViewed')}: ${recentlyViewedProducts.length}`;
  const bestSellersShopAllLabel = homeSectionActionLabel(t('home.bestSellers'), t('home.shopAll'), bestSellers.length);
  const recommendationsMoreProductsLabel = homeSectionActionLabel(t('home.petRecommendations'), t('home.moreProducts'), bestSellers.length);
  const managePetProfilesActionLabel = homeSectionActionLabel(t('home.petRecommendations'), t('home.managePetProfiles'), t('home.petRecommendationReady', { count: personalizedReadyCount }));
  const personalizedAddAllActionLabel = homeSectionActionLabel(t('home.petRecommendations'), t('pages.wishlist.addAllToCart'), t('home.petRecommendationReady', { count: personalizedReadyCount }));
  const categoriesViewAllLabel = homeSectionActionLabel(t('home.categories'), t('home.viewAll'), categoryTiles.length);
  const recentlyViewedMoreProductsLabel = homeSectionActionLabel(t('home.recentlyViewed'), t('home.moreProducts'), recentlyViewedProducts.length);
  const flashOffersViewAllLabel = homeSectionActionLabel(t('home.flashOffers'), t('home.viewAll'), promoProducts.length);
  const dailyDiscoveryMoreProductsLabel = homeSectionActionLabel(t('home.dailyDiscovery'), t('home.moreProducts'), discoveryProducts.length);
  const petGalleryActionLabel = homeSectionActionLabel(t('home.petUgcTitle'), t('nav.petGallery'), petGalleryItems.length);

  return (
    <main className={homeLanguageClass}>
      <section className="shopee-hero">
        <div className="shopee-container shopee-hero__grid">
          <div className="shopee-hero__main">
            <div>
              <span className="shopee-hero__eyebrow">{t('home.heroEyebrow')}</span>
              <h1>{t('home.heroTitle')}</h1>
              <p>{t('home.heroText')}</p>
              <div className="shopee-hero__actions">
                <Button size="large" icon={<ShoppingOutlined />} onClick={() => navigate('/products')}>
                  {t('home.buyNow')}
                </Button>
                <Button size="large" ghost icon={<GiftOutlined />} onClick={() => navigate('/coupons')}>
                  {t('home.claimCoupons')}
                </Button>
              </div>
              {!isAuthenticated ? (
                <div className="shopee-hero__authActions" aria-label={t('nav.account')}>
                  <Button size="large" type="primary" onClick={() => navigate('/register')}>
                    {t('nav.register')}
                  </Button>
                  <Button size="large" ghost onClick={() => navigate(buildLoginUrlFromWindow())}>
                    {t('nav.login')}
                  </Button>
                </div>
              ) : null}
              {heroCategoryTiles.length ? (
                <div className="shopee-hero__categoryRail" aria-label={t('home.categories')}>
                  {heroCategoryTiles.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => navigate(`/products?categoryId=${category.id}`)}
                    >
                      {getLocalizedCategoryValue(category, language, 'name')}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="shopee-hero__signalRow">
                <span className="shopee-hero__signalMetric">
                  <small>{t('home.bestSellers')}</small>
                  <strong>{bestSellers.length}</strong>
                </span>
                <span className="shopee-hero__signalMetric">
                  <small>{t('home.flashOffers')}</small>
                  <strong>{promoProducts.length}</strong>
                </span>
                <span className="shopee-hero__signalMetric">
                  <small>{t('home.categories')}</small>
                  <strong>{displayCategoryRoots.length}</strong>
                </span>
              </div>
              <div className="shopee-hero__trustPills" aria-label={t('home.trust.petSafe')}>
                <span>{t('home.trust.freeShipping', { amount: formatPrice(market.freeShippingThreshold) })}</span>
                <span>{t('home.trust.easyReturns')}</span>
                <span>{t('home.trust.petSafe')}</span>
              </div>
            </div>
          </div>
          <aside className="shopee-hero__aside" aria-label={t('home.petRecommendations')}>
            {heroFeaturedProduct ? (
              <article className="shopee-hero__featuredCard">
                <span className="shopee-hero__featuredEyebrow">{t('pages.productList.viewPick')}</span>
                <strong>{heroFeaturedProductName}</strong>
                <p>{heroFeaturedProduct.description || t('home.petRecommendationsHint')}</p>
                <div className="shopee-hero__featuredMeta">
                  <span className="commerce-money">{formatPrice(getPrice(heroFeaturedProduct))}</span>
                  {heroFeaturedTag ? <small>{heroFeaturedTag}</small> : null}
                </div>
                <div className="shopee-hero__featuredActions">
                <Button
                  type="primary"
                  onMouseEnter={() => prefetchProduct(heroFeaturedProduct.id)}
                  onFocus={() => prefetchProduct(heroFeaturedProduct.id)}
                  aria-label={`${t('home.buyNow')}: ${heroFeaturedProductName}`}
                  title={`${t('home.buyNow')}: ${heroFeaturedProductName}`}
                  onClick={() => openProduct(heroFeaturedProduct.id)}
                >
                    {t('home.buyNow')}
                  </Button>
                  <Button aria-label={`${t('pages.productList.addToCart')}: ${heroFeaturedProductName}`} title={`${t('pages.productList.addToCart')}: ${heroFeaturedProductName}`} onClick={() => handleQuickAddToCart(undefined, heroFeaturedProduct)}>
                    {t('pages.productList.addToCart')}
                  </Button>
                </div>
              </article>
            ) : null}
            {heroSpotlights.map((card) => (
              <article key={card.key} className={`shopee-hero__spotlight shopee-hero__spotlight--${card.key}`}>
                <span className="shopee-hero__spotlightIcon">{card.icon}</span>
                <div className="shopee-hero__spotlightBody">
                  <strong>{card.title}</strong>
                  <p>{card.summary}</p>
                </div>
                <Button type="default" aria-label={homeSectionActionLabel(card.title, card.actionLabel, card.summary)} title={homeSectionActionLabel(card.title, card.actionLabel, card.summary)} onClick={card.action} disabled={card.disabled}>
                  {card.actionLabel}
                </Button>
              </article>
            ))}
          </aside>
        </div>
      </section>

      <div className="shopee-container shopee-mobile-priority">
        <section className="shopee-mobile-quick-panel" aria-label={t('home.categories')}>
          {mobileQuickActions.map((action) => (
            <button key={action.key} type="button" onClick={action.onClick}>
              <span className="shopee-mobile-quick-panel__icon">{action.icon}</span>
              <span className="shopee-mobile-quick-panel__label">{action.label}</span>
            </button>
          ))}
        </section>
      </div>

      <div className="shopee-container">
        <section className="pet-trust-strip">
          <div><TruckOutlined /><strong>{t('home.trust.freeShipping', { amount: formatPrice(market.freeShippingThreshold) })}</strong><span>{t('home.trust.fastDispatch')}</span></div>
          <div><SafetyCertificateOutlined /><strong>{t('home.trust.petSafe')}</strong><span>{t('home.trust.nonToxic')}</span></div>
          <div><CheckCircleOutlined /><strong>{t('home.trust.easyReturns')}</strong><span>{t('home.trust.betterFit')}</span></div>
          <div><StarFilled /><strong>{t('home.trust.loved')}</strong><span>{t('home.trust.happyTails')}</span></div>
        </section>

        <section className="shopee-home-actions" aria-label={t('home.couponsExtra')}>
          {usingCatalogSnapshot ? (
            <Alert
              className="shopee-home__snapshotNotice"
              type="warning"
              showIcon
              message={t('pages.productList.snapshotTitle')}
              description={t('pages.productList.snapshotText')}
            />
          ) : null}
          {!isAuthenticated ? (
            <div className="shopee-conversion-band" aria-label={t('nav.account')}>
              {guestJourneyActions.map((item) => (
                <button type="button" key={item.key} className="shopee-conversion-band__card" onClick={item.action}>
                  <span className="shopee-conversion-band__icon">{item.icon}</span>
                  <span className="shopee-conversion-band__body">
                    <strong>{item.title}</strong>
                    <Text>{item.text}</Text>
                  </span>
                  <span className="shopee-conversion-band__action">{item.actionLabel}</span>
                </button>
              ))}
            </div>
          ) : null}
          <div className="shopee-conversion-strip" aria-label={t('home.petRecommendations')}>
            {conversionHighlights.map((item) => (
              <article key={item.key} className={`shopee-conversion-strip__item shopee-conversion-strip__item--${item.key}`}>
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </article>
            ))}
          </div>
          <button type="button" className="shopee-coupon-entry" onClick={() => navigate('/coupons')}>
            <span className="shopee-coupon-entry__icon"><GiftOutlined /></span>
            <span>
              <strong>{t('home.couponsExtra')}</strong>
              <Text>{t('nav.coupons')}</Text>
            </span>
          </button>
          <button type="button" className="shopee-coupon-entry shopee-coupon-entry--deal" onClick={openDiscountProducts}>
            <span className="shopee-coupon-entry__icon"><FireOutlined /></span>
            <span>
              <strong>{t('home.flashOffers')}</strong>
              <Text>{t('home.viewDeals')}</Text>
            </span>
          </button>
        </section>

        <section className="shopee-story-grid" aria-label={t('home.bestSellers')}>
          {curatedStoryCards.map((card) => (
            <article key={card.key} className={`shopee-story-card shopee-story-card--${card.key}`}>
              <span className="shopee-story-card__icon">{card.icon}</span>
              <div className="shopee-story-card__body">
                <strong>{card.title}</strong>
                <Text>{card.summary}</Text>
              </div>
              <Button type="text" onClick={card.action}>
                {card.actionLabel}
              </Button>
            </article>
          ))}
        </section>

        {bestSellers.length ? (
          <section className="shopee-section shopee-promo-products shopee-best-sellers">
            <div className="shopee-section__header">
              <h2>
                <StarFilled /> {t('home.bestSellers')}
              </h2>
	              <button type="button" aria-label={bestSellersShopAllLabel} title={bestSellersShopAllLabel} onClick={() => navigate('/products')}>{t('home.shopAll')}</button>
            </div>
            <Row gutter={[12, 12]}>
              {bestSellers.map((product, index) => (
                <Col key={product.id} xs={12} sm={8} md={6} lg={4}>
                  <HomeProductCard {...productCardCommonProps} product={product} index={index} compact sectionLabel={t('home.bestSellers')} />
                </Col>
              ))}
            </Row>
          </section>
        ) : null}

        {bestSellers.length >= 3 ? (
          <section className="shopee-section shopee-editorial-band">
            <div className="shopee-section__header">
              <h2>
                <HeartOutlined /> {t('home.petRecommendations')}
              </h2>
	              <button type="button" aria-label={recommendationsMoreProductsLabel} title={recommendationsMoreProductsLabel} onClick={() => navigate('/products')}>{t('home.moreProducts')}</button>
            </div>
            <div className="shopee-editorial-band__grid">
              <article className="shopee-editorial-band__feature">
                <span className="shopee-editorial-band__eyebrow">{t('home.heroEyebrow')}</span>
                <strong>{editorialFeatureName}</strong>
                <Text>{editorialFeatureProduct?.description || t('home.petRecommendationsHint')}</Text>
                <div className="shopee-editorial-band__actions">
                  <Button type="primary" aria-label={`${t('home.buyNow')}: ${editorialFeatureName}`} title={`${t('home.buyNow')}: ${editorialFeatureName}`} onClick={() => openProduct(bestSellers[0].id)}>
                    {t('home.buyNow')}
                  </Button>
                  <Button aria-label={`${t('pages.productList.addToCart')}: ${editorialFeatureName}`} title={`${t('pages.productList.addToCart')}: ${editorialFeatureName}`} onClick={() => handleQuickAddToCart(undefined, bestSellers[0])}>
                    {t('pages.productList.addToCart')}
                  </Button>
                </div>
              </article>
              <div className="shopee-editorial-band__stack">
                {bestSellers.slice(1, 3).map((product, index) => {
                  const productName = homeProductName(product);
                  return (
                  <button
                    key={product.id}
                    type="button"
                    className="shopee-editorial-band__miniCard"
                    aria-label={`${t('pages.productList.viewDetails')}: ${productName}`}
                    title={`${t('pages.productList.viewDetails')}: ${productName}`}
                    onClick={() => openProduct(product.id)}
                  >
                    <span className="shopee-editorial-band__miniIndex">0{index + 2}</span>
                    <span className="shopee-editorial-band__miniBody">
                      <strong>{productName}</strong>
                      <Text className="commerce-money">{formatPrice(getPrice(product))}</Text>
                    </span>
                  </button>
                  );
                })}
              </div>
            </div>
          </section>
        ) : null}

        {personalizedDisplayProducts.length ? (
          <section className="shopee-section shopee-promo-products shopee-personalized-products">
            <div className="shopee-section__header">
              <h2>
                <CompassOutlined /> {t('home.petRecommendations')}
              </h2>
	              <button type="button" aria-label={managePetProfilesActionLabel} title={managePetProfilesActionLabel} onClick={() => navigate('/profile?tab=pets')}>{t('home.managePetProfiles')}</button>
            </div>
            <div className="shopee-personalized-insight">
              <div>
                <Text strong>{t('home.petRecommendationInsightTitle')}</Text>
                <Text type="secondary">
                  {personalizedRecommendationSource === 'petProfile'
                    ? t('home.petRecommendationInsightPetProfile')
                    : personalizedPreferenceLabel
                      ? t('home.petRecommendationInsightPreference', { value: personalizedPreferenceLabel })
                      : t('home.petRecommendationsHint')}
                </Text>
              </div>
              <div className="shopee-personalized-insight__stats">
                <span>{t('home.petRecommendationReady', { count: personalizedReadyCount })}</span>
                <span>{t('home.petRecommendationDeals', { count: personalizedDealCount })}</span>
              </div>
	              <Button
	                type="primary"
	                icon={<ShoppingCartOutlined />}
	                disabled={personalizedReadyProducts.length === 0}
	                aria-label={personalizedAddAllActionLabel}
	                title={personalizedAddAllActionLabel}
	                onClick={addPersonalizedReadyProducts}
	              >
                {t('pages.wishlist.addAllToCart')}
              </Button>
            </div>
            <Row gutter={[12, 12]}>
              {personalizedDisplayProducts.slice(0, 8).map((product, index) => (
                <Col key={product.id} xs={12} sm={8} md={6} lg={4}>
                  <HomeProductCard {...productCardCommonProps} product={product} index={index} compact sectionLabel={t('home.petRecommendations')} />
                </Col>
              ))}
            </Row>
          </section>
        ) : null}

        <section className="shopee-section shopee-categories-section">
          <div className="shopee-section__header">
            <h2>{t('home.categories')}</h2>
	            <button type="button" aria-label={categoriesViewAllLabel} title={categoriesViewAllLabel} onClick={() => navigate('/products')}>{t('home.viewAll')}</button>
          </div>
          {categoryTiles.length ? (
            <div className="shopee-categories">
              {categoryTiles.map((category, index) => {
                const categoryName = getLocalizedCategoryValue(category, language, 'name');
                const categoryImage = category.imageUrl ? resolveAssetImage(category.imageUrl, categoryImageFallback) : '';
                return (
                  <button type="button" key={category.id} onClick={() => navigate(`/products?categoryId=${category.id}`)}>
                    <span>
                      {categoryImage ? (
                        <img
                          src={getOptimizedImageUrl(categoryImage, 96) || categoryImageFallback}
                          srcSet={buildResponsiveImageSrcSet(categoryImage, [64, 96, 144])}
                          sizes="34px"
                          alt={categoryName}
                          loading="lazy"
                          decoding="async"
                          width={34}
                          height={34}
                          className="shopee-categories__image"
                          onError={(event) => applyHomeImageFallback(event, categoryImageFallback)}
                        />
                      ) : (
                        [<AppstoreOutlined />, <MobileOutlined />, <ShopOutlined />, <GiftOutlined />, <StarFilled />][index % 5]
                      )}
                    </span>
                    <Text className="shopee-categories__name">{categoryName}</Text>
                  </button>
                );
              })}
            </div>
          ) : (
            <Empty description={t('home.noCategories')} />
          )}
        </section>

        {recentlyViewedProducts.length ? (
          <section className="shopee-section shopee-promo-products shopee-recently-viewed-products">
            <div className="shopee-section__header shopee-section__header--with-actions">
              <h2>{t('home.recentlyViewed')}</h2>
              <div className="shopee-section__actions">
	                <button type="button" aria-label={recentlyViewedMoreProductsLabel} title={recentlyViewedMoreProductsLabel} onClick={() => navigate('/products')}>{t('home.moreProducts')}</button>
                <Popconfirm
                  classNames={{ root: 'shop-mobile-popup-layer shopee-home-popconfirm' }}
                  title={t('home.clearRecentlyViewedConfirm')}
                  okText={t('common.confirm')}
                  cancelText={t('common.cancel')}
                  okButtonProps={{ danger: true, 'aria-label': clearRecentlyViewedActionLabel, title: clearRecentlyViewedActionLabel }}
                  cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${clearRecentlyViewedActionLabel}`, title: `${t('common.cancel')}: ${clearRecentlyViewedActionLabel}` }}
                  onConfirm={() => {
                    clearProductViewHistory();
                    setViewPreferences(loadProductViewPreferences());
                  }}
                >
                  <button type="button" aria-label={clearRecentlyViewedActionLabel} title={clearRecentlyViewedActionLabel}>{t('home.clearRecentlyViewed')}</button>
                </Popconfirm>
              </div>
            </div>
            <Row gutter={[12, 12]}>
              {recentlyViewedProducts.map(({ product, viewedAt }, index) => (
                <Col key={product.id} xs={12} sm={8} md={6} lg={4}>
                  <HomeProductCard {...productCardCommonProps} product={product} index={index} compact viewedAt={viewedAt} sectionLabel={t('home.recentlyViewed')} />
                </Col>
              ))}
            </Row>
          </section>
        ) : null}

        {promoProducts.length ? (
          <section className="shopee-section shopee-promo-products shopee-flash-products">
            <div className="shopee-section__header">
              <h2>
                <FireOutlined /> {t('home.flashOffers')}
              </h2>
	              <button type="button" aria-label={flashOffersViewAllLabel} title={flashOffersViewAllLabel} onClick={openDiscountProducts}>{t('home.viewAll')}</button>
            </div>
            <Row gutter={[12, 12]}>
              {promoProducts.map((product, index) => (
                <Col key={product.id} xs={12} sm={8} md={6} lg={4}>
                  <HomeProductCard {...productCardCommonProps} product={product} index={index} compact sectionLabel={t('home.flashOffers')} />
                </Col>
              ))}
            </Row>
          </section>
        ) : null}

        <section className="shopee-section shopee-discovery shopee-for-you">
          <div className="shopee-section__header shopee-section__header--accent">
            <h2>{t('home.guessYouLike', { defaultValue: t('home.dailyDiscovery') })}</h2>
	            <button type="button" aria-label={dailyDiscoveryMoreProductsLabel} title={dailyDiscoveryMoreProductsLabel} onClick={() => navigate('/products')}>{t('home.moreProducts')}</button>
          </div>
          {discoveryProducts.length ? (
            <>
            <Row gutter={[12, 12]}>
              {visibleDiscoveryProducts.map((product, index) => (
                <Col key={product.id} xs={12} sm={8} md={6} lg={4}>
                  <HomeProductCard {...productCardCommonProps} product={product} index={index} sectionLabel={t('home.dailyDiscovery')} />
                </Col>
              ))}
            </Row>
            {hasMoreDiscoveryProducts ? (
              <div className="shopee-load-more">
                <Spin size="small" />
              </div>
            ) : null}
            </>
          ) : (
            <Empty description={t('home.noProducts')} />
          )}
        </section>

        <HomePetGallery
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
      </div>
      <SocialProofToast />
    </main>
  );
};

export default Home;
