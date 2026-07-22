import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { ShopIcon, SI } from '../components/ShopIcon';
import { Alert, Button, Modal, Popconfirm, Skeleton, Statistic } from 'antd';
import { useNavigate } from 'react-router-dom';
import { petGalleryApi } from '../api';
import { useLanguage } from '../i18n';
import { usePageTitle } from '../hooks/usePageTitle';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { buildLoginUrlFromWindow } from '../utils/authRedirect';
import type { PetGalleryPhotoPublic, PetGalleryQuota } from '../types';
import { buildResponsiveImageSrcSet, getOptimizedImageUrl, imageFallbacks, resolveApiAssetUrl } from '../utils/mediaAssets';
import { getApiErrorMessage } from '../utils/apiError';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import PageError from '../components/PageError';
import { dispatchDomEvent } from '../utils/domEvents';
import PageEmpty from '../components/PageEmpty';
import { isSupportedPetGalleryImageFile } from '../utils/petGalleryUpload';
import { getLocalStorageItem, hasStoredValue, setLocalStorageItem } from '../utils/safeStorage';
import './PetGallery.css';
import '../styles/mobile-page-contrast.css';


const PET_GALLERY_MAX_FILE_SIZE = 5 * 1024 * 1024;
const PET_GALLERY_LOCAL_LIKES_KEY = 'shop-pet-gallery-local-likes';
const petGalleryImageFallback = imageFallbacks.media;

const fallbackPhotos = [
  { key: 'happy_pet_1', image: petGalleryImageFallback, label: '@happy_pet_1', likeCount: 42 },
  { key: 'cozy_paws', image: petGalleryImageFallback, label: '@cozy_paws', likeCount: 36 },
  { key: 'cat_window_club', image: petGalleryImageFallback, label: '@cat_window_club', likeCount: 31 },
  { key: 'weekend_walks', image: petGalleryImageFallback, label: '@weekend_walks', likeCount: 27 },
  { key: 'tailwag_home', image: petGalleryImageFallback, label: '@tailwag_home', likeCount: 22 },
  { key: 'softnap_cat', image: petGalleryImageFallback, label: '@softnap_cat', likeCount: 19 },
];

type GalleryItem = {
  key: string;
  image: string;
  label: string;
  likeCount: number;
  likedByMe: boolean;
  canDelete: boolean;
  isSample?: boolean;
  photo?: PetGalleryPhotoPublic;
};

