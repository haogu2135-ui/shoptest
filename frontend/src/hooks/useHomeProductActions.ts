import React, { useCallback, useEffect } from 'react';
import type { ChangeEventHandler, Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import type { PetGalleryPhotoPublic, PetGalleryQuota, ProductPublic as Product } from '../types';
import { cartApi, petGalleryApi, productApi, wishlistApi } from '../api';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { addGuestCartItem } from '../utils/guestCart';
import { needsOptionSelection } from '../utils/productOptions';
import { getApiErrorMessage } from '../utils/apiError';
import { buildLoginUrlFromWindow } from '../utils/authRedirect';
import { dispatchDomEvent } from '../utils/domEvents';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import { cancelIdleTask, scheduleIdleTask } from '../utils/idleScheduler';
import { isSupportedPetGalleryImageFile } from '../utils/petGalleryUpload';
import { allSettledWithConcurrency } from '../utils/asyncBatch';
import type { Language } from '../i18n';
import type { HomePetGalleryItem } from '../components/HomePetGallery';
import {
  PET_GALLERY_MAX_FILE_SIZE,
  writeLocalPetGalleryLikes,
} from '../pages/homeHelpers';

type Translate = (key: string, params?: Record<string, string | number>) => string;

type UseHomeProductActionsArgs = {
  navigate: NavigateFunction;
  t: Translate;
  language: Language;
  isAuthenticated: boolean;
  petGalleryQuota: PetGalleryQuota | null;
  localPetGalleryLikes: string[];
  petUploadInputRef: MutableRefObject<HTMLInputElement | null>;
  personalizedReadyProducts: Product[];
  openCartWithSnapshot: () => unknown;
  setPetGalleryPhotos: Dispatch<SetStateAction<PetGalleryPhotoPublic[]>>;
  setPetGalleryQuota: Dispatch<SetStateAction<PetGalleryQuota | null>>;
  setUploadingPetPhoto: Dispatch<SetStateAction<boolean>>;
  setLocalPetGalleryLikes: Dispatch<SetStateAction<string[]>>;
  setWishlistedProductIds: Dispatch<SetStateAction<Set<number>>>;
};

export const useHomeProductActions = ({
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
}: UseHomeProductActionsArgs) => {
  const prefetchProduct = useCallback((productId: number) => {
    void productApi.prefetchById(productId);
  }, []);

  const openProduct = useCallback((productId: number) => {
    navigate(`/products/${productId}`);
  }, [navigate]);

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
  }, [isAuthenticated, setPetGalleryPhotos, setPetGalleryQuota]);

  useEffect(() => {
    const task = scheduleIdleTask(() => {
      void refreshPetGallery();
    }, 1600);
    return () => cancelIdleTask(task);
  }, [refreshPetGallery]);

  const handlePetUploadClick = useCallback(() => {
    if (!isAuthenticated) {
      announceAccessibleMessage(t('messages.loginRequired'), 'warning');
      navigate(buildLoginUrlFromWindow());
      return;
    }
    if (petGalleryQuota && !petGalleryQuota.canUpload) {
      announceAccessibleMessage(t('home.petUgcLimitReached'), 'warning');
      return;
    }
    petUploadInputRef.current?.click();
  }, [isAuthenticated, navigate, petGalleryQuota, petUploadInputRef, t]);

  const handlePetPhotoSelected: ChangeEventHandler<HTMLInputElement> = useCallback(async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const isSupportedImage = isSupportedPetGalleryImageFile(file);
    if (!isSupportedImage) {
      announceAccessibleMessage(t('home.petUgcInvalidType'), 'error');
      return;
    }
    if (file.size > PET_GALLERY_MAX_FILE_SIZE) {
      announceAccessibleMessage(t('home.petUgcTooLarge'), 'error');
      return;
    }

    setUploadingPetPhoto(true);
    try {
      const response = await petGalleryApi.upload(file);
      setPetGalleryPhotos((current) => [response.data, ...current.filter((photo) => photo.id !== response.data.id)].slice(0, 24));
      announceAccessibleMessage(t('home.petUgcUploadSuccess'), 'success');
      await refreshPetGallery();
    } catch (error) {
      announceAccessibleMessage(getApiErrorMessage(error, t('home.petUgcUploadFailed'), language), 'error');
    } finally {
      setUploadingPetPhoto(false);
    }
  }, [language, refreshPetGallery, setPetGalleryPhotos, setUploadingPetPhoto, t]);

  const handlePetGalleryLike = useCallback(async (item: HomePetGalleryItem) => {
    if (!item.photo) {
      if (localPetGalleryLikes.includes(item.key)) {
        announceAccessibleMessage(t('home.petUgcAlreadyLiked'), 'info');
        return;
      }
      const nextLikes = [...localPetGalleryLikes, item.key];
      setLocalPetGalleryLikes(nextLikes);
      writeLocalPetGalleryLikes(nextLikes);
      announceAccessibleMessage(t('home.petUgcLiked'), 'success');
      return;
    }
    if (item.photo.likedByMe) {
      announceAccessibleMessage(t('home.petUgcAlreadyLiked'), 'info');
      return;
    }
    try {
      const response = await petGalleryApi.like(item.photo.id);
      setPetGalleryPhotos((current) => current.map((photo) => photo.id === response.data.id ? response.data : photo));
      announceAccessibleMessage(t('home.petUgcLiked'), 'success');
    } catch (error) {
      announceAccessibleMessage(getApiErrorMessage(error, t('home.petUgcLikeFailed'), language), 'error');
    }
  }, [language, localPetGalleryLikes, setLocalPetGalleryLikes, setPetGalleryPhotos, t]);

  const handleDeletePetPhoto = useCallback(async (photo: PetGalleryPhotoPublic) => {
    try {
      await petGalleryApi.delete(photo.id);
      setPetGalleryPhotos((current) => current.filter((item) => item.id !== photo.id));
      announceAccessibleMessage(t('home.petUgcDeleted'), 'success');
      await refreshPetGallery();
    } catch (error) {
      announceAccessibleMessage(getApiErrorMessage(error, t('home.petUgcDeleteFailed'), language), 'error');
    }
  }, [language, refreshPetGallery, setPetGalleryPhotos, t]);

  const handleQuickAddToCart = useCallback(async (event: React.MouseEvent | undefined, product: Product) => {
    event?.stopPropagation();
    if (product.stock !== undefined && product.stock <= 0) {
      announceAccessibleMessage(t('pages.productList.soldOut'), 'warning');
      return;
    }
    if (needsOptionSelection(product)) {
      announceAccessibleMessage(t('pages.wishlist.selectOptions'), 'info');
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
      announceAccessibleMessage(t('messages.addCartSuccess'), 'success');
    } catch (error) {
      announceAccessibleMessage(getApiErrorMessage(error, t('messages.addFailed'), language), 'error');
    }
  }, [isAuthenticated, language, openCartWithSnapshot, openProduct, t]);

  const handleQuickWishlist = useCallback(async (event: React.MouseEvent, product: Product) => {
    event.stopPropagation();
    if (!isAuthenticated) {
      announceAccessibleMessage(t('messages.loginRequired'), 'warning');
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
      announceAccessibleMessage(response.data.wishlisted ? t('pages.productDetail.favoritedMsg') : t('pages.productDetail.unfavoritedMsg'), 'success');
    } catch (error) {
      announceAccessibleMessage(getApiErrorMessage(error, t('messages.operationFailed'), language), 'error');
    }
  }, [isAuthenticated, language, navigate, setWishlistedProductIds, t]);

  const addPersonalizedReadyProducts = useCallback(async () => {
    if (personalizedReadyProducts.length === 0) {
      announceAccessibleMessage(t('pages.compare.recommendationEmpty'), 'info');
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
          announceAccessibleMessage(t('messages.addFailed'), 'error');
          return;
        }
        dispatchDomEvent('shop:cart-updated');
        await openCartWithSnapshot();
        announceAccessibleMessage(t('pages.wishlist.addedAllToCart', { count: added }), 'success');
      } else {
        personalizedReadyProducts.forEach((product) => addGuestCartItem(product, 1));
        await openCartWithSnapshot();
        announceAccessibleMessage(t('pages.wishlist.addedAllToCart', { count: personalizedReadyProducts.length }), 'success');
      }
    } catch (error) {
      announceAccessibleMessage(getApiErrorMessage(error, t('messages.addFailed'), language), 'error');
    }
  }, [isAuthenticated, language, openCartWithSnapshot, personalizedReadyProducts, t]);

  return {
    prefetchProduct,
    openProduct,
    handlePetUploadClick,
    handlePetPhotoSelected,
    handlePetGalleryLike,
    handleDeletePetPhoto,
    handleQuickAddToCart,
    handleQuickWishlist,
    addPersonalizedReadyProducts,
  };
};
