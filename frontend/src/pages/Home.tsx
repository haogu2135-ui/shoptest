import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Carousel, Col, Empty, Modal, Popconfirm, Row, Spin, Typography, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  AppstoreOutlined,
  CameraOutlined,
  CheckCircleOutlined,
  CompassOutlined,
  CustomerServiceOutlined,
  DeleteOutlined,
  FileDoneOutlined,
  FireOutlined,
  GiftOutlined,
  HeartFilled,
  HeartOutlined,
  HistoryOutlined,
  MobileOutlined,
  SearchOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  ShoppingOutlined,
  SafetyCertificateOutlined,
  StarFilled,
  TruckOutlined,
} from '@ant-design/icons';
import { apiBaseUrl, cartApi, categoryApi, petGalleryApi, productApi, wishlistApi } from '../api';
import { useLanguage } from '../i18n';
import type { Category, PetGalleryPhoto, PetGalleryQuota, Product } from '../types';
import { useMarket } from '../hooks/useMarket';
import { localizeProduct } from '../utils/localizedProduct';
import { getLocalizedCategoryValue } from '../utils/categoryTree';
import { clearProductViewHistory, loadProductViewPreferences } from '../utils/productViewPreferences';
import { addGuestCartItem } from '../utils/guestCart';
import SocialProofToast from '../components/SocialProofToast';
import './Home.css';

const { Text } = Typography;
const DISCOVERY_BATCH_SIZE = 12;
const PET_GALLERY_MAX_FILE_SIZE = 5 * 1024 * 1024;
const PET_GALLERY_LOCAL_LIKES_KEY = 'shop-pet-gallery-local-likes';

const fallbackImages = [
  'https://images.unsplash.com/photo-1601758125946-6ec2ef64daf8?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1592194996308-7b43878e84a6?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1601758177266-bc599de87707?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1544568100-847a948585b9?auto=format&fit=crop&w=900&q=80',
];
const petGalleryImageFallback = fallbackImages[0];

