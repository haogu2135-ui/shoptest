import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n';
import type { CategoryPublic, PetGalleryPhotoPublic, PetGalleryQuota, ProductPublic as Product } from '../types';
import { useMarket } from '../hooks/useMarket';
import { getDisplayCategoryRoots, getLocalizedCategoryValue } from '../utils/categoryTree';
import { clearProductViewHistory, loadProductViewPreferences } from '../utils/productViewPreferences';
import { needsOptionSelection } from '../utils/productOptions';
import { buildLoginUrlFromWindow } from '../utils/authRedirect';
import { dispatchDomEvent } from '../utils/domEvents';
import { loadGuestSupportContext } from '../utils/guestSupportContext';
import { hasStoredValue } from '../utils/safeStorage';
import { openCartDrawerWithSnapshot } from '../utils/cartDrawer';
import { usePageTitle } from '../hooks/usePageTitle';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useHomeCatalog } from '../hooks/useHomeCatalog';
import { useHomeProductActions } from '../hooks/useHomeProductActions';
import { buildWebsiteStructuredData } from '../utils/structuredData';
import { resolveDefaultSocialImageUrl } from '../utils/documentMeta';
import type { HomePetGalleryItem } from '../components/HomePetGallery';
import './Home.css';
import '../styles/mobile-page-contrast.css';

