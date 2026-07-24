import React from 'react';
import type { Dispatch, KeyboardEvent, MutableRefObject, SetStateAction, TouchEvent as ReactTouchEvent } from 'react';
import ShopModal from '../components/ShopModal';
import ShopTag from '../components/ShopTag';
import { buildResponsiveImageSrcSet, getOptimizedImageUrl } from '../utils/mediaAssets';
import {
  applyImageFallback,
  eagerImagePriorityProps,
  handleGalleryZoomLeave,
  handleGalleryZoomMove,
  lazyImagePriorityProps,
} from './productDetailHelpers';

type GalleryPinchZoom = {
  active: boolean;
  scale: number;
  originX: number;
  originY: number;
};

type ProductDetailGalleryProps = {
  activeMobileImageIndex: number;
  discountPercent: number;
  galleryImages: string[];
  handleGalleryKeyDown: (event: KeyboardEvent<HTMLElement>, startIndex?: number) => void;
  handleGalleryTouchStart: (event: ReactTouchEvent<HTMLDivElement>) => void;
  handleMobileGalleryScroll: () => void;
  heroImage: string;
  heroImageSizes: string;
  heroImageSrcSet?: string;
  imagePaused: boolean;
  mobileGalleryRef: MutableRefObject<HTMLDivElement | null>;
  pauseImageRotation: () => void;
  pinchZoom: GalleryPinchZoom;
  productImages: string[];
  productName: string;
  resetGalleryPinch: () => void;
  resumeImageRotation: () => void;
  scheduleImageRotationResume: (delayMs?: number) => void;
  selectGalleryImage: (image: string, index: number) => void;
  selectedImage: string;
  setImagePaused: Dispatch<SetStateAction<boolean>>;
  setIsModalVisible: Dispatch<SetStateAction<boolean>>;
  setSelectedImage: Dispatch<SetStateAction<string>>;
  t: (key: string, params?: Record<string, string | number>) => string;
};

type ProductDetailImagePreviewModalProps = {
  isModalVisible: boolean;
  productImages: string[];
  productName: string;
  selectedImage: string;
  setIsModalVisible: Dispatch<SetStateAction<boolean>>;
  t: (key: string, params?: Record<string, string | number>) => string;
};

/**
 * Commercial product-detail media gallery:
 * hero image, mobile carousel, thumbs, pause/play controls, and pinch zoom surface.
 */
