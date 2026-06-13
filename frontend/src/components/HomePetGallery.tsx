import React from 'react';
import { Modal, Popconfirm } from 'antd';
import { CameraOutlined, DeleteOutlined, HeartFilled, HeartOutlined } from '@ant-design/icons';
import type { PetGalleryPhotoPublic } from '../types';
import { buildResponsiveImageSrcSet, getOptimizedImageUrl, imageFallbacks } from '../utils/mediaAssets';

const petGalleryImageSizes = '(max-width: 575px) 50vw, (max-width: 991px) 25vw, 180px';
const petGalleryImageFallback = imageFallbacks.media;

type HomeTranslate = (key: string, values?: Record<string, string | number>) => string;

export type HomePetGalleryItem = {
  key: string;
  image: string;
  label: string;
  likeCount: number;
  likedByMe: boolean;
  canDelete: boolean;
  photo?: PetGalleryPhotoPublic;
};

export type HomePetGalleryProps = {
  t: HomeTranslate;
  items: HomePetGalleryItem[];
  previewItem: HomePetGalleryItem | null;
  uploadInputRef: React.RefObject<HTMLInputElement>;
  uploadButtonLabel: string;
  uploading: boolean;
  uploadDisabled: boolean;
  galleryActionLabel: string;
  onUploadClick: () => void;
  onPhotoSelected: React.ChangeEventHandler<HTMLInputElement>;
  onOpenGallery: () => void;
  onPreviewItem: (item: HomePetGalleryItem) => void;
  onClosePreview: () => void;
  onLike: (item: HomePetGalleryItem) => void;
  onDeletePhoto: (photo: PetGalleryPhotoPublic) => void;
};

const applyPetGalleryImageFallback = (event: React.SyntheticEvent<HTMLImageElement>) => {
  if (event.currentTarget.src !== petGalleryImageFallback) {
    event.currentTarget.removeAttribute('srcset');
    event.currentTarget.src = petGalleryImageFallback;
  }
};

const HomePetGallery: React.FC<HomePetGalleryProps> = ({
  t,
  items,
  previewItem,
  uploadInputRef,
  uploadButtonLabel,
  uploading,
  uploadDisabled,
  galleryActionLabel,
  onUploadClick,
  onPhotoSelected,
  onOpenGallery,
  onPreviewItem,
  onClosePreview,
  onLike,
  onDeletePhoto,
}) => (
  <>
    <section className="shopee-section pet-ugc">
      <div className="shopee-section__header">
        <h2><CameraOutlined /> {t('home.petUgcTitle')}</h2>
        <div className="pet-ugc__actions">
          <input
            ref={uploadInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif"
            onChange={onPhotoSelected}
            className="pet-ugc__file"
            aria-label={uploadButtonLabel}
          />
          <button
            type="button"
            className="pet-ugc__upload"
            onClick={onUploadClick}
            disabled={uploading || uploadDisabled}
          >
            <CameraOutlined /> {uploadButtonLabel}
          </button>
          <button type="button" aria-label={galleryActionLabel} title={galleryActionLabel} onClick={onOpenGallery}>
            {t('nav.petGallery')}
          </button>
        </div>
      </div>
      <div className="pet-ugc__grid">
        {items.map((item, index) => {
          const photo = item.photo;
          const likeActionLabel = `${t('home.petUgcLikes', { count: item.likeCount })}: ${item.label}`;
          const deleteActionLabel = `${t('home.petUgcDelete')}: ${item.label}`;
          return (
            <div key={item.key} className="pet-ugc__card">
              <button
                className="pet-ugc__imageButton"
                type="button"
                aria-label={`${t('home.petUgcTitle')} ${item.label}`}
                onClick={() => onPreviewItem(item)}
              >
                <img
                  src={getOptimizedImageUrl(item.image, 360)}
                  srcSet={buildResponsiveImageSrcSet(item.image, [240, 360, 520])}
                  sizes={petGalleryImageSizes}
                  alt={t('home.petUgcImageAlt', { count: index + 1 })}
                  width={360}
                  height={360}
                  loading="lazy"
                  decoding="async"
                  onError={applyPetGalleryImageFallback}
                />
                <span>{item.label}</span>
              </button>
              <div className="pet-ugc__meta">
                <button
                  type="button"
                  className={item.likedByMe ? 'pet-ugc__like pet-ugc__like--active' : 'pet-ugc__like'}
                  aria-pressed={item.likedByMe}
                  aria-label={likeActionLabel}
                  title={likeActionLabel}
                  onClick={() => onLike(item)}
                >
                  {item.likedByMe ? <HeartFilled /> : <HeartOutlined />}
                  {t('home.petUgcLikes', { count: item.likeCount })}
                </button>
                {item.canDelete && photo ? (
                  <Popconfirm
                    classNames={{ root: 'shop-mobile-popup-layer shopee-home-popconfirm' }}
                    title={t('home.petUgcDeleteConfirm')}
                    okText={t('common.confirm')}
                    cancelText={t('common.cancel')}
                    okButtonProps={{ danger: true, 'aria-label': deleteActionLabel, title: deleteActionLabel }}
                    cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${deleteActionLabel}`, title: `${t('common.cancel')}: ${deleteActionLabel}` }}
                    onConfirm={() => onDeletePhoto(photo)}
                  >
                    <button type="button" className="pet-ugc__delete" aria-label={deleteActionLabel} title={deleteActionLabel}>
                      <DeleteOutlined />
                    </button>
                  </Popconfirm>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>

    <Modal
      open={Boolean(previewItem)}
      footer={null}
      centered
      width={720}
      className="profile-mobile-safe-modal pet-ugc-preview"
      destroyOnHidden
      onCancel={onClosePreview}
    >
      {previewItem ? (
        <figure className="pet-ugc-preview__figure">
          <img
            src={getOptimizedImageUrl(previewItem.image, 960)}
            srcSet={buildResponsiveImageSrcSet(previewItem.image, [720, 960, 1200])}
            sizes="min(720px, 100vw)"
            alt={previewItem.label}
            width={960}
            height={960}
            decoding="async"
            onError={applyPetGalleryImageFallback}
          />
          <figcaption>{previewItem.label}</figcaption>
        </figure>
      ) : null}
    </Modal>
  </>
);

export default HomePetGallery;
