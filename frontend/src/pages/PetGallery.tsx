import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Empty, Modal, Popconfirm, Skeleton, Space, Statistic, Typography, message } from 'antd';
import {
  CameraOutlined,
  DeleteOutlined,
  HeartFilled,
  HeartOutlined,
  RiseOutlined,
  ReloadOutlined,
  ShopOutlined,
  UploadOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { petGalleryApi } from '../api';
import { useLanguage } from '../i18n';
import { buildLoginUrlFromWindow } from '../utils/authRedirect';
import type { PetGalleryPhotoPublic, PetGalleryQuota } from '../types';
import { buildResponsiveImageSrcSet, getOptimizedImageUrl, imageFallbacks, resolveApiAssetUrl } from '../utils/mediaAssets';
import { getApiErrorMessage } from '../utils/apiError';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import { isSupportedPetGalleryImageFile } from '../utils/petGalleryUpload';
import { getLocalStorageItem, hasStoredValue, setLocalStorageItem } from '../utils/safeStorage';
import './PetGallery.css';
import '../styles/mobile-page-contrast.css';

const { Paragraph, Text, Title } = Typography;

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
  }, [items.length, liveItems, photos]);
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
  const heroUploadIcon = hasLiveGalleryData ? <UploadOutlined /> : <ReloadOutlined />;

  const handleUploadClick = useCallback(() => {
    if (!isAuthenticated) {
      message.warning(t('messages.loginRequired'));
      navigate(buildLoginUrlFromWindow());
      return;
    }
    if (!hasLiveGalleryData) {
      refreshGallery(true);
      return;
    }
    if (quota && !quota.canUpload) {
      message.warning(t('home.petUgcLimitReached'));
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
        icon: <UserAddOutlined />,
      };
    }
    if (!hasLiveGalleryData) {
      return {
        title: t('pages.petGallery.uploadStaleTitle'),
        text: t('pages.petGallery.uploadStaleText'),
        action: t('common.retry'),
        onClick: () => refreshGallery(true),
        icon: <ReloadOutlined />,
      };
    }
    if (quota && !quota.canUpload) {
      return {
        title: t('pages.petGallery.uploadLimitTitle'),
        text: t('pages.petGallery.uploadLimitText'),
        action: t('home.petUgcShopFeed'),
        onClick: () => navigate('/products?keyword=pet'),
        icon: <ShopOutlined />,
      };
    }
    return {
      title: t('pages.petGallery.uploadReadyTitle', { count: remainingUploads }),
      text: t('pages.petGallery.uploadReadyText'),
      action: t('home.petUgcUploadRemaining', { count: remainingUploads }),
      onClick: handleUploadClick,
      icon: <UploadOutlined />,
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
      message.warning(t('pages.petGallery.staleActionBlocked'));
      refreshGallery(true);
      return;
    }

    const isSupportedImage = isSupportedPetGalleryImageFile(file);
    if (!isSupportedImage) {
      message.error(t('home.petUgcInvalidType'));
      return;
    }
    if (file.size > PET_GALLERY_MAX_FILE_SIZE) {
      message.error(t('home.petUgcTooLarge'));
      return;
    }

    setUploading(true);
    try {
      const response = await petGalleryApi.upload(file);
      setPhotos((current) => [response.data, ...current.filter((photo) => photo.id !== response.data.id)].slice(0, 24));
      message.success(t('home.petUgcUploadSuccess'));
      await refreshGallery(true);
    } catch (error) {
      message.error(getApiErrorMessage(error, t('home.petUgcUploadFailed'), language));
    } finally {
      setUploading(false);
    }
  };

  const handleLike = async (item: GalleryItem) => {
    if (!canUseLiveInteractions) {
      message.warning(t('pages.petGallery.staleActionBlocked'));
      return;
    }
    if (!item.photo) {
      if (localLikes.includes(item.key)) {
        message.info(t('home.petUgcAlreadyLiked'));
        return;
      }
      const nextLikes = [...localLikes, item.key];
      setLocalLikes(nextLikes);
      writeLocalLikes(nextLikes);
      message.success(t('home.petUgcLiked'));
      return;
    }
    if (item.photo.likedByMe) {
      message.info(t('home.petUgcAlreadyLiked'));
      return;
    }
    try {
      const response = await petGalleryApi.like(item.photo.id);
      setPhotos((current) => current.map((photo) => photo.id === response.data.id ? response.data : photo));
      message.success(t('home.petUgcLiked'));
    } catch (error) {
      message.error(getApiErrorMessage(error, t('home.petUgcLikeFailed'), language));
    }
  };

  const handleDelete = async (photo: PetGalleryPhotoPublic) => {
    if (!canUseLiveInteractions) {
      message.warning(t('pages.petGallery.staleActionBlocked'));
      return;
    }
    try {
      await petGalleryApi.delete(photo.id);
      setPhotos((current) => current.filter((item) => item.id !== photo.id));
      message.success(t('home.petUgcDeleted'));
      await refreshGallery(true);
    } catch (error) {
      message.error(getApiErrorMessage(error, t('home.petUgcDeleteFailed'), language));
    }
  };

  return (
    <main className={`pet-gallery-page pet-gallery-page--${language}`}>
      <section className="pet-gallery-hero">
        <div className="pet-gallery-hero__copy">
          <Text className="pet-gallery-hero__eyebrow">{t('pages.petGallery.eyebrow')}</Text>
          <Title level={1}>{t('pages.petGallery.title')}</Title>
          <Paragraph>{t('pages.petGallery.subtitle')}</Paragraph>
          <Space wrap>
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
            <Button size="large" icon={<ShopOutlined />} aria-label={galleryShopFeedActionLabel} title={galleryShopFeedActionLabel} onClick={() => navigate('/products?keyword=pet')}>
              {t('home.petUgcShopFeed')}
            </Button>
          </Space>
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
          <Text strong>{t('pages.petGallery.latest')}</Text>
          <Text type="secondary">{t('pages.petGallery.updatedAt', { time: lastUpdated })}</Text>
        </div>
        <Space wrap>
          {!isAuthenticated ? (
            <Button icon={<UserAddOutlined />} aria-label={galleryLoginActionLabel} title={galleryLoginActionLabel} onClick={() => navigate(buildLoginUrlFromWindow())}>
              {t('pages.petGallery.loginToUpload')}
            </Button>
          ) : null}
          <Button icon={<ReloadOutlined />} aria-label={galleryRefreshActionLabel} title={galleryRefreshActionLabel} onClick={() => refreshGallery(true)}>
            {t('common.refresh')}
          </Button>
        </Space>
      </section>

      {loadError && !loading ? (
        <Alert
          type={items.length > 0 ? 'info' : 'warning'}
          showIcon
          message={items.length > 0 ? t('pages.petGallery.staleDataWarning') : t('pages.petGallery.loadFailed')}
          action={(
            <Space wrap>
              <Button size="small" icon={<ReloadOutlined />} onClick={() => refreshGallery(true)}>
                {t('common.retry')}
              </Button>
              {items.length === 0 ? (
                <Button size="small" icon={<ShopOutlined />} onClick={() => navigate('/products?keyword=pet')}>
                  {t('pages.petGallery.browsePetProducts')}
                </Button>
              ) : null}
            </Space>
          )}
          className="pet-gallery-page__loadAlert"
        />
      ) : null}

      {isSampleOnlyGallery ? (
        <Alert
          type="info"
          showIcon
          message={t('pages.petGallery.sampleFallback')}
          description={t('pages.petGallery.sampleFallbackDescription')}
          action={(
            <Button size="small" icon={<ShopOutlined />} onClick={() => navigate('/products?keyword=pet')}>
              {t('pages.petGallery.browsePetProducts')}
            </Button>
          )}
          className="pet-gallery-page__loadAlert"
        />
      ) : null}

      {!loading && items.length > 0 ? (
        <section className="pet-gallery-insights" aria-label={t('pages.petGallery.insightTitle')}>
          <div className="pet-gallery-insights__copy">
            <Text className="pet-gallery-insights__eyebrow">{t('pages.petGallery.insightEyebrow')}</Text>
            <Title level={4}>{t('pages.petGallery.insightTitle')}</Title>
            <Text type="secondary">{galleryInsightSubtitle}</Text>
          </div>
          <div className="pet-gallery-insights__grid">
            <div className="pet-gallery-insights__item is-ok">
              <HeartFilled />
              <strong>{galleryInsights.totalLikes}</strong>
              <span>{t('pages.petGallery.totalLikes')}</span>
            </div>
            <div className="pet-gallery-insights__item is-warm">
              <RiseOutlined />
              <strong>{galleryInsights.featuredMoments}</strong>
              <span>{t('pages.petGallery.savedMoments')}</span>
            </div>
            <div className="pet-gallery-insights__item is-ok">
              <CameraOutlined />
              <strong>{displayedRemainingUploads}</strong>
              <span>{t('pages.petGallery.uploadSlots')}</span>
            </div>
          </div>
        </section>
      ) : null}

      {!loading ? (
        <section className="pet-gallery-actions" aria-label={t('pages.petGallery.actionTitle')}>
          <div className="pet-gallery-action-card">
            <Text className="pet-gallery-insights__eyebrow">{t('pages.petGallery.uploadPlanEyebrow')}</Text>
            <Title level={4}>{uploadReadiness.title}</Title>
            <Text type="secondary">{uploadReadiness.text}</Text>
            <Button type="primary" icon={uploadReadiness.icon} loading={uploading || (loadError && loading)} aria-label={uploadReadinessActionLabel} title={uploadReadinessActionLabel} onClick={uploadReadiness.onClick}>
              {uploadReadiness.action}
            </Button>
          </div>
          <div className="pet-gallery-action-card pet-gallery-action-card--shop">
            <Text className="pet-gallery-insights__eyebrow">{t('pages.petGallery.shopMomentEyebrow')}</Text>
            <Title level={4}>{shopMomentTitle}</Title>
            <Text type="secondary">
              {isSampleOnlyGallery
                ? t('pages.petGallery.sampleShopMomentText')
                : t('pages.petGallery.shopMomentText', { count: galleryInsights.communityMoments })}
            </Text>
            <Space wrap>
              <Button icon={<ShopOutlined />} aria-label={galleryShopFeedActionLabel} title={galleryShopFeedActionLabel} onClick={() => navigate('/products?keyword=pet')}>
                {t('home.petUgcShopFeed')}
              </Button>
              {galleryInsights.topMoment ? (
                <Button aria-label={galleryItemPreviewLabel(galleryInsights.topMoment)} title={galleryItemPreviewLabel(galleryInsights.topMoment)} onClick={() => setPreviewItem(galleryInsights.topMoment)}>
                  {t('pages.petGallery.previewTop')}
                </Button>
              ) : null}
            </Space>
          </div>
        </section>
      ) : null}

      {!loading && items.length > 0 ? (
        <section className="pet-gallery-conversion" aria-label={t('pages.petGallery.conversionTitle')}>
          <div>
            <Text className="pet-gallery-insights__eyebrow">{t('pages.petGallery.conversionEyebrow')}</Text>
            <Title level={4}>{t('pages.petGallery.conversionTitle')}</Title>
            <Text type="secondary">{conversionSubtitle}</Text>
          </div>
          <div className="pet-gallery-conversion__signals">
            <span><HeartFilled /> {t('pages.petGallery.conversionLikes', { count: galleryInsights.totalLikes })}</span>
            <span><CameraOutlined /> {t('pages.petGallery.conversionMoments', { count: galleryInsights.communityMoments })}</span>
            <span><RiseOutlined /> {t('pages.petGallery.conversionCommunity', { count: galleryInsights.communityMoments })}</span>
          </div>
          <Space wrap className="pet-gallery-conversion__actions">
            <Button type="primary" icon={<ShopOutlined />} aria-label={shopInspiredActionLabel} title={shopInspiredActionLabel} onClick={() => navigate('/products?keyword=pet')}>
              {t('pages.petGallery.shopInspired')}
            </Button>
            {galleryInsights.topMoment ? (
              <Button aria-label={galleryItemPreviewLabel(galleryInsights.topMoment)} title={galleryItemPreviewLabel(galleryInsights.topMoment)} onClick={() => setPreviewItem(galleryInsights.topMoment)}>
                {t('pages.petGallery.previewTop')}
              </Button>
            ) : null}
          </Space>
        </section>
      ) : null}

      {loading ? (
        <div className="pet-gallery-grid">
          {Array.from({ length: 12 }).map((_, index) => (
            <Skeleton.Image key={index} active className="pet-gallery-skeleton" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Empty description={loadError ? t('pages.petGallery.loadFailedEmpty') : t('pages.petGallery.empty')} className="pet-gallery-empty" />
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
                  <Text className="pet-gallery-card__sampleMeta">{t('pages.petGallery.sampleSource')}</Text>
                ) : (
                  <button
                    type="button"
                    className={item.likedByMe ? 'pet-gallery-card__like pet-gallery-card__like--active' : 'pet-gallery-card__like'}
                    aria-pressed={item.likedByMe}
                    aria-label={galleryItemLikeLabel(item)}
                    title={galleryItemLikeLabel(item)}
                    onClick={() => handleLike(item)}
                  >
                    {item.likedByMe ? <HeartFilled /> : <HeartOutlined />}
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
                      <DeleteOutlined />
                    </button>
                  </Popconfirm>
                ) : (
                  <CameraOutlined className="pet-gallery-card__camera" />
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
              <Space wrap>
                <Button icon={<ShopOutlined />} aria-label={galleryItemShopLabel(activePreviewItem)} title={galleryItemShopLabel(activePreviewItem)} onClick={() => navigate('/products?keyword=pet')}>
                  {t('home.petUgcShopFeed')}
                </Button>
                {!activePreviewItem.isSample && canUseLiveInteractions ? (
                  <Button
                    type="primary"
                    icon={activePreviewItem.likedByMe ? <HeartFilled /> : <HeartOutlined />}
                    aria-pressed={activePreviewItem.likedByMe}
                    aria-label={galleryItemLikeLabel(activePreviewItem)}
                    title={galleryItemLikeLabel(activePreviewItem)}
                    onClick={() => handleLike(activePreviewItem)}
                  >
                    {t('home.petUgcLikes', { count: activePreviewItem.likeCount })}
                  </Button>
                ) : null}
              </Space>
            </figcaption>
          </figure>
        ) : null}
      </Modal>
    </main>
  );
};

export default PetGallery;
