import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Empty, Modal, Popconfirm, Skeleton, Space, Statistic, Typography, message } from 'antd';
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
import { apiBaseUrl, petGalleryApi } from '../api';
import { useLanguage } from '../i18n';
import type { PetGalleryPhoto, PetGalleryQuota } from '../types';
import './PetGallery.css';

const { Paragraph, Text, Title } = Typography;

const PET_GALLERY_MAX_FILE_SIZE = 5 * 1024 * 1024;
const PET_GALLERY_LOCAL_LIKES_KEY = 'shop-pet-gallery-local-likes';

const fallbackPhotos = [
  { key: 'happy_pet_1', image: 'https://images.unsplash.com/photo-1537151672256-6caf2e9f8c95?auto=format&fit=crop&w=900&q=80', label: '@happy_pet_1', likeCount: 42 },
  { key: 'cozy_paws', image: 'https://images.unsplash.com/photo-1568572933382-74d440642117?auto=format&fit=crop&w=900&q=80', label: '@cozy_paws', likeCount: 36 },
  { key: 'cat_window_club', image: 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&w=900&q=80', label: '@cat_window_club', likeCount: 31 },
  { key: 'weekend_walks', image: 'https://images.unsplash.com/photo-1583512603805-3cc6b41f3edb?auto=format&fit=crop&w=900&q=80', label: '@weekend_walks', likeCount: 27 },
  { key: 'tailwag_home', image: 'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=900&q=80', label: '@tailwag_home', likeCount: 22 },
  { key: 'softnap_cat', image: 'https://images.unsplash.com/photo-1596854407944-bf87f6fdd49e?auto=format&fit=crop&w=900&q=80', label: '@softnap_cat', likeCount: 19 },
];
const petGalleryImageFallback = fallbackPhotos[0].image;

type GalleryItem = {
  key: string;
  image: string;
  label: string;
  likeCount: number;
  likedByMe: boolean;
  canDelete: boolean;
  photo?: PetGalleryPhoto;
};

const readLocalLikes = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(PET_GALLERY_LOCAL_LIKES_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};

const writeLocalLikes = (likes: string[]) => {
  localStorage.setItem(PET_GALLERY_LOCAL_LIKES_KEY, JSON.stringify(Array.from(new Set(likes))));
};

const resolvePhotoUrl = (imageUrl: string) => {
  if (!imageUrl) return petGalleryImageFallback;
  if (/^(https?:|data:|blob:)/i.test(imageUrl)) {
    return imageUrl;
  }
  return `${apiBaseUrl}${imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`}`;
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

const PetGallery: React.FC = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<PetGalleryPhoto[]>([]);
  const [quota, setQuota] = useState<PetGalleryQuota | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [localLikes, setLocalLikes] = useState<string[]>(() => readLocalLikes());
  const [previewItem, setPreviewItem] = useState<GalleryItem | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(() => new Date());

  const isAuthenticated = Boolean(localStorage.getItem('token') && localStorage.getItem('userId'));
  const currentUserId = Number(localStorage.getItem('userId') || 0);

  const refreshGallery = useCallback(async (force = false) => {
    try {
      setLoading(true);
      const [photosRes, quotaRes] = await Promise.all([
        petGalleryApi.getAll(force),
        isAuthenticated ? petGalleryApi.getQuota(force).catch(() => null) : Promise.resolve(null),
      ]);
      setPhotos(photosRes.data);
      setQuota(quotaRes?.data || null);
      setLastUpdatedAt(new Date());
    } catch {
      setPhotos([]);
      setQuota(null);
      message.error(t('pages.petGallery.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, t]);

  useEffect(() => {
    refreshGallery();
  }, [refreshGallery]);

  const items = useMemo<GalleryItem[]>(() => {
    const apiItems = photos.map((photo) => {
      const source = photo.source || 'USER_UPLOAD';
      return {
        key: `photo-${photo.id}`,
        image: resolvePhotoUrl(photo.imageUrl),
        label: `@${photo.username || 'pet_parent'}`,
        likeCount: photo.likeCount || 0,
        likedByMe: Boolean(photo.likedByMe),
        canDelete: Boolean(photo.canDelete || (currentUserId && photo.userId === currentUserId && source === 'USER_UPLOAD')),
        photo,
      };
    });
    const existingImages = new Set(apiItems.map((item) => item.image));
    const existingLabels = new Set(apiItems.map((item) => item.label.toLowerCase()));
    const localItems = fallbackPhotos
      .filter((item) => !existingImages.has(item.image) && !existingLabels.has(item.label.toLowerCase()))
      .map((item) => ({
        ...item,
        likeCount: item.likeCount + (localLikes.includes(item.key) ? 1 : 0),
        likedByMe: localLikes.includes(item.key),
        canDelete: false,
      }));
    return [...apiItems, ...localItems].sort((left, right) => right.likeCount - left.likeCount || left.label.localeCompare(right.label));
  }, [currentUserId, localLikes, photos]);

  const userUploadCount = photos.filter((photo) => photo.source !== 'SEED').length;
  const remainingUploads = quota ? Math.max(0, quota.remaining) : 3;
  const galleryInsights = useMemo(() => {
    const totalLikes = items.reduce((sum, item) => sum + item.likeCount, 0);
    const likedByMe = items.filter((item) => item.likedByMe).length;
    const topMoment = items[0];
    const communityMoments = items.filter((item) => item.photo?.source !== 'SEED').length;
    return { totalLikes, likedByMe, topMoment, communityMoments };
  }, [items]);
  const lastUpdated = useMemo(() => lastUpdatedAt.toLocaleTimeString(language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  }), [language, lastUpdatedAt]);
  const activePreviewItem = useMemo(
    () => (previewItem ? items.find((item) => item.key === previewItem.key) || previewItem : null),
    [items, previewItem],
  );

  const handleUploadClick = useCallback(() => {
    if (!isAuthenticated) {
      message.warning(t('messages.loginRequired'));
      navigate('/login');
      return;
    }
    if (quota && !quota.canUpload) {
      message.warning(t('home.petUgcLimitReached'));
      return;
    }
    uploadInputRef.current?.click();
  }, [isAuthenticated, navigate, quota, t]);

  const uploadReadiness = useMemo(() => {
    if (!isAuthenticated) {
      return {
        title: t('pages.petGallery.uploadLoginTitle'),
        text: t('pages.petGallery.uploadLoginText'),
        action: t('pages.petGallery.loginToUpload'),
        onClick: () => navigate('/login'),
      };
    }
    if (quota && !quota.canUpload) {
      return {
        title: t('pages.petGallery.uploadLimitTitle'),
        text: t('pages.petGallery.uploadLimitText'),
        action: t('home.petUgcShopFeed'),
        onClick: () => navigate('/products?keyword=pet'),
      };
    }
    return {
      title: t('pages.petGallery.uploadReadyTitle', { count: remainingUploads }),
      text: t('pages.petGallery.uploadReadyText'),
      action: t('home.petUgcUploadRemaining', { count: remainingUploads }),
      onClick: handleUploadClick,
    };
  }, [handleUploadClick, isAuthenticated, navigate, quota, remainingUploads, t]);

  const handleSelectedPhoto: React.ChangeEventHandler<HTMLInputElement> = async (event) => {
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

    setUploading(true);
    try {
      const response = await petGalleryApi.upload(file);
      setPhotos((current) => [response.data, ...current.filter((photo) => photo.id !== response.data.id)].slice(0, 24));
      message.success(t('home.petUgcUploadSuccess'));
      await refreshGallery(true);
    } catch (error) {
      message.error(getApiErrorMessage(error, t('home.petUgcUploadFailed')));
    } finally {
      setUploading(false);
    }
  };

  const handleLike = async (item: GalleryItem) => {
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
      message.error(getApiErrorMessage(error, t('home.petUgcLikeFailed')));
    }
  };

  const handleDelete = async (photo: PetGalleryPhoto) => {
    try {
      await petGalleryApi.delete(photo.id);
      setPhotos((current) => current.filter((item) => item.id !== photo.id));
      message.success(t('home.petUgcDeleted'));
      await refreshGallery(true);
    } catch (error) {
      message.error(getApiErrorMessage(error, t('home.petUgcDeleteFailed')));
    }
  };

  return (
    <main className="pet-gallery-page">
      <section className="pet-gallery-hero">
        <div className="pet-gallery-hero__copy">
          <Text className="pet-gallery-hero__eyebrow">{t('pages.petGallery.eyebrow')}</Text>
          <Title level={1}>{t('pages.petGallery.title')}</Title>
          <Paragraph>{t('pages.petGallery.subtitle')}</Paragraph>
          <Space wrap>
            <Button type="primary" size="large" icon={<UploadOutlined />} loading={uploading} onClick={handleUploadClick}>
              {isAuthenticated ? t('home.petUgcUploadRemaining', { count: remainingUploads }) : t('pages.petGallery.loginToUpload')}
            </Button>
            <Button size="large" icon={<ShopOutlined />} onClick={() => navigate('/products?keyword=pet')}>
              {t('home.petUgcShopFeed')}
            </Button>
          </Space>
          <input
            ref={uploadInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="pet-gallery-page__file"
            onChange={handleSelectedPhoto}
          />
        </div>
        <div className="pet-gallery-hero__stats" aria-label={t('pages.petGallery.stats')}>
          <Statistic title={t('pages.petGallery.totalPhotos')} value={items.length} />
          <Statistic title={t('pages.petGallery.communityUploads')} value={userUploadCount} />
          <Statistic title={t('pages.petGallery.remainingUploads')} value={remainingUploads} />
        </div>
      </section>

      <section className="pet-gallery-toolbar">
        <div>
          <Text strong>{t('pages.petGallery.latest')}</Text>
          <Text type="secondary">{t('pages.petGallery.updatedAt', { time: lastUpdated })}</Text>
        </div>
        <Space wrap>
          {!isAuthenticated ? (
            <Button icon={<UserAddOutlined />} onClick={() => navigate('/login')}>
              {t('pages.petGallery.loginToUpload')}
            </Button>
          ) : null}
          <Button icon={<ReloadOutlined />} onClick={() => refreshGallery(true)}>
            {t('common.refresh')}
          </Button>
        </Space>
      </section>

      {!loading && items.length > 0 ? (
        <section className="pet-gallery-insights" aria-label={t('pages.petGallery.insightTitle')}>
          <div className="pet-gallery-insights__copy">
            <Text className="pet-gallery-insights__eyebrow">{t('pages.petGallery.insightEyebrow')}</Text>
            <Title level={4}>{t('pages.petGallery.insightTitle')}</Title>
            <Text type="secondary">
              {galleryInsights.topMoment
                ? t('pages.petGallery.insightBest', { name: galleryInsights.topMoment.label })
                : t('pages.petGallery.insightSubtitle')}
            </Text>
          </div>
          <div className="pet-gallery-insights__grid">
            <div className="pet-gallery-insights__item is-ok">
              <HeartFilled />
              <strong>{galleryInsights.totalLikes}</strong>
              <span>{t('pages.petGallery.totalLikes')}</span>
            </div>
            <div className="pet-gallery-insights__item is-warm">
              <RiseOutlined />
              <strong>{galleryInsights.likedByMe}</strong>
              <span>{t('pages.petGallery.savedMoments')}</span>
            </div>
            <div className="pet-gallery-insights__item is-ok">
              <CameraOutlined />
              <strong>{remainingUploads}</strong>
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
            <Button type="primary" icon={<UploadOutlined />} loading={uploading} onClick={uploadReadiness.onClick}>
              {uploadReadiness.action}
            </Button>
          </div>
          <div className="pet-gallery-action-card pet-gallery-action-card--shop">
            <Text className="pet-gallery-insights__eyebrow">{t('pages.petGallery.shopMomentEyebrow')}</Text>
            <Title level={4}>
              {galleryInsights.topMoment
                ? t('pages.petGallery.shopMomentTitleWithName', { name: galleryInsights.topMoment.label })
                : t('pages.petGallery.shopMomentTitle')}
            </Title>
            <Text type="secondary">
              {t('pages.petGallery.shopMomentText', { count: galleryInsights.communityMoments })}
            </Text>
            <Space wrap>
              <Button icon={<ShopOutlined />} onClick={() => navigate('/products?keyword=pet')}>
                {t('home.petUgcShopFeed')}
              </Button>
              {galleryInsights.topMoment ? (
                <Button onClick={() => setPreviewItem(galleryInsights.topMoment)}>
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
            <Text type="secondary">
              {galleryInsights.topMoment
                ? t('pages.petGallery.conversionSubtitleTop', { name: galleryInsights.topMoment.label })
                : t('pages.petGallery.conversionSubtitle')}
            </Text>
          </div>
          <div className="pet-gallery-conversion__signals">
            <span><HeartFilled /> {t('pages.petGallery.conversionLikes', { count: galleryInsights.totalLikes })}</span>
            <span><CameraOutlined /> {t('pages.petGallery.conversionMoments', { count: items.length })}</span>
            <span><RiseOutlined /> {t('pages.petGallery.conversionCommunity', { count: galleryInsights.communityMoments })}</span>
          </div>
          <Space wrap className="pet-gallery-conversion__actions">
            <Button type="primary" icon={<ShopOutlined />} onClick={() => navigate('/products?keyword=pet')}>
              {t('pages.petGallery.shopInspired')}
            </Button>
            {galleryInsights.topMoment ? (
              <Button onClick={() => setPreviewItem(galleryInsights.topMoment)}>
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
        <Empty description={t('pages.petGallery.empty')} className="pet-gallery-empty" />
      ) : (
        <div className="pet-gallery-grid">
          {items.map((item, index) => (
            <article key={item.key} className="pet-gallery-card">
              <button
                type="button"
                className="pet-gallery-card__imageButton"
                aria-label={`${t('pages.petGallery.preview')} ${item.label}`}
                onClick={() => setPreviewItem(item)}
              >
                <img src={item.image} alt={`${t('pages.petGallery.photoAlt')} ${index + 1}`} loading="lazy" onError={usePetGalleryImageFallback} />
                <span className="pet-gallery-card__owner">{item.label}</span>
              </button>
              <div className="pet-gallery-card__meta">
                <button
                  type="button"
                  className={item.likedByMe ? 'pet-gallery-card__like pet-gallery-card__like--active' : 'pet-gallery-card__like'}
                  onClick={() => handleLike(item)}
                >
                  {item.likedByMe ? <HeartFilled /> : <HeartOutlined />}
                  {t('home.petUgcLikes', { count: item.likeCount })}
                </button>
                {item.canDelete && item.photo ? (
                  <Popconfirm
                    title={t('home.petUgcDeleteConfirm')}
                    okText={t('common.confirm')}
                    cancelText={t('common.cancel')}
                    onConfirm={() => handleDelete(item.photo as PetGalleryPhoto)}
                  >
                    <button type="button" className="pet-gallery-card__delete" aria-label={t('home.petUgcDelete')}>
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
        className="pet-gallery-preview"
        destroyOnClose
        onCancel={() => setPreviewItem(null)}
      >
        {activePreviewItem ? (
          <figure className="pet-gallery-preview__figure">
            <img src={activePreviewItem.image} alt={activePreviewItem.label} onError={usePetGalleryImageFallback} />
            <figcaption>
              <span>{activePreviewItem.label}</span>
              <Space wrap>
                <Button icon={<ShopOutlined />} onClick={() => navigate('/products?keyword=pet')}>
                  {t('home.petUgcShopFeed')}
                </Button>
                <Button type="primary" icon={activePreviewItem.likedByMe ? <HeartFilled /> : <HeartOutlined />} onClick={() => handleLike(activePreviewItem)}>
                  {t('home.petUgcLikes', { count: activePreviewItem.likeCount })}
                </Button>
              </Space>
            </figcaption>
          </figure>
        ) : null}
      </Modal>
    </main>
  );
};

export default PetGallery;
