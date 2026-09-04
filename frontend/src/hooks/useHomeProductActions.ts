import React, { useCallback, useEffect, useRef } from 'react';
import type { ChangeEventHandler, Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import type { PetGalleryPhotoPublic, PetGalleryQuota, ProductPublic as Product } from '../types';
import { cartApi, createApiAbortController, petGalleryApi, productApi, wishlistApi } from '../api';
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
  openCartWithSnapshot: (signal?: AbortSignal) => unknown;
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
  const mountedRef = useRef(true);
  const petGalleryRefreshSeqRef = useRef(0);
  const petGalleryAbortRef = useRef<AbortController | null>(null);
  const uploadingPetPhotoRef = useRef(false);
  const likingPetPhotoIdsRef = useRef(new Set<number>());
  const deletingPetPhotoIdsRef = useRef(new Set<number>());
  const quickAddingProductIdsRef = useRef(new Set<number>());
  const quickWishlistingProductIdsRef = useRef(new Set<number>());
  const addingPersonalizedProductsRef = useRef(false);
  const cartSnapshotAbortControllersRef = useRef(new Set<AbortController>());

  const createCartSnapshotAbortController = useCallback(() => {
    const abortController = createApiAbortController();
    cartSnapshotAbortControllersRef.current.add(abortController);
    return abortController;
  }, []);

  const releaseCartSnapshotAbortController = useCallback((abortController: AbortController) => {
    cartSnapshotAbortControllersRef.current.delete(abortController);
  }, []);

  const prefetchProduct = useCallback((productId: number) => {
    void productApi.prefetchById(productId);
  }, []);

  const openProduct = useCallback((productId: number) => {
    navigate(`/products/${productId}`);
  }, [navigate]);

  const refreshPetGallery = useCallback(async () => {
    const requestSeq = petGalleryRefreshSeqRef.current + 1;
    petGalleryRefreshSeqRef.current = requestSeq;
    petGalleryAbortRef.current?.abort();
    const abortController = createApiAbortController();
    petGalleryAbortRef.current = abortController;
    const isCurrentRequest = () => mountedRef.current
      && petGalleryRefreshSeqRef.current === requestSeq
      && !abortController.signal.aborted;
    try {
      const [photosRes, quotaRes] = await Promise.all([
        petGalleryApi.getAll(false, { signal: abortController.signal }),
        isAuthenticated
          ? petGalleryApi.getQuota(false, { signal: abortController.signal }).catch((error) => {
            if (abortController.signal.aborted) throw error;
            reportNonBlockingError('Home.refreshPetGalleryQuota', error);
            return null;
          })
          : Promise.resolve(null),
      ]);
      if (!isCurrentRequest()) return;
      setPetGalleryPhotos(photosRes.data);
      setPetGalleryQuota(quotaRes?.data || null);
    } catch (error) {
      if (!isCurrentRequest()) return;
      reportNonBlockingError('Home.refreshPetGallery', error);
      setPetGalleryPhotos([]);
      setPetGalleryQuota(null);
    } finally {
      if (petGalleryAbortRef.current === abortController) petGalleryAbortRef.current = null;
    }
  }, [isAuthenticated, setPetGalleryPhotos, setPetGalleryQuota]);

  useEffect(() => {
    const task = scheduleIdleTask(() => {
      void refreshPetGallery();
    }, 1600);
    return () => {
      cancelIdleTask(task);
      petGalleryRefreshSeqRef.current += 1;
      petGalleryAbortRef.current?.abort();
      petGalleryAbortRef.current = null;
    };
  }, [refreshPetGallery]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      petGalleryRefreshSeqRef.current += 1;
      petGalleryAbortRef.current?.abort();
      petGalleryAbortRef.current = null;
      cartSnapshotAbortControllersRef.current.forEach((abortController) => abortController.abort());
      cartSnapshotAbortControllersRef.current.clear();
      likingPetPhotoIdsRef.current.clear();
      deletingPetPhotoIdsRef.current.clear();
      quickAddingProductIdsRef.current.clear();
      quickWishlistingProductIdsRef.current.clear();
      addingPersonalizedProductsRef.current = false;
    };
  }, []);

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
    if (!mountedRef.current || uploadingPetPhotoRef.current) return;
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

    uploadingPetPhotoRef.current = true;
    setUploadingPetPhoto(true);
    try {
      const response = await petGalleryApi.upload(file);
      if (!mountedRef.current) return;
      setPetGalleryPhotos((current) => [response.data, ...current.filter((photo) => photo.id !== response.data.id)].slice(0, 24));
      announceAccessibleMessage(t('home.petUgcUploadSuccess'), 'success');
      await refreshPetGallery();
    } catch (error) {
      if (mountedRef.current) {
        announceAccessibleMessage(getApiErrorMessage(error, t('home.petUgcUploadFailed'), language), 'error');
      }
    } finally {
      uploadingPetPhotoRef.current = false;
      if (mountedRef.current) setUploadingPetPhoto(false);
    }
  }, [language, refreshPetGallery, setPetGalleryPhotos, setUploadingPetPhoto, t]);

  const handlePetGalleryLike = useCallback(async (item: HomePetGalleryItem) => {
    if (!mountedRef.current) return;
    if (item.isSample) {
      announceAccessibleMessage(t('pages.petGallery.sampleSource'), 'info');
      return;
    }
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
    if (likingPetPhotoIdsRef.current.has(item.photo.id)) return;
    likingPetPhotoIdsRef.current.add(item.photo.id);
    try {
      const response = await petGalleryApi.like(item.photo.id);
      if (!mountedRef.current) return;
      setPetGalleryPhotos((current) => current.map((photo) => photo.id === response.data.id ? response.data : photo));
      announceAccessibleMessage(t('home.petUgcLiked'), 'success');
    } catch (error) {
      if (mountedRef.current) {
        announceAccessibleMessage(getApiErrorMessage(error, t('home.petUgcLikeFailed'), language), 'error');
      }
    } finally {
      likingPetPhotoIdsRef.current.delete(item.photo.id);
    }
  }, [language, localPetGalleryLikes, setLocalPetGalleryLikes, setPetGalleryPhotos, t]);

  const handleDeletePetPhoto = useCallback(async (photo: PetGalleryPhotoPublic) => {
    if (!mountedRef.current || deletingPetPhotoIdsRef.current.has(photo.id)) return;
    deletingPetPhotoIdsRef.current.add(photo.id);
    try {
      await petGalleryApi.delete(photo.id);
      if (!mountedRef.current) return;
      setPetGalleryPhotos((current) => current.filter((item) => item.id !== photo.id));
      announceAccessibleMessage(t('home.petUgcDeleted'), 'success');
      await refreshPetGallery();
    } catch (error) {
      if (mountedRef.current) {
        announceAccessibleMessage(getApiErrorMessage(error, t('home.petUgcDeleteFailed'), language), 'error');
      }
    } finally {
      deletingPetPhotoIdsRef.current.delete(photo.id);
    }
  }, [language, refreshPetGallery, setPetGalleryPhotos, t]);

  const handleQuickAddToCart = useCallback(async (event: React.MouseEvent | undefined, product: Product) => {
    event?.stopPropagation();
    if (!mountedRef.current || quickAddingProductIdsRef.current.has(product.id)) return;
    if (product.stock !== undefined && product.stock <= 0) {
      announceAccessibleMessage(t('pages.productList.soldOut'), 'warning');
      return;
    }
    if (needsOptionSelection(product)) {
      announceAccessibleMessage(t('pages.wishlist.selectOptions'), 'info');
      openProduct(product.id);
      return;
    }

    quickAddingProductIdsRef.current.add(product.id);
    const abortController = createCartSnapshotAbortController();
    try {
      if (isAuthenticated) {
        await cartApi.addItem(0, product.id, 1);
        if (!mountedRef.current) return;
        dispatchDomEvent('shop:cart-updated');
      } else {
        addGuestCartItem(product, 1);
      }
      if (!mountedRef.current) return;
      await openCartWithSnapshot(abortController.signal);
      if (!mountedRef.current || abortController.signal.aborted) return;
      announceAccessibleMessage(t('messages.addCartSuccess'), 'success');
    } catch (error) {
      if (mountedRef.current && !abortController.signal.aborted) {
        announceAccessibleMessage(getApiErrorMessage(error, t('messages.addFailed'), language), 'error');
      }
    } finally {
      quickAddingProductIdsRef.current.delete(product.id);
      releaseCartSnapshotAbortController(abortController);
    }
  }, [createCartSnapshotAbortController, isAuthenticated, language, openCartWithSnapshot, openProduct, releaseCartSnapshotAbortController, t]);

  const handleQuickWishlist = useCallback(async (event: React.MouseEvent, product: Product) => {
    event.stopPropagation();
    if (!mountedRef.current || quickWishlistingProductIdsRef.current.has(product.id)) return;
    if (!isAuthenticated) {
      announceAccessibleMessage(t('messages.loginRequired'), 'warning');
      navigate(buildLoginUrlFromWindow());
      return;
    }

    quickWishlistingProductIdsRef.current.add(product.id);
    try {
      const response = await wishlistApi.toggle(0, product.id);
      if (!mountedRef.current) return;
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
      if (mountedRef.current) {
        announceAccessibleMessage(getApiErrorMessage(error, t('messages.operationFailed'), language), 'error');
      }
    } finally {
      quickWishlistingProductIdsRef.current.delete(product.id);
    }
  }, [isAuthenticated, language, navigate, setWishlistedProductIds, t]);

  const addPersonalizedReadyProducts = useCallback(async () => {
    if (!mountedRef.current || addingPersonalizedProductsRef.current) return;
    if (personalizedReadyProducts.length === 0) {
      announceAccessibleMessage(t('pages.compare.recommendationEmpty'), 'info');
      return;
    }
    addingPersonalizedProductsRef.current = true;
    const abortController = createCartSnapshotAbortController();
    try {
      if (isAuthenticated) {
        const results = await allSettledWithConcurrency(
          personalizedReadyProducts,
          (product) => cartApi.addItem(0, product.id, 1),
        );
        if (!mountedRef.current) return;
        const added = results.filter((result) => result.status === 'fulfilled').length;
        if (added === 0) {
          announceAccessibleMessage(t('messages.addFailed'), 'error');
          return;
        }
        dispatchDomEvent('shop:cart-updated');
        await openCartWithSnapshot(abortController.signal);
        if (!mountedRef.current || abortController.signal.aborted) return;
        announceAccessibleMessage(t('pages.wishlist.addedAllToCart', { count: added }), 'success');
      } else {
        personalizedReadyProducts.forEach((product) => addGuestCartItem(product, 1));
        if (!mountedRef.current) return;
        await openCartWithSnapshot(abortController.signal);
        if (!mountedRef.current || abortController.signal.aborted) return;
        announceAccessibleMessage(t('pages.wishlist.addedAllToCart', { count: personalizedReadyProducts.length }), 'success');
      }
    } catch (error) {
      if (mountedRef.current && !abortController.signal.aborted) {
        announceAccessibleMessage(getApiErrorMessage(error, t('messages.addFailed'), language), 'error');
      }
    } finally {
      addingPersonalizedProductsRef.current = false;
      releaseCartSnapshotAbortController(abortController);
    }
  }, [createCartSnapshotAbortController, isAuthenticated, language, openCartWithSnapshot, personalizedReadyProducts, releaseCartSnapshotAbortController, t]);

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
