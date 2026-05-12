import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Empty, Modal, Popconfirm, Skeleton, Space, Statistic, Typography, message } from 'antd';
import {
  CameraOutlined,
  DeleteOutlined,
  HeartFilled,
  HeartOutlined,
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

  const refreshGallery = useCallback(async () => {
    try {
      setLoading(true);
      const [photosRes, quotaRes] = await Promise.all([
        petGalleryApi.getAll(),
        isAuthenticated ? petGalleryApi.getQuota().catch(() => null) : Promise.resolve(null),
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
  const lastUpdated = useMemo(() => lastUpdatedAt.toLocaleTimeString(language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  }), [language, lastUpdatedAt]);
  const activePreviewItem = useMemo(
    () => (previewItem ? items.find((item) => item.key === previewItem.key) || previewItem : null),
    [items, previewItem],
  );

  const handleUploadClick = () => {
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
  };

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
      await refreshGallery();
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
      await refreshGallery();
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
          <Button icon={<ReloadOutlined />} onClick={refreshGallery}>
            {t('common.refresh')}
          </Button>
        </Space>
      </section>

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
              <Button type="primary" icon={activePreviewItem.likedByMe ? <HeartFilled /> : <HeartOutlined />} onClick={() => handleLike(activePreviewItem)}>
                {t('home.petUgcLikes', { count: activePreviewItem.likeCount })}
              </Button>
            </figcaption>
          </figure>
        ) : null}
      </Modal>
    </main>
  );
};

export default PetGallery;
