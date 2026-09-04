import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { cartApi } from '../api';
import type { Language } from '../i18n';
import type { ProductPublic as Product } from '../types';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { getApiErrorMessage } from '../utils/apiError';
import { dispatchDomEvent } from '../utils/domEvents';
import { addGuestCartItem } from '../utils/guestCart';
import { needsOptionSelection } from '../utils/productOptions';
import { getLocalStorageItem } from '../utils/safeStorage';
import {
  isRecommendationUnavailable,
  type ProductRecommendationCandidate,
} from '../pages/productDetailHelpers';

type UseProductDetailRecommendationActionsParams = {
  language: Language;
  navigate: NavigateFunction;
  scopeKey?: string;
  t: (key: string, params?: Record<string, string | number>) => string;
};

/**
 * Commercial product-detail recommendation cart actions:
 * in-flight guard, sold-out/option routing, guest + auth add-to-cart.
 */
export const useProductDetailRecommendationActions = ({
  language,
  navigate,
  scopeKey,
  t,
}: UseProductDetailRecommendationActionsParams) => {
  const [recommendationAddingId, setRecommendationAddingId] = useState<number | null>(null);
  const recommendationRequestIdsRef = useRef<Set<number>>(new Set());
  const scopeSeqRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      scopeSeqRef.current += 1;
      recommendationRequestIdsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (mountedRef.current) setRecommendationAddingId(null);
    return () => {
    scopeSeqRef.current += 1;
    recommendationRequestIdsRef.current.clear();
    };
  }, [scopeKey]);

  const handleAddRecommendationToCart = async (
    event: MouseEvent<HTMLElement>,
    item: Product | ProductRecommendationCandidate,
  ) => {
    event.stopPropagation();
    const recommendationId = Number(item.id);
    if (!Number.isFinite(recommendationId) || recommendationRequestIdsRef.current.has(recommendationId)) {
      return;
    }
    if (isRecommendationUnavailable(item)) {
      announceAccessibleMessage(t('pages.productDetail.soldOut'), 'warning');
      return;
    }
    if (needsOptionSelection(item as Product)) {
      announceAccessibleMessage(t('pages.wishlist.selectOptions'), 'info');
      navigate(`/products/${item.id}`);
      return;
    }

    const token = getLocalStorageItem('token');
    const scopeSeq = scopeSeqRef.current;
    try {
      recommendationRequestIdsRef.current.add(recommendationId);
      setRecommendationAddingId(recommendationId);
      if (token) {
        await cartApi.addItem(0, recommendationId, 1);
        if (!mountedRef.current || scopeSeqRef.current !== scopeSeq) return;
        dispatchDomEvent('shop:cart-updated');
      } else {
        addGuestCartItem(item as Product, 1, undefined, item.effectivePrice ?? item.price);
      }
      if (!mountedRef.current || scopeSeqRef.current !== scopeSeq) return;
      announceAccessibleMessage(t('messages.addCartSuccess'), 'success');
      dispatchDomEvent('shop:open-cart');
    } catch (err: unknown) {
      if (!mountedRef.current || scopeSeqRef.current !== scopeSeq) return;
      announceAccessibleMessage(getApiErrorMessage(err, t('messages.addFailed'), language), 'error');
    } finally {
      recommendationRequestIdsRef.current.delete(recommendationId);
      if (mountedRef.current && scopeSeqRef.current === scopeSeq) setRecommendationAddingId(null);
    }
  };

  const resetRecommendationCartState = useCallback(() => {
    recommendationRequestIdsRef.current.clear();
    if (mountedRef.current) setRecommendationAddingId(null);
  }, []);

  return {
    handleAddRecommendationToCart,
    recommendationAddingId,
    resetRecommendationCartState,
  };
};
