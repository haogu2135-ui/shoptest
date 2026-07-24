import React, { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import {
  clampZoom,
  getTouchDistance,
  getTouchPair,
  type GalleryTouchPoint,
} from '../pages/productDetailHelpers';
import type { ProductPublic as Product } from '../types';

type PinchZoomState = {
  active: boolean;
  scale: number;
  originX: number;
  originY: number;
};

type UseProductDetailGalleryParams = {
  activeMobileImageIndex: number;
  galleryImages: string[];
  isModalVisible: boolean;
  loading: boolean;
  product: Product | null;
  selectedImage: string;
  setActiveMobileImageIndex: Dispatch<SetStateAction<number>>;
  setSelectedImage: Dispatch<SetStateAction<string>>;
};

export const useProductDetailGallery = ({
  activeMobileImageIndex,
  galleryImages,
  isModalVisible,
  loading,
  product,
  selectedImage,
  setActiveMobileImageIndex,
  setSelectedImage,
}: UseProductDetailGalleryParams) => {
  const [documentHidden, setDocumentHidden] = useState(typeof document !== 'undefined' ? document.hidden : false);
  const [imagePaused, setImagePaused] = useState(false);
  const [pinchZoom, setPinchZoom] = useState<PinchZoomState>({ active: false, scale: 1, originX: 50, originY: 50 });
  const mobileGalleryRef = useRef<HTMLDivElement | null>(null);
  const pinchStartRef = useRef<{ distance: number; scale: number } | null>(null);
  const imageResumeTimerRef = useRef<number | null>(null);
  const galleryScrollRafRef = useRef<number | null>(null);

  const clearImageResumeTimer = useCallback(() => {
    if (imageResumeTimerRef.current !== null) {
      window.clearTimeout(imageResumeTimerRef.current);
      imageResumeTimerRef.current = null;
    }
  }, []);

  const pauseImageRotation = useCallback(() => {
    clearImageResumeTimer();
    setImagePaused(true);
  }, [clearImageResumeTimer]);

  const resumeImageRotation = useCallback(() => {
    clearImageResumeTimer();
    setImagePaused(false);
  }, [clearImageResumeTimer]);

  const scheduleImageRotationResume = useCallback((delay = 2600) => {
    clearImageResumeTimer();
    imageResumeTimerRef.current = window.setTimeout(() => {
      setImagePaused(false);
      imageResumeTimerRef.current = null;
    }, delay);
  }, [clearImageResumeTimer]);

  useEffect(() => clearImageResumeTimer, [clearImageResumeTimer]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
    const handleVisibilityChange = () => {
      setDocumentHidden(document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => () => {
    if (galleryScrollRafRef.current !== null) {
      window.cancelAnimationFrame(galleryScrollRafRef.current);
      galleryScrollRafRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (loading || !product || imagePaused || galleryImages.length <= 1 || isModalVisible) return;
    // Avoid background carousel timers in tests and when the tab is hidden.
    if (process.env.NODE_ENV === 'test') return;
    if (documentHidden) return;
    const timer = window.setInterval(() => {
      if (documentHidden) return;
      setActiveMobileImageIndex((currentIndex) => {
        const nextIndex = (currentIndex + 1) % galleryImages.length;
        const nextImage = galleryImages[nextIndex] || galleryImages[0];
        setSelectedImage(nextImage);
        const gallery = mobileGalleryRef.current;
        if (gallery) {
          gallery.scrollTo({ left: nextIndex * gallery.clientWidth, behavior: 'smooth' });
        }
        return nextIndex;
      });
    }, 3200);
    return () => window.clearInterval(timer);
  }, [documentHidden, galleryImages, imagePaused, isModalVisible, loading, product, setActiveMobileImageIndex, setSelectedImage]);

  const getPinchOrigin = useCallback((first: GalleryTouchPoint, second: GalleryTouchPoint) => {
    const gallery = mobileGalleryRef.current;
    if (!gallery) return { originX: 50, originY: 50 };
    const rect = gallery.getBoundingClientRect();
    const centerX = (first.clientX + second.clientX) / 2;
    const centerY = (first.clientY + second.clientY) / 2;
    return {
      originX: Math.min(100, Math.max(0, ((centerX - rect.left) / rect.width) * 100)),
      originY: Math.min(100, Math.max(0, ((centerY - rect.top) / rect.height) * 100)),
    };
  }, []);

  const handleGalleryTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 2) return;
    const pair = getTouchPair(event.touches);
    if (!pair) return;
    setImagePaused(true);
    pinchStartRef.current = { distance: getTouchDistance(pair.first, pair.second), scale: pinchZoom.scale };
    setPinchZoom({ active: true, scale: 1, ...getPinchOrigin(pair.first, pair.second) });
  };

  const handleGalleryTouchMove = useCallback((event: TouchEvent) => {
    if (event.touches.length !== 2 || !pinchStartRef.current) return;
    const pair = getTouchPair(event.touches);
    if (!pair) return;
    event.preventDefault();
    const nextScale = clampZoom((getTouchDistance(pair.first, pair.second) / pinchStartRef.current.distance) * pinchStartRef.current.scale);
    setPinchZoom({ active: true, scale: nextScale, ...getPinchOrigin(pair.first, pair.second) });
  }, [getPinchOrigin]);

  useEffect(() => {
    const gallery = mobileGalleryRef.current;
    if (!gallery) return;
    gallery.addEventListener('touchmove', handleGalleryTouchMove, { passive: false });
    return () => {
      gallery.removeEventListener('touchmove', handleGalleryTouchMove);
    };
  }, [handleGalleryTouchMove, loading]);

  const resetGalleryPinch = () => {
    if (!pinchStartRef.current && !pinchZoom.active) return;
    pinchStartRef.current = null;
    setPinchZoom((current) => ({ ...current, active: false, scale: 1 }));
    scheduleImageRotationResume();
  };

  const selectGalleryImage = (image: string, index: number) => {
    setSelectedImage(image);
    setActiveMobileImageIndex(index);
    const gallery = mobileGalleryRef.current;
    if (gallery) {
      gallery.scrollTo({ left: index * gallery.clientWidth, behavior: 'smooth' });
    }
  };

  const getActiveGalleryImageIndex = () => {
    const selectedIndex = galleryImages.findIndex((image) => image === selectedImage);
    if (selectedIndex >= 0) return selectedIndex;
    return Math.min(Math.max(activeMobileImageIndex, 0), Math.max(galleryImages.length - 1, 0));
  };

  const selectAdjacentGalleryImage = (direction: -1 | 1, fromIndex = getActiveGalleryImageIndex()) => {
    if (galleryImages.length <= 1) return;
    const nextIndex = (fromIndex + direction + galleryImages.length) % galleryImages.length;
    const nextImage = galleryImages[nextIndex];
    if (!nextImage) return;
    selectGalleryImage(nextImage, nextIndex);
    pauseImageRotation();
    scheduleImageRotationResume(5000);
  };

  const handleGalleryKeyDown = (event: React.KeyboardEvent<HTMLElement>, fromIndex?: number) => {
    if (galleryImages.length <= 1) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      selectAdjacentGalleryImage(-1, fromIndex);
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      selectAdjacentGalleryImage(1, fromIndex);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      selectGalleryImage(galleryImages[0], 0);
      pauseImageRotation();
      scheduleImageRotationResume(5000);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      const lastIndex = galleryImages.length - 1;
      selectGalleryImage(galleryImages[lastIndex], lastIndex);
      pauseImageRotation();
      scheduleImageRotationResume(5000);
    }
  };

  const handleMobileGalleryScroll = () => {
    if (galleryScrollRafRef.current !== null) return;
    galleryScrollRafRef.current = window.requestAnimationFrame(() => {
      galleryScrollRafRef.current = null;
      const gallery = mobileGalleryRef.current;
      if (!gallery || galleryImages.length <= 1) return;
      const index = Math.round(gallery.scrollLeft / gallery.clientWidth);
      const safeIndex = Math.min(Math.max(index, 0), galleryImages.length - 1);
      const image = galleryImages[safeIndex];
      setActiveMobileImageIndex(safeIndex);
      if (image) {
        setSelectedImage((currentImage) => (image === currentImage ? currentImage : image));
      }
    });
  };

  return {
    handleGalleryKeyDown,
    handleGalleryTouchStart,
    handleMobileGalleryScroll,
    imagePaused,
    mobileGalleryRef,
    pauseImageRotation,
    pinchZoom,
    resetGalleryPinch,
    resumeImageRotation,
    scheduleImageRotationResume,
    selectAdjacentGalleryImage,
    selectGalleryImage,
    setImagePaused,
  };
};