import {
  DISCOVERY_BATCH_SIZE,
  publicAssetUrl,
  readLocalPetGalleryLikes,
  resolveHomeCatalogBootstrap,
  HomeIcon,
  HI,
  buildHomeConversionHighlightDescriptors,
  buildHomeGuestJourneyDescriptors,
  buildHomeHeroFeaturedTag,
  buildHomeHeroSpotlightDescriptors,
  buildHomeMobileQuickActionDescriptors,
  buildHomePetGalleryItems,
  buildHomeStoryCardDescriptors,
  deriveHomeBestSellers,
  deriveHomeDiscoveryProducts,
  deriveHomeLocalPersonalizedProducts,
  deriveHomePromoProducts,
  getHomeDiscountPercent,
  resolveHomeHeroFeaturedProduct,
  resolveHomePersonalizedPreferenceLabel,
  resolveHomePetUploadButtonLabel,
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
  const openCartWithSnapshot = useCallback(() => openCartDrawerWithSnapshot({ authenticated: isAuthenticated }), [isAuthenticated]);
  const guestJourneyActions = buildHomeGuestJourneyDescriptors({ t, isAuthenticated }).map((item) => {
    const action = () => {
      if (item.intent === 'register') {
        navigate('/register');
        return;
      }
      if (item.intent === 'login') {
        navigate(buildLoginUrlFromWindow());
        return;
      }
      navigate('/track-order');
    };
    return {
      key: item.key,
      icon: <HomeIcon path={HI[item.iconKey]} />,
      title: item.title,
      text: item.text,
      actionLabel: item.actionLabel,
      action,
    };
  });
  const mobileQuickActions = buildHomeMobileQuickActionDescriptors({ t, isAuthenticated }).map((item) => {
    const onClick = () => {
      if (item.intent === 'orders') {
        navigate(isAuthenticated ? '/profile?tab=orders' : buildLoginUrlFromWindow());
        return;
      }
      if (item.intent === 'cart') {
        openCartWithSnapshot();
        return;
      }
      if (item.intent === 'coupons') {
        navigate('/coupons');
        return;
      }
      if (item.intent === 'wishlist') {
        navigate(isAuthenticated ? '/wishlist' : buildLoginUrlFromWindow());
        return;
      }
      if (item.intent === 'track') {
        navigate('/track-order');
        return;
      }
      if (item.intent === 'support') {
        openSupport();
        return;
      }
      if (item.intent === 'finder') {
        navigate('/pet-finder');
        return;
      }
      navigate('/history');
    };
    return {
      key: item.key,
      icon: <HomeIcon path={HI[item.iconKey]} />,
      label: item.label,
      onClick,
    };
  });

  const formatViewedAt = (viewedAt?: number) => {
    if (!viewedAt) return '';
    return new Date(viewedAt).toLocaleString(language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const promoProducts = useMemo(
    () => deriveHomePromoProducts(products),
    [products],
  );

  const bestSellers = useMemo(
    () => deriveHomeBestSellers(products),
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

  const discoveryProducts = useMemo(
    () => deriveHomeDiscoveryProducts({ featured, products, viewPreferences }),
    [featured, products, viewPreferences],
  );

  const localPersonalizedProducts = useMemo(
    () => deriveHomeLocalPersonalizedProducts({ products, viewPreferences }),
    [products, viewPreferences],
  );

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
    () => personalizedDisplayProducts.filter((product) => getHomeDiscountPercent(product) > 0 || product.activeLimitedTimeDiscount).length,
    [personalizedDisplayProducts],
  );
  const personalizedPreferenceLabel = useMemo(
    () => resolveHomePersonalizedPreferenceLabel({ categories, language, viewPreferences }),
    [categories, language, viewPreferences],
  );

  const visibleDiscoveryProducts = useMemo(
    () => discoveryProducts.slice(0, visibleCount),
    [discoveryProducts, visibleCount],
  );
  const hasMoreDiscoveryProducts = visibleCount < discoveryProducts.length;

  useHomeCatalog({
    language,
    t,
    isAuthenticated,
    catalogReadyRef,
    discoveryProductsLength: discoveryProducts.length,
    viewPreferencesRecent: viewPreferences.recent,
    setWishlistedProductIds,
    setLoading,
    setLoadError,
    setFeatured,
    setProducts,
    setCategories,
    setVisibleCount,
    setUsingCatalogSnapshot,
    setPersonalizedProducts,
    setViewPreferences,
    setRecentlyViewedDetails,
    setRecentlyViewedHydrated,
  });

  const {
    prefetchProduct,
    openProduct,
    handlePetUploadClick,
    handlePetPhotoSelected,
    handlePetGalleryLike,
    handleDeletePetPhoto,
    handleQuickAddToCart,
    handleQuickWishlist,
    addPersonalizedReadyProducts,
  } = useHomeProductActions({
    navigate,
    t,
    language,
    isAuthenticated,
    petGalleryQuota,
    localPetGalleryLikes,
    petUploadInputRef,
    personalizedReadyProducts,
    openCartWithSnapshot,
    setPetGalleryPhotos,
    setPetGalleryQuota,
    setUploadingPetPhoto,
    setLocalPetGalleryLikes,
    setWishlistedProductIds,
  });


  const displayCategoryRoots = useMemo(() => getDisplayCategoryRoots(categories), [categories]);
  const categoryTiles = useMemo(() => displayCategoryRoots.slice(0, 8), [displayCategoryRoots]);
  const heroCategoryTiles = useMemo(() => categoryTiles.slice(0, 4), [categoryTiles]);
  const petUploadRemaining = petGalleryQuota ? Math.max(0, petGalleryQuota.remaining) : 3;
  const petUploadButtonLabel = resolveHomePetUploadButtonLabel({
    t,
    uploadingPetPhoto,
    isAuthenticated,
    petUploadRemaining,
  });
  const petGalleryItems = useMemo<HomePetGalleryItem[]>(
    () => buildHomePetGalleryItems({ petGalleryPhotos, localPetGalleryLikes }),
    [localPetGalleryLikes, petGalleryPhotos],
  );
  const heroSpotlights = buildHomeHeroSpotlightDescriptors({
    t,
    personalizedRecommendationSource,
    personalizedReadyCount,
    personalizedPreferenceLabel,
    personalizedDisplayCount: personalizedDisplayProducts.length,
    personalizedReadyProductsCount: personalizedReadyProducts.length,
    personalizedDealCount,
    promoProductsCount: promoProducts.length,
    heroCategorySummary: heroCategoryTiles.map((category) => getLocalizedCategoryValue(category, language, 'name')).join(' / '),
  }).map((item) => {
    const action = () => {
      if (item.intent === 'recommendations') {
        if (personalizedDisplayProducts.length > 0) {
          addPersonalizedReadyProducts();
          return;
        }
        navigate('/profile?tab=pets');
        return;
      }
      if (item.intent === 'deals') {
        openDiscountProducts();
        return;
      }
      navigate('/products');
    };
    return {
      key: item.key,
      icon: <HomeIcon path={HI[item.iconKey]} />,
      title: item.title,
      summary: item.summary,
      actionLabel: item.actionLabel,
      action,
      disabled: item.disabled,
    };
  });
  const heroFeaturedProduct = resolveHomeHeroFeaturedProduct({
    personalizedDisplayProducts,
    bestSellers,
    promoProducts,
    featured,
    products,
  });
  const heroFeaturedProductName = heroFeaturedProduct ? homeProductName(heroFeaturedProduct) : '';
  const heroFeaturedTag = buildHomeHeroFeaturedTag({ t, product: heroFeaturedProduct });
  const conversionHighlights = buildHomeConversionHighlightDescriptors({
    t,
    promoProductsCount: promoProducts.length,
    bestSellersCount: bestSellers.length,
    personalizedReadyCount,
    petGalleryItemsCount: petGalleryItems.length,
  });
  const curatedStoryCards = buildHomeStoryCardDescriptors({
    t,
    promoProductsCount: promoProducts.length,
    bestSellersCount: bestSellers.length,
    freeShippingAmountText: formatPrice(market.freeShippingThreshold),
    petGalleryItemsCount: petGalleryItems.length,
  }).map((item) => {
    const action = () => {
      if (item.intent === 'deals') {
        openDiscountProducts();
        return;
      }
      if (item.intent === 'pet-gallery') {
        navigate('/pet-gallery');
        return;
      }
      navigate('/products');
    };
    return {
      key: item.key,
      icon: <HomeIcon path={HI[item.iconKey]} />,
      title: item.title,
      summary: item.summary,
      actionLabel: item.actionLabel,
      action,
    };
  });
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