export const ProductDetailGallery: React.FC<ProductDetailGalleryProps> = ({
  activeMobileImageIndex,
  discountPercent,
  galleryImages,
  handleGalleryKeyDown,
  handleGalleryTouchStart,
  handleMobileGalleryScroll,
  heroImage,
  heroImageSizes,
  heroImageSrcSet,
  imagePaused,
  mobileGalleryRef,
  pauseImageRotation,
  pinchZoom,
  productImages,
  productName,
  resetGalleryPinch,
  resumeImageRotation,
  scheduleImageRotationResume,
  selectGalleryImage,
  selectedImage,
  setImagePaused,
  setIsModalVisible,
  setSelectedImage,
  t,
}) => {
  const galleryRegionLabel = `${productName}: ${t('pages.productDetail.product')} ${t('common.image')}`;
  const getGalleryImageLabel = (index: number) => t('pages.productDetail.imageThumb', {
    index: index + 1,
    total: galleryImages.length,
    name: productName,
  });
  const mainImagePreviewActionLabel = `${t('pages.productList.quickPreview')}: ${productName}`;
  const galleryFallback = productImages[productImages.length - 1];

  return (
    <div className="product-detail__gallery">
      <section className="product-gallery-card" aria-label={galleryRegionLabel}>
        <div
          className="product-detail-main-image"
          role="region"
          aria-roledescription="carousel"
          aria-label={galleryRegionLabel}
          tabIndex={0}
          onMouseEnter={pauseImageRotation}
          onMouseLeave={resumeImageRotation}
          onKeyDown={handleGalleryKeyDown}
        >
          <div
            ref={mobileGalleryRef}
            className="product-mobile-gallery"
            onScroll={handleMobileGalleryScroll}
            onPointerDown={pauseImageRotation}
            onPointerUp={() => scheduleImageRotationResume()}
            onPointerCancel={() => scheduleImageRotationResume()}
            onTouchStart={handleGalleryTouchStart}
            onTouchEnd={resetGalleryPinch}
            onTouchCancel={resetGalleryPinch}
          >
            {galleryImages.map((image: string, index: number) => (
              <div
                key={`${image}-${index}`}
                className="product-mobile-gallery__slide"
                role="group"
                aria-roledescription="slide"
                aria-label={getGalleryImageLabel(index)}
                aria-hidden={index === activeMobileImageIndex ? undefined : true}
              >
                <img
                  src={getOptimizedImageUrl(image, index === 0 ? 720 : 540)}
                  srcSet={buildResponsiveImageSrcSet(image, [360, 540, 720, 900])}
                  sizes="100vw"
                  alt={getGalleryImageLabel(index)}
                  className="product-mobile-gallery__img"
                  width={900}
                  height={900}
                  loading={index === 0 ? 'eager' : 'lazy'}
                  decoding="async"
                  {...(index === 0 ? eagerImagePriorityProps : lazyImagePriorityProps)}
                  style={pinchZoom.active && index === activeMobileImageIndex ? {
                    transform: `scale(${pinchZoom.scale})`,
                    transformOrigin: `${pinchZoom.originX}% ${pinchZoom.originY}%`,
                    transition: 'none',
                  } : undefined}
                  onError={(event) => {
                    applyImageFallback(event, galleryFallback);
                  }}
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            className="product-detail-main-image__button"
            aria-label={mainImagePreviewActionLabel}
            title={mainImagePreviewActionLabel}
            onClick={() => setIsModalVisible(true)}
          >
            <img
              src={heroImage}
              srcSet={heroImageSrcSet}
              sizes={heroImageSizes}
              alt={productName}
              className="product-detail-main-image__img"
              width={900}
              height={900}
              loading="eager"
              decoding="async"
              {...eagerImagePriorityProps}
              onMouseMove={handleGalleryZoomMove}
              onMouseLeave={handleGalleryZoomLeave}
              onError={(event) => {
                applyImageFallback(event, galleryFallback);
                setSelectedImage(galleryFallback);
              }}
            />
          </button>
          {discountPercent > 0 && (
            <ShopTag color="gold" className="product-gallery-discount">
              -{discountPercent}%
            </ShopTag>
          )}
          {galleryImages.length > 1 && (
            <div className="product-gallery-controls">
              <span className="product-mobile-gallery__count" aria-live="polite">
                {activeMobileImageIndex + 1}/{galleryImages.length}
              </span>
              <button
                type="button"
                className="product-gallery-controls__pause"
                aria-pressed={imagePaused}
                aria-label={imagePaused ? t('pages.productDetail.galleryPlay') : t('pages.productDetail.galleryPause')}
                title={imagePaused ? t('pages.productDetail.galleryPlay') : t('pages.productDetail.galleryPause')}
                onClick={() => setImagePaused((paused) => !paused)}
              >
                {imagePaused ? t('pages.productDetail.galleryPlay') : t('pages.productDetail.galleryPause')}
              </button>
              <span className="product-detail__srOnly" aria-live="polite">
                {imagePaused ? t('pages.productDetail.galleryPaused') : t('pages.productDetail.galleryPlaying')}
              </span>
            </div>
          )}
        </div>

        {galleryImages.length > 1 && (
          <div
            className="product-detail-thumbs product-detail-thumbs--strip"
            role="list"
            aria-label={`${t('pages.productDetail.product')} ${t('common.image')}`}
          >
            {galleryImages.map((image: string, index: number) => {
              const thumbLabel = getGalleryImageLabel(index);
              const selectThumb = () => {
                selectGalleryImage(image, index);
                pauseImageRotation();
                scheduleImageRotationResume(5000);
              };
              return (
                <div key={index} className="product-detail-thumbs__slide" role="listitem">
                  <button
                    type="button"
                    className={`product-detail-thumbs__button${selectedImage === image ? ' product-detail-thumbs__button--active' : ''}`}
                    aria-pressed={selectedImage === image}
                    aria-label={thumbLabel}
                    title={thumbLabel}
                    onClick={selectThumb}
                    onKeyDown={(event) => handleGalleryKeyDown(event, index)}
                  >
                    <img
                      src={getOptimizedImageUrl(image, 144)}
                      srcSet={buildResponsiveImageSrcSet(image, [96, 144, 192, 288])}
                      sizes="120px"
                      alt=""
                      className="product-detail-thumbs__img"
                      width={160}
                      height={160}
                      loading="lazy"
                      decoding="async"
                      onError={(event) => {
                        applyImageFallback(event, galleryFallback);
                      }}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {galleryImages.length > 1 && (
          <div className="product-mobile-thumbs" aria-label={`${t('pages.productDetail.product')} ${t('common.image')}`}>
            {galleryImages.map((image: string, index: number) => (
              <button
                key={`mobile-thumb-${image}-${index}`}
                type="button"
                className={`product-mobile-thumbs__button${activeMobileImageIndex === index ? ' product-mobile-thumbs__button--active' : ''}`}
                aria-pressed={activeMobileImageIndex === index}
                aria-label={getGalleryImageLabel(index)}
                title={getGalleryImageLabel(index)}
                onClick={() => selectGalleryImage(image, index)}
              >
                <img
                  src={getOptimizedImageUrl(image, 96)}
                  srcSet={buildResponsiveImageSrcSet(image, [96, 144, 192, 288])}
                  sizes="56px"
                  alt={getGalleryImageLabel(index)}
                  className="product-mobile-thumbs__img"
                  width={96}
                  height={96}
                  loading="lazy"
                  decoding="async"
                  onError={(event) => {
                    applyImageFallback(event, galleryFallback);
                  }}
                />
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

/**
 * Full-screen product image preview for conversion-safe media inspection.
 */
export const ProductDetailImagePreviewModal: React.FC<ProductDetailImagePreviewModalProps> = ({
  isModalVisible,
  productImages,
  productName,
  selectedImage,
  setIsModalVisible,
  t,
}) => (
  <ShopModal
    open={isModalVisible}
    footer={null}
    onClose={() => setIsModalVisible(false)}
    width="min(800px, calc(100vw - 24px))"
    className="profile-mobile-safe-modal product-detail__imageModal"
    rootClassName="product-detail__imageModalRoot"
    closeLabel={t('common.close', { defaultValue: 'Close' })}
    ariaLabel={productName}
  >
    <img
      className="product-detail__imageModalImg"
      src={getOptimizedImageUrl(selectedImage, 1200)}
      srcSet={buildResponsiveImageSrcSet(selectedImage, [480, 720, 960, 1200, 1600])}
      sizes="min(800px, calc(100vw - 24px))"
      alt={productName}
      width={1200}
      height={1200}
      decoding="async"
      onError={(event) => {
        applyImageFallback(event, productImages[productImages.length - 1]);
      }}
    />
  </ShopModal>
);

export default ProductDetailGallery;