const ugcImages = [
  { key: 'happy_pet_1', image: 'https://images.unsplash.com/photo-1537151672256-6caf2e9f8c95?auto=format&fit=crop&w=700&q=80', label: '@happy_pet_1', likeCount: 42 },
  { key: 'cozy_paws', image: 'https://images.unsplash.com/photo-1568572933382-74d440642117?auto=format&fit=crop&w=700&q=80', label: '@cozy_paws', likeCount: 36 },
  { key: 'cat_window_club', image: 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&w=700&q=80', label: '@cat_window_club', likeCount: 31 },
  { key: 'weekend_walks', image: 'https://images.unsplash.com/photo-1583512603805-3cc6b41f3edb?auto=format&fit=crop&w=700&q=80', label: '@weekend_walks', likeCount: 27 },
  { key: 'tailwag_home', image: 'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=700&q=80', label: '@tailwag_home', likeCount: 22 },
  { key: 'softnap_cat', image: 'https://images.unsplash.com/photo-1596854407944-bf87f6fdd49e?auto=format&fit=crop&w=700&q=80', label: '@softnap_cat', likeCount: 19 },
];

type PetGalleryItem = {
  key: string;
  image: string;
  label: string;
  likeCount: number;
  likedByMe: boolean;
  canDelete: boolean;
  photo?: PetGalleryPhoto;
};

const readLocalPetGalleryLikes = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(PET_GALLERY_LOCAL_LIKES_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};

const writeLocalPetGalleryLikes = (keys: string[]) => {
  localStorage.setItem(PET_GALLERY_LOCAL_LIKES_KEY, JSON.stringify(Array.from(new Set(keys))));
};

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

const resolveAssetImage = (imageUrl: string) => {
  if (!imageUrl) return '';
  if (/^(https?:|data:|blob:)/i.test(imageUrl)) {
    return imageUrl;
  }
  return `${apiBaseUrl}${imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`}`;
};

const normalizeProductImages = (product: Product, index: number) => {
  const rawImages = parseImageList(product.images);
  const images = [product.imageUrl, ...rawImages]
    .map((image) => String(image || '').trim())
    .filter(Boolean)
    .map(resolveAssetImage);
  return Array.from(new Set(images)).concat(fallbackImages[index % fallbackImages.length]).slice(0, 6);
};

const resolvePetGalleryImage = (imageUrl: string) => {
  if (!imageUrl) return petGalleryImageFallback;
  return resolveAssetImage(imageUrl);
};

const usePetGalleryImageFallback = (event: React.SyntheticEvent<HTMLImageElement>) => {
  if (event.currentTarget.src !== petGalleryImageFallback) {
    event.currentTarget.src = petGalleryImageFallback;
  }
};

const getApiErrorMessage = (error: unknown, fallback: string) => {
  const responseMessage = (error as { response?: { data?: { error?: string; message?: string } } }).response?.data;
  return responseMessage?.error || responseMessage?.message || fallback;
};

const productNeedsOptionSelection = (product: Product) =>
  Boolean((product.variants && product.variants.length > 0) || (product.sizes && product.sizes.length > 0) || (product.colors && product.colors.length > 0));

const Home: React.FC = () => {
  const [featured, setFeatured] = useState<Product[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [personalizedProducts, setPersonalizedProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(DISCOVERY_BATCH_SIZE);
  const [viewPreferences, setViewPreferences] = useState(() => loadProductViewPreferences());
  const [petGalleryPhotos, setPetGalleryPhotos] = useState<PetGalleryPhoto[]>([]);
  const [petGalleryQuota, setPetGalleryQuota] = useState<PetGalleryQuota | null>(null);
  const [uploadingPetPhoto, setUploadingPetPhoto] = useState(false);
  const [localPetGalleryLikes, setLocalPetGalleryLikes] = useState<string[]>(() => readLocalPetGalleryLikes());
  const [petPreviewItem, setPetPreviewItem] = useState<PetGalleryItem | null>(null);
  const petUploadInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { formatMoney: formatPrice, market } = useMarket();
  const getPrice = (product: Product) => product.effectivePrice ?? product.price;
  const getDiscountPercent = (product: Product) => product.effectiveDiscountPercent || product.discount || 0;

  const searchKeyword = (keyword: string) => navigate(`/products?keyword=${encodeURIComponent(keyword)}`);
  const isAuthenticated = Boolean(localStorage.getItem('token') && localStorage.getItem('userId'));
  const currentUserId = Number(localStorage.getItem('userId') || 0);
  const openSupport = () => window.dispatchEvent(new Event('shop:open-support'));
  const openProduct = (productId: number) => navigate(`/products/${productId}`);
  const mobileQuickActions = [
    {
      key: 'orders',
      icon: <FileDoneOutlined />,
      label: t('pages.profile.allOrders'),
      onClick: () => navigate(isAuthenticated ? '/profile?tab=orders' : '/login'),
    },
    {
      key: 'cart',
      icon: <ShoppingCartOutlined />,
      label: t('pages.cart.title'),
      onClick: () => window.dispatchEvent(new Event('shop:open-cart')),
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
      onClick: () => navigate(isAuthenticated ? '/wishlist' : '/login'),
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

  const refreshPetGallery = useCallback(async () => {
    try {
      const [photosRes, quotaRes] = await Promise.all([
        petGalleryApi.getAll(),
        isAuthenticated ? petGalleryApi.getQuota().catch(() => null) : Promise.resolve(null),
      ]);
      setPetGalleryPhotos(photosRes.data);
      setPetGalleryQuota(quotaRes?.data || null);
    } catch {
      setPetGalleryPhotos([]);
      setPetGalleryQuota(null);
    }
  }, [isAuthenticated]);

  const handlePetUploadClick = () => {
    if (!isAuthenticated) {
      message.warning(t('messages.loginRequired'));
      navigate('/login');
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

    const isSupportedImage =
      ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) ||
      /\.(jpe?g|png|webp|gif)$/i.test(file.name);
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
      message.error(getApiErrorMessage(error, t('home.petUgcUploadFailed')));
    } finally {
      setUploadingPetPhoto(false);
    }
  };

  const handlePetGalleryLike = async (item: PetGalleryItem) => {
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
      message.error(getApiErrorMessage(error, t('home.petUgcLikeFailed')));
    }
  };

  const handleDeletePetPhoto = async (photo: PetGalleryPhoto) => {
    try {
      await petGalleryApi.delete(photo.id);
      setPetGalleryPhotos((current) => current.filter((item) => item.id !== photo.id));
      message.success(t('home.petUgcDeleted'));
      await refreshPetGallery();
    } catch (error) {
      message.error(getApiErrorMessage(error, t('home.petUgcDeleteFailed')));
    }
  };

  const handleQuickAddToCart = async (event: React.MouseEvent, product: Product) => {
    event.stopPropagation();
    if (product.stock !== undefined && product.stock <= 0) {
      message.warning(t('pages.productList.soldOut'));
      return;
    }
    if (productNeedsOptionSelection(product)) {
      message.info(t('pages.wishlist.selectOptions'));
      openProduct(product.id);
      return;
    }

    try {
      if (isAuthenticated) {
        await cartApi.addItem(currentUserId, product.id, 1);
        window.dispatchEvent(new Event('shop:cart-updated'));
      } else {
        addGuestCartItem(product, 1);
      }
      window.dispatchEvent(new Event('shop:open-cart'));
      message.success(t('messages.addCartSuccess'));
    } catch (error) {
      message.error(getApiErrorMessage(error, t('messages.addFailed')));
    }
  };

  const handleQuickWishlist = async (event: React.MouseEvent, product: Product) => {
    event.stopPropagation();
    if (!isAuthenticated) {
      message.warning(t('messages.loginRequired'));
      navigate('/login');
      return;
    }

    try {
      const response = await wishlistApi.toggle(currentUserId, product.id);
      window.dispatchEvent(new Event('shop:wishlist-updated'));
      message.success(response.data.wishlisted ? t('pages.productDetail.favoritedMsg') : t('pages.productDetail.unfavoritedMsg'));
    } catch (error) {
      message.error(getApiErrorMessage(error, t('messages.operationFailed')));
    }
  };

  useEffect(() => {
    refreshPetGallery();
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
    const fetchHome = async () => {
      setLoading(true);
      try {
        const [featuredRes, productsRes, categoriesRes] = await Promise.all([
          productApi.getFeatured(),
          productApi.getAll(),
          categoryApi.getTopLevel(),
        ]);
        setFeatured(featuredRes.data.map((product) => localizeProduct(product, language)));
        setProducts(productsRes.data.map((product) => localizeProduct(product, language)));
        setCategories(categoriesRes.data);
        setVisibleCount(DISCOVERY_BATCH_SIZE);
      } catch {
        setFeatured([]);
        setProducts([]);
        setCategories([]);
      } finally {
        setLoading(false);
      }
    };

    fetchHome();
  }, [language]);

  useEffect(() => {
    const fetchPersonalizedProducts = async () => {
      if (!isAuthenticated) {
        setPersonalizedProducts([]);
        return;
      }
      try {
        const response = await productApi.getPersonalizedRecommendations();
        setPersonalizedProducts(response.data.map((product) => localizeProduct(product, language)));
      } catch {
        setPersonalizedProducts([]);
      }
    };

    fetchPersonalizedProducts();
  }, [isAuthenticated, language]);

  useEffect(() => {
    const handlePreferencesUpdated = () => setViewPreferences(loadProductViewPreferences());
    window.addEventListener('shop:product-view-preferences-updated', handlePreferencesUpdated);
    window.addEventListener('storage', handlePreferencesUpdated);
    return () => {
      window.removeEventListener('shop:product-view-preferences-updated', handlePreferencesUpdated);
      window.removeEventListener('storage', handlePreferencesUpdated);
    };
  }, []);

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
    const productById = new Map(products.map((product) => [product.id, product]));
    const viewedAtById = new Map(viewPreferences.recentEntries.map((entry) => [entry.productId, entry.viewedAt]));
    return viewPreferences.recent
      .map((productId: number) => {
        const product = productById.get(productId);
        return product ? { product, viewedAt: viewedAtById.get(productId) } : undefined;
      })
      .filter(Boolean)
      .slice(0, 8) as Array<{ product: Product; viewedAt?: number }>;
  }, [products, viewPreferences]);

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
      .filter((entry) => entry.score > 0 && !recentSet.has(entry.product.id) && (entry.product.status || 'ACTIVE') === 'ACTIVE')
      .sort((left, right) => right.score - left.score || left.index - right.index)
      .map((entry) => entry.product)
      .slice(0, 8);
  }, [products, viewPreferences]);

  const personalizedDisplayProducts = personalizedProducts.length > 0 ? personalizedProducts : localPersonalizedProducts;
  const personalizedRecommendationSource = personalizedProducts.length > 0 ? 'petProfile' : 'recentViews';
  const personalizedReadyCount = personalizedDisplayProducts.filter((product) => !productNeedsOptionSelection(product) && product.stock !== 0).length;
  const personalizedDealCount = personalizedDisplayProducts.filter((product) => getDiscountPercent(product) > 0 || product.activeLimitedTimeDiscount).length;
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

  const visibleDiscoveryProducts = discoveryProducts.slice(0, visibleCount);
  const hasMoreDiscoveryProducts = visibleCount < discoveryProducts.length;

  useEffect(() => {
    const handleScroll = () => {
      const distanceToBottom = document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
      if (distanceToBottom < 420) {
        setVisibleCount((count) => Math.min(count + DISCOVERY_BATCH_SIZE, discoveryProducts.length));
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [discoveryProducts.length]);

  const categoryTiles = categories.slice(0, 8);
  const petUploadRemaining = petGalleryQuota ? Math.max(0, petGalleryQuota.remaining) : 3;
  const petUploadButtonLabel = uploadingPetPhoto
    ? t('home.petUgcUploading')
    : !isAuthenticated
      ? t('home.petUgcLoginToUpload')
      : t('home.petUgcUploadRemaining', { count: petUploadRemaining });
  const petUploadStatusText = !isAuthenticated
    ? t('home.petUgcLoginHint')
    : petGalleryQuota && !petGalleryQuota.canUpload
      ? t('home.petUgcLimitReached')
      : t('home.petUgcQuotaHint', { count: petUploadRemaining });
  const petGalleryItems = useMemo<PetGalleryItem[]>(() => {
    const photoItems = petGalleryPhotos.map((photo) => {
      const source = photo.source || 'USER_UPLOAD';
      return {
        key: `photo-${photo.id}`,
        image: resolvePetGalleryImage(photo.imageUrl),
        label: `@${photo.username || 'pet_parent'}`,
        likeCount: photo.likeCount || 0,
        likedByMe: Boolean(photo.likedByMe),
        canDelete: Boolean(photo.canDelete || (currentUserId && photo.userId === currentUserId && source === 'USER_UPLOAD')),
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
  }, [currentUserId, localPetGalleryLikes, petGalleryPhotos]);

  const ProductTile: React.FC<{ product: Product; index: number; compact?: boolean; viewedAt?: number }> = ({
    product,
    index,
    compact = false,
    viewedAt,
  }) => {
    const images = normalizeProductImages(product, index);
    const isSoldOut = product.stock !== undefined && product.stock <= 0;
    return (
    <article
      className="shopee-product"
      role="button"
      tabIndex={0}
      onClick={() => openProduct(product.id)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openProduct(product.id);
        }
      }}
    >
      <span className="shopee-product__imageWrap">
        {images.length > 2 ? (
          <Carousel autoplay dots={false} autoplaySpeed={2600 + (index % 4) * 350} className="shopee-product__carousel">
            {images.slice(0, -1).map((image, imageIndex) => (
              <img
                key={`${image}-${imageIndex}`}
                src={image}
                alt={`${product.name} ${imageIndex + 1}`}
                className="shopee-product__image"
                onError={(event) => {
                  event.currentTarget.src = images[images.length - 1];
                }}
              />
            ))}
          </Carousel>
        ) : (
          <img
            src={images[0]}
            alt={product.name}
            className="shopee-product__image"
            onError={(event) => {
              event.currentTarget.src = images[images.length - 1];
            }}
          />
        )}
        {getDiscountPercent(product) > 0 ? (
          <span className="shopee-product__discount">-{getDiscountPercent(product)}%</span>
        ) : null}
        {product.isFeatured ? <span className="shopee-product__mall">{t('common.mall')}</span> : null}
        {isSoldOut ? <span className="shopee-product__soldOut">{t('pages.productList.soldOut')}</span> : null}
        <span className="shopee-product__quickActions">
          <button
            type="button"
            aria-label={t('pages.productList.addToCart')}
            disabled={isSoldOut}
            onClick={(event) => handleQuickAddToCart(event, product)}
          >
            <ShoppingCartOutlined />
          </button>
          <button
            type="button"
            aria-label={t('pages.productDetail.favorite')}
            onClick={(event) => handleQuickWishlist(event, product)}
          >
            <HeartOutlined />
          </button>
        </span>
      </span>
      <span className="shopee-product__body">
        <span className="shopee-product__name">{product.name}</span>
        <span className="shopee-product__meta">
          <span className="shopee-product__price">{formatPrice(getPrice(product))}</span>
          {!compact ? <span className="shopee-product__sold">{t('home.sold')} {Math.max(12, product.stock || 42)}</span> : null}
        </span>
        {product.originalPrice && product.originalPrice > getPrice(product) ? (
          <span className="shopee-product__original">{formatPrice(product.originalPrice)}</span>
        ) : null}
        {viewedAt ? (
          <span className="shopee-product__lastViewed">{t('home.viewedAt', { time: formatViewedAt(viewedAt) })}</span>
        ) : null}
      </span>
    </article>
    );
  };

  if (loading) {
    return (
      <div className="shopee-loading">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <main className="shopee-home">
      <section className="shopee-hero">
        <div className="shopee-container shopee-hero__grid">
          <div className="shopee-hero__main">
            <div>
              <span className="shopee-hero__eyebrow">{t('home.heroEyebrow')}</span>
              <h1>{t('home.heroTitle')}</h1>
              <p>{t('home.heroText')}</p>
              <div className="shopee-hero__actions">
                <Button size="large" icon={<ShoppingOutlined />} onClick={() => navigate('/products')}>
                  {t('home.shopBestSellers')}
                </Button>
                <Button size="large" ghost icon={<SearchOutlined />} onClick={() => searchKeyword('dog walking')}>
                  {t('home.findWalkingGear')}
                </Button>
              </div>
            </div>
          </div>
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
          <button className="shopee-coupon-entry" onClick={() => navigate('/coupons')}>
            <span className="shopee-coupon-entry__icon"><GiftOutlined /></span>
            <span>
              <strong>{t('home.couponsExtra')}</strong>
              <Text>{t('nav.coupons')}</Text>
            </span>
          </button>
          <button className="shopee-coupon-entry shopee-coupon-entry--deal" onClick={() => searchKeyword(t('home.keywords.deal'))}>
            <span className="shopee-coupon-entry__icon"><FireOutlined /></span>
            <span>
              <strong>{t('home.flashOffers')}</strong>
              <Text>{t('home.viewDeals')}</Text>
            </span>
          </button>
        </section>

        {bestSellers.length ? (
          <section className="shopee-section shopee-promo-products">
            <div className="shopee-section__header">
              <h2>
                <StarFilled /> {t('home.bestSellers')}
              </h2>
              <button onClick={() => navigate('/products')}>{t('home.shopAll')}</button>
            </div>
            <Row gutter={[12, 12]}>
              {bestSellers.map((product, index) => (
                <Col key={product.id} xs={12} sm={8} md={6} lg={4}>
                  <ProductTile product={product} index={index} compact />
                </Col>
              ))}
            </Row>
          </section>
        ) : null}

        {personalizedDisplayProducts.length ? (
          <section className="shopee-section shopee-promo-products shopee-personalized-products">
            <div className="shopee-section__header">
              <h2>
                <CompassOutlined /> {t('home.petRecommendations')}
              </h2>
              <button onClick={() => navigate('/profile?tab=pets')}>{t('home.managePetProfiles')}</button>
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
            </div>
            <Row gutter={[12, 12]}>
              {personalizedDisplayProducts.slice(0, 8).map((product, index) => (
                <Col key={product.id} xs={12} sm={8} md={6} lg={4}>
                  <ProductTile product={product} index={index} compact />
                </Col>
              ))}
            </Row>
          </section>
        ) : null}

        <section className="shopee-section">
          <div className="shopee-section__header">
            <h2>{t('home.categories')}</h2>
            <button onClick={() => navigate('/products')}>{t('home.viewAll')}</button>
          </div>
          {categoryTiles.length ? (
            <div className="shopee-categories">
              {categoryTiles.map((category, index) => (
                <button key={category.id} onClick={() => navigate(`/products?categoryId=${category.id}`)}>
                  <span>
                    {category.imageUrl ? (
                      <img
                        src={resolveAssetImage(category.imageUrl)}
                        alt={getLocalizedCategoryValue(category, language, 'name')}
                        style={{ width: 34, height: 34, objectFit: 'cover', borderRadius: 6 }}
                        onError={usePetGalleryImageFallback}
                      />
                    ) : (
                      [<AppstoreOutlined />, <MobileOutlined />, <ShopOutlined />, <GiftOutlined />, <StarFilled />][index % 5]
                    )}
                  </span>
                  <Text ellipsis>{getLocalizedCategoryValue(category, language, 'name')}</Text>
                </button>
              ))}
            </div>
          ) : (
            <Empty description={t('home.noCategories')} />
          )}
        </section>

        {recentlyViewedProducts.length ? (
          <section className="shopee-section shopee-promo-products">
            <div className="shopee-section__header shopee-section__header--with-actions">
              <h2>{t('home.recentlyViewed')}</h2>
              <div className="shopee-section__actions">
                <button onClick={() => navigate('/products')}>{t('home.moreProducts')}</button>
                <button
                  onClick={() => {
                    clearProductViewHistory();
                    setViewPreferences(loadProductViewPreferences());
                  }}
                >
                  {t('home.clearRecentlyViewed')}
                </button>
              </div>
            </div>
            <Row gutter={[12, 12]}>
              {recentlyViewedProducts.map(({ product, viewedAt }, index) => (
                <Col key={product.id} xs={12} sm={8} md={6} lg={4}>
                  <ProductTile product={product} index={index} compact viewedAt={viewedAt} />
                </Col>
              ))}
            </Row>
          </section>
        ) : null}

        {promoProducts.length ? (
          <section className="shopee-section shopee-promo-products">
            <div className="shopee-section__header">
              <h2>
                <FireOutlined /> {t('home.flashOffers')}
              </h2>
              <button onClick={() => searchKeyword(t('home.keywords.deal'))}>{t('home.viewAll')}</button>
            </div>
            <Row gutter={[12, 12]}>
              {promoProducts.map((product, index) => (
                <Col key={product.id} xs={12} sm={8} md={6} lg={4}>
                  <ProductTile product={product} index={index} compact />
                </Col>
              ))}
            </Row>
          </section>
        ) : null}

        <section className="shopee-section shopee-discovery">
          <div className="shopee-section__header shopee-section__header--accent">
            <h2>{t('home.dailyDiscovery')}</h2>
            <button onClick={() => navigate('/products')}>{t('home.moreProducts')}</button>
          </div>
          {discoveryProducts.length ? (
            <>
            <Row gutter={[12, 12]}>
              {visibleDiscoveryProducts.map((product, index) => (
                <Col key={product.id} xs={12} sm={8} md={6} lg={4}>
                  <ProductTile product={product} index={index} />
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

        <section className="shopee-section pet-ugc">
          <div className="shopee-section__header">
              <h2><CameraOutlined /> {t('home.petUgcTitle')}</h2>
              <div className="pet-ugc__actions">
              <input
                ref={petUploadInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handlePetPhotoSelected}
                className="pet-ugc__file"
              />
              <button
                type="button"
                className="pet-ugc__upload"
                onClick={handlePetUploadClick}
                disabled={uploadingPetPhoto || Boolean(petGalleryQuota && !petGalleryQuota.canUpload)}
              >
                <CameraOutlined /> {petUploadButtonLabel}
              </button>
              <button type="button" onClick={() => navigate('/pet-gallery')}>{t('nav.petGallery')}</button>
              <button type="button" onClick={() => navigate('/products?keyword=pet')}>{t('home.petUgcShopFeed')}</button>
            </div>
          </div>
          <p className="pet-ugc__status">{petUploadStatusText}</p>
          <div className="pet-ugc__grid">
            {petGalleryItems.map((item, index) => (
              <div key={item.key} className="pet-ugc__card">
                <button
                  className="pet-ugc__imageButton"
                  type="button"
                  aria-label={`${t('home.petUgcTitle')} ${item.label}`}
                  onClick={() => setPetPreviewItem(item)}
                >
                  <img src={item.image} alt={`Pet customer story ${index + 1}`} onError={usePetGalleryImageFallback} />
                  <span>{item.label}</span>
                </button>
                <div className="pet-ugc__meta">
                  <button
                    type="button"
                    className={item.likedByMe ? 'pet-ugc__like pet-ugc__like--active' : 'pet-ugc__like'}
                    aria-pressed={item.likedByMe}
                    onClick={() => handlePetGalleryLike(item)}
                  >
                    {item.likedByMe ? <HeartFilled /> : <HeartOutlined />}
                    {t('home.petUgcLikes', { count: item.likeCount })}
                  </button>
                  {item.canDelete && item.photo ? (
                    <Popconfirm
                      title={t('home.petUgcDeleteConfirm')}
                      okText={t('common.confirm')}
                      cancelText={t('common.cancel')}
                      onConfirm={() => handleDeletePetPhoto(item.photo as PetGalleryPhoto)}
                    >
                      <button type="button" className="pet-ugc__delete" aria-label={t('home.petUgcDelete')}>
                        <DeleteOutlined />
                      </button>
                    </Popconfirm>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <Modal
        open={Boolean(petPreviewItem)}
        footer={null}
        centered
        width={720}
        className="pet-ugc-preview"
        destroyOnClose
        onCancel={() => setPetPreviewItem(null)}
      >
        {petPreviewItem ? (
          <figure className="pet-ugc-preview__figure">
            <img src={petPreviewItem.image} alt={petPreviewItem.label} onError={usePetGalleryImageFallback} />
            <figcaption>{petPreviewItem.label}</figcaption>
          </figure>
        ) : null}
      </Modal>
      <SocialProofToast />
    </main>
  );
};

export default Home;