const readLocalLikes = () => {
  try {
    const parsed = JSON.parse(getLocalStorageItem(PET_GALLERY_LOCAL_LIKES_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch (error) {
    reportNonBlockingError('PetGallery.readLocalLikes', error);
    return [];
  }
};

const writeLocalLikes = (likes: string[]) => {
  setLocalStorageItem(PET_GALLERY_LOCAL_LIKES_KEY, JSON.stringify(Array.from(new Set(likes))));
};

const resolvePhotoUrl = (imageUrl: string) => resolveApiAssetUrl(imageUrl, petGalleryImageFallback);
const galleryCardImageSizes = '(max-width: 620px) 50vw, (max-width: 980px) 33vw, 25vw';
const isWithinDays = (value: string | undefined, days: number) => {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && Date.now() - timestamp <= days * 24 * 60 * 60 * 1000;
};

const usePetGalleryImageFallback = (event: React.SyntheticEvent<HTMLImageElement>) => {
  if (event.currentTarget.src !== petGalleryImageFallback) {
    event.currentTarget.src = petGalleryImageFallback;
  }
};

const PetGallery: React.FC = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  usePageTitle(t('pages.petGallery.title'));
  useDocumentMeta({
    title: t('pages.petGallery.title'),
    description: t('pages.petGallery.seoDescription'),
    path: '/pet-gallery',
    type: 'website',
    siteName: t('common.siteTitle'),
  });
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<PetGalleryPhotoPublic[]>([]);
  const [quota, setQuota] = useState<PetGalleryQuota | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [localLikes, setLocalLikes] = useState<string[]>(() => readLocalLikes());
  const [previewItem, setPreviewItem] = useState<GalleryItem | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(() => new Date());
  const [loadError, setLoadError] = useState(false);

  const isAuthenticated = hasStoredValue('token');

  const refreshGallery = useCallback(async (force = false) => {
    try {
      setLoading(true);
      const [photosRes, quotaRes] = await Promise.all([
        petGalleryApi.getAll(force),
        isAuthenticated
          ? petGalleryApi.getQuota(force).catch((error) => {
            reportNonBlockingError('PetGallery.refreshGalleryQuota', error);
            return null;
          })
          : Promise.resolve(null),
      ]);
      setPhotos(photosRes.data);
      setQuota(quotaRes?.data || null);
      setLastUpdatedAt(new Date());
      setLoadError(false);
    } catch (error) {
      reportNonBlockingError('PetGallery.refreshGallery', error);
      setQuota(null);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refreshGallery();
  }, [refreshGallery]);

  const items = useMemo<GalleryItem[]>(() => {
    const apiItems = photos.map((photo) => ({
      key: `photo-${photo.id}`,
      image: resolvePhotoUrl(photo.imageUrl),
      label: `@${photo.username || 'pet_parent'}`,
      likeCount: photo.likeCount || 0,
      likedByMe: Boolean(photo.likedByMe),
      canDelete: Boolean(photo.canDelete),
      photo,
    }));
    const existingImages = new Set(apiItems.map((item) => item.image));
    const existingLabels = new Set(apiItems.map((item) => item.label.toLowerCase()));
    const localItems = fallbackPhotos
      .filter((item) => !existingImages.has(item.image) && !existingLabels.has(item.label.toLowerCase()))
      .map((item) => ({
        ...item,
        likeCount: 0,
        likedByMe: false,
        canDelete: false,
        isSample: true,
      }));
    if (loadError) {
      return apiItems.sort((left, right) => right.likeCount - left.likeCount || left.label.localeCompare(right.label));
    }
    return [...apiItems, ...localItems].sort((left, right) => right.likeCount - left.likeCount || left.label.localeCompare(right.label));
  }, [loadError, photos]);

  const hasLiveGalleryData = !loadError;
  const remainingUploads = quota ? Math.max(0, quota.remaining) : 3;
  const displayedRemainingUploads = hasLiveGalleryData ? remainingUploads : '-';
  const liveItems = useMemo(() => items.filter((item) => !item.isSample), [items]);
  const isSampleOnlyGallery = !loadError && items.length > 0 && liveItems.length === 0;
  const canUseLiveInteractions = hasLiveGalleryData && !isSampleOnlyGallery;
  const galleryInsights = useMemo(() => {
    const totalLikes = liveItems.reduce((sum, item) => sum + item.likeCount, 0);
    const likedByMe = liveItems.filter((item) => item.likedByMe).length;
    const topMoment = liveItems[0];
    const communityMoments = liveItems.length;
    const activeMembers = Math.max(0, new Set(liveItems.map((item) => item.label.toLowerCase())).size);
    const featuredMoments = photos.filter((photo) => isWithinDays(photo.createdAt, 7)).length;
    return { totalLikes, likedByMe, topMoment, communityMoments, activeMembers, featuredMoments };
  }, [liveItems, photos]);
  const lastUpdated = useMemo(() => lastUpdatedAt.toLocaleTimeString(language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  }), [language, lastUpdatedAt]);
  const activePreviewItem = useMemo(
    () => (previewItem ? items.find((item) => item.key === previewItem.key) || previewItem : null),
    [items, previewItem],
  );
  const galleryUploadActionLabel = isAuthenticated
    ? `${hasLiveGalleryData ? t('home.petUgcUploadRemaining', { count: remainingUploads }) : t('common.retry')}: ${t('pages.petGallery.title')}`
    : `${t('pages.petGallery.loginToUpload')}: ${t('pages.petGallery.title')}`;
  const galleryShopFeedActionLabel = `${t('home.petUgcShopFeed')}: ${t('pages.petGallery.title')}`;
  const galleryLoginActionLabel = `${t('pages.petGallery.loginToUpload')}: ${t('pages.petGallery.title')}`;
  const galleryRefreshActionLabel = `${t('common.refresh')}: ${t('pages.petGallery.latest')}`;
  const shopInspiredActionLabel = `${t('pages.petGallery.shopInspired')}: ${t('pages.petGallery.conversionTitle')}`;
  const galleryItemPreviewLabel = (item: Pick<GalleryItem, 'label'>) => `${t('pages.petGallery.preview')}: ${item.label}`;
  const galleryItemShopLabel = (item: Pick<GalleryItem, 'label'>) => `${t('home.petUgcShopFeed')}: ${item.label}`;
  const galleryItemLikeLabel = (item: Pick<GalleryItem, 'label' | 'likeCount'>) => `${t('home.petUgcLikes', { count: item.likeCount })}: ${item.label}`;
  const galleryItemDeleteLabel = (item: Pick<GalleryItem, 'label'>) => `${t('home.petUgcDelete')}: ${item.label}`;
  const heroUploadIcon = hasLiveGalleryData ? <ShopIcon path={SI.upload} /> : <ShopIcon path={SI.reload} />;

  const handleUploadClick = useCallback(() => {
    if (!isAuthenticated) {
      announceAccessibleMessage(t('messages.loginRequired'), 'warning');
      navigate(buildLoginUrlFromWindow());
      return;
    }
    if (!hasLiveGalleryData) {
      refreshGallery(true);
      return;
    }
    if (quota && !quota.canUpload) {
      announceAccessibleMessage(t('home.petUgcLimitReached'), 'warning');
      return;
    }
    uploadInputRef.current?.click();
  }, [hasLiveGalleryData, isAuthenticated, navigate, quota, refreshGallery, t]);

  const uploadReadiness = useMemo(() => {
    if (!isAuthenticated) {
      return {
        title: t('pages.petGallery.uploadLoginTitle'),
        text: t('pages.petGallery.uploadLoginText'),
        action: t('pages.petGallery.loginToUpload'),
        onClick: () => navigate(buildLoginUrlFromWindow()),
        icon: <ShopIcon path={SI.userAdd} />,
      };
    }
    if (!hasLiveGalleryData) {
      return {
        title: t('pages.petGallery.uploadStaleTitle'),
        text: t('pages.petGallery.uploadStaleText'),
        action: t('common.retry'),
        onClick: () => refreshGallery(true),
        icon: <ShopIcon path={SI.reload} />,
      };
    }
    if (quota && !quota.canUpload) {
      return {
        title: t('pages.petGallery.uploadLimitTitle'),
        text: t('pages.petGallery.uploadLimitText'),
        action: t('home.petUgcShopFeed'),
        onClick: () => navigate('/products?keyword=pet'),
        icon: <ShopIcon path={SI.shop} />,
      };
    }
    return {
      title: t('pages.petGallery.uploadReadyTitle', { count: remainingUploads }),
      text: t('pages.petGallery.uploadReadyText'),
      action: t('home.petUgcUploadRemaining', { count: remainingUploads }),
      onClick: handleUploadClick,
      icon: <ShopIcon path={SI.upload} />,
    };
  }, [handleUploadClick, hasLiveGalleryData, isAuthenticated, navigate, quota, refreshGallery, remainingUploads, t]);
  const uploadReadinessActionLabel = `${uploadReadiness.action}: ${uploadReadiness.title}`;
  const galleryInsightSubtitle = useMemo(() => {
    if (isSampleOnlyGallery) {
      return t('pages.petGallery.sampleInsightSubtitle');
    }
    if (galleryInsights.topMoment) {
      return t('pages.petGallery.insightBest', { name: galleryInsights.topMoment.label });
    }
    return t('pages.petGallery.insightSubtitle');
  }, [galleryInsights.topMoment, isSampleOnlyGallery, t]);
  const shopMomentTitle = useMemo(() => {
    if (isSampleOnlyGallery) {
      return t('pages.petGallery.sampleShopMomentTitle');
    }
    if (galleryInsights.topMoment) {
      return t('pages.petGallery.shopMomentTitleWithName', { name: galleryInsights.topMoment.label });
    }
    return t('pages.petGallery.shopMomentTitle');
  }, [galleryInsights.topMoment, isSampleOnlyGallery, t]);
  const conversionSubtitle = useMemo(() => {
    if (isSampleOnlyGallery) {
      return t('pages.petGallery.sampleConversionSubtitle');
    }
    if (galleryInsights.topMoment) {
      return t('pages.petGallery.conversionSubtitleTop', { name: galleryInsights.topMoment.label });
    }
    return t('pages.petGallery.conversionSubtitle');
  }, [galleryInsights.topMoment, isSampleOnlyGallery, t]);

  const handleSelectedPhoto: React.ChangeEventHandler<HTMLInputElement> = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!hasLiveGalleryData) {
      announceAccessibleMessage(t('pages.petGallery.staleActionBlocked'), 'warning');
      refreshGallery(true);
      return;
    }

    const isSupportedImage = isSupportedPetGalleryImageFile(file);
    if (!isSupportedImage) {
      announceAccessibleMessage(t('home.petUgcInvalidType'), 'error');
      return;
    }
    if (file.size > PET_GALLERY_MAX_FILE_SIZE) {
      announceAccessibleMessage(t('home.petUgcTooLarge'), 'error');
      return;
    }

    setUploading(true);
    try {
      const response = await petGalleryApi.upload(file);
      setPhotos((current) => [response.data, ...current.filter((photo) => photo.id !== response.data.id)].slice(0, 24));
      announceAccessibleMessage(t('home.petUgcUploadSuccess'), 'success');
      await refreshGallery(true);
    } catch (error) {
      announceAccessibleMessage(getApiErrorMessage(error, t('home.petUgcUploadFailed'), language), 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleLike = async (item: GalleryItem) => {
    if (!canUseLiveInteractions) {
      announceAccessibleMessage(t('pages.petGallery.staleActionBlocked'), 'warning');
      return;
    }
    if (!item.photo) {
      if (localLikes.includes(item.key)) {
        announceAccessibleMessage(t('home.petUgcAlreadyLiked'), 'info');
        return;
      }
      const nextLikes = [...localLikes, item.key];
      setLocalLikes(nextLikes);
      writeLocalLikes(nextLikes);
      announceAccessibleMessage(t('home.petUgcLiked'), 'success');
      return;
    }
    if (item.photo.likedByMe) {
      announceAccessibleMessage(t('home.petUgcAlreadyLiked'), 'info');
      return;
    }
    try {
      const response = await petGalleryApi.like(item.photo.id);
      setPhotos((current) => current.map((photo) => photo.id === response.data.id ? response.data : photo));
      announceAccessibleMessage(t('home.petUgcLiked'), 'success');
    } catch (error) {
      announceAccessibleMessage(getApiErrorMessage(error, t('home.petUgcLikeFailed'), language), 'error');
    }
  };

  const handleDelete = async (photo: PetGalleryPhotoPublic) => {
    if (!canUseLiveInteractions) {
      announceAccessibleMessage(t('pages.petGallery.staleActionBlocked'), 'warning');
      return;
    }
    try {
      await petGalleryApi.delete(photo.id);
      setPhotos((current) => current.filter((item) => item.id !== photo.id));
      announceAccessibleMessage(t('home.petUgcDeleted'), 'success');
      await refreshGallery(true);
    } catch (error) {
      announceAccessibleMessage(getApiErrorMessage(error, t('home.petUgcDeleteFailed'), language), 'error');
    }
  };

  return (
    <main className={`pet-gallery-page pet-gallery-page--${language}`}>
      <section className="pet-gallery-hero">
        <div className="pet-gallery-hero__copy">
          <span className="pet-gallery-page__text pet-gallery-hero__eyebrow">{t('pages.petGallery.eyebrow')}</span>
          <h1 className="pet-gallery-page__title">{t('pages.petGallery.title')}</h1>
          <p className="pet-gallery-page__text pet-gallery-page__paragraph">{t('pages.petGallery.subtitle')}</p>
          <div className="pet-gallery-page__actionRow">
            <Button
              type="primary"
              size="large"
              icon={heroUploadIcon}
              loading={uploading}
              aria-label={galleryUploadActionLabel}
              title={galleryUploadActionLabel}
              onClick={handleUploadClick}
            >
              {isAuthenticated
                ? hasLiveGalleryData
                  ? t('home.petUgcUploadRemaining', { count: remainingUploads })
                  : t('common.retry')
                : t('pages.petGallery.loginToUpload')}
            </Button>
            <Button size="large" icon={<ShopIcon path={SI.shop} />} aria-label={galleryShopFeedActionLabel} title={galleryShopFeedActionLabel} onClick={() => navigate('/products?keyword=pet')}>
              {t('home.petUgcShopFeed')}
            </Button>
          </div>
          <input
            ref={uploadInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif"
            className="pet-gallery-page__file"
            onChange={handleSelectedPhoto}
            aria-label={galleryUploadActionLabel}
          />
        </div>
        <div className="pet-gallery-hero__stats" aria-label={t('pages.petGallery.stats')}>
          <Statistic title={t('pages.petGallery.totalPhotos')} value={items.length} />
          <Statistic title={t('pages.petGallery.communityUploads')} value={galleryInsights.activeMembers} />
          <Statistic title={t('pages.petGallery.remainingUploads')} value={displayedRemainingUploads} />
        </div>
      </section>

      <section className="pet-gallery-toolbar">
        <div>
          <span className="pet-gallery-page__text pet-gallery-page__text--strong">{t('pages.petGallery.latest')}</span>
          <span className="pet-gallery-page__text pet-gallery-page__text--secondary">{t('pages.petGallery.updatedAt', { time: lastUpdated })}</span>
        </div>
        <div className="pet-gallery-page__actionRow">
          {!isAuthenticated ? (
            <Button icon={<ShopIcon path={SI.userAdd} />} aria-label={galleryLoginActionLabel} title={galleryLoginActionLabel} onClick={() => navigate(buildLoginUrlFromWindow())}>
              {t('pages.petGallery.loginToUpload')}
            </Button>
          ) : null}
          <Button icon={<ShopIcon path={SI.reload} />} aria-label={galleryRefreshActionLabel} title={galleryRefreshActionLabel} onClick={() => refreshGallery(true)}>
            {t('common.refresh')}
          </Button>
        </div>
      </section>

      {loadError && !loading && items.length > 0 ? (
        <Alert
          type="info"
          showIcon
          message={t('pages.petGallery.staleDataWarning')}
          action={(
            <Button size="small" icon={<ShopIcon path={SI.reload} />} onClick={() => refreshGallery(true)}>
              {t('common.retry')}
            </Button>
          )}
          className="pet-gallery-page__loadAlert"
        />
      ) : null}
      {loadError && !loading && items.length === 0 ? (
        <div data-pet-gallery-load-recovery="true">
          <PageError
            className="pet-gallery-page__loadAlert"
            title={t('pages.petGallery.loadFailed')}
            description={t('pages.petGallery.loadFailedEmpty')}
            actions={[
              {
                key: 'retry',
                label: t('common.retry'),
                onClick: () => refreshGallery(true),
                type: 'primary',
              },
              {
                key: 'browse',
                label: t('pages.petGallery.browsePetProducts'),
                onClick: () => navigate('/products?keyword=pet'),
                type: 'default',
              },
              {
                key: 'pet-finder',
                label: t('nav.petFinder'),
                onClick: () => navigate('/pet-finder'),
                type: 'default',
              },
              {
                key: 'coupons',
                label: t('pages.productList.loadRecoveryCoupons'),
                onClick: () => navigate('/coupons'),
                type: 'default',
              },
              {
                key: 'support',
                label: t('pages.productList.loadRecoverySupport'),
                onClick: () => dispatchDomEvent('shop:open-support'),
                type: 'default',
              },
            ]}
          />
        </div>
      ) : null}

      {isSampleOnlyGallery ? (
        <Alert
          type="info"
          showIcon
          message={t('pages.petGallery.sampleFallback')}
          description={t('pages.petGallery.sampleFallbackDescription')}
          action={(
            <Button size="small" icon={<ShopIcon path={SI.shop} />} onClick={() => navigate('/products?keyword=pet')}>
              {t('pages.petGallery.browsePetProducts')}
            </Button>
          )}
          className="pet-gallery-page__loadAlert"
        />
      ) : null}

      {!loading && items.length > 0 ? (
        <section className="pet-gallery-insights" aria-label={t('pages.petGallery.insightTitle')}>
          <div className="pet-gallery-insights__copy">
            <span className="pet-gallery-page__text pet-gallery-insights__eyebrow">{t('pages.petGallery.insightEyebrow')}</span>
            <h4 className="pet-gallery-page__title">{t('pages.petGallery.insightTitle')}</h4>
            <span className="pet-gallery-page__text pet-gallery-page__text--secondary">{galleryInsightSubtitle}</span>
          </div>
          <div className="pet-gallery-insights__grid">
            <div className="pet-gallery-insights__item is-ok">
              <ShopIcon path={SI.heartFill} />
              <strong>{galleryInsights.totalLikes}</strong>
              <span>{t('pages.petGallery.totalLikes')}</span>
            </div>
            <div className="pet-gallery-insights__item is-warm">
              <ShopIcon path={SI.rise} />
              <strong>{galleryInsights.featuredMoments}</strong>
              <span>{t('pages.petGallery.savedMoments')}</span>
            </div>
            <div className="pet-gallery-insights__item is-ok">
              <ShopIcon path={SI.camera} />
              <strong>{displayedRemainingUploads}</strong>
              <span>{t('pages.petGallery.uploadSlots')}</span>
            </div>
          </div>
        </section>
      ) : null}

      {!loading ? (
        <section className="pet-gallery-actions" aria-label={t('pages.petGallery.actionTitle')}>
          <div className="pet-gallery-action-card">
            <span className="pet-gallery-page__text pet-gallery-insights__eyebrow">{t('pages.petGallery.uploadPlanEyebrow')}</span>
            <h4 className="pet-gallery-page__title">{uploadReadiness.title}</h4>
            <span className="pet-gallery-page__text pet-gallery-page__text--secondary">{uploadReadiness.text}</span>
            <Button type="primary" icon={uploadReadiness.icon} loading={uploading || (loadError && loading)} aria-label={uploadReadinessActionLabel} title={uploadReadinessActionLabel} onClick={uploadReadiness.onClick}>
              {uploadReadiness.action}
            </Button>
          </div>
          <div className="pet-gallery-action-card pet-gallery-action-card--shop">
            <span className="pet-gallery-page__text pet-gallery-insights__eyebrow">{t('pages.petGallery.shopMomentEyebrow')}</span>
            <h4 className="pet-gallery-page__title">{shopMomentTitle}</h4>
            <span className="pet-gallery-page__text pet-gallery-page__text--secondary">
              {isSampleOnlyGallery
                ? t('pages.petGallery.sampleShopMomentText')
                : t('pages.petGallery.shopMomentText', { count: galleryInsights.communityMoments })}
            </span>
            <div className="pet-gallery-page__actionRow">
              <Button icon={<ShopIcon path={SI.shop} />} aria-label={galleryShopFeedActionLabel} title={galleryShopFeedActionLabel} onClick={() => navigate('/products?keyword=pet')}>
                {t('home.petUgcShopFeed')}
              </Button>
              {galleryInsights.topMoment ? (
                <Button aria-label={galleryItemPreviewLabel(galleryInsights.topMoment)} title={galleryItemPreviewLabel(galleryInsights.topMoment)} onClick={() => setPreviewItem(galleryInsights.topMoment)}>
                  {t('pages.petGallery.previewTop')}
                </Button>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {!loading && items.length > 0 ? (
        <section className="pet-gallery-conversion" aria-label={t('pages.petGallery.conversionTitle')}>
          <div>
            <span className="pet-gallery-page__text pet-gallery-insights__eyebrow">{t('pages.petGallery.conversionEyebrow')}</span>
            <h4 className="pet-gallery-page__title">{t('pages.petGallery.conversionTitle')}</h4>
            <span className="pet-gallery-page__text pet-gallery-page__text--secondary">{conversionSubtitle}</span>
          </div>
          <div className="pet-gallery-conversion__signals">
            <span><ShopIcon path={SI.heartFill} /> {t('pages.petGallery.conversionLikes', { count: galleryInsights.totalLikes })}</span>
            <span><ShopIcon path={SI.camera} /> {t('pages.petGallery.conversionMoments', { count: galleryInsights.communityMoments })}</span>
            <span><ShopIcon path={SI.rise} /> {t('pages.petGallery.conversionCommunity', { count: galleryInsights.communityMoments })}</span>
          </div>
          <div className="pet-gallery-conversion__actions">
            <Button type="primary" icon={<ShopIcon path={SI.shop} />} aria-label={shopInspiredActionLabel} title={shopInspiredActionLabel} onClick={() => navigate('/products?keyword=pet')}>
              {t('pages.petGallery.shopInspired')}
            </Button>
            {galleryInsights.topMoment ? (
              <Button aria-label={galleryItemPreviewLabel(galleryInsights.topMoment)} title={galleryItemPreviewLabel(galleryInsights.topMoment)} onClick={() => setPreviewItem(galleryInsights.topMoment)}>
                {t('pages.petGallery.previewTop')}
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}

      {loading ? (
        <div className="pet-gallery-grid">
          {Array.from({ length: 12 }).map((_, index) => (
            <Skeleton.Image key={index} active className="pet-gallery-skeleton" />
          ))}
        </div>
      ) : items.length === 0 ? (
        loadError ? null : (
          <PageEmpty
            className="pet-gallery-empty"
            description={(
              <div className="pet-gallery-empty__copy">
                <div>{t('pages.petGallery.empty')}</div>
                <div className="pet-gallery-empty__hint">{t('pages.petGallery.emptyHint')}</div>
              </div>
            )}
            actions={[
              {
                key: 'browse',
                label: t('pages.petGallery.browsePetProducts'),
                onClick: () => navigate('/products?keyword=pet'),
              },
              {
                key: 'coupons',
                label: t('pages.petGallery.emptyCoupons'),
                onClick: () => navigate('/coupons'),
                type: 'default',
              },
              {
                key: 'finder',
                label: t('nav.petFinder'),
                onClick: () => navigate('/pet-finder'),
                type: 'default',
              },
            ]}
          />
        )
      ) : (
        <div className="pet-gallery-grid">
          {items.map((item, index) => (
            <article key={item.key} className="pet-gallery-card">
              <button
                type="button"
                className="pet-gallery-card__imageButton"
                aria-label={galleryItemPreviewLabel(item)}
                title={galleryItemPreviewLabel(item)}
                onClick={() => setPreviewItem(item)}
              >
                <img
                  src={getOptimizedImageUrl(item.image, 520)}
                  srcSet={buildResponsiveImageSrcSet(item.image, [320, 520, 720])}
                  sizes={galleryCardImageSizes}
                  alt={`${t('pages.petGallery.photoAlt')} ${index + 1}: ${item.label}`}
                  width={520}
                  height={650}
                  loading="lazy"
                  decoding="async"
                  onError={usePetGalleryImageFallback}
                />
                <span className="pet-gallery-card__owner">{item.label}</span>
                {item.isSample ? (
                  <span className="pet-gallery-card__sample">{t('pages.petGallery.sampleBadge')}</span>
                ) : null}
              </button>
              <div className="pet-gallery-card__meta">
                {item.isSample || !canUseLiveInteractions ? (
                  <span className="pet-gallery-page__text pet-gallery-card__sampleMeta">{t('pages.petGallery.sampleSource')}</span>
                ) : (
                  <button
                    type="button"
                    className={item.likedByMe ? 'pet-gallery-card__like pet-gallery-card__like--active' : 'pet-gallery-card__like'}
                    aria-pressed={item.likedByMe}
                    aria-label={galleryItemLikeLabel(item)}
                    title={galleryItemLikeLabel(item)}
                    onClick={() => handleLike(item)}
                  >
                    {item.likedByMe ? <ShopIcon path={SI.heartFill} /> : <ShopIcon path={SI.heart} />}
                    {t('home.petUgcLikes', { count: item.likeCount })}
                  </button>
                )}
                {item.canDelete && item.photo && canUseLiveInteractions ? (
                  <Popconfirm
                    classNames={{ root: 'shop-mobile-popup-layer pet-gallery-delete-popconfirm' }}
                    title={t('home.petUgcDeleteConfirm')}
                    okText={t('common.confirm')}
                    cancelText={t('common.cancel')}
                    okButtonProps={{ danger: true, 'aria-label': galleryItemDeleteLabel(item), title: galleryItemDeleteLabel(item) }}
                    cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${galleryItemDeleteLabel(item)}`, title: `${t('common.cancel')}: ${galleryItemDeleteLabel(item)}` }}
                    onConfirm={() => handleDelete(item.photo as PetGalleryPhotoPublic)}
                  >
                    <button type="button" className="pet-gallery-card__delete" aria-label={galleryItemDeleteLabel(item)} title={galleryItemDeleteLabel(item)}>
                      <ShopIcon path={SI.delete} />
                    </button>
                  </Popconfirm>
                ) : (
                  <ShopIcon path={SI.camera} className="pet-gallery-card__camera" />
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(activePreviewItem)}
        footer={null}
        centered
        width={760}
        className="profile-mobile-safe-modal pet-gallery-preview"
        destroyOnHidden
        onCancel={() => setPreviewItem(null)}
      >
        {activePreviewItem ? (
          <figure className="pet-gallery-preview__figure">
            <img
              src={getOptimizedImageUrl(activePreviewItem.image, 1200)}
              srcSet={buildResponsiveImageSrcSet(activePreviewItem.image, [720, 960, 1200, 1600])}
              sizes="min(760px, 100vw)"
              alt={activePreviewItem.label}
              width={1200}
              height={900}
              decoding="async"
              onError={usePetGalleryImageFallback}
            />
            <figcaption>
              <span>{activePreviewItem.label}</span>
              <div className="pet-gallery-page__actionRow">
                <Button icon={<ShopIcon path={SI.shop} />} aria-label={galleryItemShopLabel(activePreviewItem)} title={galleryItemShopLabel(activePreviewItem)} onClick={() => navigate('/products?keyword=pet')}>
                  {t('home.petUgcShopFeed')}
                </Button>
                {!activePreviewItem.isSample && canUseLiveInteractions ? (
                  <Button
                    type="primary"
                    icon={activePreviewItem.likedByMe ? <ShopIcon path={SI.heartFill} /> : <ShopIcon path={SI.heart} />}
                    aria-pressed={activePreviewItem.likedByMe}
                    aria-label={galleryItemLikeLabel(activePreviewItem)}
                    title={galleryItemLikeLabel(activePreviewItem)}
                    onClick={() => handleLike(activePreviewItem)}
                  >
                    {t('home.petUgcLikes', { count: activePreviewItem.likeCount })}
                  </Button>
                ) : null}
              </div>
            </figcaption>
          </figure>
        ) : null}
      </Modal>
    </main>
  );
};

export default PetGallery;
